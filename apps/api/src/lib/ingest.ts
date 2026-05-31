import { createHash } from 'node:crypto'
import { and, eq, sql } from 'drizzle-orm'
import { db } from '../db/client.js'
import { posts, mediaAttachments, actors } from '../db/schema.js'
import { fetchRemoteActor, signedApFetch } from './federation.js'
import { extractFirstUrl, fetchLinkPreview } from './linkPreview.js'

// ── AP shapes (loosely typed — remote servers vary) ────────────────────────────
interface APAttachment {
  type?: string
  mediaType?: string
  url?: string
  name?: string
  width?: number
  height?: number
  blurhash?: string
}
interface APNote {
  id?: string
  type?: string
  attributedTo?: string
  content?: string
  summary?: string
  sensitive?: boolean
  url?: string
  inReplyTo?: string | null
  published?: string
  to?: string[]
  cc?: string[]
  tag?: Array<{ type?: string; name?: string }>
  attachment?: APAttachment[]
}

const PUBLIC = 'https://www.w3.org/ns/activitystreams#Public'
function resolveVisibility(to: string[], cc: string[]): 'public' | 'unlisted' | 'followers' | 'direct' {
  if (to.includes(PUBLIC)) return 'public'
  if (cc.includes(PUBLIC)) return 'unlisted'
  if (to.some((t) => t.endsWith('/followers'))) return 'followers'
  return 'direct'
}

// Strip HTML to text (remote content is HTML) so URL/preview extraction doesn't
// trip over mention/hashtag anchors. Mentions become "@user", real links keep
// their URL text.
function stripHtml(html: string): string {
  return html
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/p>/gi, '\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .trim()
}

/**
 * Store a remote note's media attachments and generate a link-preview card
 * (the same way local posts get one). Shared by ingestRemoteNote and the live
 * inbox Create handler so federated posts render with images + preview cards.
 */
export async function attachRemoteMediaAndPreview(
  postId: string,
  note: { attachment?: APAttachment[]; content?: string | null },
): Promise<void> {
  // Media (images/video/audio)
  const media = (note.attachment ?? []).filter((a) => a.url && (a.mediaType || a.type))
  if (media.length > 0) {
    await db.insert(mediaAttachments).values(
      media.map((a) => ({
        postId,
        url: a.url!,
        remoteUrl: a.url!,
        mimeType: a.mediaType ?? 'image/jpeg',
        altText: a.name ?? null,
        width: a.width ?? null,
        height: a.height ?? null,
        blurhash: a.blurhash ?? null,
      })),
    ).onConflictDoNothing()
  }

  // Link preview — only if the post has no media (mirror local behavior: a card
  // for a shared URL). Extract from the text form so we skip mention/tag anchors.
  if (media.length === 0 && note.content) {
    const url = extractFirstUrl(stripHtml(note.content))
    if (url) {
      try {
        const preview = await fetchLinkPreview(url)
        if (preview) await db.update(posts).set({ linkPreview: preview }).where(eq(posts.id, postId))
      } catch { /* preview is best-effort */ }
    }
  }
}

async function fetchObject(url: string): Promise<APNote | null> {
  try {
    const res = await signedApFetch(url)
    if (!res.ok) return null
    return (await res.json()) as APNote
  } catch {
    return null
  }
}

/**
 * Ingest a single remote Note (by URL or already-fetched object) into our DB:
 * upserts its author, stores the post, links the reply parent (optionally walking
 * up the inReplyTo chain), and saves media attachments. Idempotent on apId.
 * Returns the local post id, or null if it couldn't be ingested.
 */
