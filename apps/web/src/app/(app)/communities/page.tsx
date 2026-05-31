'use client'

import { useState, useEffect, useCallback } from 'react'
import Link from 'next/link'
import { Users, Lock, Globe, Search, Plus, Clock, Loader2, TrendingUp, Network, CheckCircle2, ExternalLink } from 'lucide-react'
import { api, type Community, type RemoteCommunityPreview, type RemoteCommunity } from '@/lib/api'
import { communityGradient } from '@/lib/community-colors'
import { triggerHaptic } from '@/hooks/use-haptics'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { cn } from '@/lib/utils'
import { toast } from 'sonner'


function VisibilityChip({ v }: { v: Community['visibility'] }) {
  if (v === 'public') return null
  return (
    <span className={cn(
      'inline-flex items-center gap-1 text-[10px] font-medium px-1.5 py-0.5 rounded-full',
      v === 'private'
        ? 'bg-zinc-100 dark:bg-zinc-800 text-zinc-500'
        : 'bg-amber-50 dark:bg-amber-900/20 text-amber-600 dark:text-amber-400',
    )}>
      {v === 'private' ? <Lock className="w-2.5 h-2.5" /> : <Clock className="w-2.5 h-2.5" />}
      {v === 'private' ? 'Gizli' : 'Kısıtlı'}
    </span>
  )
}

function CommunityCard({ community, onJoin }: { community: Community; onJoin: (c: Community) => void }) {
  const [joining, setJoining] = useState(false)
  const initials = community.name.slice(0, 2).toUpperCase()
  const isMember = community.viewer_status !== 'none'
  const gradient = communityGradient(community.color_index)

  async function handleJoin(e: React.MouseEvent) {
    e.preventDefault()
    e.stopPropagation()
    setJoining(true)
    try {
      const result = await api.communities.join(community.handle)
      const newStatus = result.status === 'pending' ? 'pending'
        : result.status === 'owner' ? 'owner' : 'member'
      onJoin({ ...community, viewer_status: newStatus as Community['viewer_status'] })
      void triggerHaptic(result.status === 'pending' ? 'selection' : 'medium')
      toast.success(result.status === 'pending'
        ? 'Katılma isteği gönderildi.'
        : `${community.name} topluluğuna katıldın.`)
    } catch {
      void triggerHaptic('error')
      toast.error('Bir hata oluştu.')
    } finally {
      setJoining(false)
    }
  }

  return (
    <Link href={`/c/${community.handle}`} className="group block">
      <div className="rounded-2xl border border-(--color-border) bg-(--color-background) overflow-hidden hover:border-(--color-coral)/30 hover:shadow-md hover:shadow-black/5 transition-all duration-200">
        {/* Banner */}
        <div className="relative h-20 overflow-hidden">
          {community.banner_url ? (
            <img src={community.banner_url} alt="" className="w-full h-full object-cover" />
          ) : (
            <div className="w-full h-full opacity-90" style={{ background: gradient }} />
          )}
          <div className="absolute inset-0 bg-gradient-to-t from-black/20 to-transparent" />
          <div className="absolute top-2 right-2">
            <VisibilityChip v={community.visibility} />
          </div>
        </div>

        {/* Avatar row — overlaps banner */}
        <div className="px-3 -mt-5 mb-2">
          <Avatar className="w-10 h-10 rounded-xl border-[3px] border-(--color-background) shadow-md">
            {community.avatar_url && <AvatarImage src={community.avatar_url} />}
            <AvatarFallback
              className="rounded-xl text-xs font-bold text-white"
              style={{ background: gradient }}
            >
              {initials}
            </AvatarFallback>
          </Avatar>
        </div>

        {/* Content */}
        <div className="px-3 pb-3">
          <p
            className="font-semibold text-sm text-(--color-text-primary) leading-snug mb-0.5 truncate"
            style={{ fontFamily: 'var(--font-display)' }}
          >
            {community.name}
          </p>
          {community.description ? (
            <p className="text-xs text-(--color-text-tertiary) line-clamp-2 leading-relaxed mb-2.5">
              {community.description}
            </p>
          ) : (
            <p className="text-xs text-(--color-text-tertiary) mb-2.5">@{community.handle}</p>
          )}

          <div className="flex items-center justify-between">
            <span className="flex items-center gap-1 text-xs text-(--color-text-tertiary)">
              <Users className="w-3 h-3" />
              {community.member_count > 999
                ? `${(community.member_count / 1000).toFixed(1)}B`
                : community.member_count.toLocaleString('tr')}
            </span>

            {isMember ? (
              <span className={cn(
                'text-[11px] px-2 py-1 rounded-full font-medium',
                community.viewer_status === 'owner' || community.viewer_status === 'mod'
                  ? 'bg-(--color-coral)/10 text-(--color-coral)'
                  : community.viewer_status === 'pending'
                    ? 'bg-amber-50 dark:bg-amber-900/20 text-amber-600 dark:text-amber-400'
                    : 'bg-(--color-background-secondary) text-(--color-text-secondary) border border-(--color-border)',
              )}>
                {community.viewer_status === 'owner' ? 'Sahip'
                  : community.viewer_status === 'mod' ? 'Mod'
                  : community.viewer_status === 'pending' ? 'Bekliyor'
                  : 'Üye'}
              </span>
            ) : (
              <button
                onClick={handleJoin}
                disabled={joining}
                className="text-[11px] px-3 py-1 rounded-full bg-(--color-coral) text-white font-semibold hover:bg-(--color-coral-hover) transition-colors disabled:opacity-60 flex items-center gap-1"
              >
                {joining
                  ? <Loader2 className="w-3 h-3 animate-spin" />
                  : <Plus className="w-3 h-3" />}
                {community.visibility === 'public' ? 'Katıl' : 'İstek'}
              </button>
            )}
          </div>
        </div>
      </div>
    </Link>
  )
}

