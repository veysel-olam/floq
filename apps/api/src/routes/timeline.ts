import type { FastifyInstance } from 'fastify'
import { eq, and, inArray, lt, isNull, desc, sql, ne, arrayContains, or } from 'drizzle-orm'
import { db } from '../db/client.js'
import { posts, follows, actors, feedRules, lists, listMembers, boosts, closeFriends, actorPreferences, hashtagFollows, apGroups } from '../db/schema.js'
import { getSession, requireActor } from '../lib/session.js'
import { DEFAULT_RULES, type FeedRulesConfig, HOT_SCORE_SQL, RISING_SCORE_SQL, MIXED_SCORE_SQL } from '../lib/feedRules.js'
import { enrichPosts } from '../lib/enrichPosts.js'

const DEFAULT_LIMIT = 20
const MAX_LIMIT = 40

export async function timelineRoutes(app: FastifyInstance) {
  // GET /api/timeline/home — takip edilenlerin gönderileri (feed rules destekli)
  app.get<{ Querystring: { cursor?: string; limit?: string; ruleId?: string; sort?: string } }>(
    '/api/timeline/home',
    async (req, reply) => {
      const ctx = await requireActor(req, reply)
      if (!ctx) return

      const limit = Math.min(Number(req.query.limit ?? DEFAULT_LIMIT), MAX_LIMIT)

      // Load active feed rule
      let rule: FeedRulesConfig = DEFAULT_RULES
      if (req.query.ruleId) {
        const found = await db.query.feedRules.findFirst({
          where: and(eq(feedRules.id, req.query.ruleId), eq(feedRules.actorId, ctx.actor.id)),
        })
        if (found) rule = found.rules as FeedRulesConfig
      } else {
        const defaultRule = await db.query.feedRules.findFirst({
          where: and(eq(feedRules.actorId, ctx.actor.id), eq(feedRules.isDefault, true)),
        })
        if (defaultRule) rule = defaultRule.rules as FeedRulesConfig
      }

      // Allow explicit sort override via query param
      const VALID_SORTS = new Set(['chronological', 'engagement', 'mixed', 'hot', 'rising', 'top_day'])
      if (req.query.sort && VALID_SORTS.has(req.query.sort)) {
        rule = { ...rule, sort: req.query.sort as FeedRulesConfig['sort'] }
      }

      // Load user preferences (non-blocking default on miss)
      const prefs = await db.query.actorPreferences.findFirst({
        where: eq(actorPreferences.actorId, ctx.actor.id),
      })

      // Build source IDs
      const sourceIds: string[] = [ctx.actor.id]
      let followingIds: string[] = []
      if (rule.sources.following) {
        const followingRows = await db.query.follows.findMany({
          where: and(eq(follows.followerId, ctx.actor.id), eq(follows.status, 'accepted')),
        })
        followingIds = followingRows.map((f) => f.followingId)
        sourceIds.push(...followingIds)
      }
      if (rule.sources.lists.length > 0) {
        const memberRows = await db.query.listMembers.findMany({
          where: inArray(listMembers.listId, rule.sources.lists),
        })
        for (const m of memberRows) {
          if (!sourceIds.includes(m.actorId)) sourceIds.push(m.actorId)
        }
      }

      // Apply bot filter and min account age filter to sourceIds (never remove own actor)
      if (prefs && (prefs.filterBots || prefs.minAccountAgeFilter > 0)) {
        const candidateIds = sourceIds.filter((id) => id !== ctx.actor.id)
        if (candidateIds.length > 0) {
          let actorCondition = inArray(actors.id, candidateIds)
          if (prefs.filterBots) actorCondition = and(actorCondition, eq(actors.isBot, false))!
          if (prefs.minAccountAgeFilter > 0) {
            const cutoff = new Date()
            cutoff.setDate(cutoff.getDate() - prefs.minAccountAgeFilter)
            actorCondition = and(actorCondition, lt(actors.createdAt, cutoff))!
          }
          const allowed = await db.query.actors.findMany({ where: actorCondition, columns: { id: true } })
          const allowedIds = new Set(allowed.map((a) => a.id))
          sourceIds.length = 0
          sourceIds.push(ctx.actor.id)
          for (const id of candidateIds) { if (allowedIds.has(id)) sourceIds.push(id) }
          followingIds = followingIds.filter((id) => allowedIds.has(id))
        }
      }

      // Load followed hashtags
      const followedHashtagRows = await db.query.hashtagFollows.findMany({
        where: eq(hashtagFollows.actorId, ctx.actor.id),
      })
      const followedTags = followedHashtagRows.map((r) => r.hashtag)

      // Authors who have added the viewer as a close friend
      const cfRows = await db.query.closeFriends.findMany({
        where: and(eq(closeFriends.targetId, ctx.actor.id), inArray(closeFriends.actorId, sourceIds)),
        columns: { actorId: true },
      })
      const cfAuthorIds = cfRows.map((r) => r.actorId)

      // Visibility: public/unlisted OR close_friends (if viewer is in author's list)
      const visibilityCondition = cfAuthorIds.length > 0
        ? or(
            inArray(posts.visibility, ['public', 'unlisted']),
            and(eq(posts.visibility, 'close_friends'), inArray(posts.authorId, cfAuthorIds)),
          )!
        : inArray(posts.visibility, ['public', 'unlisted'])

      // Build base conditions
      // Followed-users branch respects visibility (incl. close_friends)
      const followedUsersCondition = and(inArray(posts.authorId, sourceIds), visibilityCondition)!

      // Hashtag branch: only public posts from anyone
      const hashtagCondition = followedTags.length > 0
        ? and(
            eq(posts.visibility, 'public'),
            sql`${posts.tags} && ARRAY[${sql.join(followedTags.map((t) => sql`${t}`), sql`, `)}]::text[]`,
          )
        : null

      // Community posts: üye olunan toplulukların gönderileri
      const memberGroupFollows = await db.query.follows.findMany({
        where: and(eq(follows.followerId, ctx.actor.id), eq(follows.status, 'accepted')),
      })
      const memberGroupActorIds = memberGroupFollows.map((f) => f.followingId)
      const communityActors = memberGroupActorIds.length
        ? await db.query.actors.findMany({
            where: and(inArray(actors.id, memberGroupActorIds), eq(actors.actorType, 'Group')),
            columns: { id: true },
          })
        : []
      const communityActorIds = communityActors.map((a) => a.id)

      const communityCondition = communityActorIds.length > 0
        ? and(inArray(posts.groupId, communityActorIds), eq(posts.isDeleted, false))
        : null

      const sourceCondition = [hashtagCondition, communityCondition, followedUsersCondition]
        .filter(Boolean)
        .reduce((acc, c) => acc ? or(acc, c!)! : c!)!


      const conditions = [
        sourceCondition,
        eq(posts.isDeleted, false),
        isNull(posts.scheduledAt),
      ]
      if (rule.hideReplies) conditions.push(isNull(posts.replyToId))

      // Preference-based content filters
      if (prefs?.nsfwMode === 'hide') conditions.push(eq(posts.sensitive, false))
      if (prefs?.hideShortVideos) conditions.push(eq(posts.isEphemeral, false))
      if (prefs?.preferredLanguages && prefs.preferredLanguages.length > 0) {
        conditions.push(or(isNull(posts.language), inArray(posts.language, prefs.preferredLanguages))!)
      }

      if (rule.sort === 'chronological') {
        const cursor = req.query.cursor ? new Date(req.query.cursor) : undefined
        if (cursor) conditions.push(lt(posts.createdAt, cursor))

        const postList = await db.query.posts.findMany({
          where: and(...conditions),
          orderBy: [desc(posts.createdAt)],
          limit: limit + 1,
        })

        // Also fetch posts recently boosted by followed users (skip if user hid boosts)
        const boostedItems: (typeof postList[0] & { _boostedBy?: typeof actors.$inferSelect })[] = []
        if (!prefs?.hideBoosts && followingIds.length > 0) {
          const boostConditions = [
            inArray(boosts.actorId, followingIds),
            eq(posts.isDeleted, false),
            isNull(posts.scheduledAt),
            inArray(posts.visibility, ['public', 'unlisted']),
            ne(posts.authorId, ctx.actor.id), // don't re-show your own posts via boost
            ...(cursor ? [lt(boosts.createdAt, cursor)] : []),
          ]
          const boostRows = await db
            .select({ boost: boosts, post: posts, booster: actors })
            .from(boosts)
            .innerJoin(posts, eq(boosts.postId, posts.id))
            .innerJoin(actors, eq(boosts.actorId, actors.id))
            .where(and(...boostConditions))
            .orderBy(desc(boosts.createdAt))
            .limit(limit)
          for (const row of boostRows) {
            boostedItems.push({ ...row.post, _boostedBy: row.booster })
          }
        }

        // Merge: regular posts + boosted posts, deduplicate by post.id, sort by time
        const seenIds = new Set<string>()
        const merged: typeof boostedItems = []
        const allItems = [...postList.map(p => ({ ...p } as typeof boostedItems[0])), ...boostedItems]
        allItems.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
        for (const item of allItems) {
          if (!seenIds.has(item.id)) {
            seenIds.add(item.id)
            merged.push(item)
          }
        }

        const hasMore = merged.length > limit
        const items = merged.slice(0, limit)
        const enriched = await enrichPosts(items, ctx.actor.id)
        const withBoostAttrib = enriched.map((p, i) => ({
          ...p,
          boostedBy: items[i]?._boostedBy ?? null,
        }))

        return reply.send({
          posts: withBoostAttrib,
          nextCursor: hasMore ? items.at(-1)?.createdAt.toISOString() : null,
          sort: rule.sort,
        })
      }

      // Scored sorts: offset-based pagination
      const offset = req.query.cursor ? parseInt(req.query.cursor, 10) : 0

      if (rule.sort === 'top_day') {
        conditions.push(sql`${posts.createdAt} > NOW() - INTERVAL '24 hours'`)
      }

      const scoreExpr =
        rule.sort === 'hot'
          ? sql.raw(HOT_SCORE_SQL)
          : rule.sort === 'rising'
          ? sql.raw(RISING_SCORE_SQL)
          : rule.sort === 'mixed'
          ? sql.raw(MIXED_SCORE_SQL)
          : sql`${posts.likesCount} + ${posts.boostsCount} * 2 + ${posts.repliesCount} * 3`

      const postList = await db.query.posts.findMany({
        where: and(...conditions),
        orderBy: [desc(scoreExpr), desc(posts.createdAt)],
        limit: limit + 1,
        offset,
      })
      const hasMore = postList.length > limit
      const items = postList.slice(0, limit)
      const enriched = await enrichPosts(items, ctx.actor.id)

      return reply.send({
        posts: enriched,
        nextCursor: hasMore ? String(offset + limit) : null,
        sort: rule.sort,
      })
    },
  )

  // GET /api/timeline/list/:id — liste timeline'ı
  app.get<{ Params: { id: string }; Querystring: { cursor?: string; limit?: string } }>(
    '/api/timeline/list/:id',
    async (req, reply) => {
      const ctx = await requireActor(req, reply)
      if (!ctx) return

      const list = await db.query.lists.findFirst({
        where: and(eq(lists.id, req.params.id), eq(lists.ownerId, ctx.actor.id)),
      })
      if (!list) return reply.code(404).send({ error: 'Not found' })

      const members = await db.query.listMembers.findMany({
        where: eq(listMembers.listId, req.params.id),
      })
      if (members.length === 0) {
        return reply.send({ list, posts: [], nextCursor: null })
      }

      const memberIds = members.map((m) => m.actorId)
      const limit = Math.min(Number(req.query.limit ?? DEFAULT_LIMIT), MAX_LIMIT)
      const cursor = req.query.cursor ? new Date(req.query.cursor) : undefined

      const conditions = [
        inArray(posts.authorId, memberIds),
        eq(posts.isDeleted, false),
        isNull(posts.scheduledAt),
        eq(posts.visibility, 'public'),
      ]
      if (cursor) conditions.push(lt(posts.createdAt, cursor))

      const postList = await db.query.posts.findMany({
        where: and(...conditions),
        orderBy: [desc(posts.createdAt)],
        limit: limit + 1,
      })
      const hasMore = postList.length > limit
      const items = postList.slice(0, limit)
      const enriched = await enrichPosts(items, ctx.actor.id)

      return reply.send({
        list,
        posts: enriched,
        nextCursor: hasMore ? items.at(-1)?.createdAt.toISOString() : null,
      })
    },
  )

  // GET /api/timeline/explore — herkese açık gönderiler
  // ?feed=local   → sadece bu instance'dan gönderiler
  // ?feed=federated → uzak instance'lardan gönderiler
  // (varsayılan: tümü)
  app.get<{ Querystring: { cursor?: string; limit?: string; feed?: string } }>(
    '/api/timeline/explore',
    async (req, reply) => {
      const session = await getSession(req)
      let actorId: string | undefined
      let viewerIsMinor = false

      if (session) {
        const actor = await db.query.actors.findFirst({
          where: eq(actors.userId, session.user.id),
        })
        actorId = actor?.id
        viewerIsMinor = actor?.isMinor ?? false
      }

      const limit = Math.min(Number(req.query.limit ?? DEFAULT_LIMIT), MAX_LIMIT)
      const cursor = req.query.cursor ? new Date(req.query.cursor) : undefined
      const feed = req.query.feed // 'local' | 'federated' | undefined

      const conditions = [eq(posts.visibility, 'public'), eq(posts.isDeleted, false), isNull(posts.scheduledAt)]
      // Restricted mode: minors (13-17) don't see sensitive/NSFW content.
      if (viewerIsMinor) conditions.push(eq(posts.sensitive, false))
      if (cursor) conditions.push(lt(posts.createdAt, cursor))
      if (feed === 'local') conditions.push(eq(posts.isLocal, true))
      if (feed === 'federated') conditions.push(eq(posts.isLocal, false))

      const postList = await db.query.posts.findMany({
        where: and(...conditions),
        orderBy: [desc(posts.createdAt)],
        limit: limit + 1,
      })

      const hasMore = postList.length > limit
      const items = postList.slice(0, limit)
      const enriched = await enrichPosts(items, actorId)

      return reply.send({
        posts: enriched,
        nextCursor: hasMore ? items.at(-1)?.createdAt.toISOString() : null,
      })
    },
  )

  // GET /api/timeline/hashtag/:tag — hashtag feed
  app.get<{ Params: { tag: string }; Querystring: { cursor?: string; limit?: string } }>(
    '/api/timeline/hashtag/:tag',
    async (req, reply) => {
      const session = await getSession(req)
      let actorId: string | undefined
      if (session) {
        const viewer = await db.query.actors.findFirst({ where: eq(actors.userId, session.user.id) })
        actorId = viewer?.id
      }

      const tag = req.params.tag.toLowerCase()
      const limit = Math.min(Number(req.query.limit ?? DEFAULT_LIMIT), MAX_LIMIT)
      const cursor = req.query.cursor ? new Date(req.query.cursor) : undefined

      const conditions = [
        eq(posts.visibility, 'public'),
        eq(posts.isDeleted, false),
        isNull(posts.scheduledAt),
        arrayContains(posts.tags, [tag]),
        ...(cursor ? [lt(posts.createdAt, cursor)] : []),
      ]

      const postList = await db.query.posts.findMany({
        where: and(...conditions),
        orderBy: [desc(posts.createdAt)],
        limit: limit + 1,
      })

      const hasMore = postList.length > limit
      const items = postList.slice(0, limit)
      const enriched = await enrichPosts(items, actorId)

      return reply.send({
        tag,
        posts: enriched,
        nextCursor: hasMore ? items.at(-1)?.createdAt.toISOString() : null,
      })
    },
  )
}
