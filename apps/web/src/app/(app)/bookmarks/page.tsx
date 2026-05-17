'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { Bookmark, Loader2, Plus, Pencil, Trash2, FolderOpen, Check, X, List, LayoutGrid } from 'lucide-react'
import { toast } from 'sonner'
import { EmptyState } from '@/components/ui/empty-state'
import { useSession } from '@/lib/auth-client'
import { api, type Post, type BookmarkCollection } from '@/lib/api'
import { PostCard } from '@/components/posts/post-card'
import { TimelineSkeleton } from '@/components/ui/skeleton'
import { useInfiniteScroll } from '@/hooks/use-infinite-scroll'
import { cn } from '@/lib/utils'

export default function BookmarksPage() {
  const { data: session, isPending } = useSession()
  const router = useRouter()

  const [collections, setCollections] = useState<BookmarkCollection[]>([])
  const [activeCollection, setActiveCollection] = useState<string | null>(null) // null = tüm kaydedilenler
  const [posts, setPosts] = useState<Post[]>([])
  const [nextCursor, setNextCursor] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [loadingMore, setLoadingMore] = useState(false)

  const [viewMode, setViewMode] = useState<'list' | 'grid'>('list')

  // New collection form state
  const [newColName, setNewColName] = useState('')
  const [creatingCol, setCreatingCol] = useState(false)
  const [showNewForm, setShowNewForm] = useState(false)

  // Rename state
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editingName, setEditingName] = useState('')

  const handle = (session?.user as { handle?: string } | undefined)?.handle

  const loadPosts = useCallback(async (cursor?: string, collectionId?: string | null) => {
    try {
      const data = await api.bookmarks.list(cursor, collectionId)
      if (cursor) setPosts((prev) => [...prev, ...data.posts])
      else setPosts(data.posts)
      setNextCursor(data.nextCursor)
    } catch (err) {
      const error = err as { status?: number }
      if (error.status === 401) router.push('/login')
    } finally {
      setLoading(false)
      setLoadingMore(false)
    }
  }, [router])

  useEffect(() => {
    if (!isPending && !session) { router.push('/login'); return }
    if (!session) return
    Promise.all([
      api.bookmarkCollections.list().then((d) => setCollections(d.collections)).catch(() => {}),
      loadPosts(undefined, null),
    ]).catch(() => {})
  }, [isPending, session, loadPosts])

  function switchCollection(colId: string | null) {
    setActiveCollection(colId)
    setLoading(true)
    setPosts([])
    setNextCursor(null)
    void loadPosts(undefined, colId)
  }

  const loadMore = useCallback(() => {
    if (!nextCursor || loadingMore) return
    setLoadingMore(true)
    void loadPosts(nextCursor, activeCollection)
  }, [nextCursor, loadingMore, loadPosts, activeCollection])

  const loadMoreRef = useInfiniteScroll(loadMore, !!nextCursor && !loadingMore)

  async function createCollection() {
    if (!newColName.trim()) return
    setCreatingCol(true)
    try {
      const col = await api.bookmarkCollections.create(newColName.trim())
      setCollections((prev) => [...prev, col])
      setNewColName('')
      setShowNewForm(false)
    } catch {
    } finally {
      setCreatingCol(false)
    }
  }

  async function renameCollection(id: string) {
    if (!editingName.trim()) return
    try {
      const updated = await api.bookmarkCollections.rename(id, editingName.trim())
      setCollections((prev) => prev.map((c) => c.id === id ? updated : c))
      setEditingId(null)
    } catch {
      toast.error('Koleksiyon adı değiştirilemedi.')
    }
  }

  async function deleteCollection(id: string) {
    try {
      await api.bookmarkCollections.delete(id)
      setCollections((prev) => prev.filter((c) => c.id !== id))
      if (activeCollection === id) switchCollection(null)
    } catch {}
  }

  function handleUnbookmark(id: string) {
    setPosts((prev) => prev.filter((p) => p.id !== id))
  }

  async function handleMoveToCollection(postId: string, collectionId: string | null) {
    try {
      await api.bookmarks.moveToCollection(postId, collectionId)
      // Remove from current view if filtered
      if (activeCollection !== null) {
        setPosts((prev) => prev.filter((p) => p.id !== postId))
      }
    } catch {}
  }

  if (isPending || loading) {
    return (
      <div className="max-w-xl mx-auto">
        <header className="sticky top-0 z-10 bg-(--color-background)/90 backdrop-blur-md border-b border-(--color-border) px-4 py-3.5">
          <h1 className="text-base font-bold text-(--color-text-primary)" style={{ fontFamily: 'var(--font-outfit)' }}>Kaydedilenler</h1>
        </header>
        <TimelineSkeleton count={5} />
      </div>
    )
  }

  return (
    <div className="max-w-xl mx-auto">
      <header className="sticky top-0 z-10 bg-(--color-background)/90 backdrop-blur-md border-b border-(--color-border) px-4 py-3.5">
        <div className="flex items-center justify-between">
          <div>
            <div className="flex items-center gap-2">
              <Bookmark className="w-5 h-5 text-(--color-coral)" />
              <h1 className="text-base font-bold text-(--color-text-primary)" style={{ fontFamily: 'var(--font-outfit)' }}>
                Kaydedilenler
              </h1>
            </div>
            {posts.length > 0 && (
              <p className="text-[11px] text-(--color-text-tertiary) mt-0.5 ml-7">
                {activeCollection
                  ? `${collections.find((c) => c.id === activeCollection)?.name ?? ''} · `
                  : ''}
                {posts.length}{nextCursor ? '+' : ''} gönderi
              </p>
            )}
          </div>
          <div className="flex items-center gap-0.5 p-0.5 rounded-lg bg-(--color-background-secondary)">
            <button
              onClick={() => setViewMode('list')}
              className={cn('p-1.5 rounded-md transition-colors', viewMode === 'list' ? 'bg-(--color-background) text-(--color-text-primary) shadow-sm' : 'text-(--color-text-tertiary) hover:text-(--color-text-secondary)')}
              title="Liste görünümü"
            >
              <List className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={() => setViewMode('grid')}
              className={cn('p-1.5 rounded-md transition-colors', viewMode === 'grid' ? 'bg-(--color-background) text-(--color-text-primary) shadow-sm' : 'text-(--color-text-tertiary) hover:text-(--color-text-secondary)')}
              title="Grid görünümü"
            >
              <LayoutGrid className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        {/* Collection tabs */}
        <div className="flex items-center gap-1 mt-3 overflow-x-auto pb-0.5 scrollbar-none">
          <button
            onClick={() => switchCollection(null)}
            className={cn(
              'flex-shrink-0 text-xs px-3 py-1.5 rounded-full font-medium transition-colors',
              activeCollection === null
                ? 'bg-(--color-coral) text-white'
                : 'bg-(--color-background-secondary) text-(--color-text-secondary) hover:text-(--color-text-primary)',
            )}
          >
            Tümü
          </button>

          {collections.map((col) => (
            <div key={col.id} className="flex-shrink-0 flex items-center gap-0.5 group">
              {editingId === col.id ? (
                <div className="flex items-center gap-1">
                  <input
                    autoFocus
                    value={editingName}
                    onChange={(e) => setEditingName(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') void renameCollection(col.id)
                      if (e.key === 'Escape') setEditingId(null)
                    }}
                    className="text-xs px-2 py-1 rounded-lg border border-(--color-border) bg-(--color-background) w-28 outline-none focus:border-(--color-coral)"
                  />
                  <button onClick={() => void renameCollection(col.id)} className="text-green-500 hover:text-green-400">
                    <Check className="w-3 h-3" />
                  </button>
                  <button onClick={() => setEditingId(null)} className="text-(--color-text-tertiary) hover:text-(--color-text-primary)">
                    <X className="w-3 h-3" />
                  </button>
                </div>
              ) : (
                <>
                  <button
                    onClick={() => switchCollection(col.id)}
                    className={cn(
                      'text-xs px-3 py-1.5 rounded-full font-medium transition-colors',
                      activeCollection === col.id
                        ? 'bg-(--color-coral) text-white'
                        : 'bg-(--color-background-secondary) text-(--color-text-secondary) hover:text-(--color-text-primary)',
                    )}
                  >
                    {col.name}
                  </button>
                  <div className="hidden group-hover:flex items-center gap-0.5 ml-0.5">
                    <button
                      onClick={() => { setEditingId(col.id); setEditingName(col.name) }}
                      className="p-0.5 rounded text-(--color-text-tertiary) hover:text-(--color-text-primary)"
                    >
                      <Pencil className="w-2.5 h-2.5" />
                    </button>
                    <button
                      onClick={() => void deleteCollection(col.id)}
                      className="p-0.5 rounded text-(--color-text-tertiary) hover:text-red-500"
                    >
                      <Trash2 className="w-2.5 h-2.5" />
                    </button>
                  </div>
                </>
              )}
            </div>
          ))}

          {/* New collection button */}
          {showNewForm ? (
            <div className="flex-shrink-0 flex items-center gap-1">
              <input
                autoFocus
                value={newColName}
                onChange={(e) => setNewColName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') void createCollection()
                  if (e.key === 'Escape') { setShowNewForm(false); setNewColName('') }
                }}
                placeholder="Koleksiyon adı"
                maxLength={50}
                className="text-xs px-2 py-1 rounded-lg border border-(--color-border) bg-(--color-background) w-32 outline-none focus:border-(--color-coral)"
              />
              <button
                onClick={() => void createCollection()}
                disabled={creatingCol || !newColName.trim()}
                className="text-xs px-2 py-1 rounded-full bg-(--color-coral) text-white disabled:opacity-50"
              >
                {creatingCol ? <Loader2 className="w-3 h-3 animate-spin" /> : 'Oluştur'}
              </button>
              <button onClick={() => { setShowNewForm(false); setNewColName('') }} className="text-(--color-text-tertiary)">
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          ) : (
            <button
              onClick={() => setShowNewForm(true)}
              className="flex-shrink-0 flex items-center gap-1 text-xs px-2.5 py-1.5 rounded-full bg-(--color-background-secondary) text-(--color-text-tertiary) hover:text-(--color-text-primary) transition-colors"
            >
              <Plus className="w-3 h-3" />
              Yeni
            </button>
          )}
        </div>
      </header>

      {posts.length === 0 ? (
        <EmptyState
          icon={activeCollection ? FolderOpen : Bookmark}
          title={activeCollection ? 'Koleksiyon boş' : 'Henüz kayıt yok'}
          description={activeCollection
            ? 'Bu koleksiyona gönderi taşımak için gönderi üzerindeki klasör ikonunu kullan.'
            : 'Beğendiğin gönderileri kaydet, koleksiyonlara ayır — hepsi burada.'}
        />
      ) : viewMode === 'grid' ? (
        <>
          <div className="grid grid-cols-2 gap-px bg-(--color-border) mt-px">
            {posts.map((post) => (
              <BookmarkGridCard
                key={post.id}
                post={post}
                collections={collections}
                activeCollection={activeCollection}
                onUnbookmark={handleUnbookmark}
                onMoveToCollection={handleMoveToCollection}
              />
            ))}
          </div>
          {loadingMore && <div className="py-6 flex justify-center"><Loader2 className="w-5 h-5 animate-spin text-(--color-coral)" /></div>}
          <div ref={loadMoreRef} className="h-1" />
        </>
      ) : (
        <>
          {posts.map((post) => (
            <BookmarkedPostCard
              key={post.id}
              post={post}
              currentActorHandle={handle}
              collections={collections}
              activeCollection={activeCollection}
              onUnbookmark={handleUnbookmark}
              onMoveToCollection={handleMoveToCollection}
            />
          ))}
          {loadingMore && <div className="py-6 flex justify-center"><Loader2 className="w-5 h-5 animate-spin text-(--color-coral)" /></div>}
          <div ref={loadMoreRef} className="h-1" />
        </>
      )}
    </div>
  )
}

