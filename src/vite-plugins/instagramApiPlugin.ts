import type { Plugin } from 'vite'
import {
  getInstagramFeed,
  isAllowedInstagramMediaUrl,
  proxyInstagramImage,
} from '../server/instagramFeed'

export function instagramApiPlugin(): Plugin {
  return {
    name: 'cctvc-instagram-api',
    configureServer(server) {
      server.middlewares.use(async (req, res, next) => {
        try {
          const rawUrl = req.url || '/'
          if (!rawUrl.startsWith('/api/instagram')) {
            next()
            return
          }

          const url = new URL(rawUrl, 'http://localhost')
          if (req.method !== 'GET' && req.method !== 'OPTIONS') {
            res.statusCode = 405
            res.setHeader('Content-Type', 'application/json')
            res.end(JSON.stringify({ error: 'Method not allowed' }))
            return
          }

          if (req.method === 'OPTIONS') {
            res.statusCode = 204
            res.setHeader('Access-Control-Allow-Origin', '*')
            res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS')
            res.end()
            return
          }

          const imageUrl = url.searchParams.get('image')
          if (imageUrl) {
            if (!isAllowedInstagramMediaUrl(imageUrl)) {
              res.statusCode = 400
              res.end('Invalid image URL')
              return
            }
            const { body, contentType } = await proxyInstagramImage(imageUrl)
            res.statusCode = 200
            res.setHeader('Content-Type', contentType)
            res.setHeader('Cache-Control', 'public, max-age=86400')
            res.end(Buffer.from(body))
            return
          }

          const feed = await getInstagramFeed()
          res.statusCode = 200
          res.setHeader('Content-Type', 'application/json; charset=utf-8')
          res.setHeader(
            'Cache-Control',
            feed.source === 'fallback' ? 'public, max-age=60' : 'public, max-age=300',
          )
          res.setHeader('X-Instagram-Source', feed.source)
          res.end(JSON.stringify(feed))
        } catch (error) {
          console.error('[vite instagram api]', error)
          res.statusCode = 500
          res.setHeader('Content-Type', 'application/json; charset=utf-8')
          res.end(
            JSON.stringify({
              error: 'Failed to load Instagram feed',
              message: error instanceof Error ? error.message : 'Unknown error',
            }),
          )
        }
      })
    },
  }
}
