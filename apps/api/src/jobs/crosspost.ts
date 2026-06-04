import { Queue, Worker, type Job } from 'bullmq'
import { env } from '../lib/env.js'
import { crosspostToBluesky, sweepBlueskyImports, type CrosspostMedia } from '../lib/bluesky.js'
import { crosspostToNostr } from '../lib/nostr.js'

// Bridge cross-posting (Bluesky / Nostr) runs in a job so it survives a process
// restart and gets a few retries on transient relay/network failures — instead
// of a fire-and-forget that vanishes if the request handler returns first.
export interface CrosspostJobData {
  target: 'bluesky' | 'nostr' | 'import-sweep'
  content: string
  tags: string[]
  userId?: string                // bluesky: resolves the stored connection
  privateKeyEncrypted?: string   // nostr: encrypted secret key
  media?: CrosspostMedia[]        // bluesky: image attachments
  postId?: string                // bluesky: floq post id, for the import loop-guard
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

export const crosspostQueue = new Queue<CrosspostJobData>('crosspost', {
  connection: redisConnection(),
  defaultJobOptions: {
    // A few retries for transient failures. The cross-post fns no-op when the
    // bridge isn't connected/enabled, so a retry is cheap; the only edge is a
    // rare double-post if the publish succeeded but the worker died before ack.
    attempts: 3,
    backoff: { type: 'exponential', delay: 30_000 },
    removeOnComplete: { count: 200 },
    removeOnFail: { count: 500 },
  },
})

export function startCrosspostWorker() {
  const worker = new Worker<CrosspostJobData>(
    'crosspost',
    async (job: Job<CrosspostJobData>) => {
      const { target, content, tags, userId, privateKeyEncrypted, media, postId } = job.data
      if (target === 'bluesky' && userId) {
        await crosspostToBluesky(userId, content, tags, media ?? [], postId)
      } else if (target === 'nostr' && privateKeyEncrypted) {
        await crosspostToNostr(privateKeyEncrypted, content, tags)
      } else if (target === 'import-sweep') {
        await sweepBlueskyImports()
      }
    },
    { connection: redisConnection(), concurrency: 5 },
  )

  // Mirror connected users' Bluesky posts into floq every 10 minutes.
  void crosspostQueue.upsertJobScheduler(
    'bluesky-import',
    { every: 10 * 60_000 },
    { name: 'import-sweep', data: { target: 'import-sweep', content: '', tags: [] } },
  ).catch(() => {})

  return worker
}

// Enqueue helpers — keep the post route clean.
export function enqueueBlueskyCrosspost(userId: string, content: string, tags: string[], media: CrosspostMedia[] = [], postId?: string) {
  return crosspostQueue.add('bluesky', { target: 'bluesky', userId, content, tags, media, ...(postId ? { postId } : {}) })
}
export function enqueueNostrCrosspost(privateKeyEncrypted: string, content: string, tags: string[]) {
  return crosspostQueue.add('nostr', { target: 'nostr', privateKeyEncrypted, content, tags })
}
