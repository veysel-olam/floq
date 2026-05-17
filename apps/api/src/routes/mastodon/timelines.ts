import type { FastifyInstance } from 'fastify'
import { eq, and, or, desc, lt, inArray, sql } from 'drizzle-orm'
import { db } from '../../db/client.js'
import { actors, posts, follows, likes, boosts, mediaAttachments } from '../../db/schema.js'
import { requireMastodonUser, getMastodonUser } from '../../lib/mastodonAuth.js'
import { toMastodonStatus, toMastodonAccount } from './serializers.js'

const LIMIT = 40

async function enrichPosts(
  rows: typeof posts.$inferSelect[],
  myActorId?: string,
) {
  if (!rows.length) return []
  const authorIds = [...new Set(rows.map((p) => p.authorId))]
  const postIds = rows.map((p) => p.id)
  const [authorMap, allMedia, myLikes, myBoosts] = await Promise.all([
    db.query.actors.findMany({ where: inArray(actors.id, authorIds) }).then((a) => new Map(a.map((x) => [x.id, x]))),
    db.query.mediaAttachments.findMany({ where: inArray(mediaAttachments.postId, postIds) }),
    myActorId ? db.query.likes.findMany({ where: and(eq(likes.actorId, myActorId), inArray(likes.postId, postIds)), columns: { postId: true } }) : [],
    myActorId ? db.query.boosts.findMany({ where: and(eq(boosts.actorId, myActorId), inArray(boosts.postId, postIds)), columns: { postId: true } }) : [],
  ])
  const mediaByPost = new Map(postIds.map((id) => [id, allMedia.filter((m) => m.postId === id)]))
  const likedSet = new Set((myLikes as { postId: string }[]).map((l) => l.postId))
  const boostedSet = new Set((myBoosts as { postId: string }[]).map((b) => b.postId))

  return rows.flatMap((p) => {
    const author = authorMap.get(p.authorId)
    if (!author) return []
    return [toMastodonStatus(p, author, {
      mediaAttachments: mediaByPost.get(p.id) ?? [],
      favourited: likedSet.has(p.id),
      reblogged: boostedSet.has(p.id),
    })]
  })
}

