import type { FastifyInstance } from 'fastify'
import { eq } from 'drizzle-orm'
import { z } from 'zod'
import {
  generateRegistrationOptions,
  verifyRegistrationResponse,
  generateAuthenticationOptions,
  verifyAuthenticationResponse,
} from '@simplewebauthn/server'
import type {
  AuthenticationResponseJSON,
  RegistrationResponseJSON,
  AuthenticatorTransportFuture,
} from '@simplewebauthn/server'
import { db } from '../db/client.js'
import { user as userTable, passkeys, session as sessionTable } from '../db/schema.js'
import { getSession } from '../lib/session.js'
import { env } from '../lib/env.js'
import { randomUUID } from 'node:crypto'

const RP_NAME = 'floq'
const RP_ID = new URL(env.WEB_URL).hostname
const ORIGIN = env.WEB_URL

// Temporary server-side challenge store (Redis would be better in production)
const pendingChallenges = new Map<string, { challenge: string; expiresAt: number }>()

function storeChallenge(userId: string, challenge: string) {
  pendingChallenges.set(userId, { challenge, expiresAt: Date.now() + 5 * 60 * 1000 })
}

function popChallenge(userId: string): string | null {
  const entry = pendingChallenges.get(userId)
  pendingChallenges.delete(userId)
  if (!entry || entry.expiresAt < Date.now()) return null
  return entry.challenge
}

