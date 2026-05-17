'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { api, type AnalyticsData } from '@/lib/api'
import { cn } from '@/lib/utils'
import { Loader2, Heart, Repeat2, MessageCircle, Users, TrendingUp, FileText, Hash, BarChart2, Eye, UserRound } from 'lucide-react'

function StatCard({
  label, value, icon, sub, accent,
}: {
  label: string
  value: number
  icon: React.ReactNode
  sub?: string
  accent?: string
}) {
  return (
    <div className="rounded-2xl border border-(--color-border) bg-(--color-background) p-5 flex flex-col gap-3 relative overflow-hidden">
      <div className="flex items-center justify-between">
        <span className="text-xs font-semibold text-(--color-text-tertiary) uppercase tracking-widest">{label}</span>
        <span
          className="w-8 h-8 rounded-xl flex items-center justify-center"
          style={{ background: accent ? `${accent}18` : undefined, color: accent ?? 'var(--color-text-tertiary)' }}
        >
          {icon}
        </span>
      </div>
      <div>
        <p className="text-3xl font-bold text-(--color-text-primary) tabular-nums" style={{ fontFamily: 'var(--font-outfit)' }}>
          {value.toLocaleString('tr-TR')}
        </p>
        {sub && <p className="text-xs text-(--color-text-tertiary) mt-1">{sub}</p>}
      </div>
      {accent && (
        <div
          className="absolute bottom-0 left-0 right-0 h-0.5"
          style={{ background: `linear-gradient(90deg, ${accent}80, transparent)` }}
        />
      )}
    </div>
  )
}

function BarChart({ data, color, label }: {
  data: { day: string; count: number }[]
  color: string
  label: string
}) {
  const today = new Date()
  const days: { day: string; count: number }[] = []
  for (let i = 29; i >= 0; i--) {
    const d = new Date(today)
    d.setDate(d.getDate() - i)
    const key = d.toISOString().slice(0, 10)
    const found = data.find((r) => r.day === key)
    days.push({ day: key, count: found?.count ?? 0 })
  }
  const max = Math.max(...days.map((d) => d.count), 1)

  return (
    <div className="rounded-2xl border border-(--color-border) bg-(--color-background) p-5">
      <p className="text-sm font-semibold text-(--color-text-secondary) mb-4">{label}</p>
      <div className="flex items-end gap-0.5 h-20">
        {days.map((d) => {
          const pct = (d.count / max) * 100
          return (
            <div key={d.day} className="flex-1 flex flex-col items-center gap-1 group relative">
              <div
                className="w-full rounded-sm transition-all"
                style={{ height: `${Math.max(pct, 2)}%`, backgroundColor: color, opacity: pct < 4 ? 0.25 : 0.8 }}
              />
              {d.count > 0 && (
                <div className="absolute bottom-full mb-1 hidden group-hover:flex flex-col items-center pointer-events-none z-10">
                  <div className="bg-(--color-ink) text-white text-[10px] px-1.5 py-0.5 rounded-md whitespace-nowrap shadow-lg">
                    {d.day.slice(5)} · {d.count}
                  </div>
                </div>
              )}
            </div>
          )
        })}
      </div>
      <div className="flex justify-between mt-2 text-[10px] text-(--color-text-tertiary)">
        <span>{days[0]?.day.slice(5)}</span>
        <span>bugün</span>
      </div>
    </div>
  )
}

