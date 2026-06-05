const API_URL = process.env['NEXT_PUBLIC_API_URL'] ?? 'http://localhost:3001'

export interface PostTemplateField {
  key: string
  label: string
  type: 'text' | 'textarea' | 'select'
  options?: string[]
  required?: boolean
  placeholder?: string
}

export interface PostTemplate {
  id: string
  name: string
  icon: string
  fields: PostTemplateField[]
}

export interface Actor {
  id: string
  handle: string
  displayName: string | null
  bio: string | null
  avatarUrl: string | null
  headerUrl: string | null
  followersCount: number
  followingCount: number
  postsCount: number
  likesCount: number
  isLocal: boolean
  isLocked: boolean
  profileUrl?: string | null
  location: string | null
  website: string | null
  profileFields?: Array<{ name: string; value: string; verifiedAt: string | null }> | null
  blueskyHandle: string | null
  customHandle: string | null
  customHandleVerifiedAt: string | null
  movedToUri: string | null
  pinnedPostId: string | null
  createdAt: string
  dmPublicKey?: string | null
  role?: 'user' | 'moderator' | 'admin'
  viewer?: { following: boolean; followStatus?: 'pending' | 'accepted'; notifyOnActivity?: boolean; isBlocked?: boolean; isMuted?: boolean }
}

export interface MediaAttachment {
  id: string
  url: string
  previewUrl: string | null
  mimeType: string
  altText: string | null
  width: number | null
  height: number | null
  blurhash: string | null
  duration?: number | null
}

export interface QuotedPost {
  id: string
  content: string
  createdAt: string
  author: { id: string; handle: string; displayName: string | null; avatarUrl: string | null } | null
  media: MediaAttachment[]
}

export interface PollOption {
  id: string
  text: string
  votesCount: number
  percent: number
}

export interface Poll {
  id: string
  postId: string
  multipleChoice: boolean
  votersCount: number
  expiresAt: string
  expired: boolean
  voted: boolean
  votedOptionIds: string[]
  options: PollOption[]
}

export interface Post {
  id: string
  apId: string
  apUrl?: string | null
  isLocal?: boolean
  content: string
  encryptedContent?: string | null
  encryptionIv?: string | null
  ephemeralPublicKey?: string | null
  contentWarning: string | null
  visibility: 'public' | 'unlisted' | 'followers' | 'close_friends' | 'direct'
  sensitive: boolean
  likesCount: number
  boostsCount: number
  repliesCount: number
  quotesCount: number
  viewCount: number
  replyToId: string | null
  quotedPostId: string | null
  replyToAuthor: { handle: string; displayName: string | null } | null
  replyTo: { id: string; content: string; author: { handle: string; displayName: string | null } | null } | null
  quotedPost: QuotedPost | null
  poll: Poll | null
  linkPreview: { url: string; title: string | null; description: string | null; image: string | null; siteName: string | null; musicPlatform?: string; musicType?: string; musicEmbedUrl?: string; musicArtist?: string; musicTrack?: string } | null
  tags: string[]
  createdAt: string
  editedAt: string | null
  scheduledAt?: string | null
  isDraft?: boolean
  locationName?: string | null
  locationLat?: number | null
  locationLng?: number | null
  author: Actor | null
  media: MediaAttachment[]
  reactions: Record<string, number>
  viewer?: { liked: boolean; boosted: boolean; bookmarked: boolean; reactions: string[] }
  boostedBy?: Actor | null
  group?: { handle: string; name: string } | null
  templateData?: Record<string, string> | null
  flair?: { id: string; name: string; emoji: string | null; color: string } | null
}

export interface Community {
  id: string
  handle: string
  name: string
  description: string | null
  avatar_url: string | null
  banner_url: string | null
  visibility: 'public' | 'restricted' | 'private'
  rules: string | null
  color_index: number
  topics: string | null
  member_count: number
  post_count: number
  created_at: string
  viewer_status: 'none' | 'pending' | 'member' | 'mod' | 'owner'
  pinned_post_id: string | null
  invite_token: string | null
  post_templates: PostTemplate[]
  community_type: CommunityType
  flairs: CommunityFlair[]
}

export type CommunityType = 'general' | 'project' | 'event' | 'support' | 'learning' | 'gaming' | 'creative'

export interface CommunityFlair {
  id: string
  name: string
  emoji: string | null
  color: string
  sortOrder: number
}

export interface RemoteCommunityPreview {
  id: string
  handle: string
  displayName: string | null
  bio: string | null
  avatarUrl: string | null
  followersCount: number
  isLocked: boolean
  followStatus: 'pending' | 'accepted' | null
  apId: string | null
  inboxUrl: string | null
}

export interface RemoteCommunity {
  id: string
  handle: string
  displayName: string | null
  avatarUrl: string | null
  bio: string | null
  followStatus: string
  apId: string | null
}

export type PartnershipStatus = 'pending' | 'active' | 'rejected'

export interface PartnerCommunity {
  id: string
  handle: string
  displayName: string | null
  avatarUrl: string | null
  memberCount: number
}

export interface Partnership {
  id: string
  status: PartnershipStatus
  direction: 'incoming' | 'outgoing'
  initiatedByUs: boolean
  createdAt: string
  partner: PartnerCommunity | null
}

export interface VoteOption {
  index: number
  text: string
  count: number
}

export interface ConfederationVote {
  id: string
  title: string
  description: string | null
  options: VoteOption[]
  totalVotes: number
  targetCommunityIds: string[]
  closed: boolean
  closesAt: string
  createdAt: string
  isInitiator: boolean
  myVote: number | null
  initiator: { handle: string; displayName: string | null } | null
}

export type TrustLevel = 'new' | 'member' | 'regular' | 'trusted' | 'veteran'

export interface CommunityBadge {
  id: string
  name: string
  icon: string
  description: string | null
  color: string
  createdAt: string
}

export interface AlliedBadge {
  id: string
  name: string
  icon: string
  color: string
  communityHandle: string
  communityName: string | null
}

export interface MemberTrust {
  trustLevel: TrustLevel
  postCount: number
  likesReceived: number
  badges: Array<CommunityBadge & { awardedAt: string; note: string | null }>
  alliedBadges: AlliedBadge[]
}

export interface ActorCommunityBadge {
  id: string
  name: string
  icon: string
  color: string
  description: string | null
  awardedAt: string
  community: { handle: string; displayName: string | null; avatarUrl: string | null } | null
}

export type ModlogAction =
  | 'ban' | 'unban' | 'remove_post' | 'pin_post' | 'unpin_post'
  | 'approve_member' | 'reject_member' | 'edit_wiki' | 'update_settings'
  | 'invite_generated' | 'invite_revoked' | 'add_mod' | 'remove_mod'

export interface ModlogEntry {
  id: string
  action: ModlogAction
  reason: string | null
  metadata: Record<string, unknown> | null
  createdAt: string
  actor: { handle: string; displayName: string | null }
  targetUser: { handle: string; displayName: string | null } | null
  targetPostId: string | null
}

export interface GroupConversation {
  id: string
  name: string | null
  avatarUrl: string | null
  createdById: string | null
  createdAt: string
  updatedAt: string
  members: { id: string; handle: string; displayName: string | null; avatarUrl: string | null }[]
  lastMessage: { id: string; content: string; createdAt: string; authorId: string } | null
}

export interface DmConversation {
  partner: Actor
  lastMessage: { id: string; content: string; encryptedContent?: string | null; createdAt: string; authorId: string }
  isRequest?: boolean
  archived?: boolean
  muted?: boolean
  requestAccepted?: boolean | null
}

export interface DmThread {
  partner: Actor
  messages: Post[]
  nextCursor: string | null
  myReadId: string | null
  partnerReadId: string | null
  settings: { archived: boolean; muted: boolean; requestAccepted: boolean | null }
}

export interface ThreadContext {
  post: Post
  ancestors: Post[]
  replies: Post[]
  nextCursor: string | null
}

export interface TimelineResponse {
  posts: Post[]
  nextCursor: string | null
}

export type NotificationType =
  | 'like'
  | 'boost'
  | 'reply'
  | 'mention'
  | 'follow'
  | 'follow_request'
  | 'poll_ended'
  | 'flow_post'
  | 'account_suspended'

export interface Notification {
  id: string
  type: NotificationType
  read: boolean
  createdAt: string
  actor: Actor | null
  post: Post | null
}

