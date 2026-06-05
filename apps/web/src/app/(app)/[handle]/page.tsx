'use client'

import { useState, useEffect, useCallback, useRef, use } from 'react'
import Link from 'next/link'
import { useSession } from '@/lib/auth-client'
import { api, type Actor, type Post, type ActorCommunityBadge } from '@/lib/api'
import { htmlToText } from '@/lib/html'
import { PostCard } from '@/components/posts/post-card'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Button } from '@/components/ui/button'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogClose } from '@/components/ui/dialog'
import { DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator } from '@/components/ui/dropdown-menu'
import { Switch } from '@/components/ui/switch'
import { Tooltip, TooltipTrigger, TooltipContent, TooltipProvider } from '@/components/ui/tooltip'
import { Loader2, CalendarDays, MoreHorizontal, ShieldOff, BellOff, Bell, MessageSquare, Pencil, Star, Images, BarChart2, X, Lock, Globe, Shield, MessageCircle, Heart, Film, FileText, Link2, Share2, Check, Copy, FolderOpen, Plus, Trash2, UserPlus, UserMinus, MapPin, ExternalLink } from 'lucide-react'
import { cn } from '@/lib/utils'
import { TimelineSkeleton } from '@/components/ui/skeleton'
import { NotFoundContent } from '@/components/not-found-content'
import { useInfiniteScroll } from '@/hooks/use-infinite-scroll'
import { triggerHaptic } from '@/hooks/use-haptics'

