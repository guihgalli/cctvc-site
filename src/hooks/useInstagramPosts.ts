import { useEffect, useState } from 'react'
import {
  INSTAGRAM_PROFILE_URL,
  instagramPosts as fallbackPosts,
  type InstagramPost,
} from '../data/instagramPosts'

interface InstagramFeedResponse {
  source: 'graph' | 'public' | 'fallback'
  username: string
  posts: InstagramPost[]
}

export function useInstagramPosts() {
  const [posts, setPosts] = useState<InstagramPost[]>(fallbackPosts)
  const [source, setSource] = useState<InstagramFeedResponse['source']>('fallback')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false

    async function load() {
      try {
        const response = await fetch('/api/instagram', {
          headers: { Accept: 'application/json' },
        })
        if (!response.ok) {
          throw new Error(`HTTP ${response.status}`)
        }
        const data = (await response.json()) as InstagramFeedResponse
        if (cancelled) return
        if (Array.isArray(data.posts) && data.posts.length > 0) {
          setPosts(data.posts)
          setSource(data.source)
          return
        }
        setPosts(fallbackPosts)
        setSource('fallback')
      } catch {
        if (!cancelled) {
          setPosts(fallbackPosts)
          setSource('fallback')
        }
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    void load()
    return () => {
      cancelled = true
    }
  }, [])

  return {
    posts,
    source,
    loading,
    profileUrl: INSTAGRAM_PROFILE_URL,
  }
}
