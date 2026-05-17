// ActivityStreams 2.0 + ActivityPub core types

export type APContext = string | string[] | Record<string, unknown>

export type APActivityType =
  | 'Create'
  | 'Update'
  | 'Delete'
  | 'Follow'
  | 'Accept'
  | 'Reject'
  | 'Undo'
  | 'Like'
  | 'Announce'
  | 'Move'
  | 'Block'
  | 'Flag'

export type APObjectType = 'Note' | 'Article' | 'Person' | 'Service' | 'Tombstone'

export interface APObject {
  '@context'?: APContext
  id: string
  type: APObjectType | APActivityType
}

export interface APActor extends APObject {
  type: 'Person' | 'Service'
  preferredUsername: string
  name?: string
  summary?: string
  url?: string
  inbox: string
  outbox: string
  followers: string
  following: string
  endpoints?: {
    sharedInbox?: string
  }
  publicKey: {
    id: string
    owner: string
    publicKeyPem: string
  }
  icon?: APImage
  image?: APImage
  manuallyApprovesFollowers?: boolean
}

export interface APNote extends APObject {
  type: 'Note'
  attributedTo: string
  content: string
  published: string
  to: string[]
  cc: string[]
  inReplyTo?: string | null
  sensitive?: boolean
  summary?: string | null
  attachment?: APAttachment[]
  tag?: APTag[]
  url?: string
}

export interface APActivity extends APObject {
  type: APActivityType
  actor: string
  object: string | APObject
  target?: string
  published?: string
  to?: string[]
  cc?: string[]
}

export interface APImage {
  type: 'Image'
  mediaType?: string
  url: string
}

export interface APAttachment {
  type: 'Document' | 'Image' | 'Video' | 'Audio'
  mediaType: string
  url: string
  name?: string
  width?: number
  height?: number
  blurhash?: string
}

export interface APTag {
  type: 'Mention' | 'Hashtag' | 'Emoji'
  href?: string
  name: string
}

// HTTP Signature header
export interface APSignatureHeader {
  keyId: string
  algorithm: string
  headers: string
  signature: string
}