const BIO_TOKEN = /(#[a-zA-ZğüşıöçĞÜŞİÖÇ0-9_]+|@[a-zA-Z0-9._-]+)/g

function renderBio(bio: string) {
  const parts = bio.split(BIO_TOKEN)
  return parts.map((part, i) => {
    if (part.startsWith('#')) {
      return <Link key={i} href={`/hashtag/${encodeURIComponent(part.slice(1).toLowerCase())}`} className="text-(--color-coral) hover:underline">{part}</Link>
    }
    if (part.startsWith('@')) {
      return <Link key={i} href={`/${part.slice(1)}`} className="text-(--color-coral) hover:underline">{part}</Link>
    }
    return <span key={i}>{part}</span>
  })
}

type Tab = 'posts' | 'replies' | 'media' | 'likes' | 'collections'

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
  const [editModalOpen, setEditModalOpen] = useState(false)
  const [editForm, setEditForm] = useState({ displayName: '', bio: '', location: '', website: '', isLocked: false })
  const [editSaving, setEditSaving] = useState(false)

  const [tab, setTab] = useState<Tab>('posts')

  // Follow list modal state
  const [followModal, setFollowModal] = useState<'followers' | 'following' | null>(null)
  const [modalList, setModalList] = useState<Actor[]>([])
  const [modalLoading, setModalLoading] = useState(false)
  const [modalNextCursor, setModalNextCursor] = useState<string | null>(null)
  const [modalLoadingMore, setModalLoadingMore] = useState(false)
  const [modalSearch, setModalSearch] = useState('')
  const [modalTotal, setModalTotal] = useState<number | null>(null)

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

  // Collections tab state
  const [collectionsList, setCollectionsList] = useState<import('@/lib/api').PostCollection[]>([])
  const [collectionsLoaded, setCollectionsLoaded] = useState(false)
  const [collectionsLoading, setCollectionsLoading] = useState(false)
  const [newCollectionName, setNewCollectionName] = useState('')
  const [creatingCollection, setCreatingCollection] = useState(false)

  // Mutual followers state
  const [mutualFollowers, setMutualFollowers] = useState<{ id: string; handle: string; displayName: string | null; avatarUrl: string | null }[]>([])

  // Community badges state
  const [communityBadges, setCommunityBadges] = useState<ActorCommunityBadge[]>([])

  const [copied, setCopied] = useState(false)

  async function shareProfile() {
    const url = `${window.location.origin}/${handle}`
    if (navigator.share) {
      try { await navigator.share({ title: actor?.displayName ?? handle, url }) } catch { /* cancelled */ }
    }
  }

  async function copyLink() {
    const url = `${window.location.origin}/${handle}`
    await navigator.clipboard.writeText(url)
    setCopied(true)
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
        setBlocked(actorData.viewer?.isBlocked ?? false)
        setMuted(actorData.viewer?.isMuted ?? false)
        setEditForm({
          displayName: actorData.displayName ?? '',
          bio: actorData.bio ?? '',
          location: actorData.location ?? '',
          website: actorData.website ?? '',
          isLocked: actorData.isLocked,
        })
        if (!isOwn && fs === 'accepted') {
          api.closeFriends.check(handle).then((d) => setIsCloseFriend(d.isCloseFriend)).catch(() => {})
        }
        if (!isOwn) {
          api.actors.mutualFollowers(handle).then((d) => setMutualFollowers(d.actors)).catch(() => {})
        }
        api.actors.communityBadges(handle).then(setCommunityBadges).catch(() => {})
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
    if (t === 'collections' && !collectionsLoaded) void loadCollections()
  }

  async function loadCollections() {
    setCollectionsLoading(true)
    try {
      const data = isOwn
        ? await api.postCollections.list()
        : await api.postCollections.listByHandle(handle)
      setCollectionsList(data.collections)
      setCollectionsLoaded(true)
    } catch {
      // ignore
    } finally {
      setCollectionsLoading(false)
    }
  }

  async function createCollection() {
    if (!newCollectionName.trim()) return
    setCreatingCollection(true)
    try {
      const col = await api.postCollections.create(newCollectionName.trim())
      setCollectionsList((prev) => [{ ...col, postCount: 0 }, ...prev])
      setNewCollectionName('')
    } catch {
      // ignore
    } finally {
      setCreatingCollection(false)
    }
  }

  async function deleteCollection(id: string) {
    try {
      await api.postCollections.delete(id)
      setCollectionsList((prev) => prev.filter((c) => c.id !== id))
    } catch {
      // ignore
    }
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
    setModalTotal(null)
    setModalLoading(true)
    setModalSearch('')
    try {
      const data = type === 'followers'
        ? await api.actors.followers(handle)
        : await api.actors.following(handle)
      setModalList(data.actors)
      setModalNextCursor(data.nextCursor)
      setModalTotal((data as { total?: number }).total ?? null)
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

  async function saveEditProfile() {
    setEditSaving(true)
    try {
      await api.account.updateProfile({
        displayName: editForm.displayName.trim() || undefined,
        bio: editForm.bio.trim() || undefined,
        location: editForm.location.trim() || null,
        website: editForm.website.trim() || null,
        isLocked: editForm.isLocked,
      })
      setActor((a) => a ? {
        ...a,
        displayName: editForm.displayName.trim() || null,
        bio: editForm.bio.trim() || null,
        location: editForm.location.trim() || null,
        website: editForm.website.trim() || null,
        isLocked: editForm.isLocked,
      } : a)
      setEditModalOpen(false)
    } catch {
      // ignore
    } finally {
      setEditSaving(false)
    }
  }

  async function toggleBlock() {
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
          void triggerHaptic('selection')
        } else {
          setFollowStatus('following')
          void triggerHaptic('medium')
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
    ...(isOwn ? [{ id: 'likes' as Tab, label: 'Beğeniler', icon: <Heart className="w-3.5 h-3.5" />, count: actor.likesCount }] : []),
    { id: 'collections', label: 'Koleksiyonlar', icon: <FolderOpen className="w-3.5 h-3.5" /> },
  ]

  return (
    <TooltipProvider>
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

      <div className="px-4 pb-4 space-y-3">
        <div className="flex items-end justify-between -mt-10">
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
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button className="p-2 rounded-full border border-(--color-border) text-(--color-text-secondary) hover:bg-(--color-background-secondary) transition-colors">
                    <MoreHorizontal className="w-4 h-4" />
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent>
                  <DropdownMenuItem onSelect={() => void shareProfile()}>
                    <Share2 className="w-4 h-4" /> Paylaş
                  </DropdownMenuItem>
                  <DropdownMenuItem onSelect={() => void copyLink()}>
                    {copied ? <Check className="w-4 h-4 text-green-500" /> : <Copy className="w-4 h-4" />}
                    <span className={copied ? 'text-green-500' : ''}>{copied ? 'Kopyalandı!' : 'Linki Kopyala'}</span>
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
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
                <Tooltip>
                  <TooltipTrigger asChild>
                    <button
                      onClick={() => void toggleCloseFriend()}
                      disabled={cfLoading}
                      className={cn(
                        'p-2 rounded-full border transition-colors',
                        isCloseFriend
                          ? 'border-amber-300 text-amber-500 bg-amber-500/10'
                          : 'border-(--color-border) text-(--color-text-secondary) hover:border-amber-300 hover:text-amber-500',
                      )}
                    >
                      {cfLoading
                        ? <Loader2 className="w-4 h-4 animate-spin" />
                        : <Star className={cn('w-4 h-4', isCloseFriend && 'fill-current')} />}
                    </button>
                  </TooltipTrigger>
                  <TooltipContent>{isCloseFriend ? 'Yakın Çevreden Çıkar' : 'Yakın Çevreye Ekle'}</TooltipContent>
                </Tooltip>
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
                <Tooltip>
                  <TooltipTrigger asChild>
                    <button
                      onClick={toggleNotify}
                      disabled={notifyLoading}
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
                  </TooltipTrigger>
                  <TooltipContent>{notifyOnActivity ? 'Bildirimleri kapat' : 'Bildirimleri aç'}</TooltipContent>
                </Tooltip>
              )}
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button className="p-2 rounded-full border border-(--color-border) text-(--color-text-secondary) hover:bg-(--color-background-secondary) transition-colors">
                    <MoreHorizontal className="w-4 h-4" />
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent>
                  <DropdownMenuItem onSelect={() => void shareProfile()}>
                    <Share2 className="w-4 h-4" /> Paylaş
                  </DropdownMenuItem>
                  <DropdownMenuItem onSelect={() => void copyLink()}>
                    {copied ? <Check className="w-4 h-4 text-green-500" /> : <Copy className="w-4 h-4" />}
                    <span className={copied ? 'text-green-500' : ''}>{copied ? 'Kopyalandı!' : 'Linki Kopyala'}</span>
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onSelect={() => void toggleMute()} className={muted ? 'text-(--color-coral)' : ''}>
                    <BellOff className="w-4 h-4" /> {muted ? 'Susturmayı Kaldır' : 'Sustur'}
                  </DropdownMenuItem>
                  <DropdownMenuItem onSelect={() => void toggleBlock()} destructive={!blocked} className={blocked ? 'text-(--color-coral)' : ''}>
                    <ShieldOff className="w-4 h-4" /> {blocked ? 'Engeli Kaldır' : 'Engelle'}
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          )}
        </div>

        <div>
          <div className="flex items-center gap-2 flex-wrap">
            <h1
              className="text-xl font-bold text-(--color-text-primary) leading-tight"
              style={{ fontFamily: 'var(--font-outfit)' }}
            >
              {actor.displayName ?? actor.handle}
            </h1>
            {actor.isLocked && (
              <Tooltip>
                <TooltipTrigger asChild>
                  <span><Lock className="w-4 h-4 text-(--color-text-tertiary)" /></span>
                </TooltipTrigger>
                <TooltipContent>Kilitli hesap</TooltipContent>
              </Tooltip>
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
          <div className="flex items-center gap-2 mt-0.5 flex-wrap">
            <p className="text-sm text-(--color-text-tertiary)">
              {actor.customHandle && actor.customHandleVerifiedAt
                ? `@${actor.customHandle}`
                : `@${actor.handle}`}
            </p>
            {actor.customHandle && actor.customHandleVerifiedAt && (
              <span className="flex items-center gap-1 text-[11px] font-medium text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 px-1.5 py-0.5 rounded-full" title="Özel alan adı doğrulandı">
                <Check className="w-3 h-3" /> Doğrulandı
              </span>
            )}
            {!actor.isLocal && (
              actor.profileUrl ? (
                <a
                  href={actor.profileUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-1 text-[11px] font-medium text-(--color-teal) bg-(--color-teal)/8 px-1.5 py-0.5 rounded-full hover:bg-(--color-teal)/15 transition-colors"
                  title="Orijinal profili kaynak sunucuda aç"
                >
                  <Globe className="w-3 h-3" /> Federe <ExternalLink className="w-2.5 h-2.5" />
                </a>
              ) : (
                <span className="flex items-center gap-1 text-[11px] font-medium text-(--color-teal) bg-(--color-teal)/8 px-1.5 py-0.5 rounded-full">
                  <Globe className="w-3 h-3" /> Federe
                </span>
              )
            )}
          </div>
        </div>

        {actor.bio && (
          <p className="text-sm text-(--color-text-secondary) leading-relaxed whitespace-pre-wrap">{renderBio(actor.isLocal ? actor.bio : htmlToText(actor.bio))}</p>
        )}

        <div className="flex items-center gap-4 text-sm">
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
          <span className="flex items-center gap-1.5">
            <span className="font-bold text-(--color-text-primary) tabular-nums">{actor.postsCount >= 1000 ? `${(actor.postsCount / 1000).toFixed(1)}K` : actor.postsCount}</span>
            <span className="text-(--color-text-tertiary)">Gönderi</span>
          </span>
        </div>

        {/* Mutual followers */}
        {!isOwn && mutualFollowers.length > 0 && (
          <div className="flex items-center gap-2.5">
            <div className="flex -space-x-1.5 flex-shrink-0">
              {mutualFollowers.slice(0, 3).map((m) => (
                <Avatar key={m.id} className="w-6 h-6 ring-2 ring-(--color-background)">
                  {m.avatarUrl && <AvatarImage src={m.avatarUrl} alt="" />}
                  <AvatarFallback className="text-[9px] text-white" style={{ background: 'var(--gradient-avatar)' }}>
                    {(m.displayName ?? m.handle).slice(0, 1).toUpperCase()}
                  </AvatarFallback>
                </Avatar>
              ))}
            </div>
            <p className="text-[12px] text-(--color-text-tertiary) leading-snug">
              {mutualFollowers.length === 1
                ? <><Link href={`/${mutualFollowers[0]!.handle}`} className="font-medium text-(--color-text-primary) hover:underline">@{mutualFollowers[0]!.handle}</Link> takip ediyor</>
                : mutualFollowers.length === 2
                  ? <><Link href={`/${mutualFollowers[0]!.handle}`} className="font-medium text-(--color-text-primary) hover:underline">@{mutualFollowers[0]!.handle}</Link> ve <Link href={`/${mutualFollowers[1]!.handle}`} className="font-medium text-(--color-text-primary) hover:underline">@{mutualFollowers[1]!.handle}</Link> takip ediyor</>
                  : <><Link href={`/${mutualFollowers[0]!.handle}`} className="font-medium text-(--color-text-primary) hover:underline">@{mutualFollowers[0]!.handle}</Link> ve {mutualFollowers.length - 1} kişi daha takip ediyor</>
              }
            </p>
          </div>
        )}

        <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
          <div className="flex items-center gap-1 text-xs text-(--color-text-tertiary)">
            <CalendarDays className="w-3.5 h-3.5" />
            <span>{joinDate} katıldı</span>
            {accountAgeText && (
              <span className="text-(--color-text-tertiary)/60">· {accountAgeText}</span>
            )}
          </div>
          {actor.location && (
            <Link
              href={`/location/${encodeURIComponent(actor.location)}`}
              className="flex items-center gap-1 text-xs text-(--color-text-tertiary) hover:text-(--color-coral) transition-colors"
            >
              <MapPin className="w-3.5 h-3.5 flex-shrink-0" />
              <span>{actor.location}</span>
            </Link>
          )}
          {actor.website && (
            <a
              href={actor.website.startsWith('http') ? actor.website : `https://${actor.website}`}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1 text-xs font-medium text-(--color-teal) bg-(--color-teal)/8 hover:bg-(--color-teal)/15 px-2 py-0.5 rounded-full transition-colors max-w-[200px]"
            >
              <Link2 className="w-3 h-3 flex-shrink-0" />
              <span className="truncate">{actor.website.replace(/^https?:\/\//, '').replace(/\/$/, '')}</span>
            </a>
          )}
          {actor.profileFields && actor.profileFields.length > 0 && (
            <div className="flex flex-wrap gap-x-4 gap-y-1 mt-0.5">
              {actor.profileFields.map((field, i) => {
                // Remote fields are HTML (Mastodon PropertyValue): pull out the href
                // and show clean text instead of raw <a>/<span> markup.
                const text = htmlToText(field.value)
                const url = field.value.startsWith('http')
                  ? field.value
                  : (field.value.match(/href="([^"]+)"/i)?.[1] ?? (text.startsWith('http') ? text : undefined))
                return (
                  <span key={i} className="flex items-center gap-1 text-xs">
                    <span className="text-(--color-text-tertiary) font-medium">{htmlToText(field.name)}</span>
                    {url ? (
                      <a
                        href={url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className={cn('flex items-center gap-0.5 hover:underline', field.verifiedAt ? 'text-emerald-500' : 'text-(--color-coral)')}
                      >
                        {(text || url).replace(/^https?:\/\//, '').replace(/\/$/, '')}
                        <Link2 className="w-2.5 h-2.5" />
                      </a>
                    ) : (
                      <span className="text-(--color-text-secondary)">{text}</span>
                    )}
                  </span>
                )
              })}
            </div>
          )}
          {actor.blueskyHandle && (
            <a
              href={`https://bsky.app/profile/${actor.blueskyHandle}`}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1 text-xs font-medium text-sky-600 dark:text-sky-400 bg-sky-500/8 hover:bg-sky-500/15 px-2 py-0.5 rounded-full transition-colors"
            >
              <svg className="w-3 h-3 fill-current flex-shrink-0" viewBox="0 0 24 24" aria-hidden="true">
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
              className="font-mono text-[10px] text-(--color-text-tertiary) hover:text-(--color-teal) transition-colors"
            >
              did:web
            </a>
          )}
        </div>

      </div>

      {/* Community Badges */}
      {communityBadges.length > 0 && (
        <div className="px-4 pb-3">
          <div className="flex flex-wrap gap-2">
            {communityBadges.map((b) => (
              <Link
                key={b.id}
                href={b.community ? `/c/${b.community.handle}` : '#'}
                className="group inline-flex items-center gap-1.5 text-[12px] font-semibold px-2.5 py-1 rounded-full border border-(--color-border) bg-(--color-background-secondary) hover:border-(--color-coral)/50 transition-colors"
                title={b.community ? `${b.community.displayName ?? b.community.handle}` : ''}
              >
                <span>{b.icon}</span>
                <span className="text-(--color-text-secondary) group-hover:text-(--color-text-primary) transition-colors">{b.name}</span>
                {b.community && (
                  <span className="text-[10px] text-(--color-text-tertiary) font-normal">@{b.community.handle}</span>
                )}
              </Link>
            ))}
          </div>
        </div>
      )}

      {/* Tabs */}
      <Tabs value={tab} onValueChange={(v) => handleTabChange(v as Tab)}>
        <TabsList className="w-full">
          {tabs.map((t) => (
            <TabsTrigger key={t.id} value={t.id} className="gap-1.5">
              {t.icon}
              <span className="hidden sm:inline">{t.label}</span>
              {t.count != null && t.count > 0 && (
                <span className="tabular-nums text-[10px] opacity-60">
                  {t.count >= 1000 ? `${(t.count / 1000).toFixed(1)}K` : t.count}
                </span>
              )}
            </TabsTrigger>
          ))}
        </TabsList>
      </Tabs>

      {/* Tab content — min-h prevents scrollbar appearing/disappearing between tabs */}
      <div className="min-h-[70vh]">

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

      {tab === 'collections' && (
        <div className="px-4 py-4 space-y-3">
          {/* Create collection form — own profile only */}
          {isOwn && (
            <div className="flex items-center gap-2">
              <input
                value={newCollectionName}
                onChange={(e) => setNewCollectionName(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') void createCollection() }}
                maxLength={100}
                placeholder="Yeni koleksiyon adı…"
                className="flex-1 text-sm bg-(--color-background-secondary) border border-(--color-border) rounded-xl px-3 py-2 focus:outline-none focus:border-(--color-coral) text-(--color-text-primary) placeholder:text-(--color-text-tertiary)"
              />
              <button
                onClick={() => void createCollection()}
                disabled={!newCollectionName.trim() || creatingCollection}
                className="p-2 rounded-xl bg-(--color-coral) text-white hover:bg-(--color-coral-hover) disabled:opacity-40 transition-colors"
              >
                {creatingCollection ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
              </button>
            </div>
          )}

          {collectionsLoading ? (
            <div className="flex justify-center py-10"><Loader2 className="w-5 h-5 animate-spin text-(--color-coral)" /></div>
          ) : collectionsList.length === 0 ? (
            <div className="py-10 flex flex-col items-center gap-2 text-center">
              <FolderOpen className="w-8 h-8 text-(--color-text-tertiary)" />
              <p className="text-sm font-medium text-(--color-text-secondary)">Henüz koleksiyon yok</p>
              {isOwn && <p className="text-xs text-(--color-text-tertiary)">Gönderilerini konuya göre grupla</p>}
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-3">
              {collectionsList.map((c) => (
                <a
                  key={c.id}
                  href={`/collections/${c.id}`}
                  className="group relative rounded-2xl border border-(--color-border) bg-(--color-background-secondary) p-4 hover:border-(--color-coral)/50 hover:bg-(--color-background-tertiary) transition-all"
                >
                  <FolderOpen className="w-5 h-5 text-(--color-coral) mb-2" />
                  <p className="text-sm font-semibold text-(--color-text-primary) line-clamp-1">{c.name}</p>
                  <p className="text-xs text-(--color-text-tertiary) mt-0.5">{c.postCount ?? 0} gönderi</p>
                  {!c.isPublic && <span className="text-[10px] font-semibold text-(--color-text-tertiary) mt-1 block">Gizli</span>}
                  {isOwn && (
                    <button
                      onClick={(e) => { e.preventDefault(); e.stopPropagation(); void deleteCollection(c.id) }}
                      className="absolute top-2 right-2 p-1 rounded-lg opacity-0 group-hover:opacity-100 hover:bg-red-500/10 text-red-500 transition-all"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  )}
                </a>
              ))}
            </div>
          )}
        </div>
      )}

      </div>{/* end min-h tab content wrapper */}

      <div ref={loadMoreRef} className="h-1" />

      {/* ── Profile edit modal ──────────────────────────────── */}
      <Dialog open={editModalOpen} onOpenChange={setEditModalOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle style={{ fontFamily: 'var(--font-outfit)' }}>Profili Düzenle</DialogTitle>
          </DialogHeader>
              <div className="px-4 py-4 space-y-4">
                <div>
                  <label className="text-xs font-medium text-(--color-text-tertiary) mb-1 block">Görünen ad</label>
                  <input
                    value={editForm.displayName}
                    onChange={(e) => setEditForm((f) => ({ ...f, displayName: e.target.value }))}
                    maxLength={60}
                    placeholder="Görünen adın"
                    className="w-full text-sm bg-(--color-background-secondary) border border-(--color-border) rounded-xl px-3 py-2.5 text-(--color-text-primary) placeholder:text-(--color-text-tertiary) focus:outline-none focus:border-(--color-coral)/60 transition-colors"
                  />
                </div>
                <div>
                  <label className="text-xs font-medium text-(--color-text-tertiary) mb-1 block">Bio</label>
                  <textarea
                    value={editForm.bio}
                    onChange={(e) => setEditForm((f) => ({ ...f, bio: e.target.value }))}
                    maxLength={500}
                    rows={3}
                    placeholder="Kendinden bahset…"
                    className="w-full text-sm bg-(--color-background-secondary) border border-(--color-border) rounded-xl px-3 py-2.5 text-(--color-text-primary) placeholder:text-(--color-text-tertiary) focus:outline-none focus:border-(--color-coral)/60 transition-colors resize-none"
                  />
                  <p className="text-[11px] text-(--color-text-tertiary) text-right mt-0.5">{500 - editForm.bio.length}</p>
                </div>
                <div>
                  <label className="text-xs font-medium text-(--color-text-tertiary) mb-1 block">Konum</label>
                  <input
                    value={editForm.location}
                    onChange={(e) => setEditForm((f) => ({ ...f, location: e.target.value }))}
                    maxLength={200}
                    placeholder="İstanbul, Türkiye"
                    className="w-full text-sm bg-(--color-background-secondary) border border-(--color-border) rounded-xl px-3 py-2.5 text-(--color-text-primary) placeholder:text-(--color-text-tertiary) focus:outline-none focus:border-(--color-coral)/60 transition-colors"
                  />
                </div>
                <div>
                  <label className="text-xs font-medium text-(--color-text-tertiary) mb-1 block">Website</label>
                  <input
                    value={editForm.website}
                    onChange={(e) => setEditForm((f) => ({ ...f, website: e.target.value }))}
                    maxLength={200}
                    placeholder="https://example.com"
                    type="url"
                    className="w-full text-sm bg-(--color-background-secondary) border border-(--color-border) rounded-xl px-3 py-2.5 text-(--color-text-primary) placeholder:text-(--color-text-tertiary) focus:outline-none focus:border-(--color-coral)/60 transition-colors"
                  />
                </div>
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="text-sm font-medium text-(--color-text-primary)">Kilitli hesap</p>
                    <p className="text-xs text-(--color-text-tertiary)">Takip isteklerini onaylamak zorunda kalırsın</p>
                  </div>
                  <Switch
                    checked={editForm.isLocked}
                    onCheckedChange={(v) => setEditForm((f) => ({ ...f, isLocked: v }))}
                  />
                </div>
              </div>
          <DialogFooter>
            <DialogClose asChild>
              <button className="px-4 py-2 rounded-full border border-(--color-border) text-sm font-medium text-(--color-text-secondary) hover:bg-(--color-background-secondary) transition-colors">
                İptal
              </button>
            </DialogClose>
            <button
              onClick={() => void saveEditProfile()}
              disabled={editSaving}
              className="px-4 py-2 rounded-full bg-(--color-coral) text-white text-sm font-semibold hover:opacity-90 transition-opacity disabled:opacity-50 flex items-center gap-1.5"
            >
              {editSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
              Kaydet
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Follow list modal */}
      <Dialog open={!!followModal} onOpenChange={(o) => { if (!o) setFollowModal(null) }}>
        <DialogContent showClose={false} className="flex flex-col max-h-[75vh] p-0">
          <DialogHeader className="flex-shrink-0">
            <div>
              <DialogTitle style={{ fontFamily: 'var(--font-outfit)' }}>
                {followModal === 'followers' ? 'Takipçiler' : 'Takip Edilenler'}
              </DialogTitle>
              {!modalLoading && (() => {
                // For remote actors the real count lives on the origin server
                // (modalTotal only reflects locally-known relationships).
                const cnt = actor.isLocal
                  ? modalTotal
                  : (followModal === 'followers' ? actor.followersCount : actor.followingCount)
                if (cnt === null || cnt === undefined) return null
                const label = cnt >= 1000 ? `${(cnt / 1000).toFixed(1)}K` : `${cnt}`
                return <p className="text-xs text-(--color-text-tertiary) mt-0.5">{label} kişi</p>
              })()}
            </div>
            <DialogClose asChild>
              <button className="p-1.5 rounded-full hover:bg-(--color-background-secondary) text-(--color-text-tertiary) transition-colors">
                <X className="w-4 h-4" />
              </button>
            </DialogClose>
          </DialogHeader>
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
                <div className="py-12 text-center px-6">
                  {!actor.isLocal && !modalSearch ? (
                    <div className="space-y-2">
                      <p className="text-sm text-(--color-text-tertiary) leading-relaxed">
                        Bu liste <span className="font-medium">{actor.handle.split('@')[1] ?? 'kaynak sunucu'}</span> üzerinde tutuluyor ve federasyonda buradan listelenemiyor. Yalnızca bu sunucudaki ilişkiler görünür.
                      </p>
                      {actor.profileUrl && (
                        <a href={actor.profileUrl} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-sm text-(--color-coral) hover:underline">
                          Orijinalinde gör <ExternalLink className="w-3 h-3" />
                        </a>
                      )}
                    </div>
                  ) : (
                    <p className="text-sm text-(--color-text-tertiary)">
                      {modalSearch ? 'Sonuç bulunamadı.' : followModal === 'followers' ? 'Henüz takipçi yok.' : 'Henüz kimse takip edilmiyor.'}
                    </p>
                  )}
                </div>
              ) : (
                <>
                  {visible.map((a) => <ActorRow key={a.id} actor={a} currentHandle={currentHandle} onNavigate={() => setFollowModal(null)} />)}
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
        </DialogContent>
      </Dialog>
    </div>
    </TooltipProvider>
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

function ActorRow({ actor, currentHandle, onNavigate }: { actor: Actor; currentHandle?: string; onNavigate?: () => void }) {
  const initials = (actor.displayName ?? actor.handle).slice(0, 2).toUpperCase()
  const isSelf = currentHandle === actor.handle
  const [followState, setFollowState] = useState<'none' | 'pending' | 'following'>(
    actor.viewer?.followStatus === 'accepted' ? 'following'
    : actor.viewer?.followStatus === 'pending' ? 'pending'
    : actor.viewer?.following ? 'following'
    : 'none'
  )
  const [busy, setBusy] = useState(false)

  async function toggle(e: React.MouseEvent) {
    e.preventDefault()
    e.stopPropagation()
    if (busy) return
    setBusy(true)
    try {
      if (followState !== 'none') {
        await api.actors.unfollow(actor.handle)
        setFollowState('none')
      } else {
        const res = await api.actors.follow(actor.handle)
        setFollowState(res?.status === 'pending' ? 'pending' : 'following')
      }
    } catch { /* ignore */ } finally { setBusy(false) }
  }

  return (
    <Link
      href={`/${actor.handle}`}
      onClick={onNavigate}
      className="flex items-center gap-3 px-4 py-3 border-b border-(--color-border-secondary) hover:bg-(--color-background-secondary) transition-colors"
    >
      <Avatar className="w-10 h-10 flex-shrink-0">
        {actor.avatarUrl && <AvatarImage src={actor.avatarUrl} alt={actor.displayName ?? actor.handle} />}
        <AvatarFallback className="text-sm font-medium text-white" style={{ background: 'var(--gradient-avatar)' }}>
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
      {!isSelf && currentHandle && (
        <button
          onClick={toggle}
          disabled={busy}
          className={cn(
            'flex-shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold transition-all disabled:opacity-50',
            followState !== 'none'
              ? 'border border-(--color-border) text-(--color-text-secondary) hover:border-red-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-950/20'
              : 'bg-(--color-coral) text-white hover:opacity-90',
          )}
        >
          {busy ? <Loader2 className="w-3 h-3 animate-spin" />
            : followState === 'following' ? <><UserMinus className="w-3 h-3" />Takiptesin</>
            : followState === 'pending' ? 'İstek gönderildi'
            : <><UserPlus className="w-3 h-3" />Takip et</>}
        </button>
      )}
    </Link>
  )
}
