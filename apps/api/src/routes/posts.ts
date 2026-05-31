import type { FastifyInstance } from 'fastify'
import { createHash, randomUUID } from 'node:crypto'
import { eq, and, sql, inArray, lt, gt, desc, isNull, isNotNull } from 'drizzle-orm'
import { z } from 'zod'
import { db } from '../db/client.js'
import { posts, actors, likes, boosts, bookmarks, bookmarkCollections, closeFriends, mediaAttachments, polls, pollOptions, reactions, postEdits, customEmojis, actorPreferences, follows, apGroups, communityTrustRecord, type TrustLevel } from '../db/schema.js'
import { requireActor, getSession } from '../lib/session.js'
import { env } from '../lib/env.js'
import { notifyLike, notifyBoost, notifyReply, notifyThreadParticipants } from '../lib/notify.js'
import { buildNote, buildQuestion, buildCreate, buildDelete, buildUpdateNote, buildEmojiReact, buildUndo } from '../lib/activityPub.js'
import { deliverToFollowers, deliverToInbox } from '../lib/federation.js'
import { crosspostToBluesky } from '../lib/bluesky.js'
import { crosspostToNostr } from '../lib/nostr.js'
import { resolveRemoteThread } from '../lib/ingest.js'
import { publish } from '../lib/pubsub.js'
import { enrichPosts } from '../lib/enrichPosts.js'
import { schedulePostPublish, schedulerQueue } from '../jobs/scheduler.js'
import { extractFirstUrl, fetchLinkPreview } from '../lib/linkPreview.js'

const createPostSchema = z.object({
  content: z.string().min(0).max(500),
  visibility: z.enum(['public', 'unlisted', 'followers', 'close_friends', 'direct']).default('public'),
  contentWarning: z.string().max(500).optional(),
  sensitive: z.boolean().default(false),
  replyToId: z.string().uuid().optional(),
  mediaIds: z.array(z.string().uuid()).max(4).optional(),
  quotedPostId: z.string().uuid().optional(),
  poll: z.object({
    options: z.array(z.string().min(1).max(100)).min(2).max(4),
    durationHours: z.number().int().min(1).max(168),
    multipleChoice: z.boolean().default(false),
  }).optional(),
  scheduledAt: z.string().datetime().optional(),
  isDraft: z.boolean().optional(),
  locationName: z.string().max(200).optional(),
  locationLat: z.number().optional(),
  locationLng: z.number().optional(),
  groupHandle: z.string().optional(), // topluluk handle'ı (e.g. "yazilim")
  templateData: z.record(z.string(), z.string().max(2000)).optional(),
  flairId: z.string().uuid().optional(),
}).refine((d) => d.content.trim().length > 0 || (d.mediaIds?.length ?? 0) > 0 || d.quotedPostId || d.poll, {
  message: 'content or media or quotedPostId or poll required',
})

