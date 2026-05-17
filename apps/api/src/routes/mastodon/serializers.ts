/**
 * Mastodon API serializers — convert floq internal types to Mastodon-compatible JSON.
 * Spec: https://docs.joinmastodon.org/entities/
 */

import { env } from '../../lib/env.js'

type Actor = {
  id: string
  handle: string
  displayName: string | null
  bio: string | null
  avatarUrl: string | null
  headerUrl: string | null
  isLocked: boolean
  isBot: boolean
  isLocal: boolean
  actorType?: string | null
  followersCount: number
  followingCount: number
  postsCount: number
  profileFields?: Array<{ name: string; value: string; verifiedAt: string | null }> | null
  createdAt: Date
}

type Post = {
  id: string
  content: string
  contentWarning: string | null
  visibility: string
  sensitive: boolean
  language: string | null
  isDeleted: boolean
  likesCount: number
  boostsCount: number
  repliesCount: number
  replyToId: string | null
  apInReplyTo: string | null
  createdAt: Date
  editedAt: Date | null
  authorId: string
  encryptedContent: string | null
  tags: string[]
}

type MediaAttachment = {
  id: string
  url: string
  previewUrl: string | null
  mimeType: string
  altText: string | null
  width: number | null
  height: number | null
  blurhash: string | null
}

type Notification = {
  id: string
  type: string
  createdAt: Date
  actorId: string | null
  postId: string | null
}

// ── Visibility mapping ────────────────────────────────────────────────────────
const VISIBILITY_MAP: Record<string, string> = {
  public: 'public',
  unlisted: 'unlisted',
  followers: 'private',
  direct: 'direct',
}

const NOTIFICATION_TYPE_MAP: Record<string, string> = {
  like: 'favourite',
  boost: 'reblog',
  reply: 'mention',
  mention: 'mention',
  follow: 'follow',
  follow_request: 'follow_request',
  poll_ended: 'poll',
}

export function toMastodonAccount(actor: Actor, myId?: string) {
  const acct = actor.isLocal ? actor.handle : `${actor.handle}`
  const url = actor.isLocal ? `${env.WEB_URL}/${actor.handle}` : `${env.APP_URL}/users/${actor.handle}`
  return {
    id: actor.id,
    username: actor.handle.split('@')[0] ?? actor.handle,
    acct,
    display_name: actor.displayName ?? actor.handle,
    locked: actor.isLocked,
    bot: actor.isBot,
    group: actor.actorType === 'Group',
    created_at: actor.createdAt.toISOString(),
    note: actor.bio ?? '',
    url,
    avatar: actor.avatarUrl ?? `${env.APP_URL}/default-avatar.png`,
    avatar_static: actor.avatarUrl ?? `${env.APP_URL}/default-avatar.png`,
    header: actor.headerUrl ?? `${env.APP_URL}/default-header.png`,
    header_static: actor.headerUrl ?? `${env.APP_URL}/default-header.png`,
    followers_count: actor.followersCount,
    following_count: actor.followingCount,
    statuses_count: actor.postsCount,
    last_status_at: null,
    emojis: [],
    fields: (actor.profileFields ?? []).map((f) => ({
      name: f.name,
      value: f.value,
      verified_at: f.verifiedAt,
    })),
    ...(myId !== undefined ? { muting: false, blocking: false, followed_by: false, following: false, requested: false, muting_notifications: false, domain_blocking: false } : {}),
  }
}

export function toMastodonStatus(
  post: Post,
  author: Actor,
  opts: {
    mediaAttachments?: MediaAttachment[]
    rebloggedBy?: Actor
    inReplyToAccountId?: string | null
    favourited?: boolean
    reblogged?: boolean
    bookmarked?: boolean
    pinned?: boolean
    muted?: boolean
    reblogPost?: Post | null
    reblogAuthor?: Actor | null
    reblogMedia?: MediaAttachment[]
  } = {},
) {
  const visibility = VISIBILITY_MAP[post.visibility] ?? 'public'
  const content = post.encryptedContent
    ? '<p>[Şifreli mesaj]</p>'
    : post.content

  const baseStatus = {
    id: post.id,
    created_at: post.createdAt.toISOString(),
    in_reply_to_id: post.replyToId ?? null,
    in_reply_to_account_id: opts.inReplyToAccountId ?? null,
    sensitive: post.sensitive,
    spoiler_text: post.contentWarning ?? '',
    visibility,
    language: post.language ?? 'tr',
    uri: `${env.APP_URL}/users/${author.handle}/posts/${post.id}`,
    url: `${env.WEB_URL}/${author.handle}/posts/${post.id}`,
    replies_count: post.repliesCount,
    reblogs_count: post.boostsCount,
    favourites_count: post.likesCount,
    edited_at: post.editedAt?.toISOString() ?? null,
    content,
    reblog: null as unknown,
    application: null,
    account: toMastodonAccount(author),
    media_attachments: (opts.mediaAttachments ?? []).map(toMastodonMedia),
    mentions: [],
    tags: post.tags.filter((t) => t.startsWith('#')).map((t) => ({ name: t.slice(1).toLowerCase(), url: `${env.WEB_URL}/tags/${t.slice(1)}` })),
    emojis: [],
    card: null,
    poll: null,
    favourited: opts.favourited ?? false,
    reblogged: opts.reblogged ?? false,
    muted: opts.muted ?? false,
    bookmarked: opts.bookmarked ?? false,
    pinned: opts.pinned ?? false,
    filtered: [],
    text: null,
  }

  // Boost wraps the original post
  if (opts.reblogPost && opts.reblogAuthor) {
    baseStatus.reblog = toMastodonStatus(opts.reblogPost, opts.reblogAuthor, {
      ...(opts.reblogMedia ? { mediaAttachments: opts.reblogMedia } : {}),
    })
  }

  return baseStatus
}

export function toMastodonMedia(media: MediaAttachment) {
  const type = media.mimeType.startsWith('image/') ? 'image'
    : media.mimeType.startsWith('video/') ? 'video'
    : media.mimeType.startsWith('audio/') ? 'audio'
    : 'unknown'

  return {
    id: media.id,
    type,
    url: media.url,
    preview_url: media.previewUrl ?? media.url,
    remote_url: null,
    text_url: null,
    meta: media.width && media.height ? {
      original: { width: media.width, height: media.height, size: `${media.width}x${media.height}`, aspect: media.width / media.height },
      small: { width: Math.min(media.width, 400), height: Math.round((media.height / media.width) * 400) },
    } : {},
    description: media.altText ?? null,
    blurhash: media.blurhash ?? null,
  }
}

export function toMastodonNotification(
  notification: Notification,
  actor: Actor | null,
  post: (Post & { author?: Actor; mediaAttachments?: MediaAttachment[] }) | null,
) {
  return {
    id: notification.id,
    type: NOTIFICATION_TYPE_MAP[notification.type] ?? notification.type,
    created_at: notification.createdAt.toISOString(),
    account: actor ? toMastodonAccount(actor) : null,
    status: post && post.author
      ? toMastodonStatus(post, post.author, { ...(post.mediaAttachments ? { mediaAttachments: post.mediaAttachments } : {}) })
      : null,
  }
}
