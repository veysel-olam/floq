import type { FastifyRequest, FastifyReply } from 'fastify'
import { eq } from 'drizzle-orm'
import { auth } from './auth.js'
import { db } from '../db/client.js'
import { actors } from '../db/schema.js'

function requestHeaders(req: FastifyRequest): Headers {
  const headers = new Headers()
  for (const [key, value] of Object.entries(req.headers)) {
    if (value === undefined) continue
    if (Array.isArray(value)) value.forEach((v) => headers.append(key, v))
    else headers.set(key, value)
  }
  return headers
}

export async function getSession(req: FastifyRequest) {
  return auth.api.getSession({ headers: requestHeaders(req) })
}

export async function requireActor(req: FastifyRequest, reply: FastifyReply) {
  const session = await getSession(req)
  if (!session) {
    reply.code(401).send({ error: 'Unauthorized' })
    return null
  }

  const actor = await db.query.actors.findFirst({
    where: eq(actors.userId, session.user.id),
  })

  if (!actor) {
    reply.code(401).send({ error: 'Actor not found' })
    return null
  }

  return { session, actor }
}
