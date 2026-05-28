import type { FastifyInstance } from 'fastify'
import { db } from '../db/client.js'
import { mediaAttachments } from '../db/schema.js'
import { requireActor } from '../lib/session.js'
import { env } from '../lib/env.js'

// Klipy API — free Tenor replacement (same response structure)
// Docs: https://klipy.com/docs  |  Sign up: https://klipy.com
const klipyBase = () => `https://api.klipy.com/api/v1/${env.KLIPY_API_KEY}`

interface KlipyFile {
  url: string
  width: number
  height: number
  size?: number
}

interface KlipyResult {
  id: number
  title: string
  file: {
    hd?: { gif?: KlipyFile; webp?: KlipyFile }
    md?: { gif?: KlipyFile; webp?: KlipyFile }
    sd?: { gif?: KlipyFile; webp?: KlipyFile }
  }
}

function mapResult(r: KlipyResult) {
  const full = r.file.md?.gif ?? r.file.hd?.gif ?? r.file.sd?.gif
  const preview = r.file.hd?.gif ?? full
  return {
    id: String(r.id),
    title: r.title,
    url: full?.url ?? '',
    previewUrl: preview?.url ?? full?.url ?? '',
    width: preview?.width ?? full?.width ?? 0,
    height: preview?.height ?? full?.height ?? 0,
  }
}

export async function gifsRoutes(app: FastifyInstance) {
  // GET /api/gifs/search?q=term&limit=20
  app.get<{ Querystring: { q?: string; limit?: string } }>('/api/gifs/search', {
    config: { rateLimit: { max: 60, timeWindow: '1 minute' } },
  }, async (req, reply) => {
    if (!env.KLIPY_API_KEY) return reply.send({ gifs: [], enabled: false })

    const q = (req.query.q ?? '').trim()
    if (!q) return reply.send({ gifs: [], enabled: true })

    const limit = Math.min(Number(req.query.limit ?? 20), 50)
    const url = `${klipyBase()}/gifs/search?q=${encodeURIComponent(q)}&per_page=${limit}&rating=pg-13`

    try {
      const res = await fetch(url)
      if (!res.ok) return reply.send({ gifs: [], enabled: true })
      const data = (await res.json()) as { data: { data: KlipyResult[] } }
      return reply.send({ gifs: (data.data?.data ?? []).map(mapResult), enabled: true })
    } catch {
      return reply.send({ gifs: [], enabled: true })
    }
  })

  // GET /api/gifs/featured — trending GIFler (başlangıç durumu)
  app.get<{ Querystring: { limit?: string } }>('/api/gifs/featured', {
    config: { rateLimit: { max: 30, timeWindow: '1 minute' } },
  }, async (req, reply) => {
    if (!env.KLIPY_API_KEY) return reply.send({ gifs: [], enabled: false })

    const limit = Math.min(Number(req.query.limit ?? 16), 50)
    const url = `${klipyBase()}/gifs/trending?per_page=${limit}&rating=pg-13`

    try {
      const res = await fetch(url)
      if (!res.ok) return reply.send({ gifs: [], enabled: true })
      const data = (await res.json()) as { data: { data: KlipyResult[] } }
      return reply.send({ gifs: (data.data?.data ?? []).map(mapResult), enabled: true })
    } catch {
      return reply.send({ gifs: [], enabled: true })
    }
  })

  // POST /api/gifs/attach — GIF'i media_attachments tablosuna kaydet
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
