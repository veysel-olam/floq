import type { FastifyInstance } from 'fastify'
import { createHash } from 'node:crypto'

const ALLOWED_CONTENT_TYPES = new Set([
  'image/jpeg', 'image/png', 'image/gif', 'image/webp', 'image/avif',
])

// Simple in-memory LRU for domain-level suspend checks is overkill here —
// just validate the URL and proxy with cache headers.

export async function proxyRoutes(app: FastifyInstance) {
  app.get<{ Querystring: { url?: string } }>('/api/proxy', async (req, reply) => {
    const { url } = req.query

    if (!url) return reply.code(400).send({ error: 'Missing url' })

    let parsed: URL
    try {
      parsed = new URL(url)
    } catch {
      return reply.code(400).send({ error: 'Invalid url' })
    }

    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
      return reply.code(400).send({ error: 'Only http/https allowed' })
    }

    // Prevent SSRF to internal networks
    const hostname = parsed.hostname
    if (
      hostname === 'localhost' ||
      hostname === '127.0.0.1' ||
      hostname === '::1' ||
      /^10\./.test(hostname) ||
      /^192\.168\./.test(hostname) ||
      /^172\.(1[6-9]|2\d|3[01])\./.test(hostname)
    ) {
      return reply.code(400).send({ error: 'Forbidden host' })
    }

    try {
      const upstream = await fetch(url, {
        headers: {
          'User-Agent': 'floq/1.0 (media proxy; +https://floq.com)',
          Accept: 'image/*',
        },
        signal: AbortSignal.timeout(10_000),
        redirect: 'follow',
      })

      if (!upstream.ok) return reply.code(502).send({ error: 'Upstream error' })

      const contentType = upstream.headers.get('content-type')?.split(';')[0]?.trim() ?? ''
      if (!ALLOWED_CONTENT_TYPES.has(contentType)) {
        return reply.code(400).send({ error: 'Not an image' })
      }

      const etag = createHash('sha1').update(url).digest('hex').slice(0, 16)

      reply.header('Content-Type', contentType)
      reply.header('Cache-Control', 'public, max-age=86400, stale-while-revalidate=3600')
      reply.header('ETag', `"${etag}"`)
      reply.header('X-Content-Type-Options', 'nosniff')

      const body = upstream.body
      if (!body) return reply.code(502).send({ error: 'Empty response' })

      return reply.send(upstream.body)
    } catch {
      return reply.code(504).send({ error: 'Proxy timeout' })
    }
  })
}
