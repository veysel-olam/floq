'use client'

import { useState, useRef, useEffect } from 'react'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Button } from '@/components/ui/button'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { api, type Actor, type Post, type MediaAttachment, type QuotedPost, type GifResult, type PostTemplate } from '@/lib/api'
import { Image, X, Loader2, AlertTriangle, Globe, Lock, Users, Eye, BarChart2, Plus, Trash2, UserCheck, Clock, Code2, FileEdit, MapPin, Check, LayoutTemplate, Tag, Video } from 'lucide-react'
import { cn } from '@/lib/utils'
import { GifPicker } from './gif-picker'
import { toast } from 'sonner'
import { triggerHaptic } from '@/hooks/use-haptics'

const MAX_CHARS = 500
const MAX_IMAGES = 4

const EMOJI_NAMES: [string, string][] = [
  ['smile', '😊'], ['grin', '😁'], ['laugh', '😂'], ['rofl', '🤣'], ['heart_eyes', '😍'],
  ['love', '🥰'], ['wink', '😉'], ['sunglasses', '😎'], ['think', '🤔'], ['eyes', '👀'],
  ['cry', '😢'], ['sob', '😭'], ['fire', '🔥'], ['heart', '❤️'], ['100', '💯'],
  ['party', '🎉'], ['clap', '👏'], ['wave', '👋'], ['thumbsup', '👍'], ['thumbsdown', '👎'],
  ['pray', '🙏'], ['muscle', '💪'], ['rocket', '🚀'], ['star', '⭐'], ['check', '✅'],
  ['x', '❌'], ['tada', '🎊'], ['sparkles', '✨'], ['boom', '💥'], ['ok', '👌'],
]

type Visibility = 'public' | 'unlisted' | 'followers' | 'close_friends' | 'direct'

type ThreadItem = {
  id: string
  content: string
  media: MediaAttachment[]
  uploading: boolean
}

const VISIBILITY_OPTIONS: { value: Visibility; icon: React.ReactNode; label: string; desc: string }[] = [
  { value: 'public', icon: <Globe className="w-3.5 h-3.5" />, label: 'Herkese Açık', desc: 'Keşfet ve zaman tünelinde görünür' },
  { value: 'unlisted', icon: <Eye className="w-3.5 h-3.5" />, label: 'Listelenmemiş', desc: 'Bağlantıyla görünür, keşfette yok' },
  { value: 'followers', icon: <Users className="w-3.5 h-3.5" />, label: 'Takipçiler', desc: 'Yalnızca takipçilerin görebilir' },
  { value: 'close_friends', icon: <UserCheck className="w-3.5 h-3.5" />, label: 'Yakın Çevre', desc: 'Yalnızca yakın çevren görebilir' },
  { value: 'direct', icon: <Lock className="w-3.5 h-3.5" />, label: 'Özel', desc: 'Yalnızca bahsedilenler görebilir' },
]

interface PostComposerProps {
  handle: string
  displayName: string
  avatarUrl?: string | null
  onPost: (post: Post) => void
  replyToId?: string
  quotedPost?: QuotedPost | null
  defaultGroupHandle?: string // topluluk sayfasından geldiğinde pre-set
  communityTemplates?: PostTemplate[]
  communityFlairs?: import('@/lib/api').CommunityFlair[]
}

const DRAFT_KEY = (replyToId?: string) => `floq:draft:${replyToId ?? 'home'}`

function CharRing({ chars, max }: { chars: number; max: number }) {
  const r = 9
  const circumference = 2 * Math.PI * r
  const pct = Math.min(chars / max, 1.05)
  const offset = circumference * (1 - Math.min(pct, 1))
  const remaining = max - chars
  const warn = remaining < 50
  const danger = remaining < 0
  const color = danger ? '#ef4444' : warn ? '#f59e0b' : 'var(--color-coral)'
  return (
    <svg width={22} height={22} viewBox="0 0 22 22" style={{ transform: 'rotate(-90deg)' }}>
      <circle cx={11} cy={11} r={r} fill="none" stroke="var(--color-border)" strokeWidth={2.5} />
      <circle
        cx={11} cy={11} r={r} fill="none"
        stroke={color}
        strokeWidth={2.5}
        strokeDasharray={circumference}
        strokeDashoffset={offset}
        strokeLinecap="round"
        style={{ transition: 'stroke-dashoffset 0.1s, stroke 0.2s' }}
      />
      {warn && (
        <text
          x={11} y={11}
          textAnchor="middle"
          dominantBaseline="central"
          style={{ transform: 'rotate(90deg)', transformOrigin: '11px 11px', fontSize: '6px', fontWeight: 700, fill: color }}
        >
          {Math.abs(remaining)}
        </text>
      )}
    </svg>
  )
}

interface ThreadItemComposerProps {
  item: ThreadItem
  avatarUrl?: string | null
  displayName: string
  onContentChange: (content: string) => void
  onFilesChange: (files: FileList | null) => void
  onRemoveMedia: (mediaId: string) => void
  onRemove: () => void
  isLast: boolean
}

function ThreadItemComposer({ item, avatarUrl, displayName, onContentChange, onFilesChange, onRemoveMedia, onRemove, isLast }: ThreadItemComposerProps) {
  const fileInputRef = useRef<HTMLInputElement>(null)
  const initials = displayName.slice(0, 2).toUpperCase()
  const warn = MAX_CHARS - item.content.length < 50

  return (
    <div className="flex gap-3 relative">
      <div className="absolute left-[19px] top-0 w-px h-3 bg-(--color-border-secondary)" />
      <div className="flex flex-col items-center flex-shrink-0">
        <Avatar className="w-8 h-8 mt-3">
          {avatarUrl && <AvatarImage src={avatarUrl} alt={displayName} />}
          <AvatarFallback className="text-[10px] font-medium text-white" style={{ background: 'var(--gradient-avatar)' }}>
            {initials}
          </AvatarFallback>
        </Avatar>
        {!isLast && <div className="w-px flex-1 mt-1 bg-(--color-border-secondary)" />}
      </div>

      <div className="flex-1 min-w-0 pt-3 pb-2">
        <textarea
          value={item.content}
          onChange={(e) => onContentChange(e.target.value)}
          placeholder="Devam…"
          rows={2}
          className="w-full resize-none border-0 bg-transparent p-0 min-h-[3rem] text-sm text-(--color-text-primary) placeholder:text-(--color-text-tertiary) focus:outline-none"
        />

        {item.media.length > 0 && (
          <div className={cn('grid gap-1.5 mt-2', item.media.length === 1 ? 'grid-cols-1' : 'grid-cols-2')}>
            {item.media.map((m) => (
              <div key={m.id} className="relative rounded-xl overflow-hidden bg-(--color-background-secondary)">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={m.url} alt={m.altText ?? ''} className="w-full aspect-video object-cover" />
                <button
                  onClick={() => onRemoveMedia(m.id)}
                  className="absolute top-1 right-1 w-5 h-5 rounded-full bg-black/60 flex items-center justify-center text-white hover:bg-black/80"
                >
                  <X className="w-3 h-3" />
                </button>
              </div>
            ))}
          </div>
        )}

        <div className="flex items-center gap-1 mt-1.5">
          <input
            ref={fileInputRef}
            type="file"
            accept="image/jpeg,image/png,image/gif,image/webp"
            multiple
            className="hidden"
            onChange={(e) => onFilesChange(e.target.files)}
          />
          <button
            onClick={() => fileInputRef.current?.click()}
            disabled={item.uploading || item.media.length >= MAX_IMAGES}
            className="p-1 rounded-lg text-(--color-text-tertiary) hover:text-(--color-coral) hover:bg-(--color-blush) dark:hover:bg-(--color-coral)/12 transition-colors disabled:opacity-40"
            aria-label="Görsel ekle"
          >
            {item.uploading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Image className="w-3.5 h-3.5" />}
          </button>
          <div className="flex-1" />
          {warn && <CharRing chars={item.content.length} max={MAX_CHARS} />}
          <button
            onClick={onRemove}
            className="p-1 rounded-lg text-(--color-text-tertiary) hover:text-red-500 hover:bg-red-500/10 transition-colors"
            aria-label="Bu gönderiyi kaldır"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    </div>
  )
}

