/**
 * Layer 2 — Empirical round-trip harness (RUNNABLE).
 *
 * For each corpus case: publish via floq → wait for bridge delivery → fetch the
 * bridged copy from each target → score the dimension → compare to the static
 * audit (Layer 1). No SDK deps: AP via signed-less public GET, Bluesky via the
 * public XRPC AppView, Nostr via a raw relay WebSocket.
 *
 * Config (env):
 *   FLOQ_API_URL      e.g. https://api.flq.social
 *   FLOQ_COOKIE       Better-Auth session cookie (copy from your browser devtools)
 *   BLUESKY_HANDLE    connected Bluesky handle (public feed read)
 *   NOSTR_NPUB_HEX    author pubkey (hex) for the floq Nostr identity
 *   NOSTR_RELAYS      comma list (default: wss://relay.damus.io,wss://nos.lol)
 *
 * Run: npx tsx research/interop/harness.ts
 * Output: research/interop/data/empirical-<date>.json + console matrix.
 */
import { writeFileSync, mkdirSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import { randomUUID } from 'node:crypto'
import { CORPUS, type CorpusCase } from './corpus.js'
import { TARGETS, type Target, type Score } from './dimensions.js'

const env = (k: string, d = '') => process.env[k] ?? d
const FLOQ_API_URL = env('FLOQ_API_URL', 'https://api.flq.social')
const FLOQ_COOKIE = env('FLOQ_COOKIE')
const BLUESKY_HANDLE = env('BLUESKY_HANDLE')
const NOSTR_NPUB_HEX = env('NOSTR_NPUB_HEX')
const NOSTR_RELAYS = env('NOSTR_RELAYS', 'wss://relay.damus.io,wss://nos.lol').split(',')
const DELIVERY_WAIT_MS = Number(env('DELIVERY_WAIT_MS', '20000'))

interface ReceivedPost {
  text?: string
  visibility?: string
  hasContentWarning?: boolean
  hashtags?: string[]
  mentions?: string[]
  quoteRef?: string | null
  media?: { url: string; alt?: string }[]
  inReplyTo?: string | null
  createdAt?: string
  language?: string
}

// ── Publish via floq ────────────────────────────────────────────────────────────
async function publishViaFloq(c: CorpusCase, marker: string): Promise<{ apId: string; content: string }> {
  if (!FLOQ_COOKIE) throw new Error('FLOQ_COOKIE gerekli (Better-Auth oturum çerezi)')
  const content = `${c.post.content} ${marker}`
  const res = await fetch(`${FLOQ_API_URL}/api/posts`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', cookie: FLOQ_COOKIE },
    body: JSON.stringify({
      content,
      visibility: c.post.visibility ?? 'public',
      sensitive: c.post.sensitive ?? false,
      ...(c.post.contentWarning ? { contentWarning: c.post.contentWarning } : {}),
    }),
  })
  if (!res.ok) throw new Error(`floq publish ${res.status}`)
  const post = await res.json() as { apId?: string; id: string }
  return { apId: post.apId ?? `${FLOQ_API_URL}/posts/${post.id}`, content }
}

