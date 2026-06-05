import { BskyAgent } from '@atproto/api'
import sharp from 'sharp'
import { db } from '../db/client.js'
import { blueskyConnections, posts, actors, mediaAttachments } from '../db/schema.js'
import { eq, sql } from 'drizzle-orm'
import { env } from './env.js'
import { buildNote, buildCreate } from './activityPub.js'
import { deliverToFollowers } from './federation.js'
import { extractFirstUrl, fetchLinkPreview } from './linkPreview.js'

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

// Record bridge health so the Köprüler tab can show "last synced / error".
// Pass null to mark a successful sync; a string to record an error.
async function setBridgeStatus(userId: string, error: string | null): Promise<void> {
  await db.update(blueskyConnections)
    .set(error ? { lastError: error.slice(0, 500) } : { lastSyncAt: new Date(), lastError: null })
    .where(eq(blueskyConnections.userId, userId))
    .catch(() => {})
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
    // Session couldn't be resumed — almost always a revoked/expired app password.
    await setBridgeStatus(userId, 'reauth_needed')
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
  postId?: string,
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

  try {
    const res = await agent.post(record)
    // Record the resulting at:// uri on the floq post so the inbound importer
    // recognises this as our own output and never re-mirrors it (loop guard).
    if (postId && res?.uri) {
      await db.update(posts).set({ bskyUri: res.uri }).where(eq(posts.id, postId)).catch(() => {})
    }
    await setBridgeStatus(userId, null)
  } catch (e) {
    await setBridgeStatus(userId, (e as Error).message ?? 'crosspost failed')
    throw e // let the job retry
  }
}

// ─── Inbound: mirror a user's own Bluesky posts into floq ───────────────────────

// Pull image attachments out of a Bluesky post's embed view (hotlinked — we
// store the Bluesky CDN url, matching how floq handles other remote media).
type BskyImage = { url: string; alt: string; width: number | null; height: number | null }
function extractBskyImages(embed: unknown): BskyImage[] {
  const e = embed as { '$type'?: string; images?: unknown[]; media?: { '$type'?: string; images?: unknown[] } } | null
  if (!e) return []
  let imgs: unknown[] | undefined
  if (e['$type'] === 'app.bsky.embed.images#view') imgs = e.images
  else if (e['$type'] === 'app.bsky.embed.recordWithMedia#view' && e.media?.['$type'] === 'app.bsky.embed.images#view') imgs = e.media.images
  if (!imgs) return []
  return imgs
    .map((im) => {
      const o = im as { fullsize?: string; alt?: string; aspectRatio?: { width?: number; height?: number } }
      return {
        url: o.fullsize ?? '',
        alt: o.alt ?? '',
        width: o.aspectRatio?.width ?? null,
        height: o.aspectRatio?.height ?? null,
      }
    })
    .filter((x) => x.url.startsWith('http'))
    .slice(0, 4)
}