export interface NotificationsResponse {
  notifications: Notification[]
  nextCursor: string | null
}

export interface SessionInfo {
  id: string
  current: boolean
  ipAddress: string | null
  userAgent: string | null
  createdAt: string
  expiresAt: string
}

export type FeedSort = 'chronological' | 'engagement' | 'mixed'

export interface FeedRulesConfig {
  sort: FeedSort
  hideReplies: boolean
  sources: { following: boolean; lists: string[] }
}

export interface FeedRule {
  id: string
  name: string
  isDefault: boolean
  rules: FeedRulesConfig
  createdAt: string
  updatedAt: string
}

export interface ListInfo {
  id: string
  title: string
  memberCount: number
  createdAt: string
}

export interface FlowInfo {
  id: string
  slug: string
  name: string
  description: string | null
  isPublic: boolean
  ownerId: string
  membersCount: number
  postsCount: number
  createdAt: string
  owner?: Actor
  isMember?: boolean
  role?: string | null
  isSubscribed?: boolean
}

export interface PulseConnection {
  domain: string
  following: number
  followers: number
  total: number
}

export interface PulseData {
  connections: PulseConnection[]
  recentActivity: Array<{
    id: string
    type: string
    status: 'pending' | 'processing' | 'done' | 'failed'
    createdAt: string
    targetDomain: string | null
  }>
  globalStats: {
    remoteActors: number
    deliveries: { done: number; failed: number; pending: number }
  }
}

export interface NetworkNode {
  id: string
  handle: string
  displayName: string | null
  avatarUrl: string | null
  followersCount: number
  isSelf: boolean
}

export interface NetworkEdge {
  source: string
  target: string
}

type MiniActor = { id: string; handle: string; displayName: string | null; avatarUrl: string | null; isLocal: boolean }

export interface SocialStats {
  unfollowers: { actor: MiniActor; unfollowedAt: string }[]
  notFollowingBack: MiniActor[]
  notFollowedBack: MiniActor[]
  recentFollowers: { actor: MiniActor; followedAt: string; isFollowing: boolean }[]
  counts: { unfollowers: number; notFollowingBack: number; notFollowedBack: number }
}


export interface HalkaInfo {
  id: string
  slug: string
  title: string
  description: string | null
  isLive: boolean
  participantsCount: number
  createdAt: string
  endedAt: string | null
  host: Pick<Actor, 'id' | 'handle' | 'displayName' | 'avatarUrl'>
}

export interface HalkaPeer {
  actorId: string
  handle: string
  displayName: string | null
  avatarUrl: string | null
}

export interface MomentGroup {
  actor: Pick<Actor, 'id' | 'handle' | 'displayName' | 'avatarUrl'>
  moments: Array<{
    id: string
    content: string
    expiresAt: string
    createdAt: string
    likesCount: number
    viewerLiked: boolean
    media?: Array<{ url: string; width: number | null; height: number | null; mimeType?: string; previewUrl?: string | null }>
  }>
}

export interface MutedActor {
  actor: Actor
  hideNotifications: boolean
  expiresAt: string | null
}

export interface ActorPreferences {
  dmEnabled: boolean
  allowReplyFrom: 'everyone' | 'followers' | 'nobody'
  hideLikesCount: boolean
  hideReadReceipts: boolean
  defaultVisibility: 'public' | 'followers' | 'unlisted'
  filterBots: boolean
  hideBoosts: boolean
  minAccountAgeFilter: number
  nsfwMode: 'hide' | 'blur' | 'show'
  preferredLanguages: string[]
  hideShortVideos: boolean
  usageTimeLimit: number
}

export interface NotificationPrefs {
  notifyLike: boolean
  notifyBoost: boolean
  notifyReply: boolean
  notifyMention: boolean
  notifyFollow: boolean
  notifyFollowRequest: boolean
  notifyPollEnded: boolean
}

export interface FederationInstance {
  id: string
  domain: string
  software: string | null
  softwareVersion: string | null
  name: string | null
  lastSeenAt: string | null
  isSuspended: boolean
  isSilenced: boolean
  actorsCount: number
  remoteFollowers: number
  remoteFollowing: number
}

export interface Relay {
  id: string
  inboxUrl: string
  actorUrl: string
  status: 'pending' | 'accepted' | 'rejected'
  createdAt: string
}

export interface FederationHealth {
  summary: {
    totalInstances: number
    activeInstances: number
    remoteActors: number
    remoteFollowers: number
    remoteFollowing: number
    outbound24h: number
    inbound24h: number
    failed24h: number
  }
  instances: FederationInstance[]
  activityTimeline: { date: string; outbound: number; inbound: number }[]
}

export interface AuditLog {
  id: string
  action: string
  targetType: string | null
  targetId: string | null
  details: Record<string, unknown> | null
  createdAt: string
  actor: { handle: string; displayName: string | null; avatarUrl: string | null }
}

export interface AdminReport {
  id: string
  reason: string
  details: string | null
  status: string
  createdAt: string
  reviewNote: string | null
  reporter: Actor
  post: (Post & { author: Actor }) | null
  reportedActor: Actor | null
}

export function proxyMediaUrl(url: string | null | undefined): string | null {
  if (!url) return null
  const appUrl = process.env['NEXT_PUBLIC_APP_URL'] ?? ''
  const apiUrl = process.env['NEXT_PUBLIC_API_URL'] ?? ''
  if (url.startsWith(appUrl) || url.startsWith(apiUrl)) return url
  // Localhost URLs (e.g. MinIO in dev) can't go through the proxy — it blocks internal hosts.
  // The browser can reach them directly.
  try { if (new URL(url).hostname === 'localhost') return url } catch { /* ignore */ }
  return `${API_URL}/api/proxy?url=${encodeURIComponent(url)}`
}

export interface AnalyticsData {
  totals: { totalPosts: number; totalLikes: number; totalBoosts: number; totalReplies: number; totalViews: number }
  recentPostCount: number
  followerCount: number
  followingCount: number
  profileViewCount: number
  likesTimeline: { day: string; count: number }[]
  boostsTimeline: { day: string; count: number }[]
  topPosts: { id: string; content: string; likesCount: number; boostsCount: number; repliesCount: number; createdAt: string }[]
  topTags: { tag: string; count: number }[]
}

export interface KeywordFilter {
  id: string
  keyword: string
  wholeWord: boolean
  contexts: string
  action: 'warn' | 'hide'
  expiresAt: string | null
  createdAt: string
}

export interface BookmarkCollection {
  id: string
  actorId: string
  name: string
  createdAt: string
}

export interface PostCollection {
  id: string
  actorId: string
  name: string
  description: string | null
  isPublic: boolean
  createdAt: string
  postCount?: number
}

export interface GifResult {
  id: string
  title: string
  url: string
  previewUrl: string
  width: number
  height: number
}

