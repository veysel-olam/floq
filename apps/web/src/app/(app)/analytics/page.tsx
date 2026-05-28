'use client'

import { useEffect, useState, Suspense, useMemo } from 'react'
import Link from 'next/link'
import { api, type AnalyticsData } from '@/lib/api'
import { useSession } from '@/lib/auth-client'
import { cn } from '@/lib/utils'
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid,
} from 'recharts'
import {
  ChartContainer, ChartTooltip, ChartTooltipContent, ChartLegend, type ChartConfig,
} from '@/components/ui/chart'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Badge } from '@/components/ui/badge'
import {
  BarChart2, Heart, Repeat2, MessageCircle, Users,
  FileText, Hash, TrendingUp, Eye, Flame, ArrowUpRight,
} from 'lucide-react'
import { EmptyState } from '@/components/ui/empty-state'

// ── helpers ───────────────────────────────────────────────────────────────

type Range = '7' | '30' | '90'

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

function trendPct(current: number, previous: number) {
  if (previous === 0) return current > 0 ? 100 : 0
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

// ── Stat card ─────────────────────────────────────────────────────────────

function StatCard({
  label, value, sub, icon: Icon, trend, accent = false,
}: {
  label: string
  value: string | number
  sub?: string
  icon: React.ElementType
  trend?: number
  accent?: boolean
}) {
  return (
    <div className="rounded-2xl border border-(--color-border) bg-(--color-background) p-4 flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <div className={cn(
          'w-8 h-8 rounded-xl flex items-center justify-center',
          accent ? 'bg-(--color-coral)/12' : 'bg-(--color-background-secondary)',
        )}>
          <Icon className={cn('w-4 h-4', accent ? 'text-(--color-coral)' : 'text-(--color-text-tertiary)')} />
        </div>
        {trend !== undefined && (
          <span className={cn(
            'flex items-center gap-0.5 text-[11px] font-semibold px-2 py-0.5 rounded-full',
            trend >= 0
              ? 'bg-emerald-500/10 text-emerald-500'
              : 'bg-red-500/10 text-red-500',
          )}>
            <ArrowUpRight className={cn('w-3 h-3', trend < 0 && 'rotate-180')} />
            {Math.abs(trend)}%
          </span>
        )}
      </div>
      <div>
        <p className="text-2xl font-bold text-(--color-text-primary) tabular-nums leading-none" style={{ fontFamily: 'var(--font-outfit)' }}>
          {typeof value === 'number' ? fmt(value) : value}
        </p>
        <p className="text-[11px] text-(--color-text-tertiary) mt-1">{label}</p>
        {sub && <p className="text-[11px] text-(--color-text-tertiary) mt-0.5 opacity-70">{sub}</p>}
      </div>
    </div>
  )
}

// ── Engagement area chart ─────────────────────────────────────────────────

const engagementConfig: ChartConfig = {
  likes:  { label: 'Beğeni',  color: 'var(--color-coral)' },
  boosts: { label: 'Boost',   color: 'var(--color-teal)' },
}