// Pull the connected user's recent Bluesky posts and mirror new ones into floq as
// their own local posts. Direct DB insert (not the post route) means no crosspost
// is triggered, so there's no echo loop; dedupe + the bskyUri loop-guard ensure a
// post is never mirrored twice or bounced back to Bluesky.
//
// Media (images) is hotlinked. Posts created AFTER import was enabled also
// federate out to the user's fediverse followers; the initial backfill of older
// posts is mirrored to floq only, so enabling import never floods followers.
export async function importBlueskyPosts(userId: string): Promise<number> {
  const conn = await db.query.blueskyConnections.findFirst({
    where: eq(blueskyConnections.userId, userId),
  })
  if (!conn?.importEnabled) return 0

  const agent = await getBskyAgent(userId)
  if (!agent) return 0

  const actor = await db.query.actors.findFirst({ where: eq(actors.userId, userId) })
  if (!actor) return 0

  let feed: Awaited<ReturnType<typeof agent.getAuthorFeed>>['data']['feed']
  try {
    const res = await agent.getAuthorFeed({ actor: conn.did, limit: 20, filter: 'posts_no_replies' })
    feed = res.data.feed
  } catch (e) {
    await setBridgeStatus(userId, (e as Error).message ?? 'import failed')
    return 0
  }

  let imported = 0
  // Oldest-first so chronology is preserved as we insert
  for (const item of [...feed].reverse()) {
    if (item.reason) continue // skip reposts/reblogs
    const post = item.post
    const uri = post.uri
    const record = post.record as { text?: string; createdAt?: string; reply?: unknown }
    if (record.reply) continue // top-level posts only (v1)
    const text = (record.text ?? '').trim()
    if (!text) continue

    // Dedupe: our own crossposts AND already-imported posts both carry bskyUri
    const existing = await db.query.posts.findFirst({
      where: eq(posts.bskyUri, uri),
      columns: { id: true, content: true, linkPreview: true },
    })
    if (existing) {
      // Backfill: posts imported before image/preview support. Add whichever is
      // missing — embed images, or a link preview for a bare URL.
      const imgs = extractBskyImages(post.embed)
      if (imgs.length) {
        const hasMedia = await db.query.mediaAttachments.findFirst({
          where: eq(mediaAttachments.postId, existing.id),
          columns: { id: true },
        })
        if (!hasMedia) {
          await db.insert(mediaAttachments).values(imgs.map((im) => ({
            postId: existing.id,
            actorId: actor.id,
            url: im.url,
            remoteUrl: im.url,
            mimeType: 'image/jpeg',
            altText: im.alt || null,
            width: im.width,
            height: im.height,
          }))).catch(() => {})
        }
      } else if (!existing.linkPreview) {
        const linkUrl = extractFirstUrl(existing.content)
        if (linkUrl) {
          void fetchLinkPreview(linkUrl)
            .then((preview) => preview && db.update(posts).set({ linkPreview: preview }).where(eq(posts.id, existing.id)))
            .catch(() => {})
        }
      }
      continue
    }

    const tags = Array.from(text.matchAll(/#([\p{L}\p{N}_]+)/gu)).map((m) => `#${m[1]}`)
    const createdAt = record.createdAt ? new Date(record.createdAt) : new Date()

    const [inserted] = await db.insert(posts).values({
      authorId: actor.id,
      content: text,
      visibility: 'public',
      isLocal: true,
      bskyUri: uri,
      tags,
      apId: 'placeholder',
      createdAt,
    }).returning({ id: posts.id })
    if (!inserted) continue

    const apId = `${env.APP_URL}/users/${actor.handle}/posts/${inserted.id}`
    await db.update(posts).set({ apId, apUrl: apId }).where(eq(posts.id, inserted.id))

    // Hotlink any images from the Bluesky embed
    const images = extractBskyImages(post.embed)
    if (images.length) {
      await db.insert(mediaAttachments).values(images.map((im) => ({
        postId: inserted.id,
        actorId: actor.id,
        url: im.url,
        remoteUrl: im.url,
        mimeType: 'image/jpeg',
        altText: im.alt || null,
        width: im.width,
        height: im.height,
      }))).catch(() => {})
    } else {
      // No image embed → if the text carries a link, build a rich preview
      // (Apple Music / article card) just like native floq posts do.
      const linkUrl = extractFirstUrl(text)
      if (linkUrl) {
        void fetchLinkPreview(linkUrl)
          .then((preview) => preview && db.update(posts).set({ linkPreview: preview }).where(eq(posts.id, inserted.id)))
          .catch(() => {})
      }
    }

    // Going-forward fan-out: federate posts made after import was enabled, so the
    // user's fediverse followers see new Bluesky posts (backfill stays silent).
    if (conn.importEnabledAt && createdAt > conn.importEnabledAt) {
      const note = buildNote({
        id: inserted.id,
        content: text,
        sensitive: false,
        contentWarning: null,
        visibility: 'public',
        createdAt,
        apInReplyTo: null,
        tags,
        author: { handle: actor.handle },
      })
      void deliverToFollowers(actor.handle, actor.id, buildCreate(note, actor.handle)).catch(() => {})
    }

    imported++
    if (imported >= 10) break // bound work per sweep
  }

  if (imported > 0) {
    await db.update(actors)
      .set({ postsCount: sql`${actors.postsCount} + ${imported}` })
      .where(eq(actors.id, actor.id))
      .catch(() => {})
  }
  await setBridgeStatus(userId, null) // a clean sweep — mark healthy
  return imported
}

// Sweep every connection that opted into import. Called on an interval.
export async function sweepBlueskyImports(): Promise<void> {
  const conns = await db.query.blueskyConnections.findMany({
    where: eq(blueskyConnections.importEnabled, true),
    columns: { userId: true },
  })
  for (const c of conns) {
    await importBlueskyPosts(c.userId).catch(() => {})
  }
}