export async function passkeyRoutes(app: FastifyInstance) {
  // ── Registration ─────────────────────────────────────────────────────────────

  // GET /api/passkeys/register/options — start passkey registration
  app.get('/api/passkeys/register/options', async (req, reply) => {
    const sess = await getSession(req)
    if (!sess) return reply.code(401).send({ error: 'Unauthorized' })

    const existingPasskeys = await db.query.passkeys.findMany({
      where: eq(passkeys.userId, sess.user.id),
      columns: { id: true, transports: true },
    })

    const options = await generateRegistrationOptions({
      rpName: RP_NAME,
      rpID: RP_ID,
      userID: Buffer.from(sess.user.id),
      userName: sess.user.email,
      userDisplayName: sess.user.name ?? sess.user.email,
      attestationType: 'none',
      excludeCredentials: existingPasskeys.map((pk) => ({
        id: pk.id,
        transports: (pk.transports ?? []) as AuthenticatorTransportFuture[],
      })),
      authenticatorSelection: {
        residentKey: 'preferred',
        userVerification: 'preferred',
      },
    })

    storeChallenge(sess.user.id, options.challenge)
    return reply.send(options)
  })

  // POST /api/passkeys/register/verify — complete passkey registration
  app.post('/api/passkeys/register/verify', async (req, reply) => {
    const sess = await getSession(req)
    if (!sess) return reply.code(401).send({ error: 'Unauthorized' })

    const body = z.object({
      credential: z.record(z.unknown()),
      name: z.string().min(1).max(255).optional(),
    }).safeParse(req.body)
    if (!body.success) return reply.code(400).send({ error: 'Invalid body' })

    const challenge = popChallenge(sess.user.id)
    if (!challenge) return reply.code(400).send({ error: 'Challenge expired or not found' })

    let verification
    try {
      verification = await verifyRegistrationResponse({
        response: body.data.credential as unknown as RegistrationResponseJSON,
        expectedChallenge: challenge,
        expectedOrigin: ORIGIN,
        expectedRPID: RP_ID,
      })
    } catch (e) {
      return reply.code(400).send({ error: 'Verification failed', detail: String(e) })
    }

    if (!verification.verified || !verification.registrationInfo) {
      return reply.code(400).send({ error: 'Verification failed' })
    }

    const { credential } = verification.registrationInfo
    await db.insert(passkeys).values({
      id: credential.id,
      userId: sess.user.id,
      name: body.data.name ?? 'Passkey',
      publicKey: Buffer.from(credential.publicKey).toString('base64url'),
      counter: credential.counter,
      deviceType: verification.registrationInfo.credentialDeviceType,
      backedUp: verification.registrationInfo.credentialBackedUp,
      transports: (body.data.credential as { response?: { transports?: string[] } }).response?.transports ?? [],
    })

    return reply.send({ verified: true })
  })

  // ── Authentication ───────────────────────────────────────────────────────────

  // GET /api/passkeys/authenticate/options — start passkey authentication
  app.get<{ Querystring: { email?: string } }>('/api/passkeys/authenticate/options', async (req, reply) => {
    const { email } = req.query
    let userPasskeys: { id: string; transports: string[] | null }[] = []
    let challengeKey = 'anon'

    if (email) {
      const u = await db.query.user.findFirst({ where: eq(userTable.email, email), columns: { id: true } })
      if (u) {
        challengeKey = u.id
        userPasskeys = await db.query.passkeys.findMany({
          where: eq(passkeys.userId, u.id),
          columns: { id: true, transports: true },
        })
      }
    }

    const options = await generateAuthenticationOptions({
      rpID: RP_ID,
      userVerification: 'preferred',
      allowCredentials: userPasskeys.map((pk) => ({
        id: pk.id,
        transports: (pk.transports ?? []) as AuthenticatorTransportFuture[],
      })),
    })

    storeChallenge(challengeKey, options.challenge)
    return reply.send({ ...options, challengeKey })
  })

  // POST /api/passkeys/authenticate/verify — complete passkey authentication
  app.post('/api/passkeys/authenticate/verify', async (req, reply) => {
    const body = z.object({
      credential: z.record(z.unknown()),
      challengeKey: z.string(),
    }).safeParse(req.body)
    if (!body.success) return reply.code(400).send({ error: 'Invalid body' })

    const challenge = popChallenge(body.data.challengeKey)
    if (!challenge) return reply.code(400).send({ error: 'Challenge expired' })

    const credentialId = (body.data.credential as { id?: string }).id
    if (!credentialId) return reply.code(400).send({ error: 'Missing credential id' })

    const passkey = await db.query.passkeys.findFirst({
      where: eq(passkeys.id, credentialId),
    })
    if (!passkey) return reply.code(404).send({ error: 'Passkey not found' })

    let verification
    try {
      verification = await verifyAuthenticationResponse({
        response: body.data.credential as unknown as AuthenticationResponseJSON,
        expectedChallenge: challenge,
        expectedOrigin: ORIGIN,
        expectedRPID: RP_ID,
        credential: {
          id: passkey.id,
          publicKey: Buffer.from(passkey.publicKey, 'base64url'),
          counter: passkey.counter,
          transports: (passkey.transports ?? []) as AuthenticatorTransportFuture[],
        },
      })
    } catch (e) {
      return reply.code(400).send({ error: 'Verification failed', detail: String(e) })
    }

    if (!verification.verified) return reply.code(400).send({ error: 'Verification failed' })

    // Update counter
    await db.update(passkeys).set({
      counter: verification.authenticationInfo.newCounter,
      lastUsedAt: new Date(),
    }).where(eq(passkeys.id, passkey.id))

    // Create a better-auth session for the user
    const u = await db.query.user.findFirst({ where: eq(userTable.id, passkey.userId) })
    if (!u) return reply.code(500).send({ error: 'User not found' })

    const sessionId = randomUUID()
    const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000) // 30 days
    const now = new Date()
    await db.insert(sessionTable).values({
      id: sessionId,
      userId: u.id,
      token: sessionId,
      expiresAt,
      createdAt: now,
      updatedAt: now,
      ipAddress: req.ip ?? null,
      userAgent: req.headers['user-agent'] ?? null,
    })

    const secure = env.NODE_ENV === 'production'
    reply.header(
      'Set-Cookie',
      `better-auth.session_token=${sessionId}; Path=/; HttpOnly; SameSite=Lax; Expires=${expiresAt.toUTCString()}${secure ? '; Secure' : ''}`,
    )

    return reply.send({ verified: true, userId: u.id, token: sessionId })
  })

  // ── Management ───────────────────────────────────────────────────────────────

  // GET /api/passkeys — list passkeys for current user
  app.get('/api/passkeys', async (req, reply) => {
    const sess = await getSession(req)
    if (!sess) return reply.code(401).send({ error: 'Unauthorized' })
    const list = await db.query.passkeys.findMany({
      where: eq(passkeys.userId, sess.user.id),
      columns: { id: true, name: true, deviceType: true, backedUp: true, createdAt: true, lastUsedAt: true },
    })
    return reply.send(list)
  })

  // DELETE /api/passkeys/:id — remove a passkey
  app.delete<{ Params: { id: string } }>('/api/passkeys/:id', async (req, reply) => {
    const sess = await getSession(req)
    if (!sess) return reply.code(401).send({ error: 'Unauthorized' })
    const passkey = await db.query.passkeys.findFirst({ where: eq(passkeys.id, req.params.id) })
    if (!passkey || passkey.userId !== sess.user.id) return reply.code(404).send({ error: 'Not found' })
    await db.delete(passkeys).where(eq(passkeys.id, req.params.id))
    return reply.code(204).send()
  })

  // PATCH /api/passkeys/:id — rename a passkey
  app.patch<{ Params: { id: string } }>('/api/passkeys/:id', async (req, reply) => {
    const sess = await getSession(req)
    if (!sess) return reply.code(401).send({ error: 'Unauthorized' })
    const body = z.object({ name: z.string().min(1).max(255) }).safeParse(req.body)
    if (!body.success) return reply.code(400).send({ error: 'Invalid body' })
    const passkey = await db.query.passkeys.findFirst({ where: eq(passkeys.id, req.params.id) })
    if (!passkey || passkey.userId !== sess.user.id) return reply.code(404).send({ error: 'Not found' })
    await db.update(passkeys).set({ name: body.data.name }).where(eq(passkeys.id, req.params.id))
    return reply.send({ id: req.params.id, name: body.data.name })
  })
}
