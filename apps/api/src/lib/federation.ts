import { db } from '../db/client.js'
import { actors, follows, apActivities, instances, relays } from '../db/schema.js'
import { eq, and } from 'drizzle-orm'
import { federationQueue } from '../jobs/federation.js'
import type { APActivity } from './activityPub.js'
import { signRequest } from './httpSignatures.js'
import { decryptPrivateKey, generateActorKeyPair } from './keys.js'
import { env } from './env.js'
import { federationFetch } from './federationFetch.js'

export async function deliverToFollowers(
  senderHandle: string,
  senderId: string,
  activity: APActivity,
  opts?: { perActorInbox?: boolean },
) {
  const followerRows = await db.query.follows.findMany({
    where: and(eq(follows.followingId, senderId), eq(follows.status, 'accepted')),
    with: { follower: true },
  })

  const remoteFollowers = followerRows
    .map((f) => f.follower)
    .filter((a) => !a.isLocal)

  // For followers-only content, send to each actor's personal inbox (not sharedInbox)
  // so the receiving server can verify the recipient is actually a follower.
  const inboxes = opts?.perActorInbox
    ? dedupe(remoteFollowers.map((a) => a.inboxUrl))
    : dedupe(remoteFollowers.map((a) => a.sharedInboxUrl ?? a.inboxUrl))

  await enqueueToInboxes(senderHandle, inboxes, activity)
}

export async function deliverToInbox(
  senderHandle: string,
  targetInboxUrl: string,
  activity: APActivity,
) {
  await enqueueToInboxes(senderHandle, [targetInboxUrl], activity)
}

export async function deliverToActor(
  senderHandle: string,
  targetActorId: string,
  activity: APActivity,
) {
  const target = await db.query.actors.findFirst({
    where: eq(actors.apId, targetActorId),
  })
  if (!target) return
  const inbox = target.sharedInboxUrl ?? target.inboxUrl
  await enqueueToInboxes(senderHandle, [inbox], activity)
}

export async function isSuspendedDomain(domain: string): Promise<boolean> {
  const instance = await db.query.instances.findFirst({
    where: eq(instances.domain, domain),
  })
  return instance?.isSuspended ?? false
}

async function filterSuspendedInboxes(inboxes: string[]): Promise<string[]> {
  const results = await Promise.all(
    inboxes.map(async (inbox) => {
      try {
        const domain = new URL(inbox).hostname
        return (await isSuspendedDomain(domain)) ? null : inbox
      } catch {
        return null
      }
    }),
  )
  return results.filter((x): x is string => x !== null)
}

async function enqueueToInboxes(
  senderHandle: string,
  inboxes: string[],
  activity: APActivity,
) {
  if (inboxes.length === 0) return
  inboxes = await filterSuspendedInboxes(inboxes)
  if (inboxes.length === 0) return

  const activityId = activity.id as string

  await db
    .insert(apActivities)
    .values({
      apId: activityId,
      type: activity.type,
      actorApId: activity.actor as string,
      objectApId: typeof activity.object === 'string'
        ? activity.object
        : (activity.object as { id?: string } | null)?.id ?? null,
      direction: 'outbound',
      status: 'pending',
      rawJson: activity as unknown as Record<string, unknown>,
    })
    .onConflictDoNothing()

  const jobs = inboxes.map((inbox) => ({
    name: 'deliver',
    data: {
      senderHandle,
      targetInbox: inbox,
      activity: activity as unknown as Record<string, unknown>,
      activityId,
    },
  }))

  await federationQueue.addBulk(jobs)
}

function dedupe(arr: string[]): string[] {
  return [...new Set(arr)]
}

// ─── Instance Actor (for Authorized Fetch) ────────────────────────────────────
// A special local bot actor used to sign outgoing AP GET requests.
const INSTANCE_ACTOR_HANDLE = 'instance.actor'

let _instanceActor: typeof actors.$inferSelect | null = null

