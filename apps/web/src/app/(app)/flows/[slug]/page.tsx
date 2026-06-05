'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import { useSession } from '@/lib/auth-client'
import { api, type FlowInfo, type Post, type Actor } from '@/lib/api'
import { PostCard } from '@/components/posts/post-card'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { cn } from '@/lib/utils'
import { NotFoundContent } from '@/components/not-found-content'
import {
  Loader2,
  Layers,
  Users,
  FileText,
  Lock,
  Globe,
  ArrowLeft,
  Send,
  Bell,
  BellOff,
  Pin,
  Trash2,
  MoreHorizontal,
  Link2,
  Copy,
  Check,
  ChevronDown,
  ChevronUp,
} from 'lucide-react'

interface InviteInfo {
  id: string
  code: string
  flowId: string
  usedCount: number
  maxUses: number
}

interface MemberInfo {
  actor: Actor
  role: string
  createdAt: string
}

function PostContextMenu({
  post,
  slug,
  isOwner,
  isAuthor,
  pinnedIds,
  onPin,
  onUnpin,
  onDelete,
}: {
  post: Post
  slug: string
  isOwner: boolean
  isAuthor: boolean
  pinnedIds: Set<string>
  onPin: (postId: string) => void
  onUnpin: (postId: string) => void
  onDelete: (postId: string) => void
}) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  const isPinned = pinnedIds.has(post.id)

  useEffect(() => {
    function handler(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    if (open) document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [open])

  if (!isOwner && !isAuthor) return null

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen((v) => !v)}
        className="p-1 rounded hover:bg-(--color-background-secondary) text-(--color-text-tertiary) hover:text-(--color-text-primary) transition-colors"
      >
        <MoreHorizontal className="w-4 h-4" />
      </button>
      {open && (
        <div className="absolute right-0 top-6 z-20 bg-(--color-background) border border-(--color-border) rounded-xl shadow-lg py-1 min-w-[140px]">
          {isOwner && (
            <button
              onClick={() => { setOpen(false); isPinned ? onUnpin(post.id) : onPin(post.id) }}
              className="w-full flex items-center gap-2 px-3 py-2 text-sm text-(--color-text-primary) hover:bg-(--color-background-secondary) transition-colors"
            >
              <Pin className="w-3.5 h-3.5 text-amber-500" />
              {isPinned ? 'Sabitlemeden Kaldır' : 'Sabitle'}
            </button>
          )}
          <button
            onClick={() => { setOpen(false); onDelete(post.id) }}
            className="w-full flex items-center gap-2 px-3 py-2 text-sm text-red-500 hover:bg-(--color-background-secondary) transition-colors"
          >
            <Trash2 className="w-3.5 h-3.5" />
            Sil
          </button>
        </div>
      )}
    </div>
  )
}

