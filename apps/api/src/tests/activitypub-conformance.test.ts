/**
 * W3C ActivityPub Conformance Test Suite
 * Based on https://www.w3.org/TR/activitypub/ and
 * https://activitypub.rocks/test/
 *
 * Tests are structured around the W3C spec sections:
 * - §3: Objects
 * - §4: Actors
 * - §5: Collections
 * - §6: Client to Server Interactions
 * - §7: Server to Server Interactions
 *
 * Run against a live instance: AP_BASE_URL=https://your.instance pnpm test
 * Defaults to localhost:3001 (dev server).
 */

import { describe, it, expect, beforeAll } from 'vitest'

const BASE_URL = process.env['AP_BASE_URL'] ?? 'http://localhost:3001'
const TEST_HANDLE = process.env['AP_TEST_HANDLE'] ?? 'testuser'
const AP_CONTENT_TYPE = 'application/activity+json'
const LD_CONTENT_TYPE = 'application/ld+json'

async function apFetch(path: string, init?: RequestInit) {
  return fetch(`${BASE_URL}${path}`, {
    ...init,
    headers: {
      Accept: `${AP_CONTENT_TYPE}, ${LD_CONTENT_TYPE}`,
      ...init?.headers,
    },
  })
}

// ── §4: Actors ────────────────────────────────────────────────────────────────