function BookmarkGridCard({
  post,
  collections,
  activeCollection,
  onUnbookmark,
  onMoveToCollection,
}: {
  post: Post
  collections: BookmarkCollection[]
  activeCollection: string | null
  onUnbookmark: (id: string) => void
  onMoveToCollection: (postId: string, collectionId: string | null) => void
}) {
  const [menuOpen, setMenuOpen] = useState(false)
  const firstImage = post.media?.find((m) => m.mimeType?.startsWith('image/'))

  async function handleUnbookmark(e: React.MouseEvent) {
    e.preventDefault()
    try {
      await api.posts.unbookmark(post.id)
      onUnbookmark(post.id)
    } catch {}
  }

  return (
    <a
      href={`/posts/${post.id}`}
      className="relative bg-(--color-background) group flex flex-col min-h-[120px] p-3 hover:bg-(--color-background-secondary) transition-colors"
    >
      {firstImage ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={firstImage.url} alt={firstImage.altText ?? ''} className="w-full h-28 object-cover rounded-lg mb-2" loading="lazy" />
      ) : null}
      <div className="flex items-center gap-1.5 mb-1">
        <span className="text-[10px] font-semibold text-(--color-text-tertiary) truncate">
          {post.author?.displayName ?? post.author?.handle ?? ''}
        </span>
      </div>
      <p className="text-xs text-(--color-text-primary) leading-relaxed line-clamp-3 flex-1">
        {post.contentWarning ? <span className="text-(--color-text-tertiary) italic">{post.contentWarning}</span> : post.content}
      </p>
      {(post.likesCount > 0 || post.repliesCount > 0) && (
        <div className="flex items-center gap-2 mt-2">
          {post.likesCount > 0 && <span className="text-[10px] text-(--color-text-tertiary)">{post.likesCount} ♥</span>}
          {post.repliesCount > 0 && <span className="text-[10px] text-(--color-text-tertiary)">{post.repliesCount} ↩</span>}
        </div>
      )}

      {/* Hover actions */}
      <div className="absolute top-2 right-2 flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
        {collections.length > 0 && (
          <div className="relative">
            <button
              onClick={(e) => { e.preventDefault(); setMenuOpen((v) => !v) }}
              className="p-1 rounded-md bg-(--color-background) border border-(--color-border-secondary) text-(--color-text-tertiary) hover:text-(--color-coral) transition-colors"
            >
              <FolderOpen className="w-3 h-3" />
            </button>
            {menuOpen && (
              <div
                className="absolute right-0 top-full mt-1 z-20 min-w-[130px] rounded-xl border border-(--color-border) bg-(--color-background) shadow-lg py-1"
                onMouseLeave={() => setMenuOpen(false)}
              >
                <button
                  onClick={(e) => { e.preventDefault(); onMoveToCollection(post.id, null); setMenuOpen(false) }}
                  className={cn('w-full text-left px-3 py-1.5 text-xs transition-colors', activeCollection === null ? 'text-(--color-coral) font-medium' : 'text-(--color-text-secondary) hover:bg-(--color-background-secondary)')}
                >
                  Koleksiyonsuz
                </button>
                {collections.map((col) => (
                  <button
                    key={col.id}
                    onClick={(e) => { e.preventDefault(); onMoveToCollection(post.id, col.id); setMenuOpen(false) }}
                    className={cn('w-full text-left px-3 py-1.5 text-xs transition-colors', activeCollection === col.id ? 'text-(--color-coral) font-medium' : 'text-(--color-text-secondary) hover:bg-(--color-background-secondary)')}
                  >
                    {col.name}
                  </button>
                ))}
              </div>
            )}
          </div>
        )}
        <button
          onClick={handleUnbookmark}
          className="p-1 rounded-md bg-(--color-background) border border-(--color-border-secondary) text-(--color-text-tertiary) hover:text-red-500 transition-colors"
        >
          <Bookmark className="w-3 h-3 fill-current" />
        </button>
      </div>
    </a>
  )
}

