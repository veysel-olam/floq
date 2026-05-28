'use client'

import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { useSession } from '@/lib/auth-client'
import { api, type Actor } from '@/lib/api'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Textarea } from '@/components/ui/textarea'
import { Loader2, Check, Camera, Search } from 'lucide-react'
import { cn } from '@/lib/utils'
import { triggerHaptic } from '@/hooks/use-haptics'

type Step = 'welcome' | 'photo' | 'profile' | 'follow' | 'fediverse' | 'interests' | 'done'
const STEPS: Step[] = ['welcome', 'photo', 'profile', 'follow', 'fediverse', 'interests', 'done']
const PROGRESS_STEPS = ['welcome', 'photo', 'profile', 'follow', 'fediverse', 'interests'] as const

export default function OnboardingPage() {
  const { data: session, isPending } = useSession()
  const router = useRouter()
  const [step, setStep] = useState<Step>('welcome')
  const [checking, setChecking] = useState(true)

  useEffect(() => {
    if (isPending) return
    if (!session) { router.replace('/login'); return }
    api.account.getMe()
      .then(({ onboardingCompletedAt }) => {
        if (onboardingCompletedAt) router.replace('/home')
        else setChecking(false)
      })
      .catch(() => setChecking(false))
  }, [isPending, session, router])

  function advance(to: Step) {
    triggerHaptic('nudge')
    setStep(to)
  }

  async function finish() {
    triggerHaptic('success')
    try { await api.account.completeOnboarding() } catch {}
    router.replace('/home')
  }

  if (isPending || checking) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-(--color-background)">
        <Loader2 className="w-5 h-5 animate-spin text-(--color-coral)" />
      </div>
    )
  }

  const stepIndex = PROGRESS_STEPS.indexOf(step as typeof PROGRESS_STEPS[number])
  const isDone = step === 'done'

  return (
    <>
      <style>{`
        @keyframes ob-in {
          from { opacity: 0; transform: translateY(12px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        .ob-in { animation: ob-in 0.35s cubic-bezier(.22,1,.36,1) both; }
      `}</style>

      <div className="min-h-screen flex flex-col bg-(--color-background)">

        {/* Logo */}
        <div className="flex justify-center pt-8">
          <span className="text-base font-bold text-(--color-text-primary)" style={{ fontFamily: 'var(--font-outfit)' }}>
            fl<span style={{ color: '#E8593C' }}>o</span>q
          </span>
        </div>

        {/* İçerik */}
        <div className="flex-1 flex flex-col items-center justify-center px-5 py-8">
          <div className="w-full max-w-[420px] ob-in" key={step}>
            {step === 'welcome'    && <WelcomeStep   session={session} onNext={() => advance('photo')} />}
            {step === 'photo'      && <PhotoStep      session={session} onNext={() => advance('profile')} />}
            {step === 'profile'    && <ProfileStep    session={session} onNext={() => advance('follow')} />}
            {step === 'follow'     && <FollowStep     onNext={() => advance('fediverse')} />}
            {step === 'fediverse'  && <FediverseStep  onNext={() => advance('interests')} />}
            {step === 'interests'  && <InterestsStep  onNext={() => advance('done')} />}
            {step === 'done'       && <DoneStep       onFinish={finish} />}
          </div>
        </div>

        {/* Alt progress */}
        {!isDone && (
          <div className="flex justify-center gap-1.5 pb-10">
            {PROGRESS_STEPS.map((s, i) => (
              <div
                key={s}
                className="rounded-full transition-all duration-300"
                style={{
                  width: stepIndex === i ? '20px' : '6px',
                  height: '6px',
                  background: stepIndex >= i ? 'var(--color-coral)' : 'var(--color-border)',
                }}
              />
            ))}
          </div>
        )}
      </div>
    </>
  )
}

// ─── Welcome ─────────────────────────────────────────────────────────────────

