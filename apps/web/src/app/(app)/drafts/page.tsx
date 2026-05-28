'use client'

import { useEffect, useState, Suspense } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import { api, type Post } from '@/lib/api'
import { PostCard } from '@/components/posts/post-card'
import { Loader2, FileEdit, Trash2, Send, Clock, CalendarClock } from 'lucide-react'
import { EmptyState } from '@/components/ui/empty-state'
import { TimelineSkeleton } from '@/components/ui/skeleton'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'

// --- Scheduled helpers ---

function getScheduleGroup(scheduledAt: string): string {
  const now = new Date()
  const d = new Date(scheduledAt)
  const diffH = (d.getTime() - now.getTime()) / 3_600_000
  if (diffH < 24) return 'Bugün'
  if (diffH < 48) return 'Yarın'
  if (diffH < 7 * 24) return 'Bu Hafta'
  if (diffH < 30 * 24) return 'Bu Ay'
  return 'Daha Sonra'
}

const GROUP_ORDER = ['Bugün', 'Yarın', 'Bu Hafta', 'Bu Ay', 'Daha Sonra']

const GROUP_COLORS: Record<string, string> = {
  'Bugün':      'text-amber-600 dark:text-amber-400 bg-amber-500/10 border-amber-500/20',
  'Yarın':      'text-orange-500 bg-orange-500/10 border-orange-500/20',
  'Bu Hafta':   'text-(--color-coral) bg-(--color-coral)/8 border-(--color-coral)/20',
  'Bu Ay':      'text-blue-500 bg-blue-500/8 border-blue-500/20',
  'Daha Sonra': 'text-(--color-text-tertiary) bg-(--color-background-secondary) border-(--color-border)',
}

