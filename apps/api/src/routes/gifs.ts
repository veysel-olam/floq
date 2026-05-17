import type { FastifyInstance } from 'fastify'
import { eq } from 'drizzle-orm'
import { db } from '../db/client.js'
import { mediaAttachments } from '../db/schema.js'
import { requireActor } from '../lib/session.js'
import { env } from '../lib/env.js'

const TENOR_BASE = 'https://tenor.googleapis.com/v2'

interface TenorResult {
  id: string
  title: string
  media_formats: {
    gif?: { url: string; dims: number[]; size: number }
    tinygif?: { url: string; dims: number[]; size: number }
    nanogif?: { url: string; dims: number[] }
  }
}

function mapResult(r: TenorResult) {
  const gif = r.media_formats.gif
  const preview = r.media_formats.tinygif ?? r.media_formats.nanogif
  return {
    id: r.id,
    title: r.title,
    url: gif?.url ?? '',
    previewUrl: preview?.url ?? gif?.url ?? '',
    width: gif?.dims[0] ?? 0,
    height: gif?.dims[1] ?? 0,
  }
}

export async function gifsRoutes(app: FastifyInstance) {
  // GET /api/gifs/search?q=term&limit=20
  app.get<{ Querystring: { q?: string; limit?: string } }>('/api/gifs/search', {
    config: { rateLimit: { max: 60, timeWindow: '1 minute' } },
  }, async (req, reply) => {
    if (!env.TENOR_API_KEY) return reply.send({ gifs: [], enabled: false })

    const q = (req.query.q ?? '').trim()
    if (!q) return reply.send({ gifs: [], enabled: true })

    const limit = Math.min(Number(req.query.limit ?? 20), 50)
    const url = `${TENOR_BASE}/search?q=${encodeURIComponent(q)}&key=${env.TENOR_API_KEY}&limit=${limit}&media_filter=gif,tinygif,nanogif&contentfilter=medium`

    try {
      const res = await fetch(url)
      if (!res.ok) return reply.send({ gifs: [], enabled: true })
      const data = (await res.json()) as { results: TenorResult[] }
      return reply.send({ gifs: data.results.map(mapResult), enabled: true })
    } catch {
      return reply.send({ gifs: [], enabled: true })
    }
  })

  // GET /api/gifs/featured — öne çıkan GIFler (başlangıç durumu)
  app.get<{ Querystring: { limit?: string } }>('/api/gifs/featured', {
    config: { rateLimit: { max: 30, timeWindow: '1 minute' } },
  }, async (req, reply) => {
    if (!env.TENOR_API_KEY) return reply.send({ gifs: [], enabled: false })

    const limit = Math.min(Number(req.query.limit ?? 16), 50)
    const url = `${TENOR_BASE}/featured?key=${env.TENOR_API_KEY}&limit=${limit}&media_filter=gif,tinygif,nanogif&contentfilter=medium`

    try {
      const res = await fetch(url)
      if (!res.ok) return reply.send({ gifs: [], enabled: true })
      const data = (await res.json()) as { results: TenorResult[] }
      return reply.send({ gifs: data.results.map(mapResult), enabled: true })
    } catch {
      return reply.send({ gifs: [], enabled: true })
    }
  })

  // POST /api/gifs/attach — Tenor GIF'i media_attachments tablosuna kaydet
  app.post<{ Body: { url: string; previewUrl?: string; width?: number; height?: number; title?: string } }>(
    '/api/gifs/attach',
    async (req, reply) => {
      const ctx = await requireActor(req, reply)
      if (!ctx) return

      const { url, previewUrl, width, height } = req.body
      if (!url) return reply.code(400).send({ error: 'url required' })

      const [attachment] = await db
        .insert(mediaAttachments)
        .values({
          actorId: ctx.actor.id,
          url,
          previewUrl: previewUrl ?? url,
          mimeType: 'image/gif',
          width: width ?? null,
          height: height ?? null,
        })
        .returning()

      return reply.code(201).send(attachment)
    },
  )
}
