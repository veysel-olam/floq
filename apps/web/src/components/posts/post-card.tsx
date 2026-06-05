'use client'

import { useState, useReducer, useEffect, useRef, memo, Fragment } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Heart, Repeat2, MessageCircle, Bookmark, MoreHorizontal, Pencil, Trash2, Check, X, Eye, Users, Lock, CornerDownRight, Feather, BarChart2, Pin, PinOff, Loader2, Languages, UserCheck, Flag, Globe, Link2, Code2, FolderPlus, Plus, Play, Pause, Volume2, Volume1, VolumeX, Maximize, Minimize, PictureInPicture2, MapPin, AlertTriangle, Star, LayoutTemplate } from 'lucide-react'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Button } from '@/components/ui/button'
import { AlertDialog, AlertDialogContent, AlertDialogHeader, AlertDialogTitle, AlertDialogDescription, AlertDialogFooter, AlertDialogCancel, AlertDialogAction } from '@/components/ui/alert-dialog'
import { cn } from '@/lib/utils'
import { htmlToText } from '@/lib/html'
import { api, type Post, type Poll, type Actor, type PostCollection, proxyMediaUrl } from '@/lib/api'
import type { FilterResult } from '@/lib/keyword-filters'
import { ReportModal } from '@/components/report-modal'
import { CodeBlock } from '@/components/ui/code-block'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { useUserPrefs } from '@/lib/user-prefs-context'
import { triggerHaptic } from '@/hooks/use-haptics'
import { MediaLightbox } from '@/components/ui/media-lightbox'
import { toast } from 'sonner'
import katex from 'katex'
import 'katex/dist/katex.min.css'

export const FLAIR_COLORS: Record<string, string> = {
  coral:  'bg-red-50 text-red-600 border-red-200 dark:bg-red-950/30 dark:text-red-400 dark:border-red-900',
  teal:   'bg-teal-50 text-teal-600 border-teal-200 dark:bg-teal-950/30 dark:text-teal-400 dark:border-teal-900',
  blue:   'bg-blue-50 text-blue-600 border-blue-200 dark:bg-blue-950/30 dark:text-blue-400 dark:border-blue-900',
  purple: 'bg-purple-50 text-purple-600 border-purple-200 dark:bg-purple-950/30 dark:text-purple-400 dark:border-purple-900',
  green:  'bg-green-50 text-green-600 border-green-200 dark:bg-green-950/30 dark:text-green-400 dark:border-green-900',
  orange: 'bg-orange-50 text-orange-600 border-orange-200 dark:bg-orange-950/30 dark:text-orange-400 dark:border-orange-900',
  red:    'bg-red-100 text-red-700 border-red-300 dark:bg-red-950/40 dark:text-red-300 dark:border-red-800',
  zinc:   'bg-zinc-100 text-zinc-600 border-zinc-200 dark:bg-zinc-800 dark:text-zinc-400 dark:border-zinc-700',
}

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
  /** Suppress the post's own ⋮ menu (e.g. when a parent renders its own context menu, as flows do). */
  hideMenu?: boolean
  detail?: boolean
  /** Draws a continuous vertical thread connector down from the avatar and removes the bottom border (for ancestor posts in a thread). */
  threadLine?: boolean
  communityPin?: { isPinned: boolean; onToggle: () => Promise<void> }
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

// LaTeX math: $$...$$ (block) and $...$ (inline, only when it looks like math, not currency)
export const MATH_RE = /(\$\$[\s\S]+?\$\$|\$[^$\n]+?\$)/g

