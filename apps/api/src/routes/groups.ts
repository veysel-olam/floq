import type { FastifyInstance } from 'fastify'
import { eq, and, desc, inArray, ne, count, sql } from 'drizzle-orm'
import { z } from 'zod'
import { randomBytes } from 'node:crypto'
import { db } from '../db/client.js'
import {
  actors,
  posts,
  follows,
  apGroups,
  communityModerators,
  communityWiki,
  communityModlog,
  communityTrustRecord,
  communityBadges,
  userCommunityBadges,
  communityFlairs,
  communityPartnerships,
  confederationVotes,
  confederationVoteBallots,
  mediaAttachments,
  type PostTemplate,
  type ModlogAction,
  type CommunityType,
} from '../db/schema.js'
import { requireMastodonUser, getMastodonUser } from '../lib/mastodonAuth.js'
import { toMastodonAccount, toMastodonStatus } from './mastodon/serializers.js'
import { generateActorKeyPair, decryptPrivateKey } from '../lib/keys.js'
import { createSign, createHash } from 'node:crypto'
import { env } from '../lib/env.js'
import { buildActor, buildFollow, AP_CONTENT_TYPE, actorUrl, activityUrl } from '../lib/activityPub.js'
import { fetchRemoteActor, deliverToInbox, isSuspendedDomain } from '../lib/federation.js'

// ── Helpers ───────────────────────────────────────────────────────────────────

async function getGroupWithActor(handle: string) {
  const actor = await db.query.actors.findFirst({
    where: and(eq(actors.handle, handle), eq(actors.actorType, 'Group')),
  })
  if (!actor) return null
  const group = await db.query.apGroups.findFirst({ where: eq(apGroups.actorId, actor.id) })
  if (!group) return null
  return { actor, group }
}

async function logMod(opts: {
  communityId: string
  actorId: string
  action: ModlogAction
  targetUserId?: string
  targetPostId?: string
  reason?: string
  metadata?: Record<string, unknown>
}) {
  await db.insert(communityModlog).values({
    communityId: opts.communityId,
    actorId: opts.actorId,
    action: opts.action,
    targetUserId: opts.targetUserId ?? null,
    targetPostId: opts.targetPostId ?? null,
    reason: opts.reason ?? null,
    metadata: opts.metadata ?? null,
  })
}

async function isMember(actorId: string, groupActorId: string) {
  const f = await db.query.follows.findFirst({
    where: and(
      eq(follows.followerId, actorId),
      eq(follows.followingId, groupActorId),
      eq(follows.status, 'accepted'),
    ),
  })
  return !!f
}

async function isMod(actorId: string, groupId: string) {
  const row = await db.query.communityModerators.findFirst({
    where: and(
      eq(communityModerators.communityId, groupId),
      eq(communityModerators.actorId, actorId),
    ),
  })
  return !!row
}

async function isModOrOwner(actorId: string, groupActorId: string, group: typeof apGroups.$inferSelect) {
  if (group.ownerId === actorId) return true
  return isMod(actorId, group.id)
}

function serializeCommunity(
  actor: typeof actors.$inferSelect,
  group: typeof apGroups.$inferSelect,
  extras?: { memberStatus?: 'none' | 'pending' | 'member' | 'mod' | 'owner'; isMod?: boolean },
) {
  const status = extras?.memberStatus ?? 'none'
  const canManage = status === 'owner' || status === 'mod'
  return {
    id: group.id,
    handle: actor.handle,
    name: actor.displayName,
    description: actor.bio ?? null,
    avatar_url: actor.avatarUrl ?? null,
    banner_url: group.bannerUrl ?? null,
    visibility: group.visibility,
    rules: group.rules ?? null,
    color_index: group.colorIndex,
    topics: group.topics ?? null,
    member_count: group.memberCount,
    post_count: group.postCount,
    created_at: group.createdAt,
    viewer_status: status,
    pinned_post_id: group.pinnedPostId ?? null,
    invite_token: canManage ? (group.inviteToken ?? null) : null,
    post_templates: group.postTemplates ?? [],
    community_type: group.communityType ?? 'general',
  }
}

// ── Routes ────────────────────────────────────────────────────────────────────

