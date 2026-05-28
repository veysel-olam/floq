'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { useSession } from '@/lib/auth-client'
import { api, type Notification } from '@/lib/api'
import { Button } from '@/components/ui/button'
import { useInfiniteScroll } from '@/hooks/use-infinite-scroll'
import { useRealtime } from '@/hooks/use-realtime'
import { cn } from '@/lib/utils'
import { Loader2, Heart, Repeat2, MessageCircle, UserPlus, AtSign, Check, X, Trash2, BarChart2, Bell, Zap, ShieldOff } from 'lucide-react'
import { Separator } from '@/components/ui/separator'
import { EmptyState } from '@/components/ui/empty-state'
import { NotificationsSkeleton } from '@/components/ui/skeleton'

type FilterTab = 'all' | 'mention' | 'like' | 'boost' | 'follow' | 'reply'

const FILTER_TABS: { id: FilterTab; label: string; types: Notification['type'][] }[] = [
  { id: 'all',     label: 'Tümü',     types: [] },
  { id: 'mention', label: 'Mention',  types: ['mention'] },
  { id: 'like',    label: 'Beğeni',   types: ['like'] },
  { id: 'boost',   label: 'Boost',    types: ['boost'] },
  { id: 'follow',  label: 'Takip',    types: ['follow', 'follow_request'] },
  { id: 'reply',   label: 'Yanıt',    types: ['reply'] },
]

/* ── Notification type config ─────────────────────────────── */
const typeConfig: Record<
  Notification['type'],
  { icon: React.ReactNode; bg: string; label: string }
> = {
  like:          { icon: <Heart className="w-3 h-3 fill-current" />,     bg: 'bg-(--color-coral) text-white',          label: 'gönderini beğendi' },
  boost:         { icon: <Repeat2 className="w-3 h-3" />,                bg: 'bg-[#2A9D8F] text-white',                label: 'yeniden paylaştı' },
  reply:         { icon: <MessageCircle className="w-3 h-3" />,          bg: 'bg-blue-500 text-white',                 label: 'yanıtladı' },
  mention:       { icon: <AtSign className="w-3 h-3" />,                 bg: 'bg-violet-500 text-white',               label: 'senden bahsetti' },
  follow:        { icon: <UserPlus className="w-3 h-3" />,               bg: 'bg-(--color-teal) text-white',           label: 'seni takip etmeye başladı' },
  follow_request:   { icon: <UserPlus className="w-3 h-3" />,   bg: 'bg-(--color-stone) text-white',  label: 'takip isteği gönderdi' },
  poll_ended:       { icon: <BarChart2 className="w-3 h-3" />,  bg: 'bg-amber-500 text-white',        label: 'anketi sona erdi' },
  flow_post:        { icon: <Zap className="w-3 h-3" />,        bg: 'bg-violet-500 text-white',       label: 'yeni gönderi paylaştı' },
  account_suspended:{ icon: <ShieldOff className="w-3 h-3" />, bg: 'bg-red-600 text-white',          label: 'hesabınızı askıya aldı' },
}

/* ── Time helpers ─────────────────────────────────────────── */
function formatRelativeTime(dateStr: string) {
  const diff = Date.now() - new Date(dateStr).getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 1) return 'şimdi'
  if (mins < 60) return `${mins}d`
  const hours = Math.floor(mins / 60)
  if (hours < 24) return `${hours}s`
  return `${Math.floor(hours / 24)}g`
}

function getDateGroup(dateStr: string): string {
  const now = new Date()
  const d = new Date(dateStr)
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  const yesterday = new Date(today.getTime() - 86400000)
  const weekAgo = new Date(today.getTime() - 7 * 86400000)
  const itemDay = new Date(d.getFullYear(), d.getMonth(), d.getDate())
  if (itemDay.getTime() === today.getTime()) return 'Bugün'
  if (itemDay.getTime() === yesterday.getTime()) return 'Dün'
  if (d >= weekAgo) return 'Bu Hafta'
  return 'Daha Önce'
}

