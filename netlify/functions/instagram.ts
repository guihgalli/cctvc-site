import type { Config, Context } from '@netlify/functions'
import {
  getInstagramFeed,
  isAllowedInstagramMediaUrl,
  proxyInstagramImage,
} from '../../src/server/instagramFeed'

const jsonHeaders = {
  'Content-Type': 'application/json; charset=utf-8',
  'Access-Control-Allow-Origin': '*',
}

export default async function handler(request: Request, _context: Context) {
  const url = new URL(request.url)

  if (request.method === 'OPTIONS') {
    return new Response(null, {
      status: 204,
      headers: {
        ...jsonHeaders,
        'Access-Control-Allow-Methods': 'GET, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type',
      },
    })
  }

  if (request.method !== 'GET') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405,
      headers: jsonHeaders,
    })
  }

  const imageUrl = url.searchParams.get('image')
  if (imageUrl) {
    try {
      if (!isAllowedInstagramMediaUrl(imageUrl)) {
        return new Response('Invalid image URL', { status: 400 })
      }
      const { body, contentType } = await proxyInstagramImage(imageUrl)
      return new Response(body, {
        status: 200,
        headers: {
          'Content-Type': contentType,
          'Cache-Control': 'public, max-age=86400, stale-while-revalidate=604800',
          'Access-Control-Allow-Origin': '*',
        },
      })
    } catch (error) {
      console.error('[instagram] image proxy failed', error)
      return new Response('Failed to proxy image', { status: 502 })
    }
  }

  const feed = await getInstagramFeed()
  const maxAge = feed.source === 'fallback' ? 120 : 900
  return new Response(JSON.stringify(feed), {
    status: 200,
    headers: {
      ...jsonHeaders,
      'Cache-Control': `public, s-maxage=${maxAge}, stale-while-revalidate=3600`,
      'X-Instagram-Source': feed.source,
    },
  })
}

export const config: Config = {
  path: '/api/instagram',
}
