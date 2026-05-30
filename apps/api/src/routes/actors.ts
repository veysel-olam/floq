import type { FastifyInstance } from 'fastify'
import { eq, and, desc, ne, notInArray, sql, lt, inArray, or, isNull, isNotNull } from 'drizzle-orm'
import { db } from '../db/client.js'
import { actors, posts, follows, likes, boosts, closeFriends, mediaAttachments, followEvents, blocks, mutes, userCommunityBadges, apGroups } from '../db/schema.js'
import { getSession, requireActor } from '../lib/session.js'
import { notifyFollow, notifyFollowRequest } from '../lib/notify.js'
import { buildFollow, buildUndo, buildAccept, actorUrl } from '../lib/activityPub.js'
import { deliverToInbox } from '../lib/federation.js'
import { enrichPosts } from '../lib/enrichPosts.js'

export async function actorsRoutes(app: FastifyInstance) {
  // GET /api/actors/:handle — profil
  app.get<{ Params: { handle: string } }>('/api/actors/:handle', async (req, reply) => {
    const session = await getSession(req)
    let viewerActorId: string | undefined

    if (session) {
      const viewer = await db.query.actors.findFirst({
        where: eq(actors.userId, session.user.id),
      })
      viewerActorId = viewer?.id
    }

    const actor = await db.query.actors.findFirst({
      where: eq(actors.handle, req.params.handle),
    })
    if (!actor) return reply.code(404).send({ error: 'Not found' })

    let viewerFollowStatus: 'none' | 'pending' | 'accepted' = 'none'
    let viewerNotifyOnActivity = true
    let viewerIsBlocked = false
    let viewerIsMuted = false
    if (viewerActorId && viewerActorId !== actor.id) {
      const [follow, block, mute] = await Promise.all([
        db.query.follows.findFirst({
          where: and(eq(follows.followerId, viewerActorId), eq(follows.followingId, actor.id)),
        }),
        db.query.blocks.findFirst({
          where: and(eq(blocks.blockerId, viewerActorId), eq(blocks.blockedId, actor.id)),
        }),
        db.query.mutes.findFirst({
          where: and(eq(mutes.muterId, viewerActorId), eq(mutes.mutedId, actor.id)),
        }),
      ])
      if (follow) {
        viewerFollowStatus = follow.status as 'pending' | 'accepted'
        viewerNotifyOnActivity = follow.notifyOnActivity
      }
      viewerIsBlocked = !!block
      viewerIsMuted = !!mute
    }

    const [likesRow] = await db
      .select({ total: sql<number>`COALESCE(SUM(${posts.likesCount}), 0)::int` })
      .from(posts)
      .where(and(eq(posts.authorId, actor.id), eq(posts.isDeleted, false), isNull(posts.scheduledAt)))

    // Profil ziyareti sayacı — kendi profili hariç (fire-and-forget)
    if (!viewerActorId || viewerActorId !== actor.id) {
      db.update(actors)
        .set({ profileViewCount: sql`${actors.profileViewCount} + 1` })
        .where(eq(actors.id, actor.id))
        .catch(() => {})
    }

    return reply.send({
      ...actor,
      likesCount: likesRow?.total ?? 0,
      viewer: {
        following: viewerFollowStatus === 'accepted',
        followStatus: viewerFollowStatus === 'none' ? undefined : viewerFollowStatus,
        notifyOnActivity: viewerNotifyOnActivity,
        isBlocked: viewerIsBlocked,
        isMuted: viewerIsMuted,
      },
    })
  })

  // GET /api/actors/:handle/posts — profil gönderileri
  app.get<{
    Params: { handle: string }
    Querystring: { cursor?: string; limit?: string; onlyMedia?: string; onlyReplies?: string }
  }>('/api/actors/:handle/posts', async (req, reply) => {
    const session = await getSession(req)
    let viewerActorId: string | undefined
    if (session) {
      const viewer = await db.query.actors.findFirst({ where: eq(actors.userId, session.user.id) })
      viewerActorId = viewer?.id
    }

    const actor = await db.query.actors.findFirst({
      where: eq(actors.handle, req.params.handle),
    })
    if (!actor) return reply.code(404).send({ error: 'Not found' })

    const limit = Math.min(Number(req.query.limit ?? 20), 40)
    const cursor = req.query.cursor ? new Date(req.query.cursor) : undefined
    const onlyMedia = req.query.onlyMedia === 'true'
    const onlyReplies = req.query.onlyReplies === 'true'
    const isCloseFriend = viewerActorId
      ? !!(await db.query.closeFriends.findFirst({
          where: and(eq(closeFriends.actorId, actor.id), eq(closeFriends.targetId, viewerActorId)),
        }))
      : false

    const visibilityCond = (viewerActorId === actor.id || isCloseFriend)
      ? or(inArray(posts.visibility, ['public', 'unlisted', 'close_friends']))!
      : inArray(posts.visibility, ['public', 'unlisted'])

    const mediaCond = onlyMedia
      ? sql`EXISTS (SELECT 1 FROM media_attachments WHERE post_id = ${posts.id})`
      : undefined

    const conditions = [
      eq(posts.authorId, actor.id),
      eq(posts.isDeleted, false),
      isNull(posts.scheduledAt),
      visibilityCond,
      ...(mediaCond ? [mediaCond] : []),
      ...(onlyReplies ? [isNotNull(posts.replyToId)] : onlyMedia ? [] : [isNull(posts.replyToId)]),
      ...(cursor ? [lt(posts.createdAt, cursor)] : []),
    ]

    const postRows = await db.query.posts.findMany({
      where: and(...conditions),
      orderBy: [desc(posts.createdAt)],
      limit: limit + 1,
    })

    // For media-only or replies-only mode skip boosts entirely
    if (onlyMedia || onlyReplies) {
      const hasMore = postRows.length > limit
      const items = postRows.slice(0, limit)
      const enriched = await enrichPosts(items, viewerActorId)
      return reply.send({
        posts: enriched,
        nextCursor: hasMore ? items[items.length - 1]!.createdAt.toISOString() : null,
        pinnedPost: null,
      })
    }

    // Also fetch posts boosted by this actor
    const boostRows = await db
      .select({ post: posts, boostCreatedAt: boosts.createdAt })
      .from(boosts)
      .innerJoin(posts, eq(boosts.postId, posts.id))
      .where(and(
        eq(boosts.actorId, actor.id),
        eq(posts.isDeleted, false),
        isNull(posts.scheduledAt),
        eq(posts.visibility, 'public'),
        ne(posts.authorId, actor.id), // skip own posts already in postRows
        ...(cursor ? [lt(boosts.createdAt, cursor)] : []),
      ))
      .orderBy(desc(boosts.createdAt))
      .limit(limit)

    type PostWithMeta = (typeof postRows)[number] & {
      _boostedBy: typeof actor | null
      _sortTime: Date
    }

    const ownWithMeta: PostWithMeta[] = postRows.map((p) => ({
      ...p,
      _boostedBy: null,
      _sortTime: p.createdAt,
    }))
    const boostedWithMeta: PostWithMeta[] = boostRows.map((r) => ({
      ...r.post,
      _boostedBy: actor,
      _sortTime: r.boostCreatedAt,
    }))

    const allItems = [...ownWithMeta, ...boostedWithMeta]
    allItems.sort((a, b) => new Date(b._sortTime).getTime() - new Date(a._sortTime).getTime())

    // Deduplicate: if same post appears as both own and boosted, keep the own version
    const seen = new Set<string>()
    const merged: PostWithMeta[] = []
    for (const item of allItems) {
      if (!seen.has(item.id)) {
        seen.add(item.id)
        merged.push(item)
      }
    }

    const hasMore = merged.length > limit
    const items = merged.slice(0, limit)
    const enriched = await enrichPosts(items, viewerActorId)
    const withBoostAttrib = enriched.map((p, i) => ({
      ...p,
      boostedBy: items[i]?._boostedBy ?? null,
    }))

    // Fetch pinned post (only on the first page, i.e. no cursor)
    let pinnedPost = null
    if (!cursor && actor.pinnedPostId) {
      const pinnedRows = await db.query.posts.findMany({
        where: and(eq(posts.id, actor.pinnedPostId), eq(posts.isDeleted, false)),
      })
      if (pinnedRows.length > 0) {
        const [enrichedPinned] = await enrichPosts(pinnedRows, viewerActorId)
        pinnedPost = enrichedPinned ?? null
      }
    }

    return reply.send({
      actor,
      pinnedPost,
      posts: withBoostAttrib,
      nextCursor: hasMore ? items.at(-1)!._sortTime.toISOString() : null,
    })
  })

  // GET /api/actors/:handle/likes — beğenilen gönderiler
  app.get<{
    Params: { handle: string }
    Querystring: { cursor?: string; limit?: string }
  }>('/api/actors/:handle/likes', async (req, reply) => {
    const session = await getSession(req)
    let viewerActorId: string | undefined
    if (session) {
      const viewer = await db.query.actors.findFirst({ where: eq(actors.userId, session.user.id) })
      viewerActorId = viewer?.id
    }

    const actor = await db.query.actors.findFirst({
      where: eq(actors.handle, req.params.handle),
    })
    if (!actor) return reply.code(404).send({ error: 'Not found' })

    const limit = Math.min(Number(req.query.limit ?? 20), 40)
    const cursor = req.query.cursor ? new Date(req.query.cursor) : undefined

    const likeRows = await db
      .select({ post: posts, likedAt: likes.createdAt })
      .from(likes)
      .innerJoin(posts, eq(likes.postId, posts.id))
      .where(and(
        eq(likes.actorId, actor.id),
        eq(posts.isDeleted, false),
        isNull(posts.scheduledAt),
        eq(posts.visibility, 'public'),
        ...(cursor ? [lt(likes.createdAt, cursor)] : []),
      ))
      .orderBy(desc(likes.createdAt))
      .limit(limit + 1)

    const hasMore = likeRows.length > limit
    const items = likeRows.slice(0, limit).map((r) => r.post)
    const enriched = await enrichPosts(items, viewerActorId)

    return reply.send({
      posts: enriched,
      nextCursor: hasMore ? likeRows[limit - 1]!.likedAt.toISOString() : null,
    })
  })

  // GET /api/actors/:handle/followers
  app.get<{
    Params: { handle: string }
    Querystring: { cursor?: string; limit?: string }
  }>('/api/actors/:handle/followers', async (req, reply) => {
    const session = await getSession(req)
    const actor = await db.query.actors.findFirst({
      where: eq(actors.handle, req.params.handle),
    })
    if (!actor) return reply.code(404).send({ error: 'Not found' })

    const viewer = session ? await db.query.actors.findFirst({ where: eq(actors.userId, session.user.id) }) : null

    const limit = Math.min(Number(req.query.limit ?? 20), 40)
    const offset = req.query.cursor ? parseInt(req.query.cursor, 10) : 0
    const followerRows = await db.query.follows.findMany({
      where: and(eq(follows.followingId, actor.id), eq(follows.status, 'accepted')),
      with: { follower: true },
      orderBy: [desc(follows.createdAt)],
      limit: limit + 1,
      offset,
    })

    const hasMore = followerRows.length > limit
    const items = followerRows.slice(0, limit).map((f) => f.follower)

    const [countRow] = await db
      .select({ total: sql<number>`COUNT(*)::int` })
      .from(follows)
      .where(and(eq(follows.followingId, actor.id), eq(follows.status, 'accepted')))

    const total = countRow?.total ?? 0

    // Sync cached counter if drifted
    if (total !== actor.followersCount) {
      db.update(actors).set({ followersCount: total }).where(eq(actors.id, actor.id)).catch(() => {})
    }

    let viewerFollows: Set<string> = new Set()
    if (viewer && items.length > 0) {
      const viewerFollowRows = await db.query.follows.findMany({
        where: and(
          eq(follows.followerId, viewer.id),
          eq(follows.status, 'accepted'),
          inArray(follows.followingId, items.map((a) => a.id)),
        ),
        columns: { followingId: true },
      })
      viewerFollows = new Set(viewerFollowRows.map((f) => f.followingId))
    }

    return reply.send({
      actors: items.map((a) => ({
        ...a,
        viewer: viewer ? {
          following: viewerFollows.has(a.id),
          followStatus: viewerFollows.has(a.id) ? 'accepted' : null,
        } : undefined,
      })),
      total,
      nextCursor: hasMore ? String(offset + limit) : null,
    })
  })

  // GET /api/actors/:handle/following
  app.get<{
    Params: { handle: string }
    Querystring: { cursor?: string; limit?: string }
  }>('/api/actors/:handle/following', async (req, reply) => {
    const session = await getSession(req)
    const actor = await db.query.actors.findFirst({
      where: eq(actors.handle, req.params.handle),
    })
    if (!actor) return reply.code(404).send({ error: 'Not found' })

    const viewer = session ? await db.query.actors.findFirst({ where: eq(actors.userId, session.user.id) }) : null

    const limit = Math.min(Number(req.query.limit ?? 20), 40)
    const offset = req.query.cursor ? parseInt(req.query.cursor, 10) : 0

    const followingRows = await db.query.follows.findMany({
      where: and(eq(follows.followerId, actor.id), eq(follows.status, 'accepted')),
      with: { following: true },
      orderBy: [desc(follows.createdAt)],
      limit: limit + 1,
      offset,
    })

    const hasMore = followingRows.length > limit
    const items = followingRows.slice(0, limit).map((f) => f.following)

    const [countRow] = await db
      .select({ total: sql<number>`COUNT(*)::int` })
      .from(follows)
      .where(and(eq(follows.followerId, actor.id), eq(follows.status, 'accepted')))

    const total = countRow?.total ?? 0

    if (total !== actor.followingCount) {
      db.update(actors).set({ followingCount: total }).where(eq(actors.id, actor.id)).catch(() => {})
    }

    let viewerFollows: Set<string> = new Set()
    if (viewer && items.length > 0) {
      const viewerFollowRows = await db.query.follows.findMany({
        where: and(
          eq(follows.followerId, viewer.id),
          eq(follows.status, 'accepted'),
          inArray(follows.followingId, items.map((a) => a.id)),
        ),
        columns: { followingId: true },
      })
      viewerFollows = new Set(viewerFollowRows.map((f) => f.followingId))
    }

    return reply.send({
      actors: items.map((a) => ({
        ...a,
        viewer: viewer ? {
          following: viewerFollows.has(a.id),
          followStatus: viewerFollows.has(a.id) ? 'accepted' : null,
        } : undefined,
      })),
      total,
      nextCursor: hasMore ? String(offset + limit) : null,
    })
  })

  // POST /api/actors/:handle/follow
  app.post<{ Params: { handle: string } }>('/api/actors/:handle/follow', async (req, reply) => {
    const ctx = await requireActor(req, reply)
    if (!ctx) return

    const target = await db.query.actors.findFirst({
      where: eq(actors.handle, req.params.handle),
    })
    if (!target) return reply.code(404).send({ error: 'Not found' })
    if (target.id === ctx.actor.id) return reply.code(400).send({ error: 'Cannot follow self' })

    const existing = await db.query.follows.findFirst({
      where: and(eq(follows.followerId, ctx.actor.id), eq(follows.followingId, target.id)),
    })
    if (existing) return reply.code(409).send({ status: existing.status })

    const [follow] = await db
      .insert(follows)
      .values({
        followerId: ctx.actor.id,
        followingId: target.id,
        status: target.isLocked ? 'pending' : 'accepted',
      })
      .returning()

    if (follow?.status === 'accepted') {
      await Promise.all([
        db
          .update(actors)
          .set({ followingCount: sql`${actors.followingCount} + 1` })
          .where(eq(actors.id, ctx.actor.id)),
        db
          .update(actors)
          .set({ followersCount: sql`${actors.followersCount} + 1` })
          .where(eq(actors.id, target.id)),
      ])
      void notifyFollow(ctx.actor.id, target.id)
      db.insert(followEvents).values({ actorId: ctx.actor.id, targetId: target.id, type: 'follow' }).catch(() => {})
    } else if (follow?.status === 'pending') {
      void notifyFollowRequest(ctx.actor.id, target.id)
    }

    // Federate to remote target
    if (!target.isLocal && follow) {
      const followActivity = buildFollow(ctx.actor.handle, target.apId, follow.id)
      void deliverToInbox(ctx.actor.handle, target.inboxUrl, followActivity)
    }

    return reply.code(201).send({ status: follow?.status })
  })

  // DELETE /api/actors/:handle/follow
  app.delete<{ Params: { handle: string } }>('/api/actors/:handle/follow', async (req, reply) => {
    const ctx = await requireActor(req, reply)
    if (!ctx) return

    const target = await db.query.actors.findFirst({
      where: eq(actors.handle, req.params.handle),
    })
    if (!target) return reply.code(404).send({ error: 'Not found' })

    const deleted = await db
      .delete(follows)
      .where(and(eq(follows.followerId, ctx.actor.id), eq(follows.followingId, target.id)))
      .returning()

    if (deleted[0]?.status === 'accepted') {
      await Promise.all([
        db
          .update(actors)
          .set({ followingCount: sql`GREATEST(${actors.followingCount} - 1, 0)` })
          .where(eq(actors.id, ctx.actor.id)),
        db
          .update(actors)
          .set({ followersCount: sql`GREATEST(${actors.followersCount} - 1, 0)` })
          .where(eq(actors.id, target.id)),
      ])
    }

    if (deleted[0]?.status === 'accepted') {
      db.insert(followEvents).values({ actorId: ctx.actor.id, targetId: target.id, type: 'unfollow' }).catch(() => {})
    }

    // Federate unfollow to remote target
    if (!target.isLocal && deleted[0]) {
      const followActivity = buildFollow(ctx.actor.handle, target.apId, deleted[0].id)
      const undo = buildUndo(ctx.actor.handle, followActivity)
      void deliverToInbox(ctx.actor.handle, target.inboxUrl, undo)
    }

    return reply.code(204).send()
  })

  // GET /api/follows/requests — gelen bekleyen takip istekleri
  app.get('/api/follows/requests', async (req, reply) => {
    const ctx = await requireActor(req, reply)
    if (!ctx) return

    const rows = await db.query.follows.findMany({
      where: and(eq(follows.followingId, ctx.actor.id), eq(follows.status, 'pending')),
      with: { follower: true },
      orderBy: [desc(follows.createdAt)],
    })

    return reply.send({ requests: rows.map((r) => ({ id: r.id, actor: r.follower, createdAt: r.createdAt })) })
  })

  // POST /api/follows/requests/:id/accept
  app.post<{ Params: { id: string } }>('/api/follows/requests/:id/accept', async (req, reply) => {
    const ctx = await requireActor(req, reply)
    if (!ctx) return

    const follow = await db.query.follows.findFirst({
      where: and(eq(follows.id, req.params.id), eq(follows.followingId, ctx.actor.id), eq(follows.status, 'pending')),
      with: { follower: true },
    })
    if (!follow) return reply.code(404).send({ error: 'Not found' })

    await db.update(follows).set({ status: 'accepted' }).where(eq(follows.id, follow.id))

    await Promise.all([
      db.update(actors).set({ followersCount: sql`${actors.followersCount} + 1` }).where(eq(actors.id, ctx.actor.id)),
      db.update(actors).set({ followingCount: sql`${actors.followingCount} + 1` }).where(eq(actors.id, follow.followerId)),
    ])

    // Federate Accept to remote follower if needed
    if (!follow.follower.isLocal) {
      const followActivity = buildFollow(follow.follower.handle, actorUrl(ctx.actor.handle), follow.id)
      const accept = buildAccept(ctx.actor.handle, followActivity)
      void deliverToInbox(ctx.actor.handle, follow.follower.inboxUrl, accept)
    }

    return reply.code(204).send()
  })

  // POST /api/follows/requests/:id/reject
  app.post<{ Params: { id: string } }>('/api/follows/requests/:id/reject', async (req, reply) => {
    const ctx = await requireActor(req, reply)
    if (!ctx) return

    const deleted = await db
      .delete(follows)
      .where(and(eq(follows.id, req.params.id), eq(follows.followingId, ctx.actor.id), eq(follows.status, 'pending')))
      .returning()

    if (deleted.length === 0) return reply.code(404).send({ error: 'Not found' })

    return reply.code(204).send()
  })

  // POST /api/actors/:handle/follow-request/accept — actor handle ile takip isteği kabul
  app.post<{ Params: { handle: string } }>('/api/actors/:handle/follow-request/accept', async (req, reply) => {
    const ctx = await requireActor(req, reply)
    if (!ctx) return

    const follower = await db.query.actors.findFirst({ where: eq(actors.handle, req.params.handle) })
    if (!follower) return reply.code(404).send({ error: 'Not found' })

    const follow = await db.query.follows.findFirst({
      where: and(eq(follows.followerId, follower.id), eq(follows.followingId, ctx.actor.id), eq(follows.status, 'pending')),
      with: { follower: true },
    })
    if (!follow) return reply.code(404).send({ error: 'Not found' })

    await db.update(follows).set({ status: 'accepted' }).where(eq(follows.id, follow.id))

    await Promise.all([
      db.update(actors).set({ followersCount: sql`${actors.followersCount} + 1` }).where(eq(actors.id, ctx.actor.id)),
      db.update(actors).set({ followingCount: sql`${actors.followingCount} + 1` }).where(eq(actors.id, follower.id)),
    ])

    if (!follow.follower.isLocal) {
      const followActivity = buildFollow(follow.follower.handle, actorUrl(ctx.actor.handle), follow.id)
      const accept = buildAccept(ctx.actor.handle, followActivity)
      void deliverToInbox(ctx.actor.handle, follow.follower.inboxUrl, accept)
    }

    return reply.code(204).send()
  })

  // POST /api/actors/:handle/follow-request/reject — actor handle ile takip isteği reddet
  app.post<{ Params: { handle: string } }>('/api/actors/:handle/follow-request/reject', async (req, reply) => {
    const ctx = await requireActor(req, reply)
    if (!ctx) return

    const follower = await db.query.actors.findFirst({ where: eq(actors.handle, req.params.handle) })
    if (!follower) return reply.code(404).send({ error: 'Not found' })

    const deleted = await db
      .delete(follows)
      .where(and(eq(follows.followerId, follower.id), eq(follows.followingId, ctx.actor.id), eq(follows.status, 'pending')))
      .returning()

    if (deleted.length === 0) return reply.code(404).send({ error: 'Not found' })

    return reply.code(204).send()
  })

  // GET /api/actors/network — social graph (ego network: me + following + edges between them)
  app.get('/api/actors/network', async (req, reply) => {
    const ctx = await requireActor(req, reply)
    if (!ctx) return

    const myId = ctx.actor.id

    // My following list
    const myFollowing = await db.query.follows.findMany({
      where: and(eq(follows.followerId, myId), eq(follows.status, 'accepted')),
      columns: { followingId: true },
    })
    const followingIds = myFollowing.map((f) => f.followingId)
    const nodeIds = [myId, ...followingIds]

    if (nodeIds.length < 2) {
      return reply.send({ nodes: [{ id: myId, handle: ctx.actor.handle, displayName: ctx.actor.displayName, avatarUrl: ctx.actor.avatarUrl, followersCount: ctx.actor.followersCount, isSelf: true }], edges: [] })
    }

    // All actors in the ego network
    const nodeActors = await db.query.actors.findMany({
      where: (a, { inArray }) => inArray(a.id, nodeIds),
      columns: { id: true, handle: true, displayName: true, avatarUrl: true, followersCount: true },
    })

    // All follow edges between nodes in the network (limit to 500 for performance)
    const edges = await db.query.follows.findMany({
      where: and(
        inArray(follows.followerId, nodeIds),
        inArray(follows.followingId, nodeIds),
        eq(follows.status, 'accepted'),
      ),
      columns: { followerId: true, followingId: true },
      limit: 500,
    })

    const nodes = nodeActors.map((a) => ({ ...a, isSelf: a.id === myId }))

    return reply.send({ nodes, edges: edges.map((e) => ({ source: e.followerId, target: e.followingId })) })
  })

  // GET /api/actors/:handle/mutual-followers — viewer'ın takip ettiği ve hedefi de takip eden kişiler
  app.get<{ Params: { handle: string } }>('/api/actors/:handle/mutual-followers', async (req, reply) => {
    const session = await getSession(req)
    if (!session) return reply.send({ actors: [] })

    const viewer = await db.query.actors.findFirst({ where: eq(actors.userId, session.user.id) })
    if (!viewer) return reply.send({ actors: [] })

    const target = await db.query.actors.findFirst({ where: eq(actors.handle, req.params.handle) })
    if (!target || target.id === viewer.id) return reply.send({ actors: [] })

    // Viewer'ın takip ettiği kişiler arasında hedefi de takip edenler
    const rows = await db.execute(
      sql`SELECT DISTINCT a.id, a.handle, a.display_name AS "displayName", a.avatar_url AS "avatarUrl"
          FROM follows f1
          JOIN follows f2 ON f2.following_id = f1.follower_id
                          AND f2.follower_id = ${viewer.id}
                          AND f2.status = 'accepted'
          JOIN actors a ON a.id = f1.follower_id
          WHERE f1.following_id = ${target.id}
            AND f1.status = 'accepted'
            AND f1.follower_id != ${viewer.id}
          LIMIT 5`
    )
    return reply.send({ actors: (rows as unknown as { rows: unknown[] }).rows })
  })

  // GET /api/actors/suggested — onboarding için önerilen kullanıcılar
  app.get('/api/actors/suggested', async (req, reply) => {
    const session = await getSession(req)
    let excludeIds: string[] = []

    if (session) {
      const viewer = await db.query.actors.findFirst({ where: eq(actors.userId, session.user.id) })
      if (viewer) {
        const following = await db.query.follows.findMany({
          where: eq(follows.followerId, viewer.id),
          columns: { followingId: true },
        })
        excludeIds = [viewer.id, ...following.map((f) => f.followingId)]
      }
    }

    const suggested = await db.query.actors.findMany({
      where: and(
        eq(actors.isLocal, true),
        excludeIds.length > 0 ? notInArray(actors.id, excludeIds) : undefined,
      ),
      orderBy: [desc(actors.followersCount)],
      limit: 20,
    })

    return reply.send({ actors: suggested })
  })

  // POST /api/posts/:id/pin — profile'e sabitle
  app.post<{ Params: { id: string } }>('/api/posts/:id/pin', async (req, reply) => {
    const ctx = await requireActor(req, reply)
    if (!ctx) return

    const post = await db.query.posts.findFirst({
      where: and(eq(posts.id, req.params.id), eq(posts.authorId, ctx.actor.id), eq(posts.isDeleted, false)),
    })
    if (!post) return reply.code(404).send({ error: 'Post not found or not yours' })

    await db.update(actors).set({ pinnedPostId: post.id }).where(eq(actors.id, ctx.actor.id))
    return reply.send({ pinnedPostId: post.id })
  })

  // DELETE /api/posts/:id/pin — sabitliği kaldır
  app.delete<{ Params: { id: string } }>('/api/posts/:id/pin', async (req, reply) => {
    const ctx = await requireActor(req, reply)
    if (!ctx) return

    if (ctx.actor.pinnedPostId !== req.params.id) {
      return reply.code(400).send({ error: 'Post is not pinned' })
    }

    await db.update(actors).set({ pinnedPostId: null }).where(eq(actors.id, ctx.actor.id))
    return reply.code(204).send()
  })

  // PATCH /api/actors/:handle/notify — takip edilen kişiden bildirim al/alma toggle
  app.patch<{ Params: { handle: string }; Body: { notify: boolean } }>(
    '/api/actors/:handle/notify',
    async (req, reply) => {
      const ctx = await requireActor(req, reply)
      if (!ctx) return

      const target = await db.query.actors.findFirst({ where: eq(actors.handle, req.params.handle) })
      if (!target) return reply.code(404).send({ error: 'Not found' })

      const result = await db
        .update(follows)
        .set({ notifyOnActivity: req.body.notify })
        .where(and(eq(follows.followerId, ctx.actor.id), eq(follows.followingId, target.id)))
        .returning({ notifyOnActivity: follows.notifyOnActivity })

      if (result.length === 0) return reply.code(404).send({ error: 'Not following' })
      return reply.send({ notifyOnActivity: result[0]!.notifyOnActivity })
    },
  )

  // GET /api/actors/me/social-stats
  app.get('/api/actors/me/social-stats', async (req, reply) => {
    const ctx = await requireActor(req, reply)
    if (!ctx) return
    const myId = ctx.actor.id

    const ACTOR_COLS = { id: true, handle: true, displayName: true, avatarUrl: true, isLocal: true } as const

    // Recent unfollowers (last 90 days) — people who unfollowed ME
    const unfollowerEvents = await db.query.followEvents.findMany({
      where: and(
        eq(followEvents.targetId, myId),
        eq(followEvents.type, 'unfollow'),
        sql`${followEvents.createdAt} > now() - interval '90 days'`,
      ),
      orderBy: [desc(followEvents.createdAt)],
      limit: 30,
      with: { actor: { columns: ACTOR_COLS } },
    })
    // Exclude those who re-followed after unfollowing
    const currentFollowerIds = new Set(
      (await db.query.follows.findMany({
        where: and(eq(follows.followingId, myId), eq(follows.status, 'accepted')),
        columns: { followerId: true },
      })).map((f) => f.followerId),
    )
    const unfollowers = unfollowerEvents
      .filter((e) => !currentFollowerIds.has(e.actorId))
      .map((e) => ({ actor: e.actor, unfollowedAt: e.createdAt }))

    // Not following back — I follow them, they don't follow me
    const iFollow = await db.query.follows.findMany({
      where: and(eq(follows.followerId, myId), eq(follows.status, 'accepted')),
      columns: { followingId: true },
    })
    const iFollowIds = iFollow.map((f) => f.followingId)
    const theyFollowMeBack = iFollowIds.length > 0
      ? new Set((await db.query.follows.findMany({
          where: and(
            inArray(follows.followerId, iFollowIds),
            eq(follows.followingId, myId),
            eq(follows.status, 'accepted'),
          ),
          columns: { followerId: true },
        })).map((f) => f.followerId))
      : new Set<string>()
    const notFollowingBack = iFollowIds.length > 0
      ? await db.query.actors.findMany({
          where: (a, { inArray, notInArray }) => and(
            inArray(a.id, iFollowIds),
            notInArray(a.id, [...theyFollowMeBack]),
          ),
          columns: ACTOR_COLS,
          limit: 50,
        })
      : []

    // Not followed back — they follow me, I don't follow them
    const followsMeRows = await db.query.follows.findMany({
      where: and(eq(follows.followingId, myId), eq(follows.status, 'accepted')),
      columns: { followerId: true, createdAt: true },
      orderBy: [desc(follows.createdAt)],
      limit: 100,
    })
    const iFollowSet = new Set(iFollowIds)
    const notFollowedBack = followsMeRows
      .filter((f) => !iFollowSet.has(f.followerId))
      .slice(0, 50)
    const notFollowedBackActors = notFollowedBack.length > 0
      ? await db.query.actors.findMany({
          where: (a, { inArray }) => inArray(a.id, notFollowedBack.map((f) => f.followerId)),
          columns: ACTOR_COLS,
        })
      : []

    // Recent followers (last 30)
    const recentFollowerRows = await db.query.follows.findMany({
      where: and(eq(follows.followingId, myId), eq(follows.status, 'accepted')),
      orderBy: [desc(follows.createdAt)],
      limit: 30,
      with: { follower: { columns: ACTOR_COLS } },
    })
    const recentFollowers = recentFollowerRows.map((f) => ({
      actor: f.follower,
      followedAt: f.createdAt,
      isFollowing: iFollowSet.has(f.follower.id),
    }))

    return reply.send({
      unfollowers,
      notFollowingBack: notFollowingBack,
      notFollowedBack: notFollowedBackActors,
      recentFollowers,
      counts: {
        unfollowers: unfollowers.length,
        notFollowingBack: notFollowingBack.length,
        notFollowedBack: notFollowedBackActors.length,
      },
    })
  })

  // GET /api/location/:name/posts — bu konumdaki public gönderiler
  app.get<{ Params: { name: string }; Querystring: { cursor?: string } }>('/api/location/:name/posts', async (req, reply) => {
    const session = await getSession(req)
    let actorId: string | undefined
    if (session) {
      const viewer = await db.query.actors.findFirst({ where: eq(actors.userId, session.user.id), columns: { id: true } })
      actorId = viewer?.id
    }
    const { name } = req.params
    const cursor = req.query.cursor ? new Date(req.query.cursor) : undefined

    const rows = await db.query.posts.findMany({
      where: and(
        sql`LOWER(${posts.locationName}) = LOWER(${name})`,
        eq(posts.visibility, 'public'),
        eq(posts.isDeleted, false),
        eq(posts.isDraft, false),
        isNull(posts.scheduledAt),
        cursor ? lt(posts.createdAt, cursor) : undefined,
      ),
      orderBy: [desc(posts.createdAt)],
      limit: 20,
    })

    const enriched = await enrichPosts(rows, actorId)
    const nextCursor = rows.length === 20 ? rows[rows.length - 1]!.createdAt.toISOString() : null
    return reply.send({ posts: enriched, nextCursor })
  })

  // GET /api/actors/:handle/community-badges — public community badge list for profile
  app.get<{ Params: { handle: string } }>('/api/actors/:handle/community-badges', async (req, reply) => {
    const actor = await db.query.actors.findFirst({
      where: eq(actors.handle, req.params.handle),
    })
    if (!actor) return reply.code(404).send({ error: 'Not found' })

    const awarded = await db.query.userCommunityBadges.findMany({
      where: eq(userCommunityBadges.actorId, actor.id),
      with: { badge: true },
      orderBy: (ub, { desc }) => [desc(ub.awardedAt)],
    })

    // Enrich each badge entry with the community info (name + handle)
    const communityIds = [...new Set(awarded.map((ub) => ub.communityId))]
    const communityGroupRows = communityIds.length
      ? await db.query.apGroups.findMany({
          where: inArray(apGroups.id, communityIds),
          columns: { id: true, actorId: true },
        })
      : []
    const actorIds = communityGroupRows.map((g) => g.actorId)
    const communityActors = actorIds.length
      ? await db.query.actors.findMany({
          where: inArray(actors.id, actorIds),
          columns: { id: true, handle: true, displayName: true, avatarUrl: true },
        })
      : []
    const actorById = new Map(communityActors.map((a) => [a.id, a]))
    const communityByGroupId = new Map(communityGroupRows.map((g) => [g.id, actorById.get(g.actorId)]))

    return reply.send(awarded.map((ub) => ({
      id: ub.badge.id,
      name: ub.badge.name,
      icon: ub.badge.icon,
      color: ub.badge.color,
      description: ub.badge.description,
      awardedAt: ub.awardedAt,
      community: communityByGroupId.get(ub.communityId) ?? null,
    })))
  })

  // GET /api/actors/:handle/activity — 52 haftalık gönderi aktivitesi
  app.get<{ Params: { handle: string } }>('/api/actors/:handle/activity', async (req, reply) => {
    const actor = await db.query.actors.findFirst({
      where: eq(actors.handle, req.params.handle),
    })
    if (!actor) return reply.code(404).send({ error: 'Not found' })

    const rows = await db
      .select({
        day: sql<string>`DATE(${posts.createdAt})::text`,
        count: sql<number>`COUNT(*)::int`,
      })
      .from(posts)
      .where(
        and(
          eq(posts.authorId, actor.id),
          eq(posts.isDeleted, false),
          isNull(posts.scheduledAt),
          sql`${posts.createdAt} >= NOW() - INTERVAL '364 days'`,
        ),
      )
      .groupBy(sql`DATE(${posts.createdAt})`)
      .orderBy(sql`DATE(${posts.createdAt})`)

    return reply.send({ activity: rows })
  })
}