function SkeletonCard() {
  return (
    <div className="rounded-2xl border border-(--color-border) bg-(--color-background) overflow-hidden animate-pulse">
      <div className="h-20 bg-(--color-background-secondary)" />
      <div className="px-3 -mt-5 mb-2">
        <div className="w-10 h-10 rounded-xl bg-(--color-background-secondary) border-2 border-(--color-background)" />
      </div>
      <div className="px-3 pb-3 space-y-2">
        <div className="h-4 w-3/4 rounded-md bg-(--color-background-secondary)" />
        <div className="h-3 w-full rounded-md bg-(--color-background-secondary)" />
        <div className="h-3 w-2/3 rounded-md bg-(--color-background-secondary)" />
      </div>
    </div>
  )
}

// Popular public Lemmy communities (Group actors) as discovery starters —
// the fediverse has no global directory, so users need handles to begin.
const SUGGESTED_COMMUNITIES = [
  '@technology@lemmy.world',
  '@asklemmy@lemmy.ml',
  '@linux@lemmy.ml',
  '@worldnews@lemmy.ml',
  '@programming@programming.dev',
  '@selfhosted@lemmy.world',
]

function FederatedTab() {
  const [remoteHandle, setRemoteHandle] = useState('')
  const [resolving, setResolving] = useState(false)
  const [preview, setPreview] = useState<RemoteCommunityPreview | null>(null)
  const [previewError, setPreviewError] = useState('')
  const [following, setFollowing] = useState(false)
  const [followedList, setFollowedList] = useState<RemoteCommunity[]>([])
  const [listLoading, setListLoading] = useState(true)

  useEffect(() => {
    api.communities.followingRemote()
      .then(setFollowedList)
      .catch(() => {})
      .finally(() => setListLoading(false))
  }, [])

  async function resolve(handleArg?: string) {
    const handle = (handleArg ?? remoteHandle).trim()
    if (!handle) return
    if (handleArg) setRemoteHandle(handleArg)
    setResolving(true)
    setPreview(null)
    setPreviewError('')
    try {
      const result = await api.communities.resolveRemote(handle)
      setPreview(result)
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Topluluk bulunamadı'
      setPreviewError(msg)
    } finally {
      setResolving(false)
    }
  }

  async function follow() {
    if (!preview) return
    setFollowing(true)
    try {
      await api.communities.followRemote(preview.id)
      setPreview({ ...preview, followStatus: 'pending' })
      toast.success('Takip isteği gönderildi. Onaylandıktan sonra gönderiler akışında görünür.')
      void triggerHaptic('medium')
    } catch { toast.error('Takip edilemedi.') }
    finally { setFollowing(false) }
  }

  async function unfollow(actorId: string) {
    try {
      await api.communities.unfollowRemote(actorId)
      setFollowedList((prev) => prev.filter((r) => r.id !== actorId))
      if (preview?.id === actorId) setPreview({ ...preview, followStatus: null })
      toast.success('Takipten çıkıldı.')
    } catch { toast.error('İşlem başarısız.') }
  }

  const n = (s: string) => s.split('').reduce((a, c) => a + c.charCodeAt(0), 0)

  return (
    <div className="p-4 space-y-5">
      {/* Arama */}
      <div className="rounded-2xl border border-(--color-border) bg-(--color-background) p-4 space-y-3">
        <div>
          <p className="text-sm font-semibold text-(--color-text-primary) mb-0.5">Uzak Topluluk Ekle</p>
          <p className="text-xs text-(--color-text-tertiary)">Lemmy, Mastodon, Misskey gibi platformlardaki toplulukları takip et.</p>
        </div>
        <div className="flex gap-2">
          <input
            type="text"
            value={remoteHandle}
            onChange={(e) => setRemoteHandle(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && void resolve()}
            placeholder="@linux@lemmy.ml"
            className="flex-1 text-sm bg-(--color-background-secondary) border border-(--color-border) rounded-xl px-3 py-2 text-(--color-text-primary) font-mono placeholder:text-(--color-text-tertiary) focus:outline-none focus:ring-2 focus:ring-(--color-coral)/20 focus:border-(--color-coral)/40"
          />
          <button
            onClick={() => void resolve()}
            disabled={resolving || !remoteHandle.trim()}
            className="flex items-center gap-1.5 text-sm px-4 py-2 rounded-xl bg-(--color-coral) text-white font-semibold hover:bg-(--color-coral-hover) disabled:opacity-50 transition-colors"
          >
            {resolving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Search className="w-3.5 h-3.5" />}
            Ara
          </button>
        </div>

        {/* Önerilen popüler topluluklar — fediverse'te global dizin yok, handle ile keşfedilir */}
        <div className="flex flex-wrap gap-1.5">
          <span className="text-xs text-(--color-text-tertiary) self-center mr-0.5">Öneriler:</span>
          {SUGGESTED_COMMUNITIES.map((h) => (
            <button
              key={h}
              onClick={() => void resolve(h)}
              disabled={resolving}
              className="text-xs font-mono px-2.5 py-1 rounded-full border border-(--color-border) text-(--color-text-secondary) hover:border-(--color-coral)/40 hover:text-(--color-coral) disabled:opacity-50 transition-colors"
            >
              {h}
            </button>
          ))}
        </div>

        {previewError && (
          <p className="text-sm text-red-500">{previewError}</p>
        )}

        {preview && (
          <div className="rounded-xl border border-(--color-border) bg-(--color-background-secondary) p-3 space-y-2.5">
            <div className="flex items-start gap-3">
              <Avatar className="w-10 h-10 rounded-xl flex-shrink-0">
                {preview.avatarUrl && <AvatarImage src={preview.avatarUrl} />}
                <AvatarFallback className="rounded-xl text-xs font-bold text-white"
                  style={{ background: communityGradient(n(preview.handle)) }}>
                  {(preview.displayName ?? preview.handle).slice(0, 2).toUpperCase()}
                </AvatarFallback>
              </Avatar>
              <div className="flex-1 min-w-0">
                <p className="font-semibold text-sm text-(--color-text-primary) truncate">{preview.displayName ?? preview.handle}</p>
                <p className="text-xs text-(--color-text-tertiary) font-mono">@{preview.handle}</p>
              </div>
              <div className="flex items-center gap-1.5 text-xs text-(--color-text-tertiary) flex-shrink-0">
                <Users className="w-3 h-3" />
                {preview.followersCount.toLocaleString('tr')}
              </div>
            </div>
            {preview.bio && (
              <p className="text-xs text-(--color-text-secondary) leading-relaxed line-clamp-2"
                dangerouslySetInnerHTML={{ __html: preview.bio.replace(/<[^>]+>/g, '') }} />
            )}
            <div className="flex items-center gap-2">
              {preview.followStatus === 'accepted' ? (
                <button
                  onClick={() => void unfollow(preview.id)}
                  className="flex items-center gap-1.5 text-xs px-3.5 py-1.5 rounded-full border border-(--color-border) text-(--color-text-secondary) hover:bg-red-50 hover:text-red-500 hover:border-red-200 dark:hover:bg-red-950/20 transition-colors"
                >
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  Takip ediliyor
                </button>
              ) : preview.followStatus === 'pending' ? (
                <span className="flex items-center gap-1.5 text-xs px-3.5 py-1.5 rounded-full bg-(--color-background) border border-(--color-border) text-(--color-text-tertiary)">
                  <Clock className="w-3.5 h-3.5" />
                  İstek gönderildi
                </span>
              ) : (
                <button
                  onClick={() => void follow()}
                  disabled={following}
                  className="flex items-center gap-1.5 text-xs px-3.5 py-1.5 rounded-full bg-(--color-coral) text-white font-semibold hover:bg-(--color-coral-hover) disabled:opacity-50 transition-colors"
                >
                  {following ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Plus className="w-3.5 h-3.5" />}
                  Takip et
                </button>
              )}
              {preview.apId && (
                <a href={preview.apId} target="_blank" rel="noopener noreferrer"
                  className="text-xs text-(--color-text-tertiary) hover:text-(--color-text-primary) flex items-center gap-1 transition-colors">
                  <ExternalLink className="w-3 h-3" />
                  Kaynağa git
                </a>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Takip edilenler */}
      {!listLoading && followedList.length > 0 && (
        <div>
          <p className="text-xs font-semibold text-(--color-text-tertiary) uppercase tracking-widest mb-2.5">Takip Ettiklerim</p>
          <div className="rounded-2xl border border-(--color-border) overflow-hidden">
            {followedList.map((r) => (
              <div key={r.id} className="flex items-center gap-3 px-3.5 py-2.5 border-b border-(--color-border-secondary) last:border-0 hover:bg-(--color-background-secondary)/40 transition-colors">
                <Avatar className="w-8 h-8 rounded-xl flex-shrink-0">
                  {r.avatarUrl && <AvatarImage src={r.avatarUrl} />}
                  <AvatarFallback className="rounded-xl text-[10px] font-bold text-white"
                    style={{ background: communityGradient(n(r.handle)) }}>
                    {(r.displayName ?? r.handle).slice(0, 2).toUpperCase()}
                  </AvatarFallback>
                </Avatar>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-(--color-text-primary) truncate">{r.displayName ?? r.handle}</p>
                  <p className="text-xs text-(--color-text-tertiary) font-mono truncate">@{r.handle}</p>
                </div>
                <button
                  onClick={() => void unfollow(r.id)}
                  className="text-xs text-(--color-text-tertiary) hover:text-red-500 px-2.5 py-1 rounded-full hover:bg-red-50 dark:hover:bg-red-950/20 transition-colors flex-shrink-0"
                >
                  Takibi bırak
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {!listLoading && followedList.length === 0 && !preview && (
        <div className="py-10 text-center">
          <Network className="w-8 h-8 text-(--color-text-tertiary) mx-auto mb-2" />
          <p className="text-sm text-(--color-text-tertiary)">Henüz uzak topluluk takip etmiyorsun.</p>
          <p className="text-xs text-(--color-text-tertiary) mt-0.5">Lemmy, Misskey veya AP destekli platformlardan topluluk ekle.</p>
        </div>
      )}
    </div>
  )
}

export default function CommunitiesPage() {
  const [communities, setCommunities] = useState<Community[]>([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState<'all' | 'joined' | 'federated'>('all')
  const [q, setQ] = useState('')

  const load = useCallback(async () => {
    if (filter === 'federated') return
    setLoading(true)
    try {
      const data = await api.communities.list({ filter: filter as 'all' | 'joined', q: q || undefined })
      setCommunities(data.communities)
    } catch {
      toast.error('Topluluklar yüklenemedi.')
    } finally {
      setLoading(false)
    }
  }, [filter, q])

  useEffect(() => { void load() }, [load])

  function handleJoin(updated: Community) {
    setCommunities((prev) => prev.map((c) => (c.id === updated.id ? updated : c)))
  }

  return (
    <div className="max-w-xl mx-auto">
      {/* Header */}
      <div className="sticky top-0 z-10 bg-(--color-background)/95 backdrop-blur-sm border-b border-(--color-border-secondary)">
        <div className="px-4 pt-3.5 pb-2.5">
          <h1 className="font-bold text-base text-(--color-text-primary)" style={{ fontFamily: 'var(--font-outfit)' }}>
            Topluluklar
          </h1>
          <p className="text-xs text-(--color-text-tertiary) -mt-0.5">Ortak ilgi alanları etrafında toplan</p>
        </div>

        {/* Search — only for local tabs */}
        {filter !== 'federated' && (
          <div className="px-4 pb-2.5">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-(--color-text-tertiary)" />
              <input
                type="text"
                placeholder="İsim veya konu ara..."
                value={q}
                onChange={(e) => setQ(e.target.value)}
                className="w-full pl-9 pr-4 py-2 text-sm rounded-full bg-(--color-background-secondary) border border-(--color-border) text-(--color-text-primary) placeholder:text-(--color-text-tertiary) focus:outline-none focus:ring-2 focus:ring-(--color-coral)/20 focus:border-(--color-coral)/40 transition-all"
              />
            </div>
          </div>
        )}

        {/* Tabs */}
        <div className="flex px-4 gap-1 pb-1">
          {([
            { key: 'all', label: 'Keşfet', icon: Globe },
            { key: 'joined', label: 'Katıldıklarım', icon: TrendingUp },
            { key: 'federated', label: 'Bağlantılı', icon: Network },
          ] as const).map(({ key, label, icon: Icon }) => (
            <button
              key={key}
              onClick={() => setFilter(key)}
              className={cn(
                'flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-sm font-medium transition-all',
                filter === key
                  ? 'bg-(--color-coral)/10 text-(--color-coral)'
                  : 'text-(--color-text-tertiary) hover:text-(--color-text-primary) hover:bg-(--color-background-secondary)',
              )}
            >
              <Icon className="w-3.5 h-3.5" />
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* Federated tab */}
      {filter === 'federated' ? <FederatedTab /> : (

      /* Local grid */
      <div className="p-4">
        {loading ? (
          <div className="grid grid-cols-2 gap-3">
            {Array.from({ length: 6 }).map((_, i) => <SkeletonCard key={i} />)}
          </div>
        ) : communities.length === 0 ? (
          <div className="py-20 text-center">
            <div className="w-16 h-16 rounded-2xl mx-auto mb-4 flex items-center justify-center"
              style={{ background: 'linear-gradient(135deg,#E8593C20,#E8593C08)' }}>
              <Users className="w-7 h-7 text-(--color-coral)" />
            </div>
            <p className="text-sm font-semibold text-(--color-text-primary) mb-1">
              {filter === 'joined' ? 'Henüz katıldığın topluluk yok' : 'Topluluk yok'}
            </p>
            <p className="text-sm text-(--color-text-tertiary) mb-5">
              {filter === 'joined'
                ? 'Keşfet sekmesinden ilginç toplulukları keşfedebilirsin.'
                : 'İlk topluluğu oluşturarak başla.'}
            </p>
            {filter === 'all' && (
              <Link
                href="/communities/new"
                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-full bg-(--color-coral) text-white text-sm font-semibold hover:bg-(--color-coral-hover) transition-colors"
              >
                <Plus className="w-4 h-4" />
                Topluluk oluştur
              </Link>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-3">
            {communities.map((c) => (
              <CommunityCard key={c.id} community={c} onJoin={handleJoin} />
            ))}
            <Link
              href="/communities/new"
              className="rounded-2xl border border-dashed border-(--color-border) hover:border-(--color-coral)/40 hover:bg-(--color-coral)/[0.02] transition-all duration-200 flex flex-col items-center justify-center gap-2 py-8 text-center group"
            >
              <div className="w-8 h-8 rounded-xl border border-dashed border-(--color-border) group-hover:border-(--color-coral)/40 flex items-center justify-center transition-colors">
                <Plus className="w-4 h-4 text-(--color-text-tertiary) group-hover:text-(--color-coral) transition-colors" />
              </div>
              <span className="text-xs text-(--color-text-tertiary) group-hover:text-(--color-coral) font-medium transition-colors leading-snug px-2">
                Kendi topluluğunu oluştur
              </span>
            </Link>
          </div>
        )}
      </div>
      )}
    </div>
  )
}
