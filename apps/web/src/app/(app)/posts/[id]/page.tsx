'use client'

import { useState, useEffect, useCallback, use } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft, Heart, Repeat2, MessageCircle, Bookmark, Loader2, Trash2, Languages, Quote, MoreHorizontal, Share2, Copy, Check, X, Globe, Eye, Users, Lock, UserCheck, Clock } from 'lucide-react'
import { api, type Post, type ThreadContext, type QuotedPost, type Actor } from '@/lib/api'
import { PostCard, InlineVideoPlayer, YouTubeCard, MusicCard, VideoEmbedCard, LocationCard, extractYouTubeId, detectPlatformFromUrl, detectVideoEmbed, MATH_RE, renderMathPart } from '@/components/posts/post-card'
import { htmlToText } from '@/lib/html'
import { PostComposer } from '@/components/posts/post-composer'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { AlertDialog, AlertDialogContent, AlertDialogHeader, AlertDialogTitle, AlertDialogDescription, AlertDialogFooter, AlertDialogCancel, AlertDialogAction } from '@/components/ui/alert-dialog'
import { DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator } from '@/components/ui/dropdown-menu'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogClose } from '@/components/ui/dialog'
import { useSession } from '@/lib/auth-client'
import { TimelineSkeleton } from '@/components/ui/skeleton'
import { NotFoundContent } from '@/components/not-found-content'
import { TooltipProvider } from '@/components/ui/tooltip'
import { cn } from '@/lib/utils'

