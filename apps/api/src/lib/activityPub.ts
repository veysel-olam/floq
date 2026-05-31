import { env } from './env.js'
import { didKeyFromMultibase } from './keys.js'

export const AP_CONTEXT = [
  'https://www.w3.org/ns/activitystreams',
  'https://w3id.org/security/v1',
  'https://w3id.org/security/data-integrity/v1',
]

export const AP_CONTENT_TYPE = 'application/activity+json'

export interface APActor {
  '@context': unknown
  id: string
  type: 'Person' | 'Group' | 'Service' | 'Organization' | 'Application'
  preferredUsername: string
  name: string
  summary: string
  url: string
  inbox: string
  outbox: string
  followers: string
  following: string
  endpoints: { sharedInbox: string; dmPublicKey?: string }
  publicKey: {
    id: string
    owner: string
    publicKeyPem: string
  }
  icon?: { type: 'Image'; mediaType: string; url: string }
  image?: { type: 'Image'; mediaType: string; url: string }
  manuallyApprovesFollowers: boolean
  indexable: boolean
  alsoKnownAs?: string[]
  movedTo?: string
  assertionMethod?: Array<{
    id: string
    type: 'Multikey'
    controller: string
    publicKeyMultibase: string
  }>
  attachment?: Array<{
    type: 'PropertyValue'
    name: string
    value: string
  }>
}

export interface APNote {
  '@context': unknown
  id: string
  type: 'Note'
  attributedTo: string
  content: string
  url: string
  to: string[]
  cc: string[]
  published: string
  sensitive: boolean
  summary?: string
  inReplyTo?: string
  tag?: Array<{ type: 'Hashtag' | 'Mention' | 'Emoji'; href?: string; name: string }>
}

export interface APQuestion {
  '@context': unknown
  id: string
  type: 'Question'
  attributedTo: string
  content: string
  url: string
  to: string[]
  cc: string[]
  published: string
  sensitive: boolean
  endTime: string
  votersCount: number
  oneOf?: Array<{ type: 'Note'; name: string; replies: { type: 'Collection'; totalItems: number } }>
  anyOf?: Array<{ type: 'Note'; name: string; replies: { type: 'Collection'; totalItems: number } }>
  summary?: string
  tag?: Array<{ type: 'Hashtag' | 'Mention' | 'Emoji'; href?: string; name: string }>
  closed?: string
}

export interface APActivity {
  '@context': unknown
  id: string
  type: string
  actor: string
  object: unknown
  to?: string[]
  cc?: string[]
  published?: string
  content?: string
}

export function actorUrl(handle: string) {
  return `${env.APP_URL}/users/${handle}`
}

export function postUrl(handle: string, postId: string) {
  return `${env.APP_URL}/users/${handle}/posts/${postId}`
}

export function activityUrl(handle: string, type: string, targetId: string) {
  return `${env.APP_URL}/users/${handle}/activities/${type.toLowerCase()}/${targetId}`
}