function formatScheduledAt(scheduledAt: string): string {
  const d = new Date(scheduledAt)
  const now = new Date()
  const isToday = d.toDateString() === now.toDateString()
  const isTomorrow = d.toDateString() === new Date(Date.now() + 86_400_000).toDateString()
  const time = d.toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' })
  if (isToday) return `Bugün · ${time}`
  if (isTomorrow) return `Yarın · ${time}`
  return d.toLocaleString('tr-TR', { weekday: 'long', day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit' })
}

function groupPosts(posts: Post[]) {
  const map = new Map<string, Post[]>()
  for (const post of posts) {
    const group = getScheduleGroup(post.scheduledAt!)
    if (!map.has(group)) map.set(group, [])
    map.get(group)!.push(post)
  }
  return GROUP_ORDER.filter((g) => map.has(g)).map((g) => ({ label: g, posts: map.get(g)! }))
}

// --- Tabs ---

type Tab = 'drafts' | 'scheduled'

function DraftsPageContent() {
  const searchParams = useSearchParams()
  const router = useRouter()
  const tab = (searchParams.get('tab') === 'scheduled' ? 'scheduled' : 'drafts') as Tab

  const [drafts, setDrafts] = useState<Post[]>([])
  const [scheduled, setScheduled] = useState<Post[]>([])
  const [loadingDrafts, setLoadingDrafts] = useState(true)
  const [loadingScheduled, setLoadingScheduled] = useState(true)
  const [acting, setActing] = useState<string | null>(null)

  useEffect(() => {
    api.posts.drafts()
      .then((d) => setDrafts(d.posts))
      .catch(() => {})
      .finally(() => setLoadingDrafts(false))
    api.posts.scheduled()
      .then((d) => setScheduled(d.posts))
      .catch(() => {})
      .finally(() => setLoadingScheduled(false))
  }, [])

  function setTab(t: Tab) {
    router.replace(`/drafts${t === 'scheduled' ? '?tab=scheduled' : ''}`, { scroll: false })
  }

  async function publishDraft(id: string) {
    setActing(id)
    try {
      await api.posts.publishDraft(id)
      setDrafts((prev) => prev.filter((p) => p.id !== id))
      toast.success('Taslak yayınlandı.')
    } catch {
      toast.error('Yayınlanamadı.')
    } finally {
      setActing(null)
    }
  }

  async function deleteDraft(id: string) {
    setActing(id)
    try {
      await api.posts.deleteDraft(id)
      setDrafts((prev) => prev.filter((p) => p.id !== id))
    } catch {
      toast.error('Silinemedi.')
    } finally {
      setActing(null)
    }
  }

  async function cancelScheduled(id: string) {
    setActing(id)
    try {
      await api.posts.cancelScheduled(id)
      setScheduled((prev) => prev.filter((p) => p.id !== id))
    } catch {
    } finally {
      setActing(null)
    }
  }

  const nextPost = scheduled.length > 0
    ? scheduled.reduce((a, b) => new Date(a.scheduledAt!) < new Date(b.scheduledAt!) ? a : b)
    : null

  const groups = groupPosts(scheduled)

  return (
    <div className="max-w-xl mx-auto">
      {/* Header */}
      <header className="sticky top-0 z-10 bg-(--color-background)/90 backdrop-blur-md border-b border-(--color-border)">
        <div className="flex items-center gap-2 px-4 pt-3.5 pb-3">
          <FileEdit className="w-5 h-5 text-(--color-coral)" />
          <h1 className="text-base font-bold text-(--color-text-primary)" style={{ fontFamily: 'var(--font-outfit)' }}>
            Taslaklar
          </h1>
        </div>

        {/* Tabs */}
        <div className="flex px-4 gap-1">
          {([
            { id: 'drafts' as Tab, label: 'Taslaklar', count: drafts.length },
            { id: 'scheduled' as Tab, label: 'Zamanlanmış', count: scheduled.length },
          ] as const).map(({ id, label, count }) => (
            <button
              key={id}
              onClick={() => setTab(id)}
              className={cn(
                'relative pb-3 px-1 text-sm font-medium transition-colors',
                tab === id
                  ? 'text-(--color-text-primary)'
                  : 'text-(--color-text-tertiary) hover:text-(--color-text-secondary)',
              )}
            >
              <span className="flex items-center gap-1.5">
                {label}
                {count > 0 && (
                  <span className={cn(
                    'min-w-[18px] h-[18px] px-1 rounded-full text-[10px] font-bold flex items-center justify-center tabular-nums',
                    tab === id
                      ? 'bg-(--color-coral) text-white'
                      : 'bg-(--color-background-secondary) text-(--color-text-tertiary)',
                  )}>
                    {count}
                  </span>
                )}
              </span>
              {tab === id && (
                <span className="absolute bottom-0 left-0 right-0 h-0.5 rounded-full bg-(--color-coral)" />
              )}
            </button>
          ))}
        </div>
      </header>

      {/* Drafts tab */}
      {tab === 'drafts' && (
        loadingDrafts ? (
          <div className="flex items-center justify-center py-32">
            <Loader2 className="w-5 h-5 animate-spin text-(--color-coral)" />
          </div>
        ) : drafts.length === 0 ? (
          <EmptyState
            icon={FileEdit}
            title="Taslak yok"
            description="Composer'da 'Taslak Kaydet' seçeneğiyle gönderini kaydet."
          />
        ) : (
          <div className="divide-y divide-(--color-border-secondary)">
            {drafts.map((post) => (
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
                  <div className="flex gap-1.5 flex-shrink-0 items-start pt-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button
                      onClick={() => void publishDraft(post.id)}
                      disabled={acting === post.id}
                      title="Yayınla"
                      className="p-1.5 rounded-lg bg-(--color-coral)/10 text-(--color-coral) hover:bg-(--color-coral)/20 transition-colors disabled:opacity-50"
                    >
                      {acting === post.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5" />}
                    </button>
                    <button
                      onClick={() => void deleteDraft(post.id)}
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
        )
      )}

      {/* Scheduled tab */}
      {tab === 'scheduled' && (
        loadingScheduled ? (
          <TimelineSkeleton count={3} />
        ) : scheduled.length === 0 ? (
          <EmptyState
            icon={CalendarClock}
            title="Zamanlanmış gönderi yok"
            description="Gönderi oluştururken ileri tarih seçerek otomatik yayın zamanlayabilirsin."
          />
        ) : (
          <div>
            {nextPost && (
              <div className="flex items-center gap-2 px-4 py-2.5 border-b border-(--color-border-secondary) bg-(--color-background-secondary)/20">
                <Clock className="w-3.5 h-3.5 text-(--color-coral)" />
                <span className="text-xs text-(--color-text-tertiary)">
                  Sıradaki: <span className="font-medium text-(--color-text-secondary)">{formatScheduledAt(nextPost.scheduledAt!)}</span>
                </span>
              </div>
            )}
            {groups.map((group) => (
              <div key={group.label}>
                <div className="flex items-center gap-2 px-4 py-2.5 border-b border-(--color-border-secondary) bg-(--color-background-secondary)/30">
                  <span className={cn('text-[11px] font-semibold px-2 py-0.5 rounded-full border', GROUP_COLORS[group.label])}>
                    {group.label}
                  </span>
                  <span className="text-[11px] text-(--color-text-tertiary)">{group.posts.length} gönderi</span>
                </div>
                {group.posts.map((post) => (
                  <div key={post.id} className="border-b border-(--color-border-secondary) last:border-b-0">
                    <div className="flex items-center justify-between px-4 py-2 bg-(--color-background-secondary)/20">
                      <div className="flex items-center gap-1.5">
                        <Clock className="w-3 h-3 text-(--color-coral)" />
                        <span className="text-xs font-medium text-(--color-text-secondary)">{formatScheduledAt(post.scheduledAt!)}</span>
                      </div>
                      <button
                        onClick={() => void cancelScheduled(post.id)}
                        disabled={acting === post.id}
                        className="flex items-center gap-1 text-xs text-(--color-text-tertiary) hover:text-red-500 transition-colors disabled:opacity-40 px-2 py-0.5 rounded-full hover:bg-red-50 dark:hover:bg-red-950/20"
                      >
                        {acting === post.id ? <Loader2 className="w-3 h-3 animate-spin" /> : <Trash2 className="w-3 h-3" />}
                        <span>İptal</span>
                      </button>
                    </div>
                    <PostCard post={post} />
                  </div>
                ))}
              </div>
            ))}
          </div>
        )
      )}
    </div>
  )
}

export default function DraftsPage() {
  return (
    <Suspense>
      <DraftsPageContent />
    </Suspense>
  )
}
