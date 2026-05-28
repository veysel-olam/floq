'use client'

import { useEffect, useState, Suspense } from 'react'
import Link from 'next/link'
import { api, type AnalyticsData } from '@/lib/api'
import { useSession } from '@/lib/auth-client'
import { cn } from '@/lib/utils'
import { BarChart2, Heart, Repeat2, MessageCircle, Users, FileText, Hash, Flame, CalendarDays } from 'lucide-react'

// --- Streak helpers ---

function calculateStreaks(activity: { day: string; count: number }[]) {
  const activeSet = new Set(activity.filter((a) => a.count > 0).map((a) => a.day))
  const today = new Date()
  today.setHours(0, 0, 0, 0)

  let current = 0
  for (let i = 0; i < 365; i++) {
    const d = new Date(today)
    d.setDate(today.getDate() - i)
    const str = d.toISOString().split('T')[0]!
    if (!activeSet.has(str)) break
    current++
  }

  const sorted = [...activeSet].sort()
  let longest = 0
  let run = 0
  for (let i = 0; i < sorted.length; i++) {
    if (i === 0) { run = 1; continue }
    const prev = new Date(sorted[i - 1]! + 'T00:00:00')
    const curr = new Date(sorted[i]! + 'T00:00:00')
    const diff = (curr.getTime() - prev.getTime()) / 86_400_000
    run = diff === 1 ? run + 1 : 1
    if (run > longest) longest = run
  }
  if (run > longest) longest = run

  return { current, longest }
}

// --- Activity graph ---

function cellColor(count: number) {
  if (count === 0) return 'bg-(--color-background-secondary)'
  if (count === 1) return 'bg-(--color-coral)/25'
  if (count <= 3) return 'bg-(--color-coral)/45'
  if (count <= 6) return 'bg-(--color-coral)/65'
  return 'bg-(--color-coral)'
}