export async function postsRoutes(app: FastifyInstance) {
  // POST /api/posts — gönderi oluştur
  app.post('/api/posts', { config: { rateLimit: { max: 30, timeWindow: '1 minute' } } }, async (req, reply) => {
    const ctx = await requireActor(req, reply)
    if (!ctx) return

    const body = createPostSchema.safeParse(req.body)
    if (!body.success) {
      return reply.code(400).send({ error: 'Invalid body', issues: body.error.issues })
    }

    const { content, visibility, contentWarning, sensitive, replyToId, mediaIds, quotedPostId, poll, scheduledAt, isDraft, locationName, locationLat, locationLng, groupHandle, templateData, flairId } = body.data
    const tags = [...new Set((content.match(/#([a-zA-ZğüşıöçĞÜŞİÖÇ0-9_]+)/g) ?? []).map((t) => t.slice(1).toLowerCase()))]
    const { actor } = ctx

    // allowReplyFrom check
    if (replyToId) {
      const parentPost = await db.query.posts.findFirst({ where: eq(posts.id, replyToId), columns: { authorId: true } })
      if (parentPost && parentPost.authorId !== actor.id) {
        const authorPrefs = await db.query.actorPreferences.findFirst({
          where: eq(actorPreferences.actorId, parentPost.authorId),
          columns: { allowReplyFrom: true },
        })
        if (authorPrefs?.allowReplyFrom === 'nobody') {
          return reply.code(403).send({ error: 'Bu kullanıcı yanıtları kapatmış.' })
        }
        if (authorPrefs?.allowReplyFrom === 'followers') {
          const isFollowing = await db.query.follows.findFirst({
            where: and(eq(follows.followerId, actor.id), eq(follows.followingId, parentPost.authorId), eq(follows.status, 'accepted')),
          })
          if (!isFollowing) return reply.code(403).send({ error: 'Bu kullanıcı sadece takipçilerinden yanıt kabul ediyor.' })
        }
      }
    }

    // Thread root bulma
    let rootId: string | undefined
    if (replyToId) {
      const parent = await db.query.posts.findFirst({ where: eq(posts.id, replyToId) })
      rootId = parent?.rootId ?? replyToId
    }

    const scheduledDate = scheduledAt && new Date(scheduledAt).getTime() > Date.now() ? new Date(scheduledAt) : undefined

    // Yinelenen gönderi tespiti — aynı yazar aynı içeriği aynı bağlamda son 5 dk içinde paylaştıysa engelle
    if (content.trim() && !isDraft && !scheduledDate) {
      const dup = await db.query.posts.findFirst({
        where: and(
          eq(posts.authorId, actor.id),
          eq(posts.content, content),
          eq(posts.isDeleted, false),
          replyToId ? eq(posts.replyToId, replyToId) : isNull(posts.replyToId),
          gt(posts.createdAt, new Date(Date.now() - 5 * 60 * 1000)),
        ),
        columns: { id: true },
      })
      if (dup) {
        return reply.code(409).send({ error: 'Aynı içeriği az önce paylaştın — çift gönderim engellendi.' })
      }
    }

    // Resolve group actor
    let resolvedGroupId: string | null = null
    if (groupHandle) {
      const groupActor = await db.query.actors.findFirst({
        where: and(eq(actors.handle, groupHandle), eq(actors.actorType, 'Group')),
      })
      if (!groupActor) return reply.code(404).send({ error: 'Topluluk bulunamadı' })

      // Must be a member
      const membership = await db.query.follows.findFirst({
        where: and(
          eq(follows.followerId, actor.id),
          eq(follows.followingId, groupActor.id),
          eq(follows.status, 'accepted'),
        ),
      })
      const group = await db.query.apGroups.findFirst({ where: eq(apGroups.actorId, groupActor.id) })
      if (!membership && group?.ownerId !== actor.id) {
        return reply.code(403).send({ error: 'Bu topluluğun üyesi değilsiniz' })
      }

      resolvedGroupId = groupActor.id
    }

    const postId = randomUUID()
    const apId = `${env.APP_URL}/users/${actor.handle}/posts/${postId}`

    const [post] = await db
      .insert(posts)
      .values({
        id: postId,
        authorId: actor.id,
        content,
        contentHash: hashContent(content),
        visibility,
        contentWarning: contentWarning ?? null,
        sensitive,
        replyToId: replyToId ?? null,
        rootId: rootId ?? null,
        quotedPostId: quotedPostId ?? null,
        tags,
        isLocal: true,
        apId,
        apUrl: apId,
        scheduledAt: scheduledDate ?? null,
        isDraft: isDraft ?? false,
        locationName: locationName ?? null,
        locationLat: locationLat ?? null,
        locationLng: locationLng ?? null,
        groupId: resolvedGroupId,
        templateData: templateData ?? null,
        flairId: flairId ?? null,
      })
      .returning()

    // Medya eklentilerini bağla
    if (mediaIds?.length) {
      await db
        .update(mediaAttachments)
        .set({ postId: post!.id })
        .where(and(
          eq(mediaAttachments.actorId, actor.id),
          inArray(mediaAttachments.id, mediaIds),
        ))
    }

    // postsCount güncelle
    await db
      .update(actors)
      .set({ postsCount: sql`${actors.postsCount} + 1` })
      .where(eq(actors.id, actor.id))

    // community postCount + trust record güncelle
    if (resolvedGroupId) {
      await db.update(apGroups)
        .set({ postCount: sql`${apGroups.postCount} + 1` })
        .where(eq(apGroups.actorId, resolvedGroupId))

      const group = await db.query.apGroups.findFirst({ where: eq(apGroups.actorId, resolvedGroupId), columns: { id: true } })
      if (group) {
        const [record] = await db
          .insert(communityTrustRecord)
          .values({ communityId: group.id, actorId: actor.id, postCount: 1 })
          .onConflictDoUpdate({
            target: [communityTrustRecord.communityId, communityTrustRecord.actorId],
            set: { postCount: sql`${communityTrustRecord.postCount} + 1`, updatedAt: sql`NOW()` },
          })
          .returning({ postCount: communityTrustRecord.postCount })
        const newCount = record?.postCount ?? 1
        const trustLevel: TrustLevel = newCount >= 100 ? 'veteran' : newCount >= 50 ? 'trusted' : newCount >= 20 ? 'regular' : newCount >= 5 ? 'member' : 'new'
        await db.update(communityTrustRecord)
          .set({ trustLevel })
          .where(and(eq(communityTrustRecord.communityId, group.id), eq(communityTrustRecord.actorId, actor.id)))
      }
    }

    // Scheduled post: queue for later publish, skip immediate actions
    if (scheduledDate) {
      await schedulePostPublish(post!.id, scheduledDate)
      const [enrichedScheduled] = await enrichPosts([{ ...post!, apId }], ctx.actor.id)
      return reply.code(202).send({ ...enrichedScheduled, scheduledAt: scheduledDate.toISOString() })
    }

    // Draft: save without publishing
    if (isDraft) {
      const [enrichedDraft] = await enrichPosts([{ ...post!, apId }], ctx.actor.id)
      return reply.code(201).send(enrichedDraft)
    }

    // Poll oluştur
    if (poll) {
      const expiresAt = new Date(Date.now() + poll.durationHours * 3600 * 1000)
      const [createdPoll] = await db
        .insert(polls)
        .values({ postId: post!.id, multipleChoice: poll.multipleChoice, expiresAt })
        .returning()
      await db.insert(pollOptions).values(
        poll.options.map((text, i) => ({ pollId: createdPoll!.id, text, position: i })),
      )
    }

    // Alıntı sayacı
    if (quotedPostId) {
      await db
        .update(posts)
        .set({ quotesCount: sql`${posts.quotesCount} + 1` })
        .where(eq(posts.id, quotedPostId))
    }

    // Yanıt sayacı + bildirim
    if (replyToId) {
      await db
        .update(posts)
        .set({ repliesCount: sql`${posts.repliesCount} + 1` })
        .where(eq(posts.id, replyToId))
      void notifyReply(actor.id, post!.id, replyToId)
      void notifyThreadParticipants({ actorId: actor.id, replyPostId: post!.id, rootId: rootId ?? replyToId, parentPostId: replyToId })
    }

    // Push SSE event to local followers
    if (body.data.visibility === 'public' || body.data.visibility === 'unlisted') {
      const localFollowers = await db.query.follows.findMany({
        where: and(eq(follows.followingId, actor.id), eq(follows.status, 'accepted')),
        with: { follower: { columns: { userId: true, isLocal: true } } },
      })
      for (const f of localFollowers) {
        if (f.follower.isLocal && f.follower.userId) {
          void publish(f.follower.userId, { event: 'new_post', payload: { authorId: actor.id } })
        }
      }
    }

    // Link preview — fetchLinkPreview has its own 8s abort; we add a safety net at 9s
    const previewUrl = extractFirstUrl(content)
    if (previewUrl) {
      const preview = await Promise.race([
        fetchLinkPreview(previewUrl),
        new Promise<null>((resolve) => setTimeout(() => resolve(null), 9000)),
      ]).catch(() => null)
      if (preview) {
        await db.update(posts).set({ linkPreview: preview }).where(eq(posts.id, post!.id))
      }
    }

    // Federate to remote followers
    const vis = body.data.visibility
    if (vis === 'public' || vis === 'unlisted' || vis === 'followers') {
      const fullPost = {
        ...post!,
        apId,
        apInReplyTo: replyToId
          ? (await db.query.posts.findFirst({ where: eq(posts.id, replyToId) }))?.apId ?? null
          : null,
        author: actor,
        customEmojis: await resolveLocalEmojis(content),
      }

      let apObject
      if (poll) {
        const createdPoll = await db.query.polls.findFirst({
          where: eq(polls.postId, post!.id),
          with: { options: { orderBy: (o, { asc }) => [asc(o.position)] } },
        })
        apObject = createdPoll
          ? buildQuestion(fullPost, createdPoll)
          : buildNote(fullPost)
      } else {
        apObject = buildNote(fullPost)
      }

      // followers-only: send to each actor's personal inbox so remote servers can verify
      const perActorInbox = vis === 'followers'
      void deliverToFollowers(actor.handle, actor.id, buildCreate(apObject, actor.handle), { perActorInbox })

      // Cross-post original public/unlisted posts to connected bridges.
      // No-ops if the user hasn't connected / disabled crossposting.
      if ((vis === 'public' || vis === 'unlisted') && !replyToId) {
        if (actor.userId) {
          void crosspostToBluesky(actor.userId, content, post!.tags ?? []).catch(() => {})
        }
        if (actor.nostrCrosspostEnabled && actor.nostrPrivateKeyEncrypted) {
          void crosspostToNostr(actor.nostrPrivateKeyEncrypted, content, post!.tags ?? []).catch(() => {})
        }
      }
    }

    const [enriched] = await enrichPosts([{ ...post!, apId }], ctx.actor.id)
    return reply.code(201).send(enriched)
  })

  // GET /api/posts/scheduled — kullanıcının zamanlanmış gönderileri
  app.get('/api/posts/scheduled', async (req, reply) => {
    const ctx = await requireActor(req, reply)
    if (!ctx) return

    const rows = await db.query.posts.findMany({
      where: and(
        eq(posts.authorId, ctx.actor.id),
        eq(posts.isDeleted, false),
        isNotNull(posts.scheduledAt),
      ),
      orderBy: (p, { asc }) => [asc(p.scheduledAt)],
    })

    const enriched = await enrichPosts(rows, ctx.actor.id)
    return reply.send({ posts: enriched })
  })

  // DELETE /api/posts/scheduled/:id — zamanlanmış gönderiyi iptal et
  app.delete<{ Params: { id: string } }>('/api/posts/scheduled/:id', async (req, reply) => {
    const ctx = await requireActor(req, reply)
    if (!ctx) return

    const post = await db.query.posts.findFirst({
      where: and(
        eq(posts.id, req.params.id),
        eq(posts.authorId, ctx.actor.id),
        isNotNull(posts.scheduledAt),
      ),
    })
    if (!post) return reply.code(404).send({ error: 'Not found' })

    await db.update(posts).set({ isDeleted: true }).where(eq(posts.id, post.id))

    // Remove from BullMQ queue
    const job = await schedulerQueue.getJob(`publish-${post.id}`)
    await job?.remove()

    return reply.code(204).send()
  })

  // GET /api/posts/drafts — taslaklar
  app.get('/api/posts/drafts', async (req, reply) => {
    const ctx = await requireActor(req, reply)
    if (!ctx) return

    const rows = await db.query.posts.findMany({
      where: and(
        eq(posts.authorId, ctx.actor.id),
        eq(posts.isDraft, true),
        eq(posts.isDeleted, false),
      ),
      orderBy: (p, { desc }) => [desc(p.createdAt)],
    })

    const enriched = await enrichPosts(rows, ctx.actor.id)
    return reply.send({ posts: enriched })
  })

  // POST /api/posts/drafts/:id/publish — taslağı yayınla
  app.post<{ Params: { id: string } }>('/api/posts/drafts/:id/publish', async (req, reply) => {
    const ctx = await requireActor(req, reply)
    if (!ctx) return

    const post = await db.query.posts.findFirst({
      where: and(eq(posts.id, req.params.id), eq(posts.authorId, ctx.actor.id), eq(posts.isDraft, true)),
    })
    if (!post) return reply.code(404).send({ error: 'Not found' })

    const [updated] = await db.update(posts).set({ isDraft: false }).where(eq(posts.id, post.id)).returning()
    const [enriched] = await enrichPosts([updated!], ctx.actor.id)
    return reply.send(enriched)
  })

  // DELETE /api/posts/drafts/:id — taslağı sil
  app.delete<{ Params: { id: string } }>('/api/posts/drafts/:id', async (req, reply) => {
    const ctx = await requireActor(req, reply)
    if (!ctx) return

    const post = await db.query.posts.findFirst({
      where: and(eq(posts.id, req.params.id), eq(posts.authorId, ctx.actor.id), eq(posts.isDraft, true)),
    })
    if (!post) return reply.code(404).send({ error: 'Not found' })

    await db.update(posts).set({ isDeleted: true }).where(eq(posts.id, post.id))
    return reply.code(204).send()
  })

  // GET /api/posts/:id — tek gönderi
  app.get<{ Params: { id: string } }>('/api/posts/:id', async (req, reply) => {
    const session = await getSession(req)
    let actorId: string | undefined
    if (session) {
      const viewer = await db.query.actors.findFirst({ where: eq(actors.userId, session.user.id) })
      actorId = viewer?.id
    }
    const post = await db.query.posts.findFirst({
      where: and(eq(posts.id, req.params.id), eq(posts.isDeleted, false)),
    })
    if (!post) return reply.code(404).send({ error: 'Not found' })

    // close_friends posts require viewer to be in author's close friends list
    if (post.visibility === 'close_friends') {
      if (!actorId) return reply.code(403).send({ error: 'Forbidden' })
      const isCF = await db.query.closeFriends.findFirst({
        where: and(eq(closeFriends.actorId, post.authorId), eq(closeFriends.targetId, actorId)),
      })
      if (!isCF && actorId !== post.authorId) return reply.code(403).send({ error: 'Forbidden' })
    }

    const [enriched] = await enrichPosts([post], actorId)
    return reply.send(enriched)
  })

  // GET /api/posts/:id/context — thread context (ancestors + replies)
  app.get<{ Params: { id: string }; Querystring: { cursor?: string } }>(
    '/api/posts/:id/context',
    async (req, reply) => {
      const session = await getSession(req)
      let actorId: string | undefined
      if (session) {
        const viewer = await db.query.actors.findFirst({ where: eq(actors.userId, session.user.id) })
        actorId = viewer?.id
      }

      let post = await db.query.posts.findFirst({
        where: and(eq(posts.id, req.params.id), eq(posts.isDeleted, false)),
      })
      if (!post) return reply.code(404).send({ error: 'Not found' })

      // Federated reply whose ancestors we haven't ingested → fetch the remote
      // thread so the conversation is complete, then link this post to its parent.
      if (!post.isLocal && !post.replyToId && post.apInReplyTo) {
        try {
          await resolveRemoteThread(post.apInReplyTo)
          const parent = await db.query.posts.findFirst({ where: eq(posts.apId, post.apInReplyTo) })
          if (parent) {
            const [relinked] = await db.update(posts)
              .set({ replyToId: parent.id, rootId: parent.rootId ?? parent.id })
              .where(eq(posts.id, post.id))
              .returning()
            if (relinked) post = relinked
          }
        } catch { /* best-effort */ }
      }

      // Walk up to ancestors (max 10 levels)
      const ancestorList: typeof posts.$inferSelect[] = []
      let walker: typeof posts.$inferSelect | null = post
      for (let i = 0; i < 10 && walker?.replyToId; i++) {
        const parentPost: typeof posts.$inferSelect | undefined = await db.query.posts.findFirst({
          where: and(eq(posts.id, walker.replyToId!), eq(posts.isDeleted, false)),
        })
        if (!parentPost) break
        ancestorList.unshift(parentPost)
        walker = parentPost
      }

      // Direct replies, cursor-paginated
      const LIMIT = 20
      const replyRows = await db.query.posts.findMany({
        where: and(
          eq(posts.replyToId, post.id),
          eq(posts.isDeleted, false),
          req.query.cursor ? lt(posts.createdAt, new Date(req.query.cursor)) : undefined,
        ),
        orderBy: [desc(posts.createdAt)],
        limit: LIMIT + 1,
      })
      const hasMore = replyRows.length > LIMIT
      const replyPage = replyRows.slice(0, LIMIT)

      const [enrichedPost, ...enrichedAncestors] = await enrichPosts([post, ...ancestorList], actorId)
      const enrichedReplies = await enrichPosts(replyPage, actorId)

      // Increment view count (fire-and-forget, non-blocking)
      db.update(posts)
        .set({ viewCount: sql`${posts.viewCount} + 1` })
        .where(eq(posts.id, post.id))
        .catch(() => {})

      return reply.send({
        post: enrichedPost,
        ancestors: enrichedAncestors,
        replies: enrichedReplies,
        nextCursor: hasMore ? replyPage[replyPage.length - 1]!.createdAt.toISOString() : null,
      })
    },
  )

  // PATCH /api/posts/:id — gönderi düzenle
  app.patch<{ Params: { id: string } }>('/api/posts/:id', async (req, reply) => {
    const ctx = await requireActor(req, reply)
    if (!ctx) return

    const body = z.object({
      content: z.string().min(1).max(500),
      visibility: z.enum(['public', 'unlisted', 'followers', 'close_friends', 'direct']).optional(),
    }).safeParse(req.body)
    if (!body.success) return reply.code(400).send({ error: 'Invalid body' })

    const post = await db.query.posts.findFirst({
      where: and(eq(posts.id, req.params.id), eq(posts.authorId, ctx.actor.id), eq(posts.isLocal, true)),
    })
    if (!post) return reply.code(404).send({ error: 'Not found' })

    // Snapshot mevcut içeriği edit geçmişine kaydet
    await db.insert(postEdits).values({
      postId: post.id,
      content: post.content,
      contentWarning: post.contentWarning,
      editedAt: post.editedAt ?? post.createdAt,
    })

    const tags = [...new Set((body.data.content.match(/#([a-zA-ZğüşıöçĞÜŞİÖÇ0-9_]+)/g) ?? []).map((t) => t.slice(1).toLowerCase()))]

    const [updated] = await db
      .update(posts)
      .set({
        content: body.data.content,
        contentHash: hashContent(body.data.content),
        tags,
        editedAt: new Date(),
        ...(body.data.visibility ? { visibility: body.data.visibility } : {}),
      })
      .where(eq(posts.id, post.id))
      .returning()

    // Federate Update/Note to remote followers
    if (updated && (post.visibility === 'public' || post.visibility === 'unlisted')) {
      const note = buildNote({ ...updated, tags: updated.tags, apInReplyTo: updated.apInReplyTo ?? null, author: ctx.actor })
      void deliverToFollowers(ctx.actor.handle, ctx.actor.id, buildUpdateNote(note, ctx.actor.handle))
    }

    return reply.send(updated)
  })

  // GET /api/posts/:id/edits — düzenleme geçmişi
  app.get<{ Params: { id: string } }>('/api/posts/:id/edits', async (req, reply) => {
    const post = await db.query.posts.findFirst({
      where: and(eq(posts.id, req.params.id), eq(posts.isDeleted, false)),
    })
    if (!post) return reply.code(404).send({ error: 'Not found' })

    const edits = await db.query.postEdits.findMany({
      where: eq(postEdits.postId, post.id),
      orderBy: (e, { desc }) => [desc(e.editedAt)],
    })

    return reply.send({ edits })
  })

  // DELETE /api/posts/:id
  app.delete<{ Params: { id: string } }>('/api/posts/:id', async (req, reply) => {
    const ctx = await requireActor(req, reply)
    if (!ctx) return

    const post = await db.query.posts.findFirst({
      where: and(eq(posts.id, req.params.id), eq(posts.authorId, ctx.actor.id)),
    })
    if (!post) return reply.code(404).send({ error: 'Not found' })

    const deletedAt = new Date()
    await db.update(posts).set({ isDeleted: true, deletedAt }).where(eq(posts.id, post.id))
    await db
      .update(actors)
      .set({ postsCount: sql`GREATEST(${actors.postsCount} - 1, 0)` })
      .where(eq(actors.id, ctx.actor.id))
    if (post.quotedPostId) {
      await db
        .update(posts)
        .set({ quotesCount: sql`GREATEST(${posts.quotesCount} - 1, 0)` })
        .where(eq(posts.id, post.quotedPostId))
    }
    if (post.replyToId) {
      await db
        .update(posts)
        .set({ repliesCount: sql`GREATEST(${posts.repliesCount} - 1, 0)` })
        .where(eq(posts.id, post.replyToId))
    }

    const deleteActivity = buildDelete(post.apId, ctx.actor.handle, deletedAt)
    void deliverToFollowers(ctx.actor.handle, ctx.actor.id, deleteActivity)

    return reply.code(204).send()
  })

  // POST /api/posts/:id/like
  app.post<{ Params: { id: string } }>('/api/posts/:id/like', async (req, reply) => {
    const ctx = await requireActor(req, reply)
    if (!ctx) return

    const existing = await db.query.likes.findFirst({
      where: and(eq(likes.actorId, ctx.actor.id), eq(likes.postId, req.params.id)),
    })
    if (existing) return reply.code(409).send({ error: 'Already liked' })

    await db.insert(likes).values({ actorId: ctx.actor.id, postId: req.params.id })
    await db
      .update(posts)
      .set({ likesCount: sql`${posts.likesCount} + 1` })
      .where(eq(posts.id, req.params.id))
    void notifyLike(ctx.actor.id, req.params.id)

    return reply.code(204).send()
  })

  // DELETE /api/posts/:id/like
  app.delete<{ Params: { id: string } }>('/api/posts/:id/like', async (req, reply) => {
    const ctx = await requireActor(req, reply)
    if (!ctx) return

    const deleted = await db
      .delete(likes)
      .where(and(eq(likes.actorId, ctx.actor.id), eq(likes.postId, req.params.id)))
      .returning()

    if (deleted.length === 0) return reply.code(404).send({ error: 'Not liked' })

    await db
      .update(posts)
      .set({ likesCount: sql`GREATEST(${posts.likesCount} - 1, 0)` })
      .where(eq(posts.id, req.params.id))

    return reply.code(204).send()
  })

  // POST /api/posts/:id/boost
  app.post<{ Params: { id: string } }>('/api/posts/:id/boost', async (req, reply) => {
    const ctx = await requireActor(req, reply)
    if (!ctx) return

    const existing = await db.query.boosts.findFirst({
      where: and(eq(boosts.actorId, ctx.actor.id), eq(boosts.postId, req.params.id)),
    })
    if (existing) return reply.code(409).send({ error: 'Already boosted' })

    await db.insert(boosts).values({ actorId: ctx.actor.id, postId: req.params.id })
    await db
      .update(posts)
      .set({ boostsCount: sql`${posts.boostsCount} + 1` })
      .where(eq(posts.id, req.params.id))
    void notifyBoost(ctx.actor.id, req.params.id)

    return reply.code(204).send()
  })

  // POST /api/posts/:id/bookmark
  app.post<{ Params: { id: string } }>('/api/posts/:id/bookmark', async (req, reply) => {
    const ctx = await requireActor(req, reply)
    if (!ctx) return

    const existing = await db.query.bookmarks.findFirst({
      where: and(eq(bookmarks.actorId, ctx.actor.id), eq(bookmarks.postId, req.params.id)),
    })
    if (existing) return reply.code(409).send({ error: 'Already bookmarked' })

    await db.insert(bookmarks).values({ actorId: ctx.actor.id, postId: req.params.id })
    return reply.code(204).send()
  })

  // DELETE /api/posts/:id/boost
  app.delete<{ Params: { id: string } }>('/api/posts/:id/boost', async (req, reply) => {
    const ctx = await requireActor(req, reply)
    if (!ctx) return

    const deleted = await db
      .delete(boosts)
      .where(and(eq(boosts.actorId, ctx.actor.id), eq(boosts.postId, req.params.id)))
      .returning()

    if (deleted.length === 0) return reply.code(404).send({ error: 'Not boosted' })

    await db
      .update(posts)
      .set({ boostsCount: sql`GREATEST(${posts.boostsCount} - 1, 0)` })
      .where(eq(posts.id, req.params.id))

    return reply.code(204).send()
  })

  // DELETE /api/posts/:id/bookmark
  app.delete<{ Params: { id: string } }>('/api/posts/:id/bookmark', async (req, reply) => {
    const ctx = await requireActor(req, reply)
    if (!ctx) return

    const deleted = await db
      .delete(bookmarks)
      .where(and(eq(bookmarks.actorId, ctx.actor.id), eq(bookmarks.postId, req.params.id)))
      .returning()

    if (deleted.length === 0) return reply.code(404).send({ error: 'Not bookmarked' })

    return reply.code(204).send()
  })

  // GET /api/bookmarks — kullanıcının kaydettikleri (isteğe bağlı koleksiyon filtresi)
  app.get<{ Querystring: { cursor?: string; limit?: string; collection?: string } }>('/api/bookmarks', async (req, reply) => {
    const ctx = await requireActor(req, reply)
    if (!ctx) return

    const limit = Math.min(Number(req.query.limit ?? 20), 40)
    const cursor = req.query.cursor ? new Date(req.query.cursor) : undefined
    const collectionId = req.query.collection ?? null

    const bookmarkRows = await db.query.bookmarks.findMany({
      where: and(
        eq(bookmarks.actorId, ctx.actor.id),
        collectionId ? eq(bookmarks.collectionId, collectionId) : undefined,
        cursor ? lt(bookmarks.createdAt, cursor) : undefined,
      ),
      orderBy: [desc(bookmarks.createdAt)],
      limit: limit + 1,
    })

    const hasMore = bookmarkRows.length > limit
    const items = bookmarkRows.slice(0, limit)
    const postIds = items.map((b) => b.postId)

    const postRows = postIds.length > 0
      ? await db.query.posts.findMany({ where: and(inArray(posts.id, postIds), eq(posts.isDeleted, false)) })
      : []

    const postMap = new Map(postRows.map((p) => [p.id, p]))
    const ordered = items.map((b) => postMap.get(b.postId)).filter(Boolean) as typeof postRows

    const enriched = await enrichPosts(ordered, ctx.actor.id)

    return reply.send({
      posts: enriched,
      nextCursor: hasMore ? items[items.length - 1]!.createdAt.toISOString() : null,
    })
  })

  // GET /api/bookmark-collections
  app.get('/api/bookmark-collections', async (req, reply) => {
    const ctx = await requireActor(req, reply)
    if (!ctx) return

    const cols = await db.query.bookmarkCollections.findMany({
      where: eq(bookmarkCollections.actorId, ctx.actor.id),
      orderBy: [bookmarkCollections.createdAt],
    })

    return reply.send({ collections: cols })
  })

  // POST /api/bookmark-collections
  app.post<{ Body: { name: string } }>('/api/bookmark-collections', async (req, reply) => {
    const ctx = await requireActor(req, reply)
    if (!ctx) return

    const name = (req.body.name ?? '').trim().slice(0, 50)
    if (!name) return reply.code(400).send({ error: 'Name required' })

    const [col] = await db.insert(bookmarkCollections).values({ actorId: ctx.actor.id, name }).returning()
    return reply.code(201).send(col)
  })

  // PATCH /api/bookmark-collections/:id — rename
  app.patch<{ Params: { id: string }; Body: { name: string } }>('/api/bookmark-collections/:id', async (req, reply) => {
    const ctx = await requireActor(req, reply)
    if (!ctx) return

    const name = (req.body.name ?? '').trim().slice(0, 50)
    if (!name) return reply.code(400).send({ error: 'Name required' })

    const [updated] = await db
      .update(bookmarkCollections)
      .set({ name })
      .where(and(eq(bookmarkCollections.id, req.params.id), eq(bookmarkCollections.actorId, ctx.actor.id)))
      .returning()

    if (!updated) return reply.code(404).send({ error: 'Not found' })
    return reply.send(updated)
  })

  // DELETE /api/bookmark-collections/:id — sil (kaydedilenler uncollected kalır)
  app.delete<{ Params: { id: string } }>('/api/bookmark-collections/:id', async (req, reply) => {
    const ctx = await requireActor(req, reply)
    if (!ctx) return

    const [deleted] = await db
      .delete(bookmarkCollections)
      .where(and(eq(bookmarkCollections.id, req.params.id), eq(bookmarkCollections.actorId, ctx.actor.id)))
      .returning()

    if (!deleted) return reply.code(404).send({ error: 'Not found' })
    return reply.code(204).send()
  })

  // PATCH /api/posts/:id/bookmark — koleksiyona taşı (null = uncollected)
  app.patch<{ Params: { id: string }; Body: { collectionId: string | null } }>(
    '/api/posts/:id/bookmark',
    async (req, reply) => {
      const ctx = await requireActor(req, reply)
      if (!ctx) return

      const collectionId = req.body.collectionId ?? null

      // Verify collection belongs to actor
      if (collectionId) {
        const col = await db.query.bookmarkCollections.findFirst({
          where: and(eq(bookmarkCollections.id, collectionId), eq(bookmarkCollections.actorId, ctx.actor.id)),
        })
        if (!col) return reply.code(404).send({ error: 'Collection not found' })
      }

      const [updated] = await db
        .update(bookmarks)
        .set({ collectionId })
        .where(and(eq(bookmarks.actorId, ctx.actor.id), eq(bookmarks.postId, req.params.id)))
        .returning()

      if (!updated) return reply.code(404).send({ error: 'Bookmark not found' })
      return reply.send(updated)
    },
  )

  const ALLOWED_EMOJIS = new Set(['👍','😂','😮','😢','😡','🔥','✨','👀','🎉'])

  // POST /api/posts/:id/reactions — emoji tepki ekle
  app.post<{ Params: { id: string }; Body: { emoji: string } }>(
    '/api/posts/:id/reactions',
    async (req, reply) => {
      const ctx = await requireActor(req, reply)
      if (!ctx) return

      const { emoji } = req.body as { emoji: string }
      if (!emoji || !ALLOWED_EMOJIS.has(emoji)) {
        return reply.code(400).send({ error: 'Invalid emoji' })
      }

      const post = await db.query.posts.findFirst({
        where: and(eq(posts.id, req.params.id), eq(posts.isDeleted, false)),
      })
      if (!post) return reply.code(404).send({ error: 'Not found' })

      const [insertedReaction] = await db
        .insert(reactions)
        .values({ actorId: ctx.actor.id, postId: post.id, emoji })
        .onConflictDoNothing()
        .returning()

      // Federate an EmojiReact to the remote author (only for a new reaction).
      if (insertedReaction && !post.isLocal && post.apId) {
        const author = await db.query.actors.findFirst({ where: eq(actors.id, post.authorId) })
        if (author && !author.isLocal && author.inboxUrl) {
          const react = buildEmojiReact(ctx.actor.handle, post.apId, insertedReaction.id, emoji)
          void deliverToInbox(ctx.actor.handle, author.inboxUrl, react)
        }
      }

      return reply.code(204).send()
    },
  )

  // DELETE /api/posts/:id/reactions/:emoji — tepkiyi kaldır
  // GET /api/link-preview?url=... — URL önizlemesi
  app.get('/api/link-preview', {
    config: { rateLimit: { max: 30, timeWindow: '1 minute' } },
  }, async (req, reply) => {
    const ctx = await requireActor(req, reply)
    if (!ctx) return

    const { url } = req.query as { url?: string }
    if (!url) return reply.code(400).send({ error: 'url required' })

    const preview = await fetchLinkPreview(url)
    if (!preview) return reply.code(404).send({ error: 'preview not available' })
    return reply.send(preview)
  })

  app.delete<{ Params: { id: string; emoji: string } }>(
    '/api/posts/:id/reactions/:emoji',
    async (req, reply) => {
      const ctx = await requireActor(req, reply)
      if (!ctx) return

      const emoji = decodeURIComponent(req.params.emoji)
      const [removed] = await db
        .delete(reactions)
        .where(
          and(
            eq(reactions.actorId, ctx.actor.id),
            eq(reactions.postId, req.params.id),
            eq(reactions.emoji, emoji),
          ),
        )
        .returning()

      // Federate an Undo(EmojiReact) to the remote author.
      if (removed) {
        const post = await db.query.posts.findFirst({ where: eq(posts.id, req.params.id) })
        if (post && !post.isLocal && post.apId) {
          const author = await db.query.actors.findFirst({ where: eq(actors.id, post.authorId) })
          if (author && !author.isLocal && author.inboxUrl) {
            const react = buildEmojiReact(ctx.actor.handle, post.apId, removed.id, emoji)
            void deliverToInbox(ctx.actor.handle, author.inboxUrl, buildUndo(ctx.actor.handle, react))
          }
        }
      }

      return reply.code(204).send()
    },
  )

  // GET /api/posts/:id/quotes — bu gönderiyi alıntılayan gönderiler
  app.get<{ Params: { id: string }; Querystring: { cursor?: string } }>(
    '/api/posts/:id/quotes',
    async (req, reply) => {
      const session = await getSession(req)
      let viewerActorId: string | undefined
      if (session) {
        const viewer = await db.query.actors.findFirst({ where: eq(actors.userId, session.user.id) })
        viewerActorId = viewer?.id
      }

      const limit = 20
      const cursor = req.query.cursor

      const conditions: Parameters<typeof and> = [
        eq(posts.quotedPostId, req.params.id),
        eq(posts.isDeleted, false),
        isNull(posts.scheduledAt),
        inArray(posts.visibility, ['public', 'unlisted']),
      ]
      if (cursor) conditions.push(lt(posts.createdAt, new Date(cursor)))

      const postList = await db.query.posts.findMany({
        where: and(...conditions),
        orderBy: [desc(posts.createdAt)],
        limit: limit + 1,
      })

      const hasMore = postList.length > limit
      const items = postList.slice(0, limit)
      const enriched = await enrichPosts(items, viewerActorId)

      return reply.send({
        posts: enriched,
        nextCursor: hasMore ? items.at(-1)?.createdAt.toISOString() : null,
      })
    },
  )

  // GET /api/posts/:id/likes — bu gönderiyi beğenen kullanıcılar
  app.get<{ Params: { id: string }; Querystring: { cursor?: string } }>(
    '/api/posts/:id/likes',
    async (req, reply) => {
      const session = await getSession(req)
      const viewer = session
        ? await db.query.actors.findFirst({ where: eq(actors.userId, session.user.id) })
        : null

      const limit = 20
      const offset = req.query.cursor ? parseInt(req.query.cursor, 10) || 0 : 0

      const likeRows = await db.query.likes.findMany({
        where: eq(likes.postId, req.params.id),
        columns: { actorId: true },
        orderBy: [desc(likes.createdAt)],
        limit: limit + 1,
        offset,
      })

      const hasMore = likeRows.length > limit
      const orderedActorIds = likeRows.slice(0, limit).map((l) => l.actorId)
      const actorRows = orderedActorIds.length > 0
        ? await db.query.actors.findMany({ where: inArray(actors.id, orderedActorIds) })
        : []
      const actorById = new Map(actorRows.map((a) => [a.id, a]))
      const items = orderedActorIds.map((id) => actorById.get(id)).filter((a): a is NonNullable<typeof a> => !!a)

      let viewerFollows = new Set<string>()
      if (viewer && items.length > 0) {
        const rows = await db.query.follows.findMany({
          where: and(
            eq(follows.followerId, viewer.id),
            eq(follows.status, 'accepted'),
            inArray(follows.followingId, items.map((a) => a.id)),
          ),
          columns: { followingId: true },
        })
        viewerFollows = new Set(rows.map((f) => f.followingId))
      }

      return reply.send({
        actors: items.map((a) => ({
          ...a,
          viewer: viewer ? {
            following: viewerFollows.has(a.id),
            followStatus: viewerFollows.has(a.id) ? 'accepted' : null,
          } : undefined,
        })),
        nextCursor: hasMore ? String(offset + limit) : null,
      })
    },
  )
}

function hashContent(content: string): string {
  return createHash('sha256').update(content, 'utf8').digest('hex')
}

const SHORTCODE_RE = /:([a-zA-Z0-9_]{2,64}):/g

async function resolveLocalEmojis(content: string): Promise<Array<{ shortcode: string; imageUrl: string }>> {
  const shortcodes = [...new Set([...content.matchAll(SHORTCODE_RE)].map((m) => m[1]!))]
  if (shortcodes.length === 0) return []

  const found = await db.query.customEmojis.findMany({
    where: (t, { and, isNull, inArray }) =>
      and(isNull(t.domain), inArray(t.shortcode, shortcodes)),
  })

  return found.map((e) => ({ shortcode: e.shortcode, imageUrl: e.imageUrl }))
}
