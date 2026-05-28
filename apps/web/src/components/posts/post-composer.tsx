'use client'

import { useState, useRef, useEffect } from 'react'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { api, type Actor, type Post, type MediaAttachment, type QuotedPost, type GifResult } from '@/lib/api'
import { Image, Video, X, Loader2, AlertTriangle, Globe, Lock, Users, Eye, BarChart2, Plus, Trash2, UserCheck, Clock, Code2, FileEdit } from 'lucide-react'
import { cn } from '@/lib/utils'
import { GifPicker } from './gif-picker'
import { toast } from 'sonner'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'

const MAX_CHARS = 500
const MAX_IMAGES = 4

type Visibility = 'public' | 'unlisted' | 'followers' | 'close_friends' | 'direct'

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

export function PostComposer({ handle, displayName, avatarUrl, onPost, replyToId, quotedPost }: PostComposerProps) {
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
  const fileInputRef = useRef<HTMLInputElement>(null)
  const videoFileInputRef = useRef<HTMLInputElement>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  // Autocomplete state
  const [acContext, setAcContext] = useState<{ type: 'mention' | 'hashtag'; query: string; triggerIdx: number } | null>(null)
  const [mentionResults, setMentionResults] = useState<Actor[]>([])
  const [trendingTags, setTrendingTags] = useState<{ tag: string; count: number }[]>([])
  const [acSelectedIdx, setAcSelectedIdx] = useState(0)

  // Link preview state
  const [linkPreview, setLinkPreview] = useState<{ url: string; title: string | null; description: string | null; image: string | null; siteName: string | null } | null>(null)
  const [linkPreviewLoading, setLinkPreviewLoading] = useState(false)
  const [linkPreviewDismissed, setLinkPreviewDismissed] = useState<string | null>(null)

  useEffect(() => {
    api.search.trendingTags().then((d) => setTrendingTags(d.tags)).catch(() => {})
  }, [])

  // Autosave draft
  useEffect(() => {
    const t = setTimeout(() => {
      try {
        if (content || cw) {
          localStorage.setItem(draftKey, JSON.stringify({ content, cw }))
        } else {
          localStorage.removeItem(draftKey)
        }
      } catch {}
    }, 500)
    return () => clearTimeout(t)
  }, [content, cw, draftKey])

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
        .then((p) => { setLinkPreview(p); setLinkPreviewLoading(false) })
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

  // Schedule state
  const [scheduledAt, setScheduledAt] = useState<string>('')
  const [scheduleOpen, setScheduleOpen] = useState(false)
  const [extrasOpen, setExtrasOpen] = useState(false)

  // Listen for compose focus event dispatched by sidebar button
  useEffect(() => {
    function handler() { textareaRef.current?.focus() }
    window.addEventListener('floq:focus-composer', handler)
    return () => window.removeEventListener('floq:focus-composer', handler)
  }, [])

  const acHashtagItems = acContext?.type === 'hashtag'
    ? trendingTags.filter((t) => t.tag.toLowerCase().startsWith(acContext.query.toLowerCase())).slice(0, 8)
    : []
  const acItems: (Actor | { tag: string; count: number })[] = acContext?.type === 'mention' ? mentionResults : acHashtagItems

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
      i--
    }
    setAcContext(null)
  }

  function applyAutocomplete(item: Actor | { tag: string; count: number }) {
    if (!acContext) return
    const textarea = textareaRef.current
    const cursorPos = textarea?.selectionStart ?? content.length
    const replacement = acContext.type === 'mention'
      ? `@${(item as Actor).handle}`
      : `#${(item as { tag: string; count: number }).tag}`
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
  const canPost = (content.trim().length > 0 || media.length > 0 || !!quotedPost || pollOpen) && remaining >= 0 && !uploading && pollValid

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

  async function handleVideoFile(files: FileList | null) {
    if (!files || files.length === 0) return
    const file = files[0]!
    if (videoFileInputRef.current) videoFileInputRef.current.value = ''
    setUploading(true)
    setUploadError(null)
    try {
      const uploaded = await api.media.uploadVideo(file)
      setMedia([uploaded])
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
      const post = await api.posts.create({
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
      })
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
      try { localStorage.removeItem(draftKey) } catch {}
      onPost(post)
    } catch (err) {
      const msg = err instanceof Error ? err.message : null
      const errorMsg = msg ?? 'Gönderi paylaşılamadı. Tekrar dene.'
      setPostError(errorMsg)
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

  return (
    <div className="px-4 py-4 border-b border-(--color-border-secondary) bg-(--color-background)">
      <div className="flex gap-3">
        <Avatar className="w-10 h-10 flex-shrink-0">
          {avatarUrl && <AvatarImage src={avatarUrl} alt={displayName} />}
          <AvatarFallback
            className="text-xs font-medium text-white"
            style={{ background: 'var(--gradient-avatar)' }}
          >
            {initials}
          </AvatarFallback>
        </Avatar>

        <div className="flex-1 min-w-0">
          {cwOpen && (
            <input
              value={cw}
              onChange={(e) => setCw(e.target.value)}
              placeholder="İçerik uyarısı (isteğe bağlı)…"
              maxLength={500}
              className="w-full text-sm text-(--color-text-primary) placeholder:text-(--color-text-tertiary) bg-transparent border-0 border-b border-(--color-border-tertiary) pb-2 mb-2 focus:outline-none"
            />
          )}
          {draftRestored && !posting && !postError && (
            <p className="text-[10px] text-(--color-text-tertiary) mb-1">Taslak geri yüklendi</p>
          )}
          {postError && (
            <p className="text-[11px] text-red-500 mb-1 flex items-center gap-1">
              <span>⚠</span>{postError}
            </p>
          )}
          <div className="relative">
            <Textarea
              ref={textareaRef}
              value={content}
              onChange={handleContentChange}
              onKeyDown={handleKeyDown}
              placeholder="Ne düşünüyorsun?"
              rows={3}
              className="resize-none border-0 bg-transparent p-0 min-h-[4.5rem] text-sm text-(--color-text-primary) placeholder:text-(--color-text-tertiary) focus-visible:ring-0 focus-visible:ring-offset-0"
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
              </div>
            )}
          </div>

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
              {media.map((m) => {
                const isVideo = m.mimeType.startsWith('video/')
                return (
                  <div key={m.id} className="relative rounded-xl overflow-hidden bg-(--color-background-secondary)">
                    {isVideo ? (
                      <video
                        src={m.url}
                        className="w-full aspect-video object-cover"
                        controls={false}
                        muted
                        preload="metadata"
                      />
                    ) : (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={m.url} alt={m.altText ?? ''} className="w-full aspect-video object-cover" />
                    )}
                    <button
                      onClick={() => removeMedia(m.id)}
                      aria-label="Medyayı kaldır"
                      className="absolute top-1 right-1 w-5 h-5 rounded-full bg-black/60 flex items-center justify-center text-white hover:bg-black/80"
                    >
                      <X className="w-3 h-3" />
                    </button>
                    {!isVideo && (
                      altEditId === m.id ? (
                        <div className="absolute bottom-0 left-0 right-0 bg-black/75 px-2 py-1.5 flex items-center gap-1.5">
                          <input
                            autoFocus
                            value={altDraft}
                            onChange={(e) => setAltDraft(e.target.value)}
                            onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); saveAlt(m.id) } if (e.key === 'Escape') setAltEditId(null) }}
                            maxLength={1500}
                            placeholder="Görsel açıklaması (alt text)…"
                            className="flex-1 text-[11px] bg-transparent text-white placeholder:text-white/50 focus:outline-none min-w-0"
                          />
                          <button onClick={() => saveAlt(m.id)} className="text-[10px] font-semibold text-(--color-coral) hover:opacity-80 shrink-0">Kaydet</button>
                          <button onClick={() => setAltEditId(null)} className="text-white/60 hover:text-white shrink-0"><X className="w-3 h-3" /></button>
                        </div>
                      ) : (
                        <button
                          onClick={() => openAltEdit(m)}
                          className="absolute bottom-1 left-1 text-[10px] font-semibold px-1.5 py-0.5 rounded bg-black/60 text-white hover:bg-black/80"
                        >
                          {m.altText ? 'ALT ✓' : 'ALT ekle'}
                        </button>
                      )
                    )}
                  </div>
                )
              })}
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
            <div className="mt-2 rounded-xl border border-(--color-border) bg-(--color-background-secondary)/40 p-3">
              <p className="text-xs font-semibold text-(--color-text-secondary) mb-2">Paylaşım zamanı</p>
              <input
                type="datetime-local"
                value={scheduledAt}
                min={new Date(Date.now() + 60000).toISOString().slice(0, 16)}
                onChange={(e) => setScheduledAt(e.target.value)}
                className="text-xs text-(--color-text-primary) bg-(--color-background) border border-(--color-border) rounded-lg px-2.5 py-1.5 focus:outline-none focus:border-(--color-coral)"
              />
              {scheduledAt && (
                <button
                  onClick={() => { setScheduledAt(''); setScheduleOpen(false) }}
                  className="ml-2 text-xs text-(--color-text-tertiary) hover:text-red-500"
                >
                  İptal
                </button>
              )}
            </div>
          )}

          {uploadError && (
            <p className="text-xs text-red-500 mt-1.5 flex items-center gap-1">
              <X className="w-3 h-3 flex-shrink-0" />
              {uploadError}
            </p>
          )}
          <div className="flex items-center gap-y-2 mt-2 pt-2 border-t border-(--color-border-tertiary)">
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
                accept="video/mp4,video/webm,video/ogg,video/quicktime"
                className="hidden"
                onChange={(e) => void handleVideoFile(e.target.files)}
              />
              {/* Primary tools */}
              <Tooltip>
                <TooltipTrigger asChild>
                  <button
                    onClick={() => fileInputRef.current?.click()}
                    disabled={uploading || media.length >= MAX_IMAGES || pollOpen || media.some((m) => m.mimeType.startsWith('video/'))}
                    aria-label="Görsel ekle"
                    className="p-1.5 rounded-lg text-(--color-text-tertiary) hover:text-(--color-coral) hover:bg-(--color-blush) transition-colors disabled:opacity-40"
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
                    className="p-1.5 rounded-lg text-(--color-text-tertiary) hover:text-(--color-coral) hover:bg-(--color-blush) transition-colors disabled:opacity-40"
                  >
                    <Video className="w-4 h-4" />
                  </button>
                </TooltipTrigger>
                <TooltipContent>Video ekle</TooltipContent>
              </Tooltip>
              <Tooltip>
                <TooltipTrigger asChild>
                  <button
                    onClick={() => { setGifPickerOpen((v) => !v); if (!gifPickerOpen) setPollOpen(false) }}
                    disabled={media.length >= MAX_IMAGES || pollOpen || media.some((m) => m.mimeType.startsWith('video/'))}
                    aria-label="GIF ekle"
                    className={cn(
                      'px-1.5 py-1.5 rounded-lg text-[11px] font-bold transition-colors disabled:opacity-40',
                      gifPickerOpen ? 'text-(--color-coral) bg-(--color-blush)' : 'text-(--color-text-tertiary) hover:text-(--color-coral) hover:bg-(--color-blush)',
                    )}
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
                    aria-label="Anket ekle"
                    className={cn(
                      'p-1.5 rounded-lg transition-colors disabled:opacity-40',
                      pollOpen ? 'text-(--color-coral) bg-(--color-blush)' : 'text-(--color-text-tertiary) hover:text-(--color-coral) hover:bg-(--color-blush)',
                    )}
                  >
                    <BarChart2 className="w-4 h-4" />
                  </button>
                </TooltipTrigger>
                <TooltipContent>Anket ekle</TooltipContent>
              </Tooltip>

              {/* Extras toggle */}
              <div className="relative">
                <Tooltip>
                  <TooltipTrigger asChild>
                    <button
                      onClick={() => setExtrasOpen((v) => !v)}
                      aria-label="Daha fazla"
                      className={cn(
                        'p-1.5 rounded-lg transition-colors',
                        extrasOpen || cwOpen || scheduleOpen || scheduledAt
                          ? 'text-(--color-coral) bg-(--color-blush)'
                          : 'text-(--color-text-tertiary) hover:text-(--color-coral) hover:bg-(--color-blush)',
                      )}
                    >
                      <Plus className="w-4 h-4" />
                    </button>
                  </TooltipTrigger>
                  <TooltipContent>Daha fazla</TooltipContent>
                </Tooltip>
                {extrasOpen && (
                  <>
                    <div className="fixed inset-0 z-10" onClick={() => setExtrasOpen(false)} />
                    <div className="absolute left-0 bottom-full mb-1 z-20 w-44 rounded-xl border border-(--color-border) bg-(--color-background) shadow-lg py-1 overflow-hidden">
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
                        {scheduledAt ? 'Zamanlandı ✓' : 'Zamanla'}
                      </button>
                    </div>
                  </>
                )}
              </div>

              {/* Visibility picker */}
              <div className="relative">
                <button
                  onClick={() => setVisibilityOpen((v) => !v)}
                  className={cn(
                    'flex items-center gap-1 px-2 py-1 rounded-lg text-xs transition-colors',
                    visibility !== 'public'
                      ? 'text-(--color-coral) bg-(--color-blush)'
                      : 'text-(--color-text-tertiary) hover:text-(--color-coral) hover:bg-(--color-blush)',
                  )}
                  aria-label={`Görünürlük: ${currentVis.label}`}
                  title="Görünürlük"
                >
                  {currentVis.icon}
                  {visibility !== 'public' && <span className="hidden sm:inline">{currentVis.label}</span>}
                </button>
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
              {content.length > 0 && <CharRing chars={content.length} max={MAX_CHARS} />}

              {(content.trim() || media.length > 0) && !scheduledAt && (
                <Tooltip>
                  <TooltipTrigger asChild>
                    <button
                      onClick={() => void saveDraft()}
                      disabled={posting}
                      aria-label="Taslak Kaydet"
                      className="p-1.5 rounded-full text-(--color-text-tertiary) hover:text-(--color-coral) hover:bg-(--color-coral)/8 transition-colors disabled:opacity-50"
                    >
                      <FileEdit className="w-4 h-4" />
                    </button>
                  </TooltipTrigger>
                  <TooltipContent>Taslak Kaydet</TooltipContent>
                </Tooltip>
              )}

              <Button
                size="sm"
                disabled={!canPost || posting}
                onClick={() => void handlePost()}
                className="bg-(--color-coral) hover:bg-(--color-coral-hover) text-white text-xs px-4 rounded-full"
              >
                {posting ? (scheduledAt ? 'Zamanlanıyor…' : 'Paylaşılıyor…') : (scheduledAt ? 'Zamanla' : 'Paylaş')}
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
