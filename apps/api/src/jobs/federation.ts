import { Queue, Worker, type Job } from 'bullmq'
import { env } from '../lib/env.js'
import { signRequest } from '../lib/httpSignatures.js'
import { db } from '../db/client.js'
import { actors, apActivities, instances } from '../db/schema.js'
import { eq, sql } from 'drizzle-orm'
import { decryptPrivateKey } from '../lib/keys.js'
import { signObject } from '../lib/objectIntegrity.js'
import { federationFetch } from '../lib/federationFetch.js'

export interface FederationJobData {
  senderHandle: string
  targetInbox: string
  activity: Record<string, unknown>
  activityId: string
}

function redisConnection() {
  const url = new URL(env.REDIS_URL)
  return {
    host: url.hostname,
    port: parseInt(url.port || '6379', 10),
    password: url.password || undefined,
    maxRetriesPerRequest: null,
  }
}

export const federationQueue = new Queue<FederationJobData>('federation', {
  connection: redisConnection(),
  defaultJobOptions: {
    attempts: 5,
    backoff: { type: 'exponential', delay: 60_000 },
    removeOnComplete: { count: 1000 },
    removeOnFail: { count: 5000 },
  },
})

export function startFederationWorker() {
  const worker = new Worker<FederationJobData>(
    'federation',
    async (job: Job<FederationJobData>) => {
      const { senderHandle, targetInbox, activity, activityId } = job.data

      const actor = await db.query.actors.findFirst({
        where: eq(actors.handle, senderHandle),
      })
      if (!actor?.privateKeyEncrypted) {
        throw new Error(`No private key for ${senderHandle}`)
      }

      const privateKeyPem = decryptPrivateKey(actor.privateKeyEncrypted)
      const keyId = `${env.APP_URL}/users/${senderHandle}#main-key`

      // FEP-8b32: sign the activity object with ed25519 if actor has the key
      let signedActivity: Record<string, unknown> = activity
      if (actor.ed25519PrivateKeyEncrypted) {
        signedActivity = signObject(activity, {
          handle: senderHandle,
          ed25519PrivateKeyEncrypted: actor.ed25519PrivateKeyEncrypted,
        }) as Record<string, unknown>
      }

      const body = JSON.stringify(signedActivity)
      const url = new URL(targetInbox)

      const signed = signRequest({
        method: 'POST',
        url,
        body,
        privateKeyPem,
        keyId,
      })

      const res = await federationFetch(targetInbox, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/activity+json',
          Accept: 'application/activity+json',
          Host: url.host,
          Date: signed.Date,
          Signature: signed.Signature,
          ...(signed.Digest && { Digest: signed.Digest }),
        },
        body,
        signal: AbortSignal.timeout(30_000),
      })

      const success = res.ok || res.status === 202 || res.status === 410
      const domain = url.hostname
      const now = new Date()

      // Track per-domain delivery health
      void db.update(instances)
        .set({
          lastDeliveryAt: now,
          lastDeliverySuccess: success,
          deliveryFailureCount: success
            ? 0
            : sql`${instances.deliveryFailureCount} + 1`,
          updatedAt: now,
        })
        .where(eq(instances.domain, domain))

      if (!success) {
        throw new Error(`Delivery failed: ${res.status} ${res.statusText} → ${targetInbox}`)
      }

      await db
        .update(apActivities)
        .set({ status: 'done', processedAt: new Date() })
        .where(eq(apActivities.apId, activityId))
    },
    {
      connection: redisConnection(),
      concurrency: 10,
    },
  )

  worker.on('failed', async (job, err) => {
    if (!job || job.attemptsMade < (job.opts.attempts ?? 5)) return
    await db
      .update(apActivities)
      .set({ status: 'failed', errorMessage: String(err.message) })
      .where(eq(apActivities.apId, job.data.activityId))
  })

  return worker
}
