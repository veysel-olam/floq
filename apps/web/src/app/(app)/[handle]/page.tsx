'use client'

import { useState, useEffect, useCallback, useRef, use } from 'react'
import Link from 'next/link'
import { useSession } from '@/lib/auth-client'
import { api, type Actor, type Post } from '@/lib/api'
import { PostCard } from '@/components/posts/post-card'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Button } from '@/components/ui/button'
import { Loader2, CalendarDays, MoreHorizontal, ShieldOff, BellOff, Bell, MessageSquare, Pencil, Star, Images, BarChart2, X, Lock, Globe, Shield, MessageCircle, Heart, Film, FileText, Link2, Share2, Check, Copy } from 'lucide-react'
import { cn } from '@/lib/utils'
import { TimelineSkeleton } from '@/components/ui/skeleton'
import { NotFoundContent } from '@/components/not-found-content'
import { useInfiniteScroll } from '@/hooks/use-infinite-scroll'

const BIO_TOKEN = /(#[a-zA-ZğüşıöçĞÜŞİÖÇ0-9_]+|@[a-zA-Z0-9._-]+)/g

function renderBio(bio: string) {
  const parts = bio.split(BIO_TOKEN)
  return parts.map((part, i) => {
    if (part.startsWith('#')) {
      return <Link key={i} href={`/hashtag/${part.slice(1).toLowerCase()}`} className="text-(--color-coral) hover:underline">{part}</Link>
    }
    if (part.startsWith('@')) {
      return <Link key={i} href={`/${part.slice(1)}`} className="text-(--color-coral) hover:underline">{part}</Link>
    }
    return <span key={i}>{part}</span>
  })
}

type Tab = 'posts' | 'replies' | 'media' | 'likes'

export default function ProfilePage({ params }: { params: Promise<{ handle: string }> }) {
  const { handle } = use(params)
  const { data: session } = useSession()
  const [actor, setActor] = useState<Actor | null>(null)
  const [loading, setLoading] = useState(true)
  const [followStatus, setFollowStatus] = useState<'none' | 'pending' | 'following'>('none')
  const [followLoading, setFollowLoading] = useState(false)
  const following = followStatus === 'following'
  const [notifyOnActivity, setNotifyOnActivity] = useState(true)
  const [notifyLoading, setNotifyLoading] = useState(false)
  const [isCloseFriend, setIsCloseFriend] = useState(false)
  const [cfLoading, setCfLoading] = useState(false)
  const [blocked, setBlocked] = useState(false)
  const [muted, setMuted] = useState(false)
  const [menuOpen, setMenuOpen] = useState(false)
  const menuRef = useRef<HTMLDivElement>(null)
  const [ownMenuOpen, setOwnMenuOpen] = useState(false)
  const ownMenuRef = useRef<HTMLDivElement>(null)

  const [tab, setTab] = useState<Tab>('posts')

  // Follow list modal state
  const [followModal, setFollowModal] = useState<'followers' | 'following' | null>(null)
  const [modalList, setModalList] = useState<Actor[]>([])
  const [modalLoading, setModalLoading] = useState(false)
  const [modalNextCursor, setModalNextCursor] = useState<string | null>(null)
  const [modalLoadingMore, setModalLoadingMore] = useState(false)
  const [modalSearch, setModalSearch] = useState('')

  // Posts tab state
  const [posts, setPosts] = useState<Post[]>([])
  const [pinnedPost, setPinnedPost] = useState<Post | null>(null)
  const [pinnedPostId, setPinnedPostId] = useState<string | null>(null)
  const [postsNextCursor, setPostsNextCursor] = useState<string | null>(null)
  const [postsLoadingMore, setPostsLoadingMore] = useState(false)

  // Replies tab state
  const [repliesList, setRepliesList] = useState<Post[]>([])
  const [repliesNextCursor, setRepliesNextCursor] = useState<string | null>(null)
  const [repliesLoaded, setRepliesLoaded] = useState(false)
  const [repliesLoadingMore, setRepliesLoadingMore] = useState(false)

  // Likes tab state
  const [likesList, setLikesList] = useState<Post[]>([])
  const [likesNextCursor, setLikesNextCursor] = useState<string | null>(null)
  const [likesLoaded, setLikesLoaded] = useState(false)
  const [likesLoadingMore, setLikesLoadingMore] = useState(false)

  // Media tab state
  const [mediaList, setMediaList] = useState<Post[]>([])
  const [mediaNextCursor, setMediaNextCursor] = useState<string | null>(null)
  const [mediaLoaded, setMediaLoaded] = useState(false)
  const [mediaLoadingMore, setMediaLoadingMore] = useState(false)

  // Mutual followers state
  const [mutualFollowers, setMutualFollowers] = useState<{ id: string; handle: string; displayName: string | null; avatarUrl: string | null }[]>([])

  const [copied, setCopied] = useState(false)

  async function shareProfile() {
    const url = `${window.location.origin}/${handle}`
    if (navigator.share) {
      try { await navigator.share({ title: actor?.displayName ?? handle, url }) } catch { /* cancelled */ }
    }
    setMenuOpen(false)
    setOwnMenuOpen(false)
  }

  async function copyLink() {
    const url = `${window.location.origin}/${handle}`
    await navigator.clipboard.writeText(url)
    setCopied(true)
    setMenuOpen(false)
    setOwnMenuOpen(false)
    setTimeout(() => setCopied(false), 2000)
  }

  const currentHandle = (session?.user as { handle?: string } | undefined)?.handle
  const isOwn = currentHandle === handle

  useEffect(() => {
    async function load() {
      try {
        const actorData = await api.actors.get(handle)
        setActor(actorData)
        setPinnedPostId(actorData.pinnedPostId)
        const fs = actorData.viewer?.followStatus
        setFollowStatus(fs === 'accepted' ? 'following' : fs === 'pending' ? 'pending' : 'none')
        setNotifyOnActivity(actorData.viewer?.notifyOnActivity ?? true)
        if (!isOwn && fs === 'accepted') {
          api.closeFriends.check(handle).then((d) => setIsCloseFriend(d.isCloseFriend)).catch(() => {})
        }
        if (!isOwn) {
          api.actors.mutualFollowers(handle).then((d) => setMutualFollowers(d.actors)).catch(() => {})
        }
      } catch {
        // actor not found
      } finally {
        setLoading(false)
      }

      try {
        const postsData = await api.actors.posts(handle)
        setPosts(postsData.posts)
        setPinnedPost(postsData.pinnedPost)
        setPostsNextCursor(postsData.nextCursor)
      } catch {
        // posts failed, show empty
      }
    }
    load()
  }, [handle, isOwn])

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setMenuOpen(false)
      if (ownMenuRef.current && !ownMenuRef.current.contains(e.target as Node)) setOwnMenuOpen(false)
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [])

  const loadReplies = useCallback(async (cursor?: string) => {
    try {
      const data = await api.actors.posts(handle, cursor, false, true)
      if (cursor) setRepliesList((prev) => [...prev, ...data.posts])
      else setRepliesList(data.posts)
      setRepliesNextCursor(data.nextCursor)
    } catch {
    } finally {
      setRepliesLoaded(true)
      setRepliesLoadingMore(false)
    }
  }, [handle])

  const loadLikes = useCallback(async (cursor?: string) => {
    try {
      const data = await api.actors.likes(handle, cursor)
      if (cursor) setLikesList((prev) => [...prev, ...data.posts])
      else setLikesList(data.posts)
      setLikesNextCursor(data.nextCursor)
    } catch {
    } finally {
      setLikesLoaded(true)
      setLikesLoadingMore(false)
    }
  }, [handle])

  const loadMedia = useCallback(async (cursor?: string) => {
    try {
      const data = await api.actors.posts(handle, cursor, true)
      if (cursor) setMediaList((prev) => [...prev, ...data.posts])
      else setMediaList(data.posts)
      setMediaNextCursor(data.nextCursor)
    } catch {
    } finally {
      setMediaLoaded(true)
      setMediaLoadingMore(false)
    }
  }, [handle])

  function handleTabChange(t: Tab) {
    setTab(t)
    if (t === 'replies' && !repliesLoaded) void loadReplies()
    if (t === 'likes' && !likesLoaded) void loadLikes()
    if (t === 'media' && !mediaLoaded) void loadMedia()
  }

  const loadMoreRef = useInfiniteScroll(
    useCallback(() => {
      if (tab === 'posts' && postsNextCursor && !postsLoadingMore) {
        setPostsLoadingMore(true); void (async () => {
          try { const d = await api.actors.posts(handle, postsNextCursor); setPosts((p) => [...p, ...d.posts]); setPostsNextCursor(d.nextCursor) } catch { } finally { setPostsLoadingMore(false) }
        })()
      } else if (tab === 'replies' && repliesNextCursor && !repliesLoadingMore) {
        setRepliesLoadingMore(true); void loadReplies(repliesNextCursor)
      } else if (tab === 'media' && mediaNextCursor && !mediaLoadingMore) {
        setMediaLoadingMore(true); void loadMedia(mediaNextCursor)
      } else if (tab === 'likes' && likesNextCursor && !likesLoadingMore) {
        setLikesLoadingMore(true); void loadLikes(likesNextCursor)
      }
    }, [tab, postsNextCursor, postsLoadingMore, repliesNextCursor, repliesLoadingMore, mediaNextCursor, mediaLoadingMore, likesNextCursor, likesLoadingMore, handle, loadReplies, loadMedia, loadLikes]),
    !!(
      (tab === 'posts' && postsNextCursor && !postsLoadingMore) ||
      (tab === 'replies' && repliesNextCursor && !repliesLoadingMore) ||
      (tab === 'media' && mediaNextCursor && !mediaLoadingMore) ||
      (tab === 'likes' && likesNextCursor && !likesLoadingMore)
    ),
  )

  async function openFollowModal(type: 'followers' | 'following') {
    setFollowModal(type)
    setModalList([])
    setModalNextCursor(null)
    setModalLoading(true)
    setModalSearch('')
    try {
      const data = type === 'followers'
        ? await api.actors.followers(handle)
        : await api.actors.following(handle)
      setModalList(data.actors)
      setModalNextCursor(data.nextCursor)
    } catch {
    } finally {
      setModalLoading(false)
    }
  }

  async function loadMoreModal() {
    if (!followModal || !modalNextCursor || modalLoadingMore) return
    setModalLoadingMore(true)
    try {
      const data = followModal === 'followers'
        ? await api.actors.followers(handle, modalNextCursor)
        : await api.actors.following(handle, modalNextCursor)
      setModalList((prev) => [...prev, ...data.actors])
      setModalNextCursor(data.nextCursor)
    } catch {
    } finally {
      setModalLoadingMore(false)
    }
  }

  async function toggleBlock() {
    setMenuOpen(false)
    try {
      if (blocked) {
        await api.moderation.blocks.unblock(handle)
        setBlocked(false)
      } else {
        await api.moderation.blocks.block(handle)
        setBlocked(true)
      }
    } catch {}
  }

  async function toggleMute() {
    setMenuOpen(false)
    try {
      if (muted) {
        await api.moderation.mutes.unmute(handle)
        setMuted(false)
      } else {
        await api.moderation.mutes.mute(handle)
        setMuted(true)
      }
    } catch {}
  }

  async function toggleCloseFriend() {
    if (cfLoading) return
    setCfLoading(true)
    try {
      if (isCloseFriend) {
        await api.closeFriends.remove(handle)
        setIsCloseFriend(false)
      } else {
        await api.closeFriends.add(handle)
        setIsCloseFriend(true)
      }
    } catch {
    } finally {
      setCfLoading(false)
    }
  }

  async function toggleFollow() {
    if (!actor || followLoading) return
    setFollowLoading(true)
    try {
      if (followStatus !== 'none') {
        await api.actors.unfollow(handle)
        setFollowStatus('none')
        if (followStatus === 'following') {
          setActor((a) => a ? { ...a, followersCount: Math.max(a.followersCount - 1, 0) } : a)
        }
      } else {
        const res = await api.actors.follow(handle)
        if (res?.status === 'pending') {
          setFollowStatus('pending')
        } else {
          setFollowStatus('following')
          setActor((a) => a ? { ...a, followersCount: a.followersCount + 1 } : a)
        }
      }
    } catch {
    } finally {
      setFollowLoading(false)
    }
  }

  async function toggleNotify() {
    if (!actor || notifyLoading) return
    setNotifyLoading(true)
    try {
      const res = await api.actors.setNotify(handle, !notifyOnActivity)
      setNotifyOnActivity(res.notifyOnActivity)
    } catch {
    } finally {
      setNotifyLoading(false)
    }
  }

  function handlePinChange(postId: string, pinning: boolean) {
    if (pinning) {
      const newPinned = posts.find((p) => p.id === postId) ?? null
      setPinnedPost(newPinned)
      setPinnedPostId(postId)
    } else {
      setPinnedPost(null)
      setPinnedPostId(null)
    }
  }

  function handleDeletePost(postId: string) {
    setPosts((prev) => prev.filter((p) => p.id !== postId))
    setRepliesList((prev) => prev.filter((p) => p.id !== postId))
    setLikesList((prev) => prev.filter((p) => p.id !== postId))
    setMediaList((prev) => prev.filter((p) => p.id !== postId))
    if (pinnedPostId === postId) { setPinnedPost(null); setPinnedPostId(null) }
  }

  if (loading) {
    return (
      <div className="max-w-xl mx-auto">
        <div className="h-32 lg:h-40 bg-(--color-background-secondary) animate-pulse" />
        <TimelineSkeleton count={4} />
      </div>
    )
  }

  if (!actor) {
    return <NotFoundContent />
  }

  const initials = (actor.displayName ?? actor.handle).slice(0, 2).toUpperCase()
  const joinDate = new Date(actor.createdAt).toLocaleDateString('tr-TR', {
    month: 'long',
    year: 'numeric',
  })
  const accountAgeMonths = Math.floor((Date.now() - new Date(actor.createdAt).getTime()) / (1000 * 60 * 60 * 24 * 30))
  const accountAgeText = accountAgeMonths < 1 ? null
    : accountAgeMonths < 12 ? `${accountAgeMonths} aydır`
    : `${Math.floor(accountAgeMonths / 12)} yıldır`

  const tabs: { id: Tab; label: string; icon: React.ReactNode; count?: number }[] = [
    { id: 'posts', label: 'Gönderiler', icon: <FileText className="w-3.5 h-3.5" />, count: actor.postsCount },
    { id: 'replies', label: 'Yorumlar', icon: <MessageCircle className="w-3.5 h-3.5" /> },
    { id: 'media', label: 'Medya', icon: <Film className="w-3.5 h-3.5" /> },
    { id: 'likes', label: 'Beğeniler', icon: <Heart className="w-3.5 h-3.5" />, count: actor.likesCount },
  ]

  return (
    <div className="max-w-xl mx-auto">
      {/* Moved account banner */}
      {actor.movedToUri && (
        <div className="mx-4 mt-4 flex items-start gap-3 p-3.5 rounded-xl border border-amber-200 bg-amber-50 dark:border-amber-900/50 dark:bg-amber-950/20">
          <span className="text-amber-500 mt-0.5 flex-shrink-0">→</span>
          <div className="min-w-0">
            <p className="text-sm font-medium text-amber-700 dark:text-amber-400">Bu hesap taşındı</p>
            <a
              href={actor.movedToUri}
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs text-amber-600 dark:text-amber-500 hover:underline break-all"
            >
              {actor.movedToUri}
            </a>
          </div>
        </div>
      )}

      {/* Header image */}
      <div className="h-36 lg:h-48 relative overflow-hidden">
        {actor.headerUrl
          // eslint-disable-next-line @next/next/no-img-element
          ? <img src={actor.headerUrl} alt="" className="w-full h-full object-cover" />
          : (
            <div className="w-full h-full relative" style={{ background: 'var(--gradient-banner)' }}>
              <div className="absolute inset-0 opacity-[0.15]" style={{ backgroundImage: 'radial-gradient(circle at 1px 1px, white 1px, transparent 0)', backgroundSize: '20px 20px' }} />
            </div>
          )}
      </div>

      <div className="px-4 pb-4">
        <div className="flex items-end justify-between -mt-10 mb-3">
          <Avatar className="w-20 h-20 border-4 border-(--color-background)">
            {actor.avatarUrl && <AvatarImage src={actor.avatarUrl} alt={actor.displayName ?? actor.handle} />}
            <AvatarFallback
              className="text-xl font-semibold text-white"
              style={{ background: 'var(--gradient-avatar)' }}
            >
              {initials}
            </AvatarFallback>
          </Avatar>

          {isOwn ? (
            <div className="flex items-center gap-2">
              <Link href="/analytics">
                <Button
                  size="sm"
                  variant="outline"
                  className="border-(--color-border) text-(--color-text-secondary) hover:text-(--color-text-primary) hover:bg-(--color-background-secondary) rounded-full gap-1.5"
                >
                  <BarChart2 className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline">Analitik</span>
                </Button>
              </Link>
              <Link href="/settings">
                <Button
                  size="sm"
                  variant="outline"
                  className="border-(--color-border) text-(--color-text-secondary) hover:text-(--color-text-primary) hover:bg-(--color-background-secondary) rounded-full gap-1.5"
                >
                  <Pencil className="w-3.5 h-3.5" />
                  Profili Düzenle
                </Button>
              </Link>
              <div ref={ownMenuRef} className="relative">
                <button
                  onClick={() => setOwnMenuOpen((o) => !o)}
                  className="p-2 rounded-full border border-(--color-border) text-(--color-text-secondary) hover:bg-(--color-background-secondary) transition-colors"
                >
                  <MoreHorizontal className="w-4 h-4" />
                </button>
                {ownMenuOpen && (
                  <div className="absolute right-0 top-full mt-1 w-48 bg-(--color-background) border border-(--color-border) rounded-xl shadow-lg z-20 overflow-hidden">
                    <button
                      onClick={() => void shareProfile()}
                      className="w-full flex items-center gap-2 px-4 py-2.5 text-sm text-left text-(--color-text-primary) transition-colors hover:bg-(--color-background-secondary)"
                    >
                      <Share2 className="w-4 h-4" />
                      Paylaş
                    </button>
                    <button
                      onClick={() => void copyLink()}
                      className="w-full flex items-center gap-2 px-4 py-2.5 text-sm text-left transition-colors hover:bg-(--color-background-secondary)"
                    >
                      {copied ? <Check className="w-4 h-4 text-green-500" /> : <Copy className="w-4 h-4 text-(--color-text-primary)" />}
                      <span className={copied ? 'text-green-500' : 'text-(--color-text-primary)'}>
                        {copied ? 'Kopyalandı!' : 'Linki Kopyala'}
                      </span>
                    </button>
                  </div>
                )}
              </div>
            </div>
          ) : (
            <div className="flex items-center gap-2">
              <Link href={`/dm/${handle}`}>
                <Button
                  size="sm"
                  variant="outline"
                  className="border-(--color-border) text-(--color-text-secondary) hover:text-(--color-text-primary) rounded-full"
                >
                  <MessageSquare className="w-4 h-4" />
                </Button>
              </Link>
              {following && (
                <button
                  onClick={() => void toggleCloseFriend()}
                  disabled={cfLoading}
                  title={isCloseFriend ? 'Yakın Çevreden Çıkar' : 'Yakın Çevreye Ekle'}
                  className={cn(
                    'p-2 rounded-full border transition-colors',
                    isCloseFriend
                      ? 'border-green-300 text-green-500 bg-green-500/10'
                      : 'border-(--color-border) text-(--color-text-secondary) hover:border-green-300 hover:text-green-500',
                  )}
                >
                  {cfLoading
                    ? <Loader2 className="w-4 h-4 animate-spin" />
                    : <Star className={cn('w-4 h-4', isCloseFriend && 'fill-current')} />}
                </button>
              )}
              <Button
                size="sm"
                onClick={toggleFollow}
                disabled={followLoading}
                variant={followStatus !== 'none' ? 'outline' : 'default'}
                className={cn(
                  'rounded-full px-4 group transition-all',
                  followStatus === 'following' && 'border-(--color-border) text-(--color-text-primary) hover:border-red-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-950/20',
                  followStatus === 'pending' && 'border-(--color-border) text-(--color-text-tertiary) hover:border-red-400 hover:text-red-500',
                  followStatus === 'none' && 'bg-(--color-coral) hover:bg-(--color-coral-hover) text-white shadow-sm shadow-(--color-coral)/20',
                )}
              >
                {followLoading
                  ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  : followStatus === 'following'
                    ? <><span className="group-hover:hidden">Takip ediliyor</span><span className="hidden group-hover:inline">Takibi Bırak</span></>
                    : followStatus === 'pending' ? 'İstek gönderildi'
                    : 'Takip et'}
              </Button>
              {following && (
                <button
                  onClick={toggleNotify}
                  disabled={notifyLoading}
                  title={notifyOnActivity ? 'Bildirimleri kapat' : 'Bildirimleri aç'}
                  className={cn(
                    'p-2 rounded-full border transition-colors',
                    notifyOnActivity
                      ? 'border-(--color-border) text-(--color-coral) hover:bg-(--color-coral)/8'
                      : 'border-(--color-border) text-(--color-text-tertiary) hover:text-(--color-text-primary) hover:bg-(--color-background-secondary)',
                  )}
                >
                  {notifyLoading
                    ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    : notifyOnActivity ? <Bell className="w-3.5 h-3.5" /> : <BellOff className="w-3.5 h-3.5" />}
                </button>
              )}
              <div ref={menuRef} className="relative">
                <button
                  onClick={() => setMenuOpen((o) => !o)}
                  className="p-2 rounded-full border border-(--color-border) text-(--color-text-secondary) hover:bg-(--color-background-secondary) transition-colors"
                >
                  <MoreHorizontal className="w-4 h-4" />
                </button>
                {menuOpen && (
                  <div className="absolute right-0 top-full mt-1 w-48 bg-(--color-background) border border-(--color-border) rounded-xl shadow-lg z-20 overflow-hidden">
                    <button
                      onClick={() => void shareProfile()}
                      className="w-full flex items-center gap-2 px-4 py-2.5 text-sm text-left text-(--color-text-primary) transition-colors hover:bg-(--color-background-secondary)"
                    >
                      <Share2 className="w-4 h-4" />
                      Paylaş
                    </button>
                    <button
                      onClick={() => void copyLink()}
                      className="w-full flex items-center gap-2 px-4 py-2.5 text-sm text-left transition-colors hover:bg-(--color-background-secondary)"
                    >
                      {copied ? <Check className="w-4 h-4 text-green-500" /> : <Copy className="w-4 h-4 text-(--color-text-primary)" />}
                      <span className={copied ? 'text-green-500' : 'text-(--color-text-primary)'}>
                        {copied ? 'Kopyalandı!' : 'Linki Kopyala'}
                      </span>
                    </button>
                    <div className="border-t border-(--color-border-secondary)" />
                    <button
                      onClick={() => void toggleMute()}
                      className={cn(
                        'w-full flex items-center gap-2 px-4 py-2.5 text-sm text-left transition-colors hover:bg-(--color-background-secondary)',
                        muted ? 'text-(--color-coral)' : 'text-(--color-text-primary)',
                      )}
                    >
                      <BellOff className="w-4 h-4" />
                      {muted ? 'Susturmayı Kaldır' : 'Sustur'}
                    </button>
                    <button
                      onClick={() => void toggleBlock()}
                      className={cn(
                        'w-full flex items-center gap-2 px-4 py-2.5 text-sm text-left transition-colors hover:bg-(--color-background-secondary)',
                        blocked ? 'text-(--color-coral)' : 'text-red-500',
                      )}
                    >
                      <ShieldOff className="w-4 h-4" />
                      {blocked ? 'Engeli Kaldır' : 'Engelle'}
                    </button>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        <div className="mb-3">
          <div className="flex items-center gap-2 flex-wrap">
            <h1
              className="text-xl font-bold text-(--color-text-primary) leading-tight"
              style={{ fontFamily: 'var(--font-outfit)' }}
            >
              {actor.displayName ?? actor.handle}
            </h1>
            {actor.isLocked && (
              <span title="Kilitli hesap">
                <Lock className="w-4 h-4 text-(--color-text-tertiary)" />
              </span>
            )}
            {actor.role === 'moderator' && (
              <span className="flex items-center gap-1 text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-blue-500/10 text-blue-600 dark:text-blue-400">
                <Shield className="w-2.5 h-2.5" /> MOD
              </span>
            )}
            {actor.role === 'admin' && (
              <span className="flex items-center gap-1 text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-(--color-coral)/10 text-(--color-coral)">
                <Shield className="w-2.5 h-2.5" /> ADMIN
              </span>
            )}
          </div>
          <div className="flex items-center gap-2 mt-0.5">
            <p className="text-sm text-(--color-text-tertiary)">@{actor.handle}</p>
            {!actor.isLocal && (
              <span className="flex items-center gap-1 text-[11px] font-medium text-(--color-teal) bg-(--color-teal)/8 px-1.5 py-0.5 rounded-full">
                <Globe className="w-3 h-3" /> Federe
              </span>
            )}
          </div>
        </div>

        {actor.bio && (
          <p className="text-sm text-(--color-text-secondary) mb-3 leading-relaxed">{renderBio(actor.bio)}</p>
        )}

        <div className="flex items-center gap-4 mb-2 text-sm">
          <button
            onClick={() => void openFollowModal('followers')}
            className="flex items-center gap-1.5 hover:underline underline-offset-2 group"
          >
            <span className="font-bold text-(--color-text-primary) tabular-nums">{actor.followersCount >= 1000 ? `${(actor.followersCount / 1000).toFixed(1)}K` : actor.followersCount}</span>
            <span className="text-(--color-text-tertiary) group-hover:text-(--color-text-secondary)">Takipçi</span>
          </button>
          <button
            onClick={() => void openFollowModal('following')}
            className="flex items-center gap-1.5 hover:underline underline-offset-2 group"
          >
            <span className="font-bold text-(--color-text-primary) tabular-nums">{actor.followingCount >= 1000 ? `${(actor.followingCount / 1000).toFixed(1)}K` : actor.followingCount}</span>
            <span className="text-(--color-text-tertiary) group-hover:text-(--color-text-secondary)">Takip</span>
          </button>
        </div>

        {/* Mutual followers */}
        {!isOwn && mutualFollowers.length > 0 && (
          <div className="flex items-center gap-2 mb-2">
            <div className="flex -space-x-1.5">
              {mutualFollowers.slice(0, 3).map((m) => (
                <Avatar key={m.id} className="w-5 h-5 border-2 border-(--color-background)">
                  {m.avatarUrl && <img src={m.avatarUrl} alt="" className="w-full h-full object-cover rounded-full" />}
                  <AvatarFallback className="text-[8px] text-white" style={{ background: 'var(--gradient-avatar)' }}>
                    {(m.displayName ?? m.handle).slice(0, 1).toUpperCase()}
                  </AvatarFallback>
                </Avatar>
              ))}
            </div>
            <p className="text-xs text-(--color-text-tertiary) leading-snug">
              {mutualFollowers.length === 1
                ? <><Link href={`/${mutualFollowers[0]!.handle}`} className="font-medium text-(--color-text-secondary) hover:underline">@{mutualFollowers[0]!.handle}</Link> da takip ediyor</>
                : mutualFollowers.length === 2
                  ? <><Link href={`/${mutualFollowers[0]!.handle}`} className="font-medium text-(--color-text-secondary) hover:underline">@{mutualFollowers[0]!.handle}</Link> ve <Link href={`/${mutualFollowers[1]!.handle}`} className="font-medium text-(--color-text-secondary) hover:underline">@{mutualFollowers[1]!.handle}</Link> da takip ediyor</>
                  : <><Link href={`/${mutualFollowers[0]!.handle}`} className="font-medium text-(--color-text-secondary) hover:underline">@{mutualFollowers[0]!.handle}</Link>{mutualFollowers.length > 2 ? ` ve ${mutualFollowers.length - 1} diğer takipçin` : ''} de takip ediyor</>
              }
            </p>
          </div>
        )}

        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mb-2">
          <div className="flex items-center gap-1 text-xs text-(--color-text-tertiary)">
            <CalendarDays className="w-3.5 h-3.5" />
            <span>{joinDate} katıldı</span>
            {accountAgeText && (
              <span className="text-(--color-text-tertiary)/60">· {accountAgeText}</span>
            )}
          </div>
          {actor.website && (
            <a
              href={actor.website.startsWith('http') ? actor.website : `https://${actor.website}`}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1 text-xs text-(--color-teal) hover:text-(--color-teal)/80 transition-colors max-w-[180px]"
            >
              <Link2 className="w-3 h-3 flex-shrink-0" />
              <span className="truncate">{actor.website.replace(/^https?:\/\//, '')}</span>
            </a>
          )}
          {actor.profileFields && actor.profileFields.length > 0 && (
            <div className="flex flex-wrap gap-x-4 gap-y-1 mt-0.5">
              {actor.profileFields.map((field, i) => (
                <span key={i} className="flex items-center gap-1 text-xs">
                  <span className="text-(--color-text-tertiary) font-medium">{field.name}</span>
                  {field.value.startsWith('http') ? (
                    <a
                      href={field.value}
                      target="_blank"
                      rel="noopener noreferrer"
                      className={cn('flex items-center gap-0.5 hover:underline', field.verifiedAt ? 'text-emerald-500' : 'text-(--color-coral)')}
                    >
                      {field.value.replace(/^https?:\/\//, '').split('/')[0]}
                      <Link2 className="w-2.5 h-2.5" />
                    </a>
                  ) : (
                    <span className="text-(--color-text-secondary)">{field.value}</span>
                  )}
                </span>
              ))}
            </div>
          )}
          {actor.blueskyHandle && (
            <a
              href={`https://bsky.app/profile/${actor.blueskyHandle}`}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1 text-xs text-sky-500 hover:text-sky-400 transition-colors"
            >
              <svg className="w-3 h-3 fill-current" viewBox="0 0 24 24" aria-hidden="true">
                <path d="M12 10.8c-1.087-2.114-4.046-6.053-6.798-7.995C2.566.944 1.561 1.266.902 1.565.139 1.908 0 3.08 0 3.768c0 .69.378 5.65.624 6.479.815 2.736 3.713 3.66 6.383 3.364.136-.02.275-.039.415-.056-.138.022-.276.04-.415.056-3.912.58-7.387 2.005-2.83 7.078 5.013 5.19 6.87-1.113 7.823-4.308.953 3.195 2.05 9.271 7.733 4.308 4.267-4.308 1.172-6.498-2.74-7.078a8.741 8.741 0 0 1-.415-.056c.14.017.279.036.415.056 2.67.297 5.568-.628 6.383-3.364.246-.828.624-5.79.624-6.478 0-.69-.139-1.861-.902-2.206-.659-.298-1.664-.62-4.3 1.24C16.046 4.748 13.087 8.687 12 10.8Z" />
              </svg>
              {actor.blueskyHandle}
            </a>
          )}
          {actor.isLocal && (
            <a
              href={`${process.env['NEXT_PUBLIC_API_URL'] ?? ''}/users/${actor.handle}/did.json`}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1 text-xs text-(--color-text-tertiary) hover:text-(--color-teal) transition-colors"
              title="AT Protocol DID belgesi"
            >
              <span className="font-mono text-[10px] px-1 py-0.5 rounded border border-(--color-border) bg-(--color-background-secondary)">did:web</span>
            </a>
          )}
        </div>

      </div>

      {/* Tabs */}
      <div className="flex border-b border-(--color-border) sticky top-0 z-10 bg-(--color-background)/90 backdrop-blur-md">
        {tabs.map((t) => (
          <button
            key={t.id}
            onClick={() => handleTabChange(t.id)}
            className={cn(
              'flex-1 py-3 text-xs font-medium transition-all flex items-center justify-center gap-1.5',
              tab === t.id
                ? 'text-(--color-coral) border-b-2 border-(--color-coral)'
                : 'text-(--color-text-tertiary) hover:text-(--color-text-secondary) hover:bg-(--color-background-secondary)/50',
            )}
          >
            {t.icon}
            <span className="hidden sm:inline">{t.label}</span>
            {t.count != null && t.count > 0 && (
              <span className={cn('tabular-nums', tab === t.id ? 'text-(--color-coral)' : 'text-(--color-text-tertiary)')}>
                {t.count >= 1000 ? `${(t.count / 1000).toFixed(1)}K` : t.count}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Posts tab */}
      {tab === 'posts' && (
        <>
          {/* Pinned post */}
          {pinnedPost && (
            <PostCard
              key={`pinned-${pinnedPost.id}`}
              post={pinnedPost}
              currentActorHandle={currentHandle}
              pinned
              onPinChange={isOwn ? handlePinChange : undefined}
              onDelete={isOwn ? handleDeletePost : undefined}
            />
          )}
          {posts.length === 0 && !pinnedPost ? (
            <EmptyState icon={<FileText className="w-7 h-7" />} title="Henüz gönderi yok" desc={isOwn ? 'İlk gönderini paylaş!' : `${actor.displayName ?? handle} henüz gönderi paylaşmamış.`} />
          ) : (
            <>
              {posts
                .filter((p) => p.id !== pinnedPostId)
                .map((post) => (
                  <PostCard
                    key={post.id}
                    post={post}
                    currentActorHandle={currentHandle}
                    onPinChange={isOwn ? handlePinChange : undefined}
                    onDelete={isOwn ? handleDeletePost : undefined}
                  />
                ))}
              {postsLoadingMore && <div className="py-6 flex justify-center"><Loader2 className="w-5 h-5 animate-spin text-(--color-coral)" /></div>}
            </>
          )}
        </>
      )}

      {/* Media tab */}
      {tab === 'media' && (
        <>
          {!mediaLoaded ? (
            <div className="flex justify-center py-12">
              <Loader2 className="w-5 h-5 animate-spin text-(--color-coral)" />
            </div>
          ) : mediaList.length === 0 ? (
            <EmptyState icon={<Film className="w-7 h-7" />} title="Henüz medya yok" desc="Fotoğraf veya video içeren gönderiler burada görünür." />
          ) : (
            <>
              <div className="grid grid-cols-3 gap-0.5 mt-0.5">
                {mediaList.flatMap((post) =>
                  post.media.map((m) => (
                    <a
                      key={m.id}
                      href={`/posts/${post.id}`}
                      className="relative aspect-square overflow-hidden bg-(--color-background-secondary) group"
                    >
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={m.url}
                        alt={m.altText ?? ''}
                        className="w-full h-full object-cover group-hover:opacity-90 transition-opacity"
                        loading="lazy"
                      />
                      {post.sensitive && (
                        <div className="absolute inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center">
                          <span className="text-white text-xs font-medium">Hassas</span>
                        </div>
                      )}
                      {post.media.length > 1 && (
                        <div className="absolute top-1.5 right-1.5">
                          <Images className="w-3.5 h-3.5 text-white drop-shadow" />
                        </div>
                      )}
                    </a>
                  ))
                )}
              </div>
              {mediaLoadingMore && <div className="py-6 flex justify-center"><Loader2 className="w-5 h-5 animate-spin text-(--color-coral)" /></div>}
            </>
          )}
        </>
      )}

      {/* Replies tab */}
      {tab === 'replies' && (
        <>
          {!repliesLoaded ? (
            <div className="flex justify-center py-12">
              <Loader2 className="w-5 h-5 animate-spin text-(--color-coral)" />
            </div>
          ) : repliesList.length === 0 ? (
            <EmptyState icon={<MessageCircle className="w-7 h-7" />} title="Henüz yorum yok" desc="Diğer gönderilere verilen yanıtlar burada görünür." />
          ) : (
            <>
              {repliesList.map((post) => (
                <PostCard key={post.id} post={post} currentActorHandle={currentHandle} onDelete={isOwn ? handleDeletePost : undefined} />
              ))}
              {repliesLoadingMore && <div className="py-6 flex justify-center"><Loader2 className="w-5 h-5 animate-spin text-(--color-coral)" /></div>}
            </>
          )}
        </>
      )}

      {/* Likes tab */}
      {tab === 'likes' && (
        <>
          {!likesLoaded ? (
            <div className="flex justify-center py-12">
              <Loader2 className="w-5 h-5 animate-spin text-(--color-coral)" />
            </div>
          ) : likesList.length === 0 ? (
            <EmptyState icon={<Heart className="w-7 h-7" />} title="Henüz beğeni yok" desc="Beğenilen gönderiler burada görünür." />
          ) : (
            <>
              {likesList.map((post) => (
                <PostCard key={post.id} post={post} currentActorHandle={currentHandle} onDelete={isOwn ? handleDeletePost : undefined} />
              ))}
              {likesLoadingMore && <div className="py-6 flex justify-center"><Loader2 className="w-5 h-5 animate-spin text-(--color-coral)" /></div>}
            </>
          )}
        </>
      )}

      <div ref={loadMoreRef} className="h-1" />

      {/* Follow list modal */}
      {followModal && (
        <div
          className="fixed inset-0 z-50 flex items-end sm:items-center justify-center"
          onClick={() => setFollowModal(null)}
        >
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" />
          <div
            className="relative w-full sm:max-w-md bg-(--color-background) rounded-t-2xl sm:rounded-2xl shadow-xl flex flex-col max-h-[70vh]"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between px-4 py-3 border-b border-(--color-border) flex-shrink-0">
              <h2 className="text-base font-semibold text-(--color-text-primary)" style={{ fontFamily: 'var(--font-outfit)' }}>
                {followModal === 'followers' ? 'Takipçiler' : 'Takip Edilenler'}
              </h2>
              <button
                onClick={() => setFollowModal(null)}
                className="p-1 rounded-full hover:bg-(--color-background-secondary) text-(--color-text-tertiary) transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            {!modalLoading && modalList.length > 5 && (
              <div className="px-3 py-2 border-b border-(--color-border-secondary) flex-shrink-0">
                <input
                  value={modalSearch}
                  onChange={(e) => setModalSearch(e.target.value)}
                  placeholder="İsim veya kullanıcı adı ara..."
                  className="w-full text-sm bg-(--color-background-secondary) border border-(--color-border) rounded-xl px-3 py-1.5 text-(--color-text-primary) placeholder:text-(--color-text-tertiary) focus:outline-none focus:border-(--color-coral)/50"
                />
              </div>
            )}
            <div className="overflow-y-auto flex-1">
              {modalLoading ? (
                <div className="flex justify-center py-12">
                  <Loader2 className="w-5 h-5 animate-spin text-(--color-coral)" />
                </div>
              ) : (() => {
                const q = modalSearch.toLowerCase()
                const visible = q
                  ? modalList.filter((a) => (a.displayName ?? a.handle).toLowerCase().includes(q) || a.handle.toLowerCase().includes(q))
                  : modalList
                return visible.length === 0 ? (
                  <div className="py-12 text-center">
                    <p className="text-sm text-(--color-text-tertiary)">
                      {modalSearch ? 'Sonuç bulunamadı.' : followModal === 'followers' ? 'Henüz takipçi yok.' : 'Henüz kimse takip edilmiyor.'}
                    </p>
                  </div>
                ) : (
                  <>
                    {visible.map((a) => <ActorRow key={a.id} actor={a} onNavigate={() => setFollowModal(null)} />)}
                    {!modalSearch && modalNextCursor && (
                      <button
                        onClick={() => void loadMoreModal()}
                        disabled={modalLoadingMore}
                        className="w-full py-3 text-sm text-(--color-coral) hover:bg-(--color-background-secondary) transition-colors disabled:opacity-50"
                      >
                        {modalLoadingMore ? <Loader2 className="w-4 h-4 animate-spin mx-auto" /> : 'Daha fazla göster'}
                      </button>
                    )}
                  </>
                )
              })()}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function EmptyState({ icon, title, desc }: { icon: React.ReactNode; title: string; desc: string }) {
  return (
    <div className="py-20 flex flex-col items-center gap-3 text-center px-8">
      <div className="w-14 h-14 rounded-2xl bg-(--color-background-secondary) flex items-center justify-center text-(--color-text-tertiary)">
        {icon}
      </div>
      <p className="font-semibold text-(--color-text-primary)" style={{ fontFamily: 'var(--font-outfit)' }}>{title}</p>
      <p className="text-sm text-(--color-text-tertiary) max-w-xs leading-relaxed">{desc}</p>
    </div>
  )
}

function ActorRow({ actor, onNavigate }: { actor: Actor; onNavigate?: () => void }) {
  const initials = (actor.displayName ?? actor.handle).slice(0, 2).toUpperCase()
  return (
    <Link
      href={`/${actor.handle}`}
      onClick={onNavigate}
      className="flex items-center gap-3 px-4 py-3 border-b border-(--color-border-secondary) hover:bg-(--color-background-secondary) transition-colors"
    >
      <Avatar className="w-10 h-10 flex-shrink-0">
        {actor.avatarUrl && <AvatarImage src={actor.avatarUrl} alt={actor.displayName ?? actor.handle} />}
        <AvatarFallback
          className="text-sm font-medium text-white"
          style={{ background: 'var(--gradient-avatar)' }}
        >
          {initials}
        </AvatarFallback>
      </Avatar>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold text-(--color-text-primary) truncate" style={{ fontFamily: 'var(--font-outfit)' }}>
          {actor.displayName ?? actor.handle}
        </p>
        <p className="text-xs text-(--color-text-tertiary)">@{actor.handle}</p>
        {actor.bio && (
          <p className="text-xs text-(--color-text-secondary) truncate mt-0.5">{actor.bio}</p>
        )}
      </div>
    </Link>
  )
}