export async function getInstanceActor(): Promise<typeof actors.$inferSelect> {
  if (_instanceActor) return _instanceActor

  const existing = await db.query.actors.findFirst({
    where: eq(actors.handle, INSTANCE_ACTOR_HANDLE),
  })
  if (existing) {
    _instanceActor = existing
    return existing
  }

  // First run: generate a key pair and create the instance actor
  const { publicKeyPem, privateKeyEncrypted } = await generateActorKeyPair()
  const apId = `${env.APP_URL}/actor`
  const [created] = await db.insert(actors).values({
    apId,
    handle: INSTANCE_ACTOR_HANDLE,
    displayName: env.APP_DOMAIN,
    isLocal: true,
    isBot: true,
    publicKey: publicKeyPem,
    privateKeyEncrypted,
    inboxUrl: `${env.APP_URL}/actor/inbox`,
    outboxUrl: `${env.APP_URL}/actor/outbox`,
    profileUrl: apId,
    followersUrl: `${env.APP_URL}/actor/followers`,
    followingUrl: `${env.APP_URL}/actor/following`,
  }).onConflictDoNothing().returning()

  _instanceActor = created ?? (await db.query.actors.findFirst({ where: eq(actors.handle, INSTANCE_ACTOR_HANDLE) }))!
  return _instanceActor!
}

export async function signedApFetch(url: string): Promise<Response> {
  const instanceActor = await getInstanceActor()
  if (!instanceActor.privateKeyEncrypted) {
    return federationFetch(url, { headers: { Accept: 'application/activity+json' }, signal: AbortSignal.timeout(10_000) })
  }

  const privateKeyPem = decryptPrivateKey(instanceActor.privateKeyEncrypted)
  const keyId = `${env.APP_URL}/actor#main-key`
  const signed = signRequest({ method: 'GET', url: new URL(url), privateKeyPem, keyId })

  return federationFetch(url, {
    headers: {
      Accept: 'application/activity+json',
      Host: new URL(url).host,
      Date: signed.Date,
      Signature: signed.Signature,
    },
    signal: AbortSignal.timeout(10_000),
  })
}

// ── Relay support ─────────────────────────────────────────────────────────────

export async function deliverToRelays(activity: APActivity) {
  const accepted = await db.query.relays.findMany({ where: eq(relays.status, 'accepted') })
  if (!accepted.length) return
  await enqueueToInboxes(INSTANCE_ACTOR_HANDLE, accepted.map((r) => r.inboxUrl), activity)
}

export async function followRelay(inboxUrl: string, relayActorUrl: string) {
  const { AP_CONTEXT } = await import('./activityPub.js')
  const instanceActorId = `${env.APP_URL}/actor`
  const followId = `${env.APP_URL}/actor/follows/${encodeURIComponent(relayActorUrl)}`
  const followActivity: APActivity = {
    '@context': AP_CONTEXT,
    id: followId,
    type: 'Follow',
    actor: instanceActorId,
    object: relayActorUrl,
  }
  await enqueueToInboxes(INSTANCE_ACTOR_HANDLE, [inboxUrl], followActivity)
  await db.insert(relays).values({ inboxUrl, actorUrl: relayActorUrl, status: 'pending' }).onConflictDoUpdate({
    target: relays.inboxUrl,
    set: { status: 'pending', actorUrl: relayActorUrl },
  })
}

export async function unfollowRelay(inboxUrl: string, relayActorUrl: string) {
  const { AP_CONTEXT } = await import('./activityPub.js')
  const instanceActorId = `${env.APP_URL}/actor`
  const followId = `${env.APP_URL}/actor/follows/${encodeURIComponent(relayActorUrl)}`
  const followActivity: APActivity = {
    '@context': AP_CONTEXT,
    id: followId,
    type: 'Follow',
    actor: instanceActorId,
    object: relayActorUrl,
  }
  const undo: APActivity = {
    '@context': AP_CONTEXT,
    id: `${followId}#undo`,
    type: 'Undo',
    actor: instanceActorId,
    object: followActivity,
  }
  await enqueueToInboxes(INSTANCE_ACTOR_HANDLE, [inboxUrl], undo)
  await db.delete(relays).where(eq(relays.inboxUrl, inboxUrl))
}

export async function acceptRelayFollow(relayActorUrl: string) {
  await db.update(relays).set({ status: 'accepted' }).where(eq(relays.actorUrl, relayActorUrl))
}

// Remote actor cache TTL — re-fetch profile (avatar/bio/name) after this window.
const ACTOR_REFRESH_MS = 24 * 60 * 60 * 1000

// Read an AP collection's `totalItems` (followers/following/outbox counts).
async function fetchCollectionCount(url?: string): Promise<number | null> {
  if (!url) return null
  try {
    const res = await signedApFetch(url)
    if (!res.ok) return null
    const data = await res.json() as { totalItems?: number }
    return typeof data.totalItems === 'number' ? data.totalItems : null
  } catch {
    return null
  }
}

