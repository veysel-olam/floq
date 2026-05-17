'use client'

import { useEffect, useState } from 'react'
import { api, type Post } from '@/lib/api'
import { PostCard } from '@/components/posts/post-card'
import { Loader2, Clock, Trash2, CalendarClock } from 'lucide-react'
import { EmptyState } from '@/components/ui/empty-state'
import { TimelineSkeleton } from '@/components/ui/skeleton'
import { cn } from '@/lib/utils'

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

function formatScheduledAt(scheduledAt: string): string {
  const d = new Date(scheduledAt)
  const now = new Date()
  const isToday = d.toDateString() === now.toDateString()
  const isTomorrow = d.toDateString() === new Date(Date.now() + 86_400_000).toDateString()

  const time = d.toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' })

  if (isToday) return `Bugün · ${time}`
  if (isTomorrow) return `Yarın · ${time}`
  return d.toLocaleString('tr-TR', {
    weekday: 'long', day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit',
  })
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

const GROUP_COLORS: Record<string, string> = {
  'Bugün':     'text-amber-600 dark:text-amber-400 bg-amber-500/10 border-amber-500/20',
  'Yarın':     'text-orange-500 bg-orange-500/10 border-orange-500/20',
  'Bu Hafta':  'text-(--color-coral) bg-(--color-coral)/8 border-(--color-coral)/20',
  'Bu Ay':     'text-blue-500 bg-blue-500/8 border-blue-500/20',
  'Daha Sonra':'text-(--color-text-tertiary) bg-(--color-background-secondary) border-(--color-border)',
}

export default function ScheduledPage() {
  const [posts, setPosts] = useState<Post[]>([])
  const [loading, setLoading] = useState(true)
  const [cancelling, setCancelling] = useState<string | null>(null)

  useEffect(() => {
    api.posts.scheduled()
      .then((d) => setPosts(d.posts))
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  async function handleCancel(id: string) {
    setCancelling(id)
    try {
      await api.posts.cancelScheduled(id)
      setPosts((prev) => prev.filter((p) => p.id !== id))
    } catch {
    } finally {
      setCancelling(null)
    }
  }

  const nextPost = posts.length > 0
    ? posts.reduce((a, b) => new Date(a.scheduledAt!) < new Date(b.scheduledAt!) ? a : b)
    : null

  const groups = groupPosts(posts)

  return (
    <div className="max-w-xl mx-auto">
      <header className="sticky top-0 z-10 bg-(--color-background)/90 backdrop-blur-md border-b border-(--color-border) px-4 py-3.5">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Clock className="w-5 h-5 text-(--color-coral)" />
            <div>
              <h1 className="text-base font-bold text-(--color-text-primary) leading-tight" style={{ fontFamily: 'var(--font-outfit)' }}>
                Zamanlanmış
              </h1>
              {nextPost && !loading && (
                <p className="text-[11px] text-(--color-text-tertiary) leading-none mt-0.5">
                  Sıradaki: {formatScheduledAt(nextPost.scheduledAt!)}
                </p>
              )}
            </div>
          </div>
          {posts.length > 0 && (
            <span className="min-w-[20px] h-5 px-1.5 rounded-full bg-(--color-coral)/15 text-(--color-coral) text-[11px] font-bold flex items-center justify-center tabular-nums">
              {posts.length}
            </span>
          )}
        </div>
      </header>

      {loading ? (
        <TimelineSkeleton count={3} />
      ) : posts.length === 0 ? (
        <EmptyState
          icon={CalendarClock}
          title="Zamanlanmış gönderi yok"
          description="Gönderi oluştururken ileri tarih seçerek otomatik yayın zamanlayabilirsin."
        />
      ) : (
        <div>
          {groups.map((group) => (
            <div key={group.label}>
              {/* Group header */}
              <div className="flex items-center gap-2 px-4 py-2.5 border-b border-(--color-border-secondary) bg-(--color-background-secondary)/30">
                <span className={cn(
                  'text-[11px] font-semibold px-2 py-0.5 rounded-full border',
                  GROUP_COLORS[group.label],
                )}>
                  {group.label}
                </span>
                <span className="text-[11px] text-(--color-text-tertiary)">
                  {group.posts.length} gönderi
                </span>
              </div>

              {/* Posts */}
              {group.posts.map((post) => (
                <div key={post.id} className="border-b border-(--color-border-secondary) last:border-b-0">
                  {/* Schedule info row */}
                  <div className="flex items-center justify-between px-4 py-2 bg-(--color-background-secondary)/20">
                    <div className="flex items-center gap-1.5">
                      <Clock className="w-3 h-3 text-(--color-coral)" />
                      <span className="text-xs font-medium text-(--color-text-secondary)">
                        {formatScheduledAt(post.scheduledAt!)}
                      </span>
                    </div>
                    <button
                      onClick={() => void handleCancel(post.id)}
                      disabled={cancelling === post.id}
                      className="flex items-center gap-1 text-xs text-(--color-text-tertiary) hover:text-red-500 transition-colors disabled:opacity-40 px-2 py-0.5 rounded-full hover:bg-red-50 dark:hover:bg-red-950/20"
                      title="İptal et"
                    >
                      {cancelling === post.id
                        ? <Loader2 className="w-3 h-3 animate-spin" />
                        : <Trash2 className="w-3 h-3" />}
                      <span>İptal</span>
                    </button>
                  </div>
                  <PostCard post={post} />
                </div>
              ))}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