export default function AnalyticsPage() {
  const [data, setData] = useState<AnalyticsData | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    api.account.analytics()
      .then(setData)
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  return (
    <div className="max-w-2xl mx-auto">
      <header className="sticky top-0 z-10 bg-(--color-background)/90 backdrop-blur-md border-b border-(--color-border) px-4 py-3.5">
        <div className="flex items-center gap-2">
          <BarChart2 className="w-5 h-5 text-(--color-coral)" />
          <h1 className="text-base font-bold text-(--color-text-primary)" style={{ fontFamily: 'var(--font-outfit)' }}>
            Analitik
          </h1>
        </div>
        <p className="text-xs text-(--color-text-tertiary) mt-0.5">Son 30 günlük içerik performansın</p>
      </header>

      {loading ? (
        <div className="flex items-center justify-center py-32">
          <Loader2 className="w-5 h-5 animate-spin text-(--color-coral)" />
        </div>
      ) : !data ? (
        <div className="py-32 text-center text-sm text-(--color-text-tertiary)">
          Veriler yüklenemedi.
        </div>
      ) : (
        <div className="px-4 py-5 space-y-5">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <StatCard label="Gönderi" value={data.totals.totalPosts} icon={<FileText className="w-4 h-4" />} sub={`Son 7 gün: ${data.recentPostCount}`} accent="#E8593C" />
            <StatCard label="Beğeni" value={data.totals.totalLikes} icon={<Heart className="w-4 h-4" />} accent="#E8593C" />
            <StatCard label="Boost" value={data.totals.totalBoosts} icon={<Repeat2 className="w-4 h-4" />} accent="#2A9D8F" />
            <StatCard label="Yanıt" value={data.totals.totalReplies} icon={<MessageCircle className="w-4 h-4" />} accent="#6366F1" />
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <StatCard
              label="Profil Ziyareti"
              value={data.profileViewCount}
              icon={<UserRound className="w-4 h-4" />}
              sub="toplam profil görüntülenme"
              accent="#8B5CF6"
            />
            <StatCard
              label="Gönderi Görüntülenme"
              value={data.totals.totalViews}
              icon={<Eye className="w-4 h-4" />}
              sub="tüm gönderilerin toplamı"
              accent="#0EA5E9"
            />
            <StatCard
              label="Takipçi"
              value={data.followerCount}
              icon={<Users className="w-4 h-4" />}
              sub={`${data.followingCount} takip edilen`}
              accent="#F59E0B"
            />
            <StatCard
              label="Ort. Etkileşim"
              value={Number(data.totals.totalPosts > 0 ? ((data.totals.totalLikes + data.totals.totalBoosts) / data.totals.totalPosts).toFixed(1) : 0)}
              icon={<TrendingUp className="w-4 h-4" />}
              sub="beğeni + boost / gönderi"
              accent="#10B981"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <BarChart data={data.likesTimeline} color="#E8593C" label="Günlük beğeniler (30 gün)" />
            <BarChart data={data.boostsTimeline} color="#2A9D8F" label="Günlük boostlar (30 gün)" />
          </div>

          {data.topPosts.length > 0 && (
            <div className="rounded-2xl border border-(--color-border) bg-(--color-background) p-5">
              <p className="text-sm font-semibold text-(--color-text-secondary) mb-4">
                En Çok Etkileşim Alan Gönderiler
              </p>
              <div className="divide-y divide-(--color-border-secondary)">
                {data.topPosts.map((post, i) => (
                  <Link
                    key={post.id}
                    href={`/posts/${post.id}`}
                    className="flex items-start gap-3 py-3 hover:bg-(--color-background-secondary)/60 rounded-xl px-2 -mx-2 transition-colors group"
                  >
                    <span
                      className="text-lg font-bold w-6 flex-shrink-0 mt-0.5 text-center"
                      style={{ fontFamily: 'var(--font-outfit)', color: i === 0 ? '#E8593C' : undefined }}
                    >
                      {i + 1}
                    </span>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-(--color-text-primary) line-clamp-2 group-hover:text-(--color-coral) transition-colors">
                        {post.content || '(medya)'}
                      </p>
                      <div className="flex items-center gap-3 mt-1.5 text-xs text-(--color-text-tertiary)">
                        <span className="flex items-center gap-1"><Heart className="w-3 h-3" /> {post.likesCount}</span>
                        <span className="flex items-center gap-1"><Repeat2 className="w-3 h-3" /> {post.boostsCount}</span>
                        <span className="flex items-center gap-1"><MessageCircle className="w-3 h-3" /> {post.repliesCount}</span>
                        <span className="ml-auto">
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
              <p className="text-sm font-semibold text-(--color-text-secondary) mb-4 flex items-center gap-1.5">
                <Hash className="w-4 h-4 text-(--color-coral)" /> En Çok Kullandığın Hashtagler
              </p>
              <div className="flex flex-wrap gap-2">
                {data.topTags.map(({ tag, count }) => {
                  const max = data.topTags[0]?.count ?? 1
                  const pct = Math.round((count / max) * 100)
                  return (
                    <Link
                      key={tag}
                      href={`/hashtag/${tag}`}
                      className={cn(
                        'flex items-center gap-1.5 px-3 py-1.5 rounded-full border text-sm transition-colors',
                        pct === 100
                          ? 'border-(--color-coral)/40 bg-(--color-coral)/8 text-(--color-coral) font-medium hover:bg-(--color-coral)/12'
                          : 'border-(--color-border) text-(--color-text-secondary) hover:border-(--color-coral)/50 hover:text-(--color-coral)',
                      )}
                    >
                      <span>#{tag}</span>
                      <span className="text-xs text-(--color-text-tertiary)">{count}</span>
                    </Link>
                  )
                })}
              </div>
            </div>
          )}

          {data.topPosts.length === 0 && data.topTags.length === 0 && (
            <div className="rounded-2xl border border-(--color-border) bg-(--color-background-secondary)/40 p-10 text-center">
              <BarChart2 className="w-8 h-8 text-(--color-text-tertiary) mx-auto mb-3 opacity-40" />
              <p className="text-(--color-text-secondary) text-sm font-medium">Henüz yeterli veri yok</p>
              <p className="text-(--color-text-tertiary) text-xs mt-1">Gönderi paylaşmaya başla!</p>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
