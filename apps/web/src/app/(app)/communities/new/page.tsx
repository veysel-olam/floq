'use client'

import { useState, useRef, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import {
  Globe, Clock, Lock, ChevronLeft, Loader2, Plus, X,
  Users, CheckCircle2, XCircle, FileText,
} from 'lucide-react'
import { api } from '@/lib/api'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'
import { COMMUNITY_GRADIENTS, GRADIENT_LABELS, communityGradient } from '@/lib/community-colors'

const VISIBILITY_OPTIONS = [
  { value: 'public' as const, icon: Globe, label: 'Açık', desc: 'Herkes katılabilir ve gönderileri görebilir.' },
  { value: 'restricted' as const, icon: Clock, label: 'Kısıtlı', desc: 'Herkes görebilir, katılmak onay ister.' },
  { value: 'private' as const, icon: Lock, label: 'Gizli', desc: 'Sadece üyeler görebilir, katılmak onay ister.' },
]

const TOPIC_OPTIONS = [
  'Teknoloji', 'Tasarım', 'Oyun', 'Müzik', 'Sanat', 'Spor',
  'Bilim', 'Fotoğrafçılık', 'Yemek', 'Film & Dizi', 'Seyahat', 'Edebiyat',
  'Finans', 'Sağlık', 'Eğitim', 'Girişimcilik',
]

// ── Live card preview ─────────────────────────────────────────────────────────

function CardPreview({
  name, description, visibility, colorIndex, topics,
}: {
  name: string
  description: string
  visibility: 'public' | 'restricted' | 'private'
  colorIndex: number
  topics: string[]
}) {
  const gradient = communityGradient(colorIndex)
  const displayName = name || 'Topluluk Adı'
  const initials = displayName.slice(0, 2).toUpperCase()

  return (
    <div className="rounded-2xl border border-(--color-border) bg-(--color-background) overflow-hidden w-full shadow-sm">
      {/* Banner */}
      <div className="relative h-20 overflow-hidden">
        <div className="w-full h-full opacity-90" style={{ background: gradient }} />
        <div className="absolute inset-0 bg-gradient-to-t from-black/20 to-transparent" />
        {visibility !== 'public' && (
          <div className="absolute top-2 right-2">
            <span className={cn(
              'inline-flex items-center gap-1 text-[10px] font-medium px-1.5 py-0.5 rounded-full',
              visibility === 'private'
                ? 'bg-zinc-100 dark:bg-zinc-800 text-zinc-500'
                : 'bg-amber-50 dark:bg-amber-900/20 text-amber-600 dark:text-amber-400',
            )}>
              {visibility === 'private' ? <Lock className="w-2.5 h-2.5" /> : <Clock className="w-2.5 h-2.5" />}
              {visibility === 'private' ? 'Gizli' : 'Kısıtlı'}
            </span>
          </div>
        )}
      </div>

      {/* Avatar row */}
      <div className="px-3 -mt-5 mb-2">
        <div
          className="w-10 h-10 rounded-xl border-[3px] border-(--color-background) flex items-center justify-center text-xs font-bold text-white shadow-md"
          style={{ background: gradient }}
        >
          {initials}
        </div>
      </div>

      {/* Content */}
      <div className="px-3 pb-3">
        <p className="font-semibold text-sm text-(--color-text-primary) truncate leading-snug mb-0.5">
          {displayName}
        </p>
        {description ? (
          <p className="text-xs text-(--color-text-tertiary) line-clamp-2 leading-relaxed mb-2">
            {description}
          </p>
        ) : (
          <p className="text-xs text-(--color-text-tertiary) mb-2 italic opacity-50">Açıklama yok</p>
        )}
        {topics.length > 0 && (
          <div className="flex flex-wrap gap-1 mb-2">
            {topics.slice(0, 3).map((t) => (
              <span key={t} className="text-[10px] px-1.5 py-0.5 rounded-full bg-(--color-background-secondary) text-(--color-text-tertiary) border border-(--color-border)">
                {t}
              </span>
            ))}
            {topics.length > 3 && (
              <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-(--color-background-secondary) text-(--color-text-tertiary)">
                +{topics.length - 3}
              </span>
            )}
          </div>
        )}
        <div className="flex items-center justify-between">
          <span className="flex items-center gap-1 text-xs text-(--color-text-tertiary)">
            <Users className="w-3 h-3" />1
          </span>
          <span className="text-[11px] px-2 py-1 rounded-full bg-(--color-coral)/10 text-(--color-coral) font-medium">
            Sahip
          </span>
        </div>
      </div>
    </div>
  )
}

// ── Main page ─────────────────────────────────────────────────────────────────

export default function NewCommunityPage() {
  const router = useRouter()
  const [handle, setHandle] = useState('')
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [visibility, setVisibility] = useState<'public' | 'restricted' | 'private'>('public')
  const [colorIndex, setColorIndex] = useState(0)
  const [selectedTopics, setSelectedTopics] = useState<string[]>([])
  const [rules, setRules] = useState<string[]>([])
  const [newRule, setNewRule] = useState('')
  const [loading, setLoading] = useState(false)
  const [handleStatus, setHandleStatus] = useState<'idle' | 'checking' | 'available' | 'taken'>('idle')
  const ruleInputRef = useRef<HTMLInputElement>(null)
  const checkTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  const handleSlug = handle.toLowerCase().replace(/[^a-z0-9_]/g, '')

  // Debounced handle availability check
  const checkHandle = useCallback(async (slug: string) => {
    if (slug.length < 2) { setHandleStatus('idle'); return }
    setHandleStatus('checking')
    try {
      await api.communities.get(slug)
      setHandleStatus('taken')
    } catch (err) {
      const status = (err as { status?: number }).status
      setHandleStatus(status === 404 ? 'available' : 'idle')
    }
  }, [])

  useEffect(() => {
    if (checkTimer.current) clearTimeout(checkTimer.current)
    if (!handleSlug || handleSlug.length < 2) { setHandleStatus('idle'); return }
    checkTimer.current = setTimeout(() => void checkHandle(handleSlug), 500)
    return () => { if (checkTimer.current) clearTimeout(checkTimer.current) }
  }, [handleSlug, checkHandle])

  function toggleTopic(topic: string) {
    setSelectedTopics((prev) =>
      prev.includes(topic) ? prev.filter((t) => t !== topic) : prev.length < 5 ? [...prev, topic] : prev,
    )
  }

  function addRule() {
    const trimmed = newRule.trim()
    if (!trimmed || rules.length >= 10) return
    setRules((prev) => [...prev, trimmed])
    setNewRule('')
    ruleInputRef.current?.focus()
  }

  function removeRule(i: number) {
    setRules((prev) => prev.filter((_, idx) => idx !== i))
  }

  function validateForm(): string | null {
    if (!handleSlug) return 'Handle gerekli.'
    if (handleSlug.length < 2) return 'Handle en az 2 karakter olmalı.'
    if (handleStatus === 'taken') return 'Bu handle zaten alınmış.'
    if (!name.trim()) return 'Topluluk adı gerekli.'
    return null
  }

  async function handleSubmit(e?: React.FormEvent) {
    e?.preventDefault()
    const err = validateForm()
    if (err) { toast.error(err); return }

    setLoading(true)
    try {
      const community = await api.communities.create({
        handle: handleSlug,
        name: name.trim(),
        description: description.trim() || undefined,
        visibility,
        rules: rules.length > 0 ? rules.join('\n') : undefined,
        color_index: colorIndex,
        topics: selectedTopics.length > 0 ? selectedTopics.join(',') : undefined,
      })
      toast.success('Topluluk oluşturuldu!')
      router.push(`/c/${community.handle}`)
    } catch (err) {
      const msg = (err as { message?: string }).message ?? ''
      if (msg.includes('kullanımda')) toast.error('Bu handle zaten alınmış.')
      else if (msg.includes('Validation')) toast.error('Girilen bilgileri kontrol et.')
      else toast.error('Sunucu hatası, tekrar dene.')
    } finally {
      setLoading(false)
    }
  }

  const canSubmit = handleSlug.length >= 2 && !!name.trim() && handleStatus !== 'taken' && handleStatus !== 'checking' && !loading

  return (
    <div className="max-w-xl mx-auto">
      {/* Sticky header */}
      <div className="sticky top-0 z-10 bg-(--color-background)/90 backdrop-blur-sm border-b border-(--color-border-secondary) px-4 py-2.5 flex items-center gap-3">
        <button
          onClick={() => router.back()}
          className="p-1.5 rounded-full hover:bg-(--color-background-secondary) transition-colors text-(--color-text-tertiary)"
        >
          <ChevronLeft className="w-5 h-5" />
        </button>
        <h1 className="flex-1 font-bold text-base text-(--color-text-primary)" style={{ fontFamily: 'var(--font-outfit)' }}>
          Yeni Topluluk
        </h1>
        <button
          onClick={() => void handleSubmit()}
          disabled={!canSubmit}
          className="flex items-center gap-1.5 text-sm font-semibold px-4 py-1.5 rounded-full bg-(--color-coral) text-white hover:bg-(--color-coral-hover) transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
        >
          {loading && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
          {loading ? 'Oluşturuluyor' : 'Oluştur'}
        </button>
      </div>

      <form onSubmit={handleSubmit} className="px-4 py-5 space-y-6">

        {/* Preview */}
        <div>
          <p className="text-xs font-semibold text-(--color-text-tertiary) uppercase tracking-widest mb-3">Önizleme</p>
          <CardPreview
            name={name}
            description={description}
            visibility={visibility}
            colorIndex={colorIndex}
            topics={selectedTopics}
          />
        </div>

        {/* Handle */}
        <div>
          <label className="block text-xs font-semibold text-(--color-text-tertiary) uppercase tracking-widest mb-2">
            Handle
          </label>
          <div className="flex items-center rounded-xl border border-(--color-border) bg-(--color-background) overflow-hidden focus-within:border-(--color-coral)/50 transition-colors">
            <span className="px-3 py-2.5 text-sm text-(--color-text-tertiary) bg-(--color-background-secondary) border-r border-(--color-border) select-none">
              @
            </span>
            <input
              type="text"
              value={handle}
              onChange={(e) => setHandle(e.target.value)}
              placeholder="yazilim"
              maxLength={30}
              className="flex-1 px-3 py-2.5 text-sm bg-transparent text-(--color-text-primary) focus:outline-none"
              autoComplete="off"
            />
            <span className="px-3 flex-shrink-0">
              {handleStatus === 'checking' && <Loader2 className="w-4 h-4 animate-spin text-(--color-text-tertiary)" />}
              {handleStatus === 'available' && <CheckCircle2 className="w-4 h-4 text-emerald-500" />}
              {handleStatus === 'taken' && <XCircle className="w-4 h-4 text-red-500" />}
            </span>
          </div>
          <p className={cn(
            'text-xs mt-1.5',
            handleStatus === 'available' ? 'text-emerald-500' :
            handleStatus === 'taken' ? 'text-red-500' :
            'text-(--color-text-tertiary)',
          )}>
            {handleStatus === 'available' ? `@${handleSlug} müsait` :
             handleStatus === 'taken' ? `@${handleSlug} zaten alınmış` :
             handle && handle !== handleSlug ? `Kaydedilecek: @${handleSlug}` :
             'Küçük harf, rakam ve alt çizgi. Sonradan değiştirilemez.'}
          </p>
        </div>

        {/* Name */}
        <div>
          <label className="block text-xs font-semibold text-(--color-text-tertiary) uppercase tracking-widest mb-2">
            Topluluk Adı
          </label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Yazılım Geliştiriciler"
            maxLength={100}
            className="w-full px-3 py-2.5 text-sm rounded-xl border border-(--color-border) bg-(--color-background) text-(--color-text-primary) focus:outline-none focus:border-(--color-coral)/50 placeholder:text-(--color-text-tertiary) transition-colors"
          />
        </div>

        {/* Description */}
        <div>
          <label className="block text-xs font-semibold text-(--color-text-tertiary) uppercase tracking-widest mb-2">
            Açıklama <span className="font-normal normal-case tracking-normal">(isteğe bağlı)</span>
          </label>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Topluluk ne hakkında?"
            maxLength={500}
            rows={3}
            className="w-full px-3 py-2.5 text-sm rounded-xl border border-(--color-border) bg-(--color-background) text-(--color-text-primary) focus:outline-none focus:border-(--color-coral)/50 placeholder:text-(--color-text-tertiary) resize-none transition-colors"
          />
          <p className="text-xs text-(--color-text-tertiary) mt-1 text-right">{description.length}/500</p>
        </div>

        {/* Color picker */}
        <div>
          <label className="block text-xs font-semibold text-(--color-text-tertiary) uppercase tracking-widest mb-3">
            Renk Teması
          </label>
          <div className="flex gap-2 flex-wrap">
            {COMMUNITY_GRADIENTS.map((gradient, i) => (
              <button
                key={i}
                type="button"
                onClick={() => setColorIndex(i)}
                title={GRADIENT_LABELS[i]}
                className={cn(
                  'w-9 h-9 rounded-xl transition-all duration-150',
                  colorIndex === i
                    ? 'ring-2 ring-offset-2 ring-(--color-coral) scale-110'
                    : 'hover:scale-105 opacity-70 hover:opacity-100',
                )}
                style={{ background: gradient }}
              />
            ))}
          </div>
        </div>

        {/* Topics */}
        <div>
          <label className="block text-xs font-semibold text-(--color-text-tertiary) uppercase tracking-widest mb-1">
            Konular <span className="font-normal normal-case tracking-normal">(maks. 5)</span>
          </label>
          <p className="text-xs text-(--color-text-tertiary) mb-3">
            Topluluğunun hangi konularla ilgili olduğunu seç.
          </p>
          <div className="flex flex-wrap gap-2">
            {TOPIC_OPTIONS.map((topic) => {
              const selected = selectedTopics.includes(topic)
              const disabled = !selected && selectedTopics.length >= 5
              return (
                <button
                  key={topic}
                  type="button"
                  onClick={() => toggleTopic(topic)}
                  disabled={disabled}
                  className={cn(
                    'text-xs px-3 py-1.5 rounded-full border font-medium transition-all',
                    selected
                      ? 'border-(--color-coral)/60 bg-(--color-coral)/10 text-(--color-coral)'
                      : disabled
                      ? 'border-(--color-border) text-(--color-text-tertiary) opacity-40 cursor-not-allowed'
                      : 'border-(--color-border) text-(--color-text-secondary) hover:border-(--color-coral)/40 hover:text-(--color-coral)',
                  )}
                >
                  {selected && <span className="mr-1">✓</span>}
                  {topic}
                </button>
              )
            })}
          </div>
        </div>

        {/* Visibility */}
        <div>
          <label className="block text-xs font-semibold text-(--color-text-tertiary) uppercase tracking-widest mb-2">
            Görünürlük
          </label>
          <div className="space-y-2">
            {VISIBILITY_OPTIONS.map((opt) => {
              const Icon = opt.icon
              const selected = visibility === opt.value
              return (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => setVisibility(opt.value)}
                  className={cn(
                    'w-full flex items-center gap-3 px-4 py-3 rounded-xl border text-left transition-all',
                    selected
                      ? 'border-(--color-coral)/60 bg-(--color-coral)/5'
                      : 'border-(--color-border) hover:border-(--color-border-secondary)',
                  )}
                >
                  <div className={cn(
                    'w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 transition-colors',
                    selected ? 'bg-(--color-coral)/10 text-(--color-coral)' : 'bg-(--color-background-secondary) text-(--color-text-tertiary)',
                  )}>
                    <Icon className="w-4 h-4" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-(--color-text-primary)">{opt.label}</p>
                    <p className="text-xs text-(--color-text-tertiary)">{opt.desc}</p>
                  </div>
                  <div className={cn(
                    'w-4 h-4 rounded-full border-2 flex-shrink-0 transition-colors',
                    selected ? 'border-(--color-coral) bg-(--color-coral)' : 'border-(--color-border)',
                  )} />
                </button>
              )
            })}
          </div>
        </div>

        {/* Rules — itemized */}
        <div>
          <label className="block text-xs font-semibold text-(--color-text-tertiary) uppercase tracking-widest mb-2">
            Kurallar <span className="font-normal normal-case tracking-normal">(isteğe bağlı, maks. 10)</span>
          </label>

          {rules.length > 0 && (
            <ol className="space-y-2 mb-3">
              {rules.map((rule, i) => (
                <li key={i} className="flex items-start gap-2.5 group">
                  <span
                    className="mt-0.5 flex-shrink-0 w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold text-white"
                    style={{ background: communityGradient(colorIndex) }}
                  >
                    {i + 1}
                  </span>
                  <span className="flex-1 text-sm text-(--color-text-secondary) leading-relaxed pt-0.5">
                    {rule}
                  </span>
                  <button
                    type="button"
                    onClick={() => removeRule(i)}
                    className="flex-shrink-0 mt-0.5 p-1 rounded-full text-(--color-text-tertiary) hover:text-red-500 hover:bg-red-500/8 opacity-0 group-hover:opacity-100 transition-all"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </li>
              ))}
            </ol>
          )}

          {rules.length < 10 && (
            <div className="flex gap-2">
              <input
                ref={ruleInputRef}
                type="text"
                value={newRule}
                onChange={(e) => setNewRule(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addRule() } }}
                placeholder={rules.length === 0 ? 'Bir kural ekle...' : 'Başka kural ekle...'}
                maxLength={200}
                className="flex-1 px-3 py-2 text-sm rounded-xl border border-(--color-border) bg-(--color-background) text-(--color-text-primary) focus:outline-none focus:border-(--color-coral)/50 placeholder:text-(--color-text-tertiary) transition-colors"
              />
              <button
                type="button"
                onClick={addRule}
                disabled={!newRule.trim()}
                className="flex-shrink-0 px-3 py-2 rounded-xl border border-(--color-border) text-(--color-text-tertiary) hover:border-(--color-coral)/50 hover:text-(--color-coral) disabled:opacity-40 transition-all"
              >
                <Plus className="w-4 h-4" />
              </button>
            </div>
          )}
          <p className="text-xs text-(--color-text-tertiary) mt-1.5">
            Enter ile hızlıca ekle. Oluşturulduktan sonra düzenlenebilir.
          </p>
        </div>

        {/* Konular about sekmesinde gösterme notu */}
        <div className="rounded-xl bg-(--color-background-secondary)/60 border border-(--color-border) px-4 py-3 flex items-start gap-3">
          <FileText className="w-4 h-4 text-(--color-text-tertiary) mt-0.5 flex-shrink-0" />
          <p className="text-xs text-(--color-text-tertiary) leading-relaxed">
            Seçtiğin konular ve kurallar topluluk sayfasının <span className="font-medium text-(--color-text-secondary)">Hakkında</span> sekmesinde görünecek.
          </p>
        </div>

      </form>
    </div>
  )
}
