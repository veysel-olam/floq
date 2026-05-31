import type { FastifyInstance } from 'fastify'
import { eq } from 'drizzle-orm'
import { db } from '../db/client.js'
import { actors } from '../db/schema.js'
import { requireMastodonUser } from '../lib/mastodonAuth.js'
import { generateNostrKeypair, toNpub, encryptNostrKey } from '../lib/nostr.js'
import { env } from '../lib/env.js'

export async function nostrRoutes(app: FastifyInstance) {
  // ── NIP-05: /.well-known/nostr.json?name=user ─────────────────────────────
  app.get<{ Querystring: { name?: string } }>('/.well-known/nostr.json', async (req, reply) => {
    reply.header('Access-Control-Allow-Origin', '*')
    reply.header('Content-Type', 'application/json')

    const { name } = req.query

    if (!name) {
      const rows = await db.query.actors.findMany({
        where: (a, { and: andFn, isNotNull }) => andFn(eq(a.isLocal, true), isNotNull(a.nostrPublicKey)),
        columns: { handle: true, nostrPublicKey: true },
      })
      const names: Record<string, string> = {}
      for (const r of rows) {
        if (r.nostrPublicKey) names[r.handle.split('@')[0]!] = r.nostrPublicKey
      }
      return reply.send({ names })
    }

    // Match exact handle or bare name (alice → alice@domain)
    const bareName = name.includes('@') ? name.split('@')[0]! : name
    const rows = await db.query.actors.findMany({
      where: (a, { ilike, and: andFn }) => andFn(
        eq(a.isLocal, true),
        ilike(a.handle, `${bareName}%`),
      ),
      columns: { handle: true, nostrPublicKey: true },
    })

    const match = rows.find((r) => {
      const bare = r.handle.split('@')[0]!
      return bare.toLowerCase() === bareName.toLowerCase()
    })

    if (!match?.nostrPublicKey) return reply.code(404).send({ error: 'Not found' })

    const relayList = (env.NOSTR_RELAYS ?? '').split(',').filter(Boolean)
    return reply.send({
      names: { [bareName]: match.nostrPublicKey },
      ...(relayList.length ? { relays: { [match.nostrPublicKey]: relayList } } : {}),
    })
  })

  // ── GET /api/nostr/identity ────────────────────────────────────────────────
  app.get('/api/nostr/identity', async (req, reply) => {
    const ctx = await requireMastodonUser(req, reply)
    if (!ctx) return

    if (!ctx.actor.nostrPublicKey) return reply.send({ enabled: false })

    return reply.send({
      enabled: true,
      pubkey: ctx.actor.nostrPublicKey,
      npub: toNpub(ctx.actor.nostrPublicKey),
      identifier: `${ctx.actor.handle.split('@')[0]}@${env.APP_DOMAIN}`,
      crosspost_enabled: ctx.actor.nostrCrosspostEnabled,
    })
  })

  // ── PATCH /api/nostr/crosspost — toggle auto-crossposting to Nostr ─────────
  app.patch('/api/nostr/crosspost', async (req, reply) => {
    const ctx = await requireMastodonUser(req, reply)
    if (!ctx) return
    const enabled = !!(req.body as { enabled?: boolean })?.enabled
    await db.update(actors)
      .set({ nostrCrosspostEnabled: enabled })
      .where(eq(actors.id, ctx.actor.id))
    return reply.send({ crosspost_enabled: enabled })
  })

  // ── POST /api/nostr/identity — generate or regenerate Nostr keypair ───────
  app.post('/api/nostr/identity', async (req, reply) => {
    const ctx = await requireMastodonUser(req, reply)
    if (!ctx) return

    const { publicKeyHex, privateKeyHex } = generateNostrKeypair()
    await db.update(actors)
      .set({ nostrPublicKey: publicKeyHex, nostrPrivateKeyEncrypted: encryptNostrKey(privateKeyHex) })
      .where(eq(actors.id, ctx.actor.id))

    return reply.send({
      enabled: true,
      pubkey: publicKeyHex,
      npub: toNpub(publicKeyHex),
      identifier: `${ctx.actor.handle.split('@')[0]}@${env.APP_DOMAIN}`,
    })
  })

  // ── DELETE /api/nostr/identity — disconnect Nostr identity ────────────────
  app.delete('/api/nostr/identity', async (req, reply) => {
    const ctx = await requireMastodonUser(req, reply)
    if (!ctx) return

    await db.update(actors)
      .set({ nostrPublicKey: null, nostrPrivateKeyEncrypted: null })
      .where(eq(actors.id, ctx.actor.id))

    return reply.send({ enabled: false })
  })
}
