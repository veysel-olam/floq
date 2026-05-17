import type { FastifyInstance } from 'fastify'
import { eq } from 'drizzle-orm'
import { z } from 'zod'
import { randomUUID, randomBytes } from 'node:crypto'
import { db } from '../../db/client.js'
import { mastoApps, mastoTokens, mastoAuthCodes, user as userTable } from '../../db/schema.js'
import { getSession } from '../../lib/session.js'
import { env } from '../../lib/env.js'

function generateToken() {
  return randomBytes(32).toString('hex')
}

function generateClientId() {
  return randomBytes(16).toString('hex')
}

export async function mastodonOAuthRoutes(app: FastifyInstance) {
  // ── App registration ──────────────────────────────────────────────────────

  app.post('/api/v1/apps', async (req, reply) => {
    const body = z.object({
      client_name: z.string().min(1).max(255),
      redirect_uris: z.string().min(1),
      scopes: z.string().default('read'),
      website: z.string().url().optional(),
    }).safeParse(req.body)
    if (!body.success) return reply.code(422).send({ error: 'Validation failed', details: body.error.flatten() })

    const clientId = generateClientId()
    const clientSecret = generateToken()

    const [app_] = await db.insert(mastoApps).values({
      clientId,
      clientSecret,
      name: body.data.client_name,
      redirectUris: body.data.redirect_uris,
      scopes: body.data.scopes,
      website: body.data.website ?? null,
    }).returning()

    return reply.code(200).send({
      id: app_!.id,
      name: app_!.name,
      website: app_!.website ?? null,
      redirect_uri: app_!.redirectUris,
      client_id: app_!.clientId,
      client_secret: app_!.clientSecret,
      vapid_key: null,
    })
  })

  // ── OAuth Authorize ────────────────────────────────────────────────────────

  // Returns an HTML page that auto-submits (logged in users are auto-approved).
  // Real Mastodon shows an approval screen; we auto-approve for simplicity.
  app.get<{
    Querystring: {
      client_id?: string; redirect_uri?: string
      scope?: string; response_type?: string; state?: string
    }
  }>('/oauth/authorize', async (req, reply) => {
    const { client_id, redirect_uri, scope, response_type, state } = req.query

    if (response_type !== 'code') {
      return reply.code(400).send({ error: 'unsupported_response_type' })
    }

    const mastoApp = client_id
      ? await db.query.mastoApps.findFirst({ where: eq(mastoApps.clientId, client_id) })
      : null
    if (!mastoApp) return reply.code(422).send({ error: 'Client not found' })

    // Must be logged in via cookie session
    const sess = await getSession(req)
    if (!sess) {
      const returnTo = encodeURIComponent(req.url)
      return reply.redirect(`${env.WEB_URL}/login?return_to=${returnTo}`)
    }

    // Issue authorization code
    const code = generateToken()
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000) // 10 min
    await db.insert(mastoAuthCodes).values({
      code,
      userId: sess.user.id,
      appId: mastoApp.id,
      redirectUri: redirect_uri ?? mastoApp.redirectUris.split('\n')[0]!,
      scopes: scope ?? mastoApp.scopes,
      expiresAt,
    })

    const redirectUrl = new URL(redirect_uri ?? mastoApp.redirectUris.split('\n')[0]!)
    redirectUrl.searchParams.set('code', code)
    if (state) redirectUrl.searchParams.set('state', state)
    return reply.redirect(redirectUrl.toString())
  })

  // ── Token endpoint ────────────────────────────────────────────────────────

  app.post('/oauth/token', async (req, reply) => {
    const body = z.union([
      z.object({
        grant_type: z.literal('authorization_code'),
        code: z.string(),
        redirect_uri: z.string(),
        client_id: z.string(),
        client_secret: z.string(),
      }),
      z.object({
        grant_type: z.literal('client_credentials'),
        client_id: z.string(),
        client_secret: z.string(),
        scope: z.string().optional(),
      }),
      z.object({
        grant_type: z.literal('password'),
        username: z.string().email(),
        password: z.string(),
        client_id: z.string(),
        client_secret: z.string(),
        scope: z.string().optional(),
      }),
    ]).safeParse(req.body)
    if (!body.success) return reply.code(400).send({ error: 'invalid_request' })

    const data = body.data

    // Verify client credentials
    const mastoApp = await db.query.mastoApps.findFirst({
      where: eq(mastoApps.clientId, data.client_id),
    })
    if (!mastoApp || mastoApp.clientSecret !== data.client_secret) {
      return reply.code(401).send({ error: 'invalid_client' })
    }

    if (data.grant_type === 'authorization_code') {
      const authCode = await db.query.mastoAuthCodes.findFirst({
        where: eq(mastoAuthCodes.code, data.code),
      })
      if (!authCode || authCode.appId !== mastoApp.id || authCode.expiresAt < new Date()) {
        return reply.code(400).send({ error: 'invalid_grant' })
      }
      if (data.redirect_uri !== authCode.redirectUri) {
        return reply.code(400).send({ error: 'invalid_grant', error_description: 'redirect_uri mismatch' })
      }

      // Consume code
      await db.delete(mastoAuthCodes).where(eq(mastoAuthCodes.id, authCode.id))

      const token = generateToken()
      await db.insert(mastoTokens).values({
        token,
        userId: authCode.userId,
        appId: mastoApp.id,
        scopes: authCode.scopes,
      })

      return reply.send({
        access_token: token,
        token_type: 'Bearer',
        scope: authCode.scopes,
        created_at: Math.floor(Date.now() / 1000),
      })
    }

    if (data.grant_type === 'client_credentials') {
      // App-level token (no user) — used for some app setup flows
      const token = generateToken()
      await db.insert(mastoTokens).values({
        token,
        userId: 'app', // sentinel — not a real user
        appId: mastoApp.id,
        scopes: data.scope ?? 'read',
      })
      return reply.send({
        access_token: token,
        token_type: 'Bearer',
        scope: data.scope ?? 'read',
        created_at: Math.floor(Date.now() / 1000),
      })
    }

    if (data.grant_type === 'password') {
      // Password grant — used by some older clients
      const u = await db.query.user.findFirst({
        where: eq(userTable.email, data.username),
      })
      if (!u) return reply.code(400).send({ error: 'invalid_grant' })

      // Verify password via better-auth
      const authResult = await fetch(`${env.APP_URL}/api/auth/sign-in/email`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: data.username, password: data.password }),
      })
      if (!authResult.ok) return reply.code(400).send({ error: 'invalid_grant' })

      const token = generateToken()
      await db.insert(mastoTokens).values({
        token,
        userId: u.id,
        appId: mastoApp.id,
        scopes: data.scope ?? mastoApp.scopes,
      })

      return reply.send({
        access_token: token,
        token_type: 'Bearer',
        scope: data.scope ?? mastoApp.scopes,
        created_at: Math.floor(Date.now() / 1000),
      })
    }

    return reply.code(400).send({ error: 'unsupported_grant_type' })
  })

  // ── Token revocation ──────────────────────────────────────────────────────

  app.post('/oauth/revoke', async (req, reply) => {
    const body = z.object({ token: z.string() }).safeParse(req.body)
    if (!body.success) return reply.code(200).send({}) // Mastodon always returns 200
    await db.delete(mastoTokens).where(eq(mastoTokens.token, body.data.token))
    return reply.send({})
  })

  // ── Token info ────────────────────────────────────────────────────────────

  app.get('/api/v1/apps/verify_credentials', async (req, reply) => {
    const auth = req.headers.authorization
    if (!auth?.startsWith('Bearer ')) return reply.code(401).send({ error: 'The access token is invalid' })
    const token = auth.slice(7)
    const row = await db.query.mastoTokens.findFirst({ where: eq(mastoTokens.token, token) })
    if (!row) return reply.code(401).send({ error: 'The access token is invalid' })
    const app_ = row.appId ? await db.query.mastoApps.findFirst({ where: eq(mastoApps.id, row.appId) }) : null
    return reply.send({
      name: app_?.name ?? 'floq',
      website: app_?.website ?? null,
      redirect_uri: app_?.redirectUris ?? 'urn:ietf:wg:oauth:2.0:oob',
      client_id: app_?.clientId ?? null,
      vapid_key: null,
    })
  })
}
