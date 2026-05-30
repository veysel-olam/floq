import { Queue, Worker } from 'bullmq'
import { env } from '../lib/env.js'
import { db } from '../db/client.js'
import { posts, actors, flows } from '../db/schema.js'
import { eq, lt, and, isNotNull, sql } from 'drizzle-orm'

function redisConnection() {
  const url = new URL(env.REDIS_URL)
  return {
    host: url.hostname,
    port: parseInt(url.port || '6379', 10),
    password: url.password || undefined,
    maxRetriesPerRequest: null,
  }
}

export const momentsQueue = new Queue('moments', {
  connection: redisConnection(),
})

export function scheduleMomentExpiry(postId: string, expiresAt: Date) {
  const delay = Math.max(0, expiresAt.getTime() - Date.now())
  return momentsQueue.add('expire', { postId }, { delay, jobId: `expire-${postId}` })
}

export function startMomentsWorker() {
  const worker = new Worker(
    'moments',
    async (job) => {
      const { postId } = job.data as { postId: string }
      await db
        .update(posts)
        .set({ isDeleted: true })
        .where(and(eq(posts.id, postId), eq(posts.isEphemeral, true)))
    },
    { connection: redisConnection() },
  )
  return worker
}