// ── Content renderer ───────────────────────────────────────────────────────────
const TOKEN_RE = /(#[a-zA-ZğüşıöçĞÜŞİÖÇ0-9_]+|@[a-zA-Z0-9._-]+)/g

function renderContent(text: string, isRemote = false) {
  // Remote (ActivityPub) content is HTML — convert to text first.
  const src = isRemote ? htmlToText(text) : text
  // Math first, then hashtag/mention tokenisation on the remaining text
  return src.split(MATH_RE).map((mp, mi) => {
    const math = mi % 2 === 1 ? renderMathPart(mp, `m-${mi}`) : null
    if (math) return math
    return mp.split(TOKEN_RE).map((part, i) => {
      if (part.startsWith('#'))
        return <Link key={`${mi}-${i}`} href={`/hashtag/${encodeURIComponent(part.slice(1).toLowerCase())}`} className="text-(--color-coral) hover:underline">{part}</Link>
      if (part.startsWith('@'))
        return <Link key={`${mi}-${i}`} href={`/${part.slice(1)}`} className="text-(--color-coral) hover:underline">{part}</Link>
      return <span key={`${mi}-${i}`}>{part}</span>
    })
  })
}

function fmt(n: number) {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}B`
  return n.toString()
}

function countWords(texts: (string | null | undefined)[]) {
  return texts.filter(Boolean).join(' ').trim().split(/\s+/).filter(Boolean).length
}

// ── Liker row (likes modal) ──────────────────────────────────────────────────
function LikerRow({ actor, currentHandle, onNavigate }: { actor: Actor; currentHandle: string; onNavigate: () => void }) {
  const initials = (actor.displayName ?? actor.handle).slice(0, 2).toUpperCase()
  const isSelf = currentHandle === actor.handle
  const [following, setFollowing] = useState(actor.viewer?.followStatus === 'accepted' || !!actor.viewer?.following)
  const [busy, setBusy] = useState(false)

  async function toggle(e: React.MouseEvent) {
    e.preventDefault()
    e.stopPropagation()
    if (busy) return
    setBusy(true)
    try {
      if (following) { await api.actors.unfollow(actor.handle); setFollowing(false) }
      else { await api.actors.follow(actor.handle); setFollowing(true) }
    } catch { } finally { setBusy(false) }
  }

  return (
    <Link
      href={`/${actor.handle}`}
      onClick={onNavigate}
      className="flex items-center gap-3 px-4 py-3 hover:bg-(--color-background-secondary)/60 transition-colors"
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
        <p className="text-xs text-(--color-text-tertiary) truncate">@{actor.handle}</p>
      </div>
      {!isSelf && (
        <button
          onClick={toggle}
          disabled={busy}
          className={cn(
            'flex-shrink-0 text-xs font-semibold px-3 py-1.5 rounded-full transition-colors disabled:opacity-50',
            following
              ? 'bg-(--color-background-secondary) text-(--color-text-secondary) hover:bg-red-50 hover:text-red-500 dark:hover:bg-red-900/20'
              : 'bg-(--color-coral) text-white hover:bg-(--color-coral-hover)',
          )}
        >
          {busy ? <Loader2 className="w-3 h-3 animate-spin" /> : following ? 'Takip ediliyor' : 'Takip et'}
        </button>
      )}
    </Link>
  )
}

// ── Reply tree ─────────────────────────────────────────────────────────────────
type ReplyNode = { post: Post; children: ReplyNode[] }

function buildReplyTree(replies: Post[], parentId: string): ReplyNode[] {
  return replies
    .filter((r) => r.replyToId === parentId)
    .map((r) => ({ post: r, children: buildReplyTree(replies, r.id) }))
}

function ReplyBranch({ nodes, depth, handle, onDelete }: {
  nodes: ReplyNode[]
  depth: number
  handle: string | undefined
  onDelete: (id: string) => void
}) {
  if (nodes.length === 0) return null
  return (
    <>
      {nodes.map((node) => (
        <div key={node.post.id}>
          {depth > 0 ? (
            <div className="flex">
              <div className="w-10 flex-shrink-0 flex justify-center">
                <div className="w-px bg-(--color-border-secondary) h-full" />
              </div>
              <div className="flex-1 min-w-0">
                <PostCard post={node.post} currentActorHandle={handle} onDelete={onDelete} />
              </div>
            </div>
          ) : (
            <PostCard post={node.post} currentActorHandle={handle} onDelete={onDelete} />
          )}
          {node.children.length > 0 && (
            <ReplyBranch nodes={node.children} depth={depth + 1} handle={handle} onDelete={onDelete} />
          )}
        </div>
      ))}
    </>
  )
}

// ── Focused post ───────────────────────────────────────────────────────────────
function FocusedPost({ post, handle, displayName, avatarUrl, hasAncestors, onReplyClick, onQuotePosted, onDelete }: {
  post: Post
  handle: string | undefined
  displayName: string
  avatarUrl: string | null
  hasAncestors: boolean
  onReplyClick: () => void
  onQuotePosted: () => void
  onDelete: (id: string) => void
}) {
  const [liked, setLiked] = useState(post.viewer?.liked ?? false)
  const [boosted, setBoosted] = useState(post.viewer?.boosted ?? false)
  const [bookmarked, setBookmarked] = useState(post.viewer?.bookmarked ?? false)
  const [likesCount, setLikesCount] = useState(post.likesCount)
  const [boostsCount, setBoostsCount] = useState(post.boostsCount)
  const [deleteConfirm, setDeleteConfirm] = useState(false)
  const [quoteModalOpen, setQuoteModalOpen] = useState(false)
  const [likersOpen, setLikersOpen] = useState(false)
  const [likersList, setLikersList] = useState<Actor[] | null>(null)
  const [likersLoading, setLikersLoading] = useState(false)
  const [likersCursor, setLikersCursor] = useState<string | null>(null)
  const [likersLoadingMore, setLikersLoadingMore] = useState(false)
  const [translation, setTranslation] = useState<{ text: string; from: string } | null>(null)
  const [translating, setTranslating] = useState(false)
  const [copied, setCopied] = useState(false)

  const isOwn = handle === post.author?.handle
  const initials = (post.author?.displayName ?? post.author?.handle ?? '??').slice(0, 2).toUpperCase()

  const date = new Date(post.createdAt)
  const dateStr = date.toLocaleDateString('tr-TR', { day: 'numeric', month: 'long', year: 'numeric' })
  const timeStr = date.toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' })

  async function toggleLike() {
    const prev = liked
    setLiked(!prev)
    setLikesCount(c => prev ? c - 1 : c + 1)
    try {
      if (prev) await api.posts.unlike(post.id)
      else await api.posts.like(post.id)
    } catch {
      setLiked(prev)
      setLikesCount(c => prev ? c + 1 : c - 1)
    }
  }

  async function toggleBoost() {
    const prev = boosted
    setBoosted(!prev)
    setBoostsCount(c => prev ? c - 1 : c + 1)
    try {
      if (prev) await api.posts.unboost(post.id)
      else await api.posts.boost(post.id)
    } catch {
      setBoosted(prev)
      setBoostsCount(c => prev ? c + 1 : c - 1)
    }
  }

  async function toggleBookmark() {
    const prev = bookmarked
    setBookmarked(!prev)
    try {
      if (prev) await api.posts.unbookmark(post.id)
      else await api.posts.bookmark(post.id)
    } catch {
      setBookmarked(prev)
    }
  }

  async function toggleTranslate() {
    if (translation) { setTranslation(null); return }
    setTranslating(true)
    try {
      const result = await api.translate.text(post.content, 'tr')
      setTranslation({ text: result.translated, from: result.detectedLangName })
    } catch {
    } finally {
      setTranslating(false)
    }
  }

  async function sharePost() {
    const url = `${window.location.origin}/posts/${post.id}`
    if (navigator.share) {
      try { await navigator.share({ url }) } catch { /* cancelled */ }
    }
  }

  async function copyLink() {
    await navigator.clipboard.writeText(`${window.location.origin}/posts/${post.id}`)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  async function openLikers() {
    setLikersOpen(true)
    if (likersList) return
    setLikersLoading(true)
    try {
      const data = await api.posts.likes(post.id)
      setLikersList(data.actors)
      setLikersCursor(data.nextCursor)
    } catch {
      setLikersList([])
    } finally {
      setLikersLoading(false)
    }
  }

  async function loadMoreLikers() {
    if (!likersCursor || likersLoadingMore) return
    setLikersLoadingMore(true)
    try {
      const data = await api.posts.likes(post.id, likersCursor)
      setLikersList(prev => [...(prev ?? []), ...data.actors])
      setLikersCursor(data.nextCursor)
    } catch {
    } finally {
      setLikersLoadingMore(false)
    }
  }

  return (
    <>
      <article className="relative">
        {/* Thread connector coming down from the ancestor, terminating behind this avatar */}
        {hasAncestors && (
          <div
            aria-hidden
            className="absolute w-0.5 bg-(--color-border-secondary) pointer-events-none z-0"
            style={{ left: '35px', top: 0, height: '42px' }}
          />
        )}
        {/* Author header */}
        <div className="flex items-center gap-3 px-4 pt-5 pb-3">
          <Link href={`/${post.author?.handle}`} className="relative z-[1]">
            <Avatar className="w-11 h-11">
              {post.author?.avatarUrl && <AvatarImage src={post.author.avatarUrl} alt={post.author.displayName ?? post.author.handle} />}
              <AvatarFallback className="text-sm font-medium text-white" style={{ background: 'var(--gradient-avatar)' }}>
                {initials}
              </AvatarFallback>
            </Avatar>
          </Link>
          <div className="flex-1 min-w-0">
            <Link
              href={`/${post.author?.handle}`}
              className="block font-bold text-(--color-text-primary) text-base truncate hover:underline leading-tight"
              style={{ fontFamily: 'var(--font-outfit)' }}
            >
              {post.author?.displayName ?? post.author?.handle}
            </Link>
            <div className="flex items-center gap-1.5 mt-0.5">
              <span className="text-sm text-(--color-text-tertiary) truncate">@{post.author?.handle}</span>
              {post.author && !post.author.isLocal && (
                <span title="Federe kullanıcı" className="text-(--color-teal) flex-shrink-0"><Globe className="w-3.5 h-3.5" /></span>
              )}
              {post.visibility !== 'public' && (
                <span className="text-(--color-text-tertiary) flex-shrink-0" title={post.visibility}>
                  {post.visibility === 'unlisted' && <Eye className="w-3.5 h-3.5" />}
                  {post.visibility === 'followers' && <Users className="w-3.5 h-3.5" />}
                  {post.visibility === 'close_friends' && <UserCheck className="w-3.5 h-3.5" />}
                  {post.visibility === 'direct' && <Lock className="w-3.5 h-3.5" />}
                </span>
              )}
            </div>
          </div>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button className="p-2 rounded-full text-(--color-text-tertiary) hover:bg-(--color-background-secondary) transition-colors flex-shrink-0">
                <MoreHorizontal className="w-4 h-4" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent>
              <DropdownMenuItem onSelect={() => void sharePost()}>
                <Share2 className="w-4 h-4" /> Paylaş
              </DropdownMenuItem>
              <DropdownMenuItem onSelect={() => void copyLink()}>
                {copied ? <Check className="w-4 h-4 text-green-500" /> : <Copy className="w-4 h-4" />}
                <span className={copied ? 'text-green-500' : ''}>{copied ? 'Kopyalandı!' : 'Linki Kopyala'}</span>
              </DropdownMenuItem>
              {isOwn && (
                <>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem destructive onSelect={() => setDeleteConfirm(true)}>
                    <Trash2 className="w-4 h-4" /> Sil
                  </DropdownMenuItem>
                </>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        {/* Content */}
        {post.content && (
          <div className="px-4 pb-3">
            <p className="text-base leading-[1.7] text-(--color-text-primary) whitespace-pre-wrap break-words">
              {renderContent(post.content, post.isLocal === false)}
            </p>
          </div>
        )}

        {/* Translation — right below text, before media */}
        {translation && (
          <div className="mx-4 mb-3 p-3 rounded-xl bg-(--color-background-secondary) border border-(--color-border-secondary)">
            <p className="text-[11px] text-(--color-text-tertiary) mb-1.5 font-medium">{translation.from} → Türkçe</p>
            <p className="text-sm leading-[1.7] text-(--color-text-primary)">{translation.text}</p>
          </div>
        )}

        {/* Media */}
        {post.media && post.media.length > 0 && (
          <div className="px-4 pb-3">
            <div className={cn(
              'rounded-xl overflow-hidden',
              post.media.length === 1 ? '' : 'grid grid-cols-2 gap-0.5',
            )}>
              {post.media.map((m) => (
                m.mimeType?.startsWith('video/') ? (
                  <div key={m.id} className={cn('relative bg-black overflow-hidden rounded-xl', post.media.length > 1 && 'aspect-square')}>
                    <InlineVideoPlayer
                      url={m.url}
                      previewUrl={m.previewUrl}
                      altText={m.altText}
                      square={post.media.length > 1}
                    />
                  </div>
                ) : (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    key={m.id}
                    src={m.url}
                    alt={m.altText ?? ''}
                    className={cn('w-full object-cover bg-(--color-background-secondary)', post.media.length === 1 ? 'max-h-[400px] rounded-xl' : 'aspect-square')}
                    loading="lazy"
                  />
                )
              ))}
            </div>
          </div>
        )}

        {/* Link preview — YouTube / music embeds play in-site, like the feed card */}
        {post.linkPreview && !post.media?.length && (
          <div className="px-4 pb-3 [&>*]:mt-0">
            {(() => {
              const lp = post.linkPreview
              const rawPlatform = lp.musicPlatform ?? detectPlatformFromUrl(lp.url)
              const isMusicCard = !!rawPlatform && rawPlatform !== 'youtube'
              const ytId = !isMusicCard ? extractYouTubeId(lp.url) : null
              const videoEmbed = !isMusicCard && !ytId ? detectVideoEmbed(lp.url) : null

              if (isMusicCard) return <MusicCard preview={{ ...lp, musicPlatform: rawPlatform ?? undefined }} />
              if (ytId) return <YouTubeCard preview={lp} videoId={ytId} />
              if (videoEmbed) return <VideoEmbedCard preview={lp} platform={videoEmbed.platform} embedUrl={videoEmbed.embedUrl} />
              return (
                <a
                  href={lp.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="block rounded-xl border border-(--color-border) overflow-hidden hover:border-(--color-coral)/40 transition-colors group"
                >
                  {lp.image && (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={lp.image} alt="" className="w-full max-h-52 object-cover bg-(--color-background-secondary)" loading="lazy" />
                  )}
                  <div className="px-3 py-2.5">
                    {lp.siteName && <p className="text-[11px] text-(--color-text-tertiary) mb-0.5 uppercase tracking-wide">{lp.siteName}</p>}
                    {lp.title && <p className="text-sm font-medium text-(--color-text-primary) line-clamp-2 group-hover:text-(--color-coral) transition-colors">{lp.title}</p>}
                    {lp.description && <p className="text-xs text-(--color-text-tertiary) mt-0.5 line-clamp-2">{lp.description}</p>}
                    <p className="text-[11px] text-(--color-text-tertiary) mt-1.5 truncate">{lp.url}</p>
                  </div>
                </a>
              )
            })()}
          </div>
        )}

        {/* Location */}
        {post.locationName && (
          <div className="px-4 pb-3">
            <LocationCard name={post.locationName} lat={post.locationLat} lng={post.locationLng} />
          </div>
        )}

        {/* Date + view count — no divider above */}
        <div className="px-4 py-2.5 flex items-center gap-1.5 flex-wrap">
          <span className="text-sm text-(--color-text-tertiary)">{timeStr}</span>
          <span className="text-(--color-text-tertiary)/40">·</span>
          <span className="text-sm text-(--color-text-tertiary)">{dateStr}</span>
          {post.viewCount > 0 && (
            <>
              <span className="text-(--color-text-tertiary)/40">·</span>
              <span className="text-sm text-(--color-text-tertiary)">{fmt(post.viewCount)} görüntülenme</span>
            </>
          )}
        </div>

        {/* Stats row — only if there's activity (own top border avoids double dividers) */}
        {(post.repliesCount > 0 || boostsCount > 0 || likesCount > 0 || (post.quotesCount ?? 0) > 0) && (
          <div className="px-4 py-3 flex items-center gap-x-5 gap-y-1.5 flex-wrap border-t border-(--color-border-secondary)">
            {post.repliesCount > 0 && (
              <span className="flex items-center gap-1.5 text-sm">
                <span className="font-semibold text-(--color-text-primary) tabular-nums">{fmt(post.repliesCount)}</span>
                <span className="text-(--color-text-tertiary)">Yanıt</span>
              </span>
            )}
            {boostsCount > 0 && (
              <span className="flex items-center gap-1.5 text-sm">
                <span className={cn('font-semibold tabular-nums', boosted ? 'text-teal-500' : 'text-(--color-text-primary)')}>{fmt(boostsCount)}</span>
                <span className="text-(--color-text-tertiary)">Yeniden paylaşım</span>
              </span>
            )}
            {likesCount > 0 && (
              <button onClick={() => void openLikers()} className="flex items-center gap-1.5 text-sm group/l">
                <span className={cn('font-semibold tabular-nums transition-colors', liked ? 'text-(--color-coral)' : 'text-(--color-text-primary) group-hover/l:text-(--color-coral)')}>{fmt(likesCount)}</span>
                <span className="text-(--color-text-tertiary) group-hover/l:text-(--color-coral) transition-colors">Beğeni</span>
              </button>
            )}
            {(post.quotesCount ?? 0) > 0 && (
              <Link href={`/posts/${post.id}/quotes`} className="flex items-center gap-1.5 text-sm group/q">
                <span className="font-semibold text-(--color-text-primary) tabular-nums group-hover/q:text-(--color-coral) transition-colors">{fmt(post.quotesCount ?? 0)}</span>
                <span className="text-(--color-text-tertiary) group-hover/q:text-(--color-coral) transition-colors">Alıntı</span>
              </Link>
            )}
          </div>
        )}

        {/* Action buttons */}
        <div className="flex items-center justify-around px-2 py-1 border-t border-(--color-border-secondary)">
          {/* Reply */}
          <button
            onClick={onReplyClick}
            className="flex items-center justify-center p-3 rounded-full text-(--color-text-tertiary) hover:text-(--color-coral) hover:bg-(--color-coral)/8 transition-colors"
          >
            <MessageCircle className="w-5 h-5" />
          </button>

          {/* Boost — menu with repost + quote */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                className={cn(
                  'flex items-center justify-center p-3 rounded-full transition-colors',
                  boosted ? 'text-teal-500 bg-teal-500/8' : 'text-(--color-text-tertiary) hover:text-teal-500 hover:bg-teal-500/8',
                )}
              >
                <Repeat2 className="w-5 h-5" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent>
              <DropdownMenuItem onSelect={() => void toggleBoost()}>
                <Repeat2 className={cn('w-4 h-4', boosted && 'text-teal-500')} />
                <span className={boosted ? 'text-teal-500' : ''}>{boosted ? 'Yeniden paylaşımı geri al' : 'Yeniden paylaş'}</span>
              </DropdownMenuItem>
              <DropdownMenuItem onSelect={() => setQuoteModalOpen(true)}>
                <Quote className="w-4 h-4" /> Alıntıla
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>

          {/* Like */}
          <button
            onClick={toggleLike}
            className={cn(
              'flex items-center justify-center p-3 rounded-full transition-colors',
              liked ? 'text-(--color-coral) bg-(--color-coral)/8' : 'text-(--color-text-tertiary) hover:text-(--color-coral) hover:bg-(--color-coral)/8',
            )}
          >
            <Heart className={cn('w-5 h-5 transition-transform', liked && 'fill-current scale-110')} />
          </button>

          {/* Bookmark */}
          <button
            onClick={toggleBookmark}
            className={cn(
              'flex items-center justify-center p-3 rounded-full transition-colors',
              bookmarked ? 'text-(--color-coral) bg-(--color-coral)/8' : 'text-(--color-text-tertiary) hover:text-(--color-coral) hover:bg-(--color-coral)/8',
            )}
          >
            <Bookmark className={cn('w-5 h-5', bookmarked && 'fill-current')} />
          </button>

          {/* Translate */}
          {post.content?.trim() && (
            <button
              onClick={() => void toggleTranslate()}
              className={cn(
                'flex items-center justify-center p-3 rounded-full transition-colors',
                translation ? 'text-(--color-coral) bg-(--color-coral)/8' : 'text-(--color-text-tertiary) hover:text-(--color-coral) hover:bg-(--color-coral)/8',
              )}
            >
              {translating ? <Loader2 className="w-5 h-5 animate-spin" /> : <Languages className="w-5 h-5" />}
            </button>
          )}
        </div>
      </article>

      {/* Delete confirmation */}
      <AlertDialog open={deleteConfirm} onOpenChange={setDeleteConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Gönderiyi sil</AlertDialogTitle>
            <AlertDialogDescription>Bu gönderi kalıcı olarak silinecek. Bu işlem geri alınamaz.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Vazgeç</AlertDialogCancel>
            <AlertDialogAction onClick={() => onDelete(post.id)}>Sil</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Quote modal */}
      <Dialog open={quoteModalOpen} onOpenChange={setQuoteModalOpen}>
        <DialogContent className="w-full max-w-xl rounded-2xl p-0 gap-0 max-h-[85vh] overflow-y-auto" showClose={false}>
          <DialogHeader className="sticky top-0 z-10 bg-(--color-background)/90 backdrop-blur-xl">
            <DialogTitle>Alıntıla</DialogTitle>
            <DialogClose className="p-1.5 -mr-1 rounded-full text-(--color-text-tertiary) hover:text-(--color-text-primary) hover:bg-(--color-background-secondary) transition-colors focus:outline-none">
              <X className="w-4 h-4" />
            </DialogClose>
          </DialogHeader>
          <PostComposer
            handle={handle || ''}
            displayName={displayName}
            avatarUrl={avatarUrl}
            quotedPost={{
              id: post.id,
              content: post.content,
              createdAt: post.createdAt,
              author: post.author ?? null,
              media: post.media ?? [],
            } as QuotedPost}
            onPost={() => { onQuotePosted(); setQuoteModalOpen(false) }}
          />
        </DialogContent>
      </Dialog>

      {/* Likers modal */}
      <Dialog open={likersOpen} onOpenChange={setLikersOpen}>
        <DialogContent className="w-full max-w-md rounded-2xl p-0 gap-0 max-h-[75vh] flex flex-col" showClose={false}>
          <DialogHeader>
            <DialogTitle>Beğenenler</DialogTitle>
            <DialogClose className="p-1.5 -mr-1 rounded-full text-(--color-text-tertiary) hover:text-(--color-text-primary) hover:bg-(--color-background-secondary) transition-colors focus:outline-none">
              <X className="w-4 h-4" />
            </DialogClose>
          </DialogHeader>
          <div className="flex-1 min-h-0 overflow-y-auto">
            {likersLoading ? (
              <div className="flex justify-center py-12">
                <Loader2 className="w-5 h-5 animate-spin text-(--color-coral)" />
              </div>
            ) : (likersList?.length ?? 0) === 0 ? (
              <div className="py-12 text-center">
                <p className="text-sm text-(--color-text-tertiary)">Henüz beğeni yok.</p>
              </div>
            ) : (
              <>
                {likersList?.map((a) => (
                  <LikerRow key={a.id} actor={a} currentHandle={handle ?? ''} onNavigate={() => setLikersOpen(false)} />
                ))}
                {likersCursor && (
                  <button
                    onClick={() => void loadMoreLikers()}
                    disabled={likersLoadingMore}
                    className="w-full py-3 text-sm text-(--color-coral) hover:bg-(--color-background-secondary) transition-colors disabled:opacity-50"
                  >
                    {likersLoadingMore ? <Loader2 className="w-4 h-4 animate-spin mx-auto" /> : 'Daha fazla göster'}
                  </button>
                )}
              </>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </>
  )
}

// ── Page ───────────────────────────────────────────────────────────────────────
export default function ThreadPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  const router = useRouter()
  const { data: session } = useSession()
  const handle = (session?.user as { handle?: string } | undefined)?.handle ?? ''
  const displayName = session?.user.name ?? handle
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null)

  const [ctx, setCtx] = useState<ThreadContext | null>(null)
  const [loading, setLoading] = useState(true)
  const [replies, setReplies] = useState<Post[]>([])
  const [nextCursor, setNextCursor] = useState<string | null>(null)
  const [loadingMore, setLoadingMore] = useState(false)
  const [replyOpen, setReplyOpen] = useState(false)

  const load = useCallback(async () => {
    try {
      const data = await api.posts.context(id)
      setCtx(data)
      setReplies(data.replies)
      setNextCursor(data.nextCursor)
    } catch {
    } finally {
      setLoading(false)
    }
  }, [id])

  useEffect(() => { void load() }, [load])

  useEffect(() => {
    if (handle) {
      api.actors.get(handle).then(a => setAvatarUrl(a.avatarUrl)).catch(() => {})
    }
  }, [handle])

  // Scroll progress (window scrolls in this layout)
  const [progress, setProgress] = useState(0)
  useEffect(() => {
    const onScroll = () => {
      const el = document.documentElement
      const max = el.scrollHeight - el.clientHeight
      setProgress(max > 0 ? Math.min(1, el.scrollTop / max) : 0)
    }
    window.addEventListener('scroll', onScroll, { passive: true })
    onScroll()
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  async function loadMore() {
    if (!nextCursor) return
    setLoadingMore(true)
    try {
      const data = await api.posts.context(id, nextCursor)
      setReplies(prev => [...prev, ...data.replies])
      setNextCursor(data.nextCursor)
    } catch {
    } finally {
      setLoadingMore(false)
    }
  }

  function handleNewReply(newPost: Post) {
    setReplies(prev => [newPost, ...prev])
    setReplyOpen(false)
    if (ctx) setCtx({ ...ctx, post: { ...ctx.post, repliesCount: ctx.post.repliesCount + 1 } })
  }

  function handleNewQuote() {
    if (ctx) setCtx({ ...ctx, post: { ...ctx.post, quotesCount: (ctx.post.quotesCount ?? 0) + 1 } })
  }

  function handleDeleteReply(postId: string) {
    api.posts.delete(postId).then(() => {
      setReplies(prev => prev.filter(p => p.id !== postId))
      if (ctx) setCtx({ ...ctx, post: { ...ctx.post, repliesCount: Math.max(0, ctx.post.repliesCount - 1) } })
    }).catch(() => {})
  }

  function handleDeleteFocused(postId: string) {
    api.posts.delete(postId).then(() => router.back()).catch(() => {})
  }

  const replyTree = buildReplyTree(replies, id)

  // Estimated reading time for the whole conversation (~200 wpm); only shown when substantial
  const threadWords = ctx ? countWords([ctx.post.content, ...ctx.ancestors.map(a => a.content), ...replies.map(r => r.content)]) : 0
  const readMins = Math.ceil(threadWords / 200)
  const showReadTime = threadWords >= 200

  return (
    <TooltipProvider>
      <div className="max-w-xl mx-auto" data-thread-view>

        {/* Sticky header */}
        <header className="sticky top-0 z-20 bg-(--color-background)/80 backdrop-blur-xl border-b border-(--color-border-secondary) px-4 h-14 flex items-center gap-3">
          <button
            onClick={() => router.back()}
            className="p-2 -ml-2 rounded-full hover:bg-(--color-background-secondary) transition-colors text-(--color-text-secondary)"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <h1
            className="font-semibold text-[15px] text-(--color-text-primary)"
            style={{ fontFamily: 'var(--font-display)' }}
          >
            Gönderi
          </h1>
          {showReadTime && (
            <span className="ml-auto flex items-center gap-1 text-xs text-(--color-text-tertiary)">
              <Clock className="w-3.5 h-3.5" />
              ≈ {readMins} dk
            </span>
          )}
          {/* Scroll progress */}
          <div className="absolute left-0 bottom-0 h-0.5 bg-(--color-coral) transition-[width] duration-100" style={{ width: `${progress * 100}%` }} />
        </header>

        {loading ? (
          <TimelineSkeleton count={3} />
        ) : !ctx ? (
          <NotFoundContent />
        ) : (
          <div data-thread-surface>
            {/* Ancestor posts — continuous thread connector runs through each avatar */}
            {ctx.ancestors.map((ancestor) => (
              <PostCard key={ancestor.id} post={ancestor} currentActorHandle={handle} hideActions threadLine />
            ))}

            {/* Focused post */}
            <FocusedPost
              post={ctx.post}
              handle={handle || undefined}
              displayName={displayName}
              avatarUrl={avatarUrl}
              hasAncestors={ctx.ancestors.length > 0}
              onReplyClick={() => setReplyOpen(v => !v)}
              onQuotePosted={handleNewQuote}
              onDelete={handleDeleteFocused}
            />

            {/* Inline reply composer */}
            {replyOpen && handle && (
              <div className="border-t border-(--color-border-secondary)">
                <PostComposer
                  handle={handle}
                  displayName={displayName}
                  avatarUrl={avatarUrl}
                  replyToId={id}
                  onPost={handleNewReply}
                />
              </div>
            )}

            {/* Replies */}
            <div className="border-t border-(--color-border-secondary)">
              {replyTree.length === 0 ? (
                <div className="py-16 flex flex-col items-center gap-1.5 text-center px-6">
                  <p className="text-sm font-semibold text-(--color-text-primary)" style={{ fontFamily: 'var(--font-outfit)' }}>
                    Henüz yanıt yok
                  </p>
                  <p className="text-xs text-(--color-text-tertiary)">İlk yanıtı sen yaz.</p>
                </div>
              ) : (
                <>
                  <ReplyBranch nodes={replyTree} depth={0} handle={handle || undefined} onDelete={handleDeleteReply} />
                  {nextCursor && (
                    <div className="py-4 flex justify-center border-t border-(--color-border-secondary)">
                      <button
                        onClick={loadMore}
                        disabled={loadingMore}
                        className="text-sm text-(--color-coral) hover:underline underline-offset-2 disabled:opacity-50 flex items-center gap-1.5 transition-opacity"
                      >
                        {loadingMore ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Daha fazla yanıt yükle'}
                      </button>
                    </div>
                  )}
                </>
              )}
            </div>
          </div>
        )}
      </div>
    </TooltipProvider>
  )
}
