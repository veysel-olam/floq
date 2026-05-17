/**
 * Mastodon OAuth Bearer token authentication.
 * Reads `Authorization: Bearer <token>` and resolves to a user + actor.
 */
import type { FastifyRequest, FastifyReply } from 'fastify'
import { eq } from 'drizzle-orm'
import { db } from '../db/client.js'
import { mastoTokens, actors } from '../db/schema.js'

export async function getMastodonUser(req: FastifyRequest) {
  const auth = req.headers.authorization
  if (!auth?.startsWith('Bearer ')) return null
  const token = auth.slice(7).trim()
  if (!token) return null

  const row = await db.query.mastoTokens.findFirst({
    where: eq(mastoTokens.token, token),
    with: { app: true },
  })
  if (!row) return null

  const actor = await db.query.actors.findFirst({
    where: eq(actors.userId, row.userId),
  })
  if (!actor) return null

  return { userId: row.userId, actor, scopes: row.scopes, appId: row.appId }
}

export async function requireMastodonUser(req: FastifyRequest, reply: FastifyReply) {
  const ctx = await getMastodonUser(req)
  if (!ctx) {
    reply.code(401).send({ error: 'The access token is invalid' })
    return null
  }
  return ctx
}