export async function mastodonTimelineRoutes(app: FastifyInstance) {
  // GET /api/v1/timelines/home
  app.get<{ Querystring: { limit?: string; max_id?: string; since_id?: string; min_id?: string } }>(
    '/api/v1/timelines/home',
    async (req, reply) => {
      const ctx = await requireMastodonUser(req, reply)
      if (!ctx) return
      const { limit = '20', max_id } = req.query
      const n = Math.min(Number(limit), LIMIT)

      const myFollowingIds = (await db.query.follows.findMany({
        where: and(eq(follows.followerId, ctx.actor.id), eq(follows.status, 'accepted')),
        columns: { followingId: true },
      })).map((f) => f.followingId)

      const authorIds = [ctx.actor.id, ...myFollowingIds]
      const conditions = [
        inArray(posts.authorId, authorIds),
        eq(posts.isDeleted, false),
        or(eq(posts.visibility, 'public'), eq(posts.visibility, 'unlisted'), eq(posts.visibility, 'followers')),
      ]
      if (max_id) conditions.push(lt(posts.createdAt, db.select({ t: posts.createdAt }).from(posts).where(eq(posts.id, max_id)) as unknown as Date))

      const rows = await db.query.posts.findMany({
        where: and(...conditions),
        orderBy: [desc(posts.createdAt)],
        limit: n,
      })
      return reply.send(await enrichPosts(rows, ctx.actor.id))
    },
  )

  // GET /api/v1/timelines/public
  app.get<{ Querystring: { limit?: string; max_id?: string; local?: string; remote?: string; only_media?: string } }>(
    '/api/v1/timelines/public',
    async (req, reply) => {
      const { limit = '20', max_id, local, remote } = req.query
      const n = Math.min(Number(limit), LIMIT)
      const ctx = await getMastodonUser(req)

      const conditions = [eq(posts.visibility, 'public'), eq(posts.isDeleted, false)]
      if (local === 'true') conditions.push(eq(posts.isLocal, true))
      if (remote === 'true') conditions.push(eq(posts.isLocal, false))
      if (max_id) conditions.push(sql`${posts.createdAt} < (SELECT created_at FROM posts WHERE id = ${max_id}::uuid)`)

      const rows = await db.query.posts.findMany({
        where: and(...conditions),
        orderBy: [desc(posts.createdAt)],
        limit: n,
      })
      return reply.send(await enrichPosts(rows, ctx?.actor.id))
    },
  )

  // GET /api/v1/timelines/tag/:hashtag
  app.get<{ Params: { hashtag: string }; Querystring: { limit?: string; max_id?: string } }>(
    '/api/v1/timelines/tag/:hashtag',
    async (req, reply) => {
      const { limit = '20', max_id } = req.query
      const n = Math.min(Number(limit), LIMIT)
      const tag = `#${req.params.hashtag.toLowerCase()}`
      const ctx = await getMastodonUser(req)

      const conditions = [
        eq(posts.visibility, 'public'),
        eq(posts.isDeleted, false),
        sql`${tag} = ANY(${posts.tags})`,
      ]
      if (max_id) conditions.push(sql`${posts.createdAt} < (SELECT created_at FROM posts WHERE id = ${max_id}::uuid)`)

      const rows = await db.query.posts.findMany({
        where: and(...conditions),
        orderBy: [desc(posts.createdAt)],
        limit: n,
      })
      return reply.send(await enrichPosts(rows, ctx?.actor.id))
    },
  )

  // GET /api/v1/timelines/list/:list_id
  app.get<{ Params: { list_id: string }; Querystring: { limit?: string; max_id?: string } }>(
    '/api/v1/timelines/list/:list_id',
    async (req, reply) => {
      const ctx = await requireMastodonUser(req, reply)
      if (!ctx) return
      const { lists, listMembers } = await import('../../db/schema.js')
      const list = await db.query.lists.findFirst({ where: and(eq(lists.id, req.params.list_id), eq(lists.ownerId, ctx.actor.id)) })
      if (!list) return reply.code(404).send({ error: 'Record not found' })
      const members = await db.query.listMembers.findMany({ where: eq(listMembers.listId, list.id), columns: { actorId: true } })
      const memberIds = members.map((m) => m.actorId)
      if (!memberIds.length) return reply.send([])
      const rows = await db.query.posts.findMany({
        where: and(inArray(posts.authorId, memberIds), eq(posts.isDeleted, false), eq(posts.visibility, 'public')),
        orderBy: [desc(posts.createdAt)],
        limit: Math.min(Number(req.query.limit ?? 20), LIMIT),
      })
      return reply.send(await enrichPosts(rows, ctx.actor.id))
    },
  )

  // ── Lists ─────────────────────────────────────────────────────────────────

  app.get('/api/v1/lists', async (req, reply) => {
    const ctx = await requireMastodonUser(req, reply)
    if (!ctx) return
    const { lists } = await import('../../db/schema.js')
    const myLists = await db.query.lists.findMany({ where: eq(lists.ownerId, ctx.actor.id) })
    return reply.send(myLists.map((l) => ({ id: l.id, title: l.title, replies_policy: l.repliesPolicy, exclusive: false })))
  })

  app.get<{ Params: { id: string } }>('/api/v1/lists/:id', async (req, reply) => {
    const ctx = await requireMastodonUser(req, reply)
    if (!ctx) return
    const { lists } = await import('../../db/schema.js')
    const list = await db.query.lists.findFirst({ where: and(eq(lists.id, req.params.id), eq(lists.ownerId, ctx.actor.id)) })
    if (!list) return reply.code(404).send({ error: 'Record not found' })
    return reply.send({ id: list.id, title: list.title, replies_policy: list.repliesPolicy, exclusive: false })
  })

  app.get<{ Params: { id: string } }>('/api/v1/lists/:id/accounts', async (req, reply) => {
    const ctx = await requireMastodonUser(req, reply)
    if (!ctx) return
    const { lists, listMembers } = await import('../../db/schema.js')
    const list = await db.query.lists.findFirst({ where: and(eq(lists.id, req.params.id), eq(lists.ownerId, ctx.actor.id)) })
    if (!list) return reply.code(404).send({ error: 'Record not found' })
    const members = await db.query.listMembers.findMany({ where: eq(listMembers.listId, list.id), with: { actor: true } })
    return reply.send(members.map((m) => toMastodonAccount(m.actor!)))
  })
}

