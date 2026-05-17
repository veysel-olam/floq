export type PostVisibility = 'public' | 'unlisted' | 'followers' | 'direct'

export interface MediaAttachment {
  id: string
  url: string
  previewUrl: string | null
  mimeType: string
  altText: string | null
  width: number | null
  height: number | null
  blurhash: string | null
}

export interface Post {
  id: string
  apId: string           // canonical AP URL
  authorId: string       // actor.id
  content: string
  contentWarning: string | null
  visibility: PostVisibility
  language: string | null
  sensitive: boolean
  replyToId: string | null
  rootId: string | null   // thread root
  media: MediaAttachment[]
  likesCount: number
  boostsCount: number
  repliesCount: number
  isLocal: boolean
  createdAt: Date
  editedAt: Date | null
}
