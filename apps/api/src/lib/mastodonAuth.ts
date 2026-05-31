/**
 * Mastodon OAuth Bearer token authentication.
 * Reads `Authorization: Bearer <token>` and resolves to a user + actor.
 */
import type { FastifyRequest, FastifyReply } from 'fastify'
import { eq } from 'drizzle-orm'
import { db } from '../db/client.js'
import { mastoTokens, actors } from '../db/schema.js'
import { getSession } from './session.js'

export async function getMastodonUser(req: FastifyRequest) {
  const auth = req.headers.authorization
  if (auth?.startsWith('Bearer ')) {
    const token = auth.slice(7).trim()
    if (token) {
      const row = await db.query.mastoTokens.findFirst({
        where: eq(mastoTokens.token, token),
        with: { app: true },
      })
      if (row) {
        const actor = await db.query.actors.findFirst({ where: eq(actors.userId, row.userId) })
        if (actor) return { userId: row.userId, actor, scopes: row.scopes, appId: row.appId }
      }
    }
  }

  // Fall back to the Better Auth session so the web app (cookie-based, no Mastodon
  // OAuth token) can use these endpoints too — e.g. the communities pages.
  const session = await getSession(req)
  if (session) {
    const actor = await db.query.actors.findFirst({ where: eq(actors.userId, session.user.id) })
    if (actor) return { userId: session.user.id, actor, scopes: 'read write follow push', appId: null as string | null }
  }

  return null
}

export async function requireMastodonUser(req: FastifyRequest, reply: FastifyReply) {
  const ctx = await getMastodonUser(req)
  if (!ctx) {
    reply.code(401).send({ error: 'The access token is invalid' })
    return null
  }
  return ctx
}