export async function ingestRemoteNote(
  input: string | APNote,
  opts: { resolveParentsDepth?: number } = {},
): Promise<string | null> {
  const note = typeof input === 'string' ? await fetchObject(input) : input
  if (!note || !note.id) return null
  if (note.type !== 'Note' && note.type !== 'Question') return null
  if (!note.content) return null

  // Already have it?
  const existing = await db.query.posts.findFirst({ where: eq(posts.apId, note.id) })
  if (existing) return existing.id

  const attributedTo = note.attributedTo
  if (!attributedTo || typeof attributedTo !== 'string') return null
  const author = await fetchRemoteActor(attributedTo)
  if (!author) return null

  // Resolve the reply parent (optionally fetch it remotely so threads connect).
  let replyToId: string | undefined
  let rootId: string | undefined
  if (note.inReplyTo) {
    let parent = await db.query.posts.findFirst({ where: eq(posts.apId, note.inReplyTo) })
    if (!parent && (opts.resolveParentsDepth ?? 0) > 0) {
      const parentId = await ingestRemoteNote(note.inReplyTo, {
        resolveParentsDepth: (opts.resolveParentsDepth ?? 0) - 1,
      })
      if (parentId) parent = await db.query.posts.findFirst({ where: eq(posts.id, parentId) })
    }
    if (parent) {
      replyToId = parent.id
      rootId = parent.rootId ?? parent.id
    }
  }

  const remoteTags = (note.tag ?? [])
    .filter((t) => t.type === 'Hashtag' && t.name)
    .map((t) => t.name!.replace(/^#/, '').toLowerCase())
    .filter(Boolean)

  const visibility = resolveVisibility(note.to ?? [], note.cc ?? [])

  const [created] = await db.insert(posts).values({
    apId: note.id,
    apUrl: note.url ?? note.id,
    authorId: author.id,
    content: note.content,
    contentHash: createHash('sha256').update(note.content, 'utf8').digest('hex'),
    contentWarning: note.summary ?? null,
    visibility,
    sensitive: note.sensitive ?? false,
    apInReplyTo: note.inReplyTo ?? null,
    replyToId: replyToId ?? null,
    rootId: rootId ?? null,
    isLocal: false,
    tags: remoteTags,
    createdAt: note.published ? new Date(note.published) : new Date(),
  }).onConflictDoNothing().returning()

  if (!created) {
    const again = await db.query.posts.findFirst({ where: eq(posts.apId, note.id) })
    return again?.id ?? null
  }

  if (replyToId) {
    await db.update(posts)
      .set({ repliesCount: sql`${posts.repliesCount} + 1` })
      .where(eq(posts.id, replyToId))
  }

  await attachRemoteMediaAndPreview(created.id, note)

  return created.id
}

/**
 * Ensure the full ancestor chain of a remote post exists locally by walking up
 * `inReplyTo` from a starting note URL. Used when viewing a federated reply whose
 * parents we haven't seen. Bounded by maxDepth.
 */
export async function resolveRemoteThread(noteUrl: string, maxDepth = 12): Promise<void> {
  await ingestRemoteNote(noteUrl, { resolveParentsDepth: maxDepth })
}

/**
 * Resolve actors from a remote follow collection's first page (followers/
 * following). Best-effort + bounded — many servers (Mastodon) hide these to
 * remote requests, in which case it returns []. Capped to avoid slow fan-out.
 */
export async function fetchRemoteCollectionActors(collectionUrl: string, limit = 8) {
  const coll = await fetchObject(collectionUrl) as unknown as
    | { first?: string | { orderedItems?: unknown[]; items?: unknown[] }; orderedItems?: unknown[]; items?: unknown[] }
    | null
  if (!coll) return []
  let page: { orderedItems?: unknown[]; items?: unknown[] } | null = null
  if (Array.isArray(coll.orderedItems) || Array.isArray(coll.items)) page = coll
  else if (typeof coll.first === 'string') page = await fetchObject(coll.first) as unknown as { orderedItems?: unknown[]; items?: unknown[] } | null
  else if (coll.first && typeof coll.first === 'object') page = coll.first

  const uris = ((page?.orderedItems ?? page?.items ?? []) as unknown[])
    .filter((u): u is string => typeof u === 'string')
    .slice(0, limit)
  const resolved = await Promise.allSettled(uris.map((u) => fetchRemoteActor(u)))
  return resolved.flatMap((r) => (r.status === 'fulfilled' && r.value ? [r.value] : []))
}

/**
 * Backfill recent posts from a remote actor's outbox so their profile/feed isn't
 * empty right after we discover/follow them. Best-effort, bounded by `limit`.
 */
export async function backfillOutbox(actorId: string, limit = 20): Promise<number> {
  const actor = await db.query.actors.findFirst({ where: eq(actors.id, actorId) })
  if (!actor || actor.isLocal || !actor.outboxUrl) return 0

  const outbox = await fetchObject(actor.outboxUrl) as unknown as
    | { first?: string | { orderedItems?: unknown[]; next?: string }; orderedItems?: unknown[] }
    | null
  if (!outbox) return 0

  // Outbox is an OrderedCollection; items live on the first page.
  let page: { orderedItems?: unknown[] } | null = null
  if (Array.isArray(outbox.orderedItems)) {
    page = outbox
  } else if (typeof outbox.first === 'string') {
    page = await fetchObject(outbox.first) as unknown as { orderedItems?: unknown[] } | null
  } else if (outbox.first && typeof outbox.first === 'object') {
    page = outbox.first
  }

  const items = page?.orderedItems ?? []
  let ingested = 0
  for (const item of items) {
    if (ingested >= limit) break
    // Items are usually Create activities wrapping a Note, sometimes a bare Note,
    // sometimes Announce (boost) — only ingest original Notes here.
    const act = item as { type?: string; object?: APNote | string }
    let noteRef: APNote | string | null = null
    if (act.type === 'Create' && act.object) noteRef = act.object
    else if (act.type === 'Note' || act.type === 'Question') noteRef = act as unknown as APNote
    if (!noteRef) continue
    const id = await ingestRemoteNote(noteRef)
    if (id) ingested++
  }
  return ingested
}