function WelcomeStep({ session, onNext }: {
  session: ReturnType<typeof useSession>['data']
  onNext: () => void
}) {
  const name = session?.user.name ?? ''
  const firstName = name.split(' ')[0] || 'orada'
  const handle = (session?.user as { handle?: string } | undefined)?.handle ?? ''

  return (
    <div className="space-y-8">
      <div className="space-y-2.5">
        <h1 className="text-2xl font-bold text-(--color-text-primary) leading-snug" style={{ fontFamily: 'var(--font-outfit)' }}>
          Merhaba, {firstName} 👋
        </h1>
        <p className="text-sm text-(--color-text-secondary) leading-relaxed">
          floq'a hoş geldin. Seni birkaç adımda hazırlayalım.
        </p>
        {handle && (
          <p className="text-xs text-(--color-text-tertiary) font-mono">@{handle}@floq.com</p>
        )}
      </div>
      <button
        onClick={onNext}
        className="w-full h-10 rounded-xl bg-(--color-coral) text-white font-semibold text-sm hover:bg-(--color-coral-hover) transition-colors"
      >
        Hadi başlayalım
      </button>
    </div>
  )
}

// ─── Photo ───────────────────────────────────────────────────────────────────

function PhotoStep({ session, onNext }: {
  session: ReturnType<typeof useSession>['data']
  onNext: () => void
}) {
  const avatarInputRef = useRef<HTMLInputElement>(null)
  const headerInputRef = useRef<HTMLInputElement>(null)

  const [avatarPreview, setAvatarPreview] = useState<string | null>(null)
  const [headerPreview, setHeaderPreview] = useState<string | null>(null)
  const [avatarFile, setAvatarFile] = useState<File | null>(null)
  const [headerFile, setHeaderFile] = useState<File | null>(null)
  const [uploading, setUploading] = useState(false)
  const name = session?.user.name ?? ''

  useEffect(() => {
    return () => {
      if (avatarPreview) URL.revokeObjectURL(avatarPreview)
      if (headerPreview) URL.revokeObjectURL(headerPreview)
    }
  }, [avatarPreview, headerPreview])

  function handleAvatarFile(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0]
    if (!f) return
    if (avatarPreview) URL.revokeObjectURL(avatarPreview)
    setAvatarFile(f)
    setAvatarPreview(URL.createObjectURL(f))
  }

  function handleHeaderFile(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0]
    if (!f) return
    if (headerPreview) URL.revokeObjectURL(headerPreview)
    setHeaderFile(f)
    setHeaderPreview(URL.createObjectURL(f))
  }

  async function save() {
    if (!avatarFile && !headerFile) { onNext(); return }
    setUploading(true)
    try {
      await Promise.allSettled([
        avatarFile ? api.account.uploadAvatar(avatarFile) : Promise.resolve(),
        headerFile ? api.account.uploadHeader(headerFile) : Promise.resolve(),
      ])
    } finally {
      setUploading(false)
      onNext()
    }
  }

  return (
    <div className="space-y-6">
      <div className="space-y-1.5">
        <h2 className="text-xl font-bold text-(--color-text-primary)" style={{ fontFamily: 'var(--font-outfit)' }}>
          Profil görselleri.
        </h2>
        <p className="text-sm text-(--color-text-secondary)">
          Kapak fotoğrafı ve profil resmi — ikisi de isteğe bağlı.
        </p>
      </div>

      {/* Profile preview card */}
      <div className="rounded-2xl border border-(--color-border) overflow-hidden bg-(--color-background-secondary)">
        {/* Header */}
        <button
          type="button"
          onClick={() => headerInputRef.current?.click()}
          className="relative w-full h-28 group block"
          style={{
            background: headerPreview ? undefined : 'var(--color-border)',
          }}
        >
          {headerPreview
            ? <img src={headerPreview} alt="" className="w-full h-full object-cover" />
            : <div className="w-full h-full bg-gradient-to-br from-(--color-border) to-(--color-background-secondary)" />
          }
          <div className="absolute inset-0 bg-black/30 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
            <Camera className="w-4 h-4 text-white" />
            <span className="text-white text-xs font-medium">Kapak fotoğrafı</span>
          </div>
        </button>

        {/* Avatar overlapping */}
        <div className="px-4 pb-3 relative">
          <div className="relative -top-8 mb-[-20px] w-fit">
            <button
              type="button"
              onClick={() => avatarInputRef.current?.click()}
              className="relative group w-16 h-16 rounded-full overflow-hidden ring-4 ring-(--color-background-secondary) block"
            >
              {avatarPreview
                ? <img src={avatarPreview} alt="" className="w-full h-full object-cover" />
                : (
                  <div className="w-full h-full flex items-center justify-center text-white text-sm font-bold" style={{ background: 'var(--gradient-avatar)' }}>
                    {(name.slice(0, 2) || '?').toUpperCase()}
                  </div>
                )
              }
              <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                <Camera className="w-4 h-4 text-white" />
              </div>
            </button>
          </div>
          <p className="text-sm font-semibold text-(--color-text-primary)">{name}</p>
        </div>
      </div>

      <div className="flex gap-3 text-xs text-(--color-text-tertiary)">
        <button type="button" onClick={() => avatarInputRef.current?.click()} className="hover:text-(--color-coral) transition-colors" style={{ color: avatarFile ? '#E8593C' : undefined }}>
          {avatarFile ? '✓ Profil resmi seçildi' : 'Profil resmi seç'}
        </button>
        <span>·</span>
        <button type="button" onClick={() => headerInputRef.current?.click()} className="hover:text-(--color-coral) transition-colors" style={{ color: headerFile ? '#E8593C' : undefined }}>
          {headerFile ? '✓ Kapak seçildi' : 'Kapak fotoğrafı seç'}
        </button>
      </div>

      <input ref={avatarInputRef} type="file" accept="image/*" className="sr-only" onChange={handleAvatarFile} />
      <input ref={headerInputRef} type="file" accept="image/*" className="sr-only" onChange={handleHeaderFile} />

      <div className="flex gap-3">
        <button onClick={onNext}
          className="flex-1 h-10 rounded-xl border border-(--color-border) text-sm text-(--color-text-tertiary) hover:text-(--color-text-secondary) transition-colors">
          Atla
        </button>
        <button onClick={() => void save()} disabled={uploading}
          className="flex-1 h-10 rounded-xl bg-(--color-coral) text-white text-sm font-semibold hover:bg-(--color-coral-hover) transition-colors disabled:opacity-60 flex items-center justify-center gap-2">
          {uploading ? <Loader2 className="w-4 h-4 animate-spin" /> : (avatarFile || headerFile) ? 'Yükle ve devam' : 'Devam'}
        </button>
      </div>
    </div>
  )
}

