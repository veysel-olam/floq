import {
  pgTable,
  pgEnum,
  uuid,
  text,
  varchar,
  boolean,
  integer,
  timestamp,
  jsonb,
  index,
  uniqueIndex,
  primaryKey,
  type AnyPgColumn,
} from 'drizzle-orm/pg-core'
import { relations, sql } from 'drizzle-orm'

// ─── Enums ───────────────────────────────────────────────────────────────────

export const visibilityEnum = pgEnum('visibility', [
  'public',
  'unlisted',
  'followers',
  'close_friends',
  'direct',
])

export const activityStatusEnum = pgEnum('activity_status', [
  'pending',
  'processing',
  'done',
  'failed',
])

export const activityDirectionEnum = pgEnum('activity_direction', [
  'inbound',
  'outbound',
])

export const followStatusEnum = pgEnum('follow_status', [
  'pending',
  'accepted',
  'rejected',
])

export const notificationTypeEnum = pgEnum('notification_type', [
  'like',
  'boost',
  'reply',
  'mention',
  'follow',
  'follow_request',
  'poll_ended',
  'flow_post',
  'account_suspended',
])

export const actorRoleEnum = pgEnum('actor_role', ['user', 'moderator', 'admin'])

// ─── Better Auth Tables ───────────────────────────────────────────────────────
// Auth concerns (email/password/session) Better Auth'a delege edildi.
// actors tablosu sadece ActivityPub kimliğini tutar.

export const user = pgTable(
  'user',
  {
    id: text('id').primaryKey(),
    name: text('name').notNull(),
    email: text('email').notNull(),
    emailVerified: boolean('email_verified').notNull(),
    image: text('image'),
    createdAt: timestamp('created_at').notNull(),
    updatedAt: timestamp('updated_at').notNull(),
    // Floq-specific: kayıt sırasında seçilen benzersiz handle
    handle: text('handle').notNull(),
    twoFactorEnabled: boolean('two_factor_enabled').default(false).notNull(),
  },
  (t) => [
    uniqueIndex('user_email_idx').on(t.email),
    uniqueIndex('user_handle_idx').on(t.handle),
  ],
)

export const session = pgTable(
  'session',
  {
    id: text('id').primaryKey(),
    expiresAt: timestamp('expires_at').notNull(),
    token: text('token').notNull(),
    createdAt: timestamp('created_at').notNull(),
    updatedAt: timestamp('updated_at').notNull(),
    ipAddress: text('ip_address'),
    userAgent: text('user_agent'),
    userId: text('user_id')
      .notNull()
      .references(() => user.id, { onDelete: 'cascade' }),
  },
  (t) => [uniqueIndex('session_token_idx').on(t.token)],
)

export const account = pgTable('account', {
  id: text('id').primaryKey(),
  accountId: text('account_id').notNull(),
  providerId: text('provider_id').notNull(),
  userId: text('user_id')
    .notNull()
    .references(() => user.id, { onDelete: 'cascade' }),
  accessToken: text('access_token'),
  refreshToken: text('refresh_token'),
  idToken: text('id_token'),
  accessTokenExpiresAt: timestamp('access_token_expires_at'),
  refreshTokenExpiresAt: timestamp('refresh_token_expires_at'),
  scope: text('scope'),
  password: text('password'),
  createdAt: timestamp('created_at').notNull(),
  updatedAt: timestamp('updated_at').notNull(),
})

export const verification = pgTable('verification', {
  id: text('id').primaryKey(),
  identifier: text('identifier').notNull(),
  value: text('value').notNull(),
  expiresAt: timestamp('expires_at').notNull(),
  createdAt: timestamp('created_at'),
  updatedAt: timestamp('updated_at'),
})

export const twoFactor = pgTable('two_factor', {
  id: text('id').primaryKey(),
  secret: text('secret').notNull(),
  backupCodes: text('backup_codes').notNull(),
  userId: text('user_id')
    .notNull()
    .references(() => user.id, { onDelete: 'cascade' }),
})

// ─── Mastodon OAuth ───────────────────────────────────────────────────────────

