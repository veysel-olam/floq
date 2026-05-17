import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify'
import { eq, and, desc, sql, gte } from 'drizzle-orm'
import { z } from 'zod'
import { db } from '../db/client.js'
import {
  instances, actors, reports, posts, apActivities, adminAuditLogs,
  instanceSettings, instanceRules, pendingRegistrations, mediaAttachments,
} from '../db/schema.js'
import { getSession } from '../lib/session.js'
import { notifySuspension } from '../lib/notify.js'

// ─── Auth helpers ─────────────────────────────────────────────────────────────

async function getActorForRequest(req: FastifyRequest) {
  const session = await getSession(req)
  if (!session) return null
  return db.query.actors.findFirst({ where: eq(actors.userId, session.user.id) })
}

async function requireAdmin(req: FastifyRequest, reply: FastifyReply) {
  const actor = await getActorForRequest(req)
  if (!actor || actor.role !== 'admin') {
    reply.code(403).send({ error: 'Forbidden' })
    return null
  }
  return actor
}

async function requireModerator(req: FastifyRequest, reply: FastifyReply) {
  const actor = await getActorForRequest(req)
  if (!actor || (actor.role !== 'admin' && actor.role !== 'moderator')) {
    reply.code(403).send({ error: 'Forbidden' })
    return null
  }
  return actor
}

async function logAction(actorId: string, action: string, targetType?: string, targetId?: string, details?: Record<string, unknown>) {
  await db.insert(adminAuditLogs).values({ actorId, action, targetType, targetId, details: details ?? null }).catch(() => {})
}