function EngagementChart({
  likesTimeline,
  boostsTimeline,
  days,
}: {
  likesTimeline: { day: string; count: number }[]
  boostsTimeline: { day: string; count: number }[]
  days: number
}) {
  const data = useMemo(() => {
    const likesMap = new Map(buildDailyMap(likesTimeline, days).map((d) => [d.day, d.count]))
    const boostsMap = new Map(buildDailyMap(boostsTimeline, days).map((d) => [d.day, d.count]))
    const allDays = [...new Set([...likesMap.keys(), ...boostsMap.keys()])].sort()
    return allDays.map((day) => ({
      day,
      likes: likesMap.get(day) ?? 0,
      boosts: boostsMap.get(day) ?? 0,
    }))
  }, [likesTimeline, boostsTimeline, days])

  const tickInterval = days <= 7 ? 0 : days <= 30 ? 4 : 13

  return (
    <div className="rounded-2xl border border-(--color-border) bg-(--color-background) p-5">
      <div className="flex items-center justify-between mb-4">
        <div>
          <p className="text-sm font-semibold text-(--color-text-primary)" style={{ fontFamily: 'var(--font-outfit)' }}>
            Etkileşim
          </p>
          <p className="text-[11px] text-(--color-text-tertiary) mt-0.5">Günlük beğeni ve boost</p>
        </div>
        <ChartLegend config={engagementConfig} />
      </div>
      <ChartContainer config={engagementConfig} className="h-[180px] w-full aspect-auto">
        <AreaChart data={data} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
          <defs>
            <linearGradient id="grad-likes" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="var(--color-coral)" stopOpacity={0.25} />
              <stop offset="95%" stopColor="var(--color-coral)" stopOpacity={0} />
            </linearGradient>
            <linearGradient id="grad-boosts" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="var(--color-teal)" stopOpacity={0.20} />
              <stop offset="95%" stopColor="var(--color-teal)" stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid
            strokeDasharray="3 3"
            stroke="var(--color-border)"
            vertical={false}
          />
          <XAxis
            dataKey="day"
            tickLine={false}
            axisLine={false}
            tick={{ fontSize: 10, fill: 'var(--color-text-tertiary)' }}
            interval={tickInterval}
            tickFormatter={fmtDay}
          />
          <YAxis
            tickLine={false}
            axisLine={false}
            tick={{ fontSize: 10, fill: 'var(--color-text-tertiary)' }}
            allowDecimals={false}
          />
          <ChartTooltip
            content={
              <ChartTooltipContent
                labelFormatter={fmtDay}
              />
            }
          />
          <Area
            type="monotone"
            dataKey="likes"
            stroke="var(--color-coral)"
            strokeWidth={2}
            fill="url(#grad-likes)"
            dot={false}
            activeDot={{ r: 4, fill: 'var(--color-coral)', strokeWidth: 0 }}
          />
          <Area
            type="monotone"
            dataKey="boosts"
            stroke="var(--color-teal)"
            strokeWidth={2}
            fill="url(#grad-boosts)"
            dot={false}
            activeDot={{ r: 4, fill: 'var(--color-teal)', strokeWidth: 0 }}
          />
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
  activity,
  days,
}: {
  activity: { day: string; count: number }[]
  days: number
}) {
  const data = useMemo(() => buildDailyMap(activity, days), [activity, days])
  const streak = useMemo(() => calculateStreak(activity), [activity])
  const total = useMemo(() => sum(data), [data])
  const tickInterval = days <= 7 ? 0 : days <= 30 ? 4 : 13

  return (
    <div className="rounded-2xl border border-(--color-border) bg-(--color-background) p-5">
      <div className="flex items-center justify-between mb-4">
        <div>
          <p className="text-sm font-semibold text-(--color-text-primary)" style={{ fontFamily: 'var(--font-outfit)' }}>
            Gönderi Aktivitesi
          </p>
          <p className="text-[11px] text-(--color-text-tertiary) mt-0.5">
            {total > 0 ? `${total} gönderi` : 'Henüz gönderi yok'}
          </p>
        </div>
        {streak > 0 && (
          <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-orange-500/10">
            <Flame className="w-3 h-3 text-orange-500" />
            <span className="text-xs font-semibold text-orange-500 tabular-nums">{streak} gün serisi</span>
          </div>
        )}
      </div>
      <ChartContainer config={activityConfig} className="h-[140px] w-full aspect-auto">
        <AreaChart data={data} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
          <defs>
            <linearGradient id="grad-activity" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="var(--color-coral)" stopOpacity={0.20} />
              <stop offset="95%" stopColor="var(--color-coral)" stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid
            strokeDasharray="3 3"
            stroke="var(--color-border)"
            vertical={false}
          />
          <XAxis
            dataKey="day"
            tickLine={false}
            axisLine={false}
            tick={{ fontSize: 10, fill: 'var(--color-text-tertiary)' }}
            interval={tickInterval}
            tickFormatter={fmtDay}
          />
          <YAxis
            tickLine={false}
            axisLine={false}
            tick={{ fontSize: 10, fill: 'var(--color-text-tertiary)' }}
            allowDecimals={false}
          />
          <ChartTooltip
            content={<ChartTooltipContent labelFormatter={fmtDay} />}
          />
          <Area
            type="monotone"
            dataKey="count"
            stroke="var(--color-coral)"
            strokeWidth={2}
            fill="url(#grad-activity)"
            dot={false}
            activeDot={{ r: 4, fill: 'var(--color-coral)', strokeWidth: 0 }}
          />
        </AreaChart>
      </ChartContainer>
    </div>
  )
}