export const mastoApps = pgTable('masto_apps', {
  id: uuid('id').primaryKey().defaultRandom(),
  clientId: text('client_id').notNull().unique(),
  clientSecret: text('client_secret').notNull(),
  name: varchar('name', { length: 255 }).notNull(),
  website: varchar('website', { length: 2048 }),
  redirectUris: text('redirect_uris').notNull(),   // newline-separated list
  scopes: varchar('scopes', { length: 500 }).notNull().default('read'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
})

export const mastoTokens = pgTable('masto_tokens', {
  id: uuid('id').primaryKey().defaultRandom(),
  token: text('token').notNull().unique(),
  userId: text('user_id').notNull().references(() => user.id, { onDelete: 'cascade' }),
  appId: uuid('app_id').references(() => mastoApps.id, { onDelete: 'cascade' }),
  scopes: varchar('scopes', { length: 500 }).notNull().default('read'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
}, (t) => [index('masto_tokens_user_idx').on(t.userId), index('masto_tokens_token_idx').on(t.token)])

export const mastoAuthCodes = pgTable('masto_auth_codes', {
  id: uuid('id').primaryKey().defaultRandom(),
  code: text('code').notNull().unique(),
  userId: text('user_id').notNull().references(() => user.id, { onDelete: 'cascade' }),
  appId: uuid('app_id').notNull().references(() => mastoApps.id, { onDelete: 'cascade' }),
  redirectUri: text('redirect_uri').notNull(),
  scopes: varchar('scopes', { length: 500 }).notNull(),
  expiresAt: timestamp('expires_at').notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
})

// ─── WebAuthn Passkeys ────────────────────────────────────────────────────────

export const passkeys = pgTable(
  'passkeys',
  {
    id: text('id').primaryKey(),           // credential ID (base64url)
    userId: text('user_id').notNull().references(() => user.id, { onDelete: 'cascade' }),
    name: varchar('name', { length: 255 }).notNull().default('Passkey'),
    publicKey: text('public_key').notNull(),  // cbor-encoded credential public key (base64url)
    counter: integer('counter').notNull().default(0),
    deviceType: varchar('device_type', { length: 32 }),   // 'singleDevice' | 'multiDevice'
    backedUp: boolean('backed_up').default(false).notNull(),
    transports: text('transports').array(),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    lastUsedAt: timestamp('last_used_at'),
  },
  (t) => [index('passkeys_user_idx').on(t.userId)],
)

// ─── Instances ────────────────────────────────────────────────────────────────

export const instances = pgTable(
  'instances',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    domain: varchar('domain', { length: 255 }).notNull(),
    software: varchar('software', { length: 100 }),
    softwareVersion: varchar('software_version', { length: 50 }),
    name: varchar('name', { length: 255 }),
    description: text('description'),
    sharedInboxUrl: varchar('shared_inbox_url', { length: 2048 }),
    isSuspended: boolean('is_suspended').default(false).notNull(),
    suspendedAt: timestamp('suspended_at'),
    isSilenced: boolean('is_silenced').default(false).notNull(),
    lastSeenAt: timestamp('last_seen_at'),
    // Federation health tracking
    deliveryFailureCount: integer('delivery_failure_count').notNull().default(0),
    lastDeliveryAt: timestamp('last_delivery_at'),
    lastDeliverySuccess: boolean('last_delivery_success'),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().notNull(),
  },
  (t) => [uniqueIndex('instances_domain_idx').on(t.domain)],
)

// ─── Actors ───────────────────────────────────────────────────────────────────
// Hem local hem remote kullanıcılar (AP birleşik model).
// Local actor'lar user.id'ye bağlıdır, remote actor'larda userId null'dır.

export const actors = pgTable(
  'actors',
  {
    id: uuid('id').primaryKey().defaultRandom(),

    // Better Auth user bağlantısı (sadece local actor'larda dolu)
    userId: text('user_id').references(() => user.id, { onDelete: 'cascade' }),

    // ActivityPub canonical identity
    apId: varchar('ap_id', { length: 2048 }).notNull(),
    handle: varchar('handle', { length: 255 }).notNull(),
    displayName: varchar('display_name', { length: 255 }),
    bio: text('bio'),
    avatarUrl: varchar('avatar_url', { length: 2048 }),
    headerUrl: varchar('header_url', { length: 2048 }),

    // ActivityPub endpoints
    inboxUrl: varchar('inbox_url', { length: 2048 }).notNull(),
    outboxUrl: varchar('outbox_url', { length: 2048 }).notNull(),
    followersUrl: varchar('followers_url', { length: 2048 }).notNull(),
    followingUrl: varchar('following_url', { length: 2048 }).notNull(),
    sharedInboxUrl: varchar('shared_inbox_url', { length: 2048 }),
    profileUrl: varchar('profile_url', { length: 2048 }),

    // RSA key pair (HTTP Signatures için)
    publicKey: text('public_key').notNull(),
    privateKeyEncrypted: text('private_key_encrypted'), // AES-256 ile şifreli, sadece local
    dmPublicKey: text('dm_public_key'),

    // Ed25519 key pair for FEP-8b32 Object Integrity Proofs
    ed25519PublicKey: text('ed25519_public_key'),
    ed25519PrivateKeyEncrypted: text('ed25519_private_key_encrypted'),

    // Nostr identity (NIP-05 bridge)
    nostrPublicKey: varchar('nostr_public_key', { length: 64 }),  // hex secp256k1 pubkey
    nostrPrivateKeyEncrypted: text('nostr_private_key_encrypted'), // encrypted hex seckey

    // Flags
    isLocal: boolean('is_local').default(false).notNull(),
    isBot: boolean('is_bot').default(false).notNull(),
    actorType: varchar('actor_type', { length: 20 }).notNull().default('Person'), // Person | Group | Service | Application
    isLocked: boolean('is_locked').default(false).notNull(),
    isSuspended: boolean('is_suspended').default(false).notNull(),
    noIndex: boolean('no_index').default(false).notNull(),
    role: actorRoleEnum('role').default('user').notNull(),

    instanceId: uuid('instance_id').references(() => instances.id),

    // Denormalize sayaçlar
    followersCount: integer('followers_count').default(0).notNull(),
    followingCount: integer('following_count').default(0).notNull(),
    postsCount: integer('posts_count').default(0).notNull(),
    profileViewCount: integer('profile_view_count').default(0).notNull(),

    movedToUri: varchar('moved_to_uri', { length: 2048 }),
    alsoKnownAs: text('also_known_as').array(),
    // FEP-c7d3: actor profile fields / verified links (PropertyValue attachments)
    profileFields: jsonb('profile_fields').$type<Array<{
      name: string
      value: string
      verifiedAt: string | null
    }>>(),
    website: varchar('website', { length: 2048 }),
    blueskyHandle: varchar('bluesky_handle', { length: 255 }),
    customHandle: varchar('custom_handle', { length: 253 }),
    customHandleVerifiedAt: timestamp('custom_handle_verified_at'),
    lastFetchedAt: timestamp('last_fetched_at'),
    pinnedPostId: uuid('pinned_post_id').references((): AnyPgColumn => posts.id, { onDelete: 'set null' }),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().notNull(),
  },
  (t) => [
    uniqueIndex('actors_ap_id_idx').on(t.apId),
    uniqueIndex('actors_user_id_idx').on(t.userId),
    index('actors_handle_idx').on(t.handle),
    index('actors_instance_idx').on(t.instanceId),
    index('actors_is_local_idx').on(t.isLocal),
  ],
)

// ─── Flows ────────────────────────────────────────────────────────────────────

export const flows = pgTable(
  'flows',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    slug: varchar('slug', { length: 100 }).notNull(),
    name: varchar('name', { length: 255 }).notNull(),
    description: text('description'),
    isPublic: boolean('is_public').default(true).notNull(),
    ownerId: uuid('owner_id')
      .notNull()
      .references(() => actors.id, { onDelete: 'cascade' }),
    membersCount: integer('members_count').default(0).notNull(),
    postsCount: integer('posts_count').default(0).notNull(),
    createdAt: timestamp('created_at').defaultNow().notNull(),
  },
  (t) => [
    uniqueIndex('flows_slug_idx').on(t.slug),
    index('flows_owner_idx').on(t.ownerId),
    index('flows_public_idx').on(t.isPublic),
  ],
)

export const flowMemberships = pgTable(
  'flow_memberships',
  {
    flowId: uuid('flow_id')
      .notNull()
      .references(() => flows.id, { onDelete: 'cascade' }),
    actorId: uuid('actor_id')
      .notNull()
      .references(() => actors.id, { onDelete: 'cascade' }),
    role: varchar('role', { length: 20 }).default('member').notNull(),
    createdAt: timestamp('created_at').defaultNow().notNull(),
  },
  (t) => [
    uniqueIndex('flow_memberships_pair_idx').on(t.flowId, t.actorId),
    index('flow_memberships_actor_idx').on(t.actorId),
  ],
)

export const flowSubscriptions = pgTable(
  'flow_subscriptions',
  {
    flowId: uuid('flow_id').notNull().references(() => flows.id, { onDelete: 'cascade' }),
    actorId: uuid('actor_id').notNull().references(() => actors.id, { onDelete: 'cascade' }),
    createdAt: timestamp('created_at').defaultNow().notNull(),
  },
  (t) => [
    uniqueIndex('flow_subscriptions_pair_idx').on(t.flowId, t.actorId),
    index('flow_subscriptions_actor_idx').on(t.actorId),
  ],
)

export const flowPinnedPosts = pgTable(
  'flow_pinned_posts',
  {
    flowId: uuid('flow_id').notNull().references(() => flows.id, { onDelete: 'cascade' }),
    postId: uuid('post_id').notNull().references(() => posts.id, { onDelete: 'cascade' }),
    pinnedBy: uuid('pinned_by').notNull().references(() => actors.id, { onDelete: 'cascade' }),
    pinnedAt: timestamp('pinned_at').defaultNow().notNull(),
  },
  (t) => [
    uniqueIndex('flow_pinned_posts_pair_idx').on(t.flowId, t.postId),
  ],
)

