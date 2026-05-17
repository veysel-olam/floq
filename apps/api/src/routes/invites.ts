import type { FastifyInstance } from 'fastify'
import { eq, and, or, isNull, gt } from 'drizzle-orm'
import { randomBytes } from 'node:crypto'
import { db } from '../db/client.js'
import { inviteCodes, user } from '../db/schema.js'
import { env } from '../lib/env.js'

function generateCode(): string {
  return randomBytes(5).toString('hex').toUpperCase() // 10 chars, e.g. "A3F9B2C1D4"
}

function isAdminRequest(req: { headers: Record<string, string | string[] | undefined> }): boolean {
  const secret = req.headers['x-admin-secret']
  return env.ADMIN_SECRET != null && secret === env.ADMIN_SECRET
}

export async function invitesRoutes(app: FastifyInstance) {
  // GET /api/invites/:code — validate a code (public, used by frontend before sign-up)
  app.get('/api/invites/:code', async (req, reply) => {
    if (!env.REQUIRE_INVITE) {
      return reply.send({ valid: true, open: true })
    }

    const { code } = req.params as { code: string }

    const invite = await db.query.inviteCodes.findFirst({
      where: and(
        eq(inviteCodes.code, code.toUpperCase()),
        or(isNull(inviteCodes.expiresAt), gt(inviteCodes.expiresAt, new Date())),
      ),
    })

    if (!invite || invite.useCount >= invite.maxUses) {
      return reply.code(404).send({ valid: false, error: 'Invalid or expired invite code.' })
    }

    return reply.send({ valid: true })
  })

  // POST /api/invites/:code/use — consume a code after successful sign-up
  app.post('/api/invites/:code/use', async (req, reply) => {
    if (!env.REQUIRE_INVITE) return reply.code(204).send()

    const { code } = req.params as { code: string }
    const { userId } = req.body as { userId?: string }
    if (!userId) return reply.code(400).send({ error: 'userId required' })

    const invite = await db.query.inviteCodes.findFirst({
      where: and(
        eq(inviteCodes.code, code.toUpperCase()),
        or(isNull(inviteCodes.expiresAt), gt(inviteCodes.expiresAt, new Date())),
      ),
    })

    if (!invite || invite.useCount >= invite.maxUses) {
      // Delete the user that was just created so the invite gate holds
      await db.delete(user).where(eq(user.id, userId))
      return reply.code(400).send({ error: 'Invalid or expired invite code.' })
    }

    await db
      .update(inviteCodes)
      .set({
        useCount: invite.useCount + 1,
        usedById: userId,
        usedAt: new Date(),
      })
      .where(eq(inviteCodes.id, invite.id))

    return reply.code(204).send()
  })

  // POST /api/admin/invites — generate invite codes (admin only)
  app.post('/api/admin/invites', {
    config: { rateLimit: { max: 30, timeWindow: '1 minute' } },
  }, async (req, reply) => {
    if (!isAdminRequest(req as Parameters<typeof isAdminRequest>[0])) {
      return reply.code(403).send({ error: 'Forbidden' })
    }

    const { count = 1, maxUses = 1, expiresInDays } = req.body as {
      count?: number
      maxUses?: number
      expiresInDays?: number
    }

    const expiresAt = expiresInDays
      ? new Date(Date.now() + expiresInDays * 86400 * 1000)
      : null

    const codes = Array.from({ length: Math.min(count, 100) }, () => ({
      code: generateCode(),
      maxUses,
      expiresAt,
    }))

    const inserted = await db.insert(inviteCodes).values(codes).returning()

    return reply.send({ codes: inserted.map((c) => ({ code: c.code, expiresAt: c.expiresAt })) })
  })

  // GET /api/admin/invites — list all invite codes (admin only)
  app.get('/api/admin/invites', async (req, reply) => {
    if (!isAdminRequest(req as Parameters<typeof isAdminRequest>[0])) {
      return reply.code(403).send({ error: 'Forbidden' })
    }

    const codes = await db.query.inviteCodes.findMany({
      orderBy: (t, { desc }) => [desc(t.createdAt)],
      limit: 200,
    })

    return reply.send({ codes })
  })
}
