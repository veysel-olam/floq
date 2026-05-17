import type { FastifyInstance } from 'fastify'
import { eq, and, ilike, or, desc, sql } from 'drizzle-orm'
import { db } from '../../db/client.js'
import { actors, posts } from '../../db/schema.js'
import { getMastodonUser } from '../../lib/mastodonAuth.js'
import { toMastodonAccount, toMastodonStatus } from './serializers.js'
import { fetchRemoteActor } from '../../lib/federation.js'

export async function mastodonSearchRoutes(app: FastifyInstance) {
  // GET /api/v2/search
  app.get<{
    Querystring: {
      q?: string; type?: string; limit?: string; offset?: string
      resolve?: string; following?: string; account_id?: string
    }
  }>('/api/v2/search', async (req, reply) => {
    const { q, type, limit = '20', resolve } = req.query
    if (!q?.trim()) return reply.send({ accounts: [], statuses: [], hashtags: [] })
    const n = Math.min(Number(limit), 40)
    const ctx = await getMastodonUser(req)

    // Try to resolve remote actors if query looks like a handle (@user@domain or URL)
    if (resolve === 'true' && ctx) {
      if (q.startsWith('https://') || q.startsWith('http://')) {
        const remote = await fetchRemoteActor(q)
        if (remote) {
          const accounts = [toMastodonAccount(remote)]
          return reply.send({ accounts, statuses: [], hashtags: [] })
        }
      }
      if (q.startsWith('@') && q.includes('@', 1)) {
        const [, handle] = q.split('@')
        const [localHandle, domain] = (handle ?? '').split('@')
        if (domain) {
          const remoteActorUrl = `https://${domain}/users/${localHandle}`
          const remote = await fetchRemoteActor(remoteActorUrl)
          if (remote) {
            return reply.send({ accounts: [toMastodonAccount(remote)], statuses: [], hashtags: [] })
          }
        }
      }
    }

    const results: { accounts: unknown[]; statuses: unknown[]; hashtags: unknown[] } = {
      accounts: [], statuses: [], hashtags: [],
    }

    if (!type || type === 'accounts') {
      const matchedActors = await db.query.actors.findMany({
        where: or(ilike(actors.handle, `%${q}%`), ilike(actors.displayName, `%${q}%`)),
        limit: n,
      })
      results.accounts = matchedActors.map((a) => toMastodonAccount(a))
    }

    if (!type || type === 'statuses') {
      const matchedPosts = await db.query.posts.findMany({
        where: and(
          eq(posts.visibility, 'public'),
          eq(posts.isDeleted, false),
          sql`to_tsvector('simple', ${posts.content}) @@ plainto_tsquery('simple', ${q})`,
        ),
        orderBy: [desc(posts.createdAt)],
        limit: n,
      })
      const authorIds = [...new Set(matchedPosts.map((p) => p.authorId))]
      const authorMap = authorIds.length
        ? new Map((await db.query.actors.findMany({ where: (a, { inArray }) => inArray(a.id, authorIds) })).map((a) => [a.id, a]))
        : new Map()
      results.statuses = matchedPosts.flatMap((p) => {
        const author = authorMap.get(p.authorId)
        return author ? [toMastodonStatus(p, author)] : []
      })
    }

    if (!type || type === 'hashtags') {
      // Return matching hashtag names used in recent posts
      const tagQuery = q.startsWith('#') ? q.slice(1) : q
      const rows = await db.execute(
        sql`SELECT DISTINCT unnest(tags) AS tag FROM posts WHERE tags IS NOT NULL AND array_to_string(tags, ' ') ILIKE ${'%#' + tagQuery + '%'} LIMIT ${n}`,
      )
      results.hashtags = (rows.rows as Array<{ tag: string }>).map((r) => ({
        name: r.tag.startsWith('#') ? r.tag.slice(1) : r.tag,
        url: `${process.env['WEB_URL'] ?? ''}/tags/${r.tag.replace('#', '')}`,
        history: [],
      }))
    }

    return reply.send(results)
  })
}