export async function adminRoutes(app: FastifyInstance) {
  // ─── Instance Management ──────────────────────────────────────────────────

  // GET /api/admin/instances — list known instances
  app.get('/api/admin/instances', async (req, reply) => {
    const actor = await requireAdmin(req, reply)
    if (!actor) return

    const all = await db.query.instances.findMany({
      orderBy: [desc(instances.lastSeenAt)],
    })

    return reply.send({ instances: all })
  })

  // POST /api/admin/instances/:domain/suspend — suspend an instance
  app.post<{ Params: { domain: string } }>('/api/admin/instances/:domain/suspend', async (req, reply) => {
    const actor = await requireAdmin(req, reply)
    if (!actor) return

    const domain = req.params.domain

    await db
      .insert(instances)
      .values({
        domain,
        isSuspended: true,
        suspendedAt: new Date(),
      } as typeof instances.$inferInsert)
      .onConflictDoUpdate({
        target: instances.domain,
        set: { isSuspended: true, suspendedAt: new Date() },
      })

    await logAction(actor.id, 'instance.suspend', 'instance', domain)

    return reply.send({ ok: true, domain, suspended: true })
  })

  // DELETE /api/admin/instances/:domain/suspend — unsuspend
  app.delete<{ Params: { domain: string } }>('/api/admin/instances/:domain/suspend', async (req, reply) => {
    const actor = await requireAdmin(req, reply)
    if (!actor) return

    await db
      .update(instances)
      .set({ isSuspended: false, suspendedAt: null })
      .where(eq(instances.domain, req.params.domain))

    await logAction(actor.id, 'instance.unsuspend', 'instance', req.params.domain)

    return reply.send({ ok: true, domain: req.params.domain, suspended: false })
  })

  // ─── Report Management ────────────────────────────────────────────────────

  // GET /api/admin/reports — list reports
  app.get<{ Querystring: { status?: string; limit?: string } }>('/api/admin/reports', async (req, reply) => {
    const actor = await requireModerator(req, reply)
    if (!actor) return

    const status = (req.query.status ?? 'pending') as 'pending' | 'reviewed_accepted' | 'reviewed_rejected'
    const limit = Math.min(Number(req.query.limit ?? 50), 100)

    const rows = await db.query.reports.findMany({
      where: eq(reports.status, status),
      orderBy: [desc(reports.createdAt)],
      limit,
      with: {
        reporter: true,
        post: { with: { author: true } },
        reportedActor: true,
      },
    })

    return reply.send({ reports: rows })
  })

  // PATCH /api/admin/reports/:id — review a report
  app.patch<{ Params: { id: string } }>('/api/admin/reports/:id', async (req, reply) => {
    const actor = await requireModerator(req, reply)
    if (!actor) return

    const body = z.object({
      status: z.enum(['reviewed_accepted', 'reviewed_rejected']),
      reviewNote: z.string().max(500).optional(),
      deletePost: z.boolean().default(false),
    }).safeParse(req.body)

    if (!body.success) return reply.code(400).send({ error: 'Invalid body' })

    const report = await db.query.reports.findFirst({ where: eq(reports.id, req.params.id) })
    if (!report) return reply.code(404).send({ error: 'Not found' })

    const [updated] = await db.update(reports)
      .set({ status: body.data.status, reviewNote: body.data.reviewNote ?? null, reviewedAt: new Date() })
      .where(eq(reports.id, req.params.id))
      .returning()

    // If accepted and deletePost=true, soft-delete the post
    if (body.data.status === 'reviewed_accepted' && body.data.deletePost && report.postId) {
      await db.update(posts).set({ isDeleted: true }).where(eq(posts.id, report.postId))
      // Also resolve all other pending reports for the same post
      await db.update(reports)
        .set({ status: 'reviewed_accepted', reviewedAt: new Date(), reviewNote: 'Auto-resolved with post deletion' })
        .where(and(eq(reports.postId, report.postId), eq(reports.status, 'pending')))
    }

    const action = body.data.status === 'reviewed_accepted' ? 'report.accept' : 'report.reject'
    await logAction(actor.id, action, 'report', report.id, { reason: report.reason, deletePost: body.data.deletePost })

    return reply.send(updated)
  })

  // GET /api/admin/stats — quick moderation stats
  app.get('/api/admin/stats', async (req, reply) => {
    const actor = await requireModerator(req, reply)
    if (!actor) return

    const [pending, accepted, rejected] = await Promise.all([
      db.select({ count: sql`count(*)` }).from(reports).where(eq(reports.status, 'pending')),
      db.select({ count: sql`count(*)` }).from(reports).where(eq(reports.status, 'reviewed_accepted')),
      db.select({ count: sql`count(*)` }).from(reports).where(eq(reports.status, 'reviewed_rejected')),
    ])

    return reply.send({
      pending: Number((pending[0] as { count: string }).count),
      accepted: Number((accepted[0] as { count: string }).count),
      rejected: Number((rejected[0] as { count: string }).count),
    })
  })

  // GET /api/admin/federation — federation health overview
  app.get('/api/admin/federation', async (req, reply) => {
    const actor = await requireAdmin(req, reply)
    if (!actor) return

    const since7d = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)
    const since24h = new Date(Date.now() - 24 * 60 * 60 * 1000)

    const [
      totalInstancesRes,
      activeInstancesRes,
      remoteActorsRes,
      outbound24hRes,
      inbound24hRes,
      failed24hRes,
      remoteFollowersRes,
      remoteFollowingRes,
    ] = await Promise.all([
      db.select({ count: sql<string>`count(*)` }).from(instances),
      db.select({ count: sql<string>`count(*)` }).from(instances)
        .where(and(gte(instances.lastSeenAt, since7d), eq(instances.isSuspended, false))),
      db.select({ count: sql<string>`count(*)` }).from(actors).where(eq(actors.isLocal, false)),
      db.select({ count: sql<string>`count(*)` }).from(apActivities)
        .where(and(eq(apActivities.direction, 'outbound'), gte(apActivities.createdAt, since24h))),
      db.select({ count: sql<string>`count(*)` }).from(apActivities)
        .where(and(eq(apActivities.direction, 'inbound'), gte(apActivities.createdAt, since24h))),
      db.select({ count: sql<string>`count(*)` }).from(apActivities)
        .where(and(eq(apActivities.status, 'failed'), gte(apActivities.createdAt, since24h))),
      // remote actors who follow local actors
      db.execute(sql`
        SELECT COUNT(DISTINCT f.follower_id)::int AS count
        FROM follows f
        JOIN actors ra ON ra.id = f.follower_id AND ra.is_local = false
        JOIN actors la ON la.id = f.following_id AND la.is_local = true
      `),
      // local actors who follow remote actors
      db.execute(sql`
        SELECT COUNT(DISTINCT f.following_id)::int AS count
        FROM follows f
        JOIN actors la ON la.id = f.follower_id AND la.is_local = true
        JOIN actors ra ON ra.id = f.following_id AND ra.is_local = false
      `),
    ])

    // Per-instance breakdown
    const instanceRows = await db.execute(sql`
      SELECT
        i.id, i.domain, i.software,
        i.software_version AS "softwareVersion",
        i.name,
        i.last_seen_at AS "lastSeenAt",
        i.is_suspended AS "isSuspended",
        i.is_silenced AS "isSilenced",
        COUNT(DISTINCT a.id)::int AS "actorsCount",
        (
          SELECT COUNT(DISTINCT f.follower_id)::int
          FROM follows f
          JOIN actors fa ON fa.id = f.follower_id AND fa.instance_id = i.id
          JOIN actors la ON la.id = f.following_id AND la.is_local = true
        ) AS "remoteFollowers",
        (
          SELECT COUNT(DISTINCT f.following_id)::int
          FROM follows f
          JOIN actors la2 ON la2.id = f.follower_id AND la2.is_local = true
          JOIN actors fa2 ON fa2.id = f.following_id AND fa2.instance_id = i.id
        ) AS "remoteFollowing"
      FROM instances i
      LEFT JOIN actors a ON a.instance_id = i.id AND a.is_local = false
      GROUP BY i.id
      ORDER BY "actorsCount" DESC
      LIMIT 50
    `)

    // Activity timeline: last 7 days grouped by day + direction
    const timelineRows = await db.execute(sql`
      SELECT
        date_trunc('day', created_at)::date::text AS date,
        direction,
        COUNT(*)::int AS count
      FROM ap_activities
      WHERE created_at >= ${since7d}
      GROUP BY date, direction
      ORDER BY date ASC
    `)

    // Fold timeline into per-day objects
    const tmap: Record<string, { outbound: number; inbound: number }> = {}
    for (const row of (timelineRows as unknown as { rows: { date: string; direction: string; count: number }[] }).rows) {
      if (!tmap[row.date]) tmap[row.date] = { outbound: 0, inbound: 0 }
      ;(tmap[row.date] as { outbound: number; inbound: number })[row.direction as 'outbound' | 'inbound'] = row.count
    }
    const activityTimeline = Object.entries(tmap)
      .map(([date, c]) => ({ date, ...c }))
      .sort((a, b) => a.date.localeCompare(b.date))

    return reply.send({
      summary: {
        totalInstances: Number(totalInstancesRes[0]!.count),
        activeInstances: Number(activeInstancesRes[0]!.count),
        remoteActors: Number(remoteActorsRes[0]!.count),
        outbound24h: Number(outbound24hRes[0]!.count),
        inbound24h: Number(inbound24hRes[0]!.count),
        failed24h: Number(failed24hRes[0]!.count),
        remoteFollowers: (remoteFollowersRes as unknown as { rows: { count: number }[] }).rows[0]?.count ?? 0,
        remoteFollowing: (remoteFollowingRes as unknown as { rows: { count: number }[] }).rows[0]?.count ?? 0,
      },
      instances: (instanceRows as unknown as { rows: unknown[] }).rows,
      activityTimeline,
    })
  })

  // GET /api/admin/audit-log — moderation history (admin only)
  app.get<{ Querystring: { limit?: string } }>('/api/admin/audit-log', async (req, reply) => {
    const actor = await requireAdmin(req, reply)
    if (!actor) return
    const limit = Math.min(Number(req.query.limit ?? 50), 200)
    const logs = await db.query.adminAuditLogs.findMany({
      orderBy: [desc(adminAuditLogs.createdAt)],
      limit,
      with: { actor: { columns: { handle: true, displayName: true, avatarUrl: true } } },
    })
    return reply.send({ logs })
  })

  // GET /api/admin/users — list local actors with their roles (admin only)
  app.get<{ Querystring: { q?: string; limit?: string } }>('/api/admin/users', async (req, reply) => {
    const admin = await requireAdmin(req, reply)
    if (!admin) return

    const { q, limit: limitStr } = req.query
    const limit = Math.min(Number(limitStr ?? 20), 100)

    const rows = await db.query.actors.findMany({
      where: and(
        eq(actors.isLocal, true),
        q ? sql`(actors.handle ILIKE ${'%' + q + '%'} OR actors.display_name ILIKE ${'%' + q + '%'})` : undefined,
      ),
      columns: { id: true, handle: true, displayName: true, avatarUrl: true, role: true, createdAt: true },
      orderBy: [desc(actors.createdAt)],
      limit,
    })

    return reply.send({ users: rows })
  })

  // PATCH /api/admin/users/:handle/role — promote/demote a local user (admin only, cannot self-demote)
  app.patch<{ Params: { handle: string } }>('/api/admin/users/:handle/role', async (req, reply) => {
    const admin = await requireAdmin(req, reply)
    if (!admin) return

    const body = z.object({ role: z.enum(['user', 'moderator', 'admin']) }).safeParse(req.body)
    if (!body.success) return reply.code(400).send({ error: 'Invalid body' })

    if (admin.handle === req.params.handle) {
      return reply.code(400).send({ error: 'Kendi rolünü değiştiremezsin.' })
    }

    const target = await db.query.actors.findFirst({
      where: and(eq(actors.handle, req.params.handle), eq(actors.isLocal, true)),
    })
    if (!target) return reply.code(404).send({ error: 'Kullanıcı bulunamadı.' })

    await db.update(actors).set({ role: body.data.role }).where(eq(actors.id, target.id))
    await logAction(admin.id, `role.set.${body.data.role}`, 'actor', target.handle)

    return reply.send({ handle: target.handle, role: body.data.role })
  })

  // GET /api/instance — public: who runs this instance (transparency)
  app.get('/api/instance', async (_req, reply) => {
    const [admins, moderators] = await Promise.all([
      db.query.actors.findMany({
        where: and(eq(actors.isLocal, true), eq(actors.role, 'admin')),
        columns: { handle: true, displayName: true, avatarUrl: true },
      }),
      db.query.actors.findMany({
        where: and(eq(actors.isLocal, true), eq(actors.role, 'moderator')),
        columns: { handle: true, displayName: true, avatarUrl: true },
      }),
    ])
    return reply.send({ admins, moderators })
  })

  // ─── User Management (extended) ───────────────────────────────────────────

  app.post<{ Params: { handle: string } }>('/api/admin/users/:handle/suspend', async (req, reply) => {
    const admin = await requireAdmin(req, reply)
    if (!admin) return
    const target = await db.query.actors.findFirst({ where: and(eq(actors.handle, req.params.handle), eq(actors.isLocal, true)) })
    if (!target) return reply.code(404).send({ error: 'Not found' })
    await db.update(actors).set({ isSuspended: true }).where(eq(actors.id, target.id))
    await logAction(admin.id, 'user.suspend', 'actor', target.handle)
    notifySuspension(target.id, admin.id).catch(() => {})
    return reply.send({ ok: true })
  })

  app.delete<{ Params: { handle: string } }>('/api/admin/users/:handle/suspend', async (req, reply) => {
    const admin = await requireAdmin(req, reply)
    if (!admin) return
    const target = await db.query.actors.findFirst({ where: and(eq(actors.handle, req.params.handle), eq(actors.isLocal, true)) })
    if (!target) return reply.code(404).send({ error: 'Not found' })
    await db.update(actors).set({ isSuspended: false }).where(eq(actors.id, target.id))
    await logAction(admin.id, 'user.unsuspend', 'actor', target.handle)
    return reply.send({ ok: true })
  })

  // GET /api/admin/storage — storage quota overview
  app.get('/api/admin/storage', async (req, reply) => {
    const admin = await requireAdmin(req, reply)
    if (!admin) return
    const [totalRes, countRes] = await Promise.all([
      db.select({ total: sql<string>`COALESCE(SUM(file_size), 0)` }).from(mediaAttachments),
      db.select({ count: sql<string>`count(*)` }).from(mediaAttachments),
    ])
    return reply.send({
      total_bytes: Number(totalRes[0]!.total),
      total_files: Number(countRes[0]!.count),
    })
  })

  // ─── Instance Settings (registration mode, max post length) ───────────────

  app.get('/api/admin/settings', async (req, reply) => {
    const admin = await requireAdmin(req, reply)
    if (!admin) return
    const settings = await db.query.instanceSettings.findFirst()
    return reply.send(settings ?? { registrationMode: 'open', maxPostLength: 500 })
  })

  app.patch('/api/admin/settings', async (req, reply) => {
    const admin = await requireAdmin(req, reply)
    if (!admin) return
    const body = z.object({
      registration_mode: z.enum(['open', 'approval', 'invite_only']).optional(),
      max_post_length: z.number().int().min(100).max(10000).optional(),
      approval_note: z.string().max(1000).optional(),
      closed_reason: z.string().max(500).optional(),
    }).safeParse(req.body)
    if (!body.success) return reply.code(422).send({ error: 'Validation failed' })

    const { registration_mode, max_post_length, approval_note, closed_reason } = body.data
    const [updated] = await db.insert(instanceSettings)
      .values({ id: 1, registrationMode: registration_mode ?? 'open', maxPostLength: max_post_length ?? 500, approvalNote: approval_note ?? null, closedReason: closed_reason ?? null, updatedAt: new Date() })
      .onConflictDoUpdate({
        target: instanceSettings.id,
        set: {
          ...(registration_mode !== undefined ? { registrationMode: registration_mode } : {}),
          ...(max_post_length !== undefined ? { maxPostLength: max_post_length } : {}),
          ...(approval_note !== undefined ? { approvalNote: approval_note } : {}),
          ...(closed_reason !== undefined ? { closedReason: closed_reason } : {}),
          updatedAt: new Date(),
        },
      }).returning()
    await logAction(admin.id, 'settings.update', undefined, undefined, body.data as Record<string, unknown>)
    return reply.send(updated)
  })

  // ─── Instance Rules ────────────────────────────────────────────────────────

  // Public endpoint — no auth required
  app.get('/api/v1/instance/rules', async (_req, reply) => {
    const rules = await db.query.instanceRules.findMany({ orderBy: [instanceRules.position] })
    return reply.send(rules.map((r, i) => ({ id: r.id, text: r.text, hint: r.hint ?? null, position: i })))
  })

  app.post('/api/admin/rules', async (req, reply) => {
    const admin = await requireAdmin(req, reply)
    if (!admin) return
    const body = z.object({ text: z.string().min(1).max(1000), hint: z.string().max(500).optional() }).safeParse(req.body)
    if (!body.success) return reply.code(422).send({ error: 'Validation failed' })
    const existing = await db.query.instanceRules.findMany()
    const [rule] = await db.insert(instanceRules).values({ text: body.data.text, hint: body.data.hint ?? null, position: existing.length }).returning()
    return reply.code(200).send(rule)
  })

  app.patch<{ Params: { id: string } }>('/api/admin/rules/:id', async (req, reply) => {
    const admin = await requireAdmin(req, reply)
    if (!admin) return
    const body = z.object({ text: z.string().min(1).max(1000).optional(), hint: z.string().max(500).optional() }).safeParse(req.body)
    if (!body.success) return reply.code(422).send({ error: 'Validation failed' })
    const [rule] = await db.update(instanceRules)
      .set({ ...(body.data.text ? { text: body.data.text } : {}), ...(body.data.hint !== undefined ? { hint: body.data.hint } : {}) })
      .where(eq(instanceRules.id, req.params.id)).returning()
    return reply.send(rule)
  })

  app.delete<{ Params: { id: string } }>('/api/admin/rules/:id', async (req, reply) => {
    const admin = await requireAdmin(req, reply)
    if (!admin) return
    await db.delete(instanceRules).where(eq(instanceRules.id, req.params.id))
    return reply.send({})
  })

  // ─── Pending Registrations (approval mode) ────────────────────────────────

  app.get('/api/v1/admin/pending_registrations', async (req, reply) => {
    const admin = await requireAdmin(req, reply)
    if (!admin) return
    const rows = await db.query.pendingRegistrations.findMany({
      where: eq(pendingRegistrations.status, 'pending'),
      orderBy: [desc(pendingRegistrations.createdAt)],
    })
    return reply.send(rows)
  })

  // Public: submit a registration request when mode is 'approval'
  app.post('/api/v1/accounts/pending', async (req, reply) => {
    const settings = await db.query.instanceSettings.findFirst()
    if (settings?.registrationMode !== 'approval') {
      return reply.code(422).send({ error: 'Registration is not in approval mode' })
    }
    const body = z.object({
      email: z.string().email(),
      username: z.string().min(2).max(30).regex(/^[a-z0-9_]+$/),
      reason: z.string().max(2000).optional(),
    }).safeParse(req.body)
    if (!body.success) return reply.code(422).send({ error: 'Validation failed' })
    const [reg] = await db.insert(pendingRegistrations)
      .values({ email: body.data.email, username: body.data.username, reason: body.data.reason ?? null })
      .onConflictDoNothing().returning()
    return reply.code(200).send(reg ?? { error: 'Email already submitted' })
  })

  app.post<{ Params: { id: string } }>('/api/admin/pending_registrations/:id/approve', async (req, reply) => {
    const admin = await requireAdmin(req, reply)
    if (!admin) return
    await db.update(pendingRegistrations)
      .set({ status: 'approved', reviewedAt: new Date() })
      .where(eq(pendingRegistrations.id, req.params.id))
    return reply.send({ status: 'approved' })
  })

  app.post<{ Params: { id: string } }>('/api/admin/pending_registrations/:id/reject', async (req, reply) => {
    const admin = await requireAdmin(req, reply)
    if (!admin) return
    const body = z.object({ note: z.string().optional() }).safeParse(req.body)
    await db.update(pendingRegistrations)
      .set({ status: 'rejected', reviewedAt: new Date(), reviewNote: body.success ? body.data.note ?? null : null })
      .where(eq(pendingRegistrations.id, req.params.id))
    return reply.send({ status: 'rejected' })
  })

  // ─── Federation Health Monitor ────────────────────────────────────────────

  app.get('/api/admin/federation/health', async (req, reply) => {
    const admin = await requireAdmin(req, reply)
    if (!admin) return
    // Instances with recent failures (last delivery failed or failure count > 0)
    const unhealthy = await db.query.instances.findMany({
      where: and(eq(instances.isSuspended, false), eq(instances.lastDeliverySuccess, false)),
      orderBy: [desc(instances.deliveryFailureCount)],
      limit: 50,
      columns: { domain: true, deliveryFailureCount: true, lastDeliveryAt: true, lastDeliverySuccess: true, lastSeenAt: true },
    })
    return reply.send({ unhealthy })
  })

  // ─── Dead Letter Queue Dashboard ──────────────────────────────────────────

  app.get('/api/admin/federation/failed', async (req, reply) => {
    const admin = await requireAdmin(req, reply)
    if (!admin) return
    const { federationQueue } = await import('../jobs/federation.js')
    const jobs = await federationQueue.getFailed(0, 99)
    return reply.send(jobs.map((j) => ({
      id: j.id,
      name: j.name,
      data: { senderHandle: j.data.senderHandle, targetInbox: j.data.targetInbox, activityId: j.data.activityId },
      failedReason: j.failedReason,
      attemptsMade: j.attemptsMade,
      timestamp: j.timestamp,
    })))
  })

  app.post<{ Params: { id: string } }>('/api/admin/federation/failed/:id/retry', async (req, reply) => {
    const admin = await requireAdmin(req, reply)
    if (!admin) return
    const { federationQueue } = await import('../jobs/federation.js')
    const job = await federationQueue.getJob(req.params.id)
    if (!job) return reply.code(404).send({ error: 'Job not found' })
    await job.retry('failed')
    return reply.send({ queued: true })
  })

  app.delete('/api/admin/federation/failed', async (req, reply) => {
    const admin = await requireAdmin(req, reply)
    if (!admin) return
    const { federationQueue } = await import('../jobs/federation.js')
    await federationQueue.clean(0, 1000, 'failed')
    return reply.send({ cleared: true })
  })
}