/* ── Single notification row ──────────────────────────────── */
function NotificationItem({
  notification,
  onRead,
  onRemove,
  onDelete,
}: {
  notification: Notification
  onRead: (id: string) => void
  onRemove: (id: string) => void
  onDelete: (id: string) => void
}) {
  const router = useRouter()
  const [actioning, setActioning] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const cfg = typeConfig[notification.type]
  const handle = notification.actor?.handle ?? 'unknown'
  const displayName = notification.actor?.displayName ?? handle
  const initials = displayName.slice(0, 2).toUpperCase()
  const postHref = notification.post ? `/posts/${notification.post.id}` : null
  const isFollowRequest = notification.type === 'follow_request'
  const isUnread = !notification.read

  function handleClick() {
    if (!notification.read) onRead(notification.id)
    if (postHref && !isFollowRequest) router.push(postHref)
  }

  async function handleDeleteClick(e: React.MouseEvent) {
    e.stopPropagation()
    setDeleting(true)
    try {
      await api.notifications.deleteOne(notification.id)
      onDelete(notification.id)
    } catch {
    } finally {
      setDeleting(false)
    }
  }

  async function handleAccept(e: React.MouseEvent) {
    e.stopPropagation()
    if (actioning || !notification.actor) return
    setActioning(true)
    try { await api.followRequests.acceptByHandle(handle); onRemove(notification.id) }
    catch {} finally { setActioning(false) }
  }

  async function handleReject(e: React.MouseEvent) {
    e.stopPropagation()
    if (actioning || !notification.actor) return
    setActioning(true)
    try { await api.followRequests.rejectByHandle(handle); onRemove(notification.id) }
    catch {} finally { setActioning(false) }
  }

  return (
    <div
      onClick={handleClick}
      className={cn(
        'relative flex gap-4 px-4 py-3.5 border-b border-(--color-border-secondary) transition-colors group',
        (postHref && !isFollowRequest) ? 'cursor-pointer' : '',
        isUnread
          ? 'bg-(--color-coral)/[0.04] dark:bg-(--color-coral)/[0.07] hover:bg-(--color-coral)/[0.07]'
          : 'hover:bg-(--color-background-secondary)',
      )}
    >
      {/* Left unread indicator */}
      {isUnread && (
        <span className="absolute left-0 top-1/2 -translate-y-1/2 w-[3px] h-10 rounded-r-full bg-(--color-coral)" />
      )}

      {/* Avatar with type badge */}
      <div className="relative flex-shrink-0 self-start mt-0.5">
        <button
          onClick={(e) => { e.stopPropagation(); router.push(`/${handle}`) }}
          className="block w-10 h-10 rounded-full overflow-hidden ring-2 ring-(--color-border) hover:ring-(--color-coral)/50 transition-all"
        >
          {notification.actor?.avatarUrl
            // eslint-disable-next-line @next/next/no-img-element
            ? <img src={notification.actor.avatarUrl} alt={displayName} className="w-full h-full object-cover" />
            : (
              <div
                className="w-full h-full flex items-center justify-center text-xs font-bold text-white"
                style={{ background: 'var(--gradient-avatar)' }}
              >
                {initials}
              </div>
            )}
        </button>
        {/* Type badge */}
        <span
          className={cn(
            'absolute -bottom-0.5 -right-0.5 w-[18px] h-[18px] rounded-full flex items-center justify-center ring-2 ring-(--color-background)',
            cfg.bg,
          )}
        >
          {cfg.icon}
        </span>
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0">
        <div className="flex items-start justify-between gap-2">
          <div className="flex-1 min-w-0">
            <p className="text-sm leading-snug">
              <Link
                href={`/${handle}`}
                onClick={(e) => e.stopPropagation()}
                className={cn(
                  'font-semibold hover:underline',
                  isUnread ? 'text-(--color-text-primary)' : 'text-(--color-text-primary)',
                )}
                style={{ fontFamily: 'var(--font-outfit)' }}
              >
                {displayName}
              </Link>
              <span className="text-(--color-text-secondary) font-normal ml-1.5">{cfg.label}</span>
            </p>

            {notification.post?.content && (
              <p className="text-xs text-(--color-text-tertiary) mt-1.5 line-clamp-2 leading-relaxed bg-(--color-background-secondary)/60 rounded-lg px-2.5 py-1.5 border border-(--color-border-secondary)">
                {notification.post.content}
              </p>
            )}

            {isFollowRequest && (
              <div className="flex gap-2 mt-2.5" onClick={(e) => e.stopPropagation()}>
                <button
                  onClick={handleAccept}
                  disabled={actioning}
                  className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-xs font-semibold bg-(--color-coral) text-white hover:bg-(--color-coral-hover) transition-colors disabled:opacity-50 shadow-sm shadow-(--color-coral)/20"
                >
                  {actioning ? <Loader2 className="w-3 h-3 animate-spin" /> : <Check className="w-3 h-3" />}
                  Kabul et
                </button>
                <button
                  onClick={handleReject}
                  disabled={actioning}
                  className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-xs font-semibold border border-(--color-border) text-(--color-text-secondary) hover:bg-(--color-background-secondary) transition-colors disabled:opacity-50"
                >
                  <X className="w-3 h-3" />
                  Reddet
                </button>
              </div>
            )}
          </div>

          {/* Time + delete */}
          <div className="flex items-center gap-1 flex-shrink-0 mt-0.5">
            <span className="text-[11px] text-(--color-text-tertiary)">
              {formatRelativeTime(notification.createdAt)}
            </span>
            <button
              onClick={handleDeleteClick}
              disabled={deleting}
              className="p-1 rounded-md text-(--color-text-tertiary) hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-950/20 opacity-0 group-hover:opacity-100 transition-all disabled:opacity-50"
              title="Sil"
            >
              {deleting ? <Loader2 className="w-3 h-3 animate-spin" /> : <Trash2 className="w-3 h-3" />}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

/* ── Date group divider ───────────────────────────────────── */
function GroupDivider({ label }: { label: string }) {
  return (
    <div className="px-4 py-2 border-b border-(--color-border-secondary) flex items-center gap-3">
      <p className="text-[11px] font-semibold text-(--color-text-tertiary) uppercase tracking-widest">{label}</p>
      <Separator className="flex-1 bg-(--color-border-secondary)" />
    </div>
  )
}

/* ── Main page ────────────────────────────────────────────── */
export default function NotificationsPage() {
  const { data: session, isPending } = useSession()
  const router = useRouter()
  const [notifications, setNotifications] = useState<Notification[]>([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState(false)
  const [loadingMore, setLoadingMore] = useState(false)
  const [nextCursor, setNextCursor] = useState<string | null>(null)
  const [markingRead, setMarkingRead] = useState(false)
  const [activeFilter, setActiveFilter] = useState<FilterTab>('all')

  const load = useCallback(async (cursor?: string) => {
    try {
      const data = await api.notifications.list(cursor)
      if (cursor) setNotifications((prev) => [...prev, ...data.notifications])
      else setNotifications(data.notifications)
      setNextCursor(data.nextCursor)
      setLoadError(false)
    } catch (err) {
      const error = err as { status?: number }
      if (error.status === 401) router.push('/login')
      else setLoadError(true)
    } finally {
      setLoading(false)
      setLoadingMore(false)
    }
  }, [router])

  useEffect(() => {
    if (!isPending && !session) { router.push('/login'); return }
    if (session) void load()
  }, [isPending, session, load])

  const loadMore = useCallback(() => {
    if (!nextCursor || loadingMore) return
    setLoadingMore(true)
    void load(nextCursor)
  }, [nextCursor, loadingMore, load])

  const loadMoreRef = useInfiniteScroll(loadMore, !!nextCursor && !loadingMore)

  const onNewNotification = useCallback((data: unknown) => {
    const n = data as Notification
    setNotifications((prev) => prev.some((x) => x.id === n.id) ? prev : [n, ...prev])
  }, [])
  useRealtime({ notification: onNewNotification })

  async function markAllRead() {
    setMarkingRead(true)
    try {
      await api.notifications.readAll()
      setNotifications((prev) => prev.map((n) => ({ ...n, read: true })))
    } catch {
    } finally {
      setMarkingRead(false)
    }
  }

  const unreadCount = notifications.filter((n) => !n.read).length

  const filterDef = FILTER_TABS.find((f) => f.id === activeFilter)!
  const filtered = filterDef.types.length === 0
    ? notifications
    : notifications.filter((n) => filterDef.types.includes(n.type))

  if (isPending || loading) {
    return (
      <div className="max-w-xl mx-auto">
        <header className="sticky top-0 z-10 bg-(--color-background)/90 backdrop-blur-md border-b border-(--color-border) px-4 py-3.5">
          <div className="flex items-center gap-2">
            <Bell className="w-5 h-5 text-(--color-coral)" />
            <h1 className="text-base font-bold text-(--color-text-primary)" style={{ fontFamily: 'var(--font-outfit)' }}>Bildirimler</h1>
          </div>
        </header>
        <NotificationsSkeleton />
      </div>
    )
  }

  // Group notifications by date
  const groups: { label: string; items: Notification[] }[] = []
  for (const n of filtered) {
    const label = getDateGroup(n.createdAt)
    const last = groups[groups.length - 1]
    if (last?.label === label) last.items.push(n)
    else groups.push({ label, items: [n] })
  }

  return (
    <div className="max-w-xl mx-auto">
      <header className="sticky top-0 z-10 bg-(--color-background)/90 backdrop-blur-md border-b border-(--color-border) px-4 py-3.5">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Bell className="w-5 h-5 text-(--color-coral)" />
            <h1
              className="text-base font-bold text-(--color-text-primary)"
              style={{ fontFamily: 'var(--font-outfit)' }}
            >
              Bildirimler
            </h1>
            {unreadCount > 0 && (
              <span className="min-w-[20px] h-5 px-1.5 rounded-full bg-(--color-coral) text-white text-[11px] font-bold flex items-center justify-center tabular-nums">
                {unreadCount > 99 ? '99+' : unreadCount}
              </span>
            )}
          </div>
          {unreadCount > 0 && (
            <Button
              variant="ghost"
              size="sm"
              onClick={markAllRead}
              disabled={markingRead}
              className="text-xs text-(--color-text-tertiary) hover:text-(--color-coral) hover:bg-(--color-coral)/8 rounded-full px-3"
            >
              {markingRead ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : 'Tümünü okundu işaretle'}
            </Button>
          )}
        </div>
        {/* Filter tabs */}
        <div className="flex gap-1 mt-2.5 overflow-x-auto no-scrollbar -mx-1 px-1">
          {FILTER_TABS.map((tab) => {
            const count = tab.types.length === 0
              ? notifications.length
              : notifications.filter((n) => tab.types.includes(n.type)).length
            const isActive = activeFilter === tab.id
            return (
              <button
                key={tab.id}
                onClick={() => setActiveFilter(tab.id)}
                className={cn(
                  'flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium whitespace-nowrap transition-colors flex-shrink-0',
                  isActive
                    ? 'bg-(--color-coral) text-white'
                    : 'text-(--color-text-tertiary) hover:text-(--color-text-primary) hover:bg-(--color-background-secondary)',
                )}
              >
                {tab.label}
                {count > 0 && (
                  <span className={cn('text-[10px] tabular-nums', isActive ? 'text-white/80' : 'text-(--color-text-tertiary)')}>
                    {count}
                  </span>
                )}
              </button>
            )
          })}
        </div>
      </header>

      {loadError ? (
        <EmptyState
          icon={Bell}
          title="Bildirimler yüklenemedi"
          description="Bir sorun oluştu. Sayfayı yenilemeyi dene."
          action={<button onClick={() => { setLoadError(false); setLoading(true); void load() }} className="text-xs px-4 py-2 rounded-full bg-(--color-coral) text-white font-medium hover:opacity-90">Tekrar dene</button>}
        />
      ) : filtered.length === 0 ? (
        <EmptyState
          icon={Bell}
          title={activeFilter === 'all' ? 'Henüz bildirim yok' : 'Bu kategoride bildirim yok'}
          description={activeFilter === 'all' ? 'Biri seni takip ettiğinde, gönderini beğendiğinde veya yanıtladığında burada görünür.' : 'Farklı bir filtre seçmeyi dene.'}
        />
      ) : (
        <>
          {groups.map((group) => (
            <div key={group.label}>
              <GroupDivider label={group.label} />
              {group.items.map((notification) => (
                <NotificationItem
                  key={notification.id}
                  notification={notification}
                  onRead={(id) => {
                    setNotifications((prev) => prev.map((n) => n.id === id ? { ...n, read: true } : n))
                    api.notifications.readOne(id).catch(() => {
                      setNotifications((prev) => prev.map((n) => n.id === id ? { ...n, read: false } : n))
                    })
                  }}
                  onRemove={(id) => setNotifications((prev) => prev.filter((n) => n.id !== id))}
                  onDelete={(id) => setNotifications((prev) => prev.filter((n) => n.id !== id))}
                />
              ))}
            </div>
          ))}
          {loadingMore && (
            <div className="py-6 flex justify-center">
              <Loader2 className="w-5 h-5 animate-spin text-(--color-coral)" />
            </div>
          )}
          <div ref={loadMoreRef} className="h-1" />
        </>
      )}
    </div>
  )
}