export const flowInvites = pgTable(
  'flow_invites',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    flowId: uuid('flow_id').notNull().references(() => flows.id, { onDelete: 'cascade' }),
    code: varchar('code', { length: 16 }).notNull(),
    createdBy: uuid('created_by').notNull().references(() => actors.id, { onDelete: 'cascade' }),
    maxUses: integer('max_uses').default(100).notNull(),
    usedCount: integer('used_count').default(0).notNull(),
    expiresAt: timestamp('expires_at'),
    createdAt: timestamp('created_at').defaultNow().notNull(),
  },
  (t) => [
    uniqueIndex('flow_invites_code_idx').on(t.code),
    index('flow_invites_flow_idx').on(t.flowId),
  ],
)

// ─── Reports ─────────────────────────────────────────────────────────────────

export const reportReasonEnum = pgEnum('report_reason', [
  'spam',
  'harassment',
  'hate_speech',
  'misinformation',
  'nsfw',
  'violence',
  'other',
])

export const reportStatusEnum = pgEnum('report_status', [
  'pending',
  'reviewed_accepted',
  'reviewed_rejected',
])

export const reports = pgTable(
  'reports',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    reporterId: uuid('reporter_id').notNull().references(() => actors.id, { onDelete: 'cascade' }),
    postId: uuid('post_id').references((): AnyPgColumn => posts.id, { onDelete: 'cascade' }),
    reportedActorId: uuid('reported_actor_id').references(() => actors.id, { onDelete: 'cascade' }),
    reason: reportReasonEnum('reason').notNull(),
    details: text('details'),
    status: reportStatusEnum('status').default('pending').notNull(),
    reviewedBy: uuid('reviewed_by').references(() => actors.id, { onDelete: 'set null' }),
    reviewedAt: timestamp('reviewed_at'),
    reviewNote: text('review_note'),
    createdAt: timestamp('created_at').defaultNow().notNull(),
  },
  (t) => [
    index('reports_status_idx').on(t.status),
    index('reports_post_idx').on(t.postId),
    index('reports_reporter_idx').on(t.reporterId),
  ],
)

// ─── Admin Audit Logs ─────────────────────────────────────────────────────────

export const adminAuditLogs = pgTable(
  'admin_audit_logs',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    actorId: uuid('actor_id').notNull().references(() => actors.id),
    action: varchar('action', { length: 100 }).notNull(),
    targetType: varchar('target_type', { length: 50 }),
    targetId: varchar('target_id', { length: 255 }),
    details: jsonb('details'),
    createdAt: timestamp('created_at').defaultNow().notNull(),
  },
  (t) => [index('admin_audit_logs_actor_idx').on(t.actorId), index('admin_audit_logs_created_at_idx').on(t.createdAt)],
)

// ─── Follow Events (takip/bırakma geçmişi) ───────────────────────────────────

export const followEvents = pgTable(
  'follow_events',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    actorId: uuid('actor_id').notNull().references(() => actors.id, { onDelete: 'cascade' }),
    targetId: uuid('target_id').notNull().references(() => actors.id, { onDelete: 'cascade' }),
    type: varchar('type', { length: 10 }).notNull(), // 'follow' | 'unfollow'
    createdAt: timestamp('created_at').defaultNow().notNull(),
  },
  (t) => [
    index('follow_events_actor_idx').on(t.actorId),
    index('follow_events_target_idx').on(t.targetId),
    index('follow_events_created_at_idx').on(t.createdAt),
  ],
)

// ─── Group Conversations ──────────────────────────────────────────────────────

export const conversations = pgTable(
  'conversations',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    name: varchar('name', { length: 100 }),
    avatarUrl: text('avatar_url'),
    createdById: uuid('created_by_id').references(() => actors.id, { onDelete: 'set null' }),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().notNull(),
  },
  (t) => [index('conversations_created_at_idx').on(t.createdAt)],
)

export const conversationMembers = pgTable(
  'conversation_members',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    conversationId: uuid('conversation_id').notNull().references(() => conversations.id, { onDelete: 'cascade' }),
    actorId: uuid('actor_id').notNull().references(() => actors.id, { onDelete: 'cascade' }),
    joinedAt: timestamp('joined_at').defaultNow().notNull(),
    isRequest: boolean('is_request').default(false).notNull(),
  },
  (t) => [
    uniqueIndex('conv_members_unique').on(t.conversationId, t.actorId),
    index('conv_members_conv_idx').on(t.conversationId),
    index('conv_members_actor_idx').on(t.actorId),
  ],
)

// ─── Posts ────────────────────────────────────────────────────────────────────

export const posts = pgTable(
  'posts',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    apId: varchar('ap_id', { length: 2048 }).notNull(),
    apUrl: varchar('ap_url', { length: 2048 }),

    authorId: uuid('author_id')
      .notNull()
      .references(() => actors.id, { onDelete: 'cascade' }),

    content: text('content').notNull(),
    encryptedContent: text('encrypted_content'),
    encryptionIv: varchar('encryption_iv', { length: 64 }),
    // E2E sealed box: sender's ephemeral X25519 public key (base64url, 32 bytes)
    ephemeralPublicKey: varchar('ephemeral_public_key', { length: 64 }),
    contentWarning: varchar('content_warning', { length: 500 }),
    visibility: visibilityEnum('visibility').default('public').notNull(),
    language: varchar('language', { length: 10 }),
    sensitive: boolean('sensitive').default(false).notNull(),

    replyToId: uuid('reply_to_id').references((): AnyPgColumn => posts.id, { onDelete: 'set null' }),
    rootId: uuid('root_id').references((): AnyPgColumn => posts.id, { onDelete: 'set null' }),
    apInReplyTo: varchar('ap_in_reply_to', { length: 2048 }),

    quotedPostId: uuid('quoted_post_id').references((): AnyPgColumn => posts.id, { onDelete: 'set null' }),

    likesCount: integer('likes_count').default(0).notNull(),
    boostsCount: integer('boosts_count').default(0).notNull(),
    repliesCount: integer('replies_count').default(0).notNull(),
    quotesCount: integer('quotes_count').default(0).notNull(),
    viewCount: integer('view_count').default(0).notNull(),

    isLocal: boolean('is_local').default(true).notNull(),
    isDeleted: boolean('is_deleted').default(false).notNull(),
    deletedAt: timestamp('deleted_at'),

    // Moments — ephemeral posts
    isEphemeral: boolean('is_ephemeral').default(false).notNull(),
    expiresAt: timestamp('expires_at'),

    // Flows — topic channel
    flowId: uuid('flow_id').references((): AnyPgColumn => flows.id, { onDelete: 'set null' }),

    tags: text('tags').array().default([]).notNull(),

    // Direct messages — recipient actor (1-1 DMs)
    recipientId: uuid('recipient_id').references(() => actors.id, { onDelete: 'set null' }),

    // Group conversations
    conversationId: uuid('conversation_id').references(() => conversations.id, { onDelete: 'set null' }),

    linkPreview: jsonb('link_preview').$type<{
      url: string
      title: string | null
      description: string | null
      image: string | null
      siteName: string | null
      musicPlatform?: string
      musicType?: string
      musicEmbedUrl?: string
      musicArtist?: string
      musicTrack?: string
    }>(),

    // SHA-256 of canonical content for integrity verification
    contentHash: varchar('content_hash', { length: 64 }),

    createdAt: timestamp('created_at').defaultNow().notNull(),
    editedAt: timestamp('edited_at'),
    scheduledAt: timestamp('scheduled_at'),
    isDraft: boolean('is_draft').default(false).notNull(),
  },
  (t) => [
    uniqueIndex('posts_ap_id_idx').on(t.apId),
    index('posts_author_idx').on(t.authorId),
    index('posts_reply_to_idx').on(t.replyToId),
    index('posts_root_idx').on(t.rootId),
    index('posts_quoted_post_idx').on(t.quotedPostId),
    index('posts_created_at_idx').on(t.createdAt),
    index('posts_visibility_idx').on(t.visibility),
    index('posts_expires_at_idx').on(t.expiresAt),
    index('posts_recipient_idx').on(t.recipientId),
    index('posts_conversation_idx').on(t.conversationId),
    index('posts_flow_idx').on(t.flowId),
    index('posts_scheduled_at_idx').on(t.scheduledAt),
  ],
)