// ── AP fetcher: read floq's own canonical Note (what every AP server receives) ───
async function fetchAp(apId: string): Promise<ReceivedPost | null> {
  const res = await fetch(apId, { headers: { accept: 'application/activity+json' } })
  if (!res.ok) return null
  const n = await res.json() as Record<string, any>
  const tags: any[] = Array.isArray(n.tag) ? n.tag : n.tag ? [n.tag] : []
  return {
    text: typeof n.content === 'string' ? n.content.replace(/<[^>]+>/g, '') : undefined,
    visibility: (n.to ?? []).includes('https://www.w3.org/ns/activitystreams#Public') ? 'public' : 'other',
    hasContentWarning: !!n.summary || n.sensitive === true,
    hashtags: tags.filter((t) => t.type === 'Hashtag').map((t) => String(t.name).replace(/^#/, '')),
    mentions: tags.filter((t) => t.type === 'Mention').map((t) => String(t.name)),
    quoteRef: n.quoteUri ?? n.quoteUrl ?? null,
    media: (n.attachment ?? []).map((a: any) => ({ url: a.url, alt: a.name })),
    inReplyTo: n.inReplyTo ?? null,
    createdAt: n.published,
    language: n.contentMap ? Object.keys(n.contentMap)[0] : undefined,
  }
}

// ── Bluesky fetcher: public AppView getAuthorFeed ────────────────────────────────
async function fetchBluesky(marker: string): Promise<ReceivedPost | null> {
  if (!BLUESKY_HANDLE) return null
  const url = `https://public.api.bsky.app/xrpc/app.bsky.feed.getAuthorFeed?actor=${encodeURIComponent(BLUESKY_HANDLE)}&limit=30`
  const res = await fetch(url)
  if (!res.ok) return null
  const data = await res.json() as { feed: { post: any }[] }
  const hit = data.feed.find((f) => (f.post?.record?.text ?? '').includes(marker))
  if (!hit) return null
  const rec = hit.post.record
  const facets: any[] = rec.facets ?? []
  const features = facets.flatMap((f) => f.features ?? [])
  const embed = hit.post.embed
  return {
    text: rec.text,
    visibility: 'public',
    hasContentWarning: Array.isArray(hit.post.labels) && hit.post.labels.length > 0,
    hashtags: features.filter((x) => x.$type?.includes('tag')).map((x) => x.tag),
    mentions: features.filter((x) => x.$type?.includes('mention')).map((x) => x.did),
    quoteRef: embed?.$type?.includes('record') ? (embed.record?.uri ?? null) : null,
    media: (embed?.images ?? []).map((im: any) => ({ url: im.fullsize, alt: im.alt })),
    inReplyTo: rec.reply?.parent?.uri ?? null,
    createdAt: rec.createdAt,
    language: Array.isArray(rec.langs) ? rec.langs[0] : undefined,
  }
}

// ── Nostr fetcher: raw relay WebSocket REQ (kind:1, author) ──────────────────────
async function fetchNostr(marker: string): Promise<ReceivedPost | null> {
  if (!NOSTR_NPUB_HEX || typeof WebSocket === 'undefined') return null
  for (const relay of NOSTR_RELAYS) {
    const ev = await new Promise<any | null>((resolve) => {
      let done = false
      const ws = new WebSocket(relay.trim())
      const sub = randomUUID().slice(0, 8)
      const finish = (v: any | null) => { if (!done) { done = true; try { ws.close() } catch {} ; resolve(v) } }
      const timer = setTimeout(() => finish(null), 6000)
      ws.onopen = () => ws.send(JSON.stringify(['REQ', sub, { authors: [NOSTR_NPUB_HEX], kinds: [1], limit: 20 }]))
      ws.onmessage = (m) => {
        try {
          const data = JSON.parse(String((m as MessageEvent).data))
          if (data[0] === 'EVENT' && data[2]?.content?.includes(marker)) { clearTimeout(timer); finish(data[2]) }
          if (data[0] === 'EOSE') { clearTimeout(timer); finish(null) }
        } catch {}
      }
      ws.onerror = () => { clearTimeout(timer); finish(null) }
    })
    if (ev) {
      const ttags: string[] = (ev.tags ?? []).filter((t: string[]) => t[0] === 't').map((t: string[]) => t[1])
      return {
        text: ev.content,
        visibility: 'public',
        hashtags: ttags,
        mentions: (ev.tags ?? []).filter((t: string[]) => t[0] === 'p').map((t: string[]) => t[1]),
        quoteRef: (ev.tags ?? []).some((t: string[]) => t[0] === 'q') ? 'q' : null,
        createdAt: new Date(ev.created_at * 1000).toISOString(),
      }
    }
  }
  return null
}

// ── Comparator ───────────────────────────────────────────────────────────────
function scoreDimension(c: CorpusCase, r: ReceivedPost): Score {
  switch (c.dimension) {
    case 'text':            return !r.text ? 0 : (r.text.length >= 300 ? 0.5 : (r.text.includes('dünya') || r.text.length > 5 ? 1 : 0.5))
    case 'visibility':      return r.visibility === (c.post.visibility ?? 'public') ? 1 : r.visibility ? 0.5 : 0
    case 'content_warning': return r.hasContentWarning ? 1 : 0
    case 'hashtags':        return (r.hashtags?.length ?? 0) >= (c.post.tags?.length ?? 1) ? 1 : (r.hashtags?.length ? 0.5 : 0)
    case 'mentions':        return (r.mentions?.length ?? 0) > 0 ? 1 : (r.text?.includes('@') ? 0.5 : 0)
    case 'quote':           return r.quoteRef ? 1 : 0
    case 'media':           return (r.media?.length ?? 0) > 0 ? 1 : 0
    case 'media_alt':       return r.media?.some((m) => m.alt) ? 1 : 0
    case 'reply_thread':    return r.inReplyTo ? 1 : 0
    case 'timestamp':       return r.createdAt ? 0.5 : 0
    case 'language':        return r.language === c.post.language ? 1 : (r.language ? 0.5 : 0)
    default:                return null
  }
}

// ── Runner ───────────────────────────────────────────────────────────────────
export async function runEmpirical(): Promise<void> {
  const results: { dimension: string; target: Target; score: Score; found: boolean }[] = []
  for (const c of CORPUS) {
    const marker = `#run${randomUUID().slice(0, 6).replace(/-/g, '')}`
    let apId = ''
    try { ({ apId } = await publishViaFloq(c, marker)) }
    catch (e) { console.error(`publish başarısız (${c.dimension}):`, (e as Error).message); continue }
    await new Promise((r) => setTimeout(r, DELIVERY_WAIT_MS))

    const received: Record<Target, ReceivedPost | null> = {
      ap: await fetchAp(apId).catch(() => null),
      bluesky: await fetchBluesky(marker).catch(() => null),
      nostr: await fetchNostr(marker).catch(() => null),
    }
    for (const t of TARGETS) {
      const r = received[t]
      results.push({ dimension: c.dimension, target: t, score: r ? scoreDimension(c, r) : 0, found: !!r })
    }
  }

  console.table(results)
  const here = dirname(fileURLToPath(import.meta.url))
  mkdirSync(join(here, 'data'), { recursive: true })
  const file = join(here, 'data', `empirical-${new Date().toISOString().slice(0, 10)}.json`)
  writeFileSync(file, JSON.stringify({ when: new Date().toISOString(), results }, null, 2))
  console.log('✓ Yazıldı:', file)
}

if (import.meta.url === `file://${process.argv[1]}`) {
  runEmpirical().catch((e) => { console.error(e); process.exit(1) })
}
