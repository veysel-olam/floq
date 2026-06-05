/**
 * Layer 2 — Empirical round-trip harness (SKELETON).
 *
 * Validates the static audit (audit.ts) against real networks:
 *   for each corpus case → publish via floq → fetch the bridged copy from the
 *   target → compare field-by-field → score (1 / 0.5 / 0).
 *
 * The fetch adapters need real credentials/endpoints, so this file is a typed
 * scaffold: fill the TODOs, then `npx tsx research/interop/harness.ts`.
 * Output: writes per-run results to research/interop/data/<date>.json and prints
 * a matrix you can diff against MATRIX.md (Layer 1).
 *
 * Why a skeleton: Layer 1 already gives reproducible, code-grounded results with
 * zero accounts. Layer 2 is the confirmation pass — it mainly catches cases where
 * the *receiver* recovers something the sender dropped (e.g. Mastodon inferring a
 * mention from inline "@user@host"), turning a static "0" into an empirical "0.5".
 */
import type { Target, Score } from './dimensions.js'
import { CORPUS, type CorpusCase } from './corpus.js'

// A normalised view of how a post arrived at a target — fill from the target's API.
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

// ── Adapters (TODO: implement with real credentials) ────────────────────────────

/** Publish a corpus case via floq's API and return identifiers to locate it later. */
async function publishViaFloq(_c: CorpusCase): Promise<{ floqPostId: string }> {
  // TODO: POST /api/posts with the case payload (auth token from env).
  throw new Error('publishViaFloq: implement with a floq test account token')
}

/** Fetch how the post landed on each target. Return null if not found yet. */
const fetchers: Record<Target, (ids: { floqPostId: string }) => Promise<ReceivedPost | null>> = {
  // Mastodon/AP: resolve the floq Note's AP id on a real Mastodon instance and read it.
  ap: async () => { throw new Error('AP fetcher: implement (Mastodon API or AP GET)') },
  // Bluesky: getAuthorFeed on the connected handle, match by text/uri.
  bluesky: async () => { throw new Error('Bluesky fetcher: implement (getAuthorFeed)') },
  // Nostr: subscribe to relays for the author npub, match by content.
  nostr: async () => { throw new Error('Nostr fetcher: implement (relay subscribe)') },
}

// ── Comparator: did the dimension survive in the received post? ─────────────────
function scoreDimension(c: CorpusCase, r: ReceivedPost): Score {
  switch (c.dimension) {
    case 'text':
      if (!r.text) return 0
      return r.text.length >= 300 ? 0.5 : (r.text.includes('dünya') ? 1 : 0.5)
    case 'visibility':
      return r.visibility === c.post.visibility ? 1 : r.visibility ? 0.5 : 0
    case 'content_warning':
      return r.hasContentWarning ? 1 : 0
    case 'hashtags':
      return (r.hashtags?.length ?? 0) >= (c.post.tags?.length ?? 0) ? 1 : (r.hashtags?.length ? 0.5 : 0)
    case 'mentions':
      return (r.mentions?.length ?? 0) > 0 ? 1 : (r.text?.includes('@') ? 0.5 : 0)
    case 'quote':
      return r.quoteRef ? 1 : 0
    case 'media':
      return (r.media?.length ?? 0) > 0 ? 1 : 0
    case 'media_alt':
      return r.media?.some((m) => m.alt) ? 1 : 0
    case 'reply_thread':
      return r.inReplyTo ? 1 : 0
    case 'timestamp':
      return r.createdAt ? 0.5 : 0 // 1 only if it matches the original within tolerance
    case 'language':
      return r.language === c.post.language ? 1 : (r.language ? 0.5 : 0)
    default:
      return null
  }
}

// ── Runner ───────────────────────────────────────────────────────────────────
export async function runEmpirical(): Promise<void> {
  const results: { dimension: string; target: Target; score: Score }[] = []
  for (const c of CORPUS) {
    const ids = await publishViaFloq(c)
    // Give bridges time to deliver (crosspost job + relay propagation).
    await new Promise((res) => setTimeout(res, 15_000))
    for (const target of Object.keys(fetchers) as Target[]) {
      const received = await fetchers[target](ids).catch(() => null)
      const score = received ? scoreDimension(c, received) : 0
      results.push({ dimension: c.dimension, target, score })
    }
  }
  console.table(results)
  // TODO: write results to data/<date>.json and render an empirical MATRIX to diff
  // against the static one (Layer 1).
}

if (import.meta.url === `file://${process.argv[1]}`) {
  runEmpirical().catch((e) => { console.error(e); process.exit(1) })
}