export function PostComposer({ handle, displayName, avatarUrl, onPost, replyToId, quotedPost, defaultGroupHandle, communityTemplates, communityFlairs }: PostComposerProps) {
  const draftKey = DRAFT_KEY(replyToId)

  const [content, setContent] = useState(() => {
    try { return JSON.parse(localStorage.getItem(draftKey) ?? 'null')?.content ?? '' } catch { return '' }
  })
  const [cw, setCw] = useState(() => {
    try { return JSON.parse(localStorage.getItem(draftKey) ?? 'null')?.cw ?? '' } catch { return '' }
  })
  const [cwOpen, setCwOpen] = useState(() => {
    try { return !!(JSON.parse(localStorage.getItem(draftKey) ?? 'null')?.cw) } catch { return false }
  })
  const [draftRestored, setDraftRestored] = useState(() => {
    try { const d = JSON.parse(localStorage.getItem(DRAFT_KEY(replyToId)) ?? 'null'); return !!(d?.content || d?.cw) } catch { return false }
  })
  const [postError, setPostError] = useState<string | null>(null)
  const [visibility, setVisibility] = useState<Visibility>('public')
  const [visibilityOpen, setVisibilityOpen] = useState(false)
  const [posting, setPosting] = useState(false)
  const [media, setMedia] = useState<MediaAttachment[]>([])
  const [uploading, setUploading] = useState(false)
  const [uploadError, setUploadError] = useState<string | null>(null)
  const [altEditId, setAltEditId] = useState<string | null>(null)
  const [altDraft, setAltDraft] = useState('')
  const [draftSavedAt, setDraftSavedAt] = useState<number | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const videoFileInputRef = useRef<HTMLInputElement>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  // Template state
  const [selectedTemplate, setSelectedTemplate] = useState<PostTemplate | null>(null)
  const [templateValues, setTemplateValues] = useState<Record<string, string>>({})
  const [selectedFlair, setSelectedFlair] = useState<import('@/lib/api').CommunityFlair | null>(null)
  const [flairOpen, setFlairOpen] = useState(false)
  const [templatePickerOpen, setTemplatePickerOpen] = useState(false)

  // Autocomplete state
  const [acContext, setAcContext] = useState<{ type: 'mention' | 'hashtag' | 'emoji'; query: string; triggerIdx: number } | null>(null)
  const [mentionResults, setMentionResults] = useState<Actor[]>([])
  const [trendingTags, setTrendingTags] = useState<{ tag: string; count: number }[]>([])
  const [acSelectedIdx, setAcSelectedIdx] = useState(0)

  // Link preview state
  const [linkPreview, setLinkPreview] = useState<{ url: string; title: string | null; description: string | null; image: string | null; siteName: string | null } | null>(null)
  const [linkPreviewLoading, setLinkPreviewLoading] = useState(false)
  const [linkPreviewDismissed, setLinkPreviewDismissed] = useState<string | null>(null)

  // Spoiler prompt state
  const [spoilerPromptUrl, setSpoilerPromptUrl] = useState<string | null>(null)

  const FILM_DOMAINS = ['imdb.com', 'letterboxd.com', 'themoviedb.org', 'tmdb.org', 'rottentomatoes.com', 'trakt.tv', 'myanimelist.net', 'justwatch.com']
  function isFilmUrl(url: string) {
    try { return FILM_DOMAINS.some((d) => new URL(url).hostname.endsWith(d)) } catch { return false }
  }

  useEffect(() => {
    api.search.trendingTags().then((d) => setTrendingTags(d.tags)).catch(() => {})
  }, [])

  // Autosave draft with indicator
  useEffect(() => {
    const t = setTimeout(() => {
      try {
        if (content || cw) {
          localStorage.setItem(draftKey, JSON.stringify({ content, cw }))
          setDraftSavedAt(Date.now())
        } else {
          localStorage.removeItem(draftKey)
          setDraftSavedAt(null)
        }
      } catch {}
    }, 500)
    return () => clearTimeout(t)
  }, [content, cw, draftKey])

  // Cross-device sync (home composer only). Load server autosave once on mount —
  // a local draft on this device wins; otherwise pull what was typed elsewhere.
  const serverDraftLoaded = useRef(false)
  useEffect(() => {
    if (replyToId || serverDraftLoaded.current) return
    serverDraftLoaded.current = true
    api.composerDraft.get().then(({ draft }) => {
      if (!draft) return
      setContent((c: string) => (c.trim() ? c : draft.content))
      if (draft.contentWarning) { setCw((w: string) => w || draft.contentWarning!); setCwOpen(true) }
    }).catch(() => {})
  }, [replyToId])

  // Push autosave to the server (debounced); empty content clears it server-side.
  useEffect(() => {
    if (replyToId || !serverDraftLoaded.current) return
    const t = setTimeout(() => {
      void api.composerDraft.save(content, cwOpen && cw ? cw : null).catch(() => {})
    }, 2000)
    return () => clearTimeout(t)
  }, [content, cw, cwOpen, replyToId])

  // Auto-grow textarea
  function autoGrow(el: HTMLTextAreaElement | null) {
    if (!el) return
    el.style.height = 'auto'
    el.style.height = `${Math.max(el.scrollHeight, 72)}px`
  }

  useEffect(() => {
    if (acContext?.type !== 'mention' || !acContext.query) {
      setMentionResults([])
      return
    }
    const t = setTimeout(() => {
      api.search.query(acContext.query, 'actors')
        .then((d) => setMentionResults((d.actors ?? []).slice(0, 6)))
        .catch(() => {})
    }, 200)
    return () => clearTimeout(t)
  }, [acContext])

  // Debounced link preview detection
  useEffect(() => {
    const urlMatch = content.match(/https?:\/\/[^\s<>"{}|\\^`[\]]+/)
    const url = urlMatch ? urlMatch[0].replace(/[.,!?)]+$/, '') : null

    if (!url || url === linkPreviewDismissed) {
      if (!url) { setLinkPreview(null); setLinkPreviewLoading(false) }
      return
    }
    if (linkPreview?.url === url) return

    setLinkPreviewLoading(true)
    const t = setTimeout(() => {
      api.linkPreview(url)
        .then((p) => {
          setLinkPreview(p)
          setLinkPreviewLoading(false)
          if (isFilmUrl(url) && !cwOpen) setSpoilerPromptUrl(url)
        })
        .catch(() => { setLinkPreview(null); setLinkPreviewLoading(false) })
    }, 600)
    return () => clearTimeout(t)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [content])

  // Poll state
  const [pollOpen, setPollOpen] = useState(false)
  const [pollOptions, setPollOptions] = useState(['', ''])
  const [pollDuration, setPollDuration] = useState(24)
  const [pollMultiple, setPollMultiple] = useState(false)

  // GIF picker state
  const [gifPickerOpen, setGifPickerOpen] = useState(false)

  // Thread state
  const [threadItems, setThreadItems] = useState<ThreadItem[]>([])

  function addThreadItem() {
    setThreadItems((prev) => [...prev, { id: crypto.randomUUID(), content: '', media: [], uploading: false }])
  }

  function removeThreadItem(id: string) {
    setThreadItems((prev) => prev.filter((item) => item.id !== id))
  }

  function updateThreadItemContent(id: string, newContent: string) {
    setThreadItems((prev) => prev.map((item) => item.id === id ? { ...item, content: newContent } : item))
  }

  function removeThreadItemMedia(itemId: string, mediaId: string) {
    setThreadItems((prev) => prev.map((item) => item.id === itemId ? { ...item, media: item.media.filter((m) => m.id !== mediaId) } : item))
  }

  async function handleThreadItemFiles(id: string, files: FileList | null) {
    if (!files) return
    const item = threadItems.find((i) => i.id === id)
    if (!item) return
    const toUpload = Array.from(files).slice(0, MAX_IMAGES - item.media.length)
    if (!toUpload.length) return
    setThreadItems((prev) => prev.map((i) => i.id === id ? { ...i, uploading: true } : i))
    try {
      const uploaded = await Promise.all(toUpload.map((f) => api.media.upload(f)))
      setThreadItems((prev) => prev.map((i) => i.id === id ? { ...i, media: [...i.media, ...uploaded], uploading: false } : i))
    } catch {
      setThreadItems((prev) => prev.map((i) => i.id === id ? { ...i, uploading: false } : i))
    }
  }

  // Schedule state
  const [scheduledAt, setScheduledAt] = useState<string>('')
  const [scheduleOpen, setScheduleOpen] = useState(false)
  const [extrasOpen, setExtrasOpen] = useState(false)
  const extrasButtonRef = useRef<HTMLButtonElement>(null)
  const [focused, setFocused] = useState(false)

  // Community / group state
  const [selectedGroupHandle, setSelectedGroupHandle] = useState<string | null>(defaultGroupHandle ?? null)
  const [groupPickerOpen, setGroupPickerOpen] = useState(false)
  const [joinedCommunities, setJoinedCommunities] = useState<{ handle: string; name: string }[]>([])
  const [communitiesLoaded, setCommunitiesLoaded] = useState(false)

  async function openGroupPicker() {
    setGroupPickerOpen(true)
    if (!communitiesLoaded) {
      try {
        const data = await api.communities.list({ filter: 'joined', limit: 40 })
        setJoinedCommunities(data.communities.map((c) => ({ handle: c.handle, name: c.name })))
      } catch { /* ignore */ }
      setCommunitiesLoaded(true)
    }
  }

  // Location state
  const [locationName, setLocationName] = useState<string | null>(null)
  const [locationLat, setLocationLat] = useState<number | null>(null)
  const [locationLng, setLocationLng] = useState<number | null>(null)
  const [locationLoading, setLocationLoading] = useState(false)
  const [locationPickerOpen, setLocationPickerOpen] = useState(false)
  const [locationDraft, setLocationDraft] = useState('')

  function openLocationPicker() {
    setLocationDraft(locationName ?? '')
    setLocationPickerOpen(true)
  }

  function applyLocation(name: string, lat?: number, lng?: number) {
    setLocationName(name.trim() || null)
    setLocationLat(lat ?? null)
    setLocationLng(lng ?? null)
    setLocationPickerOpen(false)
  }

  async function detectLocation() {
    if (!navigator.geolocation) return
    setLocationLoading(true)
    navigator.geolocation.getCurrentPosition(async (pos) => {
      const { latitude: lat, longitude: lng } = pos.coords
      try {
        const res = await fetch(`https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lng}&format=json&accept-language=tr`, {
          headers: { 'User-Agent': 'floq.social' },
        })
        const data = await res.json() as { address?: { city?: string; town?: string; village?: string; county?: string; state?: string; country?: string } }
        const addr = data.address ?? {}
        const name = addr.city ?? addr.town ?? addr.village ?? addr.county ?? addr.state ?? addr.country ?? `${lat.toFixed(2)}, ${lng.toFixed(2)}`
        applyLocation(name, lat, lng)
      } catch {
        applyLocation(`${lat.toFixed(2)}, ${lng.toFixed(2)}`, lat, lng)
      } finally {
        setLocationLoading(false)
      }
    }, () => { setLocationLoading(false) })
  }

  // Listen for compose focus event dispatched by sidebar button
  useEffect(() => {
    function handler() {
      setFocused(true)
      requestAnimationFrame(() => textareaRef.current?.focus())
    }
    window.addEventListener('floq:focus-composer', handler)
    return () => window.removeEventListener('floq:focus-composer', handler)
  }, [])

  // Re-run auto-grow when content is set programmatically (e.g. draft restore)
  useEffect(() => { autoGrow(textareaRef.current) }, [content])

  const acHashtagItems = acContext?.type === 'hashtag'
    ? trendingTags.filter((t) => t.tag.toLowerCase().startsWith(acContext.query.toLowerCase())).slice(0, 8)
    : []
  const acEmojiItems = acContext?.type === 'emoji'
    ? EMOJI_NAMES.filter(([name]) => name.includes(acContext.query.toLowerCase())).slice(0, 8).map(([name, emoji]) => ({ name, emoji }))
    : []
  const acItems: (Actor | { tag: string; count: number } | { name: string; emoji: string })[] =
    acContext?.type === 'mention' ? mentionResults
    : acContext?.type === 'hashtag' ? acHashtagItems
    : acEmojiItems

  function updateAcContext(text: string, cursorPos: number) {
    let i = cursorPos - 1
    while (i >= 0) {
      const ch = text[i]
      if (ch === ' ' || ch === '\n') { setAcContext(null); return }
      if (ch === '@' || ch === '#') {
        if (i === 0 || text[i - 1] === ' ' || text[i - 1] === '\n') {
          setAcContext({ type: ch === '@' ? 'mention' : 'hashtag', query: text.slice(i + 1, cursorPos), triggerIdx: i })
          setAcSelectedIdx(0)
        } else {
          setAcContext(null)
        }
        return
      }
      if (ch === ':') {
        const query = text.slice(i + 1, cursorPos)
        if (query.length >= 2 && /^[a-z0-9_]+$/.test(query)) {
          setAcContext({ type: 'emoji', query, triggerIdx: i })
          setAcSelectedIdx(0)
        } else {
          setAcContext(null)
        }
        return
      }
      i--
    }
    setAcContext(null)
  }

  function applyAutocomplete(item: Actor | { tag: string; count: number } | { name: string; emoji: string }) {
    if (!acContext) return
    const textarea = textareaRef.current
    const cursorPos = textarea?.selectionStart ?? content.length
    let replacement: string
    if (acContext.type === 'mention') replacement = `@${(item as Actor).handle}`
    else if (acContext.type === 'hashtag') replacement = `#${(item as { tag: string }).tag}`
    else replacement = (item as { emoji: string }).emoji
    const newContent = content.slice(0, acContext.triggerIdx) + replacement + ' ' + content.slice(cursorPos)
    setContent(newContent)
    setAcContext(null)
    setMentionResults([])
    const newPos = acContext.triggerIdx + replacement.length + 1
    requestAnimationFrame(() => {
      if (textarea) {
        textarea.focus()
        textarea.setSelectionRange(newPos, newPos)
      }
    })
  }

  function handleContentChange(e: React.ChangeEvent<HTMLTextAreaElement>) {
    const val = e.target.value
    setContent(val)
    updateAcContext(val, e.target.selectionStart ?? val.length)
    autoGrow(e.target)
  }

  function handlePaste(e: React.ClipboardEvent<HTMLTextAreaElement>) {
    const files = Array.from(e.clipboardData.files).filter((f) => f.type.startsWith('image/'))
    if (files.length === 0) return
    e.preventDefault()
    const fileList = e.clipboardData.files
    void handleFiles(fileList)
  }

  function insertCodeBlock() {
    const textarea = textareaRef.current
    const start = textarea?.selectionStart ?? content.length
    const end = textarea?.selectionEnd ?? content.length
    const selected = content.slice(start, end)
    const block = selected ? `\`\`\`\n${selected}\n\`\`\`` : `\`\`\`\n\n\`\`\``
    const newContent = content.slice(0, start) + block + content.slice(end)
    setContent(newContent)
    const cursorPos = selected ? start + block.length : start + 4
    requestAnimationFrame(() => {
      if (textarea) { textarea.focus(); textarea.setSelectionRange(cursorPos, cursorPos) }
    })
  }

  const remaining = MAX_CHARS - content.length
  const pollValid = !pollOpen || (pollOptions.filter((o) => o.trim()).length >= 2)
  const threadItemsValid = threadItems.every((item) => item.content.length <= MAX_CHARS)
  const canPost = (content.trim().length > 0 || media.length > 0 || !!quotedPost || pollOpen) && remaining >= 0 && !uploading && pollValid && threadItemsValid

  function togglePoll() {
    if (pollOpen) {
      setPollOpen(false)
      setPollOptions(['', ''])
      setPollDuration(24)
      setPollMultiple(false)
    } else {
      setMedia([])
      setGifPickerOpen(false)
      setPollOpen(true)
    }
  }

  async function handleGifSelect(gif: GifResult) {
    setGifPickerOpen(false)
    if (media.length >= MAX_IMAGES) return
    setUploading(true)
    try {
      const attachment = await api.gifs.attach(gif)
      setMedia((prev) => [...prev, attachment])
    } catch {
    } finally {
      setUploading(false)
    }
  }

  function updatePollOption(idx: number, val: string) {
    setPollOptions((prev) => prev.map((o, i) => (i === idx ? val : o)))
  }

  function addPollOption() {
    if (pollOptions.length < 4) setPollOptions((prev) => [...prev, ''])
  }

  function removePollOption(idx: number) {
    if (pollOptions.length <= 2) return
    setPollOptions((prev) => prev.filter((_, i) => i !== idx))
  }

  const currentVis = VISIBILITY_OPTIONS.find((v) => v.value === visibility)!

  async function handleFiles(files: FileList | null) {
    if (!files) return
    const toUpload = Array.from(files).slice(0, MAX_IMAGES - media.length)
    if (toUpload.length === 0) return
    setUploading(true)
    setUploadError(null)
    if (fileInputRef.current) fileInputRef.current.value = ''
    try {
      const uploaded = await Promise.all(toUpload.map((f) => api.media.upload(f)))
      setMedia((prev) => [...prev, ...uploaded])
    } catch (err) {
      setUploadError((err as Error).message ?? 'Görsel yüklenemedi.')
      setTimeout(() => setUploadError(null), 4000)
    } finally {
      setUploading(false)
    }
  }

  async function handleVideoFile(file: File) {
    setUploading(true)
    setUploadError(null)
    if (videoFileInputRef.current) videoFileInputRef.current.value = ''
    try {
      const attachment = await api.media.uploadVideo(file)
      setMedia([attachment])
    } catch (err) {
      setUploadError((err as Error).message ?? 'Video yüklenemedi.')
      setTimeout(() => setUploadError(null), 4000)
    } finally {
      setUploading(false)
    }
  }

  async function handlePost() {
    if (!canPost || posting) return
    setPosting(true)
    setPostError(null)
    try {
      const firstPost = await api.posts.create({
        content: content.trim(),
        contentWarning: cwOpen && cw.trim() ? cw.trim() : undefined,
        visibility,
        replyToId,
        quotedPostId: quotedPost?.id,
        mediaIds: media.map((m) => m.id),
        poll: pollOpen
          ? {
              options: pollOptions.map((o) => o.trim()).filter(Boolean),
              durationHours: pollDuration,
              multipleChoice: pollMultiple,
            }
          : undefined,
        scheduledAt: scheduledAt || undefined,
        locationName: locationName ?? undefined,
        locationLat: locationLat ?? undefined,
        locationLng: locationLng ?? undefined,
        groupHandle: selectedGroupHandle ?? undefined,
        templateData: selectedTemplate ? { _templateId: selectedTemplate.id, ...templateValues } : undefined,
        flairId: selectedFlair?.id,
      })

      if (threadItems.length > 0) {
        let parentId = firstPost.id
        for (const item of threadItems) {
          if (!item.content.trim() && item.media.length === 0) continue
          const reply = await api.posts.create({
            content: item.content.trim(),
            mediaIds: item.media.map((m) => m.id),
            replyToId: parentId,
            visibility,
          })
          parentId = reply.id
        }
      }

      setContent('')
      setCw('')
      setCwOpen(false)
      setVisibility('public')
      setMedia([])
      setGifPickerOpen(false)
      setPollOpen(false)
      setPollOptions(['', ''])
      setPollDuration(24)
      setPollMultiple(false)
      setLinkPreview(null)
      setLinkPreviewDismissed(null)
      setScheduledAt('')
      setScheduleOpen(false)
      setDraftRestored(false)
      setThreadItems([])
      setLocationName(null)
      setLocationLat(null)
      setLocationLng(null)
      setLocationPickerOpen(false)
      try { localStorage.removeItem(draftKey) } catch {}
      if (!replyToId) void api.composerDraft.clear().catch(() => {})
      void triggerHaptic('success')
      onPost(firstPost)
    } catch (err) {
      const msg = err instanceof Error ? err.message : null
      const errorMsg = msg ?? 'Gönderi paylaşılamadı. Tekrar dene.'
      setPostError(errorMsg)
      void triggerHaptic('error')
      toast.error(errorMsg)
    } finally {
      setPosting(false)
    }
  }

  async function saveDraft() {
    if (!content.trim() && media.length === 0) return
    setPosting(true)
    try {
      await api.posts.create({
        content: content.trim(),
        contentWarning: cwOpen && cw.trim() ? cw.trim() : undefined,
        visibility,
        mediaIds: media.map((m) => m.id),
        isDraft: true,
      })
      setContent('')
      setCw('')
      setCwOpen(false)
      setMedia([])
      try { localStorage.removeItem(draftKey) } catch {}
      toast.success('Taslak kaydedildi.')
    } catch {
      toast.error('Taslak kaydedilemedi.')
    } finally {
      setPosting(false)
    }
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (acContext && acItems.length > 0) {
      if (e.key === 'ArrowDown') { e.preventDefault(); setAcSelectedIdx((i) => Math.min(i + 1, acItems.length - 1)); return }
      if (e.key === 'ArrowUp') { e.preventDefault(); setAcSelectedIdx((i) => Math.max(i - 1, 0)); return }
      if (e.key === 'Tab' || e.key === 'Enter') { e.preventDefault(); applyAutocomplete(acItems[acSelectedIdx]); return }
      if (e.key === 'Escape') { e.preventDefault(); setAcContext(null); return }
    }
    if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) void handlePost()
  }

  function removeMedia(id: string) {
    setMedia((prev) => prev.filter((m) => m.id !== id))
  }

  function openAltEdit(m: MediaAttachment) {
    setAltEditId(m.id)
    setAltDraft(m.altText ?? '')
  }

  async function saveAlt(id: string) {
    const text = altDraft.trim()
    try {
      const updated = await api.media.updateAlt(id, text)
      setMedia((prev) => prev.map((m) => m.id === id ? { ...m, altText: updated.altText } : m))
    } catch {
      // silently ignore — alt text is non-critical
    }
    setAltEditId(null)
  }

  const initials = displayName.slice(0, 2).toUpperCase()
  const expanded = focused || content.length > 0 || media.length > 0 || cwOpen || pollOpen || !!locationName || !!scheduledAt
    || gifPickerOpen || visibilityOpen || groupPickerOpen || flairOpen || locationPickerOpen || extrasOpen
    || templatePickerOpen || !!selectedTemplate || !!selectedFlair

  return (
    <div className="border-b border-(--color-border-secondary)">

      {/* Composer card */}
      <div
        className="mx-4 my-3 rounded-2xl border bg-(--color-background)"
        style={{
          borderColor: expanded
            ? 'color-mix(in srgb, var(--color-coral) 40%, var(--color-border))'
            : 'var(--color-border)',
          boxShadow: expanded
            ? 'inset 0 2.5px 0 var(--color-coral), 0 0 0 4px color-mix(in srgb, var(--color-coral) 6%, transparent)'
            : 'none',
          transition: 'border-color 200ms ease, box-shadow 200ms ease',
        }}
      >

      {/* Main row */}
      <div
        className="flex items-start gap-3 px-4 pt-4 pb-3 cursor-text"
        onClick={(e) => {
          if ((e.target as HTMLElement).closest('button, input, textarea, select, a, [role="button"]')) return
          setFocused(true)
          requestAnimationFrame(() => textareaRef.current?.focus())
        }}
      >
        <Avatar className="w-10 h-10 flex-shrink-0 mt-0.5">
          {avatarUrl && <AvatarImage src={avatarUrl} alt={displayName} />}
          <AvatarFallback className="text-xs font-medium text-white" style={{ background: 'var(--gradient-avatar)' }}>
            {initials}
          </AvatarFallback>
        </Avatar>

        <div className="flex-1 min-w-0">
          {/* CW input — animated */}
          <div style={{ display: 'grid', gridTemplateRows: cwOpen ? '1fr' : '0fr', transition: 'grid-template-rows 180ms ease' }}>
            <div className="overflow-hidden">
              <input
                value={cw}
                onChange={(e) => setCw(e.target.value)}
                placeholder="İçerik uyarısı (isteğe bağlı)…"
                maxLength={500}
                className="w-full text-sm text-(--color-text-primary) placeholder:text-(--color-text-tertiary) bg-transparent border-0 border-b border-(--color-border-tertiary) pb-2 mb-2 focus:outline-none"
              />
            </div>
          </div>

          {draftRestored && !posting && !postError && (
            <p className="text-[10px] text-(--color-text-tertiary) mb-1">Taslak geri yüklendi</p>
          )}
          {postError && (
            <p className="text-[11px] text-red-500 mb-1 flex items-center gap-1"><AlertTriangle className="w-3 h-3 flex-shrink-0" />{postError}</p>
          )}

          {/* Selected flair preview */}
          {selectedFlair && (
            <div className="mb-2 flex items-center gap-1.5">
              <span className="text-xs text-(--color-text-tertiary)">Flair:</span>
              <span className="inline-flex items-center gap-1 text-[11px] font-semibold px-2 py-0.5 rounded-full border bg-red-50 text-red-600 border-red-200 dark:bg-red-950/30 dark:text-red-400 dark:border-red-900">
                {selectedFlair.emoji && <span>{selectedFlair.emoji}</span>}
                {selectedFlair.name}
              </span>
              <button onClick={() => setSelectedFlair(null)} className="text-(--color-text-tertiary) hover:text-red-500 transition-colors">
                <X className="w-3 h-3" />
              </button>
            </div>
          )}

          {/* Template picker */}
          {communityTemplates && communityTemplates.length > 0 && !replyToId && (
            <div className="mb-2">
              {!selectedTemplate ? (
                <div className={cn('transition-all', templatePickerOpen ? 'block' : 'hidden')}>
                  <p className="text-xs font-medium text-(--color-text-tertiary) mb-2">Şablon seç</p>
                  <div className="flex flex-wrap gap-2">
                    {communityTemplates.map((tpl) => (
                      <button
                        key={tpl.id}
                        onClick={() => { setSelectedTemplate(tpl); setTemplateValues({}); setTemplatePickerOpen(false) }}
                        className="flex items-center gap-1.5 text-[13px] px-3 py-1.5 rounded-full border border-(--color-border) bg-(--color-background-secondary) hover:border-(--color-coral) hover:text-(--color-coral) transition-colors font-medium"
                      >
                        <span>{tpl.icon}</span>
                        <span>{tpl.name}</span>
                      </button>
                    ))}
                  </div>
                </div>
              ) : (
                <div className="rounded-xl border border-(--color-coral)/30 bg-(--color-coral)/[0.04] p-3 space-y-2.5">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold text-(--color-coral) flex items-center gap-1.5">
                      <span>{selectedTemplate.icon}</span>
                      {selectedTemplate.name}
                    </span>
                    <button
                      onClick={() => { setSelectedTemplate(null); setTemplateValues({}) }}
                      className="text-xs text-(--color-text-tertiary) hover:text-(--color-text-primary) transition-colors"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>
                  {selectedTemplate.fields.map((field) => (
                    <div key={field.key}>
                      <label className="text-[11px] font-medium text-(--color-text-tertiary) block mb-1">
                        {field.label}{field.required && <span className="text-(--color-coral) ml-0.5">*</span>}
                      </label>
                      {field.type === 'textarea' ? (
                        <textarea
                          value={templateValues[field.key] ?? ''}
                          onChange={(e) => setTemplateValues((v) => ({ ...v, [field.key]: e.target.value }))}
                          placeholder={field.placeholder ?? ''}
                          rows={3}
                          className="w-full text-[13px] bg-(--color-background) border border-(--color-border) rounded-lg px-2.5 py-2 text-(--color-text-primary) placeholder:text-(--color-text-tertiary) resize-none focus:outline-none focus:ring-1 focus:ring-(--color-coral)"
                        />
                      ) : field.type === 'select' && field.options ? (
                        <select
                          value={templateValues[field.key] ?? ''}
                          onChange={(e) => setTemplateValues((v) => ({ ...v, [field.key]: e.target.value }))}
                          className="w-full text-[13px] bg-(--color-background) border border-(--color-border) rounded-lg px-2.5 py-2 text-(--color-text-primary) focus:outline-none focus:ring-1 focus:ring-(--color-coral)"
                        >
                          <option value="">Seç…</option>
                          {field.options.map((opt) => (
                            <option key={opt} value={opt}>{opt}</option>
                          ))}
                        </select>
                      ) : (
                        <input
                          type="text"
                          value={templateValues[field.key] ?? ''}
                          onChange={(e) => setTemplateValues((v) => ({ ...v, [field.key]: e.target.value }))}
                          placeholder={field.placeholder ?? ''}
                          className="w-full text-[13px] bg-(--color-background) border border-(--color-border) rounded-lg px-2.5 py-2 text-(--color-text-primary) placeholder:text-(--color-text-tertiary) focus:outline-none focus:ring-1 focus:ring-(--color-coral)"
                        />
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Textarea — always mounted, height transitions smoothly */}
          <div className="relative">
            <textarea
              ref={textareaRef}
              value={content}
              onChange={handleContentChange}
              onKeyDown={handleKeyDown}
              onPaste={handlePaste}
              onFocus={() => setFocused(true)}
              onBlur={() => setFocused(false)}
              placeholder="Ne düşünüyorsun?"
              rows={1}
              className={cn(
                'w-full resize-none overflow-hidden border-0 bg-transparent p-0 text-[15px] leading-relaxed text-(--color-text-primary) placeholder:text-(--color-text-tertiary) focus:outline-none',
                'transition-[min-height] duration-200 ease-in-out',
                expanded ? 'min-h-[5rem]' : 'min-h-[3rem]',
              )}
            />
            {acContext && acItems.length > 0 && (
              <div className="absolute left-0 top-full mt-1 w-72 max-h-56 overflow-y-auto rounded-xl border border-(--color-border) bg-(--color-background) shadow-lg z-30 py-1">
                {acContext.type === 'mention' && mentionResults.map((actor, idx) => (
                  <button
                    key={actor.handle}
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => applyAutocomplete(actor)}
                    className={cn(
                      'w-full flex items-center gap-2.5 px-3 py-2 text-left transition-colors hover:bg-(--color-background-secondary)',
                      idx === acSelectedIdx && 'bg-(--color-background-secondary)',
                    )}
                  >
                    <Avatar className="w-7 h-7 flex-shrink-0">
                      {actor.avatarUrl && <AvatarImage src={actor.avatarUrl} alt={actor.displayName ?? actor.handle} />}
                      <AvatarFallback className="text-[10px] text-white" style={{ background: 'var(--gradient-avatar)' }}>
                        {(actor.displayName ?? actor.handle).slice(0, 2).toUpperCase()}
                      </AvatarFallback>
                    </Avatar>
                    <div className="min-w-0">
                      <p className="text-xs font-medium text-(--color-text-primary) truncate">{actor.displayName ?? actor.handle}</p>
                      <p className="text-[10px] text-(--color-text-tertiary) truncate">@{actor.handle}</p>
                    </div>
                  </button>
                ))}
                {acContext.type === 'hashtag' && acHashtagItems.map((t, idx) => (
                  <button
                    key={t.tag}
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => applyAutocomplete(t)}
                    className={cn(
                      'w-full flex items-center justify-between gap-2 px-3 py-2 text-left transition-colors hover:bg-(--color-background-secondary)',
                      idx === acSelectedIdx && 'bg-(--color-background-secondary)',
                    )}
                  >
                    <span className="text-xs font-medium text-(--color-text-primary)">#{t.tag}</span>
                    <span className="text-[10px] text-(--color-text-tertiary)">{t.count} gönderi</span>
                  </button>
                ))}
                {acContext.type === 'emoji' && acEmojiItems.map((e, idx) => (
                  <button
                    key={e.name}
                    onMouseDown={(ev) => ev.preventDefault()}
                    onClick={() => applyAutocomplete(e)}
                    className={cn(
                      'w-full flex items-center gap-2.5 px-3 py-2 text-left transition-colors hover:bg-(--color-background-secondary)',
                      idx === acSelectedIdx && 'bg-(--color-background-secondary)',
                    )}
                  >
                    <span className="text-xl leading-none w-6 text-center">{e.emoji}</span>
                    <span className="text-xs text-(--color-text-secondary)">:{e.name}:</span>
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Extras — animated in/out with expand */}
          <div style={{ display: 'grid', gridTemplateRows: expanded ? '1fr' : '0fr', transition: 'grid-template-rows 200ms cubic-bezier(0.4, 0, 0.2, 1)' }}>
          <div className="overflow-hidden">

          {/* Spoiler prompt */}
          {spoilerPromptUrl && !cwOpen && (
            <div className="mt-2 flex items-center justify-between gap-2 px-3 py-2 rounded-xl bg-(--color-blush) dark:bg-(--color-coral)/10 border border-(--color-coral)/20">
              <span className="text-xs text-(--color-coral)">Bu içerik spoiler içeriyor olabilir. İçerik uyarısı eklemek ister misin?</span>
              <div className="flex items-center gap-1.5 flex-shrink-0">
                <button
                  type="button"
                  onClick={() => { setCwOpen(true); setSpoilerPromptUrl(null) }}
                  className="text-xs font-medium text-(--color-coral) hover:underline"
                >
                  CW Ekle
                </button>
                <span className="text-(--color-text-tertiary) text-xs">·</span>
                <button
                  type="button"
                  onClick={() => setSpoilerPromptUrl(null)}
                  className="text-xs text-(--color-text-tertiary) hover:text-(--color-text-primary)"
                >
                  Yok
                </button>
              </div>
            </div>
          )}

          {/* Link preview card */}
          {(linkPreviewLoading || linkPreview) && media.length === 0 && (
            <div className="mt-2 rounded-xl border border-(--color-border) bg-(--color-background-secondary)/40 overflow-hidden">
              {linkPreviewLoading && !linkPreview ? (
                <div className="flex items-center gap-2 px-3 py-2.5">
                  <Loader2 className="w-3.5 h-3.5 animate-spin text-(--color-text-tertiary)" />
                  <span className="text-xs text-(--color-text-tertiary)">Önizleme yükleniyor…</span>
                </div>
              ) : linkPreview && (
                <div className="relative">
                  <button
                    type="button"
                    onClick={() => { setLinkPreviewDismissed(linkPreview.url); setLinkPreview(null) }}
                    aria-label="Önizlemeyi kaldır"
                    className="absolute top-1.5 right-1.5 w-5 h-5 rounded-full bg-black/50 flex items-center justify-center text-white hover:bg-black/70 z-10"
                  >
                    <X className="w-3 h-3" />
                  </button>
                  {linkPreview.image && (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={linkPreview.image} alt="" className="w-full h-28 object-cover" />
                  )}
                  <div className="px-3 py-2">
                    {linkPreview.siteName && (
                      <p className="text-[10px] text-(--color-text-tertiary) uppercase tracking-wide mb-0.5">{linkPreview.siteName}</p>
                    )}
                    {linkPreview.title && (
                      <p className="text-xs font-semibold text-(--color-text-primary) line-clamp-2">{linkPreview.title}</p>
                    )}
                    {linkPreview.description && (
                      <p className="text-[11px] text-(--color-text-tertiary) line-clamp-2 mt-0.5">{linkPreview.description}</p>
                    )}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Quoted post embed preview */}
          {quotedPost && (
            <div className="mt-2 rounded-xl border border-(--color-border) bg-(--color-background-secondary)/40 px-3 py-2.5">
              <div className="flex items-center gap-1.5 mb-1">
                <span className="text-[11px] font-semibold text-(--color-text-secondary)">
                  @{quotedPost.author?.handle}
                </span>
                <span className="text-[11px] text-(--color-text-tertiary)">alıntılanıyor</span>
              </div>
              <p className="text-xs text-(--color-text-tertiary) line-clamp-2">{quotedPost.content}</p>
            </div>
          )}

          {/* Media previews */}
          {media.length > 0 && (
            <div className={cn('grid gap-1.5 mt-2', media.length === 1 ? 'grid-cols-1' : 'grid-cols-2')}>
              {media.map((m) => (
                <div key={m.id} className="relative rounded-xl overflow-hidden bg-(--color-background-secondary) group/thumb">
                  {m.mimeType.startsWith('video/') ? (
                    m.previewUrl ? (
                      <>
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={m.previewUrl} alt="" className="w-full aspect-video object-cover" />
                        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                          <div className="w-10 h-10 rounded-full bg-black/50 flex items-center justify-center">
                            <Video className="w-5 h-5 text-white ml-0.5" />
                          </div>
                        </div>
                      </>
                    ) : (
                      <div className="w-full aspect-video flex items-center justify-center bg-black/20">
                        <Video className="w-8 h-8 text-(--color-text-tertiary)" />
                      </div>
                    )
                  ) : (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={m.url} alt={m.altText ?? ''} className="w-full aspect-video object-cover" />
                  )}
                  <button
                    onClick={() => removeMedia(m.id)}
                    aria-label="Medyayı kaldır"
                    className="absolute top-1 right-1 w-5 h-5 rounded-full bg-black/60 flex items-center justify-center text-white hover:bg-black/80 opacity-0 group-hover/thumb:opacity-100 transition-opacity"
                  >
                    <X className="w-3 h-3" />
                  </button>
                  {!m.mimeType.startsWith('video/') && (
                    <button
                      onClick={() => openAltEdit(m)}
                      className={cn(
                        'absolute bottom-1 left-1 text-[10px] font-semibold px-1.5 py-0.5 rounded transition-all',
                        m.altText
                          ? 'bg-green-500/80 text-white hover:bg-green-500'
                          : 'bg-black/60 text-white hover:bg-black/80',
                      )}
                    >
                      {m.altText ? <><Check className="w-3 h-3" />ALT</> : 'ALT'}
                    </button>
                  )}
                </div>
              ))}
            </div>
          )}

          {/* Location chip */}
          {locationName && (
            <div className="flex items-center gap-1.5 mt-2">
              <div className="flex items-center gap-1 text-xs text-(--color-coral) bg-(--color-blush) dark:bg-(--color-coral)/12 px-2.5 py-1 rounded-full font-medium">
                <MapPin className="w-3 h-3 flex-shrink-0" />
                <span>{locationName}</span>
                <button
                  onClick={() => { setLocationName(null); setLocationLat(null); setLocationLng(null) }}
                  aria-label="Konumu kaldır"
                  className="ml-0.5 hover:opacity-70 transition-opacity"
                >
                  <X className="w-3 h-3" />
                </button>
              </div>
            </div>
          )}

          {/* Poll builder */}
          {pollOpen && (
            <div className="mt-3 rounded-xl border border-(--color-border) bg-(--color-background-secondary)/40 p-3 space-y-2">
              <p className="text-xs font-semibold text-(--color-text-secondary)">Anket seçenekleri</p>
              {pollOptions.map((opt, idx) => (
                <div key={idx} className="flex items-center gap-1.5">
                  <input
                    value={opt}
                    onChange={(e) => updatePollOption(idx, e.target.value)}
                    maxLength={80}
                    placeholder={`Seçenek ${idx + 1}`}
                    className="flex-1 text-xs text-(--color-text-primary) placeholder:text-(--color-text-tertiary) bg-(--color-background) border border-(--color-border) rounded-lg px-2.5 py-1.5 focus:outline-none focus:border-(--color-coral)"
                  />
                  {pollOptions.length > 2 && (
                    <button
                      onClick={() => removePollOption(idx)}
                      aria-label="Seçeneği kaldır"
                      className="p-1 rounded-lg text-(--color-text-tertiary) hover:text-red-500 hover:bg-red-500/10 transition-colors"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              ))}
              {pollOptions.length < 4 && (
                <button
                  onClick={addPollOption}
                  className="flex items-center gap-1 text-xs text-(--color-coral) hover:underline"
                >
                  <Plus className="w-3 h-3" />
                  Seçenek ekle
                </button>
              )}
              <div className="flex flex-wrap items-center gap-3 pt-1">
                <div className="flex items-center gap-1.5">
                  <span className="text-xs text-(--color-text-secondary)">Süre:</span>
                  <select
                    value={pollDuration}
                    onChange={(e) => setPollDuration(Number(e.target.value))}
                    className="text-xs text-(--color-text-primary) bg-(--color-background) border border-(--color-border) rounded-lg px-2 py-1 focus:outline-none focus:border-(--color-coral)"
                  >
                    {[1, 6, 12, 24, 48, 72, 168].map((h) => (
                      <option key={h} value={h}>
                        {h < 24 ? `${h} saat` : h < 168 ? `${h / 24} gün` : '7 gün'}
                      </option>
                    ))}
                  </select>
                </div>
                <label className="flex items-center gap-1.5 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={pollMultiple}
                    onChange={(e) => setPollMultiple(e.target.checked)}
                    className="w-3 h-3 rounded accent-(--color-coral)"
                  />
                  <span className="text-xs text-(--color-text-secondary)">Çoklu seçim</span>
                </label>
              </div>
            </div>
          )}

          {/* Schedule picker */}
          {scheduleOpen && (
            <div className="mt-2 rounded-xl border border-(--color-border) bg-(--color-background-secondary)/40 p-3 space-y-2.5">
              <p className="text-xs font-semibold text-(--color-text-secondary)">Paylaşım zamanı</p>
              {/* Quick presets */}
              <div className="flex flex-wrap gap-1.5">
                {[
                  { label: '1 saat sonra', ms: 60 * 60 * 1000 },
                  { label: '3 saat sonra', ms: 3 * 60 * 60 * 1000 },
                  { label: 'Bu akşam 20:00', ms: (() => { const d = new Date(); d.setHours(20, 0, 0, 0); return d.getTime() < Date.now() + 60000 ? d.getTime() + 86400000 - Date.now() : d.getTime() - Date.now() })() },
                  { label: 'Yarın sabah 9:00', ms: (() => { const d = new Date(); d.setDate(d.getDate() + 1); d.setHours(9, 0, 0, 0); return d.getTime() - Date.now() })() },
                ].map(({ label, ms }) => {
                  const value = new Date(Date.now() + ms).toISOString().slice(0, 16)
                  const active = scheduledAt === value
                  return (
                    <button
                      key={label}
                      onClick={() => setScheduledAt(active ? '' : value)}
                      className={cn(
                        'text-[11px] px-2.5 py-1 rounded-full border transition-colors font-medium',
                        active
                          ? 'bg-(--color-coral) border-(--color-coral) text-white'
                          : 'border-(--color-border) text-(--color-text-secondary) hover:border-(--color-coral)/50 hover:text-(--color-coral)',
                      )}
                    >
                      {label}
                    </button>
                  )
                })}
              </div>
              {/* Custom datetime */}
              <div className="flex items-center gap-2">
                <input
                  type="datetime-local"
                  value={scheduledAt}
                  min={new Date(Date.now() + 60000).toISOString().slice(0, 16)}
                  onChange={(e) => setScheduledAt(e.target.value)}
                  className="flex-1 text-xs text-(--color-text-primary) bg-(--color-background) border border-(--color-border) rounded-lg px-2.5 py-1.5 focus:outline-none focus:border-(--color-coral)"
                />
                {scheduledAt && (
                  <button
                    onClick={() => { setScheduledAt(''); setScheduleOpen(false) }}
                    className="text-xs text-red-500 hover:underline flex-shrink-0"
                  >
                    Temizle
                  </button>
                )}
              </div>
              {scheduledAt && (
                <p className="text-[11px] text-(--color-text-tertiary)">
                  {new Date(scheduledAt).toLocaleString('tr-TR', { day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit' })} tarihinde paylaşılacak
                </p>
              )}
            </div>
          )}

          {uploadError && (
            <p className="text-xs text-red-500 mt-1.5 flex items-center gap-1">
              <X className="w-3 h-3 flex-shrink-0" />
              {uploadError}
            </p>
          )}

          </div>
          </div>
          {/* end extras */}

          {/* Alt text editor modal — fixed position, layout-neutral */}
          {altEditId && (() => {
            const m = media.find((x) => x.id === altEditId)
            if (!m) return null
            return (
              <div className="fixed inset-0 z-50 flex items-center justify-center p-4" onClick={() => setAltEditId(null)}>
                <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" />
                <div
                  className="relative w-full max-w-md bg-(--color-background) rounded-2xl shadow-2xl overflow-hidden"
                  onClick={(e) => e.stopPropagation()}
                >
                  <div className="relative bg-black">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={m.url} alt="" className="w-full max-h-52 object-contain" />
                  </div>
                  <div className="p-4 space-y-3">
                    <div>
                      <div className="flex items-center justify-between mb-1.5">
                        <label className="text-xs font-semibold text-(--color-text-secondary)">Alt metin (erişilebilirlik açıklaması)</label>
                        <span className={cn('text-[10px] tabular-nums', altDraft.length > 1400 ? 'text-red-500' : 'text-(--color-text-tertiary)')}>
                          {altDraft.length}/1500
                        </span>
                      </div>
                      <textarea
                        autoFocus
                        value={altDraft}
                        onChange={(e) => setAltDraft(e.target.value)}
                        onKeyDown={(e) => { if (e.key === 'Escape') setAltEditId(null) }}
                        maxLength={1500}
                        rows={3}
                        placeholder="Görseli göremeyenler için kısa bir açıklama yaz…"
                        className="w-full text-sm text-(--color-text-primary) placeholder:text-(--color-text-tertiary) bg-(--color-background-secondary) border border-(--color-border) rounded-xl px-3 py-2 resize-none focus:outline-none focus:border-(--color-coral)/60 transition-colors"
                      />
                      <p className="text-[10px] text-(--color-text-tertiary) mt-1">
                        Görsel içeriğini, rengini ve bağlamını açıkla. Dekoratif görseller için boş bırakabilirsin.
                      </p>
                    </div>
                    <div className="flex gap-2 justify-end">
                      <Button size="sm" variant="outline" onClick={() => setAltEditId(null)} className="text-xs h-8">
                        Vazgeç
                      </Button>
                      <Button
                        size="sm"
                        onClick={() => void saveAlt(altEditId)}
                        className="text-xs h-8 bg-(--color-coral) hover:bg-(--color-coral-hover) text-white border-0"
                      >
                        Kaydet
                      </Button>
                    </div>
                  </div>
                </div>
              </div>
            )
          })()}
        </div>

      </div>

      {/* Expandable section — slides in/out with grid-template-rows */}
      <div style={{
        display: 'grid',
        gridTemplateRows: expanded ? '1fr' : '0fr',
        transition: 'grid-template-rows 220ms cubic-bezier(0.4, 0, 0.2, 1)',
      }}>
        <div className={gifPickerOpen || visibilityOpen || groupPickerOpen || flairOpen || locationPickerOpen ? 'overflow-visible' : 'overflow-hidden'}>
          {/* Toolbar */}
          <div className="flex items-center gap-y-2 px-4 pb-3 pt-2 border-t border-(--color-border-secondary)/60" style={{ paddingLeft: 'calc(1rem + 2.5rem + 0.75rem)' }}>
            <div className="flex flex-1 items-center gap-0.5 relative min-w-0">
              {gifPickerOpen && (
                <GifPicker
                  onSelect={(gif) => void handleGifSelect(gif)}
                  onClose={() => setGifPickerOpen(false)}
                />
              )}
              <input
                ref={fileInputRef}
                type="file"
                accept="image/jpeg,image/png,image/gif,image/webp"
                multiple
                className="hidden"
                onChange={(e) => void handleFiles(e.target.files)}
              />
              <input
                ref={videoFileInputRef}
                type="file"
                accept="video/mp4,video/webm,video/quicktime"
                className="hidden"
                onChange={(e) => { const f = e.target.files?.[0]; if (f) void handleVideoFile(f) }}
              />
              {/* Template button — only when community has templates */}
              {communityTemplates && communityTemplates.length > 0 && !replyToId && (
                <Tooltip>
                  <TooltipTrigger asChild>
                    <button
                      onClick={() => { setTemplatePickerOpen((v) => !v); setSelectedTemplate(null); setTemplateValues({}) }}
                      className={cn(
                        'p-1.5 rounded-lg transition-colors',
                        (templatePickerOpen || selectedTemplate) ? 'text-(--color-coral) bg-(--color-blush) dark:bg-(--color-coral)/12' : 'text-(--color-text-tertiary) hover:text-(--color-coral) hover:bg-(--color-blush) dark:hover:bg-(--color-coral)/12',
                      )}
                      aria-label="Şablon seç"
                    >
                      <LayoutTemplate className="w-4 h-4" />
                    </button>
                  </TooltipTrigger>
                  <TooltipContent>Şablon seç</TooltipContent>
                </Tooltip>
              )}

              {/* Flair button — only when community has flairs */}
              {communityFlairs && communityFlairs.length > 0 && !replyToId && (
                <div className="relative">
                  <Tooltip>
                  <TooltipTrigger asChild>
                  <button
                    onClick={() => setFlairOpen((v) => !v)}
                    className={cn(
                      'p-1.5 rounded-lg transition-colors',
                      (flairOpen || selectedFlair) ? 'text-(--color-coral) bg-(--color-blush) dark:bg-(--color-coral)/12' : 'text-(--color-text-tertiary) hover:text-(--color-coral) hover:bg-(--color-blush) dark:hover:bg-(--color-coral)/12',
                    )}
                    aria-label="Flair seç"
                  >
                    <Tag className="w-4 h-4" />
                  </button>
                  </TooltipTrigger>
                  <TooltipContent>Flair seç</TooltipContent>
                  </Tooltip>
                  {flairOpen && (
                    <>
                      <div className="fixed inset-0 z-10" onClick={() => setFlairOpen(false)} />
                      <div className="absolute bottom-full mb-2 left-0 z-20 w-56 bg-(--color-background) border border-(--color-border) rounded-xl shadow-xl overflow-hidden py-1">
                        {selectedFlair && (
                          <button
                            onClick={() => { setSelectedFlair(null); setFlairOpen(false) }}
                            className="flex items-center gap-2 w-full px-3 py-2 text-[13px] text-(--color-text-tertiary) hover:bg-(--color-background-secondary) transition-colors"
                          >
                            <X className="w-3.5 h-3.5" /> Flair kaldır
                          </button>
                        )}
                        {communityFlairs.map((f) => (
                          <button
                            key={f.id}
                            onClick={() => { setSelectedFlair(f); setFlairOpen(false) }}
                            className="flex items-center gap-2 w-full px-3 py-2 text-[13px] text-(--color-text-primary) hover:bg-(--color-background-secondary) transition-colors"
                          >
                            {f.emoji && <span>{f.emoji}</span>}
                            <span>{f.name}</span>
                            {selectedFlair?.id === f.id && <Check className="w-3.5 h-3.5 text-(--color-coral) ml-auto" />}
                          </button>
                        ))}
                      </div>
                    </>
                  )}
                </div>
              )}

              {/* Primary tools */}
              <Tooltip>
                <TooltipTrigger asChild>
                  <button
                    onClick={() => fileInputRef.current?.click()}
                    disabled={uploading || media.length >= MAX_IMAGES || pollOpen || media.some((m) => m.mimeType.startsWith('video/'))}
                    aria-label="Görsel ekle"
                    className="p-1.5 rounded-lg text-(--color-text-tertiary) hover:text-(--color-coral) hover:bg-(--color-blush) dark:hover:bg-(--color-coral)/12 transition-colors disabled:opacity-40"
                  >
                    {uploading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Image className="w-4 h-4" />}
                  </button>
                </TooltipTrigger>
                <TooltipContent>Görsel ekle</TooltipContent>
              </Tooltip>
              <Tooltip>
                <TooltipTrigger asChild>
                  <button
                    onClick={() => videoFileInputRef.current?.click()}
                    disabled={uploading || media.length > 0 || pollOpen}
                    aria-label="Video ekle"
                    className="p-1.5 rounded-lg text-(--color-text-tertiary) hover:text-(--color-coral) hover:bg-(--color-blush) dark:hover:bg-(--color-coral)/12 transition-colors disabled:opacity-40"
                  >
                    <Video className="w-4 h-4" />
                  </button>
                </TooltipTrigger>
                <TooltipContent>Video ekle (max 100 MB)</TooltipContent>
              </Tooltip>
              <Tooltip>
                <TooltipTrigger asChild>
                  <button
                    onClick={() => { setGifPickerOpen((v) => !v); if (!gifPickerOpen) setPollOpen(false) }}
                    disabled={media.length >= MAX_IMAGES || pollOpen || media.some((m) => m.mimeType.startsWith('video/'))}
                    className={cn(
                      'px-1.5 py-1.5 rounded-lg text-[11px] font-bold transition-colors disabled:opacity-40',
                      gifPickerOpen ? 'text-(--color-coral) bg-(--color-blush) dark:bg-(--color-coral)/12' : 'text-(--color-text-tertiary) hover:text-(--color-coral) hover:bg-(--color-blush) dark:hover:bg-(--color-coral)/12',
                    )}
                    aria-label="GIF ekle"
                  >
                    GIF
                  </button>
                </TooltipTrigger>
                <TooltipContent>GIF ekle</TooltipContent>
              </Tooltip>
              <Tooltip>
                <TooltipTrigger asChild>
                  <button
                    onClick={togglePoll}
                    disabled={media.length > 0 || !!quotedPost}
                    className={cn(
                      'p-1.5 rounded-lg transition-colors disabled:opacity-40',
                      pollOpen ? 'text-(--color-coral) bg-(--color-blush) dark:bg-(--color-coral)/12' : 'text-(--color-text-tertiary) hover:text-(--color-coral) hover:bg-(--color-blush) dark:hover:bg-(--color-coral)/12',
                    )}
                    aria-label="Anket ekle"
                  >
                    <BarChart2 className="w-4 h-4" />
                  </button>
                </TooltipTrigger>
                <TooltipContent>Anket ekle</TooltipContent>
              </Tooltip>

              <div className="relative">
                <Tooltip>
                  <TooltipTrigger asChild>
                    <button
                      onClick={openLocationPicker}
                      aria-label="Konum ekle"
                      className={cn(
                        'p-1.5 rounded-lg transition-colors',
                        locationName ? 'text-(--color-coral) bg-(--color-blush) dark:bg-(--color-coral)/12' : 'text-(--color-text-tertiary) hover:text-(--color-coral) hover:bg-(--color-blush) dark:hover:bg-(--color-coral)/12',
                      )}
                    >
                      <MapPin className="w-4 h-4" />
                    </button>
                  </TooltipTrigger>
                  <TooltipContent>Konum ekle</TooltipContent>
                </Tooltip>
                {locationPickerOpen && (
                  <>
                    <div className="fixed inset-0 z-10" onClick={() => setLocationPickerOpen(false)} />
                    <div className="absolute left-0 bottom-full mb-1.5 z-20 w-64 rounded-xl border border-(--color-border) bg-(--color-background) shadow-lg p-3 space-y-2.5">
                      <p className="text-xs font-semibold text-(--color-text-secondary)">Konum</p>
                      <input
                        autoFocus
                        value={locationDraft}
                        onChange={(e) => setLocationDraft(e.target.value)}
                        onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); applyLocation(locationDraft) } if (e.key === 'Escape') setLocationPickerOpen(false) }}
                        placeholder="Şehir veya yer adı…"
                        maxLength={200}
                        className="w-full text-xs text-(--color-text-primary) placeholder:text-(--color-text-tertiary) bg-(--color-background-secondary) border border-(--color-border) rounded-lg px-2.5 py-1.5 focus:outline-none focus:border-(--color-coral)/60"
                      />
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => void detectLocation()}
                          disabled={locationLoading}
                          className="flex items-center gap-1.5 text-xs text-(--color-coral) hover:underline disabled:opacity-50"
                        >
                          {locationLoading ? <Loader2 className="w-3 h-3 animate-spin" /> : <MapPin className="w-3 h-3" />}
                          Konumumu kullan
                        </button>
                        <div className="flex-1" />
                        {locationName && (
                          <button
                            onClick={() => { setLocationName(null); setLocationLat(null); setLocationLng(null); setLocationPickerOpen(false) }}
                            className="text-xs text-red-500 hover:underline"
                          >
                            Kaldır
                          </button>
                        )}
                        <button
                          onClick={() => applyLocation(locationDraft)}
                          disabled={!locationDraft.trim()}
                          className="text-xs px-2.5 py-1 rounded-lg bg-(--color-coral) text-white hover:bg-(--color-coral-hover) disabled:opacity-40"
                        >
                          Tamam
                        </button>
                      </div>
                    </div>
                  </>
                )}
              </div>

              {/* Extras toggle */}
              <Tooltip>
                <TooltipTrigger asChild>
                  <button
                    ref={extrasButtonRef}
                    onClick={() => setExtrasOpen((v) => !v)}
                    className={cn(
                      'p-1.5 rounded-lg transition-colors',
                      extrasOpen || cwOpen || scheduleOpen || scheduledAt
                        ? 'text-(--color-coral) bg-(--color-blush) dark:bg-(--color-coral)/12'
                        : 'text-(--color-text-tertiary) hover:text-(--color-coral) hover:bg-(--color-blush) dark:hover:bg-(--color-coral)/12',
                    )}
                    aria-label="Daha fazla"
                  >
                    <Plus className="w-4 h-4" />
                  </button>
                </TooltipTrigger>
                <TooltipContent>Daha fazla seçenek</TooltipContent>
              </Tooltip>

              {/* Community picker — sadece reply değilse göster */}
              {!replyToId && !quotedPost && (
                <div className="relative">
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <button
                        onClick={() => void openGroupPicker()}
                        className={cn(
                          'flex items-center gap-1 px-1.5 py-1.5 rounded-lg transition-colors text-xs font-medium',
                          selectedGroupHandle
                            ? 'text-(--color-coral) bg-(--color-blush) dark:bg-(--color-coral)/12'
                            : 'text-(--color-text-tertiary) hover:text-(--color-coral) hover:bg-(--color-blush) dark:hover:bg-(--color-coral)/12',
                        )}
                      >
                        <Users className="w-4 h-4" />
                        {selectedGroupHandle && (
                          <span className="text-[11px] max-w-[60px] truncate">{selectedGroupHandle}</span>
                        )}
                      </button>
                    </TooltipTrigger>
                    <TooltipContent>Topluluğa paylaş</TooltipContent>
                  </Tooltip>
                  {groupPickerOpen && (
                    <>
                      <div className="fixed inset-0 z-10" onClick={() => setGroupPickerOpen(false)} />
                      <div className="absolute left-0 bottom-full mb-1.5 z-20 w-52 rounded-xl border border-(--color-border) bg-(--color-background) shadow-lg py-1 overflow-hidden">
                        <p className="px-3.5 py-2 text-[11px] font-semibold text-(--color-text-tertiary) uppercase tracking-wide">Topluluk seç</p>
                        {!communitiesLoaded ? (
                          <div className="px-3.5 py-3 text-xs text-(--color-text-tertiary)">Yükleniyor…</div>
                        ) : joinedCommunities.length === 0 ? (
                          <div className="px-3.5 py-3 text-xs text-(--color-text-tertiary)">Üye olduğun topluluk yok.</div>
                        ) : (
                          <>
                            {selectedGroupHandle && (
                              <button
                                onClick={() => { setSelectedGroupHandle(null); setGroupPickerOpen(false) }}
                                className="flex items-center gap-2 w-full px-3.5 py-2 text-[13px] text-red-500 hover:bg-red-500/5 transition-colors"
                              >
                                <X className="w-3.5 h-3.5" />
                                Topluluğu kaldır
                              </button>
                            )}
                            {joinedCommunities.map((c) => (
                              <button
                                key={c.handle}
                                onClick={() => { setSelectedGroupHandle(c.handle); setGroupPickerOpen(false) }}
                                className={cn(
                                  'flex items-center gap-2 w-full px-3.5 py-2 text-[13px] transition-colors hover:bg-(--color-background-secondary)',
                                  selectedGroupHandle === c.handle ? 'text-(--color-coral)' : 'text-(--color-text-primary)',
                                )}
                              >
                                <Users className="w-3.5 h-3.5 flex-shrink-0 text-(--color-text-tertiary)" />
                                <span className="truncate">{c.name}</span>
                                {selectedGroupHandle === c.handle && <Check className="w-3.5 h-3.5 ml-auto flex-shrink-0" />}
                              </button>
                            ))}
                          </>
                        )}
                      </div>
                    </>
                  )}
                </div>
              )}

              {/* Visibility picker */}
              <div className="relative">
                <Tooltip>
                  <TooltipTrigger asChild>
                    <button
                      onClick={() => setVisibilityOpen((v) => !v)}
                      className={cn(
                        'flex items-center gap-1 px-2 py-1 rounded-lg text-xs transition-colors',
                        visibility !== 'public'
                          ? 'text-(--color-coral) bg-(--color-blush) dark:bg-(--color-coral)/12'
                          : 'text-(--color-text-tertiary) hover:text-(--color-coral) hover:bg-(--color-blush) dark:hover:bg-(--color-coral)/12',
                      )}
                      aria-label={`Görünürlük: ${currentVis.label}`}
                    >
                      {currentVis.icon}
                      {visibility !== 'public' && <span className="hidden sm:inline">{currentVis.label}</span>}
                    </button>
                  </TooltipTrigger>
                  <TooltipContent>Görünürlük: {currentVis.label}</TooltipContent>
                </Tooltip>
                {visibilityOpen && (
                  <div className="absolute left-0 bottom-full mb-1 w-56 rounded-xl border border-(--color-border) bg-(--color-background) shadow-lg z-20 py-1 overflow-hidden">
                    {VISIBILITY_OPTIONS.map((opt) => (
                      <button
                        key={opt.value}
                        onClick={() => { setVisibility(opt.value); setVisibilityOpen(false) }}
                        className={cn(
                          'w-full flex items-start gap-2.5 px-3 py-2.5 text-left transition-colors hover:bg-(--color-background-secondary)',
                          visibility === opt.value && 'bg-(--color-blush) dark:bg-(--color-coral)/10',
                        )}
                      >
                        <span className={cn('mt-0.5 flex-shrink-0', visibility === opt.value ? 'text-(--color-coral)' : 'text-(--color-text-tertiary)')}>
                          {opt.icon}
                        </span>
                        <div>
                          <p className={cn('text-xs font-medium', visibility === opt.value ? 'text-(--color-coral)' : 'text-(--color-text-primary)')}>
                            {opt.label}
                          </p>
                          <p className="text-[10px] text-(--color-text-tertiary) mt-0.5">{opt.desc}</p>
                        </div>
                      </button>
                    ))}
                  </div>
                )}
              </div>

              <span className="text-xs text-(--color-text-tertiary)">
                {media.length > 0 && `${media.length}/${MAX_IMAGES}`}
              </span>
            </div>

            <div className="flex items-center gap-2 ml-auto flex-shrink-0 pl-2">
              {draftSavedAt && !posting && content.length > 0 && (
                <span className="text-[10px] text-(--color-text-tertiary) hidden sm:inline">Kaydedildi</span>
              )}
              {content.length > 0 && <CharRing chars={content.length} max={MAX_CHARS} />}

              {(content.trim() || media.length > 0) && !scheduledAt && (
                <Tooltip>
                  <TooltipTrigger asChild>
                    <button
                      onClick={() => void saveDraft()}
                      disabled={posting}
                      aria-label="Taslak kaydet"
                      className="p-1.5 rounded-full text-(--color-text-tertiary) hover:text-(--color-coral) hover:bg-(--color-coral)/8 transition-colors disabled:opacity-50"
                    >
                      <FileEdit className="w-4 h-4" />
                    </button>
                  </TooltipTrigger>
                  <TooltipContent>Taslak kaydet</TooltipContent>
                </Tooltip>
              )}

              <Button
                size="sm"
                disabled={!canPost || posting}
                onClick={() => void handlePost()}
                className="bg-(--color-coral) hover:bg-(--color-coral-hover) text-white text-xs px-4 rounded-full"
              >
                {posting
                  ? (scheduledAt ? 'Zamanlanıyor…' : 'Paylaşılıyor…')
                  : (scheduledAt ? 'Zamanla' : threadItems.length > 0 ? 'Zinciri paylaş' : 'Paylaş')}
              </Button>
            </div>
          </div>
        </div>
      </div>
      </div>
      {/* end card */}

      {/* Thread items */}
      {threadItems.map((item, index) => (
        <ThreadItemComposer
          key={item.id}
          item={item}
          avatarUrl={avatarUrl}
          displayName={displayName}
          onContentChange={(c) => updateThreadItemContent(item.id, c)}
          onFilesChange={(files) => void handleThreadItemFiles(item.id, files)}
          onRemoveMedia={(mediaId) => removeThreadItemMedia(item.id, mediaId)}
          onRemove={() => removeThreadItem(item.id)}
          isLast={index === threadItems.length - 1}
        />
      ))}

      {/* Add to thread — only on home composer, not reply form */}
      {(content.trim() || media.length > 0) && !replyToId && (
        <div className="flex items-center gap-3 mt-1">
          <div className="w-10 flex-shrink-0 flex justify-center">
            <div className="w-px h-4 bg-(--color-border-secondary)" />
          </div>
          <button
            onClick={addThreadItem}
            className="flex items-center gap-1.5 text-xs text-(--color-text-tertiary) hover:text-(--color-coral) transition-colors py-1"
          >
            <Plus className="w-3.5 h-3.5" />
            Zincire ekle
          </button>
        </div>
      )}

      {/* Extras dropdown — rendered fixed to escape overflow-hidden animation container */}
      {extrasOpen && (() => {
        const rect = extrasButtonRef.current?.getBoundingClientRect()
        if (!rect) return null
        const winH = window.innerHeight
        return (
          <>
            <div className="fixed inset-0 z-40" onClick={() => setExtrasOpen(false)} />
            <div
              className="fixed z-50 w-44 rounded-xl border border-(--color-border) bg-(--color-background) shadow-lg py-1 overflow-hidden"
              style={{ bottom: winH - rect.top + 4, left: rect.left }}
            >
              <button
                onClick={() => { setCwOpen((v) => !v); if (cwOpen) setCw(''); setExtrasOpen(false) }}
                className={cn(
                  'flex items-center gap-2.5 w-full px-3.5 py-2 text-[13px] transition-colors hover:bg-(--color-background-secondary)',
                  cwOpen ? 'text-(--color-coral)' : 'text-(--color-text-primary)',
                )}
              >
                <AlertTriangle className="w-3.5 h-3.5 text-(--color-text-tertiary)" />
                İçerik uyarısı
              </button>
              <button
                onClick={() => { insertCodeBlock(); setExtrasOpen(false) }}
                className="flex items-center gap-2.5 w-full px-3.5 py-2 text-[13px] text-(--color-text-primary) transition-colors hover:bg-(--color-background-secondary)"
              >
                <Code2 className="w-3.5 h-3.5 text-(--color-text-tertiary)" />
                Kod bloğu
              </button>
              <button
                onClick={() => { setScheduleOpen((v) => !v); setExtrasOpen(false) }}
                className={cn(
                  'flex items-center gap-2.5 w-full px-3.5 py-2 text-[13px] transition-colors hover:bg-(--color-background-secondary)',
                  scheduleOpen || scheduledAt ? 'text-(--color-coral)' : 'text-(--color-text-primary)',
                )}
              >
                <Clock className="w-3.5 h-3.5 text-(--color-text-tertiary)" />
                {scheduledAt ? <><Check className="w-3.5 h-3.5 mr-1" />Zamanlandı</> : 'Zamanla'}
              </button>
            </div>
          </>
        )
      })()}
    </div>
  )
}