export function buildActor(actor: {
  handle: string
  displayName: string | null
  bio: string | null
  avatarUrl: string | null
  headerUrl: string | null
  publicKey: string
  isLocked: boolean
  noIndex?: boolean
  actorType?: string | null
  ed25519PublicKey?: string | null
  dmPublicKey?: string | null
  alsoKnownAs?: string[] | null
  movedToUri?: string | null
  profileFields?: Array<{ name: string; value: string; verifiedAt: string | null }> | null
}): APActor {
  const id = actorUrl(actor.handle)
  const type = (actor.actorType === 'Group' || actor.actorType === 'Service' || actor.actorType === 'Organization')
    ? actor.actorType : 'Person'
  const obj: APActor = {
    '@context': AP_CONTEXT,
    id,
    type,
    preferredUsername: actor.handle,
    name: actor.displayName ?? actor.handle,
    summary: actor.bio ?? '',
    url: `${env.WEB_URL}/${actor.handle}`,
    inbox: `${id}/inbox`,
    outbox: `${id}/outbox`,
    followers: `${id}/followers`,
    following: `${id}/following`,
    endpoints: {
      sharedInbox: `${env.APP_URL}/inbox`,
      ...(actor.dmPublicKey ? { dmPublicKey: actor.dmPublicKey } : {}),
    },
    publicKey: {
      id: `${id}#main-key`,
      owner: id,
      publicKeyPem: actor.publicKey,
    },
    manuallyApprovesFollowers: actor.isLocked,
    indexable: !actor.noIndex,
  }
  if (actor.ed25519PublicKey) {
    obj.assertionMethod = [{
      id: `${id}#ed25519-key`,
      type: 'Multikey',
      controller: id,
      publicKeyMultibase: actor.ed25519PublicKey,
    }]
  }
  if (actor.avatarUrl) {
    obj.icon = { type: 'Image', mediaType: 'image/jpeg', url: actor.avatarUrl }
  }
  if (actor.headerUrl) {
    obj.image = { type: 'Image', mediaType: 'image/jpeg', url: actor.headerUrl }
  }
  const alsoKnownAs = [...(actor.alsoKnownAs ?? [])]
  if (actor.ed25519PublicKey) {
    try {
      alsoKnownAs.push(didKeyFromMultibase(actor.ed25519PublicKey))
    } catch { /* skip if key is malformed */ }
  }
  if (alsoKnownAs.length) {
    obj.alsoKnownAs = alsoKnownAs
  }
  if (actor.movedToUri) {
    obj.movedTo = actor.movedToUri
  }
  if (actor.profileFields?.length) {
    obj.attachment = actor.profileFields.map((f) => ({
      type: 'PropertyValue' as const,
      name: f.name,
      // For verified fields, wrap value in rel="me" anchor; otherwise plain text
      value: f.verifiedAt
        ? `<a href="${escapeHtml(f.value)}" rel="me nofollow noopener noreferrer" target="_blank">${escapeHtml(f.value)}</a>`
        : escapeHtml(f.value),
    }))
  }
  return obj
}

function escapeHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
}

export interface CustomEmojiTag {
  shortcode: string
  imageUrl: string
}

export function buildNote(post: {
  id: string
  content: string
  sensitive: boolean
  contentWarning: string | null
  visibility: 'public' | 'unlisted' | 'followers' | 'close_friends' | 'direct'
  createdAt: Date
  apInReplyTo: string | null
  tags?: string[] | null
  author: { handle: string }
  customEmojis?: CustomEmojiTag[]
}): APNote {
  const authorId = actorUrl(post.author.handle)
  const noteId = postUrl(post.author.handle, post.id)

  const PUBLIC = 'https://www.w3.org/ns/activitystreams#Public'
  const followers = `${authorId}/followers`

  let to: string[]
  let cc: string[]
  if (post.visibility === 'public') {
    to = [PUBLIC]
    cc = [followers]
  } else if (post.visibility === 'unlisted') {
    to = [followers]
    cc = [PUBLIC]
  } else if (post.visibility === 'followers') {
    to = [followers]
    cc = []
  } else {
    to = []
    cc = []
  }

  const note: APNote = {
    '@context': AP_CONTEXT,
    id: noteId,
    type: 'Note',
    attributedTo: authorId,
    content: post.content,
    url: noteId,
    to,
    cc,
    published: post.createdAt.toISOString(),
    sensitive: post.sensitive,
  }
  if (post.contentWarning) note.summary = post.contentWarning
  if (post.apInReplyTo) note.inReplyTo = post.apInReplyTo

  const tagArr: APNote['tag'] = []
  if (post.tags?.length) {
    for (const t of post.tags) {
      tagArr.push({ type: 'Hashtag', href: `${env.APP_URL}/tags/${encodeURIComponent(t)}`, name: `#${t}` })
    }
  }
  if (post.customEmojis?.length) {
    for (const e of post.customEmojis) {
      tagArr.push({
        type: 'Emoji',
        name: `:${e.shortcode}:`,
        href: e.imageUrl,
      })
    }
  }
  if (tagArr.length) note.tag = tagArr

  return note
}