// ─── Media Attachments ────────────────────────────────────────────────────────

export const mediaAttachments = pgTable(
  'media_attachments',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    postId: uuid('post_id').references(() => posts.id, { onDelete: 'cascade' }),
    actorId: uuid('actor_id').references(() => actors.id, { onDelete: 'cascade' }),
    url: varchar('url', { length: 2048 }).notNull(),
    previewUrl: varchar('preview_url', { length: 2048 }),
    remoteUrl: varchar('remote_url', { length: 2048 }),
    mimeType: varchar('mime_type', { length: 100 }).notNull(),
    altText: varchar('alt_text', { length: 1500 }),
    width: integer('width'),
    height: integer('height'),
    blurhash: varchar('blurhash', { length: 100 }),
    fileSize: integer('file_size'),
    createdAt: timestamp('created_at').defaultNow().notNull(),
  },
  (t) => [
    index('media_post_idx').on(t.postId),
    index('media_actor_idx').on(t.actorId),
  ],
)

// ─── Follows ──────────────────────────────────────────────────────────────────

export const follows = pgTable(
  'follows',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    apId: varchar('ap_id', { length: 2048 }),
    followerId: uuid('follower_id')
      .notNull()
      .references(() => actors.id, { onDelete: 'cascade' }),
    followingId: uuid('following_id')
      .notNull()
      .references(() => actors.id, { onDelete: 'cascade' }),
    status: followStatusEnum('status').default('accepted').notNull(),
    notifyOnActivity: boolean('notify_on_activity').default(true).notNull(),
    createdAt: timestamp('created_at').defaultNow().notNull(),
  },
  (t) => [
    uniqueIndex('follows_pair_idx').on(t.followerId, t.followingId),
    index('follows_follower_idx').on(t.followerId),
    index('follows_following_idx').on(t.followingId),
    index('follows_status_idx').on(t.status),
  ],
)

// ─── Close Friends ────────────────────────────────────────────────────────────

export const closeFriends = pgTable(
  'close_friends',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    actorId: uuid('actor_id')
      .notNull()
      .references(() => actors.id, { onDelete: 'cascade' }),
    targetId: uuid('target_id')
      .notNull()
      .references(() => actors.id, { onDelete: 'cascade' }),
    createdAt: timestamp('created_at').defaultNow().notNull(),
  },
  (t) => [
    uniqueIndex('close_friends_pair_idx').on(t.actorId, t.targetId),
    index('close_friends_actor_idx').on(t.actorId),
    index('close_friends_target_idx').on(t.targetId),
  ],
)

// ─── Likes ────────────────────────────────────────────────────────────────────

export const likes = pgTable(
  'likes',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    apId: varchar('ap_id', { length: 2048 }),
    actorId: uuid('actor_id')
      .notNull()
      .references(() => actors.id, { onDelete: 'cascade' }),
    postId: uuid('post_id')
      .notNull()
      .references(() => posts.id, { onDelete: 'cascade' }),
    createdAt: timestamp('created_at').defaultNow().notNull(),
  },
  (t) => [
    uniqueIndex('likes_pair_idx').on(t.actorId, t.postId),
    index('likes_post_idx').on(t.postId),
    index('likes_actor_idx').on(t.actorId),
  ],
)

// ─── Boosts ───────────────────────────────────────────────────────────────────

export const boosts = pgTable(
  'boosts',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    apId: varchar('ap_id', { length: 2048 }),
    actorId: uuid('actor_id')
      .notNull()
      .references(() => actors.id, { onDelete: 'cascade' }),
    postId: uuid('post_id')
      .notNull()
      .references(() => posts.id, { onDelete: 'cascade' }),
    createdAt: timestamp('created_at').defaultNow().notNull(),
  },
  (t) => [
    uniqueIndex('boosts_pair_idx').on(t.actorId, t.postId),
    index('boosts_post_idx').on(t.postId),
  ],
)

// ─── Bookmark Collections ─────────────────────────────────────────────────────

export const bookmarkCollections = pgTable(
  'bookmark_collections',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    actorId: uuid('actor_id')
      .notNull()
      .references(() => actors.id, { onDelete: 'cascade' }),
    name: text('name').notNull(),
    createdAt: timestamp('created_at').defaultNow().notNull(),
  },
  (t) => [
    index('bookmark_collections_actor_idx').on(t.actorId),
  ],
)

// ─── Bookmarks ────────────────────────────────────────────────────────────────

export const bookmarks = pgTable(
  'bookmarks',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    actorId: uuid('actor_id')
      .notNull()
      .references(() => actors.id, { onDelete: 'cascade' }),
    postId: uuid('post_id')
      .notNull()
      .references(() => posts.id, { onDelete: 'cascade' }),
    collectionId: uuid('collection_id').references((): AnyPgColumn => bookmarkCollections.id, { onDelete: 'set null' }),
    createdAt: timestamp('created_at').defaultNow().notNull(),
  },
  (t) => [
    uniqueIndex('bookmarks_pair_idx').on(t.actorId, t.postId),
    index('bookmarks_actor_idx').on(t.actorId),
    index('bookmarks_collection_idx').on(t.collectionId),
  ],
)

// ─── Reactions ────────────────────────────────────────────────────────────────

export const reactions = pgTable(
  'reactions',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    actorId: uuid('actor_id')
      .notNull()
      .references(() => actors.id, { onDelete: 'cascade' }),
    postId: uuid('post_id')
      .notNull()
      .references(() => posts.id, { onDelete: 'cascade' }),
    emoji: varchar('emoji', { length: 16 }).notNull(),
    createdAt: timestamp('created_at').defaultNow().notNull(),
  },
  (t) => [
    uniqueIndex('reactions_triple_idx').on(t.actorId, t.postId, t.emoji),
    index('reactions_post_idx').on(t.postId),
    index('reactions_actor_idx').on(t.actorId),
  ],
)

// ─── Notifications ────────────────────────────────────────────────────────────

