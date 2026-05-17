'use client'

import { useState, useReducer, useEffect, useRef, memo, Fragment } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Heart, Repeat2, MessageCircle, Bookmark, MoreHorizontal, Pencil, Trash2, Check, X, Eye, Users, Lock, CornerDownRight, Feather, BarChart2, Pin, PinOff, Loader2, Languages, UserCheck, Flag, Globe, Link2, Code2, FolderPlus, Plus } from 'lucide-react'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { api, type Post, type Poll, type Actor, type PostCollection, proxyMediaUrl } from '@/lib/api'
import type { FilterResult } from '@/lib/keyword-filters'
import { ReportModal } from '@/components/report-modal'
import { CodeBlock } from '@/components/ui/code-block'
import { useUserPrefs } from '@/lib/user-prefs-context'
import { MediaLightbox } from '@/components/ui/media-lightbox'
import { toast } from 'sonner'

interface PostCardProps {
  post: Post
  onDelete?: (id: string) => void
  onReply?: (newPost: Post) => void
  onEdit?: (updated: Post) => void
  currentActorHandle?: string
  filterResult?: FilterResult
  pinned?: boolean
  onPinChange?: (postId: string, pinned: boolean) => void
  hideActions?: boolean
  detail?: boolean
}

const RICH_TOKEN = /(#[a-zA-ZğüşıöçĞÜŞİÖÇ0-9_]+|@[a-zA-Z0-9._-]+)/g

// Mini profile popup shown on @mention hover
const actorCache = new Map<string, Actor>()

function MentionLink({ handle, children }: { handle: string; children: React.ReactNode }) {
  const [actor, setActor] = useState<Actor | null>(() => actorCache.get(handle) ?? null)
  const [open, setOpen] = useState(false)
  const [following, setFollowing] = useState(false)
  const [followPending, setFollowPending] = useState(false)
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  function handleMouseEnter() {
    timerRef.current = setTimeout(() => {
      setOpen(true)
      if (!actorCache.has(handle)) {
        api.actors.get(handle).then((a) => {
          actorCache.set(handle, a)
          setActor(a)
          setFollowing(a.viewer?.followStatus === 'accepted')
        }).catch(() => {})
      } else {
        setFollowing(actor?.viewer?.followStatus === 'accepted' ? true : false)
      }
    }, 350)
  }

  function handleMouseLeave() {
    if (timerRef.current) clearTimeout(timerRef.current)
    setOpen(false)
  }

  async function toggleFollow(e: React.MouseEvent) {
    e.preventDefault()
    e.stopPropagation()
    setFollowPending(true)
    try {
      if (following) {
        await api.actors.unfollow(handle)
        setFollowing(false)
      } else {
        await api.actors.follow(handle)
        setFollowing(true)
      }
    } catch {
    } finally {
      setFollowPending(false)
    }
  }

  return (
    <span className="relative inline-block" onMouseEnter={handleMouseEnter} onMouseLeave={handleMouseLeave}>
      <Link href={`/${handle}`} className="text-(--color-coral) hover:underline" onClick={(e) => e.stopPropagation()}>
        {children}
      </Link>
      {open && (
        <div
          className="absolute left-0 bottom-full mb-1.5 z-50 w-64 rounded-2xl border border-(--color-border) bg-(--color-background) shadow-2xl shadow-black/15 overflow-hidden"
          onMouseEnter={() => { if (timerRef.current) clearTimeout(timerRef.current); setOpen(true) }}
          onMouseLeave={handleMouseLeave}
        >
          {!actor ? (
            <div className="flex justify-center py-6"><Loader2 className="w-4 h-4 animate-spin text-(--color-coral)" /></div>
          ) : (
            <>
              {actor.headerUrl && (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={actor.headerUrl} alt="" className="w-full h-14 object-cover" />
              )}
              <div className="px-3 pt-2 pb-3">
                <div className="flex items-start justify-between gap-2 mb-2">
                  <Link href={`/${actor.handle}`} onClick={(e) => e.stopPropagation()}>
                    <Avatar className="w-10 h-10 border-2 border-(--color-background)">
                      {actor.avatarUrl
                        ? <AvatarImage src={proxyMediaUrl(actor.avatarUrl) ?? actor.avatarUrl} alt={actor.displayName ?? actor.handle} />
                        : <AvatarFallback className="text-xs text-white font-bold" style={{ background: 'var(--gradient-avatar)' }}>
                            {(actor.displayName ?? actor.handle).slice(0, 1).toUpperCase()}
                          </AvatarFallback>
                      }
                    </Avatar>
                  </Link>
                  <button
                    onClick={toggleFollow}
                    disabled={followPending}
                    className={cn(
                      'text-xs px-3 py-1.5 rounded-full font-semibold transition-colors',
                      following
                        ? 'bg-(--color-background-secondary) text-(--color-text-secondary) hover:bg-red-50 hover:text-red-500 dark:hover:bg-red-900/20'
                        : 'bg-(--color-coral) text-white hover:bg-(--color-coral-hover)',
                    )}
                  >
                    {followPending ? <Loader2 className="w-3 h-3 animate-spin" /> : following ? 'Takip ediliyor' : 'Takip et'}
                  </button>
                </div>
                <Link href={`/${actor.handle}`} onClick={(e) => e.stopPropagation()}>
                  <p className="text-sm font-semibold text-(--color-text-primary) leading-tight">{actor.displayName ?? actor.handle}</p>
                  <p className="text-xs text-(--color-text-tertiary)">@{actor.handle}</p>
                </Link>
                {actor.bio && (
                  <p className="text-xs text-(--color-text-secondary) mt-1.5 line-clamp-2 leading-relaxed">{actor.bio}</p>
                )}
                <div className="flex items-center gap-3 mt-2 text-[11px] text-(--color-text-tertiary)">
                  <span><span className="font-semibold text-(--color-text-primary)">{actor.followersCount}</span> takipçi</span>
                  <span><span className="font-semibold text-(--color-text-primary)">{actor.followingCount}</span> takip</span>
                </div>
              </div>
            </>
          )}
        </div>
      )}
    </span>
  )
}
const CODE_BLOCK_RE = /```(\w*)\n?([\s\S]*?)```/g
const INLINE_CODE_RE = /`([^`\n]+)`/g

function renderInlineText(text: string, keyPrefix: string) {
  // Split by inline code first
  const inlineParts = text.split(INLINE_CODE_RE)
  return inlineParts.map((part, ii) => {
    if (ii % 2 === 1) {
      // odd indices are the captured inline code contents
      return (
        <code
          key={`${keyPrefix}-ic-${ii}`}
          className="px-1 py-0.5 rounded text-[0.8em] font-mono bg-(--color-background-secondary) border border-(--color-border-secondary) text-(--color-text-primary)"
        >
          {part}
        </code>
      )
    }
    // Apply hashtag / mention tokenisation on plain text
    const richParts = part.split(RICH_TOKEN)
    return richParts.map((rp, ri) => {
      if (rp.startsWith('#')) {
        const tag = rp.slice(1).toLowerCase()
        return (
          <Link key={`${keyPrefix}-r-${ii}-${ri}`} href={`/hashtag/${tag}`} className="text-(--color-coral) hover:underline" onClick={(e) => e.stopPropagation()}>
            {rp}
          </Link>
        )
      }
      if (rp.startsWith('@')) {
        return (
          <MentionLink key={`${keyPrefix}-r-${ii}-${ri}`} handle={rp.slice(1)}>
            {rp}
          </MentionLink>
        )
      }
      return <Fragment key={`${keyPrefix}-r-${ii}-${ri}`}>{rp}</Fragment>
    })
  })
}

function renderRichContent(content: string) {
  // Split on fenced code blocks first, then process text segments
  const segments: { type: 'text' | 'code'; content: string; lang?: string }[] = []
  let lastIndex = 0
  CODE_BLOCK_RE.lastIndex = 0
  let match
  while ((match = CODE_BLOCK_RE.exec(content)) !== null) {
    if (match.index > lastIndex) {
      segments.push({ type: 'text', content: content.slice(lastIndex, match.index) })
    }
    segments.push({ type: 'code', content: match[2]!, lang: match[1] || undefined })
    lastIndex = match.index + match[0].length
  }
  if (lastIndex < content.length) segments.push({ type: 'text', content: content.slice(lastIndex) })
  if (segments.length === 0) segments.push({ type: 'text', content })

  return segments.map((seg, si) => {
    if (seg.type === 'code') {
      return <CodeBlock key={`cb-${si}`} code={seg.content.replace(/\n$/, '')} lang={seg.lang} />
    }
    return <Fragment key={`t-${si}`}>{renderInlineText(seg.content, `t-${si}`)}</Fragment>
  })
}

function formatRelativeTime(dateStr: string) {
  const diff = Date.now() - new Date(dateStr).getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 1) return 'şimdi'
  if (mins < 60) return `${mins}d`
  const hours = Math.floor(mins / 60)
  if (hours < 24) return `${hours}s`
  const days = Math.floor(hours / 24)
  if (days < 7) return `${days}g`
  return new Date(dateStr).toLocaleDateString('tr-TR', { day: 'numeric', month: 'short' })
}

function detectPlatformFromUrl(url: string): string | null {
  try {
    const host = new URL(url).hostname.replace(/^www\./, '')
    if (host === 'open.spotify.com' || host === 'spotify.com') return 'spotify'
    if (host === 'music.youtube.com') return 'ytmusic'
    if (host === 'youtube.com' || host === 'youtu.be') return 'youtube'
    if (host === 'music.apple.com') return 'applemusic'
    if (host === 'deezer.com') return 'deezer'
    if (host === 'soundcloud.com') return 'soundcloud'
    if (host === 'tidal.com' || host === 'listen.tidal.com') return 'tidal'
  } catch {}
  return null
}

const PLATFORM_META: Record<string, { label: string; color: string; textColor: string }> = {
  spotify:    { label: 'Spotify',      color: '#1DB954', textColor: '#fff' },
  youtube:    { label: 'YouTube',      color: '#FF0000', textColor: '#fff' },
  ytmusic:    { label: 'YT Music',     color: '#FF0000', textColor: '#fff' },
  applemusic: { label: 'Apple Music',  color: '#FC3C44', textColor: '#fff' },
  deezer:     { label: 'Deezer',       color: '#A238FF', textColor: '#fff' },
  soundcloud: { label: 'SoundCloud',   color: '#FF5500', textColor: '#fff' },
  tidal:      { label: 'Tidal',        color: '#000000', textColor: '#fff' },
}

function MusicCard({ preview }: { preview: NonNullable<Post['linkPreview']> }) {
  const [expanded, setExpanded] = useState(false)
  const platform = PLATFORM_META[preview.musicPlatform ?? '']

  return (
    <div
      className="mt-2.5 rounded-xl border border-(--color-border) overflow-hidden"
      onClick={(e) => e.stopPropagation()}
    >
      {/* Rich card header */}
      <div className="flex gap-3 p-3">
        {preview.image && (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={preview.image}
            alt=""
            className="w-14 h-14 rounded-lg object-cover flex-shrink-0 bg-(--color-background-secondary)"
            loading="lazy"
          />
        )}
        <div className="flex-1 min-w-0 flex flex-col justify-center gap-0.5">
          {platform && (
            <span
              className="self-start text-[10px] font-bold px-1.5 py-0.5 rounded-full mb-0.5"
              style={{ background: platform.color, color: platform.textColor }}
            >
              {platform.label}
            </span>
          )}
          {(preview.musicTrack ?? preview.title) && (
            <p className="text-sm font-semibold text-(--color-text-primary) truncate">
              {preview.musicTrack ?? preview.title}
            </p>
          )}
          {preview.musicArtist && (
            <p className="text-xs text-(--color-text-secondary) truncate">{preview.musicArtist}</p>
          )}
          {preview.musicType && (
            <p className="text-[11px] text-(--color-text-tertiary) capitalize">{preview.musicType === 'track' ? 'Parça' : preview.musicType === 'album' ? 'Albüm' : 'Playlist'}</p>
          )}
        </div>
        <div className="flex flex-col items-end justify-between gap-2 flex-shrink-0">
          <a
            href={preview.url}
            target="_blank"
            rel="noopener noreferrer"
            className="text-[11px] font-medium text-(--color-coral) hover:underline whitespace-nowrap"
          >
            Dinle →
          </a>
          {preview.musicEmbedUrl && (
            <button
              onClick={() => setExpanded((v: boolean) => !v)}
              className="text-[11px] text-(--color-text-tertiary) hover:text-(--color-text-primary) transition-colors"
            >
              {expanded ? 'Kapat' : 'Oynat'}
            </button>
          )}
        </div>
      </div>

      {/* Embed iframe */}
      {expanded && preview.musicEmbedUrl && (
        <div className="border-t border-(--color-border)">
          <iframe
            src={preview.musicEmbedUrl}
            width="100%"
            height={preview.musicPlatform === 'soundcloud' ? 120 : preview.musicPlatform === 'youtube' || preview.musicPlatform === 'ytmusic' ? 200 : 80}
            allow="autoplay; clipboard-write; encrypted-media; fullscreen; picture-in-picture"
            loading="lazy"
            className="block"
            style={{ border: 'none' }}
          />
        </div>
      )}
    </div>
  )
}

type EditHistoryEntry = { id: string; content: string; contentWarning: string | null; editedAt: string }

type PostCardState = {
  warnDismissed: boolean
  nsfwRevealed: boolean
  liked: boolean
  boosted: boolean
  bookmarked: boolean
  likesCount: number
  boostsCount: number
  repliesCount: number
  quotesCount: number
  reactions: Record<string, number>
  myReactions: Set<string>
  replyOpen: boolean
  replyContent: string
  replySubmitting: boolean
  quoteOpen: boolean
  quoteContent: string
  quoteSubmitting: boolean
  quotesModalOpen: boolean
  quotesList: Post[] | null
  quotesLoading: boolean
  boostMenuOpen: boolean
  menuOpen: boolean
  reportOpen: boolean
  editOpen: boolean
  editContent: string
  editVisibility: Post['visibility']
  editSaving: boolean
  editHistoryOpen: boolean
  editHistory: EditHistoryEntry[] | null
  editHistoryLoading: boolean
  currentContent: string
  editedAt: string | null
  cwExpanded: boolean
  poll: Poll | null
  voting: boolean
  emojiPickerOpen: boolean
  secondaryMenuOpen: boolean
  translation: { text: string; from: string } | null
  translating: boolean
}

type PostCardAction =
  | { type: 'WARN_DISMISS' }
  | { type: 'NSFW_REVEAL' }
  | { type: 'LIKE_TOGGLE'; liked: boolean; count: number }
  | { type: 'BOOST_TOGGLE'; boosted: boolean; count: number }
  | { type: 'BOOKMARK_SET'; value: boolean }
  | { type: 'REPLIES_SET'; count: number }
  | { type: 'REACTION_SET'; myReactions: Set<string>; reactions: Record<string, number> }
  | { type: 'REPLY_OPEN' }
  | { type: 'REPLY_CLOSE' }
  | { type: 'REPLY_CONTENT'; text: string }
  | { type: 'REPLY_SUBMITTING'; value: boolean }
  | { type: 'REPLY_SUCCESS' }
  | { type: 'QUOTE_OPEN' }
  | { type: 'QUOTE_CLOSE' }
  | { type: 'QUOTE_CONTENT'; text: string }
  | { type: 'QUOTE_SUBMITTING'; value: boolean }
  | { type: 'QUOTE_SUCCESS' }
  | { type: 'QUOTES_MODAL_OPEN' }
  | { type: 'QUOTES_MODAL_CLOSE' }
  | { type: 'QUOTES_LOADING' }
  | { type: 'QUOTES_LOADED'; posts: Post[] }
  | { type: 'BOOST_MENU_TOGGLE' }
  | { type: 'BOOST_MENU_CLOSE' }
  | { type: 'MENU_TOGGLE' }
  | { type: 'MENU_CLOSE' }
  | { type: 'REPORT_OPEN' }
  | { type: 'REPORT_CLOSE' }
  | { type: 'EDIT_OPEN'; content: string; visibility: Post['visibility'] }
  | { type: 'EDIT_CLOSE' }
  | { type: 'EDIT_CONTENT'; text: string }
  | { type: 'EDIT_VISIBILITY'; value: Post['visibility'] }
  | { type: 'EDIT_SAVING'; value: boolean }
  | { type: 'EDIT_SAVED'; content: string; editedAt: string | null; visibility: Post['visibility'] }
  | { type: 'EDIT_HISTORY_OPEN' }
  | { type: 'EDIT_HISTORY_CLOSE' }
  | { type: 'EDIT_HISTORY_LOADING' }
  | { type: 'EDIT_HISTORY_LOADED'; edits: EditHistoryEntry[] }
  | { type: 'CW_TOGGLE' }
  | { type: 'POLL_VOTED'; poll: Poll }
  | { type: 'VOTING'; value: boolean }
  | { type: 'EMOJI_PICKER_TOGGLE' }
  | { type: 'EMOJI_PICKER_CLOSE' }
  | { type: 'SECONDARY_MENU_TOGGLE' }
  | { type: 'SECONDARY_MENU_CLOSE' }
  | { type: 'TRANSLATE_START' }
  | { type: 'TRANSLATE_DONE'; text: string; from: string }
  | { type: 'TRANSLATE_CLOSE' }
  | { type: 'TRANSLATING'; value: boolean }

function postCardReducer(state: PostCardState, action: PostCardAction): PostCardState {
  switch (action.type) {
    case 'WARN_DISMISS':        return { ...state, warnDismissed: true }
    case 'NSFW_REVEAL':         return { ...state, nsfwRevealed: true }
    case 'LIKE_TOGGLE':         return { ...state, liked: action.liked, likesCount: action.count }
    case 'BOOST_TOGGLE':        return { ...state, boosted: action.boosted, boostsCount: action.count }
    case 'BOOKMARK_SET':        return { ...state, bookmarked: action.value }
    case 'REPLIES_SET':         return { ...state, repliesCount: action.count }
    case 'REACTION_SET':        return { ...state, myReactions: action.myReactions, reactions: action.reactions }
    case 'REPLY_OPEN':          return { ...state, replyOpen: true, quoteOpen: false }
    case 'REPLY_CLOSE':         return { ...state, replyOpen: false, replyContent: '' }
    case 'REPLY_CONTENT':       return { ...state, replyContent: action.text }
    case 'REPLY_SUBMITTING':    return { ...state, replySubmitting: action.value }
    case 'REPLY_SUCCESS':       return { ...state, replyOpen: false, replyContent: '', replySubmitting: false, repliesCount: state.repliesCount + 1 }
    case 'QUOTE_OPEN':          return { ...state, quoteOpen: true, replyOpen: false, boostMenuOpen: false }
    case 'QUOTE_CLOSE':         return { ...state, quoteOpen: false, quoteContent: '' }
    case 'QUOTE_CONTENT':       return { ...state, quoteContent: action.text }
    case 'QUOTE_SUBMITTING':    return { ...state, quoteSubmitting: action.value }
    case 'QUOTE_SUCCESS':       return { ...state, quoteOpen: false, quoteContent: '', quoteSubmitting: false, quotesCount: state.quotesCount + 1 }
    case 'QUOTES_MODAL_OPEN':   return { ...state, quotesModalOpen: true }
    case 'QUOTES_MODAL_CLOSE':  return { ...state, quotesModalOpen: false }
    case 'QUOTES_LOADING':      return { ...state, quotesLoading: true }
    case 'QUOTES_LOADED':       return { ...state, quotesList: action.posts, quotesLoading: false }
    case 'BOOST_MENU_TOGGLE':   return { ...state, boostMenuOpen: !state.boostMenuOpen }
    case 'BOOST_MENU_CLOSE':    return { ...state, boostMenuOpen: false }
    case 'MENU_TOGGLE':         return { ...state, menuOpen: !state.menuOpen }
    case 'MENU_CLOSE':          return { ...state, menuOpen: false }
    case 'REPORT_OPEN':         return { ...state, reportOpen: true, menuOpen: false }
    case 'REPORT_CLOSE':        return { ...state, reportOpen: false }
    case 'EDIT_OPEN':           return { ...state, editOpen: true, editContent: action.content, editVisibility: action.visibility, menuOpen: false }
    case 'EDIT_CLOSE':          return { ...state, editOpen: false }
    case 'EDIT_CONTENT':        return { ...state, editContent: action.text }
    case 'EDIT_VISIBILITY':     return { ...state, editVisibility: action.value }
    case 'EDIT_SAVING':         return { ...state, editSaving: action.value }
    case 'EDIT_SAVED':          return { ...state, currentContent: action.content, editedAt: action.editedAt, editVisibility: action.visibility, editOpen: false, editSaving: false }
    case 'EDIT_HISTORY_OPEN':   return { ...state, editHistoryOpen: true }
    case 'EDIT_HISTORY_CLOSE':  return { ...state, editHistoryOpen: false }
    case 'EDIT_HISTORY_LOADING': return { ...state, editHistoryLoading: true }
    case 'EDIT_HISTORY_LOADED': return { ...state, editHistory: action.edits, editHistoryLoading: false }
    case 'CW_TOGGLE':           return { ...state, cwExpanded: !state.cwExpanded }
    case 'POLL_VOTED':          return { ...state, poll: action.poll, voting: false }
    case 'VOTING':              return { ...state, voting: action.value }
    case 'EMOJI_PICKER_TOGGLE':    return { ...state, emojiPickerOpen: !state.emojiPickerOpen, secondaryMenuOpen: !state.emojiPickerOpen ? state.secondaryMenuOpen : false }
    case 'EMOJI_PICKER_CLOSE':     return { ...state, emojiPickerOpen: false }
    case 'SECONDARY_MENU_TOGGLE':  return { ...state, secondaryMenuOpen: !state.secondaryMenuOpen, emojiPickerOpen: false }
    case 'SECONDARY_MENU_CLOSE':   return { ...state, secondaryMenuOpen: false, emojiPickerOpen: false }
    case 'TRANSLATE_START':        return { ...state, translating: true, translation: null }
    case 'TRANSLATE_DONE':      return { ...state, translating: false, translation: { text: action.text, from: action.from } }
    case 'TRANSLATE_CLOSE':     return { ...state, translation: null }
    case 'TRANSLATING':         return { ...state, translating: action.value }
    default: return state
  }
}

function _PostCard({ post, onDelete, onReply, onEdit, currentActorHandle, filterResult, pinned, onPinChange, hideActions, detail }: PostCardProps) {
  const router = useRouter()
  const { nsfwMode } = useUserPrefs()
  const isNsfwBlurred = post.sensitive && nsfwMode === 'blur'

  const [s, dispatch] = useReducer(postCardReducer, post, (p): PostCardState => ({
    warnDismissed: false,
    nsfwRevealed: false,
    liked: p.viewer?.liked ?? false,
    boosted: p.viewer?.boosted ?? false,
    bookmarked: p.viewer?.bookmarked ?? false,
    likesCount: p.likesCount,
    boostsCount: p.boostsCount,
    repliesCount: p.repliesCount,
    quotesCount: p.quotesCount ?? 0,
    reactions: p.reactions ?? {},
    myReactions: new Set(p.viewer?.reactions ?? []),
    replyOpen: false,
    replyContent: '',
    replySubmitting: false,
    quoteOpen: false,
    quoteContent: '',
    quoteSubmitting: false,
    quotesModalOpen: false,
    quotesList: null,
    quotesLoading: false,
    boostMenuOpen: false,
    menuOpen: false,
    reportOpen: false,
    editOpen: false,
    editContent: p.content,
    editVisibility: p.visibility,
    editSaving: false,
    editHistoryOpen: false,
    editHistory: null,
    editHistoryLoading: false,
    currentContent: p.content,
    editedAt: p.editedAt ?? null,
    cwExpanded: !p.contentWarning,
    poll: p.poll ?? null,
    voting: false,
    emojiPickerOpen: false,
    secondaryMenuOpen: false,
    translation: null,
    translating: false,
  }))

  const {
    warnDismissed, nsfwRevealed,
    liked, boosted, bookmarked,
    likesCount, boostsCount, repliesCount, quotesCount,
    reactions, myReactions,
    replyOpen, replyContent, replySubmitting,
    quoteOpen, quoteContent, quoteSubmitting,
    quotesModalOpen, quotesList, quotesLoading,
    boostMenuOpen, menuOpen, reportOpen,
    editOpen, editContent, editVisibility, editSaving,
    editHistoryOpen, editHistory, editHistoryLoading,
    currentContent, editedAt,
    cwExpanded, poll, voting, emojiPickerOpen, secondaryMenuOpen,
    translation, translating,
  } = s

  const [lightbox, setLightbox] = useState<{ index: number } | null>(null)
  const [embedOpen, setEmbedOpen] = useState(false)
  const [altOpen, setAltOpen] = useState<string | null>(null)
  const [collectionModalOpen, setCollectionModalOpen] = useState(false)
  const [collections, setCollections] = useState<PostCollection[]>([])
  const [collectionsLoading, setCollectionsLoading] = useState(false)
  const [addingToCollection, setAddingToCollection] = useState<string | null>(null)

  // Sync repliesCount when parent prop changes (e.g. after reply deleted from post detail)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { dispatch({ type: 'REPLIES_SET', count: post.repliesCount }) }, [post.repliesCount])

  if (filterResult === 'hide') return null
  if (filterResult === 'warn' && !warnDismissed) {
    return (
      <article className="px-4 py-3 border-b border-(--color-border-secondary)">
        <button
          onClick={() => dispatch({ type: 'WARN_DISMISS' })}
          className="w-full text-left text-sm text-(--color-text-tertiary) hover:text-(--color-text-secondary) transition-colors flex items-center gap-2"
        >
          <span className="text-base">⚠️</span>
          <span>İçerik filtresiyle eşleşti — görmek için tıkla</span>
        </button>
      </article>
    )
  }

  const handle = post.author?.handle ?? 'unknown'
  const displayName = post.author?.displayName ?? handle
  const initials = displayName.slice(0, 2).toUpperCase()
  const isOwn = currentActorHandle === handle

  async function toggleLike() {
    const prev = { liked, likesCount, myReactions, reactions }
    try {
      if (liked) {
        dispatch({ type: 'LIKE_TOGGLE', liked: false, count: Math.max(likesCount - 1, 0) })
        await api.posts.unlike(post.id)
      } else {
        // Adding like clears any emoji reactions (mutually exclusive)
        if (myReactions.size > 0) {
          const prevEmoji = [...myReactions][0]!
          const newReactions = { ...reactions }
          newReactions[prevEmoji] = Math.max((newReactions[prevEmoji] ?? 1) - 1, 0)
          if (newReactions[prevEmoji] === 0) delete newReactions[prevEmoji]
          dispatch({ type: 'REACTION_SET', myReactions: new Set(), reactions: newReactions })
          await api.posts.unreact(post.id, prevEmoji).catch(() => {})
        }
        dispatch({ type: 'LIKE_TOGGLE', liked: true, count: likesCount + 1 })
        await api.posts.like(post.id)
      }
    } catch (err) {
      if ((err as { status?: number }).status === 409) { dispatch({ type: 'LIKE_TOGGLE', liked: true, count: likesCount }); return }
      dispatch({ type: 'LIKE_TOGGLE', liked: prev.liked, count: prev.likesCount })
      dispatch({ type: 'REACTION_SET', myReactions: prev.myReactions, reactions: prev.reactions })
      toast.error('Beğeni kaydedilemedi.')
    }
  }

  async function toggleBoost() {
    const prev = { boosted, boostsCount }
    try {
      if (boosted) {
        dispatch({ type: 'BOOST_TOGGLE', boosted: false, count: Math.max(boostsCount - 1, 0) })
        await api.posts.unboost(post.id)
      } else {
        dispatch({ type: 'BOOST_TOGGLE', boosted: true, count: boostsCount + 1 })
        await api.posts.boost(post.id)
      }
    } catch (err) {
      const status = (err as { status?: number }).status
      if (status === 409) {
        // Already boosted in DB but viewer state was stale — keep UI as boosted
        dispatch({ type: 'BOOST_TOGGLE', boosted: true, count: boostsCount })
        return
      }
      dispatch({ type: 'BOOST_TOGGLE', boosted: prev.boosted, count: prev.boostsCount })
      toast.error('Yeniden paylaşım kaydedilemedi.')
    }
  }

  async function toggleBookmark() {
    const prev = bookmarked
    try {
      if (bookmarked) {
        dispatch({ type: 'BOOKMARK_SET', value: false })
        await api.posts.unbookmark(post.id)
      } else {
        dispatch({ type: 'BOOKMARK_SET', value: true })
        await api.posts.bookmark(post.id)
      }
    } catch {
      dispatch({ type: 'BOOKMARK_SET', value: prev })
      toast.error('Kayıt işlemi başarısız.')
    }
  }

  async function submitReply() {
    const text = replyContent.trim()
    if (!text) return
    dispatch({ type: 'REPLY_SUBMITTING', value: true })
    try {
      const newPost = await api.posts.create({ content: text, replyToId: post.id })
      dispatch({ type: 'REPLY_SUCCESS' })
      onReply?.(newPost)
    } catch {
      toast.error('Yanıt gönderilemedi. Tekrar dene.')
    } finally {
      dispatch({ type: 'REPLY_SUBMITTING', value: false })
    }
  }

  async function submitQuote() {
    if (quoteSubmitting) return
    dispatch({ type: 'QUOTE_SUBMITTING', value: true })
    try {
      await api.posts.create({ content: quoteContent.trim(), quotedPostId: post.id })
      dispatch({ type: 'QUOTE_SUCCESS' })
    } catch {
      toast.error('Alıntı gönderilemedi. Tekrar dene.')
    } finally {
      dispatch({ type: 'QUOTE_SUBMITTING', value: false })
    }
  }

  const longPressTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const pressStartTime = useRef<number>(0)
  const LONG_PRESS_MS = 450
  const [heartHolding, setHeartHolding] = useState(false)

  function cancelLongPress() {
    setHeartHolding(false)
    if (longPressTimer.current) { clearTimeout(longPressTimer.current); longPressTimer.current = null }
  }

  function handleHeartPointerDown(e: React.PointerEvent) {
    if (e.pointerType === 'mouse' && e.button !== 0) return
    pressStartTime.current = Date.now()
    setHeartHolding(true)
    longPressTimer.current = setTimeout(() => {
      setHeartHolding(false)
      dispatch({ type: 'EMOJI_PICKER_TOGGLE' })
    }, LONG_PRESS_MS)
  }

  function handleHeartPointerUp() { cancelLongPress() }
  function handleHeartPointerLeave() { cancelLongPress() }

  function handleHeartClick(e: React.MouseEvent) {
    e.stopPropagation()
    if (Date.now() - pressStartTime.current >= LONG_PRESS_MS) return
    void toggleLike()
  }

  async function toggleReaction(emoji: string) {
    dispatch({ type: 'EMOJI_PICKER_CLOSE' })
    const had = myReactions.has(emoji)
    const prev1Reaction = had ? null : ([...myReactions][0] ?? null)

    // Adding emoji reaction clears like (mutually exclusive)
    if (!had && liked) {
      dispatch({ type: 'LIKE_TOGGLE', liked: false, count: Math.max(likesCount - 1, 0) })
      await api.posts.unlike(post.id).catch(() => {})
    }

    // Optimistic: single-reaction model — at most one active emoji at a time
    const newMyReactions = had ? new Set<string>() : new Set([emoji])
    const newReactions = { ...reactions }
    if (prev1Reaction) {
      newReactions[prev1Reaction] = Math.max((newReactions[prev1Reaction] ?? 1) - 1, 0)
      if (newReactions[prev1Reaction] === 0) delete newReactions[prev1Reaction]
    }
    if (had) {
      newReactions[emoji] = Math.max((newReactions[emoji] ?? 1) - 1, 0)
      if (newReactions[emoji] === 0) delete newReactions[emoji]
    } else {
      newReactions[emoji] = (newReactions[emoji] ?? 0) + 1
    }
    dispatch({ type: 'REACTION_SET', myReactions: newMyReactions, reactions: newReactions })

    try {
      if (prev1Reaction) await api.posts.unreact(post.id, prev1Reaction)
      if (had) await api.posts.unreact(post.id, emoji)
      else await api.posts.react(post.id, emoji)
    } catch {
      // revert to server state
      dispatch({ type: 'REACTION_SET', myReactions: new Set(post.viewer?.reactions ?? []), reactions: post.reactions ?? {} })
    }
  }

  async function votePoll(optionId: string) {
    if (!poll || poll.expired || poll.voted || voting) return
    dispatch({ type: 'VOTING', value: true })
    try {
      const updated = await api.polls.vote(poll.id, [optionId])
      dispatch({ type: 'POLL_VOTED', poll: updated })
    } catch {
      toast.error('Oy gönderilemedi.')
      dispatch({ type: 'VOTING', value: false })
    }
  }

  async function openQuotesModal(e: React.MouseEvent) {
    e.stopPropagation()
    dispatch({ type: 'QUOTES_MODAL_OPEN' })
    if (quotesList) return
    dispatch({ type: 'QUOTES_LOADING' })
    try {
      const data = await api.posts.quotes(post.id)
      dispatch({ type: 'QUOTES_LOADED', posts: data.posts })
    } catch {
      dispatch({ type: 'QUOTES_LOADED', posts: [] })
    }
  }

  async function openEditHistory(e: React.MouseEvent) {
    e.stopPropagation()
    dispatch({ type: 'EDIT_HISTORY_OPEN' })
    if (editHistory) return
    dispatch({ type: 'EDIT_HISTORY_LOADING' })
    try {
      const data = await api.posts.edits(post.id)
      dispatch({ type: 'EDIT_HISTORY_LOADED', edits: data.edits })
    } catch {
      dispatch({ type: 'EDIT_HISTORY_LOADED', edits: [] })
    }
  }

  async function openCollectionModal() {
    dispatch({ type: 'MENU_CLOSE' })
    setCollectionsLoading(true)
    setCollectionModalOpen(true)
    try {
      const data = await api.postCollections.list()
      setCollections(data.collections)
    } catch {
      toast.error('Koleksiyonlar yüklenemedi')
    } finally {
      setCollectionsLoading(false)
    }
  }

  async function addToCollection(collectionId: string) {
    setAddingToCollection(collectionId)
    try {
      await api.postCollections.addPost(collectionId, post.id)
      toast.success('Koleksiyona eklendi')
      setCollectionModalOpen(false)
    } catch {
      toast.error('Eklenemedi')
    } finally {
      setAddingToCollection(null)
    }
  }

  async function togglePin() {
    try {
      if (pinned) {
        await api.posts.unpin(post.id)
        onPinChange?.(post.id, false)
      } else {
        await api.posts.pin(post.id)
        onPinChange?.(post.id, true)
      }
    } catch {
      toast.error('Sabitleme işlemi başarısız.')
    }
  }

  async function toggleTranslate() {
    if (translation) { dispatch({ type: 'TRANSLATE_CLOSE' }); return }
    if (!currentContent.trim()) return
    dispatch({ type: 'TRANSLATE_START' })
    try {
      const result = await api.translate.text(currentContent, 'tr')
      dispatch({ type: 'TRANSLATE_DONE', text: result.translated, from: result.detectedLangName })
    } catch {
      toast.error('Çeviri yapılamadı.')
      dispatch({ type: 'TRANSLATING', value: false })
    }
  }

  async function saveEdit() {
    const text = editContent.trim()
    const visChanged = editVisibility !== post.visibility
    if (!text || (text === currentContent && !visChanged)) { dispatch({ type: 'EDIT_CLOSE' }); return }
    dispatch({ type: 'EDIT_SAVING', value: true })
    try {
      const updated = await api.posts.edit(post.id, text, editVisibility)
      dispatch({ type: 'EDIT_SAVED', content: updated.content, editedAt: updated.editedAt ?? null, visibility: updated.visibility })
      onEdit?.(updated)
    } catch {
      toast.error('Düzenleme kaydedilemedi.')
      dispatch({ type: 'EDIT_SAVING', value: false })
    }
  }

  function handleCardClick(e: React.MouseEvent<HTMLElement>) {
    if ((e.target as HTMLElement).closest('a, button, textarea')) return
    router.push(`/posts/${post.id}`)
  }

  return (
    <Fragment>
    <article
      data-post-card
      data-postcard
      onClick={detail ? undefined : handleCardClick}
      className={cn(
        'group',
        detail
          ? 'px-4 pt-5 pb-3 cursor-default'
          : 'border-b border-(--color-border-secondary) hover:bg-(--color-background-secondary)/60 transition-colors cursor-pointer',
      )}
    >
      {pinned && (
        <div className="flex items-center gap-1.5 px-4 pt-2.5 pb-0 text-xs text-(--color-text-tertiary)">
          <Pin className="w-3 h-3" />
          <span>Sabitlenmiş gönderi</span>
        </div>
      )}
      {post.boostedBy && (
        <div className="flex items-center gap-1.5 px-4 pt-2.5 pb-0 text-xs text-teal-600 dark:text-teal-400">
          <Repeat2 className="w-3 h-3" />
          <Link href={`/${post.boostedBy.handle}`} className="hover:underline font-medium" onClick={(e) => e.stopPropagation()}>
            {post.boostedBy.displayName ?? post.boostedBy.handle}
          </Link>
          <span className="text-(--color-text-tertiary)">yeniden paylaştı</span>
        </div>
      )}
      <div className={cn('flex gap-3', detail ? 'pb-4' : cn('px-4 pb-3.5', post.boostedBy ? 'pt-2' : 'pt-3.5'))}>
        <Link href={`/${handle}`} className="flex-shrink-0" onClick={(e) => e.stopPropagation()}>
          <Avatar className={detail ? 'w-12 h-12' : 'w-10 h-10'}>
            {post.author?.avatarUrl && <AvatarImage src={proxyMediaUrl(post.author.avatarUrl) ?? post.author.avatarUrl} alt={displayName} />}
            <AvatarFallback
              className="text-xs font-medium text-white"
              style={{ background: 'var(--gradient-avatar)' }}
            >
              {initials}
            </AvatarFallback>
          </Avatar>
        </Link>

        <div className="flex-1 min-w-0">
          {!post.boostedBy && post.replyToAuthor && post.replyToId && (
            <Link
              href={`/posts/${post.replyToId}`}
              onClick={(e) => e.stopPropagation()}
              className="flex items-center gap-1 mb-1 text-xs text-(--color-text-tertiary) hover:text-(--color-text-secondary) transition-colors w-fit"
            >
              <CornerDownRight className="w-3 h-3 flex-shrink-0" />
              <span className="font-medium text-(--color-text-secondary)">@{post.replyToAuthor.handle}</span>
              <span>adlı kişiye yanıt</span>
            </Link>
          )}
          <div className={cn('flex items-center gap-1.5', detail ? 'mb-0' : 'mb-0.5')}>
            <Link
              href={`/${handle}`}
              onClick={(e) => e.stopPropagation()}
              className={cn('font-semibold hover:underline truncate', detail ? 'text-base text-(--color-text-primary)' : 'font-medium text-sm text-(--color-text-primary)')}
              style={{ fontFamily: 'var(--font-display)' }}
            >
              {displayName}
            </Link>
            <span className={cn('text-(--color-text-tertiary) truncate', detail ? 'text-sm' : 'text-xs')}>@{handle}</span>
            {post.author && !post.author.isLocal && (
              <span title="Federe kullanıcı" className="flex-shrink-0 text-(--color-teal)">
                <Globe className="w-3 h-3" />
              </span>
            )}
            {!detail && <span className="text-xs text-(--color-text-tertiary)">·</span>}
            {!detail && (
              <Link
                href={`/posts/${post.id}`}
                onClick={(e) => e.stopPropagation()}
                className="text-xs text-(--color-text-tertiary) flex-shrink-0 hover:underline"
              >
                {formatRelativeTime(post.createdAt)}
              </Link>
            )}
            {editedAt && (
              <button
                onClick={openEditHistory}
                className="text-xs text-(--color-text-tertiary) flex-shrink-0 hover:text-(--color-coral) hover:underline transition-colors"
                title={`Düzenlendi: ${new Date(editedAt).toLocaleString('tr-TR')}`}
              >
                · düzenlendi
              </button>
            )}
            {post.visibility !== 'public' && (
              <span className="text-(--color-text-tertiary) flex-shrink-0" title={post.visibility}>
                {post.visibility === 'unlisted' && <Eye className="w-3 h-3" />}
                {post.visibility === 'followers' && <Users className="w-3 h-3" />}
                {post.visibility === 'close_friends' && <span title="Yakın Çevre"><UserCheck className="w-3.5 h-3.5 text-emerald-500" /></span>}
                {post.visibility === 'direct' && <Lock className="w-3 h-3" />}
              </span>
            )}

            {/* Own-post menu */}
            {isOwn && (
              <div className="ml-auto relative" onClick={(e) => e.stopPropagation()}>
                <button
                  onClick={() => dispatch({ type: 'MENU_TOGGLE' })}
                  className="p-1 rounded-full text-(--color-text-tertiary) hover:text-(--color-text-primary) hover:bg-(--color-background-secondary) opacity-0 group-hover:opacity-100 transition-all"
                >
                  <MoreHorizontal className="w-4 h-4" />
                </button>
                {menuOpen && (
                  <>
                    <div className="fixed inset-0 z-10" onClick={() => dispatch({ type: 'MENU_CLOSE' })} />
                    <div className="absolute right-0 top-full mt-1.5 w-44 bg-(--color-background) border border-(--color-border) rounded-2xl shadow-xl shadow-black/10 z-20 overflow-hidden py-1">
                      <button
                        onClick={() => { dispatch({ type: 'MENU_CLOSE' }); void navigator.clipboard.writeText(`${window.location.origin}/posts/${post.id}`).then(() => toast.success('Link kopyalandı')) }}
                        className="w-full flex items-center gap-2 px-3.5 py-2 text-[13px] text-(--color-text-primary) hover:bg-(--color-background-secondary) transition-colors"
                      >
                        <Link2 className="w-3.5 h-3.5 text-(--color-text-tertiary)" /> Linki Kopyala
                      </button>
                      <button
                        onClick={() => { dispatch({ type: 'MENU_CLOSE' }); setEmbedOpen(true) }}
                        className="w-full flex items-center gap-2 px-3.5 py-2 text-[13px] text-(--color-text-primary) hover:bg-(--color-background-secondary) transition-colors"
                      >
                        <Code2 className="w-3.5 h-3.5 text-(--color-text-tertiary)" /> Göm
                      </button>
                      <button
                        onClick={() => void openCollectionModal()}
                        className="w-full flex items-center gap-2 px-3.5 py-2 text-[13px] text-(--color-text-primary) hover:bg-(--color-background-secondary) transition-colors"
                      >
                        <FolderPlus className="w-3.5 h-3.5 text-(--color-text-tertiary)" /> Koleksiyona Ekle
                      </button>
                      <div className="my-1 border-t border-(--color-border-secondary)" />
                      <button
                        onClick={() => dispatch({ type: 'EDIT_OPEN', content: currentContent, visibility: post.visibility })}
                        className="w-full flex items-center gap-2 px-3.5 py-2 text-[13px] text-(--color-text-primary) hover:bg-(--color-background-secondary) transition-colors"
                      >
                        <Pencil className="w-3.5 h-3.5 text-(--color-text-tertiary)" /> Düzenle
                      </button>
                      {onPinChange && (
                        <button
                          onClick={() => { dispatch({ type: 'MENU_CLOSE' }); void togglePin() }}
                          className="w-full flex items-center gap-2 px-3.5 py-2 text-[13px] text-(--color-text-primary) hover:bg-(--color-background-secondary) transition-colors"
                        >
                          {pinned
                            ? <><PinOff className="w-3.5 h-3.5 text-(--color-text-tertiary)" /> Sabitliği Kaldır</>
                            : <><Pin className="w-3.5 h-3.5 text-(--color-text-tertiary)" /> Profilime Sabitle</>}
                        </button>
                      )}
                      {onDelete && (
                        <>
                          <div className="my-1 border-t border-(--color-border-secondary)" />
                          <button
                            onClick={() => { dispatch({ type: 'MENU_CLOSE' }); onDelete(post.id) }}
                            className="w-full flex items-center gap-2 px-3.5 py-2 text-[13px] text-red-500 hover:bg-red-50 dark:hover:bg-red-950/20 transition-colors"
                          >
                            <Trash2 className="w-3.5 h-3.5" /> Sil
                          </button>
                        </>
                      )}
                    </div>
                  </>
                )}
              </div>
            )}

            {/* Non-own post menu — report */}
            {!isOwn && currentActorHandle && (
              <div className="ml-auto relative" onClick={(e) => e.stopPropagation()}>
                <button
                  onClick={() => dispatch({ type: 'MENU_TOGGLE' })}
                  className="p-1 rounded-full text-(--color-text-tertiary) hover:text-(--color-text-primary) hover:bg-(--color-background-secondary) opacity-0 group-hover:opacity-100 transition-all"
                >
                  <MoreHorizontal className="w-4 h-4" />
                </button>
                {menuOpen && (
                  <>
                    <div className="fixed inset-0 z-10" onClick={() => dispatch({ type: 'MENU_CLOSE' })} />
                    <div className="absolute right-0 top-full mt-1.5 w-44 bg-(--color-background) border border-(--color-border) rounded-2xl shadow-xl shadow-black/10 z-20 overflow-hidden py-1">
                      <button
                        onClick={() => { dispatch({ type: 'MENU_CLOSE' }); void navigator.clipboard.writeText(`${window.location.origin}/posts/${post.id}`).then(() => toast.success('Link kopyalandı')) }}
                        className="w-full flex items-center gap-2 px-3.5 py-2 text-[13px] text-(--color-text-primary) hover:bg-(--color-background-secondary) transition-colors"
                      >
                        <Link2 className="w-3.5 h-3.5 text-(--color-text-tertiary)" /> Linki Kopyala
                      </button>
                      <button
                        onClick={() => { dispatch({ type: 'MENU_CLOSE' }); setEmbedOpen(true) }}
                        className="w-full flex items-center gap-2 px-3.5 py-2 text-[13px] text-(--color-text-primary) hover:bg-(--color-background-secondary) transition-colors"
                      >
                        <Code2 className="w-3.5 h-3.5 text-(--color-text-tertiary)" /> Göm
                      </button>
                      <div className="my-1 border-t border-(--color-border-secondary)" />
                      <button
                        onClick={() => dispatch({ type: 'REPORT_OPEN' })}
                        className="w-full flex items-center gap-2 px-3.5 py-2 text-[13px] text-red-500 hover:bg-red-50 dark:hover:bg-red-950/20 transition-colors"
                      >
                        <Flag className="w-3.5 h-3.5" /> Raporla
                      </button>
                    </div>
                  </>
                )}
              </div>
            )}
          </div>

          {post.contentWarning && (
            <button
              onClick={(e) => { e.stopPropagation(); dispatch({ type: 'CW_TOGGLE' }) }}
              className="mb-2 flex items-center gap-1.5 text-xs text-(--color-text-secondary) bg-(--color-background-secondary) border border-(--color-border-secondary) rounded-full px-2.5 py-1 hover:border-(--color-coral)/50 transition-colors"
            >
              <span>⚠</span>
              <span className="font-medium">{post.contentWarning}</span>
              <span className="text-(--color-text-tertiary) ml-1">{cwExpanded ? '(gizle)' : '(göster)'}</span>
            </button>
          )}

          {/* NSFW sensitive label (blur mode) */}
          {isNsfwBlurred && !nsfwRevealed && !post.contentWarning && (
            <button
              onClick={(e) => { e.stopPropagation(); dispatch({ type: 'NSFW_REVEAL' }) }}
              className="mb-2 flex items-center gap-1.5 text-xs text-(--color-text-secondary) bg-amber-500/10 border border-amber-500/20 rounded-full px-2.5 py-1 hover:border-amber-500/50 transition-colors"
            >
              <span>🔞</span>
              <span className="font-medium text-amber-600 dark:text-amber-400">Hassas içerik</span>
              <span className="text-(--color-text-tertiary) ml-1">(göstermek için tıkla)</span>
            </button>
          )}

          {/* Inline editor / content (hidden when CW collapsed) */}
          {cwExpanded && (
            <>
              {editOpen ? (
                <div className="flex flex-col gap-2 mb-2">
                  <textarea
                    value={editContent}
                    onChange={(e) => dispatch({ type: 'EDIT_CONTENT', text: e.target.value })}
                    rows={3}
                    maxLength={500}
                    className="w-full resize-none rounded-lg border border-(--color-coral) bg-(--color-background-primary) px-3 py-2 text-sm text-(--color-text-primary) focus:outline-none transition-colors"
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) void saveEdit()
                      if (e.key === 'Escape') dispatch({ type: 'EDIT_CLOSE' })
                    }}
                    autoFocus
                  />
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <select
                        value={editVisibility}
                        onChange={(e) => dispatch({ type: 'EDIT_VISIBILITY', value: e.target.value as Post['visibility'] })}
                        className="text-xs bg-(--color-background-secondary) border border-(--color-border) rounded-lg px-2 py-1 text-(--color-text-secondary) focus:outline-none focus:border-(--color-coral)/50"
                      >
                        <option value="public">🌍 Herkese açık</option>
                        <option value="unlisted">🔗 Listesiz</option>
                        <option value="followers">👥 Takipçiler</option>
                        <option value="close_friends">⭐ Yakın arkadaşlar</option>
                      </select>
                      <span className="text-xs text-(--color-text-tertiary)">{500 - editContent.length}</span>
                    </div>
                    <div className="flex gap-2">
                      <button onClick={() => dispatch({ type: 'EDIT_CLOSE' })} className="p-1 text-(--color-text-tertiary) hover:text-(--color-text-primary)">
                        <X className="w-4 h-4" />
                      </button>
                      <button
                        onClick={saveEdit}
                        disabled={editSaving || !editContent.trim()}
                        className="flex items-center gap-1 px-2 py-1 rounded-lg bg-(--color-coral) text-white text-xs disabled:opacity-50"
                      >
                        {editSaving ? '...' : <><Check className="w-3.5 h-3.5" /> Kaydet</>}
                      </button>
                    </div>
                  </div>
                </div>
              ) : (
                <div className={cn('relative', isNsfwBlurred && !nsfwRevealed && 'select-none')}>
                  {detail && (
                    <p className="text-xs text-(--color-text-tertiary) mb-3">
                      {new Date(post.createdAt).toLocaleString('tr-TR', { day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
                    </p>
                  )}
                  <div className={cn(detail ? 'text-base' : 'text-sm', 'text-(--color-text-primary) leading-relaxed whitespace-pre-wrap break-words', isNsfwBlurred && !nsfwRevealed && 'blur-sm pointer-events-none')}>
                    {renderRichContent(
                      post.linkPreview
                        ? currentContent.replace(post.linkPreview.url, '').trim()
                        : currentContent
                    )}
                  </div>
                  {isNsfwBlurred && !nsfwRevealed && (
                    <button
                      onClick={(e) => { e.stopPropagation(); dispatch({ type: 'NSFW_REVEAL' }) }}
                      className="absolute inset-0 flex items-center justify-center"
                    >
                      <span className="text-xs font-semibold text-amber-600 dark:text-amber-400 bg-(--color-background)/80 backdrop-blur-sm px-3 py-1.5 rounded-full border border-amber-500/20">
                        Göster
                      </span>
                    </button>
                  )}
                </div>
              )}

              {/* Translation */}
              {translation && (
                <div className="mt-2 rounded-xl border border-(--color-border) bg-(--color-background-secondary)/50 px-3 py-2.5">
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="text-[10px] text-(--color-text-tertiary) flex items-center gap-1">
                      <Languages className="w-3 h-3" />
                      {translation.from} → Türkçe
                    </span>
                    <button
                      onClick={() => dispatch({ type: 'TRANSLATE_CLOSE' })}
                      className="text-(--color-text-tertiary) hover:text-(--color-text-primary)"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </div>
                  <p className="text-sm text-(--color-text-secondary) leading-relaxed whitespace-pre-wrap break-words">
                    {translation.text}
                  </p>
                </div>
              )}

              {post.media && post.media.length > 0 && (
                <>
                  <div className={cn('relative grid gap-1 mt-2 rounded-xl overflow-hidden', post.media.length === 1 ? 'grid-cols-1' : 'grid-cols-2')}>
                    {post.media.map((m, idx) => (
                      <button
                        key={m.id}
                        type="button"
                        onClick={(e) => { e.stopPropagation(); setAltOpen(null); if (!isNsfwBlurred || nsfwRevealed) setLightbox({ index: idx }) }}
                        className={cn('relative bg-(--color-background-secondary) text-left', post.media.length === 1 ? 'overflow-hidden' : 'aspect-square overflow-hidden relative', (!isNsfwBlurred || nsfwRevealed) && 'cursor-zoom-in')}
                      >
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={m.url}
                          alt={m.altText ?? ''}
                          loading="lazy"
                          className={cn('object-cover w-full', post.media.length === 1 ? 'max-h-96' : 'absolute inset-0 h-full', isNsfwBlurred && !nsfwRevealed && 'blur-xl')}
                        />
                        {m.altText && (
                          <>
                            <button
                              type="button"
                              onClick={(e) => { e.stopPropagation(); setAltOpen(altOpen === m.id ? null : m.id) }}
                              className="absolute bottom-1.5 left-1.5 text-[10px] font-bold px-1.5 py-0.5 rounded bg-black/60 text-white hover:bg-black/80 leading-none z-10"
                            >
                              ALT
                            </button>
                            {altOpen === m.id && (
                              <div className="absolute bottom-0 left-0 right-0 bg-black/80 px-3 py-2 z-10">
                                <p className="text-[11px] text-white leading-relaxed">{m.altText}</p>
                              </div>
                            )}
                          </>
                        )}
                      </button>
                    ))}
                    {isNsfwBlurred && !nsfwRevealed && (
                      <button
                        onClick={(e) => { e.stopPropagation(); dispatch({ type: 'NSFW_REVEAL' }) }}
                        className="absolute inset-0 flex items-center justify-center bg-black/20"
                      >
                        <span className="text-xs font-semibold text-white bg-black/50 backdrop-blur-sm px-3 py-1.5 rounded-full">
                          🔞 Hassas medya — göster
                        </span>
                      </button>
                    )}
                  </div>
                  {lightbox && (
                    <MediaLightbox
                      items={post.media}
                      initialIndex={lightbox.index}
                      currentIndex={lightbox.index}
                      onNavigate={(i) => setLightbox({ index: i })}
                      onClose={() => setLightbox(null)}
                    />
                  )}
                </>
              )}

            {/* Link preview */}
            {!editOpen && post.linkPreview && !post.media?.length && (
              (post.linkPreview.musicPlatform ?? detectPlatformFromUrl(post.linkPreview.url))
                ? <MusicCard preview={{
                    ...post.linkPreview,
                    musicPlatform: post.linkPreview.musicPlatform ?? detectPlatformFromUrl(post.linkPreview.url) ?? undefined,
                  }} />
                : (
                  <a
                    href={post.linkPreview.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    onClick={(e) => e.stopPropagation()}
                    className="mt-2.5 block rounded-xl border border-(--color-border) overflow-hidden hover:border-(--color-coral)/40 transition-colors group/preview"
                  >
                    {post.linkPreview.image && (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={post.linkPreview.image}
                        alt=""
                        className="w-full max-h-48 object-cover bg-(--color-background-secondary)"
                        loading="lazy"
                      />
                    )}
                    <div className="px-3 py-2.5">
                      {post.linkPreview.siteName && (
                        <p className="text-[11px] text-(--color-text-tertiary) mb-0.5 uppercase tracking-wide">
                          {post.linkPreview.siteName}
                        </p>
                      )}
                      {post.linkPreview.title && (
                        <p className="text-sm font-medium text-(--color-text-primary) line-clamp-2 group-hover/preview:text-(--color-coral) transition-colors">
                          {post.linkPreview.title}
                        </p>
                      )}
                      {post.linkPreview.description && (
                        <p className="text-xs text-(--color-text-tertiary) mt-0.5 line-clamp-2">
                          {post.linkPreview.description}
                        </p>
                      )}
                      <p className="text-[11px] text-(--color-text-tertiary) mt-1.5 truncate">
                        {post.linkPreview.url}
                      </p>
                    </div>
                  </a>
                )
            )}
            {/* Poll */}
            {!editOpen && poll && (
              <div className="mt-3 rounded-xl border border-(--color-border) overflow-hidden">
                <div className="px-3 pt-2.5 pb-1 space-y-1.5">
                  {poll.options.map((opt) => {
                    const isVoted = poll.votedOptionIds.includes(opt.id)
                    const showResults = poll.voted || poll.expired
                    return (
                      <button
                        key={opt.id}
                        disabled={showResults || voting}
                        onClick={(e) => { e.stopPropagation(); void votePoll(opt.id) }}
                        className={cn(
                          'relative w-full rounded-lg px-3 py-2 text-left text-sm transition-all overflow-hidden',
                          showResults
                            ? 'cursor-default'
                            : 'border border-(--color-border) hover:border-(--color-coral)/60 hover:bg-(--color-coral)/5 active:scale-[0.99]',
                          isVoted && showResults && 'border border-(--color-coral)/30',
                        )}
                      >
                        {showResults && (
                          <div
                            className={cn(
                              'absolute inset-y-0 left-0 rounded-lg transition-all',
                              isVoted ? 'bg-(--color-coral)/15' : 'bg-(--color-background-secondary)',
                            )}
                            style={{ width: `${opt.percent}%` }}
                          />
                        )}
                        <span className={cn('relative flex items-center justify-between gap-2', showResults && 'text-(--color-text-primary)')}>
                          <span className="flex items-center gap-1.5">
                            {isVoted && showResults && <Check className="w-3.5 h-3.5 text-(--color-coral) flex-shrink-0" />}
                            {opt.text}
                          </span>
                          {showResults && (
                            <span className={cn('text-xs font-medium flex-shrink-0', isVoted ? 'text-(--color-coral)' : 'text-(--color-text-tertiary)')}>
                              {opt.percent}%
                            </span>
                          )}
                        </span>
                      </button>
                    )
                  })}
                </div>
                <div className="flex items-center gap-1.5 px-3 py-2 text-[11px] text-(--color-text-tertiary)">
                  <BarChart2 className="w-3 h-3" />
                  <span>{poll.votersCount} oy</span>
                  <span>·</span>
                  {poll.expired
                    ? <span>Sona erdi</span>
                    : <span>Bitiş: {new Date(poll.expiresAt).toLocaleDateString('tr-TR', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}</span>
                  }
                  {poll.multipleChoice && <><span>·</span><span>Çoklu seçim</span></>}
                </div>
              </div>
            )}

            {/* Quoted post embed */}
            {!editOpen && post.quotedPost && (
              <Link
                href={`/posts/${post.quotedPost.id}`}
                onClick={(e) => e.stopPropagation()}
                className="mt-2.5 block rounded-xl border border-(--color-border) hover:border-(--color-coral)/40 transition-colors overflow-hidden"
              >
                <div className="px-3 py-2.5 bg-(--color-background-secondary)/40">
                  <div className="flex items-center gap-1.5 mb-1.5">
                    <Avatar className="w-4 h-4 flex-shrink-0">
                      {post.quotedPost.author?.avatarUrl && (
                        <AvatarImage src={post.quotedPost.author.avatarUrl} alt="" />
                      )}
                      <AvatarFallback className="text-[8px] bg-(--color-coral)/20 text-(--color-coral)">
                        {(post.quotedPost.author?.displayName ?? post.quotedPost.author?.handle ?? '?').slice(0, 1).toUpperCase()}
                      </AvatarFallback>
                    </Avatar>
                    <span className="text-xs font-semibold text-(--color-text-primary) truncate">
                      {post.quotedPost.author?.displayName ?? post.quotedPost.author?.handle}
                    </span>
                    <span className="text-[11px] text-(--color-text-tertiary) flex-shrink-0">
                      @{post.quotedPost.author?.handle}
                    </span>
                  </div>
                  <p className="text-xs text-(--color-text-secondary) leading-relaxed line-clamp-3 whitespace-pre-wrap break-words">
                    {post.quotedPost.content}
                  </p>
                  {post.quotedPost.media.length > 0 && (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={post.quotedPost.media[0]!.url}
                      alt={post.quotedPost.media[0]!.altText ?? ''}
                      className="mt-1.5 w-full max-h-32 object-cover rounded-lg"
                    />
                  )}
                </div>
              </Link>
            )}
            </>
          )}

          {/* Reaction bar + actions */}
          {!hideActions && Object.keys(reactions).length > 0 && (
            <div className="flex flex-wrap gap-1.5 mt-2">
              {Object.entries(reactions)
                .filter(([, count]) => count > 0)
                .sort((a, b) => b[1] - a[1])
                .map(([emoji, count]) => (
                  <button
                    key={emoji}
                    onClick={(e) => { e.stopPropagation(); void toggleReaction(emoji) }}
                    className={cn(
                      'flex items-center gap-1 px-2 py-0.5 rounded-full text-xs border transition-all active:scale-95',
                      myReactions.has(emoji)
                        ? 'border-(--color-coral)/50 bg-(--color-coral)/10 text-(--color-coral) font-medium'
                        : 'border-(--color-border) bg-(--color-background-secondary)/60 text-(--color-text-secondary) hover:border-(--color-coral)/40 hover:bg-(--color-coral)/5',
                    )}
                  >
                    <span>{emoji}</span>
                    <span>{count}</span>
                  </button>
                ))}
            </div>
          )}

          {!hideActions && <div className="flex items-center gap-1 mt-2 -ml-2">
            <ActionBtn
              icon={<MessageCircle className="w-4 h-4" />}
              count={repliesCount}
              label="Yanıtla"
              active={replyOpen}
              hoverColor="hover:text-(--color-coral) hover:bg-(--color-coral)/8"
              activeColor="text-(--color-coral)"
              onClick={() => replyOpen ? dispatch({ type: 'REPLY_CLOSE' }) : dispatch({ type: 'REPLY_OPEN' })}
              dataAction="reply"
            />
            {/* Boost / Quote dropdown */}
            <div className="relative">
              <button
                title="Paylaş"
                aria-label={boosted ? 'Yeniden paylaşımı geri al' : 'Yeniden paylaş'}
                data-action="boost"
                onClick={(e) => { e.stopPropagation(); dispatch({ type: 'BOOST_MENU_TOGGLE' }) }}
                className={cn(
                  'flex items-center gap-1.5 px-2.5 py-1.5 rounded-full transition-all text-xs font-medium active:scale-90',
                  boosted ? 'text-teal-500' : 'text-(--color-text-tertiary) hover:text-teal-500 hover:bg-teal-500/8',
                )}
              >
                <Repeat2 className="w-4 h-4" />
                {boostsCount > 0 && <span>{boostsCount}</span>}
              </button>
              {quotesCount > 0 && (
                <button
                  title="Alıntıları gör"
                  aria-label={`${quotesCount} alıntı, görmek için tıkla`}
                  onClick={openQuotesModal}
                  className="flex items-center gap-1.5 px-2 py-1.5 rounded-full transition-all text-xs font-medium text-(--color-text-tertiary) hover:text-(--color-coral) hover:bg-(--color-coral)/8 active:scale-90"
                >
                  <Feather className="w-3.5 h-3.5" />
                  <span>{quotesCount}</span>
                </button>
              )}
              {boostMenuOpen && (
                <>
                  <div className="fixed inset-0 z-10" onClick={() => dispatch({ type: 'BOOST_MENU_CLOSE' })} />
                  <div className="absolute left-0 top-full mt-1 z-20 w-44 rounded-xl border border-(--color-border) bg-(--color-background) shadow-xl shadow-black/10 overflow-hidden">
                    <button
                      onClick={(e) => { e.stopPropagation(); dispatch({ type: 'BOOST_MENU_CLOSE' }); void toggleBoost() }}
                      className="flex items-center gap-2.5 w-full px-4 py-2.5 text-sm text-(--color-text-primary) hover:bg-(--color-background-secondary) transition-colors"
                    >
                      <Repeat2 className={cn('w-4 h-4', boosted ? 'text-teal-500' : '')} />
                      {boosted ? 'Geri al' : 'Yeniden paylaş'}
                    </button>
                    <button
                      onClick={(e) => { e.stopPropagation(); dispatch({ type: 'QUOTE_OPEN' }) }}
                      className="flex items-center gap-2.5 w-full px-4 py-2.5 text-sm text-(--color-text-primary) hover:bg-(--color-background-secondary) transition-colors border-t border-(--color-border-secondary)"
                    >
                      <Feather className="w-4 h-4" />
                      Alıntıla
                    </button>
                  </div>
                </>
              )}
            </div>
            {/* Heart — tap to like, hold to react */}
            <div className="relative">
              <button
                aria-label={liked ? 'Beğeniyi kaldır' : 'Beğen'}
                title="Beğen · Uzun basınca tepki ekle"
                data-action="like"
                onPointerDown={handleHeartPointerDown}
                onPointerUp={handleHeartPointerUp}
                onPointerLeave={handleHeartPointerLeave}
                onPointerCancel={handleHeartPointerLeave}
                onClick={handleHeartClick}
                className={cn(
                  'flex items-center gap-1.5 px-2.5 py-1.5 rounded-full text-xs font-medium select-none',
                  'transition-[transform,background,color] duration-150',
                  heartHolding && 'scale-125',
                  liked || myReactions.size > 0 || emojiPickerOpen
                    ? 'text-(--color-coral) bg-(--color-coral)/8'
                    : 'text-(--color-text-tertiary) hover:text-(--color-coral) hover:bg-(--color-coral)/8',
                )}
              >
                <Heart className={cn('w-4 h-4 transition-all', liked && 'fill-current', heartHolding && 'scale-110')} />
                {likesCount > 0 && <span>{likesCount}</span>}
              </button>
              {emojiPickerOpen && (
                <>
                  <div className="fixed inset-0 z-10" onClick={() => dispatch({ type: 'EMOJI_PICKER_CLOSE' })} />
                  <div className="absolute left-0 bottom-full mb-1.5 z-20 flex gap-0.5 p-1.5 rounded-2xl border border-(--color-border) bg-(--color-background) shadow-xl shadow-black/10">
                    {['👍','😂','😮','😢','😡','🔥','✨','👀','🎉'].map((emoji) => (
                      <button
                        key={emoji}
                        onClick={(e) => { e.stopPropagation(); void toggleReaction(emoji) }}
                        className={cn(
                          'w-8 h-8 flex items-center justify-center text-lg rounded-xl transition-all hover:scale-125 active:scale-110',
                          myReactions.has(emoji) && 'bg-(--color-coral)/15 ring-1 ring-(--color-coral)/40',
                        )}
                      >
                        {emoji}
                      </button>
                    ))}
                  </div>
                </>
              )}
            </div>
            <ActionBtn
              icon={<Bookmark className={cn('w-4 h-4', bookmarked && 'fill-current')} />}
              label="Kaydet"
              active={bookmarked}
              hoverColor="hover:text-(--color-coral) hover:bg-(--color-coral)/8"
              activeColor="text-(--color-coral)"
              onClick={() => void toggleBookmark()}
            />
            {currentContent?.trim() && (
              <button
                title={translation ? 'Çeviriyi kapat' : 'Çevir'}
                aria-label={translation ? 'Çeviriyi kapat' : 'Gönderiyi çevir'}
                onClick={() => void toggleTranslate()}
                className={cn(
                  'flex items-center gap-1 px-2 py-1.5 rounded-full transition-all text-xs active:scale-90',
                  translation
                    ? 'text-(--color-coral) bg-(--color-coral)/8'
                    : 'text-(--color-text-tertiary) hover:text-(--color-coral) hover:bg-(--color-coral)/8',
                )}
              >
                {translating
                  ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  : <Languages className="w-3.5 h-3.5" />}
              </button>
            )}
          </div>}

          {!hideActions && replyOpen && (
            <div className="mt-2 rounded-xl border border-(--color-border) bg-(--color-background-secondary)/50 overflow-hidden">
              <div className="px-3 pt-2.5 pb-1 text-[11px] text-(--color-text-tertiary) border-b border-(--color-border-secondary)">
                <span className="font-medium text-(--color-text-secondary)">@{handle}</span> yanıtlanıyor
              </div>
              <textarea
                value={replyContent}
                onChange={(e) => dispatch({ type: 'REPLY_CONTENT', text: e.target.value })}
                placeholder="Yanıtını yaz…"
                rows={2}
                autoFocus
                className="w-full resize-none bg-transparent px-3 py-2.5 text-sm text-(--color-text-primary) placeholder:text-(--color-text-tertiary) focus:outline-none"
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) void submitReply()
                }}
              />
              <div className="flex items-center justify-between px-3 pb-2.5">
                <span className={cn('text-[11px]', replyContent.length > 480 ? 'text-red-500' : 'text-(--color-text-tertiary)')}>
                  {replyContent.length > 440 && `${500 - replyContent.length}`}
                </span>
                <div className="flex gap-2">
                  <Button variant="ghost" size="sm" onClick={() => dispatch({ type: 'REPLY_CLOSE' })} className="text-xs h-7 px-3">
                    İptal
                  </Button>
                  <Button
                    size="sm"
                    onClick={submitReply}
                    disabled={!replyContent.trim() || replySubmitting || replyContent.length > 500}
                    className="text-xs h-7 px-4 bg-(--color-coral) hover:bg-(--color-coral)/90 text-white rounded-full"
                  >
                    {replySubmitting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : 'Yanıtla'}
                  </Button>
                </div>
              </div>
            </div>
          )}
          {!hideActions && quoteOpen && (
            <div className="mt-3 space-y-2">
              <textarea
                value={quoteContent}
                onChange={(e) => dispatch({ type: 'QUOTE_CONTENT', text: e.target.value })}
                placeholder="Bu gönderiyi alıntıla…"
                rows={2}
                maxLength={500}
                autoFocus
                className="w-full resize-none rounded-lg border border-(--color-border-secondary) bg-(--color-background-primary) px-3 py-2 text-sm text-(--color-text-primary) placeholder:text-(--color-text-tertiary) focus:outline-none focus:border-(--color-coral) transition-colors"
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) void submitQuote()
                  if (e.key === 'Escape') dispatch({ type: 'QUOTE_CLOSE' })
                }}
              />
              {/* Mini embed preview */}
              <div className="rounded-lg border border-(--color-border) bg-(--color-background-secondary)/40 px-3 py-2">
                <p className="text-[11px] font-semibold text-(--color-text-secondary) mb-0.5">
                  @{handle} · {formatRelativeTime(post.createdAt)}
                </p>
                <p className="text-xs text-(--color-text-tertiary) line-clamp-2">{currentContent}</p>
              </div>
              <div className="flex justify-end gap-2">
                <Button variant="ghost" size="sm" onClick={() => dispatch({ type: 'QUOTE_CLOSE' })} className="text-xs">
                  İptal
                </Button>
                <Button
                  size="sm"
                  onClick={submitQuote}
                  disabled={quoteSubmitting}
                  className="text-xs bg-(--color-coral) hover:bg-(--color-coral)/90 text-white"
                >
                  {quoteSubmitting ? '...' : 'Paylaş'}
                </Button>
              </div>
            </div>
          )}
        </div>
      </div>
    </article>

    {/* Report modal */}
    {reportOpen && (
      <ReportModal postId={post.id} onClose={() => dispatch({ type: 'REPORT_CLOSE' })} />
    )}

    {/* Edit history modal */}
    {editHistoryOpen && (
      <>
        <div
          className="fixed inset-0 z-40 bg-black/40 backdrop-blur-sm"
          onClick={() => dispatch({ type: 'EDIT_HISTORY_CLOSE' })}
        />
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 pointer-events-none">
          <div
            className="pointer-events-auto w-full max-w-md rounded-2xl border border-(--color-border) bg-(--color-background) shadow-2xl overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between px-4 py-3 border-b border-(--color-border)">
              <p className="text-sm font-semibold text-(--color-text-primary)">Düzenleme Geçmişi</p>
              <button onClick={() => dispatch({ type: 'EDIT_HISTORY_CLOSE' })} className="p-1 rounded-lg text-(--color-text-tertiary) hover:text-(--color-text-primary)">
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="max-h-96 overflow-y-auto divide-y divide-(--color-border-secondary)">
              {/* Current version */}
              <div className="px-4 py-3">
                <p className="text-[11px] font-medium text-(--color-coral) mb-1">Güncel versiyon</p>
                <p className="text-sm text-(--color-text-primary) whitespace-pre-wrap break-words">{currentContent}</p>
                <p className="text-[11px] text-(--color-text-tertiary) mt-1.5">
                  {editedAt ? new Date(editedAt).toLocaleString('tr-TR') : '—'}
                </p>
              </div>
              {editHistoryLoading && (
                <div className="flex justify-center py-6">
                  <Loader2 className="w-5 h-5 animate-spin text-(--color-coral)" />
                </div>
              )}
              {editHistory?.map((edit, i) => (
                <div key={edit.id} className="px-4 py-3">
                  <p className="text-[11px] font-medium text-(--color-text-tertiary) mb-1">
                    {i === (editHistory.length - 1) ? 'İlk versiyon' : `${i + 1}. önceki versiyon`}
                  </p>
                  {edit.contentWarning && (
                    <p className="text-[11px] text-amber-500 mb-1">CW: {edit.contentWarning}</p>
                  )}
                  <p className="text-sm text-(--color-text-secondary) whitespace-pre-wrap break-words">{edit.content}</p>
                  <p className="text-[11px] text-(--color-text-tertiary) mt-1.5">
                    {new Date(edit.editedAt).toLocaleString('tr-TR')}
                  </p>
                </div>
              ))}
              {editHistory?.length === 0 && !editHistoryLoading && (
                <div className="px-4 py-6 text-center text-sm text-(--color-text-tertiary)">Geçmiş bulunamadı.</div>
              )}
            </div>
          </div>
        </div>
      </>
    )}

    {/* Quotes modal */}
    {collectionModalOpen && (
      <>
        <div className="fixed inset-0 z-40 bg-black/40 backdrop-blur-sm" onClick={() => setCollectionModalOpen(false)} />
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 pointer-events-none">
          <div className="pointer-events-auto w-full max-w-sm bg-(--color-background) border border-(--color-border) rounded-2xl shadow-2xl overflow-hidden">
            <div className="flex items-center justify-between px-4 py-3.5 border-b border-(--color-border-secondary)">
              <span className="text-base font-bold text-(--color-text-primary)" style={{ fontFamily: 'var(--font-display)' }}>Koleksiyona Ekle</span>
              <button onClick={() => setCollectionModalOpen(false)} className="p-1 rounded-full hover:bg-(--color-background-secondary) text-(--color-text-tertiary)"><X className="w-4 h-4" /></button>
            </div>
            <div className="max-h-72 overflow-y-auto">
              {collectionsLoading ? (
                <div className="flex justify-center py-8"><Loader2 className="w-5 h-5 animate-spin text-(--color-text-tertiary)" /></div>
              ) : collections.length === 0 ? (
                <div className="px-4 py-6 text-center text-sm text-(--color-text-tertiary)">Henüz koleksiyon yok. Profil sayfandan oluşturabilirsin.</div>
              ) : (
                collections.map((c) => (
                  <button
                    key={c.id}
                    onClick={() => void addToCollection(c.id)}
                    disabled={addingToCollection === c.id}
                    className="w-full flex items-center justify-between px-4 py-3 hover:bg-(--color-background-secondary) transition-colors text-left"
                  >
                    <div>
                      <p className="text-sm font-medium text-(--color-text-primary)">{c.name}</p>
                      {c.postCount !== undefined && <p className="text-xs text-(--color-text-tertiary)">{c.postCount} gönderi</p>}
                    </div>
                    {addingToCollection === c.id ? <Loader2 className="w-4 h-4 animate-spin text-(--color-text-tertiary)" /> : <Plus className="w-4 h-4 text-(--color-text-tertiary)" />}
                  </button>
                ))
              )}
            </div>
          </div>
        </div>
      </>
    )}

    {embedOpen && (
      <>
        <div className="fixed inset-0 z-40 bg-black/40 backdrop-blur-sm" onClick={() => setEmbedOpen(false)} />
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 pointer-events-none">
          <div
            className="pointer-events-auto w-full max-w-md rounded-2xl border border-(--color-border) bg-(--color-background) shadow-2xl overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between px-4 py-3 border-b border-(--color-border)">
              <div className="flex items-center gap-2">
                <Code2 className="w-4 h-4 text-(--color-coral)" />
                <p className="text-sm font-semibold text-(--color-text-primary)">Gönderiye Gömme Kodu</p>
              </div>
              <button onClick={() => setEmbedOpen(false)} className="p-1 rounded-lg text-(--color-text-tertiary) hover:text-(--color-text-primary)">
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="p-4 space-y-3">
              <p className="text-xs text-(--color-text-tertiary)">Bu kodu web sitenize yapıştırarak gönderiyi gömebilirsin.</p>
              <div className="relative">
                <pre className="text-xs font-mono bg-(--color-background-secondary) border border-(--color-border) rounded-xl p-3 overflow-x-auto text-(--color-text-secondary) leading-relaxed whitespace-pre-wrap break-all">
                  {`<iframe src="${typeof window !== 'undefined' ? window.location.origin : ''}/posts/${post.id}/embed" width="550" height="300" frameborder="0" scrolling="no" allowfullscreen></iframe>`}
                </pre>
              </div>
              <button
                onClick={() => void navigator.clipboard.writeText(`<iframe src="${window.location.origin}/posts/${post.id}/embed" width="550" height="300" frameborder="0" scrolling="no" allowfullscreen></iframe>`).then(() => toast.success('Kod kopyalandı'))}
                className="w-full flex items-center justify-center gap-2 px-4 py-2 rounded-xl bg-(--color-coral) text-white text-sm font-medium hover:bg-(--color-coral-hover) transition-colors"
              >
                <Link2 className="w-4 h-4" /> Kodu Kopyala
              </button>
            </div>
          </div>
        </div>
      </>
    )}
    {quotesModalOpen && (
      <>
        <div className="fixed inset-0 z-40 bg-black/40 backdrop-blur-sm" onClick={() => dispatch({ type: 'QUOTES_MODAL_CLOSE' })} />
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 pointer-events-none">
          <div
            className="pointer-events-auto w-full max-w-md rounded-2xl border border-(--color-border) bg-(--color-background) shadow-2xl overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between px-4 py-3 border-b border-(--color-border)">
              <p className="text-sm font-semibold text-(--color-text-primary)">Alıntılar</p>
              <button onClick={() => dispatch({ type: 'QUOTES_MODAL_CLOSE' })} className="p-1 rounded-lg text-(--color-text-tertiary) hover:text-(--color-text-primary)">
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="max-h-[70vh] overflow-y-auto divide-y divide-(--color-border-secondary)">
              {quotesLoading && (
                <div className="flex justify-center py-8">
                  <Loader2 className="w-5 h-5 animate-spin text-(--color-coral)" />
                </div>
              )}
              {quotesList?.map((q) => (
                <a
                  key={q.id}
                  href={`/posts/${q.id}`}
                  className="flex gap-3 px-4 py-3 hover:bg-(--color-background-secondary)/60 transition-colors group"
                  onClick={(e) => e.stopPropagation()}
                >
                  <Avatar className="w-8 h-8 flex-shrink-0 mt-0.5">
                    {q.author?.avatarUrl && <AvatarImage src={q.author.avatarUrl} alt="" />}
                    <AvatarFallback className="text-xs">{(q.author?.displayName ?? q.author?.handle ?? '?')[0]?.toUpperCase()}</AvatarFallback>
                  </Avatar>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-baseline gap-1.5 flex-wrap">
                      <span className="text-sm font-semibold text-(--color-text-primary) group-hover:text-(--color-coral) transition-colors truncate">
                        {q.author?.displayName ?? q.author?.handle}
                      </span>
                      <span className="text-xs text-(--color-text-tertiary) truncate">@{q.author?.handle}</span>
                      <span className="text-xs text-(--color-text-tertiary) ml-auto flex-shrink-0">
                        {new Date(q.createdAt).toLocaleDateString('tr-TR', { day: 'numeric', month: 'short' })}
                      </span>
                    </div>
                    <p className="text-sm text-(--color-text-secondary) line-clamp-2 mt-0.5">{q.content || '(medya)'}</p>
                  </div>
                </a>
              ))}
              {quotesList?.length === 0 && !quotesLoading && (
                <div className="px-4 py-10 text-center">
                  <p className="text-sm text-(--color-text-secondary) font-medium">Henüz alıntı yok</p>
                  <p className="text-xs text-(--color-text-tertiary) mt-0.5">Bu gönderiyi ilk alıntılayan sen ol</p>
                </div>
              )}
            </div>
          </div>
        </div>
      </>
    )}
    </Fragment>
  )
}

export const PostCard = memo(_PostCard)

function ActionBtn({
  icon,
  count,
  label,
  active,
  activeColor,
  hoverColor,
  onClick,
  dataAction,
}: {
  icon: React.ReactNode
  count?: number
  label: string
  active?: boolean
  activeColor?: string
  hoverColor?: string
  onClick?: () => void
  dataAction?: string
}) {
  return (
    <button
      onClick={onClick}
      aria-label={label}
      title={label}
      data-action={dataAction}
      className={cn(
        'flex items-center gap-1.5 px-2.5 py-1.5 rounded-full transition-all text-xs font-medium active:scale-90',
        active ? activeColor : 'text-(--color-text-tertiary)',
        !active && hoverColor,
      )}
    >
      {icon}
      {count !== undefined && count > 0 && <span>{count}</span>}
    </button>
  )
}