// Direct message as an AP Note: addressed only to the recipient (no Public/
// followers), with a Mention tag. Content is plain text — cross-server DMs can't
// be E2E-encrypted (the remote, e.g. Mastodon, can't decrypt), so this is NOT
// private the way local floq↔floq DMs are.
export function buildDirectNote(opts: {
  postId: string
  content: string
  authorHandle: string
  recipientApId: string
  recipientHandle: string
  createdAt: Date
}): APNote {
  return {
    '@context': AP_CONTEXT,
    id: postUrl(opts.authorHandle, opts.postId),
    type: 'Note',
    attributedTo: actorUrl(opts.authorHandle),
    content: opts.content,
    url: postUrl(opts.authorHandle, opts.postId),
    to: [opts.recipientApId],
    cc: [],
    published: opts.createdAt.toISOString(),
    sensitive: false,
    tag: [{ type: 'Mention', href: opts.recipientApId, name: `@${opts.recipientHandle}` }],
  }
}

export function buildQuestion(post: {
  id: string
  content: string
  sensitive: boolean
  contentWarning: string | null
  visibility: 'public' | 'unlisted' | 'followers' | 'close_friends' | 'direct'
  createdAt: Date
  apInReplyTo: string | null
  tags?: string[] | null
  author: { handle: string }
  customEmojis?: CustomEmojiTag[]
}, poll: {
  multipleChoice: boolean
  votersCount: number
  expiresAt: Date
  options: Array<{ text: string; votesCount: number }>
}): APQuestion {
  const authorId = actorUrl(post.author.handle)
  const noteId = postUrl(post.author.handle, post.id)
  const PUBLIC = 'https://www.w3.org/ns/activitystreams#Public'
  const followers = `${authorId}/followers`

  let to: string[]
  let cc: string[]
  if (post.visibility === 'public') {
    to = [PUBLIC]; cc = [followers]
  } else if (post.visibility === 'unlisted') {
    to = [followers]; cc = [PUBLIC]
  } else if (post.visibility === 'followers') {
    to = [followers]; cc = []
  } else {
    to = []; cc = []
  }

  const choiceKey = poll.multipleChoice ? 'anyOf' : 'oneOf'
  const choices = poll.options.map((o) => ({
    type: 'Note' as const,
    name: o.text,
    replies: { type: 'Collection' as const, totalItems: o.votesCount },
  }))

  const q: APQuestion = {
    '@context': AP_CONTEXT,
    id: noteId,
    type: 'Question',
    attributedTo: authorId,
    content: post.content,
    url: noteId,
    to,
    cc,
    published: post.createdAt.toISOString(),
    sensitive: post.sensitive,
    endTime: poll.expiresAt.toISOString(),
    votersCount: poll.votersCount,
    [choiceKey]: choices,
  }

  if (post.contentWarning) q.summary = post.contentWarning
  if (new Date() > poll.expiresAt) q.closed = poll.expiresAt.toISOString()

  const tagArr: APQuestion['tag'] = []
  if (post.tags?.length) {
    for (const t of post.tags) {
      tagArr.push({ type: 'Hashtag', href: `${env.APP_URL}/tags/${encodeURIComponent(t)}`, name: `#${t}` })
    }
  }
  if (post.customEmojis?.length) {
    for (const e of post.customEmojis) {
      tagArr.push({ type: 'Emoji', name: `:${e.shortcode}:`, href: e.imageUrl })
    }
  }
  if (tagArr.length) q.tag = tagArr

  return q
}

export function buildCreate(note: APNote | APQuestion, actorHandle: string): APActivity {
  const actorId = actorUrl(actorHandle)
  return {
    '@context': AP_CONTEXT,
    id: `${note.id}/activity`,
    type: 'Create',
    actor: actorId,
    object: note,
    to: note.to,
    cc: note.cc,
    published: note.published,
  }
}

export function buildDelete(postApId: string, actorHandle: string, deletedAt?: Date): APActivity {
  const actorId = actorUrl(actorHandle)
  const deletedTs = (deletedAt ?? new Date()).toISOString()
  return {
    '@context': AP_CONTEXT,
    id: `${postApId}#delete`,
    type: 'Delete',
    actor: actorId,
    object: {
      id: postApId,
      type: 'Tombstone',
      formerType: 'Note',
      deleted: deletedTs,
    },
    to: ['https://www.w3.org/ns/activitystreams#Public'],
    published: deletedTs,
  }
}