async function apiFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${API_URL}${path}`, {
    ...init,
    credentials: 'include',
    headers: { ...(init?.body != null ? { 'Content-Type': 'application/json' } : {}), ...init?.headers },
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    const errorCode = (err as { error?: string }).error ?? res.statusText
    if (errorCode === 'account_frozen' && typeof window !== 'undefined' && !window.location.pathname.includes('/frozen')) {
      window.location.href = '/frozen'
    }
    throw Object.assign(new Error(errorCode), { status: res.status, path })
  }
  if (res.status === 204) return undefined as T
  return res.json() as Promise<T>
}

export const api = {
  timeline: {
    home: (cursor?: string, ruleId?: string, sort?: FeedSort) => {
      const params = new URLSearchParams()
      if (cursor) params.set('cursor', cursor)
      if (ruleId) params.set('ruleId', ruleId)
      if (sort) params.set('sort', sort)
      const qs = params.toString()
      return apiFetch<TimelineResponse & { sort?: FeedSort }>(`/api/timeline/home${qs ? `?${qs}` : ''}`)
    },
    explore: (cursor?: string, feed?: 'local' | 'federated') => {
      const p = new URLSearchParams()
      if (cursor) p.set('cursor', cursor)
      if (feed) p.set('feed', feed)
      const qs = p.toString()
      return apiFetch<TimelineResponse>(`/api/timeline/explore${qs ? `?${qs}` : ''}`)
    },
    hashtag: (tag: string, cursor?: string) =>
      apiFetch<{ tag: string; posts: Post[]; nextCursor: string | null }>(
        `/api/timeline/hashtag/${encodeURIComponent(tag)}${cursor ? `?cursor=${encodeURIComponent(cursor)}` : ''}`,
      ),
  },
  posts: {
    get: (id: string) => apiFetch<Post>(`/api/posts/${id}`),
    context: (id: string, cursor?: string) =>
      apiFetch<ThreadContext>(`/api/posts/${id}/context${cursor ? `?cursor=${encodeURIComponent(cursor)}` : ''}`),
    create: (body: {
      content: string
      visibility?: Post['visibility']
      contentWarning?: string
      sensitive?: boolean
      replyToId?: string
      quotedPostId?: string
      mediaIds?: string[]
      poll?: { options: string[]; durationHours: number; multipleChoice?: boolean }
      scheduledAt?: string
      isDraft?: boolean
      locationName?: string
      locationLat?: number
      locationLng?: number
      groupHandle?: string
      templateData?: Record<string, string>
      flairId?: string
    }) => apiFetch<Post>('/api/posts', { method: 'POST', body: JSON.stringify(body) }),
    like: (id: string) => apiFetch<void>(`/api/posts/${id}/like`, { method: 'POST' }),
    unlike: (id: string) => apiFetch<void>(`/api/posts/${id}/like`, { method: 'DELETE' }),
    boost: (id: string) => apiFetch<void>(`/api/posts/${id}/boost`, { method: 'POST' }),
    unboost: (id: string) => apiFetch<void>(`/api/posts/${id}/boost`, { method: 'DELETE' }),
    bookmark: (id: string) => apiFetch<void>(`/api/posts/${id}/bookmark`, { method: 'POST' }),
    unbookmark: (id: string) => apiFetch<void>(`/api/posts/${id}/bookmark`, { method: 'DELETE' }),
    edit: (id: string, content: string, visibility?: Post['visibility']) =>
      apiFetch<Post>(`/api/posts/${id}`, { method: 'PATCH', body: JSON.stringify({ content, ...(visibility ? { visibility } : {}) }) }),
    delete: (id: string) => apiFetch<void>(`/api/posts/${id}`, { method: 'DELETE' }),
    scheduled: () => apiFetch<{ posts: Post[] }>('/api/posts/scheduled'),
    cancelScheduled: (id: string) => apiFetch<void>(`/api/posts/scheduled/${id}`, { method: 'DELETE' }),
    drafts: () => apiFetch<{ posts: Post[] }>('/api/posts/drafts'),
    publishDraft: (id: string) => apiFetch<Post>(`/api/posts/drafts/${id}/publish`, { method: 'POST' }),
    deleteDraft: (id: string) => apiFetch<void>(`/api/posts/drafts/${id}`, { method: 'DELETE' }),
    edits: (id: string) =>
      apiFetch<{ edits: { id: string; content: string; contentWarning: string | null; editedAt: string }[] }>(`/api/posts/${id}/edits`),
    pin: (id: string) => apiFetch<{ pinnedPostId: string }>(`/api/posts/${id}/pin`, { method: 'POST' }),
    unpin: (id: string) => apiFetch<void>(`/api/posts/${id}/pin`, { method: 'DELETE' }),
    react: (id: string, emoji: string) =>
      apiFetch<void>(`/api/posts/${id}/reactions`, { method: 'POST', body: JSON.stringify({ emoji }) }),
    unreact: (id: string, emoji: string) =>
      apiFetch<void>(`/api/posts/${id}/reactions/${encodeURIComponent(emoji)}`, { method: 'DELETE' }),
    quotes: (id: string, cursor?: string) =>
      apiFetch<{ posts: Post[]; nextCursor: string | null }>(
        `/api/posts/${id}/quotes${cursor ? `?cursor=${encodeURIComponent(cursor)}` : ''}`,
      ),
    likes: (id: string, cursor?: string) =>
      apiFetch<{ actors: Actor[]; nextCursor: string | null }>(
        `/api/posts/${id}/likes${cursor ? `?cursor=${encodeURIComponent(cursor)}` : ''}`,
      ),
  },
  notifications: {
    list: (cursor?: string) =>
      apiFetch<NotificationsResponse>(
        `/api/notifications${cursor ? `?cursor=${cursor}` : ''}`,
      ),
    unreadCount: () => apiFetch<{ count: number }>('/api/notifications/unread-count'),
    readAll: () => apiFetch<void>('/api/notifications/read-all', { method: 'POST' }),
    readOne: (id: string) =>
      apiFetch<void>(`/api/notifications/${id}/read`, { method: 'PATCH' }),
    deleteOne: (id: string) =>
      apiFetch<void>(`/api/notifications/${id}`, { method: 'DELETE' }),
  },
  actors: {
    get: (handle: string) => apiFetch<Actor>(`/api/actors/${handle}`),
    suggested: () => apiFetch<{ actors: Actor[] }>('/api/actors/suggested'),
    follow: (handle: string) =>
      apiFetch<{ status: string }>(`/api/actors/${handle}/follow`, { method: 'POST' }),
    unfollow: (handle: string) =>
      apiFetch<void>(`/api/actors/${handle}/follow`, { method: 'DELETE' }),
    setNotify: (handle: string, notify: boolean) =>
      apiFetch<{ notifyOnActivity: boolean }>(`/api/actors/${handle}/notify`, { method: 'PATCH', body: JSON.stringify({ notify }) }),
    posts: (handle: string, cursor?: string, onlyMedia?: boolean, onlyReplies?: boolean) => {
      const params = new URLSearchParams()
      if (cursor) params.set('cursor', cursor)
      if (onlyMedia) params.set('onlyMedia', 'true')
      if (onlyReplies) params.set('onlyReplies', 'true')
      const qs = params.toString()
      return apiFetch<{ actor: Actor; pinnedPost: Post | null; posts: Post[]; nextCursor: string | null }>(
        `/api/actors/${handle}/posts${qs ? `?${qs}` : ''}`,
      )
    },
    followers: (handle: string, cursor?: string) =>
      apiFetch<{ actors: Actor[]; nextCursor: string | null }>(
        `/api/actors/${handle}/followers${cursor ? `?cursor=${encodeURIComponent(cursor)}` : ''}`,
      ),
    following: (handle: string, cursor?: string) =>
      apiFetch<{ actors: Actor[]; nextCursor: string | null }>(
        `/api/actors/${handle}/following${cursor ? `?cursor=${encodeURIComponent(cursor)}` : ''}`,
      ),
    likes: (handle: string, cursor?: string) =>
      apiFetch<{ posts: Post[]; nextCursor: string | null }>(
        `/api/actors/${handle}/likes${cursor ? `?cursor=${encodeURIComponent(cursor)}` : ''}`,
      ),
    network: () =>
      apiFetch<{ nodes: NetworkNode[]; edges: NetworkEdge[] }>('/api/actors/network'),
    activity: (handle: string) =>
      apiFetch<{ activity: { day: string; count: number }[] }>(`/api/actors/${handle}/activity`),
    socialStats: () =>
      apiFetch<SocialStats>('/api/actors/me/social-stats'),
    mutualFollowers: (handle: string) =>
      apiFetch<{ actors: { id: string; handle: string; displayName: string | null; avatarUrl: string | null }[] }>(
        `/api/actors/${handle}/mutual-followers`,
      ),
    communityBadges: (handle: string) =>
      apiFetch<ActorCommunityBadge[]>(`/api/actors/${handle}/community-badges`),
  },
  followRequests: {
    list: () =>
      apiFetch<{ requests: { id: string; actor: Actor; createdAt: string }[] }>('/api/follows/requests'),
    accept: (id: string) =>
      apiFetch<void>(`/api/follows/requests/${id}/accept`, { method: 'POST' }),
    reject: (id: string) =>
      apiFetch<void>(`/api/follows/requests/${id}/reject`, { method: 'POST' }),
    acceptByHandle: (handle: string) =>
      apiFetch<void>(`/api/actors/${handle}/follow-request/accept`, { method: 'POST' }),
    rejectByHandle: (handle: string) =>
      apiFetch<void>(`/api/actors/${handle}/follow-request/reject`, { method: 'POST' }),
  },
  feedRules: {
    presets: () => apiFetch<{ presets: Record<string, { name: string; description: string; config: FeedRulesConfig }> }>('/api/feed-rules/presets'),
    list: () => apiFetch<{ feedRules: FeedRule[] }>('/api/feed-rules'),
    create: (body: { name: string; rules: FeedRulesConfig }) =>
      apiFetch<FeedRule>('/api/feed-rules', { method: 'POST', body: JSON.stringify(body) }),
    update: (id: string, body: { name?: string; rules?: FeedRulesConfig }) =>
      apiFetch<FeedRule>(`/api/feed-rules/${id}`, { method: 'PATCH', body: JSON.stringify(body) }),
    setDefault: (id: string) =>
      apiFetch<void>(`/api/feed-rules/${id}/default`, { method: 'POST' }),
    delete: (id: string) => apiFetch<void>(`/api/feed-rules/${id}`, { method: 'DELETE' }),
    applyPreset: (preset: string) =>
      apiFetch<void>('/api/feed-rules/preset', { method: 'POST', body: JSON.stringify({ preset }) }),
  },
  lists: {
    list: () => apiFetch<{ lists: ListInfo[] }>('/api/lists'),
    create: (title: string) =>
      apiFetch<ListInfo>('/api/lists', { method: 'POST', body: JSON.stringify({ title }) }),
    update: (id: string, title: string) =>
      apiFetch<ListInfo>(`/api/lists/${id}`, { method: 'PATCH', body: JSON.stringify({ title }) }),
    delete: (id: string) => apiFetch<void>(`/api/lists/${id}`, { method: 'DELETE' }),
    members: (id: string) =>
      apiFetch<{ list: ListInfo; members: Actor[] }>(`/api/lists/${id}/members`),
    addMember: (id: string, handle: string) =>
      apiFetch<void>(`/api/lists/${id}/members`, { method: 'POST', body: JSON.stringify({ handle }) }),
    removeMember: (id: string, actorId: string) =>
      apiFetch<void>(`/api/lists/${id}/members/${actorId}`, { method: 'DELETE' }),
    timeline: (id: string, cursor?: string) =>
      apiFetch<{ list: ListInfo; posts: Post[]; nextCursor: string | null }>(
        `/api/timeline/list/${id}${cursor ? `?cursor=${cursor}` : ''}`,
      ),
  },
  account: {
    updateProfile: (body: { displayName?: string; bio?: string; location?: string | null; website?: string | null; isLocked?: boolean; profileFields?: Array<{ name: string; value: string; verifiedAt?: string | null }> }) =>
      apiFetch<void>('/api/account/profile', { method: 'PATCH', body: JSON.stringify(body) }),
    uploadAvatar: async (file: File): Promise<{ url: string }> => {
      const form = new FormData()
      form.append('file', file)
      const res = await fetch(`${API_URL}/api/account/avatar`, { method: 'POST', credentials: 'include', body: form })
      if (!res.ok) throw new Error(((await res.json().catch(() => ({}))) as { error?: string }).error ?? res.statusText)
      return res.json() as Promise<{ url: string }>
    },
    uploadHeader: async (file: File): Promise<{ url: string }> => {
      const form = new FormData()
      form.append('file', file)
      const res = await fetch(`${API_URL}/api/account/header`, { method: 'POST', credentials: 'include', body: form })
      if (!res.ok) throw new Error(((await res.json().catch(() => ({}))) as { error?: string }).error ?? res.statusText)
      return res.json() as Promise<{ url: string }>
    },
    updatePrivacy: (body: { isLocked: boolean }) =>
      apiFetch<void>('/api/account/privacy', { method: 'PATCH', body: JSON.stringify(body) }),
    exportData: () =>
      fetch(`${API_URL}/api/account/export`, { credentials: 'include' }),
    migrate: (targetActorUri: string) =>
      apiFetch<void>('/api/account/migrate', { method: 'POST', body: JSON.stringify({ targetActorUri }) }),
    linkBluesky: (blueskyHandle: string | null) =>
      apiFetch<void>('/api/account/bluesky', { method: 'PATCH', body: JSON.stringify({ blueskyHandle }) }),
    setAlsoKnownAs: (uris: string[]) =>
      apiFetch<void>('/api/account/also-known-as', { method: 'PUT', body: JSON.stringify({ uris }) }),
    setDomainHandle: (domain: string | null) =>
      apiFetch<{ domain: string | null; verified: boolean }>('/api/account/domain-handle', {
        method: 'PUT',
        body: JSON.stringify({ domain }),
      }),
    verifyDomainHandle: () =>
      apiFetch<{ verified: boolean; verifiedAt?: string; error?: string }>('/api/account/domain-handle/verify', {
        method: 'POST',
      }),
    getPreferences: () => apiFetch<ActorPreferences>('/api/account/preferences'),
    updatePreferences: (body: Partial<ActorPreferences>) =>
      apiFetch<void>('/api/account/preferences', { method: 'PATCH', body: JSON.stringify(body) }),
    getNotificationPrefs: () => apiFetch<NotificationPrefs>('/api/account/notification-prefs'),
    updateNotificationPrefs: (body: Partial<NotificationPrefs>) =>
      apiFetch<void>('/api/account/notification-prefs', { method: 'PATCH', body: JSON.stringify(body) }),
    getMe: () => apiFetch<{ onboardingCompletedAt: string | null }>('/api/account/me'),
    completeOnboarding: () => apiFetch<void>('/api/account/complete-onboarding', { method: 'POST' }),
    fediversePreview: (handle: string) =>
      apiFetch<{ total: number; actors: Array<{ handle: string; displayName: string | null; avatarUrl: string | null }> }>(
        `/api/onboarding/fediverse-preview?handle=${encodeURIComponent(handle)}`,
      ),
    freeze: () => apiFetch<void>('/api/account/freeze', { method: 'POST' }),
    unfreeze: () => apiFetch<void>('/api/account/unfreeze', { method: 'POST' }),
    delete: () => apiFetch<void>('/api/account', { method: 'DELETE' }),
    analytics: () => apiFetch<AnalyticsData>('/api/account/analytics'),
    sessions: {
      list: () => apiFetch<{ sessions: SessionInfo[] }>('/api/account/sessions'),
      revoke: (id: string) =>
        apiFetch<void>(`/api/account/sessions/${id}`, { method: 'DELETE' }),
      revokeAll: () => apiFetch<void>('/api/account/sessions', { method: 'DELETE' }),
    },
  },
  bluesky: {
    connection: () =>
      apiFetch<{ connected: boolean; did?: string; handle?: string; crosspost_enabled?: boolean; import_enabled?: boolean; last_sync_at?: string | null; last_error?: string | null }>(
        '/api/bluesky/connection',
      ),
    connect: (identifier: string, appPassword: string) =>
      apiFetch<{ connected: boolean; handle?: string; crosspost_enabled?: boolean }>('/api/bluesky/connect', {
        method: 'POST',
        body: JSON.stringify({ identifier, app_password: appPassword }),
      }),
    updateSettings: (body: { crosspost_enabled?: boolean; import_enabled?: boolean }) =>
      apiFetch<void>('/api/bluesky/connection', { method: 'PATCH', body: JSON.stringify(body) }),
    disconnect: () => apiFetch<void>('/api/bluesky/connection', { method: 'DELETE' }),
  },
  nostr: {
    identity: () =>
      apiFetch<{ enabled: boolean; pubkey?: string; npub?: string; identifier?: string; crosspost_enabled?: boolean }>(
        '/api/nostr/identity',
      ),
    enable: () =>
      apiFetch<{ enabled: boolean; pubkey: string; npub: string; identifier: string }>('/api/nostr/identity', {
        method: 'POST',
      }),
    setCrosspost: (enabled: boolean) =>
      apiFetch<{ crosspost_enabled: boolean }>('/api/nostr/crosspost', { method: 'PATCH', body: JSON.stringify({ enabled }) }),
    disconnect: () => apiFetch<{ enabled: boolean }>('/api/nostr/identity', { method: 'DELETE' }),
  },
  media: {
    upload: async (file: File): Promise<MediaAttachment> => {
      const form = new FormData()
      form.append('file', file)
      const res = await fetch(`${API_URL}/api/media`, {
        method: 'POST',
        credentials: 'include',
        body: form,
      })
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        throw Object.assign(new Error((err as { error?: string }).error ?? res.statusText), { status: res.status })
      }
      return res.json() as Promise<MediaAttachment>
    },
    uploadAudio: async (blob: Blob, mimeType: string): Promise<MediaAttachment> => {
      const form = new FormData()
      form.append('file', blob, `voice.${mimeType.split('/')[1] ?? 'webm'}`)
      const res = await fetch(`${API_URL}/api/media`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'x-media-type': 'audio' },
        body: form,
      })
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        throw Object.assign(new Error((err as { error?: string }).error ?? res.statusText), { status: res.status })
      }
      return res.json() as Promise<MediaAttachment>
    },
    uploadVideo: async (file: File): Promise<MediaAttachment> => {
      const form = new FormData()
      form.append('file', file)
      const res = await fetch(`${API_URL}/api/media`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'x-media-type': 'video' },
        body: form,
      })
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        throw Object.assign(new Error((err as { error?: string }).error ?? res.statusText), { status: res.status })
      }
      return res.json() as Promise<MediaAttachment>
    },
    updateAlt: (id: string, altText: string) =>
      apiFetch<MediaAttachment>(`/api/media/${id}`, { method: 'PATCH', body: JSON.stringify({ altText }) }),
  },
  gifs: {
    search: (q: string) =>
      apiFetch<{ gifs: GifResult[]; enabled: boolean }>(`/api/gifs/search?q=${encodeURIComponent(q)}`),
    featured: () =>
      apiFetch<{ gifs: GifResult[]; enabled: boolean }>('/api/gifs/featured'),
    attach: (gif: GifResult) =>
      apiFetch<MediaAttachment>('/api/gifs/attach', {
        method: 'POST',
        body: JSON.stringify({ url: gif.url, previewUrl: gif.previewUrl, width: gif.width, height: gif.height }),
      }),
  },
  composerDraft: {
    get: () => apiFetch<{ draft: { content: string; contentWarning: string | null; updatedAt: string } | null }>('/api/composer-draft'),
    save: (content: string, contentWarning?: string | null) =>
      apiFetch<{ ok: boolean }>('/api/composer-draft', { method: 'PUT', body: JSON.stringify({ content, contentWarning: contentWarning ?? null }) }),
    clear: () => apiFetch<{ ok: boolean }>('/api/composer-draft', { method: 'DELETE' }),
  },
  translate: {
    text: (text: string, to = 'tr') =>
      apiFetch<{ translated: string; detectedLang: string; detectedLangName: string; toLang: string; toLangName: string }>(
        '/api/translate',
        { method: 'POST', body: JSON.stringify({ text, to }) },
      ),
    languages: () =>
      apiFetch<{ languages: { code: string; name: string }[] }>('/api/translate/languages'),
  },
  linkPreview: (url: string) =>
    apiFetch<{ url: string; title: string | null; description: string | null; image: string | null; siteName: string | null }>(
      `/api/link-preview?url=${encodeURIComponent(url)}`,
    ),
  instance: {
    // Public federation reach for the sidebar widget (no auth).
    federation: () =>
      apiFetch<{ activeInstances: number; remoteActors: number; inbound24h: number }>('/api/instance/federation'),
  },
  search: {
    query: (
      q: string,
      type: 'actors' | 'posts' | 'all' = 'all',
      filters?: { from?: string; since?: string; until?: string; hasMedia?: boolean; onlyReplies?: boolean | null; scope?: 'local' | 'federated' },
    ) => {
      const params = new URLSearchParams({ q, type })
      if (filters?.from) params.set('from', filters.from)
      if (filters?.since) params.set('since', filters.since)
      if (filters?.until) params.set('until', filters.until)
      if (filters?.hasMedia) params.set('hasMedia', 'true')
      if (filters?.onlyReplies === true) params.set('onlyReplies', 'true')
      if (filters?.onlyReplies === false) params.set('onlyReplies', 'false')
      if (filters?.scope) params.set('scope', filters.scope)
      return apiFetch<{ actors: Actor[]; posts: Post[] }>(`/api/search?${params}`)
    },
    trendingTags: () =>
      apiFetch<{ tags: { tag: string; count: number }[] }>('/api/trending/tags'),
  },
  hashtags: {
    info: (tag: string) =>
      apiFetch<{ tag: string; postsCount: number; followersCount: number; following: boolean }>(
        `/api/hashtags/${encodeURIComponent(tag)}`,
      ),
    followed: () => apiFetch<{ hashtags: string[] }>('/api/hashtags/followed'),
    follow: (tag: string) =>
      apiFetch<{ following: boolean; tag: string }>(`/api/hashtags/${encodeURIComponent(tag)}/follow`, { method: 'POST' }),
    unfollow: (tag: string) =>
      apiFetch<{ following: boolean; tag: string }>(`/api/hashtags/${encodeURIComponent(tag)}/follow`, { method: 'DELETE' }),
  },
  push: {
    getVapidKey: () =>
      apiFetch<{ enabled: boolean; publicKey: string | null }>('/api/push/vapid-public-key'),
    subscribe: (subscription: { endpoint: string; keys: { p256dh: string; auth: string } }) =>
      apiFetch<void>('/api/push/subscribe', { method: 'POST', body: JSON.stringify(subscription) }),
    unsubscribe: (endpoint: string) =>
      apiFetch<void>('/api/push/subscribe', { method: 'DELETE', body: JSON.stringify({ endpoint }) }),
  },
  closeFriends: {
    list: () => apiFetch<{ closeFriends: Pick<Actor, 'id' | 'handle' | 'displayName' | 'avatarUrl'>[] }>('/api/close-friends'),
    add: (handle: string) => apiFetch<void>(`/api/close-friends/${handle}`, { method: 'PUT' }),
    remove: (handle: string) => apiFetch<void>(`/api/close-friends/${handle}`, { method: 'DELETE' }),
    check: (handle: string) => apiFetch<{ isCloseFriend: boolean }>(`/api/close-friends/check/${handle}`),
  },
  pulse: {
    get: () => apiFetch<PulseData>('/api/pulse'),
  },
  moments: {
    list: () => apiFetch<{ groups: MomentGroup[] }>('/api/moments'),
    create: (content: string, mediaId?: string) =>
      apiFetch<Post>('/api/moments', { method: 'POST', body: JSON.stringify({ content, mediaId }) }),
    delete: (id: string) => apiFetch<void>(`/api/moments/${id}`, { method: 'DELETE' }),
  },
  invites: {
    validate: (code: string) =>
      apiFetch<{ valid: boolean; open?: boolean; error?: string }>(`/api/invites/${encodeURIComponent(code)}`),
    use: (code: string, userId: string) =>
      apiFetch<void>(`/api/invites/${encodeURIComponent(code)}/use`, {
        method: 'POST',
        body: JSON.stringify({ userId }),
      }),
  },

  flows: {
    list: (q?: string, sort?: string) => {
      const params = new URLSearchParams()
      if (q) params.set('q', q)
      if (sort) params.set('sort', sort)
      const qs = params.toString()
      return apiFetch<{ joined: FlowInfo[]; discover: FlowInfo[] }>(`/api/flows${qs ? `?${qs}` : ''}`)
    },
    get: (slug: string) => apiFetch<FlowInfo>(`/api/flows/${slug}`),
    create: (body: { name: string; slug: string; description?: string; isPublic?: boolean }) =>
      apiFetch<FlowInfo>('/api/flows', { method: 'POST', body: JSON.stringify(body) }),
    update: (slug: string, body: Partial<{ name: string; description: string; isPublic: boolean }>) =>
      apiFetch<FlowInfo>(`/api/flows/${slug}`, { method: 'PATCH', body: JSON.stringify(body) }),
    delete: (slug: string) => apiFetch<void>(`/api/flows/${slug}`, { method: 'DELETE' }),
    join: (slug: string) => apiFetch<void>(`/api/flows/${slug}/join`, { method: 'POST' }),
    leave: (slug: string) => apiFetch<void>(`/api/flows/${slug}/join`, { method: 'DELETE' }),
    timeline: (slug: string, cursor?: string) =>
      apiFetch<{ flow: FlowInfo; posts: Post[]; nextCursor: string | null }>(
        `/api/flows/${slug}/timeline${cursor ? `?cursor=${cursor}` : ''}`,
      ),
    post: (slug: string, body: { content: string; contentWarning?: string; sensitive?: boolean }) =>
      apiFetch<Post>(`/api/flows/${slug}/posts`, { method: 'POST', body: JSON.stringify(body) }),
    subscribe: (slug: string) => apiFetch<void>(`/api/flows/${slug}/subscribe`, { method: 'POST' }),
    unsubscribe: (slug: string) => apiFetch<void>(`/api/flows/${slug}/subscribe`, { method: 'DELETE' }),
    pinned: (slug: string) => apiFetch<Post[]>(`/api/flows/${slug}/pinned`),
    pin: (slug: string, postId: string) => apiFetch<void>(`/api/flows/${slug}/posts/${postId}/pin`, { method: 'POST' }),
    unpin: (slug: string, postId: string) => apiFetch<void>(`/api/flows/${slug}/posts/${postId}/pin`, { method: 'DELETE' }),
    deletePost: (slug: string, postId: string) => apiFetch<void>(`/api/flows/${slug}/posts/${postId}`, { method: 'DELETE' }),
    members: (slug: string) => apiFetch<{ actor: Actor; role: string; createdAt: string }[]>(`/api/flows/${slug}/members`),
    createInvite: (slug: string) => apiFetch<{ id: string; code: string; flowId: string; usedCount: number; maxUses: number }>(`/api/flows/${slug}/invites`, { method: 'POST' }),
    listInvites: (slug: string) => apiFetch<{ id: string; code: string; flowId: string; usedCount: number; maxUses: number }[]>(`/api/flows/${slug}/invites`),
    joinViaInvite: (code: string) => apiFetch<FlowInfo>('/api/flows/join-invite', { method: 'POST', body: JSON.stringify({ code }) }),
  },
  halka: {
    list: () => apiFetch<{ spaces: HalkaInfo[] }>('/api/halka'),
    create: (body: { title: string; description?: string }) =>
      apiFetch<HalkaInfo>('/api/halka', { method: 'POST', body: JSON.stringify(body) }),
    get: (slug: string) => apiFetch<HalkaInfo>(`/api/halka/${slug}`),
    signal: (slug: string, targetActorId: string, payload: unknown) =>
      apiFetch<void>(`/api/halka/${slug}/signal`, { method: 'POST', body: JSON.stringify({ targetActorId, payload }) }),
    end: (slug: string) => apiFetch<void>(`/api/halka/${slug}`, { method: 'DELETE' }),
    streamUrl: (slug: string) => `${API_URL}/api/halka/${slug}/stream`,
  },
  dm: {
    list: (cursor?: string) =>
      apiFetch<{ conversations: DmConversation[]; nextCursor: string | null }>(
        `/api/dm${cursor ? `?cursor=${encodeURIComponent(cursor)}` : ''}`,
      ),
    thread: (handle: string, cursor?: string) =>
      apiFetch<DmThread>(
        `/api/dm/${encodeURIComponent(handle)}${cursor ? `?cursor=${encodeURIComponent(cursor)}` : ''}`,
      ),
    send: (handle: string, content: string, encrypted?: { encryptedContent: string; encryptionIv: string; ephemeralPublicKey: string }, mediaIds?: string[], replyToId?: string) =>
      apiFetch<Post>(`/api/dm/${encodeURIComponent(handle)}`, {
        method: 'POST',
        body: JSON.stringify(encrypted
          ? { encryptedContent: encrypted.encryptedContent, encryptionIv: encrypted.encryptionIv, ephemeralPublicKey: encrypted.ephemeralPublicKey, ...(mediaIds?.length ? { mediaIds } : {}), ...(replyToId ? { replyToId } : {}) }
          : { content, ...(mediaIds?.length ? { mediaIds } : {}), ...(replyToId ? { replyToId } : {}) }),
      }),
    sendMedia: (handle: string, mediaIds: string[]) =>
      apiFetch<Post>(`/api/dm/${encodeURIComponent(handle)}`, {
        method: 'POST',
        body: JSON.stringify({ mediaIds }),
      }),
    markRead: (handle: string) =>
      apiFetch<{ lastReadId: string | null }>(`/api/dm/${encodeURIComponent(handle)}/read`, { method: 'POST' }),
    sendTyping: (handle: string) =>
      apiFetch<void>(`/api/dm/${encodeURIComponent(handle)}/typing`, { method: 'POST' }),
    editMessage: (id: string, content: string) =>
      apiFetch<{ id: string; content: string; editedAt: string }>(`/api/dm/messages/${encodeURIComponent(id)}`, {
        method: 'PATCH',
        body: JSON.stringify({ content }),
      }),
    searchMessages: (handle: string, q: string) =>
      apiFetch<{ messages: Post[] }>(`/api/dm/${encodeURIComponent(handle)}/search?q=${encodeURIComponent(q)}`),
    updateSettings: (handle: string, settings: { archived?: boolean; muted?: boolean }) =>
      apiFetch<void>(`/api/dm/${encodeURIComponent(handle)}/settings`, {
        method: 'PATCH',
        body: JSON.stringify(settings),
      }),
    acceptRequest: (handle: string) =>
      apiFetch<void>(`/api/dm/requests/${encodeURIComponent(handle)}/accept`, { method: 'POST' }),
    declineRequest: (handle: string) =>
      apiFetch<void>(`/api/dm/requests/${encodeURIComponent(handle)}/decline`, { method: 'POST' }),
    createGroup: (memberHandles: string[], name?: string) =>
      apiFetch<GroupConversation>('/api/dm/conversations', {
        method: 'POST',
        body: JSON.stringify({ memberHandles, ...(name ? { name } : {}) }),
      }),
    listGroups: () =>
      apiFetch<{ conversations: GroupConversation[] }>('/api/dm/conversations'),
    groupThread: (id: string, cursor?: string) =>
      apiFetch<{ conversation: GroupConversation; messages: Post[]; nextCursor: string | null }>(
        `/api/dm/conversations/${encodeURIComponent(id)}${cursor ? `?cursor=${encodeURIComponent(cursor)}` : ''}`,
      ),
    sendToGroup: (id: string, content: string, mediaIds?: string[]) =>
      apiFetch<Post>(`/api/dm/conversations/${encodeURIComponent(id)}/messages`, {
        method: 'POST',
        body: JSON.stringify({ ...(content.trim() ? { content } : {}), ...(mediaIds?.length ? { mediaIds } : {}) }),
      }),
    addGroupMember: (id: string, handle: string) =>
      apiFetch<{ id: string; handle: string; displayName: string | null; avatarUrl: string | null }>(
        `/api/dm/conversations/${encodeURIComponent(id)}/members`,
        { method: 'POST', body: JSON.stringify({ handle }) },
      ),
    updateGroupInfo: (id: string, info: { name?: string; avatarUrl?: string }) =>
      apiFetch<GroupConversation>(`/api/dm/conversations/${encodeURIComponent(id)}`, {
        method: 'PATCH',
        body: JSON.stringify(info),
      }),
    leaveGroup: (id: string) =>
      apiFetch<void>(`/api/dm/conversations/${encodeURIComponent(id)}/leave`, { method: 'POST' }),
    removeGroupMember: (id: string, actorId: string) =>
      apiFetch<void>(`/api/dm/conversations/${encodeURIComponent(id)}/members/${encodeURIComponent(actorId)}`, { method: 'DELETE' }),
    registerDmKey: (publicKey: string) =>
      apiFetch<{ dmPublicKey: string }>('/api/dm/keys', { method: 'POST', body: JSON.stringify({ publicKey }) }),
    deleteMessage: (id: string, mode: 'self' | 'everyone') =>
      apiFetch<void>(`/api/dm/messages/${encodeURIComponent(id)}?mode=${mode}`, { method: 'DELETE' }),
  },
  bookmarks: {
    list: (cursor?: string, collectionId?: string | null) => {
      const params = new URLSearchParams()
      if (cursor) params.set('cursor', cursor)
      if (collectionId) params.set('collection', collectionId)
      const qs = params.toString()
      return apiFetch<{ posts: Post[]; nextCursor: string | null }>(`/api/bookmarks${qs ? `?${qs}` : ''}`)
    },
    moveToCollection: (postId: string, collectionId: string | null) =>
      apiFetch<void>(`/api/posts/${postId}/bookmark`, { method: 'PATCH', body: JSON.stringify({ collectionId }) }),
  },
  bookmarkCollections: {
    list: () => apiFetch<{ collections: BookmarkCollection[] }>('/api/bookmark-collections'),
    create: (name: string) =>
      apiFetch<BookmarkCollection>('/api/bookmark-collections', { method: 'POST', body: JSON.stringify({ name }) }),
    rename: (id: string, name: string) =>
      apiFetch<BookmarkCollection>(`/api/bookmark-collections/${id}`, { method: 'PATCH', body: JSON.stringify({ name }) }),
    delete: (id: string) => apiFetch<void>(`/api/bookmark-collections/${id}`, { method: 'DELETE' }),
  },
  postCollections: {
    list: () => apiFetch<{ collections: PostCollection[] }>('/api/collections'),
    listByHandle: (handle: string) => apiFetch<{ collections: PostCollection[] }>(`/api/collections/actor/${handle}`),
    create: (name: string, description?: string, isPublic?: boolean) =>
      apiFetch<PostCollection>('/api/collections', { method: 'POST', body: JSON.stringify({ name, description, isPublic }) }),
    update: (id: string, body: { name?: string; description?: string; isPublic?: boolean }) =>
      apiFetch<PostCollection>(`/api/collections/${id}`, { method: 'PATCH', body: JSON.stringify(body) }),
    delete: (id: string) => apiFetch<void>(`/api/collections/${id}`, { method: 'DELETE' }),
    getPosts: (id: string) => apiFetch<{ posts: Post[]; collection: PostCollection }>(`/api/collections/${id}/posts`),
    addPost: (id: string, postId: string) =>
      apiFetch<{ ok: boolean }>(`/api/collections/${id}/posts`, { method: 'POST', body: JSON.stringify({ postId }) }),
    removePost: (id: string, postId: string) => apiFetch<void>(`/api/collections/${id}/posts/${postId}`, { method: 'DELETE' }),
  },
  filters: {
    list: () => apiFetch<{ filters: KeywordFilter[] }>('/api/filters'),
    create: (body: { keyword: string; wholeWord?: boolean; contexts?: string; action?: 'warn' | 'hide'; expiresAt?: string | null }) =>
      apiFetch<KeywordFilter>('/api/filters', { method: 'POST', body: JSON.stringify(body) }),
    update: (id: string, body: Partial<{ keyword: string; wholeWord: boolean; contexts: string; action: 'warn' | 'hide'; expiresAt: string | null }>) =>
      apiFetch<KeywordFilter>(`/api/filters/${id}`, { method: 'PATCH', body: JSON.stringify(body) }),
    delete: (id: string) => apiFetch<void>(`/api/filters/${id}`, { method: 'DELETE' }),
  },
  location: {
    posts: (name: string, cursor?: string) =>
      apiFetch<{ posts: Post[]; nextCursor: string | null }>(`/api/location/${encodeURIComponent(name)}/posts${cursor ? `?cursor=${encodeURIComponent(cursor)}` : ''}`),
  },
  polls: {
    vote: (pollId: string, optionIds: string[]) =>
      apiFetch<Poll>(`/api/polls/${pollId}/vote`, { method: 'POST', body: JSON.stringify({ optionIds }) }),
    retractVote: (pollId: string) =>
      apiFetch<Poll>(`/api/polls/${pollId}/vote`, { method: 'DELETE' }),
    get: (pollId: string) => apiFetch<Poll>(`/api/polls/${pollId}`),
  },
  moderation: {
    blocks: {
      list: () => apiFetch<{ blocked: Actor[] }>('/api/blocks'),
      block: (handle: string) => apiFetch<{ ok: boolean }>(`/api/blocks/${encodeURIComponent(handle)}`, { method: 'POST' }),
      unblock: (handle: string) => apiFetch<{ ok: boolean }>(`/api/blocks/${encodeURIComponent(handle)}`, { method: 'DELETE' }),
    },
    mutes: {
      list: () => apiFetch<{ muted: MutedActor[] }>('/api/mutes'),
      mute: (handle: string, body?: { hideNotifications?: boolean; duration?: number }) =>
        apiFetch<{ ok: boolean }>(`/api/mutes/${encodeURIComponent(handle)}`, { method: 'POST', body: JSON.stringify(body ?? {}) }),
      unmute: (handle: string) => apiFetch<{ ok: boolean }>(`/api/mutes/${encodeURIComponent(handle)}`, { method: 'DELETE' }),
    },
  },
  reports: {
    submit: (body: { postId?: string; reportedActorHandle?: string; reason: string; details?: string }) =>
      apiFetch<{ id: string }>('/api/reports', { method: 'POST', body: JSON.stringify(body) }),
  },
  transparency: () =>
    apiFetch<{ months: Array<{ month: string; total: number; accepted: number; rejected: number; pending: number }> }>(
      '/api/moderation/transparency',
    ),
  admin: {
    reports: (status?: string) =>
      apiFetch<{ reports: AdminReport[] }>(`/api/admin/reports${status ? `?status=${status}` : ''}`),
    reviewReport: (id: string, body: { status: 'reviewed_accepted' | 'reviewed_rejected'; reviewNote?: string; deletePost?: boolean }) =>
      apiFetch<{ id: string; status: string }>(`/api/admin/reports/${id}`, { method: 'PATCH', body: JSON.stringify(body) }),
    stats: () =>
      apiFetch<{ pending: number; accepted: number; rejected: number }>('/api/admin/stats'),
    federation: () =>
      apiFetch<FederationHealth>('/api/admin/federation'),
    auditLog: (limit?: number) =>
      apiFetch<{ logs: AuditLog[] }>(`/api/admin/audit-log${limit ? `?limit=${limit}` : ''}`),
    users: (q?: string) =>
      apiFetch<{ users: { id: string; handle: string; displayName: string | null; avatarUrl: string | null; role: 'user' | 'moderator' | 'admin'; createdAt: string }[] }>(`/api/admin/users${q ? `?q=${encodeURIComponent(q)}` : ''}`),
    setRole: (handle: string, role: 'user' | 'moderator' | 'admin') =>
      apiFetch<{ handle: string; role: string }>(`/api/admin/users/${handle}/role`, { method: 'PATCH', body: JSON.stringify({ role }) }),
    suspend: (handle: string) =>
      apiFetch<{ ok: boolean }>(`/api/admin/users/${handle}/suspend`, { method: 'POST' }),
    unsuspend: (handle: string) =>
      apiFetch<{ ok: boolean }>(`/api/admin/users/${handle}/suspend`, { method: 'DELETE' }),
    // Domain moderation
    suspendInstance: (domain: string) =>
      apiFetch<{ ok: boolean }>(`/api/admin/instances/${encodeURIComponent(domain)}/suspend`, { method: 'POST' }),
    unsuspendInstance: (domain: string) =>
      apiFetch<{ ok: boolean }>(`/api/admin/instances/${encodeURIComponent(domain)}/suspend`, { method: 'DELETE' }),
    // Relays
    relays: () =>
      apiFetch<{ relays: Relay[] }>('/api/admin/relays'),
    addRelay: (inboxUrl: string) =>
      apiFetch<{ relay: Relay }>('/api/admin/relays', { method: 'POST', body: JSON.stringify({ inboxUrl }) }),
    removeRelay: (id: string) =>
      apiFetch<{ ok: boolean }>(`/api/admin/relays/${id}`, { method: 'DELETE' }),
  },

  communities: {
    list: (params?: { q?: string; filter?: 'all' | 'joined'; limit?: number }) => {
      const qs = new URLSearchParams()
      if (params?.q) qs.set('q', params.q)
      if (params?.filter) qs.set('filter', params.filter)
      if (params?.limit) qs.set('limit', String(params.limit))
      const query = qs.toString()
      return apiFetch<{ communities: Community[]; next_cursor: string | null }>(
        `/api/communities${query ? `?${query}` : ''}`,
      )
    },
    get: (handle: string) => apiFetch<Community>(`/api/communities/${handle}`),
    create: (body: { handle: string; name: string; description?: string; visibility?: 'public' | 'restricted' | 'private'; rules?: string; color_index?: number; topics?: string }) =>
      apiFetch<Community>('/api/communities', { method: 'POST', body: JSON.stringify(body) }),
    update: (handle: string, body: { name?: string; description?: string; visibility?: 'public' | 'restricted' | 'private'; rules?: string; banner_url?: string | null; color_index?: number; topics?: string | null; post_templates?: PostTemplate[] | null; community_type?: CommunityType }) =>
      apiFetch<Community>(`/api/communities/${handle}`, { method: 'PATCH', body: JSON.stringify(body) }),
    delete: (handle: string) =>
      apiFetch<{ ok: boolean }>(`/api/communities/${handle}`, { method: 'DELETE' }),
    join: (handle: string) =>
      apiFetch<{ status: 'owner' | 'accepted' | 'pending' }>(`/api/communities/${handle}/join`, { method: 'POST' }),
    leave: (handle: string) =>
      apiFetch<{ ok: boolean }>(`/api/communities/${handle}/leave`, { method: 'POST' }),
    feed: (handle: string, cursor?: string, flairId?: string) => {
      const params = new URLSearchParams()
      if (cursor) params.set('cursor', cursor)
      if (flairId) params.set('flair', flairId)
      const qs = params.toString()
      return apiFetch<{ posts: Post[]; next_cursor: string | null }>(
        `/api/communities/${handle}/feed${qs ? `?${qs}` : ''}`,
      )
    },
    members: (handle: string) =>
      apiFetch<(Actor & { community_role: 'owner' | 'moderator' | 'member' })[]>(`/api/communities/${handle}/members`),
    pending: (handle: string) =>
      apiFetch<Actor[]>(`/api/communities/${handle}/pending`),
    approve: (handle: string, memberHandle: string) =>
      apiFetch<{ ok: boolean }>(`/api/communities/${handle}/members/${encodeURIComponent(memberHandle)}/approve`, { method: 'POST' }),
    reject: (handle: string, memberHandle: string) =>
      apiFetch<{ ok: boolean }>(`/api/communities/${handle}/members/${encodeURIComponent(memberHandle)}/reject`, { method: 'POST' }),
    ban: (handle: string, memberHandle: string) =>
      apiFetch<{ ok: boolean }>(`/api/communities/${handle}/members/${encodeURIComponent(memberHandle)}/ban`, { method: 'POST' }),
    promote: (handle: string, memberHandle: string) =>
      apiFetch<{ ok: boolean }>(`/api/communities/${handle}/members/${encodeURIComponent(memberHandle)}/promote`, { method: 'POST' }),
    demote: (handle: string, memberHandle: string) =>
      apiFetch<{ ok: boolean }>(`/api/communities/${handle}/members/${encodeURIComponent(memberHandle)}/demote`, { method: 'POST' }),
    wiki: (handle: string) =>
      apiFetch<{ content: string; version: number; editedAt: string | null; editedBy: { handle: string; displayName: string | null } | null }>(`/api/communities/${handle}/wiki`),
    updateWiki: (handle: string, content: string) =>
      apiFetch<{ content: string; version: number; editedAt: string; editedBy: { handle: string; displayName: string | null } }>(`/api/communities/${handle}/wiki`, { method: 'PUT', body: JSON.stringify({ content }) }),
    wikiHistory: (handle: string) =>
      apiFetch<Array<{ version: number; editedAt: string; editedBy: { handle: string; displayName: string | null }; contentPreview: string }>>(`/api/communities/${handle}/wiki/history`),
    pin: (handle: string, postId: string) =>
      apiFetch<{ ok: boolean }>(`/api/communities/${handle}/pin/${postId}`, { method: 'POST' }),
    unpin: (handle: string) =>
      apiFetch<{ ok: boolean }>(`/api/communities/${handle}/pin`, { method: 'DELETE' }),
    getInvite: (handle: string) =>
      apiFetch<{ token: string; url: string }>(`/api/communities/${handle}/invite`),
    revokeInvite: (handle: string) =>
      apiFetch<{ ok: boolean }>(`/api/communities/${handle}/invite`, { method: 'DELETE' }),
    joinByInvite: (token: string) =>
      apiFetch<{ status: string; handle: string }>('/api/communities/join-by-invite', { method: 'POST', body: JSON.stringify({ token }) }),
    modlog: (handle: string, limit = 50) =>
      apiFetch<{ items: ModlogEntry[]; hasMore: boolean }>(`/api/communities/${handle}/modlog?limit=${limit}`),
    badges: (handle: string) =>
      apiFetch<CommunityBadge[]>(`/api/communities/${handle}/badges`),
    createBadge: (handle: string, data: { name: string; icon: string; description?: string; color: string }) =>
      apiFetch<CommunityBadge>(`/api/communities/${handle}/badges`, { method: 'POST', body: JSON.stringify(data) }),
    deleteBadge: (handle: string, badgeId: string) =>
      apiFetch<{ ok: boolean }>(`/api/communities/${handle}/badges/${badgeId}`, { method: 'DELETE' }),
    memberTrust: (handle: string, memberHandle: string) =>
      apiFetch<MemberTrust>(`/api/communities/${handle}/members/${encodeURIComponent(memberHandle)}/trust`),
    awardBadge: (handle: string, memberHandle: string, badgeId: string, note?: string) =>
      apiFetch<{ ok: boolean }>(`/api/communities/${handle}/members/${encodeURIComponent(memberHandle)}/badges/${badgeId}`, { method: 'POST', body: JSON.stringify({ note }) }),
    revokeBadge: (handle: string, memberHandle: string, badgeId: string) =>
      apiFetch<{ ok: boolean }>(`/api/communities/${handle}/members/${encodeURIComponent(memberHandle)}/badges/${badgeId}`, { method: 'DELETE' }),
    flairs: (handle: string) =>
      apiFetch<CommunityFlair[]>(`/api/communities/${handle}/flairs`),
    createFlair: (handle: string, data: { name: string; emoji?: string; color: string; sortOrder?: number }) =>
      apiFetch<CommunityFlair>(`/api/communities/${handle}/flairs`, { method: 'POST', body: JSON.stringify(data) }),
    updateFlair: (handle: string, flairId: string, data: { name?: string; emoji?: string | null; color?: string; sortOrder?: number }) =>
      apiFetch<CommunityFlair>(`/api/communities/${handle}/flairs/${flairId}`, { method: 'PATCH', body: JSON.stringify(data) }),
    deleteFlair: (handle: string, flairId: string) =>
      apiFetch<{ ok: boolean }>(`/api/communities/${handle}/flairs/${flairId}`, { method: 'DELETE' }),
    resolveRemote: (handle: string) =>
      apiFetch<RemoteCommunityPreview>('/api/communities/resolve-remote', { method: 'POST', body: JSON.stringify({ handle }) }),
    followRemote: (actorId: string) =>
      apiFetch<{ status: string }>('/api/communities/follow-remote', { method: 'POST', body: JSON.stringify({ actorId }) }),
    unfollowRemote: (actorId: string) =>
      apiFetch<{ ok: boolean }>(`/api/communities/follow-remote/${actorId}`, { method: 'DELETE' }),
    followingRemote: () =>
      apiFetch<RemoteCommunity[]>('/api/communities/following-remote'),
    partnerships: (handle: string) =>
      apiFetch<Partnership[]>(`/api/communities/${handle}/partnerships`),
    proposePartnership: (handle: string, targetHandle: string) =>
      apiFetch<{ id: string; status: string }>(`/api/communities/${handle}/partnerships`, {
        method: 'POST', body: JSON.stringify({ targetHandle }),
      }),
    respondPartnership: (handle: string, partnershipId: string, action: 'accept' | 'reject') =>
      apiFetch<{ ok: boolean; status: string }>(`/api/communities/${handle}/partnerships/${partnershipId}`, {
        method: 'PATCH', body: JSON.stringify({ action }),
      }),
    dissolvePartnership: (handle: string, partnershipId: string) =>
      apiFetch<{ ok: boolean }>(`/api/communities/${handle}/partnerships/${partnershipId}`, { method: 'DELETE' }),
    alliedFeed: (handle: string, cursor?: string) =>
      apiFetch<{ posts: Post[]; next_cursor: string | null }>(
        `/api/communities/${handle}/allied-feed${cursor ? `?cursor=${encodeURIComponent(cursor)}` : ''}`,
      ),
    votes: (handle: string) =>
      apiFetch<ConfederationVote[]>(`/api/communities/${handle}/votes`),
    createVote: (handle: string, body: { title: string; description?: string; options: string[]; targetHandles: string[]; closesInHours: number }) =>
      apiFetch<{ id: string }>(`/api/communities/${handle}/votes`, { method: 'POST', body: JSON.stringify(body) }),
    castBallot: (handle: string, voteId: string, optionIndex: number) =>
      apiFetch<{ ok: boolean }>(`/api/communities/${handle}/votes/${voteId}/ballot`, { method: 'POST', body: JSON.stringify({ optionIndex }) }),
    deleteVote: (handle: string, voteId: string) =>
      apiFetch<{ ok: boolean }>(`/api/communities/${handle}/votes/${voteId}`, { method: 'DELETE' }),
    endorsement: (handle: string, actorHandle: string) =>
      apiFetch<Record<string, unknown>>(`/api/communities/${handle}/endorsements/${actorHandle}`),
  },
}