export default function FlowPage() {
  const { slug } = useParams<{ slug: string }>()
  const { data: session, isPending } = useSession()
  const router = useRouter()

  const [flow, setFlow] = useState<FlowInfo | null>(null)
  const [posts, setPosts] = useState<Post[]>([])
  const [pinnedPosts, setPinnedPosts] = useState<Post[]>([])
  const [pinnedIds, setPinnedIds] = useState<Set<string>>(new Set())
  const [nextCursor, setNextCursor] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [loadingMore, setLoadingMore] = useState(false)
  const [joining, setJoining] = useState(false)
  const [subscribing, setSubscribing] = useState(false)
  const [newPost, setNewPost] = useState('')
  const [posting, setPosting] = useState(false)

  // Members panel
  const [membersOpen, setMembersOpen] = useState(false)
  const [members, setMembers] = useState<MemberInfo[]>([])
  const [membersLoaded, setMembersLoaded] = useState(false)

  // Invite panel
  const [invites, setInvites] = useState<InviteInfo[]>([])
  const [invitesLoaded, setInvitesLoaded] = useState(false)
  const [creatingInvite, setCreatingInvite] = useState(false)
  const [copiedCode, setCopiedCode] = useState<string | null>(null)

  const currentHandle = (session?.user as { handle?: string } | undefined)?.handle

  const load = useCallback(async () => {
    try {
      const [flowData, timelineData] = await Promise.all([
        api.flows.get(slug),
        api.flows.timeline(slug),
      ])
      setFlow(flowData)
      setPosts(timelineData.posts)
      setNextCursor(timelineData.nextCursor)

      // Load pinned posts
      const pinned = await api.flows.pinned(slug)
      setPinnedPosts(pinned)
      setPinnedIds(new Set(pinned.map((p) => p.id)))
    } finally {
      setLoading(false)
    }
  }, [slug])

  useEffect(() => {
    if (!isPending && !session) { router.push('/login'); return }
    if (session) void load()
  }, [isPending, session, load, router])

  async function loadMore() {
    if (!nextCursor) return
    setLoadingMore(true)
    try {
      const data = await api.flows.timeline(slug, nextCursor)
      setPosts((prev) => [...prev, ...data.posts])
      setNextCursor(data.nextCursor)
    } finally {
      setLoadingMore(false)
    }
  }

  async function handleJoin() {
    if (!flow) return
    setJoining(true)
    try {
      await api.flows.join(slug)
      setFlow({ ...flow, isMember: true, membersCount: flow.membersCount + 1 })
    } finally {
      setJoining(false)
    }
  }

  async function handleLeave() {
    if (!flow) return
    setJoining(true)
    try {
      await api.flows.leave(slug)
      setFlow({ ...flow, isMember: false, membersCount: Math.max(flow.membersCount - 1, 0) })
    } finally {
      setJoining(false)
    }
  }

  async function handleSubscribe() {
    if (!flow) return
    setSubscribing(true)
    try {
      if (flow.isSubscribed) {
        await api.flows.unsubscribe(slug)
        setFlow({ ...flow, isSubscribed: false })
      } else {
        await api.flows.subscribe(slug)
        setFlow({ ...flow, isSubscribed: true })
      }
    } finally {
      setSubscribing(false)
    }
  }

  async function submitPost() {
    if (!newPost.trim() || !flow?.isMember) return
    setPosting(true)
    try {
      const post = await api.flows.post(slug, { content: newPost.trim() })
      setPosts((prev) => [post, ...prev])
      setNewPost('')
    } finally {
      setPosting(false)
    }
  }

  async function handlePin(postId: string) {
    await api.flows.pin(slug, postId)
    const post = posts.find((p) => p.id === postId)
    if (post) {
      setPinnedPosts((prev) => [post, ...prev])
      setPinnedIds((prev) => new Set([...prev, postId]))
    }
  }

  async function handleUnpin(postId: string) {
    await api.flows.unpin(slug, postId)
    setPinnedPosts((prev) => prev.filter((p) => p.id !== postId))
    setPinnedIds((prev) => { const s = new Set(prev); s.delete(postId); return s })
  }

  async function handleDeletePost(postId: string) {
    if (!confirm('Bu gönderiyi akıştan silmek istediğinden emin misin?')) return
    await api.flows.deletePost(slug, postId)
    setPosts((prev) => prev.filter((p) => p.id !== postId))
    setPinnedPosts((prev) => prev.filter((p) => p.id !== postId))
    setPinnedIds((prev) => { const s = new Set(prev); s.delete(postId); return s })
    if (flow) setFlow({ ...flow, postsCount: Math.max(flow.postsCount - 1, 0) })
  }

  async function loadMembers() {
    if (membersLoaded) return
    const data = await api.flows.members(slug)
    setMembers(data)
    setMembersLoaded(true)
  }

  async function toggleMembers() {
    if (!membersOpen) await loadMembers()
    setMembersOpen((v) => !v)
  }

  async function loadInvites() {
    if (invitesLoaded) return
    const data = await api.flows.listInvites(slug)
    setInvites(data)
    setInvitesLoaded(true)
  }

  async function createInvite() {
    setCreatingInvite(true)
    try {
      const invite = await api.flows.createInvite(slug)
      setInvites((prev) => [invite, ...prev])
      setInvitesLoaded(true)
    } finally {
      setCreatingInvite(false)
    }
  }

  async function copyCode(code: string) {
    await navigator.clipboard.writeText(`floq.com/flows/join?code=${code}`)
    setCopiedCode(code)
    setTimeout(() => setCopiedCode(null), 2000)
  }

  const isOwner = flow?.role === 'owner'

  if (isPending || loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-6 h-6 animate-spin text-(--color-coral)" />
      </div>
    )
  }

  if (!flow) return <NotFoundContent />

  return (
    <div className="max-w-xl mx-auto">
      {/* Header */}
      <header className="sticky top-0 z-10 bg-(--color-background)/90 backdrop-blur-md border-b border-(--color-border) px-4 py-3.5">
        <div className="flex items-center gap-2 mb-2">
          <Link href="/flows" className="text-(--color-text-tertiary) hover:text-(--color-text-primary)">
            <ArrowLeft className="w-4 h-4" />
          </Link>
          <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-(--color-coral) to-(--color-peach) flex items-center justify-center flex-shrink-0">
            <Layers className="w-3.5 h-3.5 text-white" />
          </div>
          <div className="flex-1 min-w-0">
            <h1 className="font-semibold text-(--color-text-primary) truncate" style={{ fontFamily: 'var(--font-outfit)' }}>
              {flow.name}
            </h1>
            <p className="text-xs text-(--color-text-tertiary) flex items-center gap-2">
              {flow.isPublic
                ? <><Globe className="w-3 h-3" />Herkese açık</>
                : <><Lock className="w-3 h-3" />Özel</>}
              <span className="flex items-center gap-1"><Users className="w-3 h-3" />{flow.membersCount}</span>
              <span className="flex items-center gap-1"><FileText className="w-3 h-3" />{flow.postsCount}</span>
            </p>
          </div>
          <div className="flex items-center gap-1.5">
            {flow.isMember && (
              <button
                onClick={handleSubscribe}
                disabled={subscribing}
                title={flow.isSubscribed ? 'Bildirimleri kapat' : 'Bildirimleri aç'}
                className={cn(
                  'p-1.5 rounded-lg transition-colors',
                  flow.isSubscribed
                    ? 'text-(--color-coral) bg-(--color-blush) dark:bg-(--color-coral)/12'
                    : 'text-(--color-text-tertiary) hover:text-(--color-text-primary) hover:bg-(--color-background-secondary)',
                )}
              >
                {subscribing
                  ? <Loader2 className="w-4 h-4 animate-spin" />
                  : flow.isSubscribed
                    ? <Bell className="w-4 h-4" />
                    : <BellOff className="w-4 h-4" />}
              </button>
            )}
            <Button
              size="sm"
              variant={flow.isMember ? 'outline' : 'default'}
              onClick={flow.isMember ? handleLeave : handleJoin}
              disabled={joining || isOwner}
              className={cn(
                'h-7 text-xs',
                !flow.isMember && 'bg-(--color-coral) hover:bg-(--color-peach) text-white border-0',
              )}
            >
              {joining
                ? <Loader2 className="w-3 h-3 animate-spin" />
                : isOwner ? 'Sahibi' : flow.isMember ? 'Ayrıl' : 'Katıl'}
            </Button>
          </div>
        </div>
        {flow.description && (
          <p className="text-xs text-(--color-text-tertiary) pl-9">{flow.description}</p>
        )}
      </header>

      {/* Post composer */}
      {flow.isMember && (
        <div className="border-b border-(--color-border) px-4 py-3 flex gap-2 items-end">
          <Textarea
            value={newPost}
            onChange={(e) => setNewPost(e.target.value)}
            placeholder={`${flow.name} akışına yaz...`}
            className="flex-1 resize-none h-16 text-sm"
            maxLength={500}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) void submitPost()
            }}
          />
          <Button
            size="sm"
            onClick={submitPost}
            disabled={posting || !newPost.trim()}
            className="bg-(--color-coral) hover:bg-(--color-peach) text-white h-8 w-8 p-0"
          >
            {posting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5" />}
          </Button>
        </div>
      )}

      {/* Invite management (owner only, private flows) */}
      {isOwner && !flow.isPublic && (
        <div className="border-b border-(--color-border) px-4 py-3 bg-(--color-background-secondary)">
          <div className="flex items-center justify-between mb-2">
            <p className="text-xs font-semibold text-(--color-text-secondary) flex items-center gap-1.5">
              <Link2 className="w-3.5 h-3.5" />
              Davet Linkleri
            </p>
            <Button
              size="sm"
              onClick={() => { void createInvite(); void loadInvites() }}
              disabled={creatingInvite}
              className="h-6 text-xs bg-(--color-coral) hover:bg-(--color-peach) text-white border-0"
            >
              {creatingInvite ? <Loader2 className="w-3 h-3 animate-spin" /> : 'Yeni Davet'}
            </Button>
          </div>
          {invites.length === 0 && invitesLoaded && (
            <p className="text-xs text-(--color-text-tertiary)">Henüz davet linki yok.</p>
          )}
          <div className="space-y-1.5">
            {invites.map((inv) => (
              <div key={inv.id} className="flex items-center gap-2 bg-(--color-background) border border-(--color-border) rounded-lg px-2.5 py-1.5">
                <code className="text-xs font-mono text-(--color-text-primary) flex-1 truncate">
                  floq.com/flows/join?code={inv.code}
                </code>
                <span className="text-xs text-(--color-text-tertiary) flex-shrink-0">
                  {inv.usedCount}/{inv.maxUses}
                </span>
                <button
                  onClick={() => void copyCode(inv.code)}
                  className="text-(--color-text-tertiary) hover:text-(--color-coral) transition-colors flex-shrink-0"
                >
                  {copiedCode === inv.code ? <Check className="w-3.5 h-3.5 text-green-500" /> : <Copy className="w-3.5 h-3.5" />}
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Members panel (collapsible) */}
      <div className="border-b border-(--color-border)">
        <button
          onClick={() => void toggleMembers()}
          className="w-full flex items-center justify-between px-4 py-2.5 hover:bg-(--color-background-secondary) transition-colors"
        >
          <span className="text-xs font-semibold text-(--color-text-tertiary) uppercase tracking-wider flex items-center gap-1.5">
            <Users className="w-3.5 h-3.5" />
            Üyeler ({flow.membersCount})
          </span>
          {membersOpen ? <ChevronUp className="w-3.5 h-3.5 text-(--color-text-tertiary)" /> : <ChevronDown className="w-3.5 h-3.5 text-(--color-text-tertiary)" />}
        </button>
        {membersOpen && (
          <div className="px-4 pb-3">
            {!membersLoaded ? (
              <div className="flex justify-center py-2">
                <Loader2 className="w-4 h-4 animate-spin text-(--color-coral)" />
              </div>
            ) : (
              <div className="space-y-2">
                {members.map((m) => (
                  <div key={m.actor.id} className="flex items-center gap-2">
                    {m.actor.avatarUrl ? (
                      <img src={m.actor.avatarUrl} alt="" className="w-6 h-6 rounded-full object-cover flex-shrink-0" />
                    ) : (
                      <div className="w-6 h-6 rounded-full bg-(--color-background-secondary) flex items-center justify-center flex-shrink-0">
                        <Users className="w-3 h-3 text-(--color-text-tertiary)" />
                      </div>
                    )}
                    <Link href={`/${m.actor.handle}`} className="flex-1 min-w-0">
                      <p className="text-xs font-medium text-(--color-text-primary) truncate hover:text-(--color-coral) transition-colors">
                        {m.actor.displayName ?? m.actor.handle}
                      </p>
                      <p className="text-xs text-(--color-text-tertiary) truncate">@{m.actor.handle}</p>
                    </Link>
                    <span className={cn(
                      'text-xs px-1.5 py-0.5 rounded-full flex-shrink-0',
                      m.role === 'owner'
                        ? 'bg-(--color-blush) dark:bg-(--color-coral)/12 text-(--color-coral) dark:bg-(--color-coral)/12'
                        : 'bg-(--color-background-secondary) text-(--color-text-tertiary)',
                    )}>
                      {m.role === 'owner' ? 'Sahip' : 'Üye'}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Pinned posts section */}
      {pinnedPosts.length > 0 && (
        <div>
          <div className="px-4 py-2 flex items-center gap-1.5 bg-(--color-background-secondary) border-b border-(--color-border)">
            <Pin className="w-3.5 h-3.5 text-amber-500" />
            <span className="text-xs font-semibold text-(--color-text-secondary) uppercase tracking-wider">
              Sabitlenmiş Gönderiler
            </span>
          </div>
          {pinnedPosts.map((post) => (
            <div key={post.id} className="relative border-l-2 border-amber-400">
              <PostCard post={post} currentActorHandle={currentHandle} hideMenu={isOwner || post.author?.handle === currentHandle} />
              {(isOwner || post.author?.handle === currentHandle) && (
                <div className="absolute top-2 right-2">
                  <PostContextMenu
                    post={post}
                    slug={slug}
                    isOwner={isOwner}
                    isAuthor={post.author?.handle === currentHandle}
                    pinnedIds={pinnedIds}
                    onPin={handlePin}
                    onUnpin={handleUnpin}
                    onDelete={handleDeletePost}
                  />
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Timeline */}
      {posts.length === 0 ? (
        <div className="py-16 text-center">
          <Layers className="w-7 h-7 text-(--color-text-tertiary) mx-auto mb-2" />
          <p className="text-sm text-(--color-text-tertiary)">
            {flow.isMember
              ? 'Henüz gönderi yok. İlk gönderiyi sen at!'
              : 'Katıl ve akışı takip etmeye başla.'}
          </p>
        </div>
      ) : (
        <>
          {posts.map((post) => (
            <div key={post.id} className="relative">
              <PostCard post={post} currentActorHandle={currentHandle} hideMenu={isOwner || post.author?.handle === currentHandle} />
              {(isOwner || post.author?.handle === currentHandle) && (
                <div className="absolute top-2 right-2">
                  <PostContextMenu
                    post={post}
                    slug={slug}
                    isOwner={isOwner}
                    isAuthor={post.author?.handle === currentHandle}
                    pinnedIds={pinnedIds}
                    onPin={handlePin}
                    onUnpin={handleUnpin}
                    onDelete={handleDeletePost}
                  />
                </div>
              )}
            </div>
          ))}
          {nextCursor && (
            <div className="py-4 text-center">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => void loadMore()}
                disabled={loadingMore}
                className="text-(--color-text-tertiary)"
              >
                {loadingMore ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Daha fazla yükle'}
              </Button>
            </div>
          )}
        </>
      )}
    </div>
  )
}