export async function groupRoutes(app: FastifyInstance) {

  // GET /api/communities — discover / list
  app.get<{ Querystring: { q?: string; limit?: string; cursor?: string; filter?: string } }>(
    '/api/communities',
    async (req, reply) => {
      const ctx = await getMastodonUser(req)
      const limit = Math.min(Number(req.query.limit ?? 20), 40)
      const filter = req.query.filter ?? 'all' // all | joined

      // Get all Group actors
      let groupActors = await db.query.actors.findMany({
        where: and(
          eq(actors.actorType, 'Group'),
          eq(actors.isLocal, true),
        ),
        limit: limit + 1,
        orderBy: [desc(actors.createdAt)],
      })

      if (req.query.q) {
        const q = req.query.q.toLowerCase()
        groupActors = groupActors.filter(
          (a) =>
            a.handle.toLowerCase().includes(q) ||
            a.displayName?.toLowerCase().includes(q) ||
            a.bio?.toLowerCase().includes(q),
        )
      }

      const actorIds = groupActors.map((a) => a.id)
      if (!actorIds.length) return reply.send({ communities: [], next_cursor: null })

      const groups = await db.query.apGroups.findMany({
        where: inArray(apGroups.actorId, actorIds),
      })
      const groupByActorId = new Map(groups.map((g) => [g.actorId, g]))

      // Filter private communities from non-members
      const results = []
      for (const actor of groupActors) {
        const group = groupByActorId.get(actor.id)
        if (!group) continue

        // Private: only show to members
        if (group.visibility === 'private') {
          if (!ctx) continue
          const member = await isMember(ctx.actor.id, actor.id)
          if (!member && group.ownerId !== ctx.actor.id) continue
        }

        let memberStatus: 'none' | 'pending' | 'member' | 'mod' | 'owner' = 'none'
        if (ctx) {
          if (group.ownerId === ctx.actor.id) {
            memberStatus = 'owner'
          } else {
            const follow = await db.query.follows.findFirst({
              where: and(eq(follows.followerId, ctx.actor.id), eq(follows.followingId, actor.id)),
            })
            if (follow?.status === 'accepted') {
              const mod = await isMod(ctx.actor.id, group.id)
              memberStatus = mod ? 'mod' : 'member'
            } else if (follow?.status === 'pending') {
              memberStatus = 'pending'
            }
          }
        }

        if (filter === 'joined' && memberStatus === 'none') continue

        results.push(serializeCommunity(actor, group, { memberStatus }))
      }

      return reply.send({ communities: results.slice(0, limit), next_cursor: null })
    },
  )

  // POST /api/communities — create
  app.post('/api/communities', async (req, reply) => {
    const ctx = await requireMastodonUser(req, reply)
    if (!ctx) return

    const body = z.object({
      handle: z.string().min(2).max(30).regex(/^[a-z0-9_]+$/),
      name: z.string().min(1).max(100),
      description: z.string().max(1000).optional(),
      visibility: z.enum(['public', 'restricted', 'private']).default('public'),
      rules: z.string().max(2000).optional(),
      color_index: z.number().int().min(0).max(7).optional(),
      topics: z.string().max(500).optional(),
    }).safeParse(req.body)
    if (!body.success) return reply.code(422).send({ error: 'Validation failed', details: body.error.issues })

    const { handle, name, description, visibility, rules, color_index, topics } = body.data

    const existing = await db.query.actors.findFirst({ where: eq(actors.handle, handle) })
    if (existing) return reply.code(422).send({ error: 'Handle zaten kullanımda' })

    const { publicKeyPem, privateKeyEncrypted } = await generateActorKeyPair()
    const apId = `${env.APP_URL}/users/${handle}`

    const [groupActor] = await db.insert(actors).values({
      handle,
      displayName: name,
      bio: description ?? null,
      isLocal: true,
      isBot: false,
      actorType: 'Group',
      isLocked: visibility !== 'public',
      publicKey: publicKeyPem,
      privateKeyEncrypted,
      apId,
      inboxUrl: `${apId}/inbox`,
      outboxUrl: `${apId}/outbox`,
      profileUrl: apId,
      followersUrl: `${apId}/followers`,
      followingUrl: `${apId}/following`,
    }).returning()

    const [group] = await db.insert(apGroups).values({
      actorId: groupActor!.id,
      ownerId: ctx.actor.id,
      rules: rules ?? null,
      isOpen: visibility === 'public',
      visibility,
      colorIndex: color_index ?? 0,
      topics: topics ?? null,
    }).returning()

    // Owner automatically a member
    await db.insert(follows).values({
      followerId: ctx.actor.id,
      followingId: groupActor!.id,
      status: 'accepted',
    }).onConflictDoNothing()

    await db.update(apGroups).set({ memberCount: 1 }).where(eq(apGroups.id, group!.id))

    return reply.code(201).send(serializeCommunity(groupActor!, group!, { memberStatus: 'owner' }))
  })

  // GET /api/communities/:handle — community profile
  app.get<{ Params: { handle: string } }>('/api/communities/:handle', async (req, reply) => {
    const result = await getGroupWithActor(req.params.handle)
    if (!result) return reply.code(404).send({ error: 'Topluluk bulunamadı' })
    const { actor, group } = result

    const ctx = await getMastodonUser(req)

    // Private: only members can view
    if (group.visibility === 'private') {
      if (!ctx) return reply.code(404).send({ error: 'Topluluk bulunamadı' })
      const member = await isMember(ctx.actor.id, actor.id)
      if (!member && group.ownerId !== ctx.actor.id) return reply.code(404).send({ error: 'Topluluk bulunamadı' })
    }

    let memberStatus: 'none' | 'pending' | 'member' | 'mod' | 'owner' = 'none'
    if (ctx) {
      if (group.ownerId === ctx.actor.id) {
        memberStatus = 'owner'
      } else {
        const follow = await db.query.follows.findFirst({
          where: and(eq(follows.followerId, ctx.actor.id), eq(follows.followingId, actor.id)),
        })
        if (follow?.status === 'accepted') {
          const mod = await isMod(ctx.actor.id, group.id)
          memberStatus = mod ? 'mod' : 'member'
        } else if (follow?.status === 'pending') {
          memberStatus = 'pending'
        }
      }
    }

    const flairs = await db.query.communityFlairs.findMany({
      where: eq(communityFlairs.communityId, group.id),
      orderBy: [communityFlairs.sortOrder, communityFlairs.createdAt],
    })

    return reply.send({
      ...serializeCommunity(actor, group, { memberStatus }),
      flairs: flairs.map((f) => ({ id: f.id, name: f.name, emoji: f.emoji, color: f.color, sortOrder: f.sortOrder })),
    })
  })

  // PATCH /api/communities/:handle — update settings (owner/mod)
  app.patch<{ Params: { handle: string } }>('/api/communities/:handle', async (req, reply) => {
    const ctx = await requireMastodonUser(req, reply)
    if (!ctx) return

    const result = await getGroupWithActor(req.params.handle)
    if (!result) return reply.code(404).send({ error: 'Topluluk bulunamadı' })
    const { actor, group } = result

    const isOwner = group.ownerId === ctx.actor.id
    const mod = await isMod(ctx.actor.id, group.id)
    if (!isOwner && !mod) return reply.code(403).send({ error: 'Yetersiz yetki' })

    const postTemplateFieldSchema = z.object({
      key: z.string().min(1).max(50),
      label: z.string().min(1).max(100),
      type: z.enum(['text', 'textarea', 'select']),
      options: z.array(z.string().max(100)).max(10).optional(),
      required: z.boolean().optional(),
      placeholder: z.string().max(200).optional(),
    })
    const postTemplateSchema = z.object({
      id: z.string().min(1).max(50),
      name: z.string().min(1).max(100),
      icon: z.string().min(1).max(10),
      fields: z.array(postTemplateFieldSchema).min(1).max(10),
    })

    const body = z.object({
      name: z.string().min(1).max(100).optional(),
      description: z.string().max(1000).optional(),
      visibility: z.enum(['public', 'restricted', 'private']).optional(),
      rules: z.string().max(2000).optional(),
      banner_url: z.string().url().optional().nullable(),
      color_index: z.number().int().min(0).max(7).optional(),
      topics: z.string().max(500).optional().nullable(),
      post_templates: z.array(postTemplateSchema).max(5).optional().nullable(),
      community_type: z.enum(['general', 'project', 'event', 'support', 'learning', 'gaming', 'creative']).optional(),
    }).safeParse(req.body)
    if (!body.success) return reply.code(422).send({ error: 'Validation failed' })

    const { name, description, visibility, rules, banner_url, color_index, topics, post_templates, community_type } = body.data

    if (name !== undefined || description !== undefined) {
      await db.update(actors).set({
        ...(name !== undefined && { displayName: name }),
        ...(description !== undefined && { bio: description }),
      }).where(eq(actors.id, actor.id))
    }

    await db.update(apGroups).set({
      ...(visibility !== undefined && { visibility, isOpen: visibility === 'public' }),
      ...(rules !== undefined && { rules }),
      ...(banner_url !== undefined && { bannerUrl: banner_url }),
      ...(color_index !== undefined && { colorIndex: color_index }),
      ...(topics !== undefined && { topics }),
      ...(post_templates !== undefined && { postTemplates: (post_templates ?? null) as PostTemplate[] | null }),
      ...(community_type !== undefined && { communityType: community_type as CommunityType }),
    }).where(eq(apGroups.id, group.id))

    await logMod({ communityId: group.id, actorId: ctx.actor.id, action: 'update_settings' })

    const updatedActor = await db.query.actors.findFirst({ where: eq(actors.id, actor.id) })
    const updatedGroup = await db.query.apGroups.findFirst({ where: eq(apGroups.id, group.id) })

    return reply.send(serializeCommunity(updatedActor!, updatedGroup!, {
      memberStatus: isOwner ? 'owner' : 'mod',
    }))
  })

  // POST /api/communities/:handle/join
  app.post<{ Params: { handle: string } }>('/api/communities/:handle/join', async (req, reply) => {
    const ctx = await requireMastodonUser(req, reply)
    if (!ctx) return

    const result = await getGroupWithActor(req.params.handle)
    if (!result) return reply.code(404).send({ error: 'Topluluk bulunamadı' })
    const { actor, group } = result

    // Already owner
    if (group.ownerId === ctx.actor.id) return reply.send({ status: 'owner' })

    const existing = await db.query.follows.findFirst({
      where: and(eq(follows.followerId, ctx.actor.id), eq(follows.followingId, actor.id)),
    })
    if (existing) return reply.send({ status: existing.status })

    const status = group.visibility === 'public' ? 'accepted' : 'pending'

    await db.insert(follows).values({
      followerId: ctx.actor.id,
      followingId: actor.id,
      status,
    })

    if (status === 'accepted') {
      await db.update(apGroups)
        .set({ memberCount: sql`${apGroups.memberCount} + 1` })
        .where(eq(apGroups.id, group.id))
    }

    return reply.send({ status })
  })

  // POST /api/communities/:handle/leave
  app.post<{ Params: { handle: string } }>('/api/communities/:handle/leave', async (req, reply) => {
    const ctx = await requireMastodonUser(req, reply)
    if (!ctx) return

    const result = await getGroupWithActor(req.params.handle)
    if (!result) return reply.code(404).send({ error: 'Topluluk bulunamadı' })
    const { actor, group } = result

    if (group.ownerId === ctx.actor.id) {
      return reply.code(400).send({ error: 'Sahibi topluluğu terk edemez. Topluluğu silmek için ayarları kullanın.' })
    }

    const existing = await db.query.follows.findFirst({
      where: and(eq(follows.followerId, ctx.actor.id), eq(follows.followingId, actor.id)),
    })
    if (!existing) return reply.send({ ok: true })

    await db.delete(follows).where(
      and(eq(follows.followerId, ctx.actor.id), eq(follows.followingId, actor.id)),
    )

    if (existing.status === 'accepted') {
      await db.update(apGroups)
        .set({ memberCount: sql`GREATEST(${apGroups.memberCount} - 1, 0)` })
        .where(eq(apGroups.id, group.id))
    }

    // Remove mod role if any
    await db.delete(communityModerators).where(
      and(
        eq(communityModerators.communityId, group.id),
        eq(communityModerators.actorId, ctx.actor.id),
      ),
    )

    return reply.send({ ok: true })
  })

  // GET /api/communities/:handle/feed — community post feed
  app.get<{ Params: { handle: string }; Querystring: { limit?: string; cursor?: string; flair?: string } }>(
    '/api/communities/:handle/feed',
    async (req, reply) => {
      const result = await getGroupWithActor(req.params.handle)
      if (!result) return reply.code(404).send({ error: 'Topluluk bulunamadı' })
      const { actor, group } = result

      const ctx = await getMastodonUser(req)

      if (group.visibility === 'private') {
        if (!ctx) return reply.code(403).send({ error: 'Giriş gerekli' })
        const member = await isMember(ctx.actor.id, actor.id)
        if (!member && group.ownerId !== ctx.actor.id) return reply.code(403).send({ error: 'Üye değilsiniz' })
      }

      const limit = Math.min(Number(req.query.limit ?? 20), 40)
      const cursor = req.query.cursor
      const flairId = req.query.flair

      const postRows = await db.query.posts.findMany({
        where: and(
          eq(posts.groupId, actor.id),
          eq(posts.isDeleted, false),
          cursor ? sql`${posts.createdAt} < ${new Date(cursor)}` : undefined,
          flairId ? eq(posts.flairId, flairId) : undefined,
        ),
        orderBy: [desc(posts.createdAt)],
        limit: limit + 1,
      })

      const hasMore = postRows.length > limit
      const slice = hasMore ? postRows.slice(0, limit) : postRows

      // Return floq Post format (the web renders these with <PostCard/>), not
      // Mastodon statuses — fields differ (author/createdAt vs account/created_at).
      const { enrichPosts } = await import('../lib/enrichPosts.js')
      const enriched = await enrichPosts(slice, ctx?.actor.id)

      return reply.send({
        posts: enriched,
        next_cursor: hasMore ? slice[slice.length - 1]!.createdAt.toISOString() : null,
      })
    },
  )

  // GET /api/communities/:handle/members
  app.get<{ Params: { handle: string }; Querystring: { limit?: string } }>(
    '/api/communities/:handle/members',
    async (req, reply) => {
      const result = await getGroupWithActor(req.params.handle)
      if (!result) return reply.code(404).send({ error: 'Topluluk bulunamadı' })
      const { actor, group } = result

      const ctx = await getMastodonUser(req)
      if (group.visibility === 'private') {
        if (!ctx) return reply.code(403).send({ error: 'Giriş gerekli' })
        const member = await isMember(ctx.actor.id, actor.id)
        if (!member && group.ownerId !== ctx.actor.id) return reply.code(403).send({ error: 'Üye değilsiniz' })
      }

      const limit = Math.min(Number(req.query.limit ?? 40), 80)
      const rows = await db.query.follows.findMany({
        where: and(eq(follows.followingId, actor.id), eq(follows.status, 'accepted')),
        with: { follower: true },
        limit,
        orderBy: [desc(follows.createdAt)],
      })

      const modRows = await db.query.communityModerators.findMany({
        where: eq(communityModerators.communityId, group.id),
      })
      const modSet = new Set(modRows.map((m) => m.actorId))

      // floq Actor shape (the web client expects handle/displayName/avatarUrl,
      // not the Mastodon account shape) — and never leak key material.
      return reply.send(rows.map((r) => {
        const a = r.follower!
        return {
          id: a.id,
          handle: a.handle,
          displayName: a.displayName,
          avatarUrl: a.avatarUrl,
          headerUrl: a.headerUrl,
          bio: a.bio,
          isLocal: a.isLocal,
          isBot: a.isBot,
          community_role: a.id === group.ownerId
            ? 'owner'
            : modSet.has(a.id) ? 'moderator' : 'member',
        }
      }))
    },
  )

  // GET /api/communities/:handle/pending — pending join requests (mod only)
  app.get<{ Params: { handle: string } }>(
    '/api/communities/:handle/pending',
    async (req, reply) => {
      const ctx = await requireMastodonUser(req, reply)
      if (!ctx) return

      const result = await getGroupWithActor(req.params.handle)
      if (!result) return reply.code(404).send({ error: 'Topluluk bulunamadı' })
      const { actor, group } = result

      const isOwner = group.ownerId === ctx.actor.id
      const mod = await isMod(ctx.actor.id, group.id)
      if (!isOwner && !mod) return reply.code(403).send({ error: 'Yetersiz yetki' })

      const rows = await db.query.follows.findMany({
        where: and(eq(follows.followingId, actor.id), eq(follows.status, 'pending')),
        with: { follower: true },
      })
      return reply.send(rows.map((r) => toMastodonAccount(r.follower!)))
    },
  )

  // POST /api/communities/:handle/members/:memberHandle/approve
  app.post<{ Params: { handle: string; memberHandle: string } }>(
    '/api/communities/:handle/members/:memberHandle/approve',
    async (req, reply) => {
      const ctx = await requireMastodonUser(req, reply)
      if (!ctx) return

      const result = await getGroupWithActor(req.params.handle)
      if (!result) return reply.code(404).send({ error: 'Topluluk bulunamadı' })
      const { actor, group } = result

      const isOwner = group.ownerId === ctx.actor.id
      const mod = await isMod(ctx.actor.id, group.id)
      if (!isOwner && !mod) return reply.code(403).send({ error: 'Yetersiz yetki' })

      const member = await db.query.actors.findFirst({ where: eq(actors.handle, req.params.memberHandle) })
      if (!member) return reply.code(404).send({ error: 'Kullanıcı bulunamadı' })

      await db.update(follows)
        .set({ status: 'accepted' })
        .where(and(eq(follows.followerId, member.id), eq(follows.followingId, actor.id), eq(follows.status, 'pending')))

      await db.update(apGroups)
        .set({ memberCount: sql`${apGroups.memberCount} + 1` })
        .where(eq(apGroups.id, group.id))

      await logMod({ communityId: group.id, actorId: ctx.actor.id, action: 'approve_member', targetUserId: member.id })

      return reply.send({ ok: true })
    },
  )

  // POST /api/communities/:handle/members/:memberHandle/reject
  app.post<{ Params: { handle: string; memberHandle: string } }>(
    '/api/communities/:handle/members/:memberHandle/reject',
    async (req, reply) => {
      const ctx = await requireMastodonUser(req, reply)
      if (!ctx) return

      const result = await getGroupWithActor(req.params.handle)
      if (!result) return reply.code(404).send({ error: 'Topluluk bulunamadı' })
      const { actor, group } = result

      const isOwner = group.ownerId === ctx.actor.id
      const mod = await isMod(ctx.actor.id, group.id)
      if (!isOwner && !mod) return reply.code(403).send({ error: 'Yetersiz yetki' })

      const member = await db.query.actors.findFirst({ where: eq(actors.handle, req.params.memberHandle) })
      if (!member) return reply.code(404).send({ error: 'Kullanıcı bulunamadı' })

      await db.delete(follows).where(
        and(eq(follows.followerId, member.id), eq(follows.followingId, actor.id)),
      )

      await logMod({ communityId: group.id, actorId: ctx.actor.id, action: 'reject_member', targetUserId: member.id })

      return reply.send({ ok: true })
    },
  )

  // POST /api/communities/:handle/members/:memberHandle/ban
  app.post<{ Params: { handle: string; memberHandle: string } }>(
    '/api/communities/:handle/members/:memberHandle/ban',
    async (req, reply) => {
      const ctx = await requireMastodonUser(req, reply)
      if (!ctx) return

      const result = await getGroupWithActor(req.params.handle)
      if (!result) return reply.code(404).send({ error: 'Topluluk bulunamadı' })
      const { actor, group } = result

      const isOwner = group.ownerId === ctx.actor.id
      const mod = await isMod(ctx.actor.id, group.id)
      if (!isOwner && !mod) return reply.code(403).send({ error: 'Yetersiz yetki' })

      const member = await db.query.actors.findFirst({ where: eq(actors.handle, req.params.memberHandle) })
      if (!member) return reply.code(404).send({ error: 'Kullanıcı bulunamadı' })
      if (member.id === group.ownerId) return reply.code(400).send({ error: 'Topluluk sahibi banlanamaz' })

      const existing = await db.query.follows.findFirst({
        where: and(eq(follows.followerId, member.id), eq(follows.followingId, actor.id)),
      })

      if (existing?.status === 'accepted') {
        await db.update(apGroups)
          .set({ memberCount: sql`GREATEST(${apGroups.memberCount} - 1, 0)` })
          .where(eq(apGroups.id, group.id))
      }

      await db.update(follows)
        .set({ status: 'rejected' })
        .where(and(eq(follows.followerId, member.id), eq(follows.followingId, actor.id)))

      await db.delete(communityModerators).where(
        and(eq(communityModerators.communityId, group.id), eq(communityModerators.actorId, member.id)),
      )

      await logMod({ communityId: group.id, actorId: ctx.actor.id, action: 'ban', targetUserId: member.id })

      return reply.send({ ok: true })
    },
  )

  // POST /api/communities/:handle/members/:memberHandle/promote — make moderator
  app.post<{ Params: { handle: string; memberHandle: string } }>(
    '/api/communities/:handle/members/:memberHandle/promote',
    async (req, reply) => {
      const ctx = await requireMastodonUser(req, reply)
      if (!ctx) return

      const result = await getGroupWithActor(req.params.handle)
      if (!result) return reply.code(404).send({ error: 'Topluluk bulunamadı' })
      const { group } = result

      if (group.ownerId !== ctx.actor.id) return reply.code(403).send({ error: 'Sadece sahip moderatör atayabilir' })

      const member = await db.query.actors.findFirst({ where: eq(actors.handle, req.params.memberHandle) })
      if (!member) return reply.code(404).send({ error: 'Kullanıcı bulunamadı' })

      await db.insert(communityModerators).values({
        communityId: group.id,
        actorId: member.id,
      }).onConflictDoNothing()

      await logMod({ communityId: group.id, actorId: ctx.actor.id, action: 'add_mod', targetUserId: member.id })

      return reply.send({ ok: true })
    },
  )

  // POST /api/communities/:handle/members/:memberHandle/demote — remove moderator
  app.post<{ Params: { handle: string; memberHandle: string } }>(
    '/api/communities/:handle/members/:memberHandle/demote',
    async (req, reply) => {
      const ctx = await requireMastodonUser(req, reply)
      if (!ctx) return

      const result = await getGroupWithActor(req.params.handle)
      if (!result) return reply.code(404).send({ error: 'Topluluk bulunamadı' })
      const { group } = result

      if (group.ownerId !== ctx.actor.id) return reply.code(403).send({ error: 'Sadece sahip moderatör rolü kaldırabilir' })

      const member = await db.query.actors.findFirst({ where: eq(actors.handle, req.params.memberHandle) })
      if (!member) return reply.code(404).send({ error: 'Kullanıcı bulunamadı' })

      await db.delete(communityModerators).where(
        and(eq(communityModerators.communityId, group.id), eq(communityModerators.actorId, member.id)),
      )

      await logMod({ communityId: group.id, actorId: ctx.actor.id, action: 'remove_mod', targetUserId: member.id })

      return reply.send({ ok: true })
    },
  )

  // POST /api/communities/:handle/pin/:postId — pin a post (mod/owner)
  app.post<{ Params: { handle: string; postId: string } }>(
    '/api/communities/:handle/pin/:postId',
    async (req, reply) => {
      const ctx = await requireMastodonUser(req, reply)
      if (!ctx) return

      const result = await getGroupWithActor(req.params.handle)
      if (!result) return reply.code(404).send({ error: 'Topluluk bulunamadı' })
      const { group } = result

      const isOwner = group.ownerId === ctx.actor.id
      const mod = await isMod(ctx.actor.id, group.id)
      if (!isOwner && !mod) return reply.code(403).send({ error: 'Yetersiz yetki' })

      // Verify post belongs to this community
      const post = await db.query.posts.findFirst({
        where: and(eq(posts.id, req.params.postId), eq(posts.groupId, result.actor.id), eq(posts.isDeleted, false)),
      })
      if (!post) return reply.code(404).send({ error: 'Gönderi bulunamadı' })

      await db.update(apGroups).set({ pinnedPostId: post.id }).where(eq(apGroups.id, group.id))
      await logMod({ communityId: group.id, actorId: ctx.actor.id, action: 'pin_post', targetPostId: post.id })
      return reply.send({ ok: true })
    },
  )

  // DELETE /api/communities/:handle/pin — unpin
  app.delete<{ Params: { handle: string } }>(
    '/api/communities/:handle/pin',
    async (req, reply) => {
      const ctx = await requireMastodonUser(req, reply)
      if (!ctx) return

      const result = await getGroupWithActor(req.params.handle)
      if (!result) return reply.code(404).send({ error: 'Topluluk bulunamadı' })
      const { group } = result

      const isOwner = group.ownerId === ctx.actor.id
      const mod = await isMod(ctx.actor.id, group.id)
      if (!isOwner && !mod) return reply.code(403).send({ error: 'Yetersiz yetki' })

      await db.update(apGroups).set({ pinnedPostId: null }).where(eq(apGroups.id, group.id))
      await logMod({ communityId: group.id, actorId: ctx.actor.id, action: 'unpin_post' })
      return reply.send({ ok: true })
    },
  )

  // GET /api/communities/:handle/invite — get or generate invite token (mod/owner)
  app.get<{ Params: { handle: string } }>(
    '/api/communities/:handle/invite',
    async (req, reply) => {
      const ctx = await requireMastodonUser(req, reply)
      if (!ctx) return

      const result = await getGroupWithActor(req.params.handle)
      if (!result) return reply.code(404).send({ error: 'Topluluk bulunamadı' })
      const { group } = result

      const isOwner = group.ownerId === ctx.actor.id
      const mod = await isMod(ctx.actor.id, group.id)
      if (!isOwner && !mod) return reply.code(403).send({ error: 'Yetersiz yetki' })

      let token = group.inviteToken
      if (!token) {
        token = randomBytes(24).toString('hex')
        await db.update(apGroups).set({ inviteToken: token }).where(eq(apGroups.id, group.id))
        await logMod({ communityId: group.id, actorId: ctx.actor.id, action: 'invite_generated' })
      }

      const inviteUrl = `${env.WEB_URL}/join?invite=${token}`
      return reply.send({ token, url: inviteUrl })
    },
  )

  // DELETE /api/communities/:handle/invite — revoke invite token (owner only)
  app.delete<{ Params: { handle: string } }>(
    '/api/communities/:handle/invite',
    async (req, reply) => {
      const ctx = await requireMastodonUser(req, reply)
      if (!ctx) return

      const result = await getGroupWithActor(req.params.handle)
      if (!result) return reply.code(404).send({ error: 'Topluluk bulunamadı' })
      const { group } = result

      if (group.ownerId !== ctx.actor.id) return reply.code(403).send({ error: 'Sadece sahip iptal edebilir' })

      await db.update(apGroups).set({ inviteToken: null }).where(eq(apGroups.id, group.id))
      await logMod({ communityId: group.id, actorId: ctx.actor.id, action: 'invite_revoked' })
      return reply.send({ ok: true })
    },
  )

  // POST /api/communities/join-by-invite — join via invite token
  app.post<{ Body: { token: string } }>(
    '/api/communities/join-by-invite',
    async (req, reply) => {
      const ctx = await requireMastodonUser(req, reply)
      if (!ctx) return

      const body = z.object({ token: z.string().min(1) }).safeParse(req.body)
      if (!body.success) return reply.code(422).send({ error: 'Token gerekli' })

      const group = await db.query.apGroups.findFirst({ where: eq(apGroups.inviteToken, body.data.token) })
      if (!group) return reply.code(404).send({ error: 'Geçersiz veya süresi dolmuş davet linki' })

      const actor = await db.query.actors.findFirst({ where: eq(actors.id, group.actorId) })
      if (!actor) return reply.code(404).send({ error: 'Topluluk bulunamadı' })

      // Owner check
      if (group.ownerId === ctx.actor.id) return reply.send({ status: 'owner', handle: actor.handle })

      const existing = await db.query.follows.findFirst({
        where: and(eq(follows.followerId, ctx.actor.id), eq(follows.followingId, actor.id)),
      })
      if (existing?.status === 'accepted') return reply.send({ status: 'member', handle: actor.handle })
      if (existing?.status === 'pending') {
        // Invite overrides pending — auto-accept
        await db.update(follows)
          .set({ status: 'accepted' })
          .where(and(eq(follows.followerId, ctx.actor.id), eq(follows.followingId, actor.id)))
        await db.update(apGroups)
          .set({ memberCount: sql`${apGroups.memberCount} + 1` })
          .where(eq(apGroups.id, group.id))
        return reply.send({ status: 'member', handle: actor.handle })
      }

      await db.insert(follows).values({
        followerId: ctx.actor.id,
        followingId: actor.id,
        status: 'accepted',
      })
      await db.update(apGroups)
        .set({ memberCount: sql`${apGroups.memberCount} + 1` })
        .where(eq(apGroups.id, group.id))

      return reply.send({ status: 'member', handle: actor.handle })
    },
  )

  // DELETE /api/communities/:handle — delete community (owner only)
  app.delete<{ Params: { handle: string } }>('/api/communities/:handle', async (req, reply) => {
    const ctx = await requireMastodonUser(req, reply)
    if (!ctx) return

    const result = await getGroupWithActor(req.params.handle)
    if (!result) return reply.code(404).send({ error: 'Topluluk bulunamadı' })
    const { actor, group } = result

    if (group.ownerId !== ctx.actor.id) return reply.code(403).send({ error: 'Sadece sahip silebilir' })

    // Cascade: apGroups delete → actor delete
    await db.delete(actors).where(eq(actors.id, actor.id))

    return reply.send({ ok: true })
  })

  // ── Wiki endpoints ────────────────────────────────────────────────────────

  // GET /api/communities/:handle/wiki — latest version
  app.get<{ Params: { handle: string } }>(
    '/api/communities/:handle/wiki',
    async (req, reply) => {
      const result = await getGroupWithActor(req.params.handle)
      if (!result) return reply.code(404).send({ error: 'Topluluk bulunamadı' })
      const { actor, group } = result

      if (group.visibility === 'private') {
        const ctx = await getMastodonUser(req)
        if (!ctx) return reply.code(403).send({ error: 'Giriş gerekli' })
        const member = await isMember(ctx.actor.id, actor.id)
        if (!member && group.ownerId !== ctx.actor.id) return reply.code(403).send({ error: 'Üye değilsiniz' })
      }

      const latest = await db.query.communityWiki.findFirst({
        where: eq(communityWiki.communityId, group.id),
        orderBy: [desc(communityWiki.version)],
        with: { editor: true },
      })

      if (!latest) return reply.send({ content: '', version: 0, editedAt: null, editedBy: null })

      return reply.send({
        content: latest.content,
        version: latest.version,
        editedAt: latest.editedAt,
        editedBy: { handle: latest.editor!.handle, displayName: latest.editor!.displayName },
      })
    },
  )

  // PUT /api/communities/:handle/wiki — create new version (mod/owner)
  app.put<{ Params: { handle: string }; Body: { content: string } }>(
    '/api/communities/:handle/wiki',
    async (req, reply) => {
      const ctx = await requireMastodonUser(req, reply)
      if (!ctx) return

      const result = await getGroupWithActor(req.params.handle)
      if (!result) return reply.code(404).send({ error: 'Topluluk bulunamadı' })
      const { group } = result

      const isOwner = group.ownerId === ctx.actor.id
      const mod = await isMod(ctx.actor.id, group.id)
      if (!isOwner && !mod) return reply.code(403).send({ error: 'Yetersiz yetki' })

      const body = z.object({ content: z.string().max(50000) }).safeParse(req.body)
      if (!body.success) return reply.code(422).send({ error: 'Geçersiz içerik' })

      const latest = await db.query.communityWiki.findFirst({
        where: eq(communityWiki.communityId, group.id),
        orderBy: [desc(communityWiki.version)],
        columns: { version: true },
      })

      const nextVersion = (latest?.version ?? 0) + 1

      const [entry] = await db.insert(communityWiki).values({
        communityId: group.id,
        content: body.data.content,
        editedBy: ctx.actor.id,
        version: nextVersion,
      }).returning()

      await logMod({ communityId: group.id, actorId: ctx.actor.id, action: 'edit_wiki', metadata: { version: nextVersion } })

      return reply.send({
        content: entry!.content,
        version: entry!.version,
        editedAt: entry!.editedAt,
        editedBy: { handle: ctx.actor.handle, displayName: ctx.actor.displayName },
      })
    },
  )

  // GET /api/communities/:handle/wiki/history — all versions (mod/owner)
  app.get<{ Params: { handle: string } }>(
    '/api/communities/:handle/wiki/history',
    async (req, reply) => {
      const ctx = await requireMastodonUser(req, reply)
      if (!ctx) return

      const result = await getGroupWithActor(req.params.handle)
      if (!result) return reply.code(404).send({ error: 'Topluluk bulunamadı' })
      const { group } = result

      const isOwner = group.ownerId === ctx.actor.id
      const mod = await isMod(ctx.actor.id, group.id)
      if (!isOwner && !mod) return reply.code(403).send({ error: 'Yetersiz yetki' })

      const rows = await db.query.communityWiki.findMany({
        where: eq(communityWiki.communityId, group.id),
        orderBy: [desc(communityWiki.version)],
        limit: 20,
        with: { editor: true },
      })

      return reply.send(rows.map((r) => ({
        version: r.version,
        editedAt: r.editedAt,
        editedBy: { handle: r.editor!.handle, displayName: r.editor!.displayName },
        contentPreview: r.content.slice(0, 120),
      })))
    },
  )

  // ── Flair endpoints ───────────────────────────────────────────────────────

  // GET /api/communities/:handle/flairs — public flair list
  app.get<{ Params: { handle: string } }>(
    '/api/communities/:handle/flairs',
    async (req, reply) => {
      const result = await getGroupWithActor(req.params.handle)
      if (!result) return reply.code(404).send({ error: 'Topluluk bulunamadı' })
      const { group } = result

      const flairs = await db.query.communityFlairs.findMany({
        where: eq(communityFlairs.communityId, group.id),
        orderBy: [communityFlairs.sortOrder, communityFlairs.createdAt],
      })

      return reply.send(flairs.map((f) => ({ id: f.id, name: f.name, emoji: f.emoji, color: f.color, sortOrder: f.sortOrder })))
    },
  )

  // POST /api/communities/:handle/flairs — create flair (mod/owner)
  app.post<{ Params: { handle: string } }>(
    '/api/communities/:handle/flairs',
    async (req, reply) => {
      const ctx = await requireMastodonUser(req, reply)
      if (!ctx) return

      const result = await getGroupWithActor(req.params.handle)
      if (!result) return reply.code(404).send({ error: 'Topluluk bulunamadı' })
      const { group } = result

      const isOwner = group.ownerId === ctx.actor.id
      const mod = await isMod(ctx.actor.id, group.id)
      if (!isOwner && !mod) return reply.code(403).send({ error: 'Yetersiz yetki' })

      const body = z.object({
        name: z.string().min(1).max(60),
        emoji: z.string().max(10).optional(),
        color: z.enum(['coral', 'teal', 'blue', 'purple', 'green', 'orange', 'red', 'zinc']).default('coral'),
        sortOrder: z.number().int().min(0).max(100).default(0),
      }).safeParse(req.body)
      if (!body.success) return reply.code(422).send({ error: 'Geçersiz flair bilgisi' })

      const existing = await db.query.communityFlairs.findMany({
        where: eq(communityFlairs.communityId, group.id),
        columns: { id: true },
      })
      if (existing.length >= 15) return reply.code(400).send({ error: 'En fazla 15 flair tanımlanabilir' })

      const [flair] = await db.insert(communityFlairs).values({
        communityId: group.id,
        name: body.data.name,
        emoji: body.data.emoji ?? null,
        color: body.data.color,
        sortOrder: body.data.sortOrder,
      }).returning()

      return reply.code(201).send({ id: flair!.id, name: flair!.name, emoji: flair!.emoji, color: flair!.color, sortOrder: flair!.sortOrder })
    },
  )

  // PATCH /api/communities/:handle/flairs/:flairId — update flair (mod/owner)
  app.patch<{ Params: { handle: string; flairId: string } }>(
    '/api/communities/:handle/flairs/:flairId',
    async (req, reply) => {
      const ctx = await requireMastodonUser(req, reply)
      if (!ctx) return

      const result = await getGroupWithActor(req.params.handle)
      if (!result) return reply.code(404).send({ error: 'Topluluk bulunamadı' })
      const { group } = result

      const isOwner = group.ownerId === ctx.actor.id
      const mod = await isMod(ctx.actor.id, group.id)
      if (!isOwner && !mod) return reply.code(403).send({ error: 'Yetersiz yetki' })

      const body = z.object({
        name: z.string().min(1).max(60).optional(),
        emoji: z.string().max(10).optional().nullable(),
        color: z.enum(['coral', 'teal', 'blue', 'purple', 'green', 'orange', 'red', 'zinc']).optional(),
        sortOrder: z.number().int().min(0).max(100).optional(),
      }).safeParse(req.body)
      if (!body.success) return reply.code(422).send({ error: 'Geçersiz veri' })

      const [flair] = await db.update(communityFlairs)
        .set({
          ...(body.data.name !== undefined && { name: body.data.name }),
          ...(body.data.emoji !== undefined && { emoji: body.data.emoji }),
          ...(body.data.color !== undefined && { color: body.data.color }),
          ...(body.data.sortOrder !== undefined && { sortOrder: body.data.sortOrder }),
        })
        .where(and(eq(communityFlairs.id, req.params.flairId), eq(communityFlairs.communityId, group.id)))
        .returning()

      if (!flair) return reply.code(404).send({ error: 'Flair bulunamadı' })
      return reply.send({ id: flair.id, name: flair.name, emoji: flair.emoji, color: flair.color, sortOrder: flair.sortOrder })
    },
  )

  // DELETE /api/communities/:handle/flairs/:flairId — delete flair (mod/owner)
  app.delete<{ Params: { handle: string; flairId: string } }>(
    '/api/communities/:handle/flairs/:flairId',
    async (req, reply) => {
      const ctx = await requireMastodonUser(req, reply)
      if (!ctx) return

      const result = await getGroupWithActor(req.params.handle)
      if (!result) return reply.code(404).send({ error: 'Topluluk bulunamadı' })
      const { group } = result

      const isOwner = group.ownerId === ctx.actor.id
      const mod = await isMod(ctx.actor.id, group.id)
      if (!isOwner && !mod) return reply.code(403).send({ error: 'Yetersiz yetki' })

      await db.delete(communityFlairs).where(
        and(eq(communityFlairs.id, req.params.flairId), eq(communityFlairs.communityId, group.id)),
      )

      return reply.send({ ok: true })
    },
  )

  // ── Badge endpoints ───────────────────────────────────────────────────────

  // GET /api/communities/:handle/badges — list badges
  app.get<{ Params: { handle: string } }>(
    '/api/communities/:handle/badges',
    async (req, reply) => {
      const result = await getGroupWithActor(req.params.handle)
      if (!result) return reply.code(404).send({ error: 'Topluluk bulunamadı' })
      const { group } = result

      const badges = await db.query.communityBadges.findMany({
        where: eq(communityBadges.communityId, group.id),
        orderBy: [communityBadges.createdAt],
      })

      return reply.send(badges.map((b) => ({
        id: b.id,
        name: b.name,
        icon: b.icon,
        description: b.description,
        color: b.color,
        createdAt: b.createdAt,
      })))
    },
  )

  // POST /api/communities/:handle/badges — create badge (mod/owner)
  app.post<{ Params: { handle: string } }>(
    '/api/communities/:handle/badges',
    async (req, reply) => {
      const ctx = await requireMastodonUser(req, reply)
      if (!ctx) return

      const result = await getGroupWithActor(req.params.handle)
      if (!result) return reply.code(404).send({ error: 'Topluluk bulunamadı' })
      const { group } = result

      const isOwner = group.ownerId === ctx.actor.id
      const mod = await isMod(ctx.actor.id, group.id)
      if (!isOwner && !mod) return reply.code(403).send({ error: 'Yetersiz yetki' })

      const body = z.object({
        name: z.string().min(1).max(80),
        icon: z.string().min(1).max(10).default('🏅'),
        description: z.string().max(300).optional(),
        color: z.enum(['coral', 'teal', 'blue', 'purple', 'green', 'orange', 'red']).default('coral'),
      }).safeParse(req.body)
      if (!body.success) return reply.code(422).send({ error: 'Geçersiz rozet bilgisi' })

      const existing = await db.query.communityBadges.findMany({ where: eq(communityBadges.communityId, group.id), columns: { id: true } })
      if (existing.length >= 20) return reply.code(400).send({ error: 'Topluluk başına en fazla 20 rozet tanımlanabilir' })

      const [badge] = await db.insert(communityBadges).values({
        communityId: group.id,
        name: body.data.name,
        icon: body.data.icon,
        description: body.data.description ?? null,
        color: body.data.color,
        createdBy: ctx.actor.id,
      }).returning()

      return reply.code(201).send({
        id: badge!.id, name: badge!.name, icon: badge!.icon,
        description: badge!.description, color: badge!.color, createdAt: badge!.createdAt,
      })
    },
  )

  // DELETE /api/communities/:handle/badges/:badgeId — delete badge (mod/owner)
  app.delete<{ Params: { handle: string; badgeId: string } }>(
    '/api/communities/:handle/badges/:badgeId',
    async (req, reply) => {
      const ctx = await requireMastodonUser(req, reply)
      if (!ctx) return

      const result = await getGroupWithActor(req.params.handle)
      if (!result) return reply.code(404).send({ error: 'Topluluk bulunamadı' })
      const { group } = result

      const isOwner = group.ownerId === ctx.actor.id
      const mod = await isMod(ctx.actor.id, group.id)
      if (!isOwner && !mod) return reply.code(403).send({ error: 'Yetersiz yetki' })

      await db.delete(communityBadges).where(
        and(eq(communityBadges.id, req.params.badgeId), eq(communityBadges.communityId, group.id)),
      )

      return reply.send({ ok: true })
    },
  )

  // POST /api/communities/:handle/members/:memberHandle/badges/:badgeId — award badge
  app.post<{ Params: { handle: string; memberHandle: string; badgeId: string } }>(
    '/api/communities/:handle/members/:memberHandle/badges/:badgeId',
    async (req, reply) => {
      const ctx = await requireMastodonUser(req, reply)
      if (!ctx) return

      const result = await getGroupWithActor(req.params.handle)
      if (!result) return reply.code(404).send({ error: 'Topluluk bulunamadı' })
      const { group } = result

      const isOwner = group.ownerId === ctx.actor.id
      const mod = await isMod(ctx.actor.id, group.id)
      if (!isOwner && !mod) return reply.code(403).send({ error: 'Yetersiz yetki' })

      const target = await db.query.actors.findFirst({ where: eq(actors.handle, req.params.memberHandle) })
      if (!target) return reply.code(404).send({ error: 'Kullanıcı bulunamadı' })

      const badge = await db.query.communityBadges.findFirst({
        where: and(eq(communityBadges.id, req.params.badgeId), eq(communityBadges.communityId, group.id)),
      })
      if (!badge) return reply.code(404).send({ error: 'Rozet bulunamadı' })

      const body = z.object({ note: z.string().max(200).optional() }).safeParse(req.body)
      const note = body.success ? (body.data.note ?? null) : null

      await db.insert(userCommunityBadges).values({
        badgeId: badge.id,
        actorId: target.id,
        communityId: group.id,
        awardedBy: ctx.actor.id,
        note,
      }).onConflictDoNothing()

      await logMod({ communityId: group.id, actorId: ctx.actor.id, action: 'approve_member', targetUserId: target.id, metadata: { badge: badge.name } })

      return reply.send({ ok: true })
    },
  )

  // DELETE /api/communities/:handle/members/:memberHandle/badges/:badgeId — revoke badge
  app.delete<{ Params: { handle: string; memberHandle: string; badgeId: string } }>(
    '/api/communities/:handle/members/:memberHandle/badges/:badgeId',
    async (req, reply) => {
      const ctx = await requireMastodonUser(req, reply)
      if (!ctx) return

      const result = await getGroupWithActor(req.params.handle)
      if (!result) return reply.code(404).send({ error: 'Topluluk bulunamadı' })
      const { group } = result

      const isOwner = group.ownerId === ctx.actor.id
      const mod = await isMod(ctx.actor.id, group.id)
      if (!isOwner && !mod) return reply.code(403).send({ error: 'Yetersiz yetki' })

      const target = await db.query.actors.findFirst({ where: eq(actors.handle, req.params.memberHandle) })
      if (!target) return reply.code(404).send({ error: 'Kullanıcı bulunamadı' })

      await db.delete(userCommunityBadges).where(
        and(
          eq(userCommunityBadges.badgeId, req.params.badgeId),
          eq(userCommunityBadges.actorId, target.id),
        ),
      )

      return reply.send({ ok: true })
    },
  )

  // GET /api/communities/:handle/members/:memberHandle/trust — trust info
  app.get<{ Params: { handle: string; memberHandle: string } }>(
    '/api/communities/:handle/members/:memberHandle/trust',
    async (req, reply) => {
      const result = await getGroupWithActor(req.params.handle)
      if (!result) return reply.code(404).send({ error: 'Topluluk bulunamadı' })
      const { actor: groupActor, group } = result

      if (group.visibility === 'private') {
        const ctx = await getMastodonUser(req)
        if (!ctx) return reply.code(403).send({ error: 'Giriş gerekli' })
        const member = await isMember(ctx.actor.id, groupActor.id)
        if (!member && group.ownerId !== ctx.actor.id) return reply.code(403).send({ error: 'Üye değilsiniz' })
      }

      const target = await db.query.actors.findFirst({ where: eq(actors.handle, req.params.memberHandle) })
      if (!target) return reply.code(404).send({ error: 'Kullanıcı bulunamadı' })

      const trust = await db.query.communityTrustRecord.findFirst({
        where: and(
          eq(communityTrustRecord.communityId, group.id),
          eq(communityTrustRecord.actorId, target.id),
        ),
      })

      const badges = await db.query.userCommunityBadges.findMany({
        where: and(
          eq(userCommunityBadges.actorId, target.id),
          eq(userCommunityBadges.communityId, group.id),
        ),
        with: { badge: true },
      })

      // Konfedere Güven (3.3): find badges from allied communities
      const activePartnerships = await db.query.communityPartnerships.findMany({
        where: and(
          sql`(${communityPartnerships.communityAId} = ${group.id} OR ${communityPartnerships.communityBId} = ${group.id})`,
          eq(communityPartnerships.status, 'active'),
        ),
      })
      const alliedGroupIds = activePartnerships.map((p) =>
        p.communityAId === group.id ? p.communityBId : p.communityAId,
      )
      type AlliedBadgeEntry = {
        id: string; name: string; icon: string; color: string
        communityHandle: string; communityName: string | null
      }
      let alliedBadges: AlliedBadgeEntry[] = []
      if (alliedGroupIds.length > 0) {
        const alliedBadgeRows = await db.query.userCommunityBadges.findMany({
          where: and(
            eq(userCommunityBadges.actorId, target.id),
            inArray(userCommunityBadges.communityId, alliedGroupIds),
          ),
          with: { badge: true },
        })
        if (alliedBadgeRows.length > 0) {
          const alliedActorGroups = await db.query.apGroups.findMany({
            where: inArray(apGroups.id, alliedGroupIds),
            columns: { id: true, actorId: true },
          })
          const alliedActorIds = alliedActorGroups.map((g) => g.actorId)
          const alliedActors = alliedActorIds.length
            ? await db.query.actors.findMany({ where: inArray(actors.id, alliedActorIds), columns: { id: true, handle: true, displayName: true } })
            : []
          const alliedActorByGroupId = new Map(alliedActorGroups.map((g) => [g.id, alliedActors.find((a) => a.id === g.actorId)]))
          alliedBadges = alliedBadgeRows.map((ub) => {
            const communityActor = alliedActorByGroupId.get(ub.communityId)
            return {
              id: ub.badge.id,
              name: ub.badge.name,
              icon: ub.badge.icon,
              color: ub.badge.color,
              communityHandle: communityActor?.handle ?? '',
              communityName: communityActor?.displayName ?? null,
            }
          })
        }
      }

      return reply.send({
        trustLevel: trust?.trustLevel ?? 'new',
        postCount: trust?.postCount ?? 0,
        likesReceived: trust?.likesReceived ?? 0,
        badges: badges.map((ub) => ({
          id: ub.badge.id,
          name: ub.badge.name,
          icon: ub.badge.icon,
          description: ub.badge.description,
          color: ub.badge.color,
          awardedAt: ub.awardedAt,
          note: ub.note,
        })),
        alliedBadges,
      })
    },
  )

  // ── Modlog endpoint ───────────────────────────────────────────────────────

  // GET /api/communities/:handle/modlog — mod/owner only, paginated
  app.get<{ Params: { handle: string }; Querystring: { limit?: string; cursor?: string } }>(
    '/api/communities/:handle/modlog',
    async (req, reply) => {
      const ctx = await requireMastodonUser(req, reply)
      if (!ctx) return

      const result = await getGroupWithActor(req.params.handle)
      if (!result) return reply.code(404).send({ error: 'Topluluk bulunamadı' })
      const { group } = result

      const isOwner = group.ownerId === ctx.actor.id
      const mod = await isMod(ctx.actor.id, group.id)
      if (!isOwner && !mod) return reply.code(403).send({ error: 'Yetersiz yetki' })

      const limit = Math.min(parseInt(req.query.limit ?? '50', 10), 100)

      const rows = await db.query.communityModlog.findMany({
        where: eq(communityModlog.communityId, group.id),
        orderBy: [desc(communityModlog.createdAt)],
        limit: limit + 1,
        with: {
          actor: { columns: { handle: true, displayName: true, avatarUrl: true } },
          targetUser: { columns: { handle: true, displayName: true } },
        },
      })

      const hasMore = rows.length > limit
      const items = rows.slice(0, limit)

      return reply.send({
        items: items.map((r) => ({
          id: r.id,
          action: r.action,
          reason: r.reason,
          metadata: r.metadata,
          createdAt: r.createdAt,
          actor: { handle: r.actor.handle, displayName: r.actor.displayName },
          targetUser: r.targetUser ? { handle: r.targetUser.handle, displayName: r.targetUser.displayName } : null,
          targetPostId: r.targetPostId,
        })),
        hasMore,
      })
    },
  )

  // ── Federe Topluluk Keşfi ────────────────────────────────────────────────

  // POST /api/communities/resolve-remote — WebFinger + AP actor lookup for a remote Group
  app.post<{ Body: { handle: string } }>(
    '/api/communities/resolve-remote',
    async (req, reply) => {
      const ctx = await requireMastodonUser(req, reply)
      if (!ctx) return

      const body = z.object({ handle: z.string().min(3).max(200) }).safeParse(req.body)
      if (!body.success) return reply.code(422).send({ error: 'Geçersiz handle' })

      // Accept @community@instance.tld or community@instance.tld
      const raw = body.data.handle.replace(/^@/, '')
      const parts = raw.split('@')
      if (parts.length !== 2 || !parts[0] || !parts[1]) {
        return reply.code(422).send({ error: 'Format: @topluluk@instance.tld' })
      }
      const [username, instance] = parts

      if (await isSuspendedDomain(instance)) {
        return reply.code(403).send({ error: 'Bu instance engellenmiş' })
      }

      try {
        // 1. WebFinger
        const wfRes = await fetch(
          `https://${instance}/.well-known/webfinger?resource=acct:${username}@${instance}`,
          { headers: { Accept: 'application/json' }, signal: AbortSignal.timeout(8000) },
        )
        if (!wfRes.ok) return reply.code(404).send({ error: 'Topluluk bulunamadı' })

        const wf = await wfRes.json() as { links?: Array<{ rel: string; type?: string; href?: string }> }
        const apUrl = wf.links?.find((l) => l.rel === 'self' && (l.type?.includes('activity+json') ?? false))?.href
        if (!apUrl) return reply.code(400).send({ error: 'Bu sunucu ActivityPub desteklemiyor' })

        // 2. Fetch AP actor
        const remoteActor = await fetchRemoteActor(apUrl)
        if (!remoteActor) return reply.code(404).send({ error: 'AP actor alınamadı' })

        if (remoteActor.actorType !== 'Group') {
          return reply.code(400).send({ error: 'Bu hesap bir topluluk değil (Group actor değil)' })
        }

        // Check current follow status
        const existingFollow = await db.query.follows.findFirst({
          where: and(eq(follows.followerId, ctx.actor.id), eq(follows.followingId, remoteActor.id)),
        })

        return reply.send({
          id: remoteActor.id,
          handle: remoteActor.handle,
          displayName: remoteActor.displayName,
          bio: remoteActor.bio,
          avatarUrl: remoteActor.avatarUrl,
          followersCount: remoteActor.followersCount,
          isLocked: remoteActor.isLocked,
          followStatus: existingFollow?.status ?? null,
          apId: remoteActor.apId,
          inboxUrl: remoteActor.inboxUrl,
        })
      } catch (err) {
        return reply.code(502).send({ error: 'Uzak sunucuya ulaşılamadı' })
      }
    },
  )

  // POST /api/communities/follow-remote — send AP Follow to a remote Group
  app.post<{ Body: { actorId: string } }>(
    '/api/communities/follow-remote',
    async (req, reply) => {
      const ctx = await requireMastodonUser(req, reply)
      if (!ctx) return

      const body = z.object({ actorId: z.string().uuid() }).safeParse(req.body)
      if (!body.success) return reply.code(422).send({ error: 'actorId gerekli' })

      const remoteActor = await db.query.actors.findFirst({ where: eq(actors.id, body.data.actorId) })
      if (!remoteActor || remoteActor.actorType !== 'Group') {
        return reply.code(404).send({ error: 'Uzak topluluk bulunamadı' })
      }
      if (remoteActor.isLocal) {
        return reply.code(400).send({ error: 'Yerel topluluklar için /join kullanın' })
      }

      // Idempotent — skip if already following/pending
      const existing = await db.query.follows.findFirst({
        where: and(eq(follows.followerId, ctx.actor.id), eq(follows.followingId, remoteActor.id)),
      })
      if (existing) {
        return reply.send({ status: existing.status })
      }

      // Create pending follow
      const [follow] = await db.insert(follows).values({
        followerId: ctx.actor.id,
        followingId: remoteActor.id,
        status: 'pending',
      }).returning({ id: follows.id })

      // Send AP Follow activity
      const followActivity = buildFollow(ctx.actor.handle, remoteActor.apId!, follow!.id)

      if (remoteActor.inboxUrl) {
        // deliverToInbox(senderHandle, targetInboxUrl, activity) — args were swapped
        await deliverToInbox(ctx.actor.handle, remoteActor.inboxUrl, followActivity)
      }

      return reply.send({ status: 'pending' })
    },
  )

  // DELETE /api/communities/follow-remote/:actorId — unfollow a remote Group
  app.delete<{ Params: { actorId: string } }>(
    '/api/communities/follow-remote/:actorId',
    async (req, reply) => {
      const ctx = await requireMastodonUser(req, reply)
      if (!ctx) return

      const remoteActor = await db.query.actors.findFirst({ where: eq(actors.id, req.params.actorId) })
      if (!remoteActor) return reply.code(404).send({ error: 'Bulunamadı' })

      await db.delete(follows).where(
        and(eq(follows.followerId, ctx.actor.id), eq(follows.followingId, remoteActor.id)),
      )

      return reply.send({ ok: true })
    },
  )

  // GET /api/communities/following-remote — list remote Groups the current user follows
  app.get(
    '/api/communities/following-remote',
    async (req, reply) => {
      const ctx = await requireMastodonUser(req, reply)
      if (!ctx) return

      const rows = await db.query.follows.findMany({
        where: and(eq(follows.followerId, ctx.actor.id), eq(follows.status, 'accepted')),
        with: { following: true },
      })

      const remoteGroups = rows
        .filter((r) => !r.following.isLocal && r.following.actorType === 'Group')
        .map((r) => ({
          id: r.following.id,
          handle: r.following.handle,
          displayName: r.following.displayName,
          avatarUrl: r.following.avatarUrl,
          bio: r.following.bio,
          followStatus: r.status,
          apId: r.following.apId,
        }))

      return reply.send(remoteGroups)
    },
  )

  // ── Partnerships ──────────────────────────────────────────────────────────

  // GET /api/communities/:handle/partnerships — list partnerships (active + pending for this community)
  app.get<{ Params: { handle: string } }>(
    '/api/communities/:handle/partnerships',
    async (req, reply) => {
      const result = await getGroupWithActor(req.params.handle)
      if (!result) return reply.code(404).send({ error: 'Topluluk bulunamadı' })
      const { group } = result

      const rows = await db.query.communityPartnerships.findMany({
        where: and(
          sql`(${communityPartnerships.communityAId} = ${group.id} OR ${communityPartnerships.communityBId} = ${group.id})`,
          ne(communityPartnerships.status, 'rejected'),
        ),
        orderBy: [desc(communityPartnerships.createdAt)],
      })

      // Resolve the partner community for each row
      const partnerIds = rows.map((r) =>
        r.communityAId === group.id ? r.communityBId : r.communityAId,
      )
      const partnerActors = partnerIds.length
        ? await db.query.actors.findMany({ where: inArray(actors.id, partnerIds) })
        : []
      const partnerActorById = new Map(partnerActors.map((a) => [a.id, a]))
      const partnerGroups = partnerIds.length
        ? await db.query.apGroups.findMany({ where: inArray(apGroups.actorId, partnerIds) })
        : []
      const partnerGroupByActorId = new Map(partnerGroups.map((g) => [g.actorId, g]))

      return reply.send(rows.map((r) => {
        const partnerId = r.communityAId === group.id ? r.communityBId : r.communityAId
        const partnerActor = partnerActorById.get(partnerId)
        const partnerGroup = partnerGroupByActorId.get(partnerId)
        return {
          id: r.id,
          status: r.status,
          direction: r.communityAId === group.id ? 'outgoing' : 'incoming',
          initiatedByUs: r.initiatedBy === result.actor.id,
          createdAt: r.createdAt.toISOString(),
          partner: partnerActor ? {
            id: partnerId,
            handle: partnerActor.handle,
            displayName: partnerActor.displayName,
            avatarUrl: partnerActor.avatarUrl,
            memberCount: partnerGroup?.memberCount ?? 0,
          } : null,
        }
      }))
    },
  )

  // POST /api/communities/:handle/partnerships — propose ittifak (mod/owner)
  app.post<{ Params: { handle: string }; Body: { targetHandle: string } }>(
    '/api/communities/:handle/partnerships',
    async (req, reply) => {
      const ctx = await requireMastodonUser(req, reply)
      if (!ctx) return

      const result = await getGroupWithActor(req.params.handle)
      if (!result) return reply.code(404).send({ error: 'Topluluk bulunamadı' })
      const { actor, group } = result

      const isOwnerOrMod = await isModOrOwner(ctx.actor.id, actor.id, group)
      if (!isOwnerOrMod) return reply.code(403).send({ error: 'Yetkisiz' })

      const { targetHandle } = req.body
      if (!targetHandle?.trim()) return reply.code(422).send({ error: 'Hedef topluluk belirtilmeli' })

      const targetResult = await getGroupWithActor(targetHandle.trim().replace(/^@/, '').split('@')[0]!)
      if (!targetResult) return reply.code(404).send({ error: 'Hedef topluluk bulunamadı' })

      if (targetResult.group.id === group.id) return reply.code(400).send({ error: 'Kendi topluluğunuza ittifak öneremezsiniz' })

      // Check existing partnership
      const existing = await db.query.communityPartnerships.findFirst({
        where: and(
          sql`(
            (${communityPartnerships.communityAId} = ${group.id} AND ${communityPartnerships.communityBId} = ${targetResult.group.id})
            OR
            (${communityPartnerships.communityAId} = ${targetResult.group.id} AND ${communityPartnerships.communityBId} = ${group.id})
          )`,
          ne(communityPartnerships.status, 'rejected'),
        ),
      })
      if (existing) return reply.code(409).send({ error: 'Bu toplulukla zaten bir ittifak isteği mevcut' })

      const [partnership] = await db.insert(communityPartnerships).values({
        communityAId: group.id,
        communityBId: targetResult.group.id,
        initiatedBy: ctx.actor.id,
        status: 'pending',
      }).returning()

      await logMod({ communityId: group.id, actorId: ctx.actor.id, action: 'update_settings',
        reason: `İttifak teklifi gönderildi: @${targetResult.actor.handle}` })

      return reply.code(201).send({ id: partnership!.id, status: 'pending' })
    },
  )

  // PATCH /api/communities/:handle/partnerships/:partnershipId — accept / reject
  app.patch<{ Params: { handle: string; partnershipId: string }; Body: { action: 'accept' | 'reject' } }>(
    '/api/communities/:handle/partnerships/:partnershipId',
    async (req, reply) => {
      const ctx = await requireMastodonUser(req, reply)
      if (!ctx) return

      const result = await getGroupWithActor(req.params.handle)
      if (!result) return reply.code(404).send({ error: 'Topluluk bulunamadı' })
      const { actor, group } = result

      const isOwnerOrMod = await isModOrOwner(ctx.actor.id, actor.id, group)
      if (!isOwnerOrMod) return reply.code(403).send({ error: 'Yetkisiz' })

      const partnership = await db.query.communityPartnerships.findFirst({
        where: and(
          eq(communityPartnerships.id, req.params.partnershipId),
          eq(communityPartnerships.communityBId, group.id), // only recipient can accept/reject
          eq(communityPartnerships.status, 'pending'),
        ),
      })
      if (!partnership) return reply.code(404).send({ error: 'İttifak isteği bulunamadı' })

      const newStatus = req.body.action === 'accept' ? 'active' : 'rejected'
      await db.update(communityPartnerships)
        .set({ status: newStatus, updatedAt: new Date() })
        .where(eq(communityPartnerships.id, partnership.id))

      await logMod({ communityId: group.id, actorId: ctx.actor.id, action: 'update_settings',
        reason: `İttifak isteği ${newStatus === 'active' ? 'kabul edildi' : 'reddedildi'}` })

      return reply.send({ ok: true, status: newStatus })
    },
  )

  // DELETE /api/communities/:handle/partnerships/:partnershipId — dissolve / cancel
  app.delete<{ Params: { handle: string; partnershipId: string } }>(
    '/api/communities/:handle/partnerships/:partnershipId',
    async (req, reply) => {
      const ctx = await requireMastodonUser(req, reply)
      if (!ctx) return

      const result = await getGroupWithActor(req.params.handle)
      if (!result) return reply.code(404).send({ error: 'Topluluk bulunamadı' })
      const { actor, group } = result

      const isOwnerOrMod = await isModOrOwner(ctx.actor.id, actor.id, group)
      if (!isOwnerOrMod) return reply.code(403).send({ error: 'Yetkisiz' })

      const partnership = await db.query.communityPartnerships.findFirst({
        where: and(
          eq(communityPartnerships.id, req.params.partnershipId),
          sql`(${communityPartnerships.communityAId} = ${group.id} OR ${communityPartnerships.communityBId} = ${group.id})`,
        ),
      })
      if (!partnership) return reply.code(404).send({ error: 'İttifak bulunamadı' })

      await db.delete(communityPartnerships).where(eq(communityPartnerships.id, partnership.id))
      await logMod({ communityId: group.id, actorId: ctx.actor.id, action: 'update_settings', reason: 'İttifak çözüldü' })

      return reply.send({ ok: true })
    },
  )

  // GET /api/communities/:handle/allied-feed — yüksek etkileşimli gönderiler (müttefik topluluklar)
  app.get<{ Params: { handle: string }; Querystring: { limit?: string; cursor?: string } }>(
    '/api/communities/:handle/allied-feed',
    async (req, reply) => {
      const result = await getGroupWithActor(req.params.handle)
      if (!result) return reply.code(404).send({ error: 'Topluluk bulunamadı' })
      const { group } = result

      // Find active partner community IDs
      const partnerships = await db.query.communityPartnerships.findMany({
        where: and(
          sql`(${communityPartnerships.communityAId} = ${group.id} OR ${communityPartnerships.communityBId} = ${group.id})`,
          eq(communityPartnerships.status, 'active'),
        ),
      })
      const partnerGroupIds = partnerships.map((p) =>
        p.communityAId === group.id ? p.communityBId : p.communityAId,
      )
      if (partnerGroupIds.length === 0) return reply.send({ posts: [], next_cursor: null })

      // Get actor IDs for partner groups
      const partnerGroupRows = await db.query.apGroups.findMany({
        where: inArray(apGroups.id, partnerGroupIds),
        columns: { id: true, actorId: true },
      })
      const partnerActorIds = partnerGroupRows.map((g) => g.actorId)

      const limit = Math.min(Number(req.query.limit ?? 20), 40)
      const cursor = req.query.cursor

      const postRows = await db.query.posts.findMany({
        where: and(
          inArray(posts.groupId, partnerActorIds),
          eq(posts.isDeleted, false),
          cursor ? sql`${posts.createdAt} < ${new Date(cursor)}` : undefined,
        ),
        orderBy: [desc(posts.createdAt)],
        limit: limit + 1,
      })

      const hasMore = postRows.length > limit
      const slice = hasMore ? postRows.slice(0, limit) : postRows
      const enriched = await import('../lib/enrichPosts.js').then((m) => m.enrichPosts(slice))

      return reply.send({
        posts: enriched,
        next_cursor: hasMore ? slice[slice.length - 1]!.createdAt.toISOString() : null,
      })
    },
  )

  // ── Endorsement / Reference Letter ───────────────────────────────────────

  // GET /api/communities/:handle/endorsements/:actorHandle
  // Returns Activity Streams 2.0 JSON-LD endorsement document, signed with community private key
  app.get<{ Params: { handle: string; actorHandle: string } }>(
    '/api/communities/:handle/endorsements/:actorHandle',
    async (req, reply) => {
      const result = await getGroupWithActor(req.params.handle)
      if (!result) return reply.code(404).send({ error: 'Topluluk bulunamadı' })
      const { actor: groupActor, group } = result

      // Require group private key
      if (!groupActor.privateKeyEncrypted) {
        return reply.code(500).send({ error: 'Topluluk imzalama anahtarı bulunamadı' })
      }

      const target = await db.query.actors.findFirst({
        where: eq(actors.handle, req.params.actorHandle),
      })
      if (!target) return reply.code(404).send({ error: 'Kullanıcı bulunamadı' })

      // Must be a member
      const member = await isMember(target.id, groupActor.id)
      const isOwner = group.ownerId === target.id
      if (!member && !isOwner) return reply.code(403).send({ error: 'Topluluk üyesi değil' })

      // Fetch trust record + badges
      const trust = await db.query.communityTrustRecord.findFirst({
        where: and(
          eq(communityTrustRecord.communityId, group.id),
          eq(communityTrustRecord.actorId, target.id),
        ),
      })

      const badgeRows = await db.query.userCommunityBadges.findMany({
        where: and(
          eq(userCommunityBadges.actorId, target.id),
          eq(userCommunityBadges.communityId, group.id),
        ),
        with: { badge: true },
      })

      const baseUrl = env.APP_URL
      const communityActorUrl = actorUrl(groupActor.handle)
      const memberActorUrl = actorUrl(target.handle)
      const endorsementId = `${baseUrl}/api/communities/${group.id}/endorsements/${target.id}`
      const issuedAt = new Date().toISOString()

      // Build Activity Streams 2.0 document
      const document = {
        '@context': [
          'https://www.w3.org/ns/activitystreams',
          'https://w3id.org/security/v1',
          { floq: 'https://floq.com/ns#', trustLevel: 'floq:trustLevel', postCount: 'floq:postCount' },
        ],
        id: endorsementId,
        type: 'Relationship',
        actor: {
          id: communityActorUrl,
          type: 'Group',
          name: groupActor.displayName ?? groupActor.handle,
          preferredUsername: groupActor.handle,
        },
        object: {
          id: memberActorUrl,
          type: 'Person',
          preferredUsername: target.handle,
          name: target.displayName ?? target.handle,
        },
        relationship: 'hasMember',
        summary: `${groupActor.displayName ?? groupActor.handle} topluluğu ${target.displayName ?? target.handle} üyesini onaylar.`,
        content: [
          trust?.trustLevel && trust.trustLevel !== 'new'
            ? `Güven seviyesi: ${trust.trustLevel}`
            : 'Aktif üye',
          trust?.postCount ? `${trust.postCount} topluluk gönderisi` : null,
          trust?.likesReceived ? `${trust.likesReceived} beğeni aldı` : null,
        ].filter(Boolean).join(' · '),
        tag: badgeRows.map((ub) => ({
          type: 'floq:CommunityBadge',
          name: ub.badge.name,
          icon: ub.badge.icon,
          id: `${baseUrl}/api/communities/${group.id}/badges/${ub.badge.id}`,
        })),
        published: issuedAt,
        attributedTo: communityActorUrl,
        proof: {
          type: 'RsaSignature2017',
          created: issuedAt,
          creator: `${communityActorUrl}#main-key`,
          signatureValue: '',
        },
      }

      // Sign the document: SHA-256 digest of canonical JSON, then RSA-SHA256 sign
      const canonicalBody = JSON.stringify(document)
      const digest = createHash('sha256').update(canonicalBody).digest('base64')
      const privateKeyPem = decryptPrivateKey(groupActor.privateKeyEncrypted)
      const signer = createSign('RSA-SHA256')
      signer.update(canonicalBody)
      const signatureValue = signer.sign(privateKeyPem, 'base64')

      document.proof.signatureValue = signatureValue

      return reply
        .header('Content-Type', 'application/ld+json; profile="https://www.w3.org/ns/activitystreams"')
        .header('X-Content-Digest', `SHA-256=${digest}`)
        .send(document)
    },
  )

  // ── Confederation Votes ───────────────────────────────────────────────────

  // GET /api/communities/:handle/votes — list votes (own + received as target)
  app.get<{ Params: { handle: string } }>(
    '/api/communities/:handle/votes',
    async (req, reply) => {
      const result = await getGroupWithActor(req.params.handle)
      if (!result) return reply.code(404).send({ error: 'Topluluk bulunamadı' })
      const { group } = result

      const ctx = await getMastodonUser(req)

      // Fetch votes initiated by this community OR where this community is a target
      const allVotes = await db.query.confederationVotes.findMany({
        orderBy: [desc(confederationVotes.createdAt)],
      })
      const relevant = allVotes.filter(
        (v) => v.initiatorCommunityId === group.id ||
          (v.targetCommunityIds as string[]).includes(group.id),
      )

      // Fetch ballot counts per vote
      const voteIds = relevant.map((v) => v.id)
      const ballotRows = voteIds.length
        ? await db.query.confederationVoteBallots.findMany({
            where: inArray(confederationVoteBallots.voteId, voteIds),
          })
        : []

      // My ballot per vote
      const myBallots = ctx
        ? new Map(
            ballotRows
              .filter((b) => b.actorId === ctx.actor.id)
              .map((b) => [b.voteId, b.optionIndex]),
          )
        : new Map<string, number>()

      // Tally results per vote
      type Tally = { optionIndex: number; count: number; communityId: string }[]
      const tallyByVote = new Map<string, Tally>()
      for (const b of ballotRows) {
        if (!tallyByVote.has(b.voteId)) tallyByVote.set(b.voteId, [])
        const t = tallyByVote.get(b.voteId)!
        const existing = t.find((x) => x.optionIndex === b.optionIndex)
        if (existing) existing.count++
        else t.push({ optionIndex: b.optionIndex, count: 1, communityId: b.communityId })
      }

      // Resolve initiator community handles
      const initiatorIds = [...new Set(relevant.map((v) => v.initiatorCommunityId))]
      const initiatorGroups = initiatorIds.length
        ? await db.query.apGroups.findMany({ where: inArray(apGroups.id, initiatorIds), columns: { id: true, actorId: true } })
        : []
      const initiatorActorIds = initiatorGroups.map((g) => g.actorId)
      const initiatorActors = initiatorActorIds.length
        ? await db.query.actors.findMany({ where: inArray(actors.id, initiatorActorIds), columns: { id: true, handle: true, displayName: true } })
        : []
      const actorByGroupId = new Map(
        initiatorGroups.map((g) => [g.id, initiatorActors.find((a) => a.id === g.actorId)]),
      )

      const now = new Date()
      return reply.send(relevant.map((v) => {
        const tally = tallyByVote.get(v.id) ?? []
        const totalVotes = tally.reduce((s, t) => s + t.count, 0)
        const options = (v.options as string[]).map((text, i) => ({
          index: i,
          text,
          count: tally.filter((t) => t.optionIndex === i).reduce((s, t) => s + t.count, 0),
        }))
        return {
          id: v.id,
          title: v.title,
          description: v.description,
          options,
          totalVotes,
          targetCommunityIds: v.targetCommunityIds,
          closed: v.closesAt < now,
          closesAt: v.closesAt.toISOString(),
          createdAt: v.createdAt.toISOString(),
          isInitiator: v.initiatorCommunityId === group.id,
          myVote: ctx ? (myBallots.get(v.id) ?? null) : null,
          initiator: actorByGroupId.get(v.initiatorCommunityId) ?? null,
        }
      }))
    },
  )

  // POST /api/communities/:handle/votes — create a vote (mod/owner)
  app.post<{
    Params: { handle: string }
    Body: { title: string; description?: string; options: string[]; targetHandles: string[]; closesInHours: number }
  }>(
    '/api/communities/:handle/votes',
    async (req, reply) => {
      const ctx = await requireMastodonUser(req, reply)
      if (!ctx) return

      const result = await getGroupWithActor(req.params.handle)
      if (!result) return reply.code(404).send({ error: 'Topluluk bulunamadı' })
      const { actor, group } = result

      const isOwnerOrMod = await isModOrOwner(ctx.actor.id, actor.id, group)
      if (!isOwnerOrMod) return reply.code(403).send({ error: 'Yetkisiz' })

      const { title, description, options, targetHandles, closesInHours } = req.body
      if (!title?.trim()) return reply.code(422).send({ error: 'Başlık gerekli' })
      if (!options || options.length < 2) return reply.code(422).send({ error: 'En az 2 seçenek gerekli' })
      if (!targetHandles || targetHandles.length === 0) return reply.code(422).send({ error: 'En az 1 hedef topluluk gerekli' })

      // Resolve target communities — must be active partners
      const partnerships = await db.query.communityPartnerships.findMany({
        where: and(
          sql`(${communityPartnerships.communityAId} = ${group.id} OR ${communityPartnerships.communityBId} = ${group.id})`,
          eq(communityPartnerships.status, 'active'),
        ),
      })
      const partnerGroupIds = new Set(partnerships.map((p) =>
        p.communityAId === group.id ? p.communityBId : p.communityAId,
      ))

      const targetGroupRows = await db.query.apGroups.findMany({
        where: and(
          inArray(apGroups.actorId, await db.query.actors
            .findMany({ where: inArray(actors.handle, targetHandles), columns: { id: true } })
            .then((rows) => rows.map((r) => r.id))),
        ),
      })
      const validTargetIds = targetGroupRows
        .filter((g) => partnerGroupIds.has(g.id))
        .map((g) => g.id)

      if (validTargetIds.length === 0) return reply.code(400).send({ error: 'Geçerli müttefik topluluk bulunamadı' })

      const closesAt = new Date(Date.now() + (closesInHours ?? 48) * 60 * 60 * 1000)

      const [vote] = await db.insert(confederationVotes).values({
        initiatorCommunityId: group.id,
        createdBy: ctx.actor.id,
        title: title.trim(),
        description: description?.trim() ?? null,
        options: options.map((o) => o.trim()).filter(Boolean),
        targetCommunityIds: validTargetIds,
        closesAt,
      }).returning()

      return reply.code(201).send({ id: vote!.id })
    },
  )

  // POST /api/communities/:handle/votes/:voteId/ballot — cast a vote
  app.post<{ Params: { handle: string; voteId: string }; Body: { optionIndex: number } }>(
    '/api/communities/:handle/votes/:voteId/ballot',
    async (req, reply) => {
      const ctx = await requireMastodonUser(req, reply)
      if (!ctx) return

      const result = await getGroupWithActor(req.params.handle)
      if (!result) return reply.code(404).send({ error: 'Topluluk bulunamadı' })
      const { group } = result

      // Must be a member of this community
      const member = await isMember(ctx.actor.id, result.actor.id)
      const isOwner = group.ownerId === ctx.actor.id
      if (!member && !isOwner) return reply.code(403).send({ error: 'Üye değilsiniz' })

      const vote = await db.query.confederationVotes.findFirst({
        where: eq(confederationVotes.id, req.params.voteId),
      })
      if (!vote) return reply.code(404).send({ error: 'Oylama bulunamadı' })
      if (vote.closesAt < new Date()) return reply.code(400).send({ error: 'Oylama kapandı' })

      const eligible = vote.initiatorCommunityId === group.id ||
        (vote.targetCommunityIds as string[]).includes(group.id)
      if (!eligible) return reply.code(403).send({ error: 'Bu oylama için yetkisiz' })

      const { optionIndex } = req.body
      if (typeof optionIndex !== 'number' || optionIndex < 0 || optionIndex >= (vote.options as string[]).length) {
        return reply.code(422).send({ error: 'Geçersiz seçenek' })
      }

      await db.insert(confederationVoteBallots)
        .values({ voteId: vote.id, actorId: ctx.actor.id, communityId: group.id, optionIndex })
        .onConflictDoUpdate({
          target: [confederationVoteBallots.voteId, confederationVoteBallots.actorId],
          set: { optionIndex, communityId: group.id },
        })

      return reply.send({ ok: true })
    },
  )

  // DELETE /api/communities/:handle/votes/:voteId — delete vote (initiator mod/owner only)
  app.delete<{ Params: { handle: string; voteId: string } }>(
    '/api/communities/:handle/votes/:voteId',
    async (req, reply) => {
      const ctx = await requireMastodonUser(req, reply)
      if (!ctx) return

      const result = await getGroupWithActor(req.params.handle)
      if (!result) return reply.code(404).send({ error: 'Topluluk bulunamadı' })
      const { actor, group } = result

      const isOwnerOrMod = await isModOrOwner(ctx.actor.id, actor.id, group)
      if (!isOwnerOrMod) return reply.code(403).send({ error: 'Yetkisiz' })

      const vote = await db.query.confederationVotes.findFirst({
        where: and(
          eq(confederationVotes.id, req.params.voteId),
          eq(confederationVotes.initiatorCommunityId, group.id),
        ),
      })
      if (!vote) return reply.code(404).send({ error: 'Oylama bulunamadı' })

      await db.delete(confederationVotes).where(eq(confederationVotes.id, vote.id))
      return reply.send({ ok: true })
    },
  )

  // ── Legacy / AP endpoints (backward compat) ───────────────────────────────

  // Redirect old /api/groups to /api/communities
  app.get<{ Params: { handle: string } }>('/api/groups/:handle', async (req, reply) => {
    return reply.redirect(`/api/communities/${req.params.handle}`)
  })

  // AP actor endpoint for groups
  app.get<{ Params: { handle: string } }>('/groups/:handle', async (req, reply) => {
    const actor = await db.query.actors.findFirst({
      where: and(eq(actors.handle, req.params.handle), eq(actors.actorType, 'Group')),
    })
    if (!actor) return reply.code(404).send({ error: 'Not found' })

    const accept = req.headers.accept ?? ''
    if (!accept.includes('application/activity+json') && !accept.includes('application/ld+json')) {
      return reply.redirect(`${env.WEB_URL}/c/${actor.handle}`)
    }

    reply.header('Content-Type', AP_CONTENT_TYPE)
    return reply.send({
      ...buildActor({ ...actor, actorType: 'Group' }),
      capabilities: { announce: 'https://w3id.org/fep/1b12' },
    })
  })
}