export const notifications = pgTable(
  'notifications',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    recipientId: uuid('recipient_id')
      .notNull()
      .references(() => actors.id, { onDelete: 'cascade' }),
    actorId: uuid('actor_id')
      .notNull()
      .references(() => actors.id, { onDelete: 'cascade' }),
    postId: uuid('post_id').references(() => posts.id, { onDelete: 'cascade' }),
    type: notificationTypeEnum('type').notNull(),
    read: boolean('read').default(false).notNull(),
    createdAt: timestamp('created_at').defaultNow().notNull(),
  },
  (t) => [
    index('notifications_recipient_idx').on(t.recipientId),
    index('notifications_unread_idx').on(t.recipientId, t.read),
    index('notifications_created_at_idx').on(t.createdAt),
  ],
)

// ─── Blocks & Mutes ───────────────────────────────────────────────────────────

export const blocks = pgTable(
  'blocks',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    blockerId: uuid('blocker_id')
      .notNull()
      .references(() => actors.id, { onDelete: 'cascade' }),
    blockedId: uuid('blocked_id')
      .notNull()
      .references(() => actors.id, { onDelete: 'cascade' }),
    createdAt: timestamp('created_at').defaultNow().notNull(),
  },
  (t) => [uniqueIndex('blocks_pair_idx').on(t.blockerId, t.blockedId)],
)

export const mutes = pgTable(
  'mutes',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    muterId: uuid('muter_id')
      .notNull()
      .references(() => actors.id, { onDelete: 'cascade' }),
    mutedId: uuid('muted_id')
      .notNull()
      .references(() => actors.id, { onDelete: 'cascade' }),
    hideNotifications: boolean('hide_notifications').default(true).notNull(),
    expiresAt: timestamp('expires_at'),
    createdAt: timestamp('created_at').defaultNow().notNull(),
  },
  (t) => [uniqueIndex('mutes_pair_idx').on(t.muterId, t.mutedId)],
)

// ─── Hashtag Follows ──────────────────────────────────────────────────────────

export const hashtagFollows = pgTable(
  'hashtag_follows',
  {
    actorId: uuid('actor_id')
      .notNull()
      .references(() => actors.id, { onDelete: 'cascade' }),
    hashtag: varchar('hashtag', { length: 100 }).notNull(),
    createdAt: timestamp('created_at').defaultNow().notNull(),
  },
  (t) => [
    primaryKey({ columns: [t.actorId, t.hashtag] }),
    index('hashtag_follows_actor_idx').on(t.actorId),
    index('hashtag_follows_hashtag_idx').on(t.hashtag),
  ],
)

// ─── Keyword Filters ──────────────────────────────────────────────────────────

export const keywordFilters = pgTable(
  'keyword_filters',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    actorId: uuid('actor_id')
      .notNull()
      .references(() => actors.id, { onDelete: 'cascade' }),
    keyword: varchar('keyword', { length: 200 }).notNull(),
    wholeWord: boolean('whole_word').default(false).notNull(),
    contexts: varchar('contexts', { length: 500 }).default('home').notNull(),
    action: varchar('action', { length: 20 }).default('warn').notNull(),
    expiresAt: timestamp('expires_at'),
    createdAt: timestamp('created_at').defaultNow().notNull(),
  },
  (t) => [index('keyword_filters_actor_idx').on(t.actorId)],
)

// ─── Lists ────────────────────────────────────────────────────────────────────

export const lists = pgTable(
  'lists',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    ownerId: uuid('owner_id')
      .notNull()
      .references(() => actors.id, { onDelete: 'cascade' }),
    title: varchar('title', { length: 255 }).notNull(),
    repliesPolicy: varchar('replies_policy', { length: 50 }).default('list').notNull(),
    createdAt: timestamp('created_at').defaultNow().notNull(),
  },
  (t) => [index('lists_owner_idx').on(t.ownerId)],
)

export const listMembers = pgTable(
  'list_members',
  {
    listId: uuid('list_id')
      .notNull()
      .references(() => lists.id, { onDelete: 'cascade' }),
    actorId: uuid('actor_id')
      .notNull()
      .references(() => actors.id, { onDelete: 'cascade' }),
  },
  (t) => [uniqueIndex('list_members_pair_idx').on(t.listId, t.actorId)],
)

// ─── AP Activity Log ──────────────────────────────────────────────────────────

export const apActivities = pgTable(
  'ap_activities',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    apId: varchar('ap_id', { length: 2048 }).notNull(),
    type: varchar('type', { length: 50 }).notNull(),
    actorApId: varchar('actor_ap_id', { length: 2048 }).notNull(),
    objectApId: varchar('object_ap_id', { length: 2048 }),
    direction: activityDirectionEnum('direction').notNull(),
    status: activityStatusEnum('status').default('pending').notNull(),
    errorMessage: text('error_message'),
    rawJson: jsonb('raw_json').notNull(),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    processedAt: timestamp('processed_at'),
  },
  (t) => [
    uniqueIndex('ap_activities_ap_id_idx').on(t.apId),
    index('ap_activities_status_idx').on(t.status),
    index('ap_activities_type_idx').on(t.type),
    index('ap_activities_actor_idx').on(t.actorApId),
    index('ap_activities_created_at_idx').on(t.createdAt),
  ],
)

// ─── Feed Rules ───────────────────────────────────────────────────────────────

export const feedRules = pgTable(
  'feed_rules',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    actorId: uuid('actor_id')
      .notNull()
      .references(() => actors.id, { onDelete: 'cascade' }),
    name: varchar('name', { length: 255 }).notNull(),
    isDefault: boolean('is_default').default(false).notNull(),
    rules: jsonb('rules').notNull().default('{}'),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().notNull(),
  },
  (t) => [index('feed_rules_actor_idx').on(t.actorId)],
)

// ─── Spaces ───────────────────────────────────────────────────────────────────

export const spaces = pgTable(
  'spaces',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    slug: varchar('slug', { length: 100 }).notNull(),
    hostId: uuid('host_id')
      .notNull()
      .references(() => actors.id, { onDelete: 'cascade' }),
    title: varchar('title', { length: 255 }).notNull(),
    description: text('description'),
    isLive: boolean('is_live').default(true).notNull(),
    participantsCount: integer('participants_count').default(0).notNull(),
    messagesCount: integer('messages_count').default(0).notNull(),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    endedAt: timestamp('ended_at'),
  },
  (t) => [
    uniqueIndex('spaces_slug_idx').on(t.slug),
    index('spaces_host_idx').on(t.hostId),
    index('spaces_live_idx').on(t.isLive),
  ],
)

export const spaceMessages = pgTable(
  'space_messages',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    spaceId: uuid('space_id')
      .notNull()
      .references(() => spaces.id, { onDelete: 'cascade' }),
    authorId: uuid('author_id')
      .notNull()
      .references(() => actors.id, { onDelete: 'cascade' }),
    content: text('content').notNull(),
    createdAt: timestamp('created_at').defaultNow().notNull(),
  },
  (t) => [
    index('space_messages_space_idx').on(t.spaceId),
    index('space_messages_created_idx').on(t.spaceId, t.createdAt),
  ],
)

// ─── Invite Codes ─────────────────────────────────────────────────────────────

