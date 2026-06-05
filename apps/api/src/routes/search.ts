import type { FastifyInstance } from 'fastify'
import { ilike, or, and, eq, desc, sql, gte, lte, isNotNull, isNull } from 'drizzle-orm'
import { db } from '../db/client.js'
import { actors, posts, mediaAttachments } from '../db/schema.js'
import { getSession } from '../lib/session.js'
import { enrichPosts } from '../lib/enrichPosts.js'
import { fetchRemoteActor } from '../lib/federation.js'
import { ingestRemoteNote } from '../lib/ingest.js'
import { env } from '../lib/env.js'

// A full fediverse handle: `@user@instance.tld` or `user@instance.tld`.
const REMOTE_HANDLE_RE = /^@?([^@\s]+)@([^@\s]+\.[^@\s]+)$/

// Extract `operator:value` tokens from a query string and return the clean text + extracted values
function parseSearchOperators(raw: string) {
  let text = raw
  let from: string | undefined
  let since: Date | undefined
  let until: Date | undefined

  text = text.replace(/\bfrom:(\S+)/gi, (_, handle) => { from = handle.replace(/^@/, ''); return '' })
  text = text.replace(/\bsince:(\d{4}-\d{2}-\d{2})/gi, (_, d) => { since = new Date(d); return '' })
  text = text.replace(/\buntil:(\d{4}-\d{2}-\d{2})/gi, (_, d) => {
    const u = new Date(d); u.setHours(23, 59, 59, 999); until = u; return ''
  })

  return { text: text.trim(), from, since, until }
}

