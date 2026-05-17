'use client'

import { useState, useEffect, use } from 'react'
import { useRouter } from 'next/navigation'
import { ArrowLeft, FolderOpen, Loader2, Trash2 } from 'lucide-react'
import { useSession } from '@/lib/auth-client'
import { api, type Post, type PostCollection } from '@/lib/api'
import { PostCard } from '@/components/posts/post-card'
import { EmptyState } from '@/components/ui/empty-state'
import { toast } from 'sonner'

export default function CollectionPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  const { data: session } = useSession()
  const router = useRouter()

  const [collection, setCollection] = useState<PostCollection | null>(null)
  const [posts, setPosts] = useState<Post[]>([])
  const [loading, setLoading] = useState(true)

  const currentHandle = (session?.user as { handle?: string } | undefined)?.handle

  useEffect(() => {
    async function load() {
      try {
        const data = await api.postCollections.getPosts(id)
        setCollection(data.collection)
        setPosts(data.posts)
      } catch {
        router.replace('/home')
      } finally {
        setLoading(false)
      }
    }
    void load()
  }, [id, router])

  async function removePost(postId: string) {
    if (!collection) return
    try {
      await api.postCollections.removePost(collection.id, postId)
      setPosts((prev) => prev.filter((p) => p.id !== postId))
      toast.success('Koleksiyondan kaldırıldı')
    } catch {
      toast.error('Kaldırılamadı')
    }
  }

  const isOwn = collection && currentHandle
    ? (session?.user as { id?: string } | undefined)?.id === collection.actorId
    : false

  if (loading) {
    return (
      <div className="flex justify-center py-20">
        <Loader2 className="w-6 h-6 animate-spin text-(--color-coral)" />
      </div>
    )
  }

  if (!collection) return null

  return (
    <div className="max-w-xl mx-auto">
      {/* Header */}
      <div className="sticky top-0 z-10 bg-(--color-background)/90 backdrop-blur-md border-b border-(--color-border-secondary)">
        <div className="flex items-center gap-3 px-4 py-3.5">
          <button
            onClick={() => router.back()}
            className="p-1.5 rounded-full hover:bg-(--color-background-secondary) text-(--color-text-secondary) transition-colors"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <FolderOpen className="w-5 h-5 text-(--color-coral)" />
          <div className="min-w-0">
            <h1 className="text-base font-bold text-(--color-text-primary) truncate" style={{ fontFamily: 'var(--font-display)' }}>
              {collection.name}
            </h1>
            {collection.description && (
              <p className="text-xs text-(--color-text-tertiary) truncate">{collection.description}</p>
            )}
          </div>
          <span className="ml-auto text-xs text-(--color-text-tertiary) shrink-0">{posts.length} gönderi</span>
        </div>
      </div>

      {posts.length === 0 ? (
        <EmptyState
          icon={FolderOpen}
          title="Koleksiyon boş"
          description="Gönderilerin ⋯ menüsünden bu koleksiyona ekleyebilirsin."
        />
      ) : (
        posts.map((post) => (
          <div key={post.id} className="relative group">
            <PostCard post={post} currentActorHandle={currentHandle} />
            {isOwn && (
              <button
                onClick={() => void removePost(post.id)}
                className="absolute top-3 right-12 opacity-0 group-hover:opacity-100 p-1.5 rounded-full bg-(--color-background-secondary) hover:bg-red-500/10 text-(--color-text-tertiary) hover:text-red-500 transition-all z-10"
                title="Koleksiyondan kaldır"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        ))
      )}
    </div>
  )
}
