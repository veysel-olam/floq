import type { FastifyInstance } from 'fastify'
import { eq } from 'drizzle-orm'
import { z } from 'zod'
import sharp from 'sharp'
import { db } from '../../db/client.js'
import { mediaAttachments } from '../../db/schema.js'
import { requireMastodonUser } from '../../lib/mastodonAuth.js'
import { uploadToS3 } from '../../lib/s3.js'
import { toMastodonMedia } from './serializers.js'
import { randomUUID } from 'node:crypto'

export async function mastodonMediaRoutes(app: FastifyInstance) {
  // POST /api/v1/media — upload a media attachment
  app.post('/api/v1/media', { config: { rateLimit: { max: 30, timeWindow: '1 minute' } } }, async (req, reply) => {
    const ctx = await requireMastodonUser(req, reply)
    if (!ctx) return

    const data = await req.file()
    if (!data) return reply.code(422).send({ error: 'No file provided' })

    const mimeType = data.mimetype
    const allowed = ['image/jpeg', 'image/png', 'image/gif', 'image/webp', 'video/mp4', 'video/webm', 'audio/mpeg', 'audio/ogg']
    if (!allowed.includes(mimeType)) return reply.code(422).send({ error: 'Unsupported media type' })

    const buf = await data.toBuffer()
    const id = randomUUID()
    let width: number | undefined, height: number | undefined, blurhash: string | undefined, previewUrl: string | undefined

    if (mimeType.startsWith('image/')) {
      const meta = await sharp(buf).metadata()
      width = meta.width
      height = meta.height

      // Thumbnail
      const thumbBuf = await sharp(buf).resize(400, 400, { fit: 'inside' }).jpeg({ quality: 80 }).toBuffer()
      previewUrl = await uploadToS3({ key: `media/thumbs/${id}.jpg`, body: thumbBuf, contentType: 'image/jpeg' })
    }

    const key = `media/${id}/${data.filename || 'file'}`
    const url = await uploadToS3({ key, body: buf, contentType: mimeType })

    const description = (req.body as Record<string, unknown>)?.description as string | undefined

    const [media] = await db.insert(mediaAttachments).values({
      id,
      actorId: ctx.actor.id,
      url,
      previewUrl: previewUrl ?? null,
      mimeType,
      altText: description ?? null,
      width: width ?? null,
      height: height ?? null,
      blurhash: blurhash ?? null,
    }).returning()

    return reply.code(200).send(toMastodonMedia(media!))
  })

  // POST /api/v2/media (async upload — same as v1 for simplicity)
  app.post('/api/v2/media', { config: { rateLimit: { max: 30, timeWindow: '1 minute' } } }, async (req, reply) => {
    return reply.redirect('/api/v1/media')
  })

  // GET /api/v1/media/:id
  app.get<{ Params: { id: string } }>('/api/v1/media/:id', async (req, reply) => {
    const ctx = await requireMastodonUser(req, reply)
    if (!ctx) return
    const media = await db.query.mediaAttachments.findFirst({ where: eq(mediaAttachments.id, req.params.id) })
    if (!media) return reply.code(404).send({ error: 'Record not found' })
    return reply.send(toMastodonMedia(media))
  })

  // PUT /api/v1/media/:id — update alt text
  app.put<{ Params: { id: string } }>('/api/v1/media/:id', async (req, reply) => {
    const ctx = await requireMastodonUser(req, reply)
    if (!ctx) return
    const body = z.object({ description: z.string().max(1500).optional() }).safeParse(req.body)
    if (!body.success) return reply.code(422).send({ error: 'Validation failed' })
    const [updated] = await db.update(mediaAttachments)
      .set({ altText: body.data.description ?? null })
      .where(eq(mediaAttachments.id, req.params.id))
      .returning()
    if (!updated) return reply.code(404).send({ error: 'Record not found' })
    return reply.send(toMastodonMedia(updated))
  })
}
