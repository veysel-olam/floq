import { db } from '../db/client.js'
import { notifications, posts, actors, follows, actorPreferences } from '../db/schema.js'
import type { InferSelectModel } from 'drizzle-orm'
import { eq, and } from 'drizzle-orm'
import { publish } from './pubsub.js'
import { sendPushToActor } from '../routes/push.js'

const PUSH_TITLES: Partial<Record<InferSelectModel<typeof notifications>['type'], string>> = {
  like: 'Birisi gönderini beğendi',
  boost: 'Birisi gönderini boostladı',
  reply: 'Yeni bir yanıt aldın',
  follow: 'Seni takip etmeye başladı',
  follow_request: 'Takip isteği aldın',
  mention: 'Birisi senden bahsetti',
}

type NotificationType = InferSelectModel<typeof notifications>['type']

async function isTypeEnabled(recipientId: string, type: NotificationType): Promise<boolean> {
  const prefs = await db.query.actorPreferences.findFirst({
    where: eq(actorPreferences.actorId, recipientId),
    columns: {
      notifyLike: true, notifyBoost: true, notifyReply: true,
      notifyMention: true, notifyFollow: true, notifyFollowRequest: true, notifyPollEnded: true,
    },
  })
  if (!prefs) return true
  const map: Partial<Record<NotificationType, boolean>> = {
    like:           prefs.notifyLike,
    boost:          prefs.notifyBoost,
    reply:          prefs.notifyReply,
    mention:        prefs.notifyMention,
    follow:         prefs.notifyFollow,
    follow_request: prefs.notifyFollowRequest,
    poll_ended:     prefs.notifyPollEnded,
  }
  return map[type] ?? true
}

export async function createNotification(params: {
  recipientId: string
  actorId: string
  type: NotificationType
  postId?: string
}) {
  // Kendine bildirim gönderme
  if (params.recipientId === params.actorId) return
  // Kullanıcı bu tür bildirimi kapattıysa oluşturma
  if (!(await isTypeEnabled(params.recipientId, params.type))) return

  await db
    .insert(notifications)
    .values({
      recipientId: params.recipientId,
      actorId: params.actorId,
      type: params.type,
      postId: params.postId ?? null,
      read: false,
    })
    .onConflictDoNothing()

  // Push SSE event to the recipient if they're a local actor
  const recipient = await db.query.actors.findFirst({
    where: and(eq(actors.id, params.recipientId), eq(actors.isLocal, true)),
    columns: { userId: true },
  })
  if (recipient?.userId) {
    void publish(recipient.userId, { event: 'notification', payload: { type: params.type } })
  }

  // Web push
  const pushTitle = PUSH_TITLES[params.type]
  if (pushTitle) {
    const actor = await db.query.actors.findFirst({
      where: eq(actors.id, params.actorId),
      columns: { handle: true, displayName: true },
    })
    const from = actor?.displayName ?? actor?.handle ?? 'Birisi'
    void sendPushToActor(params.recipientId, {
      title: `floq · ${pushTitle}`,
      body: from,
      url: params.postId ? `/posts/${params.postId}` : '/notifications',
    })
  }
}

async function isNotifySuppressed(actorId: string, recipientId: string): Promise<boolean> {
  // If the actor follows the recipient, check notifyOnActivity setting
  // (suppresses activity notifications from this actor toward their content)
  const follow = await db.query.follows.findFirst({
    where: and(eq(follows.followerId, recipientId), eq(follows.followingId, actorId)),
    columns: { notifyOnActivity: true },
  })
  // If recipient follows the actor and notifyOnActivity is false, suppress
  if (follow && !follow.notifyOnActivity) return true
  return false
}

export async function notifyLike(actorId: string, postId: string) {
  const post = await db.query.posts.findFirst({ where: eq(posts.id, postId) })
  if (!post) return
  if (await isNotifySuppressed(actorId, post.authorId)) return
  const existing = await db.query.notifications.findFirst({
    where: and(
      eq(notifications.recipientId, post.authorId),
      eq(notifications.actorId, actorId),
      eq(notifications.type, 'like'),
      eq(notifications.postId, postId),
    ),
  })
  if (existing) return
  await createNotification({ recipientId: post.authorId, actorId, type: 'like', postId })
}

export async function notifyBoost(actorId: string, postId: string) {
  const post = await db.query.posts.findFirst({ where: eq(posts.id, postId) })
  if (!post) return
  if (await isNotifySuppressed(actorId, post.authorId)) return
  // Skip if this actor already sent a boost notification for this post (unbost + reboost case)
  const existing = await db.query.notifications.findFirst({
    where: and(
      eq(notifications.recipientId, post.authorId),
      eq(notifications.actorId, actorId),
      eq(notifications.type, 'boost'),
      eq(notifications.postId, postId),
    ),
  })
  if (existing) return
  await createNotification({ recipientId: post.authorId, actorId, type: 'boost', postId })
}

export async function notifyReply(actorId: string, replyPostId: string, parentPostId: string) {
  const parent = await db.query.posts.findFirst({ where: eq(posts.id, parentPostId) })
  if (!parent) return
  if (await isNotifySuppressed(actorId, parent.authorId)) return
  await createNotification({
    recipientId: parent.authorId,
    actorId,
    type: 'reply',
    postId: replyPostId,
  })
}

export async function notifyFollow(followerId: string, followingId: string) {
  await createNotification({ recipientId: followingId, actorId: followerId, type: 'follow' })
}

export async function notifyFollowRequest(followerId: string, followingId: string) {
  await createNotification({ recipientId: followingId, actorId: followerId, type: 'follow_request' })
}

export async function notifyMention(actorId: string, postId: string, mentionedActorId: string) {
  await createNotification({ recipientId: mentionedActorId, actorId, type: 'mention', postId })
}

export async function notifySuspension(targetActorId: string, adminActorId: string) {
  await createNotification({ recipientId: targetActorId, actorId: adminActorId, type: 'account_suspended' })
}
