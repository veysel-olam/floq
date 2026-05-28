'use client'

import { useState, useEffect, useCallback, use } from 'react'
import { useRouter } from 'next/navigation'
import {
  Users, Globe, Lock, Clock, ChevronLeft, Settings, MoreHorizontal,
  UserCheck, UserX, Shield, Loader2, FileText, Hash, Link2, RefreshCw,
  BookOpen, History, Pencil, Handshake,
} from 'lucide-react'
import { api, type Community, type Post, type Actor, type CommunityType, type CommunityFlair, type MemberTrust, type TrustLevel, type Partnership, type ConfederationVote } from '@/lib/api'
import { communityGradient } from '@/lib/community-colors'
import { useSession } from '@/lib/auth-client'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { PostCard, FLAIR_COLORS } from '@/components/posts/post-card'
import { PostComposer } from '@/components/posts/post-composer'
import { cn } from '@/lib/utils'
import { toast } from 'sonner'
import { triggerHaptic } from '@/hooks/use-haptics'


function VisibilityPill({ v }: { v: Community['visibility'] }) {
  if (v === 'public') return (
    <span className="inline-flex items-center gap-1 text-[11px] font-medium px-2 py-0.5 rounded-full bg-(--color-background-secondary) text-(--color-text-tertiary) border border-(--color-border)">
      <Globe className="w-3 h-3" />
      Açık
    </span>
  )
  if (v === 'private') return (
    <span className="inline-flex items-center gap-1 text-[11px] font-medium px-2 py-0.5 rounded-full bg-zinc-100 dark:bg-zinc-800 text-zinc-500">
      <Lock className="w-3 h-3" />
      Gizli
    </span>
  )
  return (
    <span className="inline-flex items-center gap-1 text-[11px] font-medium px-2 py-0.5 rounded-full bg-amber-50 dark:bg-amber-900/20 text-amber-600 dark:text-amber-400">
      <Clock className="w-3 h-3" />
      Kısıtlı
    </span>
  )
}

const COMMUNITY_TYPE_META: Record<CommunityType, { label: string; emoji: string }> = {
  general:  { label: 'Genel',     emoji: '💬' },
  project:  { label: 'Proje',     emoji: '🛠️' },
  event:    { label: 'Etkinlik',  emoji: '📅' },
  support:  { label: 'Destek',    emoji: '🤝' },
  learning: { label: 'Öğrenme',   emoji: '📚' },
  gaming:   { label: 'Oyun',      emoji: '🎮' },
  creative: { label: 'Yaratıcı',  emoji: '🎨' },
}

function CommunityTypePill({ type }: { type: CommunityType }) {
  if (type === 'general') return null
  const meta = COMMUNITY_TYPE_META[type]
  return (
    <span className="inline-flex items-center gap-1 text-[11px] font-medium px-2 py-0.5 rounded-full bg-(--color-background-secondary) text-(--color-text-secondary) border border-(--color-border)">
      <span>{meta.emoji}</span>
      {meta.label}
    </span>
  )
}

function JoinButton({ community, onUpdate }: { community: Community; onUpdate: (c: Community) => void }) {
  const [loading, setLoading] = useState(false)

  async function handleJoin() {
    setLoading(true)
    try {
      const result = await api.communities.join(community.handle)
      const newStatus = result.status === 'pending' ? 'pending' : result.status === 'owner' ? 'owner' : 'member'
      onUpdate({ ...community, viewer_status: newStatus as Community['viewer_status'] })
      void triggerHaptic(result.status === 'pending' ? 'selection' : 'medium')
      if (result.status === 'pending') toast.info('Katılma isteği gönderildi.')
      else toast.success(`${community.name} topluluğuna katıldın.`)
    } catch { void triggerHaptic('error'); toast.error('Bir hata oluştu.') }
    finally { setLoading(false) }
  }

  async function handleLeave() {
    setLoading(true)
    try {
      await api.communities.leave(community.handle)
      onUpdate({ ...community, viewer_status: 'none', member_count: Math.max(0, community.member_count - 1) })
      toast.success('Topluluktan ayrıldın.')
    } catch (err) {
      toast.error((err as { message?: string }).message ?? 'Bir hata oluştu.')
    }
    finally { setLoading(false) }
  }

  const { viewer_status: status } = community

  if (status === 'owner') return (
    <span className="inline-flex items-center gap-1.5 text-sm px-4 py-2 rounded-full bg-(--color-coral)/10 text-(--color-coral) font-semibold border border-(--color-coral)/20">
      <Shield className="w-3.5 h-3.5" />
      Sahip
    </span>
  )
  if (status === 'mod') return (
    <span className="inline-flex items-center gap-1.5 text-sm px-4 py-2 rounded-full bg-(--color-teal)/10 text-(--color-teal) font-semibold border border-(--color-teal)/20">
      <Shield className="w-3.5 h-3.5" />
      Moderatör
    </span>
  )
  if (status === 'pending') return (
    <button
      onClick={handleLeave}
      disabled={loading}
      className="inline-flex items-center gap-1.5 text-sm px-4 py-2 rounded-full border border-(--color-border) text-(--color-text-secondary) hover:border-red-400 hover:text-red-500 transition-colors font-medium"
    >
      {loading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Clock className="w-3.5 h-3.5" />}
      İstek Bekliyor
    </button>
  )
  if (status === 'member') return (
    <button
      onClick={handleLeave}
      disabled={loading}
      className="inline-flex items-center gap-1.5 text-sm px-4 py-2 rounded-full border border-(--color-border) text-(--color-text-secondary) hover:border-red-400 hover:text-red-500 transition-colors font-medium"
    >
      {loading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <UserCheck className="w-3.5 h-3.5" />}
      Üye
    </button>
  )
  return (
    <button
      onClick={handleJoin}
      disabled={loading}
      className="inline-flex items-center gap-1.5 text-sm px-5 py-2 rounded-full bg-(--color-coral) text-white hover:bg-(--color-coral-hover) transition-colors font-semibold shadow-sm"
    >
      {loading
        ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
        : <Users className="w-3.5 h-3.5" />}
      {community.visibility === 'public' ? 'Katıl' : 'İstek Gönder'}
    </button>
  )
}