// ── Top posts ─────────────────────────────────────────────────────────────

function TopPosts({ posts }: { posts: AnalyticsData['topPosts'] }) {
  if (!posts.length) return null
  const maxEngagement = Math.max(...posts.map((p) => p.likesCount + p.boostsCount + p.repliesCount), 1)

  return (
    <div className="rounded-2xl border border-(--color-border) bg-(--color-background) overflow-hidden">
      <div className="px-5 pt-5 pb-3 flex items-center gap-2">
        <TrendingUp className="w-4 h-4 text-(--color-coral)" />
        <p className="text-sm font-semibold text-(--color-text-primary)" style={{ fontFamily: 'var(--font-outfit)' }}>
          En Çok Etkileşim
        </p>
      </div>
      <div className="divide-y divide-(--color-border-secondary)">
        {posts.map((post, i) => {
          const total = post.likesCount + post.boostsCount + post.repliesCount
          const pct = Math.round((total / maxEngagement) * 100)
          return (
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
                <p className="text-[13px] text-(--color-text-primary) line-clamp-2 leading-relaxed group-hover:text-(--color-coral) transition-colors">
                  {post.content || '(medya)'}
                </p>
                {/* engagement bar */}
                <div className="mt-2 h-1 rounded-full bg-(--color-background-secondary) overflow-hidden">
                  <div
                    className="h-full rounded-full bg-(--color-coral)/60 transition-all"
                    style={{ width: `${pct}%` }}
                  />
                </div>
                <div className="flex items-center gap-3 mt-1.5 text-[11px] text-(--color-text-tertiary)">
                  <span className="flex items-center gap-1"><Heart className="w-3 h-3" />{post.likesCount}</span>
                  <span className="flex items-center gap-1"><Repeat2 className="w-3 h-3" />{post.boostsCount}</span>
                  <span className="flex items-center gap-1"><MessageCircle className="w-3 h-3" />{post.repliesCount}</span>
                  <span className="ml-auto opacity-60">
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
      <div className="flex items-center gap-2 mb-4">
        <Hash className="w-4 h-4 text-(--color-coral)" />
        <p className="text-sm font-semibold text-(--color-text-primary)" style={{ fontFamily: 'var(--font-outfit)' }}>
          Sık Kullandıkların
        </p>
      </div>
      <div className="space-y-2.5">
        {tags.map(({ tag, count }) => {
          const pct = Math.round((count / max) * 100)
          return (
            <Link key={tag} href={`/hashtag/${encodeURIComponent(tag)}`} className="group block">
              <div className="flex items-center justify-between mb-1">
                <span className="text-[13px] font-medium text-(--color-text-secondary) group-hover:text-(--color-coral) transition-colors">
                  #{tag}
                </span>
                <span className="text-[11px] text-(--color-text-tertiary) tabular-nums">{count}</span>
              </div>
              <div className="h-1.5 rounded-full bg-(--color-background-secondary) overflow-hidden">
                <div
                  className="h-full rounded-full bg-(--color-coral)/50 group-hover:bg-(--color-coral)/70 transition-all"
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

// ── Main ──────────────────────────────────────────────────────────────────

function AnalyticsContent() {
  const { data: session } = useSession()
  const handle = (session?.user as { handle?: string } | undefined)?.handle
  const [data, setData] = useState<AnalyticsData | null>(null)
  const [activity, setActivity] = useState<{ day: string; count: number }[]>([])
  const [loading, setLoading] = useState(true)
  const [range, setRange] = useState<Range>('30')
  const days = parseInt(range)

  useEffect(() => {
    Promise.all([
      api.account.analytics(),
      handle ? api.actors.activity(handle) : Promise.resolve({ activity: [] }),
    ])
      .then(([analytics, act]) => {
        setData(analytics)
        setActivity(act.activity)
      })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [handle])

  // period sums for trend badges
  const likesNow  = useMemo(() => sum(filterDays(data?.likesTimeline  ?? [], days)), [data, days])
  const boostsNow = useMemo(() => sum(filterDays(data?.boostsTimeline ?? [], days)), [data, days])
  const postsNow  = useMemo(() => sum(filterDays(activity, days)), [activity, days])

  const likesPrev  = useMemo(() => sum(filterDays(data?.likesTimeline  ?? [], days * 2).slice(0, -days)), [data, days])
  const boostsPrev = useMemo(() => sum(filterDays(data?.boostsTimeline ?? [], days * 2).slice(0, -days)), [data, days])
  const postsPrev  = useMemo(() => sum(filterDays(activity, days * 2).slice(0, -days)), [activity, days])

  return (
    <div className="max-w-xl mx-auto">
      {/* Header */}
      <header className="sticky top-0 z-10 bg-(--color-background)/90 backdrop-blur-md border-b border-(--color-border)">
        <div className="px-4 py-3.5 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <BarChart2 className="w-5 h-5 text-(--color-coral)" />
            <h1 className="text-base font-bold text-(--color-text-primary)" style={{ fontFamily: 'var(--font-outfit)' }}>
              Analitik
            </h1>
          </div>
          <Tabs value={range} onValueChange={(v) => setRange(v as Range)}>
            <TabsList className="border-0 bg-(--color-background-secondary) rounded-full h-8 p-0.5">
              {(['7', '30', '90'] as Range[]).map((r) => (
                <TabsTrigger
                  key={r}
                  value={r}
                  className="rounded-full h-7 px-3 text-xs data-[state=active]:bg-(--color-background) data-[state=active]:text-(--color-coral) data-[state=active]:shadow-sm data-[state=active]:border-0 border-0"
                >
                  {r} gün
                </TabsTrigger>
              ))}
            </TabsList>
          </Tabs>
        </div>
      </header>

      {loading ? (
        <div className="px-4 py-5 space-y-4">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-32 rounded-2xl border border-(--color-border) animate-pulse bg-(--color-background-secondary)/40" />
          ))}
        </div>
      ) : !data ? (
        <EmptyState icon={BarChart2} title="Veriler yüklenemedi" size="sm" />
      ) : (
        <div className="px-4 py-5 space-y-4">

          {/* Stat cards — 2×2 */}
          <div className="grid grid-cols-2 gap-3">
            <StatCard
              label="Gönderi"
              value={data.totals.totalPosts}
              sub={`Son ${days} günde ${postsNow}`}
              icon={FileText}
              trend={trendPct(postsNow, postsPrev)}
              accent
            />
            <StatCard
              label="Takipçi"
              value={data.followerCount}
              sub={`${data.followingCount} takip edildi`}
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

          {/* Extra stats row */}
          <div className="grid grid-cols-2 gap-3">
            <StatCard
              label="Yanıt"
              value={data.totals.totalReplies}
              icon={MessageCircle}
            />
            <StatCard
              label="Profil Görüntülenme"
              value={data.profileViewCount}
              icon={Eye}
            />
          </div>

          {/* Charts */}
          <EngagementChart
            likesTimeline={data.likesTimeline}
            boostsTimeline={data.boostsTimeline}
            days={days}
          />

          <ActivityChart activity={activity} days={days} />

          {/* Top content */}
          <TopPosts posts={data.topPosts} />
          <TopTags tags={data.topTags} />

          {data.topPosts.length === 0 && data.topTags.length === 0 && (
            <EmptyState
              icon={BarChart2}
              title="Henüz yeterli veri yok"
              description="Gönderi paylaşmaya başla!"
              size="sm"
            />
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
