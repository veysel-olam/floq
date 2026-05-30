import { Queue, Worker } from 'bullmq'
import { env } from '../lib/env.js'
import { db } from '../db/client.js'
import { posts, actors, follows } from '../db/schema.js'
import { eq, and, isNotNull } from 'drizzle-orm'
import { publish } from '../lib/pubsub.js'
import { buildNote, buildCreate } from '../lib/activityPub.js'
import { deliverToFollowers } from '../lib/federation.js'
import { notifyReply } from '../lib/notify.js'

function redisConnection() {
  const url = new URL(env.REDIS_URL)
  return { host: url.hostname, port: parseInt(url.port || '6379', 10), password: url.password || undefined, maxRetriesPerRequest: null }
}

export const schedulerQueue = new Queue('scheduler', { connection: redisConnection() })

export function schedulePostPublish(postId: string, scheduledAt: Date) {
  const delay = Math.max(0, scheduledAt.getTime() - Date.now())
  return schedulerQueue.add('publish', { postId }, { delay, jobId: `publish-${postId}` })
}

export function startSchedulerWorker() {
  return new Worker('scheduler', async (job) => {
    const { postId } = job.data as { postId: string }

    // Fetch post (only if not deleted and still scheduled)
    const post = await db.query.posts.findFirst({
      where: and(eq(posts.id, postId), eq(posts.isDeleted, false), isNotNull(posts.scheduledAt)),
    })
    if (!post) return // already published or deleted

    // Fetch author
    const actor = await db.query.actors.findFirst({ where: eq(actors.id, post.authorId) })
    if (!actor) return

    // Mark as published
    await db.update(posts).set({ scheduledAt: null }).where(eq(posts.id, postId))

    // SSE to local followers
    if (post.visibility === 'public' || post.visibility === 'unlisted') {
      const localFollowers = await db.query.follows.findMany({
        where: and(eq(follows.followingId, actor.id), eq(follows.status, 'accepted')),
        with: { follower: { columns: { userId: true, isLocal: true } } },
      })
      for (const f of localFollowers) {
        if (f.follower.isLocal && f.follower.userId) {
          void publish(f.follower.userId, { event: 'new_post', payload: { authorId: actor.id } })
        }
      }
    }

    // Reply notification
    if (post.replyToId) {
      void notifyReply(actor.id, post.id, post.replyToId)
    }

    // Federation
    if (post.visibility === 'public' || post.visibility === 'unlisted') {
      const fullPost = { ...post, scheduledAt: null, author: actor, apInReplyTo: null }
      const note = buildNote(fullPost)
      const create = buildCreate(note, actor.handle)
      void deliverToFollowers(actor.handle, actor.id, create)
    }
  }, { connection: redisConnection() })
}
