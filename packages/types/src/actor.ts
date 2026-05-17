export type ActorType = 'Person' | 'Service' | 'Organization' | 'Group'

export type ActorVisibility = 'public' | 'unlisted' | 'followers' | 'direct'

export interface Actor {
  id: string
  apId: string          // canonical AP URL (e.g. https://floq.com/users/veysel)
  handle: string        // local handle or alice@mastodon.social
  displayName: string | null
  bio: string | null
  avatarUrl: string | null
  headerUrl: string | null
  isLocal: boolean
  isBot: boolean
  followersCount: number
  followingCount: number
  postsCount: number
  createdAt: Date
}

export interface LocalActor extends Actor {
  isLocal: true
  email: string
  emailVerified: boolean
}

export interface RemoteActor extends Actor {
  isLocal: false
  inboxUrl: string
  sharedInboxUrl: string | null
  instanceDomain: string
  lastFetchedAt: Date
}