// ─── Profile ─────────────────────────────────────────────────────────────────

function ProfileStep({ session, onNext }: {
  session: ReturnType<typeof useSession>['data']
  onNext: () => void
}) {
  const [bio, setBio] = useState('')
  const [saving, setSaving] = useState(false)
  const name = session?.user.name ?? ''
  const handle = (session?.user as { handle?: string } | undefined)?.handle ?? ''

  async function save() {
    if (!bio.trim()) { onNext(); return }
    setSaving(true)
    try { await api.account.updateProfile({ bio: bio.trim() }) } catch {}
    finally { setSaving(false); onNext() }
  }

  return (
    <div className="space-y-6">
      <div className="space-y-1.5">
        <h2 className="text-xl font-bold text-(--color-text-primary)" style={{ fontFamily: 'var(--font-outfit)' }}>
          Kendini tanıt.
        </h2>
        <p className="text-sm text-(--color-text-secondary)">
          İstersen boş bırak, sonra da ekleyebilirsin.
        </p>
      </div>

      <div className="flex items-center gap-3 p-3.5 rounded-xl bg-(--color-background-secondary) border border-(--color-border)">
        <div className="w-10 h-10 rounded-full flex items-center justify-center text-white text-sm font-bold flex-shrink-0"
          style={{ background: 'var(--gradient-avatar)' }}>
          {(name.slice(0, 2) || '?').toUpperCase()}
        </div>
        <div>
          <p className="text-sm font-semibold text-(--color-text-primary)">{name}</p>
          <p className="text-xs text-(--color-text-tertiary) font-mono">@{handle}</p>
        </div>
      </div>

      <Textarea
        value={bio}
        onChange={(e) => setBio(e.target.value)}
        maxLength={500}
        rows={4}
        placeholder="Birkaç kelimeyle kendinden bahset…"
        className="resize-none text-sm"
      />

      <div className="flex gap-3">
        <button onClick={onNext}
          className="flex-1 h-10 rounded-xl border border-(--color-border) text-sm text-(--color-text-tertiary) hover:text-(--color-text-secondary) transition-colors">
          Atla
        </button>
        <button onClick={() => void save()} disabled={saving}
          className="flex-1 h-10 rounded-xl bg-(--color-coral) text-white text-sm font-semibold hover:bg-(--color-coral-hover) transition-colors disabled:opacity-60 flex items-center justify-center gap-2">
          {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Kaydet'}
        </button>
      </div>
    </div>
  )
}

// ─── Follow ───────────────────────────────────────────────────────────────────

function FollowStep({ onNext }: { onNext: () => void }) {
  const [actors, setActors] = useState<Actor[]>([])
  const [loading, setLoading] = useState(true)
  const [following, setFollowing] = useState<Set<string>>(new Set())
  const [inFlight, setInFlight] = useState<Set<string>>(new Set())

  useEffect(() => {
    api.actors.suggested()
      .then((d) => setActors(d.actors.slice(0, 8)))
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  async function toggle(handle: string) {
    if (inFlight.has(handle)) return
    setInFlight((s) => new Set(s).add(handle))
    try {
      if (following.has(handle)) {
        await api.actors.unfollow(handle)
        setFollowing((s) => { const n = new Set(s); n.delete(handle); return n })
      } else {
        await api.actors.follow(handle)
        setFollowing((s) => new Set(s).add(handle))
        triggerHaptic('light')
      }
    } catch {}
    finally { setInFlight((s) => { const n = new Set(s); n.delete(handle); return n }) }
  }

  return (
    <div className="space-y-6">
      <div className="space-y-1.5">
        <h2 className="text-xl font-bold text-(--color-text-primary)" style={{ fontFamily: 'var(--font-outfit)' }}>
          Kimlerle başlıyorsun?
        </h2>
        <p className="text-sm text-(--color-text-secondary)">
          {actors.length > 0 ? 'Takip ettiklerinin gönderileri akışında görünür.' : 'Henüz başka kullanıcı yok — ilk sen katıldın.'}
        </p>
      </div>

      {loading ? (
        <div className="flex justify-center py-10">
          <Loader2 className="w-5 h-5 animate-spin text-(--color-coral)" />
        </div>
      ) : actors.length > 0 ? (
        <div className="grid grid-cols-2 gap-3">
          {actors.map((actor) => {
            const isFollowing = following.has(actor.handle)
            const pending = inFlight.has(actor.handle)
            return (
              <button
                key={actor.id}
                onClick={() => void toggle(actor.handle)}
                disabled={pending}
                className={cn(
                  'flex flex-col items-center gap-2 p-4 rounded-2xl border text-center transition-all',
                  isFollowing
                    ? 'border-(--color-coral) bg-(--color-coral)/5'
                    : 'border-(--color-border) bg-(--color-background) hover:border-(--color-coral)/40',
                )}
              >
                <div className="relative">
                  <Avatar className="w-12 h-12">
                    {actor.avatarUrl && <AvatarImage src={actor.avatarUrl} />}
                    <AvatarFallback className="text-sm font-bold text-white" style={{ background: 'var(--gradient-avatar)' }}>
                      {(actor.displayName ?? actor.handle).slice(0, 2).toUpperCase()}
                    </AvatarFallback>
                  </Avatar>
                  {isFollowing && (
                    <div className="absolute -bottom-0.5 -right-0.5 w-5 h-5 rounded-full bg-(--color-coral) flex items-center justify-center">
                      <Check className="w-3 h-3 text-white" strokeWidth={3} />
                    </div>
                  )}
                </div>
                <div className="min-w-0 w-full">
                  <p className="text-xs font-semibold text-(--color-text-primary) truncate">
                    {actor.displayName ?? actor.handle}
                  </p>
                  <p className="text-[11px] text-(--color-text-tertiary) truncate">@{actor.handle}</p>
                </div>
                {pending && <Loader2 className="w-3 h-3 animate-spin text-(--color-coral)" />}
              </button>
            )
          })}
        </div>
      ) : null}

      <div className="flex gap-3">
        <button onClick={onNext}
          className="flex-1 h-10 rounded-xl border border-(--color-border) text-sm text-(--color-text-tertiary) hover:text-(--color-text-secondary) transition-colors">
          Atla
        </button>
        <button onClick={onNext}
          className="flex-1 h-10 rounded-xl bg-(--color-coral) text-white text-sm font-semibold hover:bg-(--color-coral-hover) transition-colors">
          {following.size > 0 ? `${following.size} kişiyle devam` : 'Devam'}
        </button>
      </div>
    </div>
  )
}

// ─── Fediverse Import ─────────────────────────────────────────────────────────

type RemoteActor = { handle: string; displayName: string | null; avatarUrl: string | null }

function FediverseStep({ onNext }: { onNext: () => void }) {
  const [input, setInput] = useState('')
  const [searching, setSearching] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [total, setTotal] = useState<number | null>(null)
  const [actors, setActors] = useState<RemoteActor[]>([])
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [importing, setImporting] = useState(false)
  const [done, setDone] = useState(false)

  async function search() {
    const handle = input.trim()
    if (!handle) return
    setSearching(true)
    setError(null)
    setActors([])
    setTotal(null)
    setDone(false)
    try {
      const res = await api.account.fediversePreview(handle)
      setTotal(res.total)
      setActors(res.actors)
      setSelected(new Set(res.actors.map(a => a.handle)))
    } catch (err) {
      setError((err as { message?: string }).message ?? 'Bir hata oluştu')
    } finally {
      setSearching(false)
    }
  }

  function toggleActor(handle: string) {
    setSelected(s => {
      const n = new Set(s)
      if (n.has(handle)) n.delete(handle)
      else n.add(handle)
      return n
    })
  }

  async function importSelected() {
    if (selected.size === 0) { onNext(); return }
    setImporting(true)
    const handles = [...selected]
    await Promise.allSettled(handles.map(h => api.actors.follow(h)))
    setImporting(false)
    setDone(true)
    triggerHaptic('success')
  }

  return (
    <div className="space-y-6">
      <div className="space-y-1.5">
        <h2 className="text-xl font-bold text-(--color-text-primary)" style={{ fontFamily: 'var(--font-outfit)' }}>
          Mastodon hesabın var mı?
        </h2>
        <p className="text-sm text-(--color-text-secondary)">
          Mevcut takip listenizi floq'a aktarabilirsin. Pixelfed, Pleroma ve diğer fediverse hesapları da çalışır.
        </p>
      </div>

      {/* Input */}
      <div className="flex gap-2">
        <div className="flex-1 relative">
          <input
            type="text"
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') void search() }}
            placeholder="@kullanici@mastodon.social"
            className="w-full h-10 px-3 text-sm rounded-xl border border-(--color-border) bg-(--color-background) text-(--color-text-primary) placeholder:text-(--color-text-tertiary) focus:outline-none focus:border-(--color-coral) transition-colors font-mono"
          />
        </div>
        <button
          onClick={() => void search()}
          disabled={searching || !input.trim()}
          className="h-10 px-4 rounded-xl bg-(--color-coral) text-white text-sm font-semibold hover:bg-(--color-coral-hover) transition-colors disabled:opacity-50 flex items-center gap-1.5"
        >
          {searching ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
          {!searching && 'Bul'}
        </button>
      </div>

      {/* Error */}
      {error && (
        <p className="text-sm text-red-500">{error}</p>
      )}

      {/* Results */}
      {total !== null && !done && (
        <div className="space-y-3">
          <p className="text-sm text-(--color-text-secondary)">
            <span className="font-semibold text-(--color-text-primary)">{total.toLocaleString('tr')}</span> hesabı takip ediyorsun.
            {actors.length > 0 && ` İlk ${actors.length} tanesi:`}
          </p>

          {actors.length > 0 && (
            <div className="rounded-xl border border-(--color-border) overflow-hidden">
              {actors.map((actor, i) => {
                const isSel = selected.has(actor.handle)
                return (
                  <button
                    key={actor.handle}
                    onClick={() => toggleActor(actor.handle)}
                    className={cn(
                      'w-full flex items-center gap-3 px-4 py-2.5 text-left transition-colors',
                      i > 0 && 'border-t border-(--color-border-secondary)',
                      isSel
                        ? 'bg-(--color-coral)/5'
                        : 'hover:bg-(--color-background-secondary)',
                    )}
                  >
                    <Avatar className="w-7 h-7 flex-shrink-0">
                      {actor.avatarUrl && <AvatarImage src={actor.avatarUrl} />}
                      <AvatarFallback className="text-[10px] font-bold text-white" style={{ background: 'var(--gradient-avatar)' }}>
                        {(actor.displayName ?? actor.handle).slice(0, 2).toUpperCase()}
                      </AvatarFallback>
                    </Avatar>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-semibold text-(--color-text-primary) truncate">
                        {actor.displayName ?? actor.handle}
                      </p>
                      <p className="text-[11px] text-(--color-text-tertiary) truncate font-mono">@{actor.handle}</p>
                    </div>
                    <div className={cn(
                      'w-4 h-4 rounded-full border-2 flex-shrink-0 flex items-center justify-center transition-all',
                      isSel ? 'bg-(--color-coral) border-(--color-coral)' : 'border-(--color-border)',
                    )}>
                      {isSel && <Check className="w-2.5 h-2.5 text-white" strokeWidth={3} />}
                    </div>
                  </button>
                )
              })}
            </div>
          )}

          <button
            onClick={() => void importSelected()}
            disabled={importing || selected.size === 0}
            className="w-full h-10 rounded-xl bg-(--color-coral) text-white text-sm font-semibold hover:bg-(--color-coral-hover) transition-colors disabled:opacity-60 flex items-center justify-center gap-2"
          >
            {importing
              ? <><Loader2 className="w-4 h-4 animate-spin" /> Aktarılıyor…</>
              : selected.size > 0
                ? `${selected.size} hesabı takip et`
                : 'Hiçbiri seçili değil'
            }
          </button>
        </div>
      )}

      {/* Done state */}
      {done && (
        <div className="rounded-xl bg-(--color-coral)/8 border border-(--color-coral)/20 px-4 py-3 flex items-center gap-3">
          <Check className="w-4 h-4 text-(--color-coral) flex-shrink-0" strokeWidth={2.5} />
          <p className="text-sm text-(--color-text-primary)">{selected.size} hesap takip edildi.</p>
        </div>
      )}

      <div className="flex gap-3">
        <button onClick={onNext}
          className="flex-1 h-10 rounded-xl border border-(--color-border) text-sm text-(--color-text-tertiary) hover:text-(--color-text-secondary) transition-colors">
          {done ? 'Devam' : 'Atla'}
        </button>
        {!done && total === null && (
          <button onClick={onNext}
            className="flex-1 h-10 rounded-xl bg-(--color-coral) text-white text-sm font-semibold hover:bg-(--color-coral-hover) transition-colors">
            Mastodon hesabım yok
          </button>
        )}
        {done && (
          <button onClick={onNext}
            className="flex-1 h-10 rounded-xl bg-(--color-coral) text-white text-sm font-semibold hover:bg-(--color-coral-hover) transition-colors">
            Devam et
          </button>
        )}
      </div>
    </div>
  )
}

// ─── Interests ────────────────────────────────────────────────────────────────

const TOPICS = [
  'teknoloji', 'yazılım', 'yapay zeka', 'tasarım',
  'müzik', 'sinema', 'oyun', 'kitap',
  'bilim', 'fotoğrafçılık', 'spor', 'seyahat',
  'yemek', 'doğa', 'sanat', 'tarih',
  'politika', 'ekonomi',
]

function InterestsStep({ onNext }: { onNext: () => void }) {
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [saving, setSaving] = useState(false)

  function toggle(tag: string) {
    setSelected((s) => {
      const n = new Set(s)
      if (n.has(tag)) n.delete(tag)
      else { n.add(tag); triggerHaptic('selection') }
      return n
    })
  }

  async function save() {
    if (selected.size === 0) { onNext(); return }
    setSaving(true)
    try { await Promise.allSettled([...selected].map((t) => api.hashtags.follow(t.replace(' ', '-')))) }
    finally { setSaving(false); onNext() }
  }

  return (
    <div className="space-y-6">
      <div className="space-y-1.5">
        <h2 className="text-xl font-bold text-(--color-text-primary)" style={{ fontFamily: 'var(--font-outfit)' }}>
          Neler ilgini çekiyor?
        </h2>
        <p className="text-sm text-(--color-text-secondary)">
          Seçtiklerinden ilgili içerikler akışına gelir.
        </p>
      </div>

      <div className="flex flex-wrap gap-2">
        {TOPICS.map((tag) => {
          const on = selected.has(tag)
          return (
            <button key={tag} onClick={() => toggle(tag)}
              className={cn(
                'px-4 py-2 rounded-full text-sm font-medium transition-all',
                on
                  ? 'bg-(--color-coral) text-white'
                  : 'bg-(--color-background-secondary) border border-(--color-border) text-(--color-text-secondary) hover:border-(--color-coral)/40 hover:text-(--color-text-primary)',
              )}
            >
              {tag.charAt(0).toUpperCase() + tag.slice(1)}
            </button>
          )
        })}
      </div>

      <div className="flex gap-3">
        <button onClick={onNext}
          className="flex-1 h-10 rounded-xl border border-(--color-border) text-sm text-(--color-text-tertiary) hover:text-(--color-text-secondary) transition-colors">
          Atla
        </button>
        <button onClick={() => void save()} disabled={saving}
          className="flex-1 h-10 rounded-xl bg-(--color-coral) text-white text-sm font-semibold hover:bg-(--color-coral-hover) transition-colors disabled:opacity-60 flex items-center justify-center">
          {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : selected.size > 0 ? `${selected.size} konu seçildi` : 'Devam'}
        </button>
      </div>
    </div>
  )
}

// ─── Done ─────────────────────────────────────────────────────────────────────

function DoneStep({ onFinish }: { onFinish: () => void }) {
  const [loading, setLoading] = useState(false)

  return (
    <div className="space-y-8 text-center">
      <div className="space-y-2.5">
        <div className="w-11 h-11 rounded-full bg-(--color-coral)/10 flex items-center justify-center mx-auto">
          <Check className="w-5 h-5 text-(--color-coral)" strokeWidth={2.5} />
        </div>
        <h2 className="text-2xl font-bold text-(--color-text-primary)" style={{ fontFamily: 'var(--font-outfit)' }}>
          Hazırsın.
        </h2>
        <p className="text-sm text-(--color-text-secondary)">
          Akışın seni bekliyor.
        </p>
      </div>

      <button
        onClick={async () => { setLoading(true); await onFinish() }}
        disabled={loading}
        className="w-full h-10 rounded-xl bg-(--color-coral) text-white font-semibold text-sm hover:bg-(--color-coral-hover) transition-colors disabled:opacity-60 flex items-center justify-center"
      >
        {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Akışıma git'}
      </button>
    </div>
  )
}