export const inviteCodes = pgTable(
  'invite_codes',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    code: varchar('code', { length: 32 }).notNull(),
    createdById: text('created_by_id').references(() => user.id, { onDelete: 'set null' }),
    usedById: text('used_by_id').references(() => user.id, { onDelete: 'set null' }),
    maxUses: integer('max_uses').default(1).notNull(),
    useCount: integer('use_count').default(0).notNull(),
    expiresAt: timestamp('expires_at'),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    usedAt: timestamp('used_at'),
  },
  (t) => [
    uniqueIndex('invite_codes_code_idx').on(t.code),
    index('invite_codes_created_by_idx').on(t.createdById),
  ],
)

// ─── Post Edit History ────────────────────────────────────────────────────────

export const postEdits = pgTable(
  'post_edits',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    postId: uuid('post_id')
      .notNull()
      .references(() => posts.id, { onDelete: 'cascade' }),
    content: text('content').notNull(),
    contentWarning: varchar('content_warning', { length: 500 }),
    editedAt: timestamp('edited_at').defaultNow().notNull(),
  },
  (t) => [index('post_edits_post_idx').on(t.postId)],
)

// ─── Polls ───────────────────────────────────────────────────────────────────

export const polls = pgTable(
  'polls',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    postId: uuid('post_id')
      .notNull()
      .unique()
      .references(() => posts.id, { onDelete: 'cascade' }),
    multipleChoice: boolean('multiple_choice').default(false).notNull(),
    votersCount: integer('voters_count').default(0).notNull(),
    expiresAt: timestamp('expires_at').notNull(),
    createdAt: timestamp('created_at').defaultNow().notNull(),
  },
  (t) => [index('polls_post_idx').on(t.postId)],
)

export const pollOptions = pgTable(
  'poll_options',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    pollId: uuid('poll_id')
      .notNull()
      .references(() => polls.id, { onDelete: 'cascade' }),
    text: varchar('text', { length: 100 }).notNull(),
    votesCount: integer('votes_count').default(0).notNull(),
    position: integer('position').default(0).notNull(),
  },
  (t) => [index('poll_options_poll_idx').on(t.pollId)],
)

export const pollVotes = pgTable(
  'poll_votes',
  {
    pollId: uuid('poll_id')
      .notNull()
      .references(() => polls.id, { onDelete: 'cascade' }),
    optionId: uuid('option_id')
      .notNull()
      .references(() => pollOptions.id, { onDelete: 'cascade' }),
    actorId: uuid('actor_id')
      .notNull()
      .references(() => actors.id, { onDelete: 'cascade' }),
    createdAt: timestamp('created_at').defaultNow().notNull(),
  },
  (t) => [
    uniqueIndex('poll_votes_option_actor_idx').on(t.optionId, t.actorId),
    index('poll_votes_poll_idx').on(t.pollId),
    index('poll_votes_actor_idx').on(t.actorId),
  ],
)

// ─── Relations ────────────────────────────────────────────────────────────────

export const userRelations = relations(user, ({ one }) => ({
  actor: one(actors, { fields: [user.id], references: [actors.userId] }),
}))

// ─── Actor Preferences ───────────────────────────────────────────────────────
// Only set for local actors. Remote actors keep all defaults.

export const actorPreferences = pgTable('actor_preferences', {
  actorId: uuid('actor_id').primaryKey().references(() => actors.id, { onDelete: 'cascade' }),

  // Privacy & Communication
  dmEnabled:        boolean('dm_enabled').default(true).notNull(),
  allowReplyFrom:   varchar('allow_reply_from', { length: 20 }).default('everyone').notNull(), // 'everyone' | 'followers' | 'nobody'
  hideLikesCount:   boolean('hide_likes_count').default(false).notNull(),
  hideReadReceipts: boolean('hide_read_receipts').default(false).notNull(),
  defaultVisibility:varchar('default_visibility', { length: 20 }).default('public').notNull(), // 'public' | 'followers' | 'unlisted'

  // Content & Feed Filters
  filterBots:          boolean('filter_bots').default(false).notNull(),
  hideBoosts:          boolean('hide_boosts').default(false).notNull(),
  minAccountAgeFilter: integer('min_account_age_filter').default(0).notNull(), // days, 0 = off
  nsfwMode:            varchar('nsfw_mode', { length: 20 }).default('blur').notNull(), // 'hide' | 'blur' | 'show'
  preferredLanguages:  varchar('preferred_languages', { length: 10 }).array().default([]).notNull(),

  // Experience & Time
  hideShortVideos: boolean('hide_short_videos').default(false).notNull(),
  usageTimeLimit:  integer('usage_time_limit').default(0).notNull(), // minutes, 0 = off

  updatedAt: timestamp('updated_at').defaultNow().notNull(),
})

export const actorPreferencesRelations = relations(actorPreferences, ({ one }) => ({
  actor: one(actors, { fields: [actorPreferences.actorId], references: [actors.id] }),
}))

export const actorsRelations = relations(actors, ({ one, many }) => ({
  user: one(user, { fields: [actors.userId], references: [user.id] }),
  instance: one(instances, { fields: [actors.instanceId], references: [instances.id] }),
  preferences: one(actorPreferences, { fields: [actors.id], references: [actorPreferences.actorId] }),
  posts: many(posts),
  following: many(follows, { relationName: 'follower' }),
  followers: many(follows, { relationName: 'following' }),
  likes: many(likes),
  boosts: many(boosts),
  bookmarks: many(bookmarks),
  bookmarkCollections: many(bookmarkCollections),
  pushSubscriptions: many(pushSubscriptions),
  closeFriendsAdded: many(closeFriends, { relationName: 'actor' }),
  closeFriendsOf: many(closeFriends, { relationName: 'target' }),
  sentNotifications: many(notifications, { relationName: 'actor' }),
  receivedNotifications: many(notifications, { relationName: 'recipient' }),
  lists: many(lists),
  feedRules: many(feedRules),
  ownedFlows: many(flows),
  flowMemberships: many(flowMemberships),
  auditLogs: many(adminAuditLogs),
}))

export const followEventsRelations = relations(followEvents, ({ one }) => ({
  actor: one(actors, { fields: [followEvents.actorId], references: [actors.id] }),
  target: one(actors, { fields: [followEvents.targetId], references: [actors.id] }),
}))

export const conversationsRelations = relations(conversations, ({ one, many }) => ({
  createdBy: one(actors, { fields: [conversations.createdById], references: [actors.id] }),
  members: many(conversationMembers),
  messages: many(posts),
}))

export const conversationMembersRelations = relations(conversationMembers, ({ one }) => ({
  conversation: one(conversations, { fields: [conversationMembers.conversationId], references: [conversations.id] }),
  actor: one(actors, { fields: [conversationMembers.actorId], references: [actors.id] }),
}))