function BookmarkedPostCard({
  post,
  currentActorHandle,
  collections,
  activeCollection,
  onUnbookmark,
  onMoveToCollection,
}: {
  post: Post
  currentActorHandle?: string
  collections: BookmarkCollection[]
  activeCollection: string | null
  onUnbookmark: (id: string) => void
  onMoveToCollection: (postId: string, collectionId: string | null) => void
}) {
  const [menuOpen, setMenuOpen] = useState(false)

  async function handleUnbookmark() {
    try {
      await api.posts.unbookmark(post.id)
      onUnbookmark(post.id)
    } catch {}
  }

  return (
    <div className="relative group">
      <PostCard post={post} currentActorHandle={currentActorHandle} />

      {/* Hover action buttons */}
      <div className="absolute top-3 right-3 flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-all">
        {/* Move to collection button */}
        {collections.length > 0 && (
          <div className="relative">
            <button
              onClick={() => setMenuOpen((v) => !v)}
              title="Koleksiyona taşı"
              className="p-1.5 rounded-lg bg-(--color-background)/80 border border-(--color-border-secondary) text-(--color-text-tertiary) hover:text-(--color-coral) hover:border-(--color-coral)/30 transition-all"
            >
              <FolderOpen className="w-3.5 h-3.5" />
            </button>
            {menuOpen && (
              <div
                className="absolute right-0 top-full mt-1 z-20 min-w-[140px] rounded-xl border border-(--color-border) bg-(--color-background) shadow-lg py-1"
                onMouseLeave={() => setMenuOpen(false)}
              >
                <button
                  onClick={() => { onMoveToCollection(post.id, null); setMenuOpen(false) }}
                  className={cn(
                    'w-full text-left px-3 py-1.5 text-xs transition-colors',
                    activeCollection === null
                      ? 'text-(--color-coral) font-medium'
                      : 'text-(--color-text-secondary) hover:bg-(--color-background-secondary)',
                  )}
                >
                  Koleksiyonsuz
                </button>
                {collections.map((col) => (
                  <button
                    key={col.id}
                    onClick={() => { onMoveToCollection(post.id, col.id); setMenuOpen(false) }}
                    className={cn(
                      'w-full text-left px-3 py-1.5 text-xs transition-colors',
                      activeCollection === col.id
                        ? 'text-(--color-coral) font-medium'
                        : 'text-(--color-text-secondary) hover:bg-(--color-background-secondary)',
                    )}
                  >
                    {col.name}
                  </button>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Remove bookmark */}
        <button
          onClick={handleUnbookmark}
          title="Kaydı kaldır"
          className="p-1.5 rounded-lg bg-(--color-background)/80 border border-(--color-border-secondary) text-(--color-text-tertiary) hover:text-red-500 hover:border-red-300 transition-all"
        >
          <Bookmark className="w-3.5 h-3.5 fill-current" />
        </button>
      </div>
    </div>
  )
}
