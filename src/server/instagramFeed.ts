import { execFile } from 'node:child_process'
import { promisify } from 'node:util'
import { instagramPosts as staticFallbackPosts } from '../data/instagramPosts'

const execFileAsync = promisify(execFile)

export interface InstagramFeedPost {
  id: string
  src: string
  permalink: string
  alt: string
  caption: string
}

export interface InstagramFeedResponse {
  source: 'graph' | 'public' | 'fallback'
  username: string
  posts: InstagramFeedPost[]
}

const DEFAULT_USERNAME = 'cctvelhacentral'
const DEFAULT_LIMIT = 9
const CACHE_TTL_MS = 15 * 60 * 1000
const ERROR_CACHE_TTL_MS = 2 * 60 * 1000
const IG_APP_ID = '936619743392459'

type CacheEntry = {
  expiresAt: number
  payload: InstagramFeedResponse
}

let cache: CacheEntry | null = null

export function getInstagramUsername() {
  return (process.env.INSTAGRAM_USERNAME || DEFAULT_USERNAME).replace(/^@/, '')
}

export function isAllowedInstagramMediaUrl(url: string) {
  try {
    const parsed = new URL(url)
    if (parsed.protocol !== 'https:') return false
    const host = parsed.hostname.toLowerCase()
    return (
      host.endsWith('cdninstagram.com') ||
      host.endsWith('fbcdn.net') ||
      host === 'instagram.com' ||
      host.endsWith('.instagram.com')
    )
  } catch {
    return false
  }
}

function firstCaptionLine(caption: string) {
  const first = caption
    .split('\n')
    .map((line) => line.trim())
    .find(Boolean)
  return (first || 'Publicação do Instagram do CCTVC').slice(0, 120)
}

function toProxySrc(mediaUrl: string) {
  return `/api/instagram?image=${encodeURIComponent(mediaUrl)}`
}

function normalizePosts(
  items: Array<{
    id: string
    permalink: string
    mediaUrl: string
    caption: string
  }>,
): InstagramFeedPost[] {
  return items.map((item) => {
    const caption = item.caption.trim()
    return {
      id: item.id,
      src: toProxySrc(item.mediaUrl),
      permalink: item.permalink,
      alt: firstCaptionLine(caption),
      caption: caption.slice(0, 280),
    }
  })
}

async function fetchGraphApiFeed(limit: number): Promise<InstagramFeedResponse | null> {
  const token = process.env.INSTAGRAM_ACCESS_TOKEN
  if (!token) return null

  const userId = process.env.INSTAGRAM_USER_ID || 'me'
  const fields = 'id,caption,media_type,media_url,permalink,thumbnail_url,timestamp'
  const url = new URL(`https://graph.instagram.com/${userId}/media`)
  url.searchParams.set('fields', fields)
  url.searchParams.set('limit', String(limit))
  url.searchParams.set('access_token', token)

  const response = await fetch(url)
  if (!response.ok) {
    const body = await response.text()
    throw new Error(`Instagram Graph API ${response.status}: ${body.slice(0, 200)}`)
  }

  const data = (await response.json()) as {
    data?: Array<{
      id: string
      caption?: string
      media_type?: string
      media_url?: string
      thumbnail_url?: string
      permalink: string
    }>
  }

  const posts = normalizePosts(
    (data.data || [])
      .map((item) => {
        const mediaUrl =
          item.media_type === 'VIDEO'
            ? item.thumbnail_url || item.media_url
            : item.media_url || item.thumbnail_url
        if (!mediaUrl) return null
        return {
          id: item.id,
          permalink: item.permalink,
          mediaUrl,
          caption: item.caption || '',
        }
      })
      .filter((item): item is NonNullable<typeof item> => Boolean(item))
      .slice(0, limit),
  )

  if (!posts.length) return null

  return {
    source: 'graph',
    username: getInstagramUsername(),
    posts,
  }
}

type PublicProfilePayload = {
  data?: {
    user?: {
      edge_owner_to_timeline_media?: {
        edges?: Array<{
          node?: {
            id?: string
            shortcode?: string
            display_url?: string
            thumbnail_src?: string
            is_video?: boolean
            edge_media_to_caption?: {
              edges?: Array<{ node?: { text?: string } }>
            }
          }
        }>
      }
    }
  }
}

async function fetchJsonWithCurl(url: string): Promise<{ status: number; body: string }> {
  const { stdout } = await execFileAsync(
    'curl',
    [
      '-sL',
      '-w',
      '\n%{http_code}',
      '-A',
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
      '-H',
      `X-IG-App-ID: ${IG_APP_ID}`,
      '-H',
      'Accept: application/json',
      '--max-time',
      '20',
      url,
    ],
    { maxBuffer: 5 * 1024 * 1024 },
  )

  const trimmed = stdout.trimEnd()
  const splitAt = trimmed.lastIndexOf('\n')
  if (splitAt === -1) {
    throw new Error('Resposta inválida do curl')
  }

  const body = trimmed.slice(0, splitAt)
  const status = Number(trimmed.slice(splitAt + 1))
  return { status, body }
}