export async function searchRoutes(app: FastifyInstance) {
  app.get('/api/search', {
    config: { rateLimit: { max: 60, timeWindow: '1 minute' } },
  }, async (req, reply) => {
    const {
      q,
      type = 'all',
      scope = 'all',
      limit: limitStr,
      from: fromParam,
      since: sinceParam,
      until: untilParam,
      hasMedia: hasMediaParam,
      onlyReplies: onlyRepliesParam,
    } = req.query as {
      q?: string
      type?: 'actors' | 'posts' | 'all'
      scope?: 'local' | 'federated' | 'all'
      limit?: string
      from?: string
      since?: string
      until?: string
      hasMedia?: string
      onlyReplies?: string
    }

    const rawQ = q?.trim() ?? ''
    const parsed = parseSearchOperators(rawQ)

    // Merge inline operators with explicit params (explicit params take precedence)
    const fromHandle = fromParam ?? parsed.from
    const sinceDate = sinceParam ? new Date(sinceParam) : parsed.since
    const untilDate = untilParam ? (() => { const d = new Date(untilParam); d.setHours(23, 59, 59, 999); return d })() : parsed.until
    const hasMedia = hasMediaParam === 'true'
    const onlyReplies = onlyRepliesParam === 'true'
    const noReplies = onlyRepliesParam === 'false'
    const term = parsed.text

    const hasFilters = !!(fromHandle || sinceDate || untilDate || hasMedia || onlyRepliesParam)
    if (!term && !hasFilters) return reply.send({ actors: [], posts: [] })

    const limit = Math.min(Number(limitStr ?? 10), 40)

    const session = await getSession(req)
    let viewerActorId: string | undefined
    if (session) {
      const viewer = await db.query.actors.findFirst({ where: eq(actors.userId, session.user.id) })
      viewerActorId = viewer?.id
    }

    let actorRows: (typeof actors.$inferSelect)[] = []
    let enrichedPosts: Awaited<ReturnType<typeof enrichPosts>> = []

    // Paste-to-resolve: a fediverse URL is either a post or an actor. Try to
    // ingest it as a remote Note first; if that fails, resolve it as an actor.
    if (/^https?:\/\//i.test(rawQ)) {
      const postId = await ingestRemoteNote(rawQ).catch(() => null)
      if (postId) {
        const p = await db.query.posts.findFirst({ where: eq(posts.id, postId) })
        if (p) enrichedPosts = await enrichPosts([p], viewerActorId)
      } else {
        const remote = await fetchRemoteActor(rawQ).catch(() => null)
        if (remote) actorRows = [remote]
      }
      return reply.send({ actors: actorRows, posts: enrichedPosts })
    }

    if ((type === 'actors' || type === 'all') && term) {
      // Use FTS with GIN index; fall back to ILIKE for very short terms (< 2 chars)
      // Sanitize for to_tsquery: split on whitespace AND handle punctuation (@ .),
      // strip any chars tsquery treats as operators. Avoids "syntax error in tsquery"
      // for inputs like "@user@instance.tld".
      const tsq = term
        .split(/[\s@.]+/)
        .map((w) => w.replace(/[^\p{L}\p{N}_]/gu, ''))
        .filter(Boolean)
        .map((w) => `${w}:*`)
        .join(' & ')
      if (term.length >= 2 && tsq) {
        const rawRows = await db.execute(
          sql`SELECT * FROM actors
              WHERE is_local = true
                AND search_vector @@ to_tsquery('simple', ${tsq})
              ORDER BY followers_count DESC
              LIMIT ${limit}`
        ).then((r) => (r as unknown as { rows: Record<string, unknown>[] }).rows)
        // db.execute returns snake_case column names — map to camelCase for the Actor type
        actorRows = rawRows.map((r) => ({
          id: r['id'],
          userId: r['user_id'],
          apId: r['ap_id'],
          handle: r['handle'],
          displayName: r['display_name'] ?? null,
          bio: r['bio'] ?? null,
          avatarUrl: r['avatar_url'] ?? null,
          headerUrl: r['header_url'] ?? null,
          profileUrl: r['profile_url'],
          inboxUrl: r['inbox_url'],
          outboxUrl: r['outbox_url'],
          followersUrl: r['followers_url'],
          followingUrl: r['following_url'],
          sharedInboxUrl: r['shared_inbox_url'] ?? null,
          publicKey: r['public_key'],
          privateKeyEncrypted: r['private_key_encrypted'] ?? null,
          ed25519PublicKey: r['ed25519_public_key'] ?? null,
          ed25519PrivateKeyEncrypted: r['ed25519_private_key_encrypted'] ?? null,
          followersCount: Number(r['followers_count'] ?? 0),
          followingCount: Number(r['following_count'] ?? 0),
          postsCount: Number(r['posts_count'] ?? 0),
          isLocal: r['is_local'],
          isBot: r['is_bot'],
          isLocked: r['is_locked'],
          noIndex: r['no_index'],
          instanceId: r['instance_id'] ?? null,
          fields: r['fields'] ?? null,
          createdAt: r['created_at'],
          updatedAt: r['updated_at'],
        })) as unknown as typeof actors.$inferSelect[]
      } else {
        actorRows = await db.query.actors.findMany({
          where: and(
            eq(actors.isLocal, true),
            or(ilike(actors.handle, `%${term}%`), ilike(actors.displayName ?? '', `%${term}%`)),
          ),
          orderBy: [desc(actors.followersCount)],
          limit,
        })
      }
    }

    // Remote fediverse lookup: if the query is a full `@user@instance.tld` handle,
    // resolve it over WebFinger + ActivityPub and surface it (so it can be followed),
    // unless it's our own domain (those are covered by the local search above).
    const remoteMatch = (type === 'actors' || type === 'all') ? rawQ.match(REMOTE_HANDLE_RE) : null
    if (remoteMatch && remoteMatch[2] !== env.APP_DOMAIN) {
      const [, username, instance] = remoteMatch
      try {
        const wfRes = await fetch(
          `https://${instance}/.well-known/webfinger?resource=acct:${username}@${instance}`,
          { headers: { Accept: 'application/json' }, signal: AbortSignal.timeout(8000) },
        )
        if (wfRes.ok) {
          const wf = await wfRes.json() as { links?: Array<{ rel: string; type?: string; href?: string }> }
          const apUrl = wf.links?.find((l) => l.rel === 'self' && (l.type?.includes('activity+json') ?? false))?.href
          if (apUrl) {
            const remote = await fetchRemoteActor(apUrl)
            if (remote && !actorRows.some((a) => a.id === remote.id)) actorRows.unshift(remote)
          }
        }
      } catch { /* remote unreachable — just return local results */ }
    }

    if (type === 'posts' || type === 'all') {
      // Resolve fromHandle to actorId
      let fromActorId: string | undefined
      if (fromHandle) {
        const fromActor = await db.query.actors.findFirst({ where: eq(actors.handle, fromHandle) })
        if (!fromActor) return reply.send({ actors: actorRows, posts: [] })
        fromActorId = fromActor.id
      }

      // Check if post has media via subquery
      const postIdHasMedia = hasMedia
        ? await db.selectDistinct({ postId: mediaAttachments.postId })
            .from(mediaAttachments)
            .then((rows) => new Set(rows.map((r) => r.postId)))
        : null

      const conditions = [
        eq(posts.isDeleted, false),
        eq(posts.visibility, 'public'),
        eq(posts.isEphemeral, false), // moments (stories) are excluded from search

        scope === 'local' ? eq(posts.isLocal, true) : scope === 'federated' ? eq(posts.isLocal, false) : undefined,
        // Respect noIndex — exclude posts from actors who opted out of indexing
        sql`NOT EXISTS (SELECT 1 FROM actors a WHERE a.id = ${posts.authorId} AND a.no_index = true)`,
        // Use FTS with GIN index for terms >= 2 chars; ILIKE fallback for single chars
        term && term.length >= 2
          ? sql`posts.content_search @@ websearch_to_tsquery('turkish', ${term})`
          : term
            ? ilike(posts.content, `%${term}%`)
            : undefined,
        fromActorId ? eq(posts.authorId, fromActorId) : undefined,
        sinceDate ? gte(posts.createdAt, sinceDate) : undefined,
        untilDate ? lte(posts.createdAt, untilDate) : undefined,
        onlyReplies ? isNotNull(posts.replyToId) : undefined,
        noReplies ? isNull(posts.replyToId) : undefined,
      ].filter(Boolean) as Parameters<typeof and>

      // When FTS is active, order by relevance rank first, then recency.
      // Use Drizzle's .select() so column names are properly camelCased for enrichPosts.
      const useFts = !!(term && term.length >= 2)
      const postList = useFts
        ? await db.select()
            .from(posts)
            .where(and(...conditions))
            .orderBy(
              sql`ts_rank(posts.content_search, websearch_to_tsquery('turkish', ${term})) DESC`,
              desc(posts.createdAt),
            )
            .limit(limit)
        : await db.query.posts.findMany({
            where: and(...conditions),
            orderBy: [desc(posts.createdAt)],
            limit,
          })

      // Filter by hasMedia in-memory (set-based)
      const filtered = postIdHasMedia
        ? postList.filter((p) => postIdHasMedia.has(p.id))
        : postList

      enrichedPosts = await enrichPosts(filtered, viewerActorId)
    }

    return reply.send({ actors: actorRows, posts: enrichedPosts })
  })

  // GET /api/trending/tags — recency-weighted trending hashtags.
  // Score = Σ 0.5^(age_hours / 12): recent usage dominates (12h half-life) so the
  // list reflects what's hot *now*. 7-day window for data (old tags decay to ~0
  // via the half-life anyway).
  // Ranking (not filtering) by distinct authors: community-wide tags float to the
  // top and no single user's repeated hashtag can outrank a 2-author tag — yet on
  // a small/quiet instance the panel still shows something instead of vanishing.
  app.get('/api/trending/tags', async (_req, reply) => {
    const rows = await db.execute(
      sql`
        SELECT tag,
               COUNT(DISTINCT author_id) AS count,
               SUM(POWER(0.5, EXTRACT(EPOCH FROM (now() - created_at)) / 43200.0)) AS score
        FROM (
          SELECT unnest(${posts.tags}) AS tag, ${posts.createdAt} AS created_at, ${posts.authorId} AS author_id
          FROM ${posts}
          WHERE ${posts.createdAt} > now() - interval '7 days'
            AND ${posts.isDeleted} = false
            AND ${posts.visibility} = 'public'
            AND ${posts.isEphemeral} = false
        ) t
        GROUP BY tag
        ORDER BY COUNT(DISTINCT author_id) DESC, score DESC
        LIMIT 10
      `
    )

    const tags = (rows as unknown as { rows: { tag: string; count: string }[] }).rows.map((r) => ({
      tag: r.tag,
      count: Number(r.count),
    }))

    return reply.send({ tags })
  })
}
