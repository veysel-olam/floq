'use client'

import { useEffect, useState, Suspense, useMemo } from 'react'
import Link from 'next/link'
import { api, type AnalyticsData } from '@/lib/api'
import { useSession } from '@/lib/auth-client'
import { cn } from '@/lib/utils'
import { AreaChart, Area, XAxis, YAxis, CartesianGrid } from 'recharts'
import {
  ChartContainer, ChartTooltip, ChartTooltipContent, ChartLegend, type ChartConfig,
} from '@/components/ui/chart'
import {
  BarChart2, Heart, Repeat2, MessageCircle, Users,
  FileText, Hash, TrendingUp, Eye, Flame, ArrowUp, ArrowDown,
} from 'lucide-react'
import { EmptyState } from '@/components/ui/empty-state'

// ── helpers ───────────────────────────────────────────────────────────────

type Range = '7' | '30' | '90'

const RANGES: { value: Range; label: string }[] = [
  { value: '7',  label: '7 gün'  },
  { value: '30', label: '30 gün' },
  { value: '90', label: '90 gün' },
]

function fmt(n: number) {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`
  return n.toLocaleString('tr-TR')
}

function fmtDay(dateStr: string) {
  return new Date(dateStr + 'T00:00:00').toLocaleDateString('tr-TR', { day: 'numeric', month: 'short' })
}

function filterDays<T extends { day: string }>(arr: T[], days: number): T[] {
  const cutoff = new Date()
  cutoff.setDate(cutoff.getDate() - days)
  cutoff.setHours(0, 0, 0, 0)
  return arr.filter((d) => new Date(d.day + 'T00:00:00') >= cutoff)
}

function buildDailyMap<T extends { day: string; count: number }>(arr: T[], days: number) {
  const map = new Map(arr.map((d) => [d.day, d.count]))
  const result: { day: string; count: number }[] = []
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(today)
    d.setDate(today.getDate() - i)
    const str = d.toISOString().split('T')[0]!
    result.push({ day: str, count: map.get(str) ?? 0 })
  }
  return result
}

function sum(arr: { count: number }[]) {
  return arr.reduce((s, d) => s + d.count, 0)
}

// Only return a trend when we have meaningful prior data
function trendPct(current: number, previous: number): number | undefined {
  if (previous === 0) return undefined
  return Math.round(((current - previous) / previous) * 100)
}

function calculateStreak(activity: { day: string; count: number }[]) {
  const activeSet = new Set(activity.filter((a) => a.count > 0).map((a) => a.day))
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  let streak = 0
  for (let i = 0; i < 365; i++) {
    const d = new Date(today)
    d.setDate(today.getDate() - i)
    if (!activeSet.has(d.toISOString().split('T')[0]!)) break
    streak++
  }
  return streak
}

// ── Range control — native segmented, not Tabs ────────────────────────────

function RangeControl({ value, onChange }: { value: Range; onChange: (r: Range) => void }) {
  return (
    <div className="inline-flex rounded-lg bg-(--color-background-secondary) p-0.5 gap-0.5">
      {RANGES.map(({ value: r, label }) => (
        <button
          key={r}
          onClick={() => onChange(r)}
          className={cn(
            'px-3 h-7 rounded-md text-[12px] font-medium transition-all duration-150 select-none',
            value === r
              ? 'bg-(--color-background) text-(--color-text-primary) shadow-sm'
              : 'text-(--color-text-tertiary) hover:text-(--color-text-secondary)',
          )}
        >
          {label}
        </button>
      ))}
    </div>
  )
}

// ── Stat card ─────────────────────────────────────────────────────────────

function StatCard({
  label, value, sub, icon: Icon, trend,
}: {
  label: string
  value: number
  sub?: string
  icon: React.ElementType
  trend?: number
}) {
  return (
    <div className="rounded-2xl border border-(--color-border) bg-(--color-background) p-4 flex flex-col gap-2.5">
      <div className="flex items-center gap-1.5">
        <Icon className="w-3.5 h-3.5 text-(--color-text-tertiary)" />
        <p className="text-[11px] font-medium text-(--color-text-tertiary) uppercase tracking-wide">{label}</p>
      </div>
      <div className="flex items-end justify-between gap-2">
        <p
          className="text-[28px] font-bold text-(--color-text-primary) tabular-nums leading-none"
          style={{ fontFamily: 'var(--font-outfit)' }}
        >
          {fmt(value)}
        </p>
        {trend !== undefined && (
          <span className={cn(
            'flex items-center gap-0.5 text-[11px] font-semibold mb-0.5',
            trend >= 0 ? 'text-emerald-500' : 'text-red-400',
          )}>
            {trend >= 0
              ? <ArrowUp className="w-3 h-3" />
              : <ArrowDown className="w-3 h-3" />}
            {Math.abs(trend)}%
          </span>
        )}
      </div>
      {sub && (
        <p className="text-[11px] text-(--color-text-tertiary) leading-none">{sub}</p>
      )}
    </div>
  )
}

// ── Secondary stats strip ─────────────────────────────────────────────────

function SecondaryStats({ replies, views, following }: {
  replies: number
  views: number
  following: number
}) {
  const items = [
    { icon: MessageCircle, label: 'Yanıt', value: replies },
    { icon: Eye,           label: 'Görüntülenme', value: views },
    { icon: Users,         label: 'Takip Edilen', value: following },
  ]
  return (
    <div className="rounded-2xl border border-(--color-border) bg-(--color-background) grid grid-cols-3 divide-x divide-(--color-border-secondary)">
      {items.map(({ icon: Icon, label, value }) => (
        <div key={label} className="flex flex-col items-center gap-1 py-3 px-2">
          <p className="text-base font-bold text-(--color-text-primary) tabular-nums leading-none" style={{ fontFamily: 'var(--font-outfit)' }}>
            {fmt(value)}
          </p>
          <div className="flex items-center gap-1">
            <Icon className="w-3 h-3 text-(--color-text-tertiary)" />
            <p className="text-[10px] text-(--color-text-tertiary)">{label}</p>
          </div>
        </div>
      ))}
    </div>
  )
}

// ── Engagement chart ──────────────────────────────────────────────────────

const engagementConfig: ChartConfig = {
  likes:  { label: 'Beğeni', color: 'var(--color-coral)' },
  boosts: { label: 'Boost',  color: 'var(--color-teal)'  },
}

function EngagementChart({
  likesTimeline, boostsTimeline, days,
}: {
  likesTimeline: { day: string; count: number }[]
  boostsTimeline: { day: string; count: number }[]
  days: number
}) {
  const data = useMemo(() => {
    const lm = new Map(buildDailyMap(likesTimeline, days).map((d) => [d.day, d.count]))
    const bm = new Map(buildDailyMap(boostsTimeline, days).map((d) => [d.day, d.count]))
    return [...new Set([...lm.keys(), ...bm.keys()])].sort().map((day) => ({
      day,
      likes:  lm.get(day) ?? 0,
      boosts: bm.get(day) ?? 0,
    }))
  }, [likesTimeline, boostsTimeline, days])

  const interval = days <= 7 ? 0 : days <= 30 ? 4 : 13

  return (
    <div className="rounded-2xl border border-(--color-border) bg-(--color-background) p-5">
      <div className="flex items-start justify-between mb-5">
        <div>
          <p className="text-sm font-semibold text-(--color-text-primary)" style={{ fontFamily: 'var(--font-outfit)' }}>Etkileşim</p>
          <p className="text-[11px] text-(--color-text-tertiary) mt-0.5">Günlük beğeni ve boost</p>
        </div>
        <ChartLegend config={engagementConfig} />
      </div>
      <ChartContainer config={engagementConfig} className="w-full aspect-auto" style={{ height: 200 }}>
        <AreaChart data={data} margin={{ top: 4, right: 2, left: -16, bottom: 0 }}>
          <defs>
            <linearGradient id="gl" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="var(--color-coral)" stopOpacity={0.20} />
              <stop offset="100%" stopColor="var(--color-coral)" stopOpacity={0} />
            </linearGradient>
            <linearGradient id="gb" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="var(--color-teal)" stopOpacity={0.15} />
              <stop offset="100%" stopColor="var(--color-teal)" stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" vertical={false} />
          <XAxis dataKey="day" tickLine={false} axisLine={false}
            tick={{ fontSize: 10, fill: 'var(--color-text-tertiary)' }}
            interval={interval} tickFormatter={fmtDay} />
          <YAxis tickLine={false} axisLine={false}
            tick={{ fontSize: 10, fill: 'var(--color-text-tertiary)' }}
            allowDecimals={false} width={28} />
          <ChartTooltip content={<ChartTooltipContent labelFormatter={fmtDay} />} />
          <Area type="monotone" dataKey="likes" stroke="var(--color-coral)" strokeWidth={1.5}
            fill="url(#gl)" dot={false} activeDot={{ r: 3.5, fill: 'var(--color-coral)', strokeWidth: 0 }} />
          <Area type="monotone" dataKey="boosts" stroke="var(--color-teal)" strokeWidth={1.5}
            fill="url(#gb)" dot={false} activeDot={{ r: 3.5, fill: 'var(--color-teal)', strokeWidth: 0 }} />
        </AreaChart>
      </ChartContainer>
    </div>
  )
}

// ── Activity chart ────────────────────────────────────────────────────────

const activityConfig: ChartConfig = {
  count: { label: 'Gönderi', color: 'var(--color-coral)' },
}

function ActivityChart({
  activity, days,
}: {
  activity: { day: string; count: number }[]
  days: number
}) {
  const data     = useMemo(() => buildDailyMap(activity, days), [activity, days])
  const streak   = useMemo(() => calculateStreak(activity), [activity])
  const total    = useMemo(() => sum(data), [data])
  const interval = days <= 7 ? 0 : days <= 30 ? 4 : 13

  return (
    <div className="rounded-2xl border border-(--color-border) bg-(--color-background) p-5">
      <div className="flex items-start justify-between mb-5">
        <div>
          <p className="text-sm font-semibold text-(--color-text-primary)" style={{ fontFamily: 'var(--font-outfit)' }}>Gönderi Aktivitesi</p>
          <p className="text-[11px] text-(--color-text-tertiary) mt-0.5">
            {total > 0 ? `${total} gönderi` : 'Bu dönemde gönderi yok'}
          </p>
        </div>
        {streak > 0 && (
          <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-orange-500/8">
            <Flame className="w-3 h-3 text-orange-500" />
            <span className="text-[11px] font-semibold text-orange-500 tabular-nums">{streak} gün</span>
          </div>
        )}
      </div>
      <ChartContainer config={activityConfig} className="w-full aspect-auto" style={{ height: 140 }}>
        <AreaChart data={data} margin={{ top: 4, right: 2, left: -16, bottom: 0 }}>
          <defs>
            <linearGradient id="ga" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="var(--color-coral)" stopOpacity={0.18} />
              <stop offset="100%" stopColor="var(--color-coral)" stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" vertical={false} />
          <XAxis dataKey="day" tickLine={false} axisLine={false}
            tick={{ fontSize: 10, fill: 'var(--color-text-tertiary)' }}
            interval={interval} tickFormatter={fmtDay} />
          <YAxis tickLine={false} axisLine={false}
            tick={{ fontSize: 10, fill: 'var(--color-text-tertiary)' }}
            allowDecimals={false} width={28} />
          <ChartTooltip content={<ChartTooltipContent labelFormatter={fmtDay} />} />
          <Area type="monotone" dataKey="count" stroke="var(--color-coral)" strokeWidth={1.5}
            fill="url(#ga)" dot={false} activeDot={{ r: 3.5, fill: 'var(--color-coral)', strokeWidth: 0 }} />
        </AreaChart>
      </ChartContainer>
    </div>
  )
}

// ── Top posts ─────────────────────────────────────────────────────────────

function TopPosts({ posts }: { posts: AnalyticsData['topPosts'] }) {
  if (!posts.length) return null
  const maxE = Math.max(...posts.map((p) => p.likesCount + p.boostsCount + p.repliesCount), 1)

  return (
    <div className="rounded-2xl border border-(--color-border) bg-(--color-background) overflow-hidden">
      <div className="px-5 pt-5 pb-3 flex items-center gap-2">
        <TrendingUp className="w-3.5 h-3.5 text-(--color-text-tertiary)" />
        <p className="text-[11px] font-semibold text-(--color-text-tertiary) uppercase tracking-wide">En Çok Etkileşim</p>
      </div>
      <div className="divide-y divide-(--color-border-secondary)">
        {posts.map((post, i) => {
          const total = post.likesCount + post.boostsCount + post.repliesCount
          const pct   = Math.round((total / maxE) * 100)
          return (
            <Link
              key={post.id}
              href={`/posts/${post.id}`}
              className="flex items-start gap-4 px-5 py-4 hover:bg-(--color-background-secondary)/40 transition-colors group"
            >
              <span
                className="text-[13px] font-bold w-4 flex-shrink-0 mt-px tabular-nums"
                style={{
                  fontFamily: 'var(--font-outfit)',
                  color: i === 0 ? 'var(--color-coral)' : 'var(--color-text-tertiary)',
                }}
              >
                {i + 1}
              </span>
              <div className="flex-1 min-w-0 space-y-2">
                <p className="text-[13px] leading-snug text-(--color-text-primary) line-clamp-2 group-hover:text-(--color-coral) transition-colors">
                  {post.content || '(medya)'}
                </p>
                <div className="h-[3px] rounded-full bg-(--color-background-secondary) overflow-hidden">
                  <div
                    className="h-full rounded-full bg-(--color-coral)/50 transition-all"
                    style={{ width: `${pct}%` }}
                  />
                </div>
                <div className="flex items-center gap-3 text-[11px] text-(--color-text-tertiary)">
                  <span className="flex items-center gap-1"><Heart className="w-3 h-3" />{post.likesCount}</span>
                  <span className="flex items-center gap-1"><Repeat2 className="w-3 h-3" />{post.boostsCount}</span>
                  <span className="flex items-center gap-1"><MessageCircle className="w-3 h-3" />{post.repliesCount}</span>
                  <span className="ml-auto">
                    {new Date(post.createdAt).toLocaleDateString('tr-TR', { day: 'numeric', month: 'short' })}
                  </span>
                </div>
              </div>
            </Link>
          )
        })}
      </div>
    </div>
  )
}

// ── Top tags ──────────────────────────────────────────────────────────────

function TopTags({ tags }: { tags: AnalyticsData['topTags'] }) {
  if (!tags.length) return null
  const max = tags[0]?.count ?? 1

  return (
    <div className="rounded-2xl border border-(--color-border) bg-(--color-background) p-5">
      <div className="flex items-center gap-2 mb-5">
        <Hash className="w-3.5 h-3.5 text-(--color-text-tertiary)" />
        <p className="text-[11px] font-semibold text-(--color-text-tertiary) uppercase tracking-wide">Sık Kullandıkların</p>
      </div>
      <div className="space-y-3.5">
        {tags.map(({ tag, count }) => {
          const pct = Math.round((count / max) * 100)
          return (
            <Link key={tag} href={`/hashtag/${encodeURIComponent(tag)}`} className="group block">
              <div className="flex items-center justify-between mb-1.5">
                <span className="text-[13px] font-medium text-(--color-text-secondary) group-hover:text-(--color-coral) transition-colors">
                  #{tag}
                </span>
                <span className="text-[11px] text-(--color-text-tertiary) tabular-nums">{count}</span>
              </div>
              <div className="h-[3px] rounded-full bg-(--color-background-secondary) overflow-hidden">
                <div
                  className="h-full rounded-full bg-(--color-coral)/45 group-hover:bg-(--color-coral)/65 transition-all duration-200"
                  style={{ width: `${pct}%` }}
                />
              </div>
            </Link>
          )
        })}
      </div>
    </div>
  )
}

// ── Skeleton ──────────────────────────────────────────────────────────────

function Skeleton() {
  return (
    <div className="px-4 py-5 space-y-4">
      <div className="grid grid-cols-2 gap-3">
        {[...Array(4)].map((_, i) => (
          <div key={i} className="h-24 rounded-2xl border border-(--color-border) animate-pulse bg-(--color-background-secondary)/40" />
        ))}
      </div>
      <div className="h-12 rounded-2xl border border-(--color-border) animate-pulse bg-(--color-background-secondary)/40" />
      <div className="h-64 rounded-2xl border border-(--color-border) animate-pulse bg-(--color-background-secondary)/40" />
      <div className="h-48 rounded-2xl border border-(--color-border) animate-pulse bg-(--color-background-secondary)/40" />
    </div>
  )
}

// ── Main ──────────────────────────────────────────────────────────────────

function AnalyticsContent() {
  const { data: session } = useSession()
  const handle = (session?.user as { handle?: string } | undefined)?.handle
  const [data, setData]         = useState<AnalyticsData | null>(null)
  const [activity, setActivity] = useState<{ day: string; count: number }[]>([])
  const [loading, setLoading]   = useState(true)
  const [range, setRange]       = useState<Range>('30')
  const days = parseInt(range)

  useEffect(() => {
    Promise.all([
      api.account.analytics(),
      handle ? api.actors.activity(handle) : Promise.resolve({ activity: [] }),
    ])
      .then(([analytics, act]) => { setData(analytics); setActivity(act.activity) })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [handle])

  const likesNow   = useMemo(() => sum(filterDays(data?.likesTimeline  ?? [], days)),        [data, days])
  const boostsNow  = useMemo(() => sum(filterDays(data?.boostsTimeline ?? [], days)),        [data, days])
  const postsNow   = useMemo(() => sum(filterDays(activity, days)),                          [activity, days])
  const likesPrev  = useMemo(() => sum(filterDays(data?.likesTimeline  ?? [], days * 2).slice(0, days)), [data, days])
  const boostsPrev = useMemo(() => sum(filterDays(data?.boostsTimeline ?? [], days * 2).slice(0, days)), [data, days])
  const postsPrev  = useMemo(() => sum(filterDays(activity, days * 2).slice(0, days)),       [activity, days])

  return (
    <div className="max-w-xl mx-auto">
      <header className="sticky top-0 z-10 bg-(--color-background)/90 backdrop-blur-md border-b border-(--color-border) px-4 py-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <BarChart2 className="w-5 h-5 text-(--color-coral)" />
            <h1 className="text-base font-bold text-(--color-text-primary)" style={{ fontFamily: 'var(--font-outfit)' }}>
              Analitik
            </h1>
          </div>
          <RangeControl value={range} onChange={setRange} />
        </div>
      </header>

      {loading ? <Skeleton /> : !data ? (
        <EmptyState icon={BarChart2} title="Veriler yüklenemedi" size="sm" />
      ) : (
        <div className="px-4 py-5 space-y-3">

          {/* Primary stats — 2×2 */}
          <div className="grid grid-cols-2 gap-3">
            <StatCard
              label="Gönderi"
              value={data.totals.totalPosts}
              sub={`Son ${days} günde ${postsNow}`}
              icon={FileText}
              trend={trendPct(postsNow, postsPrev)}
            />
            <StatCard
              label="Takipçi"
              value={data.followerCount}
              icon={Users}
            />
            <StatCard
              label="Beğeni"
              value={data.totals.totalLikes}
              sub={`Son ${days} günde ${likesNow}`}
              icon={Heart}
              trend={trendPct(likesNow, likesPrev)}
            />
            <StatCard
              label="Boost"
              value={data.totals.totalBoosts}
              sub={`Son ${days} günde ${boostsNow}`}
              icon={Repeat2}
              trend={trendPct(boostsNow, boostsPrev)}
            />
          </div>

          {/* Secondary stats — lighter strip */}
          <SecondaryStats
            replies={data.totals.totalReplies}
            views={data.profileViewCount}
            following={data.followingCount}
          />

          {/* Charts */}
          <EngagementChart
            likesTimeline={data.likesTimeline}
            boostsTimeline={data.boostsTimeline}
            days={days}
          />
          <ActivityChart activity={activity} days={days} />

          {/* Top content */}
          <TopPosts posts={data.topPosts} />
          <TopTags   tags={data.topTags}  />

          {data.topPosts.length === 0 && data.topTags.length === 0 && (
            <EmptyState
              icon={BarChart2}
              title="Henüz yeterli veri yok"
              description="Gönderi paylaşmaya başla!"
              size="sm"
            />
          )}

          {/* Bottom padding */}
          <div className="h-6" />
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