export const postsRelations = relations(posts, ({ one, many }) => ({
  author: one(actors, { fields: [posts.authorId], references: [actors.id] }),
  replyTo: one(posts, {
    fields: [posts.replyToId],
    references: [posts.id],
    relationName: 'replies',
  }),
  replies: many(posts, { relationName: 'replies' }),
  quotedPost: one(posts, {
    fields: [posts.quotedPostId],
    references: [posts.id],
    relationName: 'quotes',
  }),
  quotes: many(posts, { relationName: 'quotes' }),
  media: many(mediaAttachments),
  likes: many(likes),
  boosts: many(boosts),
  bookmarks: many(bookmarks),
  reactions: many(reactions),
  edits: many(postEdits),
  notifications: many(notifications),
  flow: one(flows, { fields: [posts.flowId], references: [flows.id] }),
  conversation: one(conversations, { fields: [posts.conversationId], references: [conversations.id] }),
}))

export const flowsRelations = relations(flows, ({ one, many }) => ({
  owner: one(actors, { fields: [flows.ownerId], references: [actors.id] }),
  memberships: many(flowMemberships),
  posts: many(posts),
  subscriptions: many(flowSubscriptions),
  pinnedPosts: many(flowPinnedPosts),
  invites: many(flowInvites),
}))

export const flowMembershipsRelations = relations(flowMemberships, ({ one }) => ({
  flow: one(flows, { fields: [flowMemberships.flowId], references: [flows.id] }),
  actor: one(actors, { fields: [flowMemberships.actorId], references: [actors.id] }),
}))

export const flowSubscriptionsRelations = relations(flowSubscriptions, ({ one }) => ({
  flow: one(flows, { fields: [flowSubscriptions.flowId], references: [flows.id] }),
  actor: one(actors, { fields: [flowSubscriptions.actorId], references: [actors.id] }),
}))

export const flowPinnedPostsRelations = relations(flowPinnedPosts, ({ one }) => ({
  flow: one(flows, { fields: [flowPinnedPosts.flowId], references: [flows.id] }),
  post: one(posts, { fields: [flowPinnedPosts.postId], references: [posts.id] }),
  pinnedByActor: one(actors, { fields: [flowPinnedPosts.pinnedBy], references: [actors.id] }),
}))

export const flowInvitesRelations = relations(flowInvites, ({ one }) => ({
  flow: one(flows, { fields: [flowInvites.flowId], references: [flows.id] }),
  creator: one(actors, { fields: [flowInvites.createdBy], references: [actors.id] }),
}))

export const spacesRelations = relations(spaces, ({ one, many }) => ({
  host: one(actors, { fields: [spaces.hostId], references: [actors.id] }),
  messages: many(spaceMessages),
}))

export const spaceMessagesRelations = relations(spaceMessages, ({ one }) => ({
  space: one(spaces, { fields: [spaceMessages.spaceId], references: [spaces.id] }),
  author: one(actors, { fields: [spaceMessages.authorId], references: [actors.id] }),
}))


export const followsRelations = relations(follows, ({ one }) => ({
  follower: one(actors, {
    fields: [follows.followerId],
    references: [actors.id],
    relationName: 'follower',
  }),
  following: one(actors, {
    fields: [follows.followingId],
    references: [actors.id],
    relationName: 'following',
  }),
}))

export const notificationsRelations = relations(notifications, ({ one }) => ({
  recipient: one(actors, {
    fields: [notifications.recipientId],
    references: [actors.id],
    relationName: 'recipient',
  }),
  actor: one(actors, {
    fields: [notifications.actorId],
    references: [actors.id],
    relationName: 'actor',
  }),
  post: one(posts, { fields: [notifications.postId], references: [posts.id] }),
}))

export const pollsRelations = relations(polls, ({ one, many }) => ({
  post: one(posts, { fields: [polls.postId], references: [posts.id] }),
  options: many(pollOptions),
  votes: many(pollVotes),
}))

export const pollOptionsRelations = relations(pollOptions, ({ one, many }) => ({
  poll: one(polls, { fields: [pollOptions.pollId], references: [polls.id] }),
  votes: many(pollVotes),
}))

export const pollVotesRelations = relations(pollVotes, ({ one }) => ({
  poll: one(polls, { fields: [pollVotes.pollId], references: [polls.id] }),
  option: one(pollOptions, { fields: [pollVotes.optionId], references: [pollOptions.id] }),
  actor: one(actors, { fields: [pollVotes.actorId], references: [actors.id] }),
}))

export const postEditsRelations = relations(postEdits, ({ one }) => ({
  post: one(posts, { fields: [postEdits.postId], references: [posts.id] }),
}))

export const reactionsRelations = relations(reactions, ({ one }) => ({
  actor: one(actors, { fields: [reactions.actorId], references: [actors.id] }),
  post: one(posts, { fields: [reactions.postId], references: [posts.id] }),
}))

export const bookmarkCollectionsRelations = relations(bookmarkCollections, ({ one, many }) => ({
  actor: one(actors, { fields: [bookmarkCollections.actorId], references: [actors.id] }),
  bookmarks: many(bookmarks),
}))

// ─── Custom Emojis ────────────────────────────────────────────────────────────

export const customEmojis = pgTable(
  'custom_emojis',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    shortcode: varchar('shortcode', { length: 64 }).notNull(),
    // null = local emoji, otherwise the remote instance domain
    domain: varchar('domain', { length: 253 }),
    imageUrl: text('image_url').notNull(),
    // Remote AP id for dedup (null for local)
    apId: text('ap_id'),
    visibleInPicker: boolean('visible_in_picker').default(true).notNull(),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().notNull(),
  },
  (t) => [
    uniqueIndex('custom_emojis_shortcode_domain_idx').on(t.shortcode, t.domain),
    index('custom_emojis_domain_idx').on(t.domain),
  ],
)

// ─── Push Subscriptions ───────────────────────────────────────────────────────

export const pushSubscriptions = pgTable(
  'push_subscriptions',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    actorId: uuid('actor_id')
      .notNull()
      .references(() => actors.id, { onDelete: 'cascade' }),
    endpoint: varchar('endpoint', { length: 2048 }).notNull(),
    p256dh: varchar('p256dh', { length: 512 }).notNull(),
    auth: varchar('auth', { length: 128 }).notNull(),
    createdAt: timestamp('created_at').defaultNow().notNull(),
  },
  (t) => [
    uniqueIndex('push_subscriptions_endpoint_idx').on(t.endpoint),
    index('push_subscriptions_actor_idx').on(t.actorId),
  ],
)

export const pushSubscriptionsRelations = relations(pushSubscriptions, ({ one }) => ({
  actor: one(actors, { fields: [pushSubscriptions.actorId], references: [actors.id] }),
}))

export const closeFriendsRelations = relations(closeFriends, ({ one }) => ({
  actor: one(actors, { fields: [closeFriends.actorId], references: [actors.id], relationName: 'actor' }),
  target: one(actors, { fields: [closeFriends.targetId], references: [actors.id], relationName: 'target' }),
}))

export const reportsRelations = relations(reports, ({ one }) => ({
  reporter: one(actors, { fields: [reports.reporterId], references: [actors.id], relationName: 'reporter' }),
  post: one(posts, { fields: [reports.postId], references: [posts.id] }),
  reportedActor: one(actors, { fields: [reports.reportedActorId], references: [actors.id], relationName: 'reportedActor' }),
  reviewer: one(actors, { fields: [reports.reviewedBy], references: [actors.id], relationName: 'reviewer' }),
}))

