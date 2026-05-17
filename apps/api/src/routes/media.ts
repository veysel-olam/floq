import type { FastifyInstance } from 'fastify'
import { eq } from 'drizzle-orm'
import { randomUUID } from 'node:crypto'
import sharp from 'sharp'
import { encode as blurhashEncode } from 'blurhash'
import { db } from '../db/client.js'
import { mediaAttachments } from '../db/schema.js'
import { requireActor } from '../lib/session.js'
import { uploadToS3 } from '../lib/s3.js'

const MAX_FILE_SIZE = 8 * 1024 * 1024 // 8 MB
const MAX_AUDIO_SIZE = 10 * 1024 * 1024 // 10 MB for voice messages
const ALLOWED_MIME = new Set(['image/jpeg', 'image/png', 'image/gif', 'image/webp'])
const ALLOWED_AUDIO_MIME = new Set(['audio/webm', 'audio/ogg', 'audio/mp4', 'audio/mpeg', 'audio/wav'])
const MAX_DIMENSION = 2048

async function computeBlurhash(pixelData: Buffer, width: number, height: number): Promise<string> {
  const clamped = new Uint8ClampedArray(pixelData)
  return blurhashEncode(clamped, width, height, 4, 3)
}

export async function mediaRoutes(app: FastifyInstance) {
  app.post('/api/media', {
    config: { rateLimit: { max: 20, timeWindow: '15 minutes' } },
  }, async (req, reply) => {
    const ctx = await requireActor(req, reply)
    if (!ctx) return

    const isAudioUpload = req.headers['x-media-type'] === 'audio'
    const sizeLimit = isAudioUpload ? MAX_AUDIO_SIZE : MAX_FILE_SIZE
    const data = await req.file({ limits: { fileSize: sizeLimit } })
    if (!data) return reply.code(400).send({ error: 'No file' })

    const mimeType = data.mimetype
    const isAudio = ALLOWED_AUDIO_MIME.has(mimeType)

    if (!ALLOWED_MIME.has(mimeType) && !isAudio) {
      return reply.code(400).send({ error: 'Unsupported file type' })
    }

    const buffer = await data.toBuffer()

    // Audio: skip image processing, upload directly
    if (isAudio) {
      const ext = mimeType === 'audio/webm' ? 'webm'
        : mimeType === 'audio/ogg' ? 'ogg'
        : mimeType === 'audio/mpeg' ? 'mp3'
        : mimeType === 'audio/wav' ? 'wav'
        : 'mp4'
      const key = `media/${ctx.actor.id}/voice-${randomUUID()}.${ext}`
      const url = await uploadToS3({ key, body: buffer, contentType: mimeType })

      const [attachment] = await db
        .insert(mediaAttachments)
        .values({
          actorId: ctx.actor.id,
          url,
          mimeType,
          fileSize: buffer.length,
        })
        .returning()

      return reply.code(201).send(attachment)
    }

    // Get metadata from a dedicated instance, then process with a fresh one
    const metadata = await sharp(buffer).rotate().metadata()
    const origW = metadata.width ?? 800
    const origH = metadata.height ?? 600

    const needsResize = origW > MAX_DIMENSION || origH > MAX_DIMENSION
    const processed = needsResize
      ? await sharp(buffer)
          .rotate()
          .resize(MAX_DIMENSION, MAX_DIMENSION, { fit: 'inside', withoutEnlargement: true })
          .jpeg({ quality: 85, progressive: true })
          .toBuffer({ resolveWithObject: true })
      : await sharp(buffer)
          .rotate()
          .jpeg({ quality: 85, progressive: true })
          .toBuffer({ resolveWithObject: true })

    const finalW = processed.info.width
    const finalH = processed.info.height

    // Blurhash from a tiny version
    const thumbData = await sharp(processed.data)
      .resize(32, 32, { fit: 'inside' })
      .raw()
      .ensureAlpha()
      .toBuffer({ resolveWithObject: true })

    const blurhash = await computeBlurhash(thumbData.data, thumbData.info.width, thumbData.info.height)

    // Upload main image
    const key = `media/${ctx.actor.id}/${randomUUID()}.jpg`
    const url = await uploadToS3({ key, body: processed.data, contentType: 'image/jpeg' })

    const [attachment] = await db
      .insert(mediaAttachments)
      .values({
        actorId: ctx.actor.id,
        url,
        mimeType: 'image/jpeg',
        width: finalW,
        height: finalH,
        blurhash,
        fileSize: processed.data.length,
      })
      .returning()

    return reply.code(201).send(attachment)
  })

  // PATCH /api/media/:id — update alt text
  app.patch<{ Params: { id: string } }>('/api/media/:id', async (req, reply) => {
    const ctx = await requireActor(req, reply)
    if (!ctx) return

    const { altText } = req.body as { altText?: string }

    const [updated] = await db
      .update(mediaAttachments)
      .set({ altText: altText ?? null })
      .where(eq(mediaAttachments.id, req.params.id))
      .returning()

    if (!updated) return reply.code(404).send({ error: 'Not found' })
    return reply.send(updated)
  })
}
