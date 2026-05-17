import { test, expect } from '@playwright/test'

const API = process.env['API_URL'] ?? 'http://localhost:3001'

test.describe('AT Protocol / DID:web', () => {
  test('server DID document resolves', async ({ request }) => {
    const res = await request.get(`${API}/.well-known/did.json`)
    expect(res.ok()).toBeTruthy()
    const body = await res.json() as Record<string, unknown>
    expect(body['@context']).toContain('https://www.w3.org/ns/did/v1')
    expect(typeof body['id']).toBe('string')
    expect((body['id'] as string).startsWith('did:web:')).toBeTruthy()
    const services = body['service'] as { type: string }[]
    expect(services.some((s) => s.type === 'AtprotoPersonalDataServer')).toBeTruthy()
  })

  test('com.atproto.server.describeServer returns server info', async ({ request }) => {
    const res = await request.get(`${API}/xrpc/com.atproto.server.describeServer`)
    expect(res.ok()).toBeTruthy()
    const body = await res.json() as Record<string, unknown>
    expect(typeof body['did']).toBe('string')
    expect(Array.isArray(body['availableUserDomains'])).toBeTruthy()
  })

  test('com.atproto.identity.resolveHandle rejects missing param', async ({ request }) => {
    const res = await request.get(`${API}/xrpc/com.atproto.identity.resolveHandle`)
    expect(res.status()).toBe(400)
  })

  test('com.atproto.identity.resolveHandle rejects unknown handle', async ({ request }) => {
    const res = await request.get(
      `${API}/xrpc/com.atproto.identity.resolveHandle?handle=nonexistent_user_xyz_floq`,
    )
    expect(res.status()).toBe(400)
  })
})

test.describe('AT Protocol / Feed Generator', () => {
  test('describeFeedGenerator lists available feeds', async ({ request }) => {
    const res = await request.get(`${API}/xrpc/app.bsky.feed.describeFeedGenerator`)
    expect(res.ok()).toBeTruthy()
    const body = await res.json() as { feeds?: unknown[] }
    expect(Array.isArray(body.feeds)).toBeTruthy()
    expect(body.feeds!.length).toBeGreaterThanOrEqual(2)
  })

  test('getFeedSkeleton returns public feed', async ({ request }) => {
    const domain = new URL(API).host
    const feedUri = `at://did:web:${domain}/app.bsky.feed.generator/public`
    const res = await request.get(
      `${API}/xrpc/app.bsky.feed.getFeedSkeleton?feed=${encodeURIComponent(feedUri)}&limit=5`,
    )
    expect(res.ok()).toBeTruthy()
    const body = await res.json() as { feed: { post: string }[] }
    expect(Array.isArray(body.feed)).toBeTruthy()
    body.feed.forEach((item) => {
      expect(item.post.startsWith('at://')).toBeTruthy()
    })
  })

  test('getFeedSkeleton returns trending feed', async ({ request }) => {
    const domain = new URL(API).host
    const feedUri = `at://did:web:${domain}/app.bsky.feed.generator/trending`
    const res = await request.get(
      `${API}/xrpc/app.bsky.feed.getFeedSkeleton?feed=${encodeURIComponent(feedUri)}&limit=5`,
    )
    expect(res.ok()).toBeTruthy()
    const body = await res.json() as { feed: unknown[] }
    expect(Array.isArray(body.feed)).toBeTruthy()
  })

  test('getFeedSkeleton rejects unknown feed', async ({ request }) => {
    const res = await request.get(
      `${API}/xrpc/app.bsky.feed.getFeedSkeleton?feed=at://did:web:floq.com/app.bsky.feed.generator/unknown`,
    )
    expect(res.status()).toBe(400)
  })

  test('getActorFeeds returns feed list', async ({ request }) => {
    const res = await request.get(`${API}/xrpc/app.bsky.feed.getActorFeeds`)
    expect(res.ok()).toBeTruthy()
    const body = await res.json() as { feeds: unknown[] }
    expect(Array.isArray(body.feeds)).toBeTruthy()
  })
})

test.describe('AT Protocol / DID:web (UI)', () => {
  test('explore page shows Bluesky feed CTA', async ({ page }) => {
    await page.goto('/explore')
    await expect(page.getByText(/bluesky'da aç/i)).toBeVisible()
  })

  test('Bluesky feed link points to bsky.app', async ({ page }) => {
    await page.goto('/explore')
    const link = page.getByRole('link', { name: /bluesky'da aç/i })
    const href = await link.getAttribute('href')
    expect(href).toContain('bsky.app')
  })
})