describe('§4 Actors', () => {
  let actor: Record<string, unknown>

  beforeAll(async () => {
    const res = await apFetch(`/users/${TEST_HANDLE}`)
    if (res.ok) actor = await res.json() as Record<string, unknown>
  })

  it('actor endpoint returns 200', async () => {
    const res = await apFetch(`/users/${TEST_HANDLE}`)
    expect(res.status).toBe(200)
  })

  it('actor has required @context', () => {
    if (!actor) return
    const ctx = actor['@context']
    const ctxArr = Array.isArray(ctx) ? ctx : [ctx]
    expect(ctxArr).toContain('https://www.w3.org/ns/activitystreams')
  })

  it('actor has required type', () => {
    if (!actor) return
    expect(['Person', 'Service', 'Group', 'Organization', 'Application']).toContain(actor['type'])
  })

  it('actor has id', () => {
    if (!actor) return
    expect(typeof actor['id']).toBe('string')
    expect(actor['id']).toMatch(/^https?:\/\//)
  })

  it('actor has inbox', () => {
    if (!actor) return
    expect(typeof actor['inbox']).toBe('string')
    expect(actor['inbox']).toMatch(/^https?:\/\//)
  })

  it('actor has outbox', () => {
    if (!actor) return
    expect(typeof actor['outbox']).toBe('string')
    expect(actor['outbox']).toMatch(/^https?:\/\//)
  })

  it('actor has followers', () => {
    if (!actor) return
    expect(typeof actor['followers']).toBe('string')
  })

  it('actor has following', () => {
    if (!actor) return
    expect(typeof actor['following']).toBe('string')
  })

  it('actor has publicKey for HTTP Signatures', () => {
    if (!actor) return
    const pk = actor['publicKey'] as Record<string, unknown> | undefined
    expect(pk).toBeDefined()
    expect(pk?.['id']).toBeDefined()
    expect(pk?.['owner']).toBe(actor['id'])
    expect(typeof pk?.['publicKeyPem']).toBe('string')
  })

  it('actor preferredUsername is string', () => {
    if (!actor) return
    expect(typeof actor['preferredUsername']).toBe('string')
  })
})

// ── §5: Collections ───────────────────────────────────────────────────────────

describe('§5 Collections', () => {
  it('outbox is an OrderedCollection', async () => {
    const actor = await apFetch(`/users/${TEST_HANDLE}`).then((r) => r.ok ? r.json() as Promise<Record<string, unknown>> : null)
    if (!actor) return
    const res = await apFetch(new URL(actor['outbox'] as string).pathname)
    if (!res.ok) return
    const col = await res.json() as Record<string, unknown>
    expect(['OrderedCollection', 'OrderedCollectionPage']).toContain(col['type'])
    expect(typeof col['totalItems']).toBe('number')
  })

  it('followers is a collection', async () => {
    const actor = await apFetch(`/users/${TEST_HANDLE}`).then((r) => r.ok ? r.json() as Promise<Record<string, unknown>> : null)
    if (!actor) return
    const res = await apFetch(new URL(actor['followers'] as string).pathname)
    if (!res.ok) return
    const col = await res.json() as Record<string, unknown>
    expect(['OrderedCollection', 'Collection', 'OrderedCollectionPage']).toContain(col['type'])
  })

  it('following is a collection', async () => {
    const actor = await apFetch(`/users/${TEST_HANDLE}`).then((r) => r.ok ? r.json() as Promise<Record<string, unknown>> : null)
    if (!actor) return
    const res = await apFetch(new URL(actor['following'] as string).pathname)
    if (!res.ok) return
    const col = await res.json() as Record<string, unknown>
    expect(['OrderedCollection', 'Collection', 'OrderedCollectionPage']).toContain(col['type'])
  })
})

// ── §7: Server Discovery ──────────────────────────────────────────────────────

describe('§7 Server Discovery', () => {
  it('WebFinger resolves actor', async () => {
    const res = await fetch(
      `${BASE_URL}/.well-known/webfinger?resource=acct:${TEST_HANDLE}@${new URL(BASE_URL).hostname}`,
    )
    expect(res.status).toBe(200)
    const json = await res.json() as Record<string, unknown>
    expect(json['subject']).toContain(TEST_HANDLE)
    const links = json['links'] as Array<{ rel: string; href?: string }> | undefined
    const apLink = links?.find((l) => l.rel === 'self')
    expect(apLink).toBeDefined()
    expect(apLink?.href).toMatch(/^https?:\/\//)
  })

  it('NodeInfo is discoverable', async () => {
    const res = await fetch(`${BASE_URL}/.well-known/nodeinfo`)
    expect(res.status).toBe(200)
    const json = await res.json() as Record<string, unknown>
    const links = json['links'] as Array<{ href: string }> | undefined
    expect(links?.length).toBeGreaterThan(0)
  })

  it('NodeInfo 2.1 schema is valid', async () => {
    const discovery = await fetch(`${BASE_URL}/.well-known/nodeinfo`).then((r) => r.json()) as Record<string, unknown>
    const nodeInfoUrl = (discovery['links'] as Array<{ href: string }>)[0]?.href
    if (!nodeInfoUrl) return
    const res = await fetch(nodeInfoUrl)
    expect(res.status).toBe(200)
    const info = await res.json() as Record<string, unknown>
    expect(info['version']).toMatch(/^2\./)
    expect((info['protocols'] as string[])?.includes('activitypub')).toBe(true)
    expect(info['usage']).toBeDefined()
    expect(info['software']).toBeDefined()
  })
})

// ── Content-Type negotiation ──────────────────────────────────────────────────

describe('Content-Type negotiation', () => {
  it('actor endpoint returns AP content type', async () => {
    const res = await apFetch(`/users/${TEST_HANDLE}`)
    const ct = res.headers.get('content-type') ?? ''
    expect(ct.includes('application/activity+json') || ct.includes('application/ld+json')).toBe(true)
  })

  it('inbox is accessible', async () => {
    const res = await apFetch(`/users/${TEST_HANDLE}/inbox`)
    // 401 Unauthorized is acceptable (Authorized Fetch), 200/405 also acceptable
    expect([200, 401, 403, 405]).toContain(res.status)
  })
})

// ── FEP-8b32: Object Integrity ────────────────────────────────────────────────

describe('FEP-8b32 Object Integrity Proofs', () => {
  it('actor has assertionMethod with Multikey for eddsa-jcs-2022', async () => {
    const res = await apFetch(`/users/${TEST_HANDLE}`)
    if (!res.ok) return
    const actor = await res.json() as Record<string, unknown>
    const methods = actor['assertionMethod'] as Array<Record<string, unknown>> | undefined
    if (!methods?.length) return // optional but expected
    const multikey = methods.find((m) => m['type'] === 'Multikey')
    expect(multikey).toBeDefined()
    expect(typeof multikey?.['publicKeyMultibase']).toBe('string')
    expect((multikey?.['publicKeyMultibase'] as string).startsWith('z')).toBe(true)
  })
})

// ── W3C Verifiable Credentials ────────────────────────────────────────────────

describe('W3C Verifiable Credentials', () => {
  it('actor VC endpoint returns a VerifiableCredential', async () => {
    const res = await fetch(`${BASE_URL}/users/${TEST_HANDLE}/vc`, {
      headers: { Accept: 'application/ld+json, application/json' },
    })
    if (!res.ok) return // actor may not have ed25519 key
    const vc = await res.json() as Record<string, unknown>
    expect((vc['type'] as string[])?.includes('VerifiableCredential')).toBe(true)
    expect(vc['issuer']).toBeDefined()
    expect(vc['credentialSubject']).toBeDefined()
    expect(vc['proof']).toBeDefined()
  })
})

// ── DID Document ──────────────────────────────────────────────────────────────

describe('DID Document', () => {
  it('per-user DID document is served', async () => {
    const res = await fetch(`${BASE_URL}/users/${TEST_HANDLE}/did.json`, {
      headers: { Accept: 'application/json' },
    })
    if (!res.ok) return
    const did = await res.json() as Record<string, unknown>
    expect(typeof did['id']).toBe('string')
    expect((did['id'] as string).startsWith('did:')).toBe(true)
    expect(Array.isArray(did['service'])).toBe(true)
  })
})