export const adminAuditLogsRelations = relations(adminAuditLogs, ({ one }) => ({
  actor: one(actors, { fields: [adminAuditLogs.actorId], references: [actors.id] }),
}))

export const mastoTokensRelations = relations(mastoTokens, ({ one }) => ({
  app: one(mastoApps, { fields: [mastoTokens.appId], references: [mastoApps.id] }),
}))

export const mastoAuthCodesRelations = relations(mastoAuthCodes, ({ one }) => ({
  app: one(mastoApps, { fields: [mastoAuthCodes.appId], references: [mastoApps.id] }),
}))

// ── Instance Settings ─────────────────────────────────────────────────────────
export const instanceSettings = pgTable('instance_settings', {
  id: integer('id').primaryKey().default(1), // singleton row
  registrationMode: varchar('registration_mode', { length: 20 }).notNull().default('open'), // open | approval | invite_only
  maxPostLength: integer('max_post_length').notNull().default(500),
  approvalNote: text('approval_note'), // shown to users on registration
  closedReason: text('closed_reason'),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
})

// ── Instance Rules ────────────────────────────────────────────────────────────
export const instanceRules = pgTable('instance_rules', {
  id: uuid('id').primaryKey().defaultRandom(),
  text: text('text').notNull(),
  hint: text('hint'),
  position: integer('position').notNull().default(0),
  createdAt: timestamp('created_at').notNull().defaultNow(),
})

// ── Pending Registrations (approval mode) ─────────────────────────────────────
export const pendingRegistrations = pgTable('pending_registrations', {
  id: uuid('id').primaryKey().defaultRandom(),
  email: varchar('email', { length: 256 }).notNull().unique(),
  username: varchar('username', { length: 100 }).notNull(),
  reason: text('reason'),
  status: varchar('status', { length: 20 }).notNull().default('pending'), // pending | approved | rejected
  reviewNote: text('review_note'),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  reviewedAt: timestamp('reviewed_at'),
})

// ── ActivityPub Groups (FEP-1b12) ─────────────────────────────────────────────
export const apGroups = pgTable('ap_groups', {
  id: uuid('id').primaryKey().defaultRandom(),
  actorId: uuid('actor_id').notNull().references(() => actors.id, { onDelete: 'cascade' }),
  ownerId: uuid('owner_id').notNull().references(() => actors.id, { onDelete: 'cascade' }),
  rules: text('rules'),
  isOpen: boolean('is_open').notNull().default(true), // open = anyone can join by following
  createdAt: timestamp('created_at').notNull().defaultNow(),
})

export const apGroupsRelations = relations(apGroups, ({ one }) => ({
  actor: one(actors, { fields: [apGroups.actorId], references: [actors.id], relationName: 'groupActor' }),
  owner: one(actors, { fields: [apGroups.ownerId], references: [actors.id], relationName: 'groupOwner' }),
}))

// ── Shared Block Lists (FediBlock / Oliphant) ─────────────────────────────────
export const blockLists = pgTable('block_lists', {
  id: uuid('id').primaryKey().defaultRandom(),
  name: varchar('name', { length: 200 }).notNull(),
  url: varchar('url', { length: 512 }).notNull().unique(),
  enabled: boolean('enabled').notNull().default(true),
  lastFetchedAt: timestamp('last_fetched_at'),
  entriesCount: integer('entries_count').notNull().default(0),
  createdAt: timestamp('created_at').notNull().defaultNow(),
})

export const blockListEntries = pgTable('block_list_entries', {
  id: uuid('id').primaryKey().defaultRandom(),
  listId: uuid('list_id').notNull().references(() => blockLists.id, { onDelete: 'cascade' }),
  domain: varchar('domain', { length: 256 }).notNull(),
  severity: varchar('severity', { length: 20 }).notNull().default('suspend'), // suspend | silence | noop
  comment: text('comment'),
}, (t) => [uniqueIndex('block_list_entry_idx').on(t.listId, t.domain)])

// ── Content Labels (AT Protocol labeler-style) ────────────────────────────────
export const contentLabels = pgTable('content_labels', {
  id: uuid('id').primaryKey().defaultRandom(),
  postId: uuid('post_id').references(() => posts.id, { onDelete: 'cascade' }),
  actorId: uuid('actor_id').references(() => actors.id, { onDelete: 'cascade' }),
  label: varchar('label', { length: 64 }).notNull(), // e.g. 'spam', 'nsfw', 'nudity', 'violence'
  source: varchar('source', { length: 50 }).notNull().default('system'), // system | user | labeler
  labelerUrl: varchar('labeler_url', { length: 512 }),
  confidence: integer('confidence').notNull().default(100), // 0-100
  createdAt: timestamp('created_at').notNull().defaultNow(),
})

// ── Moderation Appeals ────────────────────────────────────────────────────────
export const moderationAppeals = pgTable('moderation_appeals', {
  id: uuid('id').primaryKey().defaultRandom(),
  reportId: uuid('report_id').notNull().references(() => reports.id, { onDelete: 'cascade' }).unique(),
  appellantId: uuid('appellant_id').notNull().references(() => actors.id, { onDelete: 'cascade' }),
  reason: text('reason').notNull(),
  status: varchar('status', { length: 20 }).notNull().default('pending'), // pending | approved | rejected
  reviewedBy: uuid('reviewed_by').references(() => actors.id, { onDelete: 'set null' }),
  reviewNote: text('review_note'),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  reviewedAt: timestamp('reviewed_at'),
})

// ── Bluesky Connections ───────────────────────────────────────────────────────
export const blueskyConnections = pgTable('bluesky_connections', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: text('user_id').notNull().unique(),
  did: varchar('did', { length: 256 }).notNull(),
  handle: varchar('handle', { length: 256 }).notNull(),
  accessJwt: text('access_jwt').notNull(),
  refreshJwt: text('refresh_jwt').notNull(),
  crosspostEnabled: boolean('crosspost_enabled').notNull().default(true),
  importEnabled: boolean('import_enabled').notNull().default(false),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
})

// ── WebSub Subscriptions ──────────────────────────────────────────────────────
export const websubSubscriptions = pgTable('websub_subscriptions', {
  id: uuid('id').primaryKey().defaultRandom(),
  topic: varchar('topic', { length: 512 }).notNull(),
  callback: varchar('callback', { length: 512 }).notNull(),
  secret: varchar('secret', { length: 256 }),
  expiresAt: timestamp('expires_at'),
  status: varchar('status', { length: 20 }).notNull().default('pending'), // 'pending' | 'active' | 'expired'
  createdAt: timestamp('created_at').notNull().defaultNow(),
}, (t) => [uniqueIndex('websub_topic_callback_idx').on(t.topic, t.callback)])

// ── ActivityPub Relays ────────────────────────────────────────────────────────
export const relays = pgTable('relays', {
  id: uuid('id').primaryKey().defaultRandom(),
  inboxUrl: varchar('inbox_url', { length: 512 }).notNull().unique(),
  actorUrl: varchar('actor_url', { length: 512 }).notNull(),
  status: varchar('status', { length: 20 }).notNull().default('pending'), // 'pending' | 'accepted' | 'rejected'
  createdAt: timestamp('created_at').notNull().defaultNow(),
})