function ActivitySection({ handle }: { handle: string }) {
  const [activity, setActivity] = useState<{ day: string; count: number }[]>([])
  const [loaded, setLoaded] = useState(false)

  useEffect(() => {
    api.actors.activity(handle)
      .then((d) => { setActivity(d.activity); setLoaded(true) })
      .catch(() => setLoaded(true))
  }, [handle])

  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const countMap = new Map<string, number>(activity.map(({ day, count }) => [day, count]))

  const days: { dateStr: string; count: number }[] = []
  for (let i = 363; i >= 0; i--) {
    const d = new Date(today)
    d.setDate(today.getDate() - i)
    const str = d.toISOString().split('T')[0]!
    days.push({ dateStr: str, count: countMap.get(str) ?? 0 })
  }

  const firstDow = new Date(days[0]!.dateStr + 'T00:00:00').getDay()
  const allCells: ({ dateStr: string; count: number } | null)[] = [
    ...Array(firstDow).fill(null),
    ...days,
  ]
  const totalWeeks = Math.ceil(allCells.length / 7)
  const grid: (({ dateStr: string; count: number } | null)[])[] = []
  for (let w = 0; w < totalWeeks; w++) grid.push(allCells.slice(w * 7, w * 7 + 7))

  const monthLabels: (string | null)[] = grid.map((week) => {
    for (const cell of week) {
      if (cell) {
        const d = new Date(cell.dateStr + 'T00:00:00')
        if (d.getDate() <= 7) return d.toLocaleDateString('tr-TR', { month: 'short' })
      }
    }
    return null
  })

  const totalYear = days.reduce((s, d) => s + d.count, 0)
  const { current, longest } = calculateStreaks(activity)
  const dowLabels = ['', 'Pt', '', 'Ç', '', 'C', '']

  if (!loaded) {
    return <div className="h-40 rounded-2xl border border-(--color-border) animate-pulse bg-(--color-background-secondary)/40" />
  }

  return (
    <div className="rounded-2xl border border-(--color-border) bg-(--color-background) overflow-hidden">
      <div className="px-5 pt-5 pb-4">
        <div className="flex items-center justify-between mb-4">
          <div>
            <p className="text-sm font-semibold text-(--color-text-primary)">Gönderi Aktivitesi</p>
            <p className="text-xs text-(--color-text-tertiary) mt-0.5">
              {totalYear > 0 ? `Son 52 haftada ${totalYear} gönderi` : 'Henüz gönderi yok'}
            </p>
          </div>
          <div className="flex items-center gap-3">
            {current > 0 && (
              <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-orange-500/10 border border-orange-500/20">
                <Flame className="w-3 h-3 text-orange-500" />
                <span className="text-xs font-semibold text-orange-500 tabular-nums">{current}</span>
                <span className="text-[10px] text-orange-400/80">gün</span>
              </div>
            )}
            {longest > 0 && (
              <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-(--color-background-secondary) border border-(--color-border)">
                <CalendarDays className="w-3 h-3 text-(--color-text-tertiary)" />
                <span className="text-xs font-medium text-(--color-text-secondary) tabular-nums">{longest}</span>
                <span className="text-[10px] text-(--color-text-tertiary)">en uzun</span>
              </div>
            )}
          </div>
        </div>

        <div className="overflow-x-auto">
          <div className="inline-flex flex-col gap-0.5">
            <div className="flex gap-0.5 ml-5">
              {grid.map((_, wi) => (
                <div key={wi} className="w-[11px] text-[8px] text-(--color-text-tertiary) leading-none truncate">
                  {monthLabels[wi] ?? ''}
                </div>
              ))}
            </div>
            <div className="flex gap-0.5">
              <div className="flex flex-col gap-0.5 w-4 mr-0.5">
                {dowLabels.map((label, i) => (
                  <div key={i} className="h-[11px] text-[8px] text-(--color-text-tertiary) flex items-center justify-end pr-0.5 leading-none">
                    {label}
                  </div>
                ))}
              </div>
              {grid.map((week, wi) => (
                <div key={wi} className="flex flex-col gap-0.5">
                  {week.map((cell, di) => (
                    <div
                      key={di}
                      title={cell ? `${cell.dateStr}: ${cell.count} gönderi` : undefined}
                      className={cn(
                        'w-[11px] h-[11px] rounded-[2px] transition-opacity',
                        cell ? cellColor(cell.count) : 'opacity-0',
                      )}
                    />
                  ))}
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="flex items-center gap-1.5 mt-3">
          <span className="text-[10px] text-(--color-text-tertiary)">Az</span>
          {[0, 1, 2, 4, 8].map((v) => (
            <div key={v} className={cn('w-[11px] h-[11px] rounded-[2px]', cellColor(v))} />
          ))}
          <span className="text-[10px] text-(--color-text-tertiary)">Çok</span>
        </div>
      </div>
    </div>
  )
}

// --- Stats strip ---

function StatsStrip({ data }: { data: AnalyticsData }) {
  const stats = [
    { label: 'Gönderi', value: data.totals.totalPosts, icon: FileText, sub: `Bu hafta ${data.recentPostCount}` },
    { label: 'Beğeni', value: data.totals.totalLikes, icon: Heart },
    { label: 'Boost', value: data.totals.totalBoosts, icon: Repeat2 },
    { label: 'Yanıt', value: data.totals.totalReplies, icon: MessageCircle },
    { label: 'Takipçi', value: data.followerCount, icon: Users, sub: `${data.followingCount} takip` },
  ]

  return (
    <div className="rounded-2xl border border-(--color-border) bg-(--color-background) divide-y divide-(--color-border-secondary) sm:divide-y-0 sm:grid sm:grid-cols-5 sm:divide-x">
      {stats.map(({ label, value, icon: Icon, sub }) => (
        <div key={label} className="flex items-center gap-3 px-4 py-4 sm:flex-col sm:items-start sm:gap-1.5 sm:py-5">
          <Icon className="w-4 h-4 text-(--color-text-tertiary) sm:hidden" />
          <div className="flex-1 sm:flex-none">
            <p className="text-xs text-(--color-text-tertiary) sm:mb-1">{label}</p>
            <p className="text-xl font-bold text-(--color-text-primary) tabular-nums leading-none" style={{ fontFamily: 'var(--font-outfit)' }}>
              {value.toLocaleString('tr-TR')}
            </p>
            {sub && <p className="text-[11px] text-(--color-text-tertiary) mt-1 hidden sm:block">{sub}</p>}
          </div>
          <p className="text-sm font-semibold text-(--color-text-primary) sm:hidden">{value.toLocaleString('tr-TR')}</p>
        </div>
      ))}
    </div>
  )
}

// --- Main ---

function AnalyticsContent() {
  const { data: session } = useSession()
  const handle = (session?.user as { handle?: string } | undefined)?.handle
  const [data, setData] = useState<AnalyticsData | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    api.account.analytics()
      .then(setData)
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  return (
    <div className="max-w-xl mx-auto">
      <header className="sticky top-0 z-10 bg-(--color-background)/90 backdrop-blur-md border-b border-(--color-border) px-4 py-3.5">
        <div className="flex items-center gap-2">
          <BarChart2 className="w-5 h-5 text-(--color-coral)" />
          <h1 className="text-base font-bold text-(--color-text-primary)" style={{ fontFamily: 'var(--font-outfit)' }}>
            Analitik
          </h1>
        </div>
      </header>

      {loading ? (
        <div className="px-4 py-5 space-y-4">
          <div className="h-24 rounded-2xl border border-(--color-border) animate-pulse bg-(--color-background-secondary)/40" />
          <div className="h-40 rounded-2xl border border-(--color-border) animate-pulse bg-(--color-background-secondary)/40" />
        </div>
      ) : !data ? (
        <div className="py-32 text-center text-sm text-(--color-text-tertiary)">
          Veriler yüklenemedi.
        </div>
      ) : (
        <div className="px-4 py-5 space-y-4">
          <StatsStrip data={data} />

          {handle && <ActivitySection handle={handle} />}

          {data.topPosts.length > 0 && (
            <div className="rounded-2xl border border-(--color-border) bg-(--color-background) overflow-hidden">
              <div className="px-5 pt-5 pb-2">
                <p className="text-sm font-semibold text-(--color-text-primary)">En Çok Etkileşim Alan</p>
              </div>
              <div className="divide-y divide-(--color-border-secondary)">
                {data.topPosts.map((post, i) => (
                  <Link
                    key={post.id}
                    href={`/posts/${post.id}`}
                    className="flex items-start gap-3.5 px-5 py-3.5 hover:bg-(--color-background-secondary)/50 transition-colors group"
                  >
                    <span
                      className="text-sm font-bold w-5 flex-shrink-0 mt-0.5 tabular-nums"
                      style={{ fontFamily: 'var(--font-outfit)', color: i === 0 ? 'var(--color-coral)' : 'var(--color-text-tertiary)' }}
                    >
                      {i + 1}
                    </span>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-(--color-text-primary) line-clamp-2 leading-relaxed group-hover:text-(--color-coral) transition-colors">
                        {post.content || '(medya)'}
                      </p>
                      <div className="flex items-center gap-3.5 mt-2 text-xs text-(--color-text-tertiary)">
                        <span className="flex items-center gap-1"><Heart className="w-3 h-3" /> {post.likesCount}</span>
                        <span className="flex items-center gap-1"><Repeat2 className="w-3 h-3" /> {post.boostsCount}</span>
                        <span className="flex items-center gap-1"><MessageCircle className="w-3 h-3" /> {post.repliesCount}</span>
                        <span className="ml-auto opacity-60">
                          {new Date(post.createdAt).toLocaleDateString('tr-TR', { day: 'numeric', month: 'short' })}
                        </span>
                      </div>
                    </div>
                  </Link>
                ))}
              </div>
            </div>
          )}

          {data.topTags.length > 0 && (
            <div className="rounded-2xl border border-(--color-border) bg-(--color-background) p-5">
              <p className="text-sm font-semibold text-(--color-text-primary) mb-3 flex items-center gap-1.5">
                <Hash className="w-4 h-4 text-(--color-coral)" /> Sık Kullandıkların
              </p>
              <div className="flex flex-wrap gap-2">
                {data.topTags.map(({ tag, count }) => {
                  const max = data.topTags[0]?.count ?? 1
                  const isTop = count === max
                  return (
                    <Link
                      key={tag}
                      href={`/hashtag/${encodeURIComponent(tag)}`}
                      className={cn(
                        'flex items-center gap-1.5 px-3 py-1.5 rounded-full border text-sm transition-all',
                        isTop
                          ? 'border-(--color-coral)/40 bg-(--color-coral)/8 text-(--color-coral) font-medium hover:bg-(--color-coral)/15'
                          : 'border-(--color-border) text-(--color-text-secondary) hover:border-(--color-coral)/40 hover:text-(--color-coral)',
                      )}
                    >
                      <span>#{tag}</span>
                      <span className="text-[11px] opacity-60">{count}</span>
                    </Link>
                  )
                })}
              </div>
            </div>
          )}

          {data.topPosts.length === 0 && data.topTags.length === 0 && (
            <div className="rounded-2xl border border-(--color-border) bg-(--color-background-secondary)/30 p-12 text-center">
              <BarChart2 className="w-8 h-8 text-(--color-text-tertiary) mx-auto mb-3 opacity-30" />
              <p className="text-(--color-text-secondary) text-sm font-medium">Henüz yeterli veri yok</p>
              <p className="text-(--color-text-tertiary) text-xs mt-1">Gönderi paylaşmaya başla!</p>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

export default function AnalyticsPage() {
  return (
    <Suspense>
      <AnalyticsContent />
    </Suspense>
  )
}