async function fetchPublicProfilePayload(username: string): Promise<PublicProfilePayload> {
  const endpoints = [
    `https://i.instagram.com/api/v1/users/web_profile_info/?username=${encodeURIComponent(username)}`,
    `https://www.instagram.com/api/v1/users/web_profile_info/?username=${encodeURIComponent(username)}`,
  ]

  let lastError: Error | null = null

  for (const endpoint of endpoints) {
    try {
      // Instagram costuma bloquear o fetch/TLS do Node; curl tem fingerprint de browser.
      const { status, body } = await fetchJsonWithCurl(endpoint)
      if (status < 200 || status >= 300) {
        throw new Error(`Instagram public API ${status}: ${body.slice(0, 200)}`)
      }
      return JSON.parse(body) as PublicProfilePayload
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error))
    }
  }

  throw lastError || new Error('Instagram public API unavailable')
}

async function fetchPublicWebFeed(limit: number): Promise<InstagramFeedResponse> {
  const username = getInstagramUsername()
  const payload = await fetchPublicProfilePayload(username)
  const edges = payload.data?.user?.edge_owner_to_timeline_media?.edges || []
  const posts = normalizePosts(
    edges
      .map((edge) => {
        const node = edge.node
        if (!node?.shortcode) return null
        const mediaUrl = node.display_url || node.thumbnail_src
        if (!mediaUrl) return null
        const caption = node.edge_media_to_caption?.edges?.[0]?.node?.text || ''
        return {
          id: node.id || node.shortcode,
          permalink: `https://www.instagram.com/p/${node.shortcode}/`,
          mediaUrl,
          caption,
        }
      })
      .filter((item): item is NonNullable<typeof item> => Boolean(item))
      .slice(0, limit),
  )

  if (!posts.length) {
    throw new Error('Instagram public API returned no posts')
  }

  return {
    source: 'public',
    username,
    posts,
  }
}

function fallbackFeed(): InstagramFeedResponse {
  return {
    source: 'fallback',
    username: getInstagramUsername(),
    posts: staticFallbackPosts.slice(0, DEFAULT_LIMIT),
  }
}

export async function getInstagramFeed(options?: {
  limit?: number
  bypassCache?: boolean
}): Promise<InstagramFeedResponse> {
  const limit = Math.min(Math.max(options?.limit ?? DEFAULT_LIMIT, 1), 12)
  const now = Date.now()

  if (!options?.bypassCache && cache && cache.expiresAt > now) {
    return cache.payload
  }

  let payload: InstagramFeedResponse | null = null
  let lastError: unknown

  try {
    payload = await fetchGraphApiFeed(limit)
  } catch (error) {
    lastError = error
    console.warn('[instagram] Graph API unavailable', error)
  }

  if (!payload) {
    try {
      payload = await fetchPublicWebFeed(limit)
    } catch (error) {
      lastError = error
      console.warn('[instagram] public feed unavailable', error)
    }
  }

  if (!payload) {
    if (lastError) {
      console.warn('[instagram] using static fallback after live failure')
    }
    payload = fallbackFeed()
    cache = {
      expiresAt: now + ERROR_CACHE_TTL_MS,
      payload,
    }
    return payload
  }

  cache = {
    expiresAt: now + CACHE_TTL_MS,
    payload,
  }

  return payload
}

export async function proxyInstagramImage(imageUrl: string): Promise<{
  body: ArrayBuffer
  contentType: string
}> {
  if (!isAllowedInstagramMediaUrl(imageUrl)) {
    throw new Error('URL de mídia do Instagram inválida')
  }

  try {
    const response = await fetch(imageUrl, {
      headers: {
        'User-Agent':
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
        Accept: 'image/avif,image/webp,image/apng,image/*,*/*;q=0.8',
      },
    })

    if (response.ok) {
      const contentType = response.headers.get('content-type') || 'image/jpeg'
      const body = await response.arrayBuffer()
      return { body, contentType }
    }
  } catch {
    // fallback abaixo via curl
  }

  const { stdout } = await execFileAsync(
    'curl',
    [
      '-sL',
      '-A',
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
      '-H',
      'Accept: image/avif,image/webp,image/apng,image/*,*/*;q=0.8',
      '--max-time',
      '25',
      imageUrl,
    ],
    { encoding: 'buffer', maxBuffer: 8 * 1024 * 1024 },
  )

  if (!stdout.length) {
    throw new Error('Falha ao buscar imagem do Instagram')
  }

  return {
    body: stdout.buffer.slice(stdout.byteOffset, stdout.byteOffset + stdout.byteLength),
    contentType: 'image/jpeg',
  }
}
