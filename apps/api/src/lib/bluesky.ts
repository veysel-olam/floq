import { BskyAgent } from '@atproto/api'
import sharp from 'sharp'
import { db } from '../db/client.js'
import { blueskyConnections } from '../db/schema.js'
import { eq } from 'drizzle-orm'

export interface CrosspostMedia { url: string; alt?: string | null }

// Fetch + downscale an image to Bluesky's ~1MB blob limit, then upload it.
// Returns the blob ref or null (skip on any failure — media is best-effort).
async function uploadImageToBluesky(agent: BskyAgent, url: string): Promise<unknown | null> {
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(10_000) })
    if (!res.ok) return null
    const input = Buffer.from(await res.arrayBuffer())
    let out = await sharp(input).resize(1200, 1200, { fit: 'inside', withoutEnlargement: true }).jpeg({ quality: 80 }).toBuffer()
    if (out.length > 976_000) {
      out = await sharp(input).resize(1000, 1000, { fit: 'inside', withoutEnlargement: true }).jpeg({ quality: 55 }).toBuffer()
    }
    if (out.length > 976_000) return null
    const up = await agent.uploadBlob(out, { encoding: 'image/jpeg' })
    return up.data.blob
  } catch {
    return null
  }
}

export async function getBskyAgent(userId: string): Promise<BskyAgent | null> {
  const conn = await db.query.blueskyConnections.findFirst({
    where: eq(blueskyConnections.userId, userId),
  })
  if (!conn) return null

  const agent = new BskyAgent({ service: 'https://bsky.social' })

  try {
    await agent.resumeSession({
      did: conn.did,
      handle: conn.handle,
      accessJwt: conn.accessJwt,
      refreshJwt: conn.refreshJwt,
      active: true,
    })
    if (agent.session && agent.session.accessJwt !== conn.accessJwt) {
      await db.update(blueskyConnections)
        .set({
          accessJwt: agent.session.accessJwt,
          refreshJwt: agent.session.refreshJwt,
          updatedAt: new Date(),
        })
        .where(eq(blueskyConnections.userId, userId))
    }
  } catch {
    return null
  }

  return agent
}

// Post a floq post to Bluesky as an app.bsky.feed.post record
export async function crosspostToBluesky(
  userId: string,
  text: string,
  tags: string[],
  media: CrosspostMedia[] = [],
): Promise<void> {
  const conn = await db.query.blueskyConnections.findFirst({
    where: eq(blueskyConnections.userId, userId),
  })
  if (!conn?.crosspostEnabled) return

  const agent = await getBskyAgent(userId)
  if (!agent) return

  // Strip HTML tags from content for Bluesky plain text
  const plainText = text.replace(/<[^>]+>/g, '').slice(0, 300)

  // Build facets for hashtags
  const facets: Array<{
    index: { byteStart: number; byteEnd: number }
    features: Array<{ $type: string; tag: string }>
  }> = []

  let searchFrom = 0
  for (const tag of tags.filter((t) => t.startsWith('#'))) {
    const idx = plainText.indexOf(tag, searchFrom)
    if (idx === -1) continue
    const encoder = new TextEncoder()
    const byteStart = encoder.encode(plainText.slice(0, idx)).length
    const byteEnd = byteStart + encoder.encode(tag).length
    facets.push({
      index: { byteStart, byteEnd },
      features: [{ $type: 'app.bsky.richtext.facet#tag', tag: tag.slice(1) }],
    })
    searchFrom = idx + tag.length
  }

  // Images embed (max 4, each downscaled to the blob limit).
  let embed: Record<string, unknown> | undefined
  const imgs = media.slice(0, 4)
  if (imgs.length) {
    const images: Array<{ image: unknown; alt: string }> = []
    for (const m of imgs) {
      const blob = await uploadImageToBluesky(agent, m.url)
      if (blob) images.push({ image: blob, alt: m.alt ?? '' })
    }
    if (images.length) embed = { $type: 'app.bsky.embed.images', images }
  }

  const record: Parameters<typeof agent.post>[0] = {
    text: plainText,
    createdAt: new Date().toISOString(),
    langs: ['tr'],
  }
  if (facets.length) record.facets = facets as NonNullable<Parameters<typeof agent.post>[0]['facets']>
  if (embed) record.embed = embed as NonNullable<Parameters<typeof agent.post>[0]['embed']>
  await agent.post(record)
}