export function renderMathPart(part: string, key: string): React.ReactNode | null {
  let tex: string | null = null
  let display = false
  if (part.startsWith('$$') && part.endsWith('$$') && part.length > 4) {
    tex = part.slice(2, -2)
    display = true
  } else if (part.startsWith('$') && part.endsWith('$') && part.length > 2) {
    const inner = part.slice(1, -1)
    // require a math indicator so "$5 ... $10" currency isn't rendered as math
    if (/[\\^_{}]/.test(inner)) tex = inner
  }
  if (tex == null) return null
  try {
    const html = katex.renderToString(tex, { displayMode: display, throwOnError: false, output: 'html' })
    return (
      <span
        key={key}
        className={display ? 'block my-2 overflow-x-auto' : ''}
        dangerouslySetInnerHTML={{ __html: html }}
      />
    )
  } catch {
    return null
  }
}

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
    // Math first (so $...$ isn't broken by token splitting), then hashtag/mention on the rest
    return part.split(MATH_RE).map((mp, mi) => {
      const math = mi % 2 === 1 ? renderMathPart(mp, `${keyPrefix}-m-${ii}-${mi}`) : null
      if (math) return math
      const richParts = mp.split(RICH_TOKEN)
      return richParts.map((rp, ri) => {
        if (rp.startsWith('#')) {
          const tag = rp.slice(1).toLowerCase()
          return (
            <Link key={`${keyPrefix}-r-${ii}-${mi}-${ri}`} href={`/hashtag/${encodeURIComponent(tag)}`} className="text-(--color-coral) hover:underline" onClick={(e) => e.stopPropagation()}>
              {rp}
            </Link>
          )
        }
        if (rp.startsWith('@')) {
          return (
            <MentionLink key={`${keyPrefix}-r-${ii}-${mi}-${ri}`} handle={rp.slice(1)}>
              {rp}
            </MentionLink>
          )
        }
        return <Fragment key={`${keyPrefix}-r-${ii}-${mi}-${ri}`}>{rp}</Fragment>
      })
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

export function extractYouTubeId(url: string): string | null {
  try {
    const u = new URL(url)
    const host = u.hostname.replace(/^www\./, '')
    if (host === 'youtu.be') return u.pathname.slice(1).split('?')[0] ?? null
    if (host === 'youtube.com') return u.searchParams.get('v')
  } catch {}
  return null
}

export function detectPlatformFromUrl(url: string): string | null {
  try {
    const host = new URL(url).hostname.replace(/^www\./, '')
    if (host === 'open.spotify.com' || host === 'spotify.com') return 'spotify'
    if (host === 'music.youtube.com') return 'ytmusic'
    // youtube.com / youtu.be are video platforms — rendered as regular link cards, not MusicCard
    if (host === 'music.apple.com') return 'applemusic'
    if (host === 'deezer.com') return 'deezer'
    if (host === 'soundcloud.com') return 'soundcloud'
    if (host === 'tidal.com' || host === 'listen.tidal.com') return 'tidal'
    if (host.endsWith('bandcamp.com')) return 'bandcamp'
  } catch {}
  return null
}

// Video platforms rendered as click-to-play embeds (YouTube has its own dedicated card)
export function detectVideoEmbed(url: string): { platform: string; embedUrl: string } | null {
  try {
    const u = new URL(url)
    const host = u.hostname.replace(/^www\./, '')
    const parent = typeof window !== 'undefined' ? window.location.hostname : 'localhost'

    if (host === 'vimeo.com' || host === 'player.vimeo.com') {
      const m = u.pathname.match(/\/(?:video\/)?(\d+)/)
      if (m) return { platform: 'vimeo', embedUrl: `https://player.vimeo.com/video/${m[1]}` }
    }
    if (host === 'tiktok.com' || host.endsWith('.tiktok.com')) {
      const m = u.pathname.match(/\/video\/(\d+)/)
      if (m) return { platform: 'tiktok', embedUrl: `https://www.tiktok.com/embed/v2/${m[1]}` }
    }
    if (host === 'twitch.tv') {
      const vod = u.pathname.match(/^\/videos\/(\d+)/)
      if (vod) return { platform: 'twitch', embedUrl: `https://player.twitch.tv/?video=${vod[1]}&parent=${parent}&autoplay=false` }
      const clip = u.pathname.match(/^\/[^/]+\/clip\/([^/?]+)/)
      if (clip) return { platform: 'twitch', embedUrl: `https://clips.twitch.tv/embed?clip=${clip[1]}&parent=${parent}&autoplay=false` }
      const ch = u.pathname.match(/^\/([^/?]+)\/?$/)
      if (ch && ch[1]) return { platform: 'twitch', embedUrl: `https://player.twitch.tv/?channel=${ch[1]}&parent=${parent}&autoplay=false` }
    }
    if (host === 'clips.twitch.tv') {
      const slug = u.pathname.slice(1).split('/')[0]
      if (slug) return { platform: 'twitch', embedUrl: `https://clips.twitch.tv/embed?clip=${slug}&parent=${parent}&autoplay=false` }
    }
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
  bandcamp:   { label: 'Bandcamp',     color: '#629AA9', textColor: '#fff' },
  vimeo:      { label: 'Vimeo',        color: '#1AB7EA', textColor: '#fff' },
  twitch:     { label: 'Twitch',       color: '#9146FF', textColor: '#fff' },
  tiktok:     { label: 'TikTok',       color: '#000000', textColor: '#fff' },
}

export function MusicCard({ preview }: { preview: NonNullable<Post['linkPreview']> }) {
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
            height={
              preview.musicPlatform === 'soundcloud' ? 120
              : preview.musicPlatform === 'youtube' || preview.musicPlatform === 'ytmusic' ? 200
              : preview.musicPlatform === 'bandcamp' ? (preview.musicType === 'album' ? 470 : 120)
              : 80
            }
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

export function YouTubeCard({ preview, videoId }: { preview: NonNullable<Post['linkPreview']>; videoId: string }) {
  const [playing, setPlaying] = useState(false)
  const thumbnail = preview.image ?? `https://img.youtube.com/vi/${videoId}/hqdefault.jpg`

  return (
    <div
      className="mt-2.5 rounded-xl border border-(--color-border) overflow-hidden hover:border-(--color-coral)/30 transition-colors"
      onClick={(e) => e.stopPropagation()}
    >
      {playing ? (
        <iframe
          src={`https://www.youtube.com/embed/${videoId}?autoplay=1&rel=0`}
          className="w-full aspect-video"
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
          allowFullScreen
          loading="lazy"
        />
      ) : (
        <button
          onClick={() => setPlaying(true)}
          className="relative w-full block group"
          aria-label="Videoyu oynat"
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={thumbnail}
            alt={preview.title ?? ''}
            className="w-full aspect-video object-cover bg-(--color-background-secondary)"
            loading="lazy"
          />
          {/* Subtle dark overlay + glass play button */}
          <div className="absolute inset-0 flex items-center justify-center bg-black/10 group-hover:bg-black/22 transition-colors">
            <div className="w-12 h-12 rounded-full bg-black/50 backdrop-blur-sm flex items-center justify-center shadow-md group-hover:scale-105 transition-transform">
              <Play className="w-5 h-5 text-white fill-white ml-0.5" />
            </div>
          </div>
        </button>
      )}
      <a
        href={preview.url}
        target="_blank"
        rel="noopener noreferrer"
        className="flex items-center gap-2.5 px-3 py-2.5 hover:bg-(--color-background-secondary) transition-colors group/yt"
      >
        <div className="flex-1 min-w-0">
          <p className="text-[11px] text-(--color-text-tertiary) mb-0.5 uppercase tracking-wide">YouTube</p>
          {preview.title && (
            <p className="text-sm font-medium text-(--color-text-primary) line-clamp-1 group-hover/yt:text-(--color-coral) transition-colors">
              {preview.title}
            </p>
          )}
        </div>
      </a>
    </div>
  )
}

// Generic click-to-play embed for Vimeo / TikTok / Twitch
export function VideoEmbedCard({ preview, platform, embedUrl }: {
  preview: NonNullable<Post['linkPreview']>
  platform: string
  embedUrl: string
}) {
  const [playing, setPlaying] = useState(false)
  const meta = PLATFORM_META[platform]
  const portrait = platform === 'tiktok'

  return (
    <div
      className="mt-2.5 rounded-xl border border-(--color-border) overflow-hidden hover:border-(--color-coral)/30 transition-colors"
      onClick={(e) => e.stopPropagation()}
    >
      <div className={cn('relative w-full', portrait ? 'aspect-[9/16] max-h-[580px] mx-auto' : 'aspect-video')}>
        {playing ? (
          <iframe
            src={embedUrl}
            className="absolute inset-0 w-full h-full"
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; fullscreen"
            allowFullScreen
            loading="lazy"
          />
        ) : (
          <button
            onClick={() => setPlaying(true)}
            className="group/v absolute inset-0 w-full h-full block"
            aria-label="Oynat"
          >
            {preview.image ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={preview.image} alt={preview.title ?? ''} className="w-full h-full object-cover bg-(--color-background-secondary)" loading="lazy" />
            ) : (
              <div className="w-full h-full" style={{ background: meta?.color ?? 'var(--color-background-secondary)' }} />
            )}
            <div className="absolute inset-0 flex items-center justify-center bg-black/10 group-hover/v:bg-black/22 transition-colors">
              <div className="w-12 h-12 rounded-full bg-black/50 backdrop-blur-sm flex items-center justify-center shadow-md group-hover/v:scale-105 transition-transform">
                <Play className="w-5 h-5 text-white fill-white ml-0.5" />
              </div>
            </div>
            {meta && (
              <span
                className="absolute top-2 left-2 text-[10px] font-bold px-1.5 py-0.5 rounded-full"
                style={{ background: meta.color, color: meta.textColor }}
              >
                {meta.label}
              </span>
            )}
          </button>
        )}
      </div>
      {preview.title && (
        <a
          href={preview.url}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-2.5 px-3 py-2.5 hover:bg-(--color-background-secondary) transition-colors group/ve"
        >
          <div className="flex-1 min-w-0">
            {meta && <p className="text-[11px] text-(--color-text-tertiary) mb-0.5 uppercase tracking-wide">{meta.label}</p>}
            <p className="text-sm font-medium text-(--color-text-primary) line-clamp-1 group-hover/ve:text-(--color-coral) transition-colors">
              {preview.title}
            </p>
          </div>
        </a>
      )}
    </div>
  )
}

// Location card — click-to-load mini map (key-free OSM embed); name links to the in-app feed
export function LocationCard({ name, lat, lng }: { name: string; lat?: number | null; lng?: number | null }) {
  const [shown, setShown] = useState(false)
  const hasCoords = typeof lat === 'number' && typeof lng === 'number'

  if (!hasCoords) {
    return (
      <div className="mt-2">
        <Link
          href={`/location/${encodeURIComponent(name)}`}
          onClick={(e) => e.stopPropagation()}
          className="inline-flex items-center gap-1 text-[11px] text-(--color-text-tertiary) hover:text-(--color-coral) transition-colors"
        >
          <MapPin className="w-3 h-3 flex-shrink-0" />
          <span>{name}</span>
        </Link>
      </div>
    )
  }

  const d = 0.008
  const embedUrl = `https://www.openstreetmap.org/export/embed.html?bbox=${lng! - d}%2C${lat! - d}%2C${lng! + d}%2C${lat! + d}&layer=mapnik&marker=${lat}%2C${lng}`
  const osmUrl = `https://www.openstreetmap.org/?mlat=${lat}&mlon=${lng}#map=15/${lat}/${lng}`

  return (
    <div className="mt-2 rounded-xl border border-(--color-border) overflow-hidden" onClick={(e) => e.stopPropagation()}>
      {shown ? (
        <iframe src={embedUrl} className="w-full h-40 block" loading="lazy" title={name} style={{ border: 'none' }} />
      ) : (
        <button
          onClick={() => setShown(true)}
          className="group/map relative w-full h-28 flex items-center justify-center bg-(--color-background-secondary) overflow-hidden"
          aria-label="Haritayı göster"
        >
          <div className="absolute inset-0 opacity-[0.06]" style={{ backgroundImage: 'radial-gradient(circle at 1px 1px, currentColor 1px, transparent 0)', backgroundSize: '16px 16px' }} />
          <div className="relative flex flex-col items-center gap-1 text-(--color-text-tertiary) group-hover/map:text-(--color-coral) transition-colors">
            <MapPin className="w-6 h-6" />
            <span className="text-[11px] font-medium">Haritayı göster</span>
          </div>
        </button>
      )}
      <div className="flex items-center gap-1.5 px-3 py-2 border-t border-(--color-border-secondary)">
        <MapPin className="w-3.5 h-3.5 text-(--color-coral) flex-shrink-0" />
        <Link
          href={`/location/${encodeURIComponent(name)}`}
          onClick={(e) => e.stopPropagation()}
          className="text-xs font-medium text-(--color-text-primary) hover:text-(--color-coral) transition-colors truncate flex-1 min-w-0"
        >
          {name}
        </Link>
        <a
          href={osmUrl}
          target="_blank"
          rel="noopener noreferrer"
          onClick={(e) => e.stopPropagation()}
          className="text-[11px] text-(--color-text-tertiary) hover:text-(--color-coral) transition-colors flex-shrink-0"
        >
          Haritada aç ↗
        </a>
      </div>
    </div>
  )
}

type EditHistoryEntry = { id: string; content: string; contentWarning: string | null; editedAt: string }

type DiffPart = { text: string; type: 'same' | 'added' | 'removed' }

function wordDiff(oldText: string, newText: string): DiffPart[] {
  const oldWords = oldText.split(/(\s+)/)
  const newWords = newText.split(/(\s+)/)
  const m = oldWords.length, n = newWords.length
  const dp: number[][] = Array.from({ length: m + 1 }, () => new Array(n + 1).fill(0))
  for (let i = 1; i <= m; i++)
    for (let j = 1; j <= n; j++)
      dp[i][j] = oldWords[i - 1] === newWords[j - 1] ? dp[i - 1][j - 1] + 1 : Math.max(dp[i - 1][j], dp[i][j - 1])
  const result: DiffPart[] = []
  let i = m, j = n
  while (i > 0 || j > 0) {
    if (i > 0 && j > 0 && oldWords[i - 1] === newWords[j - 1]) {
      result.unshift({ text: oldWords[i - 1], type: 'same' }); i--; j--
    } else if (j > 0 && (i === 0 || dp[i][j - 1] >= dp[i - 1][j])) {
      result.unshift({ text: newWords[j - 1], type: 'added' }); j--
    } else {
      result.unshift({ text: oldWords[i - 1], type: 'removed' }); i--
    }
  }
  return result
}

function DiffView({ oldText, newText }: { oldText: string; newText: string }) {
  const parts = wordDiff(oldText, newText)
  return (
    <p className="text-sm leading-relaxed whitespace-pre-wrap break-words">
      {parts.map((p, i) => (
        p.type === 'same' ? (
          <span key={i} className="text-(--color-text-secondary)">{p.text}</span>
        ) : p.type === 'added' ? (
          <span key={i} className="text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 rounded px-0.5">{p.text}</span>
        ) : (
          <span key={i} className="text-red-500 bg-red-500/10 rounded px-0.5 line-through opacity-70">{p.text}</span>
        )
      ))}
    </p>
  )
}

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
  | { type: 'POLL_RETRACTED'; poll: Poll }
  | { type: 'VOTING'; value: boolean }
  | { type: 'EMOJI_PICKER_TOGGLE' }
  | { type: 'EMOJI_PICKER_CLOSE' }
  | { type: 'SECONDARY_MENU_TOGGLE' }
  | { type: 'SECONDARY_MENU_CLOSE' }
  | { type: 'TRANSLATE_START' }
  | { type: 'TRANSLATE_DONE'; text: string; from: string }
  | { type: 'TRANSLATE_CLOSE' }
  | { type: 'TRANSLATING'; value: boolean }

// ─── InlineVideoPlayer ────────────────────────────────────────────────────────

const VIDEO_SPEEDS = [0.5, 0.75, 1, 1.25, 1.5, 2]

function formatVideoDuration(s: number) {
  if (!isFinite(s) || s < 0) return '0:00'
  const m = Math.floor(s / 60)
  return `${m}:${Math.floor(s % 60).toString().padStart(2, '0')}`
}

export function InlineVideoPlayer({ url, previewUrl, altText, square }: {
  url: string
  previewUrl: string | null
  altText: string | null
  square: boolean
}) {
  const [playing, setPlaying] = useState(false)
  const [muted, setMuted] = useState(true)
  const [volume, setVolume] = useState(1)
  const [currentTime, setCurrentTime] = useState(0)
  const [duration, setDuration] = useState(0)
  const [buffered, setBuffered] = useState(0)
  const [showControls, setShowControls] = useState(false)
  const [fullscreen, setFullscreen] = useState(false)
  const [waiting, setWaiting] = useState(false)
  const [speed, setSpeed] = useState(1)
  const [speedOpen, setSpeedOpen] = useState(false)
  const [showVolume, setShowVolume] = useState(false)
  const [pip, setPip] = useState(false)
  const videoRef = useRef<HTMLVideoElement>(null)
  const wrapRef = useRef<HTMLDivElement>(null)
  const hideTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const dblTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    const el = videoRef.current
    if (!el) return
    const onTime = () => {
      setCurrentTime(el.currentTime)
      if (el.buffered.length > 0 && el.duration > 0)
        setBuffered((el.buffered.end(el.buffered.length - 1) / el.duration) * 100)
    }
    const onLoad = () => setDuration(isFinite(el.duration) ? el.duration : 0)
    const onEnded = () => { setPlaying(false); setCurrentTime(0) }
    const onFS = () => setFullscreen(!!document.fullscreenElement)
    const onWait = () => setWaiting(true)
    const onPlay = () => setWaiting(false)
    const onPipEnter = () => setPip(true)
    const onPipLeave = () => setPip(false)
    el.addEventListener('timeupdate', onTime)
    el.addEventListener('loadedmetadata', onLoad)
    el.addEventListener('durationchange', onLoad)
    el.addEventListener('ended', onEnded)
    el.addEventListener('waiting', onWait)
    el.addEventListener('playing', onPlay)
    el.addEventListener('canplay', onPlay)
    el.addEventListener('enterpictureinpicture', onPipEnter)
    el.addEventListener('leavepictureinpicture', onPipLeave)
    document.addEventListener('fullscreenchange', onFS)
    return () => {
      el.removeEventListener('timeupdate', onTime)
      el.removeEventListener('loadedmetadata', onLoad)
      el.removeEventListener('durationchange', onLoad)
      el.removeEventListener('ended', onEnded)
      el.removeEventListener('waiting', onWait)
      el.removeEventListener('playing', onPlay)
      el.removeEventListener('canplay', onPlay)
      el.removeEventListener('enterpictureinpicture', onPipEnter)
      el.removeEventListener('leavepictureinpicture', onPipLeave)
      document.removeEventListener('fullscreenchange', onFS)
    }
  }, [])

  // Keyboard shortcuts when hovering
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      const el = videoRef.current
      const wrap = wrapRef.current
      if (!el || !wrap) return
      if (!wrap.matches(':hover') && !fullscreen) return
      if ((e.target as HTMLElement)?.tagName === 'INPUT' || (e.target as HTMLElement)?.tagName === 'TEXTAREA') return
      switch (e.code) {
        case 'Space': e.preventDefault(); doTogglePlay(); break
        case 'ArrowRight': e.preventDefault(); el.currentTime = Math.min(el.duration, el.currentTime + 5); revealControls(); break
        case 'ArrowLeft': e.preventDefault(); el.currentTime = Math.max(0, el.currentTime - 5); revealControls(); break
        case 'KeyM': e.preventDefault(); doToggleMute(); break
        case 'KeyF': e.preventDefault(); doToggleFS(); break
      }
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fullscreen])

  function revealControls() {
    setShowControls(true)
    if (hideTimer.current) clearTimeout(hideTimer.current)
    hideTimer.current = setTimeout(() => setShowControls(false), 3000)
  }

  function doTogglePlay() {
    const el = videoRef.current
    if (!el) return
    if (el.paused) { void el.play(); setPlaying(true) } else { el.pause(); setPlaying(false) }
  }

  function doToggleMute() {
    const el = videoRef.current
    if (!el) return
    el.muted = !el.muted
    setMuted(el.muted)
  }

  function doToggleFS() {
    if (fullscreen) void document.exitFullscreen()
    else void wrapRef.current?.requestFullscreen()
  }

  function handleWrapClick(e: React.MouseEvent) {
    e.stopPropagation()
    revealControls()
    // double-click → fullscreen (single click → play/pause with 200ms guard)
    if (dblTimer.current) {
      clearTimeout(dblTimer.current)
      dblTimer.current = null
      doToggleFS()
      return
    }
    dblTimer.current = setTimeout(() => {
      dblTimer.current = null
      doTogglePlay()
    }, 200)
  }

  function seek(e: React.MouseEvent<HTMLDivElement>) {
    e.stopPropagation()
    const el = videoRef.current
    if (!el || !duration) return
    const rect = e.currentTarget.getBoundingClientRect()
    el.currentTime = Math.max(0, Math.min(duration, ((e.clientX - rect.left) / rect.width) * duration))
    revealControls()
  }

  function changeVolume(e: React.MouseEvent<HTMLDivElement>) {
    e.stopPropagation()
    const el = videoRef.current
    if (!el) return
    const rect = e.currentTarget.getBoundingClientRect()
    const v = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width))
    el.volume = v
    el.muted = v === 0
    setVolume(v)
    setMuted(v === 0)
  }

  function applySpeed(s: number) {
    const el = videoRef.current
    if (el) el.playbackRate = s
    setSpeed(s)
    setSpeedOpen(false)
  }

  function togglePip(e: React.MouseEvent) {
    e.stopPropagation()
    const el = videoRef.current
    if (!el) return
    if (document.pictureInPictureElement) void document.exitPictureInPicture()
    else void el.requestPictureInPicture()
  }

  const progress = duration > 0 ? (currentTime / duration) * 100 : 0
  const visible = showControls || !playing
  const pipSupported = typeof document !== 'undefined' && 'pictureInPictureEnabled' in document

  return (
    <div
      ref={wrapRef}
      className={cn('relative bg-black select-none', !fullscreen && square && 'aspect-square', 'overflow-hidden')}
      onClick={handleWrapClick}
      onMouseMove={revealControls}
      onMouseLeave={() => {
        if (hideTimer.current) clearTimeout(hideTimer.current)
        setShowControls(false)
        setShowVolume(false)
        setSpeedOpen(false)
      }}
    >
      <video
        ref={videoRef}
        src={url}
        poster={previewUrl ?? undefined}
        muted={muted}
        playsInline
        preload="metadata"
        className={cn(
          'w-full',
          fullscreen
            ? 'h-full object-contain'
            : square ? 'absolute inset-0 h-full object-cover' : 'max-h-[480px] object-contain',
        )}
      />

      {/* Buffering spinner */}
      {waiting && (
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          <Loader2 className="w-8 h-8 text-white/70 animate-spin" />
        </div>
      )}

      {/* Centre play overlay when paused */}
      {!playing && !waiting && (
        <div className="absolute inset-0 flex items-center justify-center bg-black/25 pointer-events-none">
          <div className="w-14 h-14 rounded-full bg-black/55 backdrop-blur-sm flex items-center justify-center">
            <Play className="w-6 h-6 text-white ml-0.5" />
          </div>
        </div>
      )}

      {/* Control bar */}
      <div
        className={cn(
          'absolute bottom-0 left-0 right-0 transition-opacity duration-200',
          visible ? 'opacity-100' : 'opacity-0 pointer-events-none',
        )}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="bg-gradient-to-t from-black/80 via-black/50 to-transparent pt-10 pb-3 px-3">

          {/* Seekbar */}
          <div
            className="h-1.5 rounded-full bg-white/25 mb-3 cursor-pointer group/seek relative"
            onClick={seek}
          >
            <div className="absolute inset-y-0 left-0 rounded-full bg-white/35 pointer-events-none" style={{ width: `${buffered}%` }} />
            <div className="absolute inset-y-0 left-0 rounded-full bg-white pointer-events-none" style={{ width: `${progress}%` }}>
              <div className="absolute right-0 top-1/2 -translate-y-1/2 translate-x-1/2 w-3.5 h-3.5 rounded-full bg-white opacity-0 group-hover/seek:opacity-100 transition-opacity shadow-sm" />
            </div>
          </div>

          {/* Button row */}
          <div className="flex items-center gap-0.5">
            {/* Play/Pause */}
            <button
              onClick={(e) => { e.stopPropagation(); doTogglePlay(); revealControls() }}
              className="w-8 h-8 flex items-center justify-center text-white/90 hover:text-white rounded-lg hover:bg-white/10 transition-colors"
            >
              {playing ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4 ml-0.5" />}
            </button>

            {/* Time */}
            <span className="text-[11px] text-white/75 tabular-nums px-1.5 flex-1">
              {formatVideoDuration(currentTime)} / {formatVideoDuration(duration)}
            </span>

            {altText && (
              <span className="text-[10px] font-semibold px-1 py-0.5 rounded bg-white/20 text-white mr-0.5">ALT</span>
            )}

            {/* Speed */}
            <div className="relative">
              <button
                onClick={(e) => { e.stopPropagation(); setSpeedOpen((v) => !v); setShowVolume(false) }}
                className="h-8 px-2 flex items-center text-[11px] font-bold text-white/75 hover:text-white rounded-lg hover:bg-white/10 transition-colors tabular-nums"
              >
                {speed === 1 ? '1×' : `${speed}×`}
              </button>
              {speedOpen && (
                <div className="absolute bottom-full right-0 mb-1.5 bg-black/90 backdrop-blur-sm rounded-xl py-1 w-16 overflow-hidden border border-white/10 z-10">
                  {VIDEO_SPEEDS.map((s) => (
                    <button
                      key={s}
                      onClick={(e) => { e.stopPropagation(); applySpeed(s) }}
                      className={cn(
                        'w-full py-1.5 text-center text-[12px] transition-colors hover:bg-white/15',
                        speed === s ? 'text-white font-bold' : 'text-white/65',
                      )}
                    >
                      {s === 1 ? '1×' : `${s}×`}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Volume */}
            <div
              className="relative flex items-center"
              onMouseEnter={() => setShowVolume(true)}
              onMouseLeave={() => setShowVolume(false)}
            >
              <button
                onClick={(e) => { e.stopPropagation(); doToggleMute() }}
                className="w-8 h-8 flex items-center justify-center text-white/75 hover:text-white rounded-lg hover:bg-white/10 transition-colors"
              >
                {muted || volume === 0
                  ? <VolumeX className="w-4 h-4" />
                  : volume < 0.5
                    ? <Volume1 className="w-4 h-4" />
                    : <Volume2 className="w-4 h-4" />}
              </button>
              {showVolume && !muted && (
                <div
                  className="w-20 h-1.5 rounded-full bg-white/25 cursor-pointer group/vol mr-1"
                  onClick={changeVolume}
                >
                  <div className="h-full rounded-full bg-white relative" style={{ width: `${muted ? 0 : volume * 100}%` }}>
                    <div className="absolute right-0 top-1/2 -translate-y-1/2 translate-x-1/2 w-3 h-3 rounded-full bg-white opacity-0 group-hover/vol:opacity-100 transition-opacity shadow-sm" />
                  </div>
                </div>
              )}
            </div>

            {/* Picture-in-Picture */}
            {pipSupported && (
              <button
                onClick={togglePip}
                className={cn(
                  'w-8 h-8 flex items-center justify-center rounded-lg hover:bg-white/10 transition-colors',
                  pip ? 'text-white' : 'text-white/75 hover:text-white',
                )}
                title="Picture in Picture"
              >
                <PictureInPicture2 className="w-3.5 h-3.5" />
              </button>
            )}

            {/* Fullscreen */}
            <button
              onClick={(e) => { e.stopPropagation(); doToggleFS() }}
              className="w-8 h-8 flex items-center justify-center text-white/75 hover:text-white rounded-lg hover:bg-white/10 transition-colors"
              title={fullscreen ? 'Küçült (F)' : 'Tam ekran (F)'}
            >
              {fullscreen ? <Minimize className="w-3.5 h-3.5" /> : <Maximize className="w-3.5 h-3.5" />}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

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
    case 'POLL_RETRACTED':      return { ...state, poll: action.poll, voting: false }
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

function PostCardImpl({ post, onDelete, onReply, onEdit, currentActorHandle, filterResult, pinned, onPinChange, hideActions, hideMenu, detail, threadLine, communityPin }: PostCardProps) {
  const router = useRouter()
  const { nsfwMode } = useUserPrefs()
  const isNsfwBlurred = post.sensitive && nsfwMode === 'blur'

  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false)

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
    likesCount, boostsCount, repliesCount,
    reactions, myReactions,
    replyOpen, replyContent, replySubmitting,
    quoteOpen, quoteContent, quoteSubmitting,
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
  // Heart long-press (must be declared before any early return — rules of hooks)
  const longPressTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const pressStartTime = useRef<number>(0)
  const [heartHolding, setHeartHolding] = useState(false)

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
          <AlertTriangle className="w-4 h-4 flex-shrink-0 text-amber-500" />
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
        void triggerHaptic('light')
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
        void triggerHaptic('medium')
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
        void triggerHaptic('light')
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

  const LONG_PRESS_MS = 450

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
    if (!poll || poll.expired || voting) return
    const isRetract = poll.voted && poll.votedOptionIds.includes(optionId)
    dispatch({ type: 'VOTING', value: true })
    try {
      if (isRetract) {
        const updated = await api.polls.retractVote(poll.id)
        void triggerHaptic('selection')
        dispatch({ type: 'POLL_RETRACTED', poll: updated })
      } else if (!poll.voted) {
        const updated = await api.polls.vote(poll.id, [optionId])
        void triggerHaptic('selection')
        dispatch({ type: 'POLL_VOTED', poll: updated })
      }
    } catch {
      toast.error(isRetract ? 'Oy geri alınamadı.' : 'Oy gönderilemedi.')
      dispatch({ type: 'VOTING', value: false })
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
      {...(threadLine ? { 'data-thread-line': '' } : {})}
      onClick={detail ? undefined : handleCardClick}
      className={cn(
        'group',
        detail
          ? 'px-4 pt-5 pb-3 cursor-default'
          : threadLine
            ? 'relative hover:bg-(--color-background-secondary)/60 transition-colors cursor-pointer'
            : 'border-b border-(--color-border-secondary) hover:bg-(--color-background-secondary)/60 transition-colors cursor-pointer',
      )}
    >
      {/* Thread connector — runs from the avatar centre down to the bottom edge, behind the avatar */}
      {threadLine && (
        <div
          aria-hidden
          className="absolute w-0.5 bg-(--color-border-secondary) pointer-events-none z-0"
          style={{ left: '35px', top: '34px', bottom: 0 }}
        />
      )}
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
        <Link href={`/${handle}`} className={cn('flex-shrink-0', threadLine && 'relative z-[1]')} onClick={(e) => e.stopPropagation()}>
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
          <div className={cn('flex items-start gap-1.5', detail ? 'mb-3' : 'mb-0.5')}>
            {/* Name + handle — layout differs by mode */}
            <div className="flex-1 min-w-0">
              {detail ? (
                <>
                  <Link
                    href={`/${handle}`}
                    onClick={(e) => e.stopPropagation()}
                    className="text-[17px] font-bold text-(--color-text-primary) hover:underline block leading-tight truncate"
                    style={{ fontFamily: 'var(--font-display)' }}
                  >
                    {displayName}
                  </Link>
                  <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
                    <span className="text-sm text-(--color-text-tertiary)">@{handle}</span>
                    {post.author && !post.author.isLocal && (
                      <span title="Federe kullanıcı" className="text-(--color-teal)"><Globe className="w-3 h-3" /></span>
                    )}
                    {post.visibility !== 'public' && (
                      <span className="text-(--color-text-tertiary)" title={post.visibility}>
                        {post.visibility === 'unlisted' && <Eye className="w-3 h-3" />}
                        {post.visibility === 'followers' && <Users className="w-3 h-3" />}
                        {post.visibility === 'close_friends' && <span title="Yakın Çevre"><UserCheck className="w-3.5 h-3.5 text-emerald-500" /></span>}
                        {post.visibility === 'direct' && <Lock className="w-3 h-3" />}
                      </span>
                    )}
                    {editedAt && (
                      <button onClick={openEditHistory} title={`Düzenlendi: ${new Date(editedAt).toLocaleString('tr-TR')}`}
                        className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md text-[11px] font-medium text-(--color-text-tertiary) bg-(--color-background-secondary) hover:text-(--color-coral) hover:bg-(--color-coral)/8 border border-(--color-border-secondary) hover:border-(--color-coral)/20 transition-all"
                      >
                        <Pencil className="w-2.5 h-2.5" />düzenlendi
                      </button>
                    )}
                  </div>
                </>
              ) : (
                <div className="flex items-center gap-1.5">
                  <Link
                    href={`/${handle}`}
                    onClick={(e) => e.stopPropagation()}
                    className="font-medium text-sm text-(--color-text-primary) hover:underline truncate"
                    style={{ fontFamily: 'var(--font-display)' }}
                  >
                    {displayName}
                  </Link>
                  <span className="text-xs text-(--color-text-tertiary) truncate">@{handle}</span>
                  {post.author && !post.author.isLocal && (
                    <span title="Federe kullanıcı" className="flex-shrink-0 text-(--color-teal)"><Globe className="w-3 h-3" /></span>
                  )}
                  <span className="text-xs text-(--color-text-tertiary)">·</span>
                  <Link href={`/posts/${post.id}`} onClick={(e) => e.stopPropagation()}
                    className="text-xs text-(--color-text-tertiary) flex-shrink-0 hover:underline"
                  >
                    {formatRelativeTime(post.createdAt)}
                  </Link>
                  {editedAt && (
                    <button onClick={openEditHistory} title={`Düzenlendi: ${new Date(editedAt).toLocaleString('tr-TR')}`}
                      className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md text-[11px] font-medium text-(--color-text-tertiary) bg-(--color-background-secondary) hover:text-(--color-coral) hover:bg-(--color-coral)/8 border border-(--color-border-secondary) hover:border-(--color-coral)/20 transition-all flex-shrink-0"
                    >
                      <Pencil className="w-2.5 h-2.5" />düzenlendi
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
                </div>
              )}
            </div>

            {/* Menus — shared between both modes, always at top-right */}
            {isOwn && !hideMenu && (
              <div className="relative flex-shrink-0" onClick={(e) => e.stopPropagation()}>
                <button
                  onClick={() => dispatch({ type: 'MENU_TOGGLE' })}
                  className={cn('p-1 rounded-full text-(--color-text-tertiary) hover:text-(--color-text-primary) hover:bg-(--color-background-secondary) transition-all', !detail && 'opacity-0 group-hover:opacity-100')}
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
                      {communityPin && (
                        <button
                          onClick={() => { dispatch({ type: 'MENU_CLOSE' }); void communityPin.onToggle() }}
                          className="w-full flex items-center gap-2 px-3.5 py-2 text-[13px] text-(--color-text-primary) hover:bg-(--color-background-secondary) transition-colors"
                        >
                          {communityPin.isPinned
                            ? <><PinOff className="w-3.5 h-3.5 text-(--color-text-tertiary)" /> Sabitlemeyi Kaldır</>
                            : <><Pin className="w-3.5 h-3.5 text-(--color-text-tertiary)" /> Topluluğa Sabitle</>}
                        </button>
                      )}
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
                            onClick={() => { dispatch({ type: 'MENU_CLOSE' }); setDeleteConfirmOpen(true) }}
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
            {!isOwn && currentActorHandle && !hideMenu && (
              <div className="relative flex-shrink-0" onClick={(e) => e.stopPropagation()}>
                <button
                  onClick={() => dispatch({ type: 'MENU_TOGGLE' })}
                  className={cn('p-1 rounded-full text-(--color-text-tertiary) hover:text-(--color-text-primary) hover:bg-(--color-background-secondary) transition-all', !detail && 'opacity-0 group-hover:opacity-100')}
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
                      {post.author && !post.author.isLocal && (post.apUrl || post.apId) && (
                        <a
                          href={post.apUrl || post.apId}
                          target="_blank"
                          rel="noopener noreferrer"
                          onClick={() => dispatch({ type: 'MENU_CLOSE' })}
                          className="w-full flex items-center gap-2 px-3.5 py-2 text-[13px] text-(--color-text-primary) hover:bg-(--color-background-secondary) transition-colors"
                        >
                          <Globe className="w-3.5 h-3.5 text-(--color-text-tertiary)" /> Orijinalinde Gör
                        </a>
                      )}
                      {communityPin && (
                        <>
                          <div className="my-1 border-t border-(--color-border-secondary)" />
                          <button
                            onClick={() => { dispatch({ type: 'MENU_CLOSE' }); void communityPin.onToggle() }}
                            className="w-full flex items-center gap-2 px-3.5 py-2 text-[13px] text-(--color-text-primary) hover:bg-(--color-background-secondary) transition-colors"
                          >
                            {communityPin.isPinned
                              ? <><PinOff className="w-3.5 h-3.5 text-(--color-text-tertiary)" /> Sabitlemeyi Kaldır</>
                              : <><Pin className="w-3.5 h-3.5 text-(--color-text-tertiary)" /> Topluluğa Sabitle</>}
                          </button>
                        </>
                      )}
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
              <AlertTriangle className="w-3 h-3 flex-shrink-0" />
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
                    onChange={(e) => {
                      dispatch({ type: 'EDIT_CONTENT', text: e.target.value })
                      e.target.style.height = 'auto'
                      e.target.style.height = `${e.target.scrollHeight}px`
                    }}
                    ref={(el) => { if (el) { el.style.height = 'auto'; el.style.height = `${el.scrollHeight}px` } }}
                    rows={3}
                    maxLength={500}
                    className="w-full resize-none rounded-lg border border-(--color-coral) bg-(--color-background) px-3 py-2 text-sm text-(--color-text-primary) focus:outline-none transition-colors overflow-hidden"
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
                        <option value="close_friends">Yakın arkadaşlar</option>
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
                  <div className={cn(detail ? 'text-base' : 'text-sm', 'text-(--color-text-primary) leading-relaxed whitespace-pre-wrap break-words', isNsfwBlurred && !nsfwRevealed && 'blur-sm pointer-events-none')}>
                    {renderRichContent(
                      post.isLocal === false
                        ? htmlToText(currentContent)
                        : post.linkPreview
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
                    {post.media.map((m, idx) => {
                      const isVideo = m.mimeType?.startsWith('video/')
                      if (isVideo) {
                        return (
                          <div
                            key={m.id}
                            className={cn('relative bg-black overflow-hidden', post.media.length > 1 && 'aspect-square')}
                            onClick={(e) => e.stopPropagation()}
                          >
                            {isNsfwBlurred && !nsfwRevealed ? (
                              <div className="aspect-video flex items-center justify-center bg-black/50">
                                <Play className="w-8 h-8 text-white/40" />
                              </div>
                            ) : (
                              <InlineVideoPlayer
                                url={m.url}
                                previewUrl={m.previewUrl}
                                altText={m.altText}
                                square={post.media.length > 1}
                              />
                            )}
                          </div>
                        )
                      }
                      return (
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
                      )
                    })}
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

            {/* Flair pill */}
            {post.flair && (
              <div className="mt-2">
                <span className={cn(
                  'inline-flex items-center gap-1 text-[11px] font-semibold px-2 py-0.5 rounded-full border',
                  FLAIR_COLORS[post.flair.color] ?? FLAIR_COLORS.coral,
                )}>
                  {post.flair.emoji && <span>{post.flair.emoji}</span>}
                  {post.flair.name}
                </span>
              </div>
            )}

            {/* Template data card */}
            {!editOpen && post.templateData && Object.keys(post.templateData).filter((k) => k !== '_templateId').length > 0 && (
              <div className="mt-2.5 rounded-xl border border-(--color-border) bg-(--color-background-secondary) overflow-hidden">
                <div className="px-3 py-2 border-b border-(--color-border-secondary) flex items-center gap-1.5">
                  <LayoutTemplate className="w-3 h-3 text-(--color-coral)" />
                  <span className="text-[11px] font-semibold text-(--color-text-tertiary) uppercase tracking-wide">Şablonlu Gönderi</span>
                </div>
                <div className="px-3 py-2.5 space-y-2">
                  {Object.entries(post.templateData)
                    .filter(([k]) => k !== '_templateId')
                    .map(([key, value]) => (
                      <div key={key}>
                        <span className="text-[10px] font-semibold text-(--color-text-tertiary) uppercase tracking-wide block mb-0.5">
                          {key.replace(/_/g, ' ')}
                        </span>
                        <span className="text-[13px] text-(--color-text-primary) leading-relaxed whitespace-pre-wrap">{value}</span>
                      </div>
                    ))}
                </div>
              </div>
            )}

            {/* Link preview */}
            {!editOpen && post.linkPreview && !post.media?.length && (() => {
              const lp = post.linkPreview
              const rawPlatform = lp.musicPlatform ?? detectPlatformFromUrl(lp.url)
              // 'youtube' was previously mis-tagged as music; treat it as video
              const isMusicCard = !!rawPlatform && rawPlatform !== 'youtube'
              const ytId = !isMusicCard ? extractYouTubeId(lp.url) : null
              const videoEmbed = !isMusicCard && !ytId ? detectVideoEmbed(lp.url) : null

              if (isMusicCard) return (
                <MusicCard preview={{ ...lp, musicPlatform: rawPlatform ?? undefined }} />
              )
              if (ytId) return (
                <YouTubeCard preview={lp} videoId={ytId} />
              )
              if (videoEmbed) return (
                <VideoEmbedCard preview={lp} platform={videoEmbed.platform} embedUrl={videoEmbed.embedUrl} />
              )
              return (
                  <a
                    href={lp.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    onClick={(e) => e.stopPropagation()}
                    className="mt-2.5 block rounded-xl border border-(--color-border) overflow-hidden hover:border-(--color-coral)/40 transition-colors group/preview"
                  >
                    {lp.image && (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={lp.image}
                        alt=""
                        className="w-full max-h-48 object-cover bg-(--color-background-secondary)"
                        loading="lazy"
                      />
                    )}
                    <div className="px-3 py-2.5">
                      {lp.siteName && (
                        <p className="text-[11px] text-(--color-text-tertiary) mb-0.5 uppercase tracking-wide">
                          {lp.siteName}
                        </p>
                      )}
                      {lp.title && (
                        <p className="text-sm font-medium text-(--color-text-primary) line-clamp-2 group-hover/preview:text-(--color-coral) transition-colors">
                          {lp.title}
                        </p>
                      )}
                      {lp.description && (
                        <p className="text-xs text-(--color-text-tertiary) mt-0.5 line-clamp-2">
                          {lp.description}
                        </p>
                      )}
                      <p className="text-[11px] text-(--color-text-tertiary) mt-1.5 truncate">
                        {lp.url}
                      </p>
                    </div>
                  </a>
              )
            })()}
            {/* Location — mini map card when coords exist, else a simple chip */}
            {post.locationName && (
              <LocationCard name={post.locationName} lat={post.locationLat} lng={post.locationLng} />
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
                        disabled={(poll.expired && !poll.voted) || (showResults && !poll.voted) || voting}
                        onClick={(e) => { e.stopPropagation(); void votePoll(opt.id) }}
                        className={cn(
                          'relative w-full rounded-lg px-3 py-2 text-left text-sm transition-all overflow-hidden',
                          poll.expired
                            ? 'cursor-default'
                            : showResults && isVoted
                              ? 'cursor-pointer hover:bg-(--color-coral)/5 active:scale-[0.99]'
                              : showResults
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
                  {poll.voted && !poll.expired && (
                    <>
                      <span>·</span>
                      <span className="text-(--color-text-tertiary)/70">Oyladığına tıkla → geri al</span>
                    </>
                  )}
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

          {/* Detail mode: timestamp + stats row */}
          {detail && !hideActions && (
            <>
              <div className="mt-3 pt-3 border-t border-(--color-border-secondary)">
                <span className="text-sm text-(--color-text-tertiary)">
                  {new Date(post.createdAt).toLocaleString('tr-TR', { day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
                </span>
              </div>
              {(likesCount > 0 || boostsCount > 0) && (
                <div className="py-3 border-t border-(--color-border-secondary) flex gap-4 text-sm">
                  {boostsCount > 0 && (
                    <span className="text-(--color-text-secondary)">
                      <strong className="text-(--color-text-primary)">{boostsCount}</strong> yeniden paylaşım
                    </span>
                  )}
                  {likesCount > 0 && (
                    <span className="text-(--color-text-secondary)">
                      <strong className="text-(--color-text-primary)">{likesCount}</strong> beğeni
                    </span>
                  )}
                </div>
              )}
              <div className="border-t border-(--color-border-secondary)" />
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

          {!hideActions && <div className={cn('flex items-center gap-1', detail ? 'mt-1 justify-around' : 'mt-2 -ml-2')}>
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
            <div className="relative flex items-center gap-0.5">
              <Tooltip>
                <TooltipTrigger asChild>
                  <button
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
                </TooltipTrigger>
                <TooltipContent>{boosted ? 'Yeniden paylaşımı geri al' : 'Yeniden paylaş'}</TooltipContent>
              </Tooltip>
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
              <Tooltip>
              <TooltipTrigger asChild>
              <button
                aria-label={liked ? 'Beğeniyi kaldır' : 'Beğen'}
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
              </TooltipTrigger>
              <TooltipContent>{liked ? 'Beğeniyi kaldır' : 'Beğen · Uzun basınca tepki ekle'}</TooltipContent>
              </Tooltip>
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
              <Tooltip>
                <TooltipTrigger asChild>
                  <button
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
                </TooltipTrigger>
                <TooltipContent>{translation ? 'Çeviriyi kapat' : 'Çevir'}</TooltipContent>
              </Tooltip>
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
                  {replyContent.length > 450 && `${500 - replyContent.length}`}
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
                className="w-full resize-none rounded-lg border border-(--color-border-secondary) bg-(--color-background) px-3 py-2 text-sm text-(--color-text-primary) placeholder:text-(--color-text-tertiary) focus:outline-none focus:border-(--color-coral) transition-colors"
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
                <div className="flex items-center gap-1.5 mb-1.5">
                  <span className="text-[11px] font-semibold text-(--color-coral)">Güncel versiyon</span>
                  {editedAt && (
                    <span className="text-[10px] text-(--color-text-tertiary)">{new Date(editedAt).toLocaleString('tr-TR')}</span>
                  )}
                </div>
                <p className="text-sm text-(--color-text-primary) whitespace-pre-wrap break-words">{currentContent}</p>
              </div>
              {editHistoryLoading && (
                <div className="flex justify-center py-6">
                  <Loader2 className="w-5 h-5 animate-spin text-(--color-coral)" />
                </div>
              )}
              {editHistory?.map((edit, i) => {
                const newerText = i === 0 ? currentContent : editHistory[i - 1].content
                return (
                  <div key={edit.id} className="px-4 py-3">
                    <div className="flex items-center gap-1.5 mb-1.5">
                      <span className="text-[11px] font-medium text-(--color-text-tertiary)">
                        {i === (editHistory.length - 1) ? 'İlk versiyon' : `${i + 1}. önceki versiyon`}
                      </span>
                      <span className="text-[10px] text-(--color-text-tertiary)">{new Date(edit.editedAt).toLocaleString('tr-TR')}</span>
                    </div>
                    {edit.contentWarning && (
                      <p className="text-[11px] text-amber-500 mb-1">CW: {edit.contentWarning}</p>
                    )}
                    <DiffView oldText={edit.content} newText={newerText} />
                    <div className="flex items-center gap-3 mt-2">
                      <span className="flex items-center gap-1 text-[10px] text-emerald-600 dark:text-emerald-400"><span className="w-2 h-2 rounded-sm bg-emerald-500/20 inline-block" />eklenen</span>
                      <span className="flex items-center gap-1 text-[10px] text-red-500"><span className="w-2 h-2 rounded-sm bg-red-500/20 inline-block" />silinen</span>
                    </div>
                  </div>
                )
              })}
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
    {/* Delete confirmation */}
    <AlertDialog open={deleteConfirmOpen} onOpenChange={setDeleteConfirmOpen}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Gönderiyi sil</AlertDialogTitle>
          <AlertDialogDescription>
            Bu gönderi kalıcı olarak silinecek. Bu işlem geri alınamaz.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Vazgeç</AlertDialogCancel>
          <AlertDialogAction onClick={() => onDelete!(post.id)}>
            Sil
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>

    </Fragment>
  )
}

export const PostCard = memo(PostCardImpl)

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
    <Tooltip>
      <TooltipTrigger asChild>
        <button
          onClick={onClick}
          aria-label={label}
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
      </TooltipTrigger>
      <TooltipContent>{label}</TooltipContent>
    </Tooltip>
  )
}