export async function fetchRemoteActor(actorUrl: string) {
  const existing = await db.query.actors.findFirst({
    where: eq(actors.apId, actorUrl),
  })
  // Serve from cache unless stale (so avatars/bios stay current over time).
  if (existing) {
    const age = existing.lastFetchedAt ? Date.now() - existing.lastFetchedAt.getTime() : Infinity
    if (age < ACTOR_REFRESH_MS) return existing
  }

  const res = await signedApFetch(actorUrl)
  if (!res.ok) return existing ?? null

  const data = (await res.json()) as {
    id: string
    type?: string
    preferredUsername: string
    name?: string
    summary?: string
    icon?: { url?: string }
    image?: { url?: string }
    inbox?: string
    outbox?: string
    followers?: string
    following?: string
    endpoints?: { sharedInbox?: string; dmPublicKey?: string }
    publicKey?: { publicKeyPem?: string }
    manuallyApprovesFollowers?: boolean
    indexable?: boolean
    url?: string
    assertionMethod?: Array<{ type?: string; publicKeyMultibase?: string }>
    attachment?: Array<{ type?: string; name?: string; value?: string }>
  }

  const domain = new URL(actorUrl).hostname

  // Pull follower/following/post counts from each collection's totalItems so
  // remote profiles show real numbers (these live behind the collection URLs).
  const [followersCount, followingCount, postsCount] = await Promise.all([
    fetchCollectionCount(data.followers),
    fetchCollectionCount(data.following),
    fetchCollectionCount(data.outbox),
  ])

  // Extract ed25519 public key from assertionMethod (FEP-8b32 / Multikey)
  const ed25519Key = data.assertionMethod
    ?.find((k) => k.type === 'Multikey' && k.publicKeyMultibase?.startsWith('z'))
    ?.publicKeyMultibase ?? null

  // Parse PropertyValue attachment fields (FEP-c7d3 / Mastodon verified links)
  const profileFields = data.attachment
    ?.filter((a) => a.type === 'PropertyValue' && a.name && a.value)
    .map((a) => ({ name: a.name!, value: a.value!, verifiedAt: null })) ?? null

  // Map the AP actor type (Lemmy communities are Group, bots are Service/
  // Application). Without this everything defaulted to Person → remote groups
  // were rejected as "not a Group" by the communities resolver.
  const ALLOWED_ACTOR_TYPES = ['Person', 'Group', 'Service', 'Application']
  const actorType = ALLOWED_ACTOR_TYPES.includes(data.type ?? '') ? data.type! : 'Person'

  const values = {
    apId: data.id,
    actorType,
    handle: `${data.preferredUsername}@${domain}`,
    displayName: data.name ?? data.preferredUsername,
    bio: data.summary ?? null,
    avatarUrl: data.icon?.url ?? null,
    headerUrl: data.image?.url ?? null,
    // Instance/Application actors (e.g. mastodon.social/actor) often omit these
    // collections — fall back so NOT NULL columns don't blow up the insert.
    inboxUrl: data.inbox ?? data.id,
    outboxUrl: data.outbox ?? data.id,
    followersUrl: data.followers ?? data.id,
    followingUrl: data.following ?? data.id,
    sharedInboxUrl: data.endpoints?.sharedInbox ?? null,
    profileUrl: data.url ?? data.id,
    publicKey: data.publicKey?.publicKeyPem ?? '',
    dmPublicKey: data.endpoints?.dmPublicKey ?? null,
    isLocal: false,
    isLocked: data.manuallyApprovesFollowers ?? false,
    noIndex: data.indexable === false,
    ed25519PublicKey: ed25519Key,
    profileFields: profileFields?.length ? profileFields : null,
    followersCount: followersCount ?? undefined,
    followingCount: followingCount ?? undefined,
    postsCount: postsCount ?? undefined,
    lastFetchedAt: new Date(),
  }

  // Refresh in place if we already knew this actor; otherwise insert.
  if (existing) {
    const [updated] = await db.update(actors)
      .set({ ...values, updatedAt: new Date() })
      .where(eq(actors.id, existing.id))
      .returning()
    return updated ?? existing
  }

  const [created] = await db
    .insert(actors)
    .values(values)
    .onConflictDoNothing()
    .returning()

  return created ?? existing
}
