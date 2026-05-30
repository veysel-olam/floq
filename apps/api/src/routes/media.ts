import type { FastifyInstance } from 'fastify'
import { eq } from 'drizzle-orm'
import { randomUUID } from 'node:crypto'
import { writeFileSync, readFileSync, unlinkSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import sharp from 'sharp'
import { encode as blurhashEncode } from 'blurhash'
import ffmpegFn from 'fluent-ffmpeg'
import ffmpegPath from 'ffmpeg-static'
import ffprobeStatic from 'ffprobe-static'
import { db } from '../db/client.js'
import { mediaAttachments } from '../db/schema.js'
import { requireActor } from '../lib/session.js'
import { uploadToS3 } from '../lib/s3.js'

// Prefer system ffmpeg/ffprobe (FFMPEG_PATH / FFPROBE_PATH — e.g. apk-installed in the
// prod image) over the *-static binaries, whose postinstall download is skipped by pnpm
// in the production build. Falls back to the static binaries for local dev.
const ffmpegBin = process.env.FFMPEG_PATH || (ffmpegPath as unknown as string | null)
const ffprobeBin = process.env.FFPROBE_PATH || ffprobeStatic?.path
if (ffmpegBin) ffmpegFn.setFfmpegPath(ffmpegBin)
if (ffprobeBin) ffmpegFn.setFfprobePath(ffprobeBin)

const MAX_FILE_SIZE = 8 * 1024 * 1024    // 8 MB — images
const MAX_AUDIO_SIZE = 10 * 1024 * 1024  // 10 MB — audio
const MAX_VIDEO_SIZE = 100 * 1024 * 1024 // 100 MB — video
const MAX_DIMENSION = 2048

const ALLOWED_MIME = new Set(['image/jpeg', 'image/png', 'image/gif', 'image/webp'])
const ALLOWED_AUDIO_MIME = new Set(['audio/webm', 'audio/ogg', 'audio/mp4', 'audio/mpeg', 'audio/wav'])
const ALLOWED_VIDEO_MIME = new Set([
  'video/mp4', 'video/webm', 'video/quicktime',
  'video/avi', 'video/x-msvideo', 'video/x-matroska', 'video/mkv',
])

async function computeBlurhash(pixelData: Buffer, width: number, height: number): Promise<string> {
  const clamped = new Uint8ClampedArray(pixelData)
  return blurhashEncode(clamped, width, height, 4, 3)
}

interface VideoMeta { width: number | undefined; height: number | undefined; duration: number | undefined }

async function getVideoMeta(inputPath: string): Promise<VideoMeta> {
  return new Promise((resolve, reject) => {
    ffmpegFn.ffprobe(inputPath, (err, data) => {
      if (err) { reject(err); return }
      const vs = data.streams.find((s) => s.codec_type === 'video')
      resolve({
        width: vs?.width,
        height: vs?.height,
        duration: data.format.duration ? Math.round(data.format.duration) : undefined,
      })
    })
  })
}

async function transcodeVideo(inputPath: string, outputPath: string, meta: VideoMeta): Promise<void> {
  const needsScale = (meta.height ?? 0) > 720
  return new Promise((resolve, reject) => {
    const cmd = ffmpegFn(inputPath)
      .videoCodec('libx264')
      .audioCodec('aac')
      .audioBitrate('128k')
      .outputOptions(['-preset', 'fast', '-crf', '23', '-movflags', '+faststart'])
    if (needsScale) cmd.size('?x720')
    cmd.on('end', () => resolve())
      .on('error', (err: Error) => reject(err))
      .save(outputPath)
  })
}

async function extractThumbnail(inputPath: string, thumbPath: string): Promise<void> {
  return new Promise((resolve) => {
    ffmpegFn(inputPath)
      .outputOptions(['-ss', '0.5', '-vframes', '1', '-q:v', '2'])
      .on('end', () => resolve())
      .on('error', () => resolve()) // thumbnail is optional
      .save(thumbPath)
  })
}

export async function mediaRoutes(app: FastifyInstance) {
  app.post('/api/media', {
    config: { rateLimit: { max: 20, timeWindow: '15 minutes' } },
  }, async (req, reply) => {
    const ctx = await requireActor(req, reply)
    if (!ctx) return

    const mediaType = req.headers['x-media-type']
    const isAudio = mediaType === 'audio'
    const isVideo = mediaType === 'video'

    const sizeLimit = isAudio ? MAX_AUDIO_SIZE : isVideo ? MAX_VIDEO_SIZE : MAX_FILE_SIZE
    const data = await req.file({ limits: { fileSize: sizeLimit } })
    if (!data) return reply.code(400).send({ error: 'No file' })

    const mimeType = data.mimetype

    // ── Video ──────────────────────────────────────────────────────────────
    if (isVideo) {
      if (!ALLOWED_VIDEO_MIME.has(mimeType)) {
        return reply.code(400).send({ error: 'Desteklenmeyen video formatı' })
      }

      const buffer = await data.toBuffer()
      if (buffer.length > MAX_VIDEO_SIZE) {
        return reply.code(400).send({ error: 'Video çok büyük (max 100 MB)' })
      }

      const id = randomUUID()
      const inputPath = join(tmpdir(), `floq-vid-in-${id}`)
      const outputPath = join(tmpdir(), `floq-vid-out-${id}.mp4`)
      const thumbPath = join(tmpdir(), `floq-vid-thumb-${id}.jpg`)

      writeFileSync(inputPath, buffer)

      try {
        const meta = await getVideoMeta(inputPath)
        await transcodeVideo(inputPath, outputPath, meta)
        await extractThumbnail(inputPath, thumbPath)

        const videoBuffer = readFileSync(outputPath)
        const videoKey = `media/${ctx.actor.id}/video-${id}.mp4`
        const videoUrl = await uploadToS3({ key: videoKey, body: videoBuffer, contentType: 'video/mp4' })

        let thumbnailUrl: string | null = null
        try {
          const thumbBuffer = readFileSync(thumbPath)
          const thumbKey = `media/${ctx.actor.id}/thumb-${id}.jpg`
          thumbnailUrl = await uploadToS3({ key: thumbKey, body: thumbBuffer, contentType: 'image/jpeg' })
        } catch { /* thumbnail optional */ }

        const finalH = Math.min(meta.height ?? 720, 720)
        const finalW = meta.width && meta.height ? Math.floor(meta.width * finalH / meta.height / 2) * 2 : null

        const [attachment] = await db
          .insert(mediaAttachments)
          .values({
            actorId: ctx.actor.id,
            url: videoUrl,
            previewUrl: thumbnailUrl,
            mimeType: 'video/mp4',
            width: finalW,
            height: finalH,
            duration: meta.duration ?? null,
            fileSize: videoBuffer.length,
          })
          .returning()

        return reply.code(201).send(attachment)
      } finally {
        for (const p of [inputPath, outputPath, thumbPath]) {
          try { unlinkSync(p) } catch { /* ignore */ }
        }
      }
    }

    // ── Audio ──────────────────────────────────────────────────────────────
    if (isAudio || ALLOWED_AUDIO_MIME.has(mimeType)) {
      if (!ALLOWED_AUDIO_MIME.has(mimeType)) {
        return reply.code(400).send({ error: 'Unsupported file type' })
      }
      const buffer = await data.toBuffer()
      const ext = mimeType === 'audio/webm' ? 'webm'
        : mimeType === 'audio/ogg' ? 'ogg'
        : mimeType === 'audio/mpeg' ? 'mp3'
        : mimeType === 'audio/wav' ? 'wav'
        : 'mp4'
      const key = `media/${ctx.actor.id}/voice-${randomUUID()}.${ext}`
      const url = await uploadToS3({ key, body: buffer, contentType: mimeType })
      const [attachment] = await db
        .insert(mediaAttachments)
        .values({ actorId: ctx.actor.id, url, mimeType, fileSize: buffer.length })
        .returning()
      return reply.code(201).send(attachment)
    }

    // ── Image ──────────────────────────────────────────────────────────────
    if (!ALLOWED_MIME.has(mimeType)) {
      return reply.code(400).send({ error: 'Unsupported file type' })
    }

    const buffer = await data.toBuffer()
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

    const thumbData = await sharp(processed.data)
      .resize(32, 32, { fit: 'inside' })
      .raw()
      .ensureAlpha()
      .toBuffer({ resolveWithObject: true })
    const blurhash = await computeBlurhash(thumbData.data, thumbData.info.width, thumbData.info.height)

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
