'use client'

import { useEffect, useState } from 'react'
import { api, type Post } from '@/lib/api'
import { Loader2, FileEdit, Trash2, Send } from 'lucide-react'
import { EmptyState } from '@/components/ui/empty-state'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'
import Link from 'next/link'

export default function DraftsPage() {
  const [posts, setPosts] = useState<Post[]>([])
  const [loading, setLoading] = useState(true)
  const [acting, setActing] = useState<string | null>(null)

  useEffect(() => {
    api.posts.drafts()
      .then((d) => setPosts(d.posts))
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  async function publish(id: string) {
    setActing(id)
    try {
      await api.posts.publishDraft(id)
      setPosts((prev) => prev.filter((p) => p.id !== id))
      toast.success('Taslak yayınlandı.')
    } catch {
      toast.error('Yayınlanamadı.')
    } finally {
      setActing(null)
    }
  }

  async function remove(id: string) {
    setActing(id)
    try {
      await api.posts.deleteDraft(id)
      setPosts((prev) => prev.filter((p) => p.id !== id))
    } catch {
      toast.error('Silinemedi.')
    } finally {
      setActing(null)
    }
  }

  return (
    <div className="max-w-xl mx-auto">
      <header className="sticky top-0 z-10 bg-(--color-background)/90 backdrop-blur-md border-b border-(--color-border) px-4 py-3.5">
        <div className="flex items-center gap-2">
          <FileEdit className="w-5 h-5 text-(--color-coral)" />
          <h1 className="text-base font-bold text-(--color-text-primary)" style={{ fontFamily: 'var(--font-outfit)' }}>
            Taslaklar
          </h1>
          {posts.length > 0 && (
            <span className="min-w-[20px] h-5 px-1.5 rounded-full bg-(--color-coral) text-white text-[11px] font-bold flex items-center justify-center tabular-nums">
              {posts.length}
            </span>
          )}
        </div>
        <p className="text-xs text-(--color-text-tertiary) mt-0.5">Kayıtlı ama yayınlanmamış gönderilerin</p>
      </header>

      {loading ? (
        <div className="flex items-center justify-center py-32">
          <Loader2 className="w-5 h-5 animate-spin text-(--color-coral)" />
        </div>
      ) : posts.length === 0 ? (
        <EmptyState
          icon={FileEdit}
          title="Taslak yok"
          description="Composer'da 'Taslak Kaydet' seçeneğiyle gönderini kaydet."
        />
      ) : (
        <div className="divide-y divide-(--color-border-secondary)">
          {posts.map((post) => (
            <div key={post.id} className="px-4 py-4 group hover:bg-(--color-background-secondary)/40 transition-colors">
              <div className="flex gap-3">
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-(--color-text-primary) leading-relaxed line-clamp-4 whitespace-pre-wrap break-words">
                    {post.content || '(medya)'}
                  </p>
                  <div className="flex items-center gap-2 mt-2 text-xs text-(--color-text-tertiary)">
                    <span>{new Date(post.createdAt).toLocaleString('tr-TR', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}</span>
                    {post.visibility !== 'public' && (
                      <span className="px-1.5 py-0.5 rounded-full bg-(--color-background-secondary) border border-(--color-border-secondary)">
                        {post.visibility === 'followers' ? '👥 Takipçiler' : post.visibility === 'unlisted' ? '🔗 Listesiz' : post.visibility}
                      </span>
                    )}
                  </div>
                </div>
                <div className={cn('flex gap-1.5 flex-shrink-0 items-start pt-0.5 opacity-0 group-hover:opacity-100 transition-opacity')}>
                  <button
                    onClick={() => void publish(post.id)}
                    disabled={acting === post.id}
                    title="Yayınla"
                    className="p-1.5 rounded-lg bg-(--color-coral)/10 text-(--color-coral) hover:bg-(--color-coral)/20 transition-colors disabled:opacity-50"
                  >
                    {acting === post.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5" />}
                  </button>
                  <button
                    onClick={() => void remove(post.id)}
                    disabled={acting === post.id}
                    title="Sil"
                    className="p-1.5 rounded-lg text-(--color-text-tertiary) hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-950/20 transition-colors disabled:opacity-50"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