const TRUST_META: Record<TrustLevel, { label: string; className: string }> = {
  new:     { label: 'Yeni',     className: 'bg-zinc-100 text-zinc-500 dark:bg-zinc-800 dark:text-zinc-400' },
  member:  { label: 'Üye',     className: 'bg-blue-50 text-blue-600 dark:bg-blue-950/30 dark:text-blue-400' },
  regular: { label: 'Aktif',   className: 'bg-teal-50 text-teal-600 dark:bg-teal-950/30 dark:text-teal-400' },
  trusted: { label: 'Güvenilir', className: 'bg-purple-50 text-purple-600 dark:bg-purple-950/30 dark:text-purple-400' },
  veteran: { label: 'Veteran', className: 'bg-amber-50 text-amber-600 dark:bg-amber-950/30 dark:text-amber-400' },
}

function MemberRow({
  member,
  communityHandle,
  isOwner,
  viewerHandle,
  onAction,
}: {
  member: Actor & { community_role: 'owner' | 'moderator' | 'member' }
  communityHandle: string
  isOwner: boolean
  viewerHandle: string
  onAction: () => void
}) {
  const [menuOpen, setMenuOpen] = useState(false)
  const [trustOpen, setTrustOpen] = useState(false)
  const [trust, setTrust] = useState<MemberTrust | null>(null)
  const [trustLoading, setTrustLoading] = useState(false)
  const [endorseLoading, setEndorseLoading] = useState(false)
  const initials = (member.displayName ?? member.handle).slice(0, 2).toUpperCase()
  const n = member.handle.split('').reduce((a, c) => a + c.charCodeAt(0), 0)
  const gradient = communityGradient(n)

  async function toggleTrust() {
    if (!trustOpen && !trust) {
      setTrustLoading(true)
      try {
        const data = await api.communities.memberTrust(communityHandle, member.handle)
        setTrust(data)
      } catch { /* ignore */ }
      finally { setTrustLoading(false) }
    }
    setTrustOpen((o) => !o)
  }

  async function promote() {
    try {
      await api.communities.promote(communityHandle, member.handle)
      toast.success(`@${member.handle} moderatör yapıldı.`)
      onAction()
    } catch { toast.error('Hata oluştu.') }
    setMenuOpen(false)
  }

  async function demote() {
    try {
      await api.communities.demote(communityHandle, member.handle)
      toast.success(`@${member.handle} moderatörlükten alındı.`)
      onAction()
    } catch { toast.error('Hata oluştu.') }
    setMenuOpen(false)
  }

  async function ban() {
    try {
      await api.communities.ban(communityHandle, member.handle)
      toast.success(`@${member.handle} banlandı.`)
      onAction()
    } catch { toast.error('Hata oluştu.') }
    setMenuOpen(false)
  }

  async function downloadEndorsement() {
    setEndorseLoading(true)
    try {
      const doc = await api.communities.endorsement(communityHandle, member.handle)
      const json = JSON.stringify(doc, null, 2)
      const blob = new Blob([json], { type: 'application/ld+json' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `endorsement-${communityHandle}-${member.handle}.jsonld`
      a.click()
      URL.revokeObjectURL(url)
      await navigator.clipboard.writeText(json).catch(() => {})
      toast.success('Referans mektubu indirildi ve panoya kopyalandı.')
    } catch { toast.error('Referans mektubu alınamadı.') }
    finally { setEndorseLoading(false) }
  }

  const canSeeEndorsement = viewerHandle === member.handle || isOwner

  return (
    <div className="border-b border-(--color-border-secondary) last:border-0">
      <div
        className="flex items-center gap-3 px-4 py-3 hover:bg-(--color-background-secondary)/40 transition-colors cursor-pointer"
        onClick={toggleTrust}
      >
        <Avatar className="w-9 h-9 flex-shrink-0">
          {member.avatarUrl && <AvatarImage src={member.avatarUrl} />}
          <AvatarFallback className="text-xs font-bold text-white" style={{ background: gradient }}>
            {initials}
          </AvatarFallback>
        </Avatar>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className="text-sm font-medium text-(--color-text-primary) truncate">
              {member.displayName ?? member.handle}
            </span>
            {member.community_role !== 'member' && (
              <span className={cn(
                'text-[10px] px-1.5 py-0.5 rounded-full font-semibold',
                member.community_role === 'owner'
                  ? 'bg-(--color-coral)/10 text-(--color-coral)'
                  : 'bg-(--color-teal)/10 text-(--color-teal)',
              )}>
                {member.community_role === 'owner' ? 'Sahip' : 'Mod'}
              </span>
            )}
            {trust && trust.trustLevel !== 'new' && (
              <span className={cn('text-[10px] px-1.5 py-0.5 rounded-full font-semibold', TRUST_META[trust.trustLevel].className)}>
                {TRUST_META[trust.trustLevel].label}
              </span>
            )}
            {trust && trust.badges.length > 0 && trust.badges.slice(0, 3).map((b) => (
              <span key={b.id} title={b.name} className="text-sm leading-none">{b.icon}</span>
            ))}
          </div>
          <span className="text-xs text-(--color-text-tertiary)">@{member.handle}</span>
        </div>
        {trustLoading && <Loader2 className="w-3.5 h-3.5 animate-spin text-(--color-text-tertiary) flex-shrink-0" />}
      </div>

      {trustOpen && trust && (
        <div className="mx-4 mb-3 rounded-xl border border-(--color-border) bg-(--color-background-secondary) px-3 py-2.5 space-y-2">
          <div className="flex items-center gap-4 text-xs text-(--color-text-secondary)">
            <span>Güven: <span className={cn('font-semibold px-1.5 py-0.5 rounded-full text-[11px]', TRUST_META[trust.trustLevel].className)}>{TRUST_META[trust.trustLevel].label}</span></span>
            <span>{trust.postCount} gönderi</span>
            <span>{trust.likesReceived} beğeni</span>
          </div>
          {trust.badges.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {trust.badges.map((b) => (
                <span key={b.id} title={b.description ?? b.name} className="inline-flex items-center gap-1 text-[11px] font-semibold px-2 py-0.5 rounded-full border bg-zinc-50 text-zinc-600 border-zinc-200 dark:bg-zinc-900 dark:text-zinc-300 dark:border-zinc-700">
                  {b.icon} {b.name}
                </span>
              ))}
            </div>
          )}
          {trust.alliedBadges && trust.alliedBadges.length > 0 && (
            <div className="pt-1 border-t border-(--color-border-secondary)">
              <p className="text-[10px] font-semibold text-(--color-text-tertiary) uppercase tracking-widest mb-1.5 flex items-center gap-1">
                <Handshake className="w-3 h-3" /> Müttefik Rozetler
              </p>
              <div className="flex flex-wrap gap-1.5">
                {trust.alliedBadges.map((b) => (
                  <span
                    key={`${b.id}-${b.communityHandle}`}
                    title={`${b.name} — @${b.communityHandle}`}
                    className="inline-flex items-center gap-1 text-[11px] font-semibold px-2 py-0.5 rounded-full border border-teal-200 bg-teal-50 text-teal-700 dark:border-teal-800 dark:bg-teal-950/30 dark:text-teal-300"
                  >
                    {b.icon} {b.name}
                    <span className="text-[9px] font-normal text-teal-500 dark:text-teal-400">@{b.communityHandle}</span>
                  </span>
                ))}
              </div>
            </div>
          )}
          {canSeeEndorsement && (
            <div className="pt-1 border-t border-(--color-border-secondary) flex justify-end">
              <button
                onClick={(e) => { e.stopPropagation(); downloadEndorsement() }}
                disabled={endorseLoading}
                className="inline-flex items-center gap-1.5 text-[11px] font-medium px-2.5 py-1 rounded-lg border border-(--color-border) bg-(--color-background) text-(--color-text-secondary) hover:text-(--color-text-primary) hover:bg-(--color-background-secondary) transition-colors disabled:opacity-50"
              >
                {endorseLoading ? <Loader2 className="w-3 h-3 animate-spin" /> : <FileText className="w-3 h-3" />}
                Referans Mektubu
              </button>
            </div>
          )}
        </div>
      )}

      {isOwner && member.community_role !== 'owner' && (
        <div className="px-4 pb-2 flex justify-end" onClick={(e) => e.stopPropagation()}>
          <div className="relative">
            <button
              onClick={() => setMenuOpen((o) => !o)}
              className="p-1.5 rounded-full hover:bg-(--color-background-secondary) text-(--color-text-tertiary) hover:text-(--color-text-primary) transition-colors"
            >
              <MoreHorizontal className="w-4 h-4" />
            </button>
            {menuOpen && (
              <>
                <div className="fixed inset-0 z-10" onClick={() => setMenuOpen(false)} />
                <div className="absolute right-0 top-full mt-1 z-20 w-48 bg-(--color-background) border border-(--color-border) rounded-xl shadow-xl overflow-hidden py-1">
                  {member.community_role === 'member' ? (
                    <button onClick={promote} className="flex items-center gap-2.5 w-full px-3.5 py-2.5 text-[13px] text-(--color-text-primary) hover:bg-(--color-background-secondary) transition-colors">
                      <Shield className="w-3.5 h-3.5 text-(--color-teal)" />
                      Moderatör yap
                    </button>
                  ) : (
                    <button onClick={demote} className="flex items-center gap-2.5 w-full px-3.5 py-2.5 text-[13px] text-(--color-text-primary) hover:bg-(--color-background-secondary) transition-colors">
                      <UserCheck className="w-3.5 h-3.5 text-(--color-text-tertiary)" />
                      Moderatörlüğü kaldır
                    </button>
                  )}
                  <div className="my-1 border-t border-(--color-border-secondary)" />
                  <button onClick={ban} className="flex items-center gap-2.5 w-full px-3.5 py-2.5 text-[13px] text-red-500 hover:bg-red-500/5 transition-colors">
                    <UserX className="w-3.5 h-3.5" />
                    Banla
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

type Tab = 'posts' | 'wiki' | 'members' | 'allied' | 'votes' | 'about'

type WikiData = {
  content: string
  version: number
  editedAt: string | null
  editedBy: { handle: string; displayName: string | null } | null
}

function InvitePanel({
  community,
  onRevoke,
}: {
  community: Community
  onRevoke: () => void
}) {
  const [inviteUrl, setInviteUrl] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [revoking, setRevoking] = useState(false)

  async function generateInvite() {
    setLoading(true)
    try {
      const result = await api.communities.getInvite(community.handle)
      setInviteUrl(result.url)
    } catch { toast.error('Davet linki oluşturulamadı.') }
    finally { setLoading(false) }
  }

  async function copyInvite() {
    if (!inviteUrl) await generateInvite()
    const url = inviteUrl ?? (await api.communities.getInvite(community.handle).then(r => r.url).catch(() => null))
    if (!url) return
    await navigator.clipboard.writeText(url)
    toast.success('Davet linki kopyalandı!')
  }

  async function revokeInvite() {
    setRevoking(true)
    try {
      await api.communities.revokeInvite(community.handle)
      setInviteUrl(null)
      onRevoke()
      toast.success('Davet linki iptal edildi.')
    } catch { toast.error('İptal edilemedi.') }
    finally { setRevoking(false) }
  }

  return (
    <div className="rounded-2xl border border-(--color-border) bg-(--color-background) p-4">
      <h3 className="text-xs font-semibold text-(--color-text-tertiary) uppercase tracking-widest mb-3">Davet Linki</h3>
      <p className="text-xs text-(--color-text-tertiary) mb-3 leading-relaxed">
        Davet linki ile topluluğa katılım onayı gerektirmez — linki güvendiğin kişilerle paylaş.
      </p>
      <div className="flex gap-2">
        <button
          onClick={copyInvite}
          disabled={loading}
          className="flex items-center gap-1.5 text-sm px-4 py-2 rounded-full bg-(--color-coral) text-white hover:bg-(--color-coral-hover) transition-colors font-semibold disabled:opacity-50"
        >
          {loading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Link2 className="w-3.5 h-3.5" />}
          {community.invite_token ? 'Linki Kopyala' : 'Link Oluştur'}
        </button>
        {community.invite_token && community.viewer_status === 'owner' && (
          <button
            onClick={revokeInvite}
            disabled={revoking}
            className="flex items-center gap-1.5 text-sm px-3 py-2 rounded-full border border-(--color-border) text-(--color-text-tertiary) hover:border-red-400 hover:text-red-500 transition-colors"
          >
            {revoking ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5" />}
            İptal et
          </button>
        )}
      </div>
    </div>
  )
}

function VoteCard({
  vote,
  communityHandle,
  isMember,
  canManage,
  onVoted,
  onDelete,
}: {
  vote: ConfederationVote
  communityHandle: string
  isMember: boolean
  canManage: boolean
  onVoted: (updated: ConfederationVote) => void
  onDelete: (id: string) => void
}) {
  const [casting, setCasting] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const total = vote.totalVotes

  async function castBallot(idx: number) {
    if (!isMember || vote.closed || casting) return
    setCasting(true)
    try {
      await api.communities.castBallot(communityHandle, vote.id, idx)
      onVoted({
        ...vote,
        myVote: idx,
        totalVotes: vote.myVote === null ? total + 1 : total,
        options: vote.options.map((o) =>
          o.index === idx
            ? { ...o, count: o.count + 1 }
            : vote.myVote === o.index
            ? { ...o, count: Math.max(0, o.count - 1) }
            : o,
        ),
      })
    } catch { toast.error('Oy verilemedi.') }
    finally { setCasting(false) }
  }

  async function deleteVote() {
    setDeleting(true)
    try {
      await api.communities.deleteVote(communityHandle, vote.id)
      onDelete(vote.id)
    } catch { toast.error('Silinemedi.') }
    finally { setDeleting(false) }
  }

  const maxCount = Math.max(...vote.options.map((o) => o.count), 1)

  return (
    <div className={cn('rounded-2xl border p-4 space-y-3', vote.closed ? 'border-(--color-border) bg-(--color-background-secondary)/40' : 'border-(--color-border) bg-(--color-background)')}>
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-0.5">
            {vote.closed ? (
              <span className="text-[10px] font-semibold uppercase tracking-widest text-(--color-text-tertiary) bg-(--color-background-secondary) px-2 py-0.5 rounded-full">Kapandı</span>
            ) : (
              <span className="text-[10px] font-semibold uppercase tracking-widest text-green-600 dark:text-green-400 bg-green-50 dark:bg-green-950/30 px-2 py-0.5 rounded-full">Aktif</span>
            )}
            {!vote.isInitiator && vote.initiator && (
              <span className="text-[11px] text-(--color-text-tertiary)">@{vote.initiator.handle}</span>
            )}
          </div>
          <h3 className="font-semibold text-(--color-text-primary) text-sm leading-snug">{vote.title}</h3>
          {vote.description && (
            <p className="text-xs text-(--color-text-secondary) mt-1 leading-relaxed">{vote.description}</p>
          )}
        </div>
        {canManage && vote.isInitiator && (
          <button
            onClick={deleteVote}
            disabled={deleting}
            className="p-1.5 rounded-lg text-(--color-text-tertiary) hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-950/20 transition-colors flex-shrink-0"
          >
            {deleting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <MoreHorizontal className="w-3.5 h-3.5" />}
          </button>
        )}
      </div>

      <div className="space-y-2">
        {vote.options.map((opt) => {
          const pct = total > 0 ? Math.round((opt.count / total) * 100) : 0
          const isMyVote = vote.myVote === opt.index
          const isWinner = !vote.closed ? false : opt.count === maxCount
          return (
            <button
              key={opt.index}
              onClick={() => void castBallot(opt.index)}
              disabled={!isMember || vote.closed || vote.myVote !== null || casting}
              className={cn(
                'w-full text-left rounded-xl border transition-all overflow-hidden relative',
                isMyVote ? 'border-(--color-coral)' : 'border-(--color-border)',
                (!isMember || vote.closed || vote.myVote !== null) ? 'cursor-default' : 'hover:border-(--color-coral)/50 cursor-pointer',
              )}
            >
              {(vote.myVote !== null || vote.closed) && (
                <div
                  className={cn('absolute inset-y-0 left-0 transition-all', isMyVote ? 'bg-(--color-coral)/15' : isWinner ? 'bg-amber-400/10' : 'bg-(--color-background-secondary)')}
                  style={{ width: `${pct}%` }}
                />
              )}
              <div className="relative px-3 py-2 flex items-center justify-between gap-2">
                <span className={cn('text-sm', isMyVote ? 'font-semibold text-(--color-coral)' : 'text-(--color-text-primary)')}>
                  {isMyVote && <span className="mr-1">✓</span>}
                  {opt.text}
                </span>
                {(vote.myVote !== null || vote.closed) && (
                  <span className="text-xs text-(--color-text-tertiary) font-medium flex-shrink-0">{pct}%</span>
                )}
              </div>
            </button>
          )
        })}
      </div>

      <div className="flex items-center gap-3 text-[11px] text-(--color-text-tertiary)">
        <span>{total} oy</span>
        <span>·</span>
        <span>{vote.closed ? 'Kapandı' : `${new Date(vote.closesAt).toLocaleDateString('tr')} kapanıyor`}</span>
      </div>
    </div>
  )
}

export default function CommunityPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = use(params)
  const router = useRouter()
  const { data: session } = useSession()
  const handle = (session?.user as { handle?: string } | undefined)?.handle ?? ''
  const displayName = session?.user.name ?? ''
  const [community, setCommunity] = useState<Community | null>(null)
  const [posts, setPosts] = useState<Post[]>([])
  const [pinnedPost, setPinnedPost] = useState<Post | null>(null)
  const [members, setMembers] = useState<(Actor & { community_role: 'owner' | 'moderator' | 'member' })[]>([])
  const [wiki, setWiki] = useState<WikiData | null>(null)
  const [wikiLoading, setWikiLoading] = useState(false)
  const [tab, setTab] = useState<Tab>('posts')
  const [loading, setLoading] = useState(true)
  const [feedLoading, setFeedLoading] = useState(false)
  const [cursor, setCursor] = useState<string | null>(null)
  const [flairFilter, setFlairFilter] = useState<CommunityFlair | null>(null)
  const [partnerships, setPartnerships] = useState<Partnership[] | null>(null)
  const [alliedPosts, setAlliedPosts] = useState<Post[]>([])
  const [alliedCursor, setAlliedCursor] = useState<string | null>(null)
  const [alliedLoading, setAlliedLoading] = useState(false)
  const [votes, setVotes] = useState<ConfederationVote[] | null>(null)
  const [votesLoading, setVotesLoading] = useState(false)

  const loadCommunity = useCallback(async () => {
    try {
      const c = await api.communities.get(slug)
      setCommunity(c)
      if (c.pinned_post_id) {
        api.posts.get(c.pinned_post_id).then(setPinnedPost).catch(() => {})
      }
    } catch {
      toast.error('Topluluk bulunamadı.')
      router.push('/communities')
    } finally {
      setLoading(false)
    }
  }, [slug, router])

  const loadFeed = useCallback(async (append = false, flair?: CommunityFlair | null) => {
    if (!append) setFeedLoading(true)
    const activeFlair = flair !== undefined ? flair : flairFilter
    try {
      const data = await api.communities.feed(
        slug,
        append ? cursor ?? undefined : undefined,
        activeFlair?.id,
      )
      setPosts((prev) => append ? [...prev, ...data.posts] : data.posts)
      setCursor(data.next_cursor)
    } catch { toast.error('Gönderiler yüklenemedi.') }
    finally { setFeedLoading(false) }
  }, [slug, cursor, flairFilter])

  const loadMembers = useCallback(async () => {
    try {
      const data = await api.communities.members(slug)
      setMembers(data)
    } catch { }
  }, [slug])

  useEffect(() => { void loadCommunity() }, [loadCommunity])

  const loadWiki = useCallback(async () => {
    if (wiki) return
    setWikiLoading(true)
    try {
      const data = await api.communities.wiki(slug)
      setWiki(data)
    } catch { }
    finally { setWikiLoading(false) }
  }, [slug, wiki])

  const loadAlliedFeed = useCallback(async (append = false) => {
    if (!append) setAlliedLoading(true)
    try {
      const data = await api.communities.alliedFeed(slug, append ? alliedCursor ?? undefined : undefined)
      setAlliedPosts((prev) => append ? [...prev, ...data.posts] : data.posts)
      setAlliedCursor(data.next_cursor)
    } catch { }
    finally { setAlliedLoading(false) }
  }, [slug, alliedCursor])

  useEffect(() => {
    if (tab === 'posts') void loadFeed()
    if (tab === 'members') void loadMembers()
    if (tab === 'wiki') void loadWiki()
    if (tab === 'allied' && alliedPosts.length === 0) void loadAlliedFeed()
    if (tab === 'votes' && votes === null) {
      setVotesLoading(true)
      api.communities.votes(slug).then(setVotes).catch(() => setVotes([])).finally(() => setVotesLoading(false))
    }
    if (tab === 'about' && partnerships === null) {
      api.communities.partnerships(slug).then(setPartnerships).catch(() => setPartnerships([]))
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab, slug])

  if (loading) {
    return (
      <div className="max-w-xl mx-auto animate-pulse">
        <div className="h-40 bg-(--color-background-secondary)" />
        <div className="px-4 -mt-8 mb-4 flex items-end justify-between">
          <div className="w-16 h-16 rounded-2xl bg-(--color-background-secondary) border-4 border-(--color-background)" />
          <div className="h-9 w-20 rounded-full bg-(--color-background-secondary)" />
        </div>
        <div className="px-4 space-y-2 mb-4">
          <div className="h-5 w-40 rounded-md bg-(--color-background-secondary)" />
          <div className="h-3.5 w-64 rounded-md bg-(--color-background-secondary)" />
        </div>
      </div>
    )
  }
  if (!community) return null

  const gradient = communityGradient(community.color_index)
  const isMember = community.viewer_status !== 'none'
  const canManage = community.viewer_status === 'owner' || community.viewer_status === 'mod'
  const isOwner = community.viewer_status === 'owner'

  const rules = community.rules
    ? community.rules.split('\n').map((r) => r.trim()).filter(Boolean)
    : []

  return (
    <div className="max-w-xl mx-auto">
      {/* Sticky minimal top bar */}
      <div className="sticky top-0 z-20 bg-(--color-background)/90 backdrop-blur-sm border-b border-(--color-border-secondary)">
        <div className="flex items-center gap-2 px-3 py-2.5">
          <button
            onClick={() => router.back()}
            className="p-1.5 rounded-full hover:bg-(--color-background-secondary) transition-colors text-(--color-text-tertiary)"
          >
            <ChevronLeft className="w-5 h-5" />
          </button>
          <div className="flex-1 min-w-0">
            <p className="font-bold text-sm text-(--color-text-primary) truncate leading-tight" style={{ fontFamily: 'var(--font-display)' }}>
              {community.name}
            </p>
            <p className="text-[11px] text-(--color-text-tertiary) leading-tight">
              {community.member_count.toLocaleString('tr')} üye
            </p>
          </div>
          {canManage && (
            <button
              onClick={() => router.push(`/c/${slug}/settings`)}
              className="p-1.5 rounded-full hover:bg-(--color-background-secondary) transition-colors text-(--color-text-tertiary)"
            >
              <Settings className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>

      {/* Banner — full bleed */}
      <div className="relative h-40 overflow-hidden">
        {community.banner_url ? (
          <img src={community.banner_url} alt="" className="w-full h-full object-cover" />
        ) : (
          <div className="w-full h-full" style={{ background: gradient }} />
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-black/30 to-transparent" />
      </div>

      {/* Profile section */}
      <div className="px-4 -mt-8 mb-1">
        <div className="flex items-end justify-between mb-3">
          <Avatar className="w-16 h-16 rounded-2xl border-4 border-(--color-background) shadow-md flex-shrink-0">
            {community.avatar_url && <AvatarImage src={community.avatar_url} />}
            <AvatarFallback
              className="rounded-2xl text-lg font-bold text-white"
              style={{ background: gradient }}
            >
              {community.name.slice(0, 2).toUpperCase()}
            </AvatarFallback>
          </Avatar>
          <div className="mb-1">
            <JoinButton community={community} onUpdate={setCommunity} />
          </div>
        </div>

        <div className="space-y-1 mb-3">
          <div className="flex items-center gap-2 flex-wrap">
            <h1 className="font-bold text-xl text-(--color-text-primary) leading-tight" style={{ fontFamily: 'var(--font-display)' }}>
              {community.name}
            </h1>
            <VisibilityPill v={community.visibility} />
            <CommunityTypePill type={community.community_type} />
          </div>
          <p className="text-sm text-(--color-text-tertiary)">@{community.handle}</p>
          {community.description && (
            <p className="text-sm text-(--color-text-secondary) leading-relaxed pt-0.5">
              {community.description}
            </p>
          )}
        </div>

        {/* Stats row */}
        <div className="flex items-center gap-4 py-2.5 border-t border-(--color-border-secondary)">
          <div className="flex items-center gap-1.5 text-sm">
            <Users className="w-4 h-4 text-(--color-text-tertiary)" />
            <span className="font-semibold text-(--color-text-primary)">
              {community.member_count > 999
                ? `${(community.member_count / 1000).toFixed(1)}B`
                : community.member_count.toLocaleString('tr')}
            </span>
            <span className="text-(--color-text-tertiary)">üye</span>
          </div>
          {community.post_count !== undefined && (
            <div className="flex items-center gap-1.5 text-sm">
              <FileText className="w-4 h-4 text-(--color-text-tertiary)" />
              <span className="font-semibold text-(--color-text-primary)">
                {community.post_count > 999
                  ? `${(community.post_count / 1000).toFixed(1)}B`
                  : community.post_count.toLocaleString('tr')}
              </span>
              <span className="text-(--color-text-tertiary)">gönderi</span>
            </div>
          )}
        </div>
      </div>

      {/* Tabs */}
      <div className="sticky top-[52px] z-10 bg-(--color-background) border-b border-(--color-border-secondary)">
        <div className="flex">
          {([
            { key: 'posts' as Tab, label: 'Gönderiler' },
            { key: 'wiki' as Tab, label: 'Wiki' },
            { key: 'members' as Tab, label: 'Üyeler' },
            { key: 'allied' as Tab, label: 'Müttefikler' },
            { key: 'votes' as Tab, label: 'Oylamalar' },
            { key: 'about' as Tab, label: 'Hakkında' },
          ]).map(({ key, label }) => (
            <button
              key={key}
              onClick={() => setTab(key)}
              className={cn(
                'flex-1 py-3 text-sm font-medium transition-colors border-b-2',
                tab === key
                  ? 'border-(--color-coral) text-(--color-coral)'
                  : 'border-transparent text-(--color-text-tertiary) hover:text-(--color-text-primary)',
              )}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* Tab: Posts */}
      {tab === 'posts' && (
        <>
          {isMember && (
            <div className="border-b border-(--color-border-secondary)">
              <PostComposer
                handle={handle}
                displayName={displayName}
                onPost={(post) => setPosts((prev) => [post, ...prev])}
                defaultGroupHandle={community.handle}
                communityTemplates={community.post_templates}
                communityFlairs={community.flairs}
              />
            </div>
          )}

          {community.flairs.length > 0 && (
            <div className="flex items-center gap-2 px-4 py-2.5 border-b border-(--color-border-secondary) overflow-x-auto scrollbar-none">
              <button
                onClick={() => {
                  setFlairFilter(null)
                  void loadFeed(false, null)
                }}
                className={cn(
                  'flex-shrink-0 text-[12px] font-semibold px-3 py-1 rounded-full border transition-colors',
                  flairFilter === null
                    ? 'bg-(--color-coral) border-(--color-coral) text-white'
                    : 'border-(--color-border) text-(--color-text-tertiary) hover:border-(--color-coral) hover:text-(--color-coral)',
                )}
              >
                Tümü
              </button>
              {community.flairs.map((flair) => {
                const colorCls = FLAIR_COLORS[flair.color] ?? FLAIR_COLORS.coral
                const isActive = flairFilter?.id === flair.id
                return (
                  <button
                    key={flair.id}
                    onClick={() => {
                      const next = isActive ? null : flair
                      setFlairFilter(next)
                      void loadFeed(false, next)
                    }}
                    className={cn(
                      'flex-shrink-0 inline-flex items-center gap-1 text-[12px] font-semibold px-3 py-1 rounded-full border transition-colors',
                      isActive ? colorCls : 'border-(--color-border) text-(--color-text-tertiary) hover:border-(--color-coral) hover:text-(--color-coral)',
                    )}
                  >
                    {flair.emoji && <span>{flair.emoji}</span>}
                    {flair.name}
                  </button>
                )
              })}
            </div>
          )}

          {feedLoading ? (
            <div className="py-16 flex justify-center">
              <Loader2 className="w-5 h-5 animate-spin text-(--color-text-tertiary)" />
            </div>
          ) : posts.length === 0 && !pinnedPost ? (
            <div className="py-20 text-center px-6">
              <div
                className="w-14 h-14 rounded-2xl mx-auto mb-4 flex items-center justify-center"
                style={{ background: `${gradient.replace('linear-gradient(135deg,', 'linear-gradient(135deg,').split(',')[0]},${gradient.split(',')[1].replace(')', '')}18)` }}
              >
                <FileText className="w-6 h-6 text-(--color-coral)" />
              </div>
              <p className="font-semibold text-(--color-text-primary) mb-1">
                {isMember ? 'Henüz gönderi yok' : 'Gönderileri görmek için katıl'}
              </p>
              <p className="text-sm text-(--color-text-tertiary)">
                {isMember ? 'İlk gönderiyi sen paylaş!' : 'Topluluğa katılarak gönderileri görebilirsin.'}
              </p>
            </div>
          ) : (
            <>
              {pinnedPost && (
                <div className="border-b border-(--color-border-secondary) bg-(--color-coral)/[0.03]">
                  <PostCard
                    post={pinnedPost}
                    pinned
                    onDelete={() => { setCommunity((c) => c ? { ...c, pinned_post_id: null } : c); setPinnedPost(null) }}
                    onEdit={(updated) => setPinnedPost(updated)}
                    communityPin={canManage ? {
                      isPinned: true,
                      onToggle: async () => {
                        await api.communities.unpin(slug)
                        setCommunity((c) => c ? { ...c, pinned_post_id: null } : c)
                        setPinnedPost(null)
                        toast.success('Sabitleme kaldırıldı.')
                      },
                    } : undefined}
                  />
                </div>
              )}
              {posts.filter((p) => p.id !== pinnedPost?.id).map((post) => (
                <PostCard
                  key={post.id}
                  post={post}
                  onDelete={(id) => setPosts((prev) => prev.filter((p) => p.id !== id))}
                  onReply={(newPost) => setPosts((prev) => [newPost, ...prev])}
                  onEdit={(updated) => setPosts((prev) => prev.map((p) => p.id === updated.id ? updated : p))}
                  communityPin={canManage ? {
                    isPinned: community.pinned_post_id === post.id,
                    onToggle: async () => {
                      if (community.pinned_post_id === post.id) {
                        await api.communities.unpin(slug)
                        setCommunity((c) => c ? { ...c, pinned_post_id: null } : c)
                        setPinnedPost(null)
                        toast.success('Sabitleme kaldırıldı.')
                      } else {
                        await api.communities.pin(slug, post.id)
                        setCommunity((c) => c ? { ...c, pinned_post_id: post.id } : c)
                        setPinnedPost(post)
                        toast.success('Gönderi sabitlendi.')
                      }
                    },
                  } : undefined}
                />
              ))}
              {cursor && (
                <div className="py-5 flex justify-center">
                  <button
                    onClick={() => void loadFeed(true)}
                    className="text-sm text-(--color-coral) font-medium hover:underline"
                  >
                    Daha fazla yükle
                  </button>
                </div>
              )}
            </>
          )}
        </>
      )}

      {/* Tab: Wiki */}
      {tab === 'wiki' && (
        <div className="p-4">
          {wikiLoading ? (
            <div className="py-16 flex justify-center">
              <Loader2 className="w-5 h-5 animate-spin text-(--color-text-tertiary)" />
            </div>
          ) : !wiki || (!wiki.content && !canManage) ? (
            <div className="py-20 text-center">
              <BookOpen className="w-10 h-10 text-(--color-text-tertiary) mx-auto mb-3 opacity-40" />
              <p className="font-semibold text-(--color-text-primary) mb-1">Wiki henüz oluşturulmamış</p>
              {canManage ? (
                <button
                  onClick={() => router.push(`/c/${slug}/settings?tab=wiki`)}
                  className="mt-3 text-sm text-(--color-coral) font-medium hover:underline flex items-center gap-1.5 mx-auto"
                >
                  <Pencil className="w-3.5 h-3.5" />
                  Wiki oluştur
                </button>
              ) : (
                <p className="text-sm text-(--color-text-tertiary)">Moderatörler yakında ekleyecek.</p>
              )}
            </div>
          ) : (
            <div>
              <div className="rounded-2xl border border-(--color-border) bg-(--color-background) overflow-hidden">
                <div className="px-4 py-3 border-b border-(--color-border-secondary) flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <BookOpen className="w-4 h-4 text-(--color-coral)" />
                    <span className="text-sm font-semibold text-(--color-text-primary)">Wiki</span>
                    {wiki.version > 0 && (
                      <span className="text-[11px] text-(--color-text-tertiary)">v{wiki.version}</span>
                    )}
                  </div>
                  {canManage && (
                    <button
                      onClick={() => router.push(`/c/${slug}/settings?tab=wiki`)}
                      className="flex items-center gap-1 text-xs text-(--color-coral) font-medium hover:underline"
                    >
                      <Pencil className="w-3 h-3" />
                      Düzenle
                    </button>
                  )}
                </div>
                <div className="px-4 py-4 prose prose-sm max-w-none text-(--color-text-secondary) leading-relaxed whitespace-pre-wrap text-[14px]">
                  {wiki.content}
                </div>
              </div>
              {wiki.editedBy && wiki.editedAt && (
                <p className="text-[11px] text-(--color-text-tertiary) mt-2 text-right">
                  Son düzenleme: @{wiki.editedBy.handle} · {new Date(wiki.editedAt).toLocaleDateString('tr')}
                </p>
              )}
            </div>
          )}
        </div>
      )}

      {/* Tab: Allied Feed */}
      {tab === 'allied' && (
        <>
          {alliedLoading ? (
            <div className="py-16 flex justify-center">
              <Loader2 className="w-5 h-5 animate-spin text-(--color-text-tertiary)" />
            </div>
          ) : alliedPosts.length === 0 ? (
            <div className="py-20 text-center px-6">
              <div className="w-14 h-14 rounded-2xl mx-auto mb-4 flex items-center justify-center bg-(--color-background-secondary)">
                <Handshake className="w-6 h-6 text-(--color-text-tertiary)" />
              </div>
              <p className="font-semibold text-(--color-text-primary) mb-1">Müttefik gönderi yok</p>
              <p className="text-sm text-(--color-text-tertiary)">
                Aktif ittifak kurduğun toplulukların gönderileri burada görünür.
              </p>
            </div>
          ) : (
            <>
              {alliedPosts.map((post) => (
                <PostCard
                  key={post.id}
                  post={post}
                  onDelete={(id) => setAlliedPosts((prev) => prev.filter((p) => p.id !== id))}
                  onReply={(newPost) => setAlliedPosts((prev) => [newPost, ...prev])}
                  onEdit={(updated) => setAlliedPosts((prev) => prev.map((p) => p.id === updated.id ? updated : p))}
                />
              ))}
              {alliedCursor && (
                <div className="py-5 flex justify-center">
                  <button
                    onClick={() => void loadAlliedFeed(true)}
                    className="text-sm text-(--color-coral) font-medium hover:underline"
                  >
                    Daha fazla yükle
                  </button>
                </div>
              )}
            </>
          )}
        </>
      )}

      {/* Tab: Members */}
      {tab === 'members' && (
        <div>
          {members.length === 0 ? (
            <div className="py-20 text-center">
              <div className="w-14 h-14 rounded-2xl mx-auto mb-4 flex items-center justify-center bg-(--color-background-secondary)">
                <Users className="w-6 h-6 text-(--color-text-tertiary)" />
              </div>
              <p className="text-sm text-(--color-text-tertiary)">Üye bulunamadı.</p>
            </div>
          ) : (
            <div className="divide-y divide-(--color-border-secondary)">
              {members.map((m) => (
                <MemberRow
                  key={m.id}
                  member={m}
                  communityHandle={slug}
                  isOwner={isOwner}
                  viewerHandle={handle}
                  onAction={loadMembers}
                />
              ))}
            </div>
          )}
        </div>
      )}

      {/* Tab: Votes */}
      {tab === 'votes' && (
        <div className="p-4 space-y-3">
          {votesLoading ? (
            <div className="flex justify-center py-12">
              <Loader2 className="w-5 h-5 animate-spin text-(--color-text-tertiary)" />
            </div>
          ) : !votes || votes.length === 0 ? (
            <div className="py-16 text-center rounded-2xl border border-dashed border-(--color-border)">
              <span className="text-3xl">🗳️</span>
              <p className="font-semibold text-(--color-text-primary) mt-3 mb-1">Oylama yok</p>
              <p className="text-sm text-(--color-text-tertiary)">
                {canManage
                  ? 'Müttefik topluluklarla ortak oylama başlatabilirsin.'
                  : 'Henüz aktif oylama başlatılmamış.'}
              </p>
            </div>
          ) : (
            votes.map((vote) => (
              <VoteCard
                key={vote.id}
                vote={vote}
                communityHandle={slug}
                isMember={isMember}
                canManage={canManage}
                onVoted={(updated) => setVotes((prev) => prev?.map((v) => v.id === updated.id ? updated : v) ?? prev)}
                onDelete={(id) => setVotes((prev) => prev?.filter((v) => v.id !== id) ?? prev)}
              />
            ))
          )}
        </div>
      )}

      {/* Tab: About */}
      {tab === 'about' && (
        <div className="p-4 space-y-4">
          {canManage && (
            <InvitePanel
              community={community}
              onRevoke={() => setCommunity((c) => c ? { ...c, invite_token: null } : c)}
            />
          )}
          {community.description && (
            <div className="rounded-2xl border border-(--color-border) bg-(--color-background) p-4">
              <h3 className="text-xs font-semibold text-(--color-text-tertiary) uppercase tracking-widest mb-2.5">Hakkında</h3>
              <p className="text-sm text-(--color-text-secondary) leading-relaxed">{community.description}</p>
            </div>
          )}

          <div className="rounded-2xl border border-(--color-border) bg-(--color-background) p-4">
            <h3 className="text-xs font-semibold text-(--color-text-tertiary) uppercase tracking-widest mb-3">Bilgiler</h3>
            <div className="space-y-2.5">
              <div className="flex items-center gap-3 text-sm">
                <div className="w-8 h-8 rounded-xl bg-(--color-background-secondary) flex items-center justify-center flex-shrink-0">
                  <Users className="w-4 h-4 text-(--color-text-tertiary)" />
                </div>
                <div>
                  <span className="font-semibold text-(--color-text-primary)">{community.member_count.toLocaleString('tr')}</span>
                  <span className="text-(--color-text-tertiary) ml-1">üye</span>
                </div>
              </div>
              {community.post_count !== undefined && (
                <div className="flex items-center gap-3 text-sm">
                  <div className="w-8 h-8 rounded-xl bg-(--color-background-secondary) flex items-center justify-center flex-shrink-0">
                    <FileText className="w-4 h-4 text-(--color-text-tertiary)" />
                  </div>
                  <div>
                    <span className="font-semibold text-(--color-text-primary)">{community.post_count.toLocaleString('tr')}</span>
                    <span className="text-(--color-text-tertiary) ml-1">gönderi</span>
                  </div>
                </div>
              )}
              <div className="flex items-center gap-3 text-sm">
                <div className="w-8 h-8 rounded-xl bg-(--color-background-secondary) flex items-center justify-center flex-shrink-0">
                  <Hash className="w-4 h-4 text-(--color-text-tertiary)" />
                </div>
                <div>
                  <span className="font-mono text-xs text-(--color-text-secondary)">@{community.handle}</span>
                </div>
              </div>
              <div className="flex items-center gap-3 text-sm">
                <div className="w-8 h-8 rounded-xl bg-(--color-background-secondary) flex items-center justify-center flex-shrink-0">
                  {community.visibility === 'private'
                    ? <Lock className="w-4 h-4 text-(--color-text-tertiary)" />
                    : community.visibility === 'restricted'
                    ? <Clock className="w-4 h-4 text-(--color-text-tertiary)" />
                    : <Globe className="w-4 h-4 text-(--color-text-tertiary)" />}
                </div>
                <div>
                  <span className="text-(--color-text-primary) font-medium">
                    {community.visibility === 'private' ? 'Gizli'
                      : community.visibility === 'restricted' ? 'Kısıtlı'
                      : 'Açık'} topluluk
                  </span>
                  <p className="text-xs text-(--color-text-tertiary) mt-0.5">
                    {community.visibility === 'private'
                      ? 'Yalnızca davetliler içeriği görebilir.'
                      : community.visibility === 'restricted'
                      ? 'Katılmak için onay gerekir.'
                      : 'Herkes gönderi görebilir ve katılabilir.'}
                  </p>
                </div>
              </div>
            </div>
          </div>

          {community.topics && (
            <div className="rounded-2xl border border-(--color-border) bg-(--color-background) p-4">
              <h3 className="text-xs font-semibold text-(--color-text-tertiary) uppercase tracking-widest mb-3">Konular</h3>
              <div className="flex flex-wrap gap-2">
                {community.topics.split(',').map((t) => t.trim()).filter(Boolean).map((topic) => (
                  <span key={topic} className="text-xs px-3 py-1.5 rounded-full border border-(--color-border) bg-(--color-background-secondary) text-(--color-text-secondary) font-medium">
                    {topic}
                  </span>
                ))}
              </div>
            </div>
          )}

          {rules.length > 0 && (
            <div className="rounded-2xl border border-(--color-border) bg-(--color-background) p-4">
              <h3 className="text-xs font-semibold text-(--color-text-tertiary) uppercase tracking-widest mb-3">Kurallar</h3>
              <ol className="space-y-2.5">
                {rules.map((rule, i) => (
                  <li key={i} className="flex gap-3 text-sm text-(--color-text-secondary)">
                    <span
                      className="flex-shrink-0 w-5 h-5 rounded-full flex items-center justify-center text-[11px] font-bold text-white mt-0.5"
                      style={{ background: gradient }}
                    >
                      {i + 1}
                    </span>
                    <span className="leading-relaxed">{rule}</span>
                  </li>
                ))}
              </ol>
            </div>
          )}

          {/* Müttefik Topluluklar */}
          {partnerships === null ? (
            <div className="flex justify-center py-6">
              <Loader2 className="w-4 h-4 animate-spin text-(--color-text-tertiary)" />
            </div>
          ) : partnerships.filter((p) => p.status === 'active').length > 0 ? (
            <div className="rounded-2xl border border-(--color-border) bg-(--color-background) p-4">
              <h3 className="text-xs font-semibold text-(--color-text-tertiary) uppercase tracking-widest mb-3 flex items-center gap-1.5">
                <Handshake className="w-3.5 h-3.5" />
                Müttefik Topluluklar
              </h3>
              <div className="space-y-2">
                {partnerships.filter((p) => p.status === 'active' && p.partner).map((p) => (
                  <button
                    key={p.id}
                    onClick={() => router.push(`/c/${p.partner!.handle}`)}
                    className="w-full flex items-center gap-3 rounded-xl border border-(--color-border) px-3 py-2.5 hover:bg-(--color-background-secondary) transition-colors text-left"
                  >
                    <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-teal-400 to-cyan-500 flex items-center justify-center flex-shrink-0">
                      <span className="text-white font-bold text-sm">
                        {(p.partner!.displayName ?? p.partner!.handle).slice(0, 1).toUpperCase()}
                      </span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-(--color-text-primary) truncate">
                        {p.partner!.displayName ?? p.partner!.handle}
                      </p>
                      <p className="text-[11px] text-(--color-text-tertiary)">
                        @{p.partner!.handle} · {p.partner!.memberCount.toLocaleString('tr')} üye
                      </p>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          ) : null}
        </div>
      )}
    </div>
  )
}