export function buildFollow(
  followerHandle: string,
  targetActorId: string,
  followId: string,
): APActivity {
  const actorId = actorUrl(followerHandle)
  return {
    '@context': AP_CONTEXT,
    id: activityUrl(followerHandle, 'follow', followId),
    type: 'Follow',
    actor: actorId,
    object: targetActorId,
  }
}

export function buildAccept(
  targetHandle: string,
  followActivity: APActivity,
): APActivity {
  const actorId = actorUrl(targetHandle)
  return {
    '@context': AP_CONTEXT,
    id: `${actorId}#accept-${Date.now()}`,
    type: 'Accept',
    actor: actorId,
    object: followActivity,
  }
}

export function buildUndo(
  actorHandle: string,
  wrappedActivity: APActivity,
): APActivity {
  const actorId = actorUrl(actorHandle)
  return {
    '@context': AP_CONTEXT,
    id: `${wrappedActivity.id}#undo`,
    type: 'Undo',
    actor: actorId,
    object: wrappedActivity,
  }
}

export function buildUpdateNote(note: APNote, actorHandle: string): APActivity {
  const actorId = actorUrl(actorHandle)
  return {
    '@context': AP_CONTEXT,
    id: `${note.id}#update-${Date.now()}`,
    type: 'Update',
    actor: actorId,
    object: note,
    to: note.to,
    cc: note.cc,
    published: new Date().toISOString(),
  }
}

export function buildUpdateQuestion(question: APQuestion, actorHandle: string): APActivity {
  const actorId = actorUrl(actorHandle)
  return {
    '@context': AP_CONTEXT,
    id: `${question.id}#update-${Date.now()}`,
    type: 'Update',
    actor: actorId,
    object: question,
    to: question.to,
    cc: question.cc,
    published: new Date().toISOString(),
  }
}

export function buildUpdate(actor: APActor): APActivity {
  const PUBLIC = 'https://www.w3.org/ns/activitystreams#Public'
  return {
    '@context': AP_CONTEXT,
    id: `${actor.id}#update-${Date.now()}`,
    type: 'Update',
    actor: actor.id,
    object: actor,
    to: [PUBLIC],
    cc: [`${actor.followers}`],
    published: new Date().toISOString(),
  }
}

export function buildMove(
  fromActorHandle: string,
  toActorId: string,
): APActivity {
  const actorId = actorUrl(fromActorHandle)
  const PUBLIC = 'https://www.w3.org/ns/activitystreams#Public'
  return {
    '@context': AP_CONTEXT,
    id: `${actorId}#move-${Date.now()}`,
    type: 'Move',
    actor: actorId,
    object: actorId,
    target: toActorId,
    to: [PUBLIC],
    cc: [`${actorId}/followers`],
    published: new Date().toISOString(),
  } as APActivity & { target: string }
}

export function buildLike(
  actorHandle: string,
  postApId: string,
  likeId: string,
): APActivity {
  const actorId = actorUrl(actorHandle)
  return {
    '@context': AP_CONTEXT,
    id: activityUrl(actorHandle, 'like', likeId),
    type: 'Like',
    actor: actorId,
    object: postApId,
  }
}

// Emoji reaction (FEP / Misskey-Pleroma `EmojiReact`). `content` is the emoji.
export function buildEmojiReact(
  actorHandle: string,
  postApId: string,
  reactionId: string,
  emoji: string,
): APActivity {
  return {
    '@context': AP_CONTEXT,
    id: activityUrl(actorHandle, 'react', reactionId),
    type: 'EmojiReact',
    actor: actorUrl(actorHandle),
    object: postApId,
    content: emoji,
  }
}

export function buildAnnounce(
  actorHandle: string,
  postApId: string,
  boostId: string,
): APActivity {
  const actorId = actorUrl(actorHandle)
  const PUBLIC = 'https://www.w3.org/ns/activitystreams#Public'
  return {
    '@context': AP_CONTEXT,
    id: activityUrl(actorHandle, 'announce', boostId),
    type: 'Announce',
    actor: actorId,
    object: postApId,
    to: [PUBLIC],
    cc: [`${actorId}/followers`],
    published: new Date().toISOString(),
  }
}
