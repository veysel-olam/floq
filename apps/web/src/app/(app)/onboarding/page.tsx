'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useSession } from '@/lib/auth-client'
import { api, type Actor } from '@/lib/api'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { Loader2, Check, Users, Globe, Shield, Zap, ArrowRight, Hash } from 'lucide-react'
import { cn } from '@/lib/utils'

type Step = 'welcome' | 'profile' | 'follow' | 'interests' | 'done'

const STEPS: Step[] = ['welcome', 'profile', 'follow', 'interests', 'done']

const PANEL_SLIDES = [
  {
    icon: Globe,
    title: 'Fediverse ile bağlantı kur.',
    body: 'floq hesabın Mastodon, Pixelfed ve yüzlerce platformla konuşur. Gerçek bir açık web.',
  },
  {
    icon: Shield,
    title: 'Verilerini sen kontrol et.',
    body: 'Tek bir şirketin sunucusunda hapsolmak yok. Algoritmalar değil, sen karar verirsin.',
  },
  {
    icon: Zap,
    title: 'Reklam yok. Asla.',
    body: 'Akışın seni satmak için tasarlanmadı. Sadece ilgilendiğin şeyler, tam istediğin gibi.',
  },
]

export default function OnboardingPage() {
  const { data: session, isPending } = useSession()
  const router = useRouter()
  const [step, setStep] = useState<Step>('welcome')
  const [panelSlide, setPanelSlide] = useState(0)

  useEffect(() => {
    if (!isPending && !session) router.replace('/login')
  }, [isPending, session, router])

  useEffect(() => {
    const t = setInterval(() => setPanelSlide((s) => (s + 1) % PANEL_SLIDES.length), 4000)
    return () => clearInterval(t)
  }, [])

  if (isPending) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-(--color-background)">
        <Loader2 className="w-6 h-6 animate-spin text-(--color-coral)" />
      </div>
    )
  }

  const stepIndex = STEPS.indexOf(step)
  const slide = PANEL_SLIDES[panelSlide]

  return (
    <>
      <style>{`
        @keyframes ob-in { from { opacity: 0; transform: translateY(18px); } to { opacity: 1; transform: translateY(0); } }
        @keyframes ob-slide-fade { 0%,100% { opacity:0; transform:translateY(12px); } 15%,85% { opacity:1; transform:translateY(0); } }
        @keyframes ob-orb { 0%,100% { transform:scale(1) translate(0,0); } 50% { transform:scale(1.15) translate(20px,-15px); } }
        @keyframes ob-check { 0% { stroke-dashoffset:60; } 100% { stroke-dashoffset:0; } }
        @keyframes ob-burst { 0% { opacity:1; transform:scale(0) translateY(0); } 100% { opacity:0; transform:scale(1) translateY(-60px); } }
        .ob-in { animation: ob-in 0.45s cubic-bezier(.22,1,.36,1) both; }
        .ob-slide { animation: ob-slide-fade 4s ease-in-out infinite; }
        .ob-orb { animation: ob-orb 8s ease-in-out infinite; }
      `}</style>

      <div className="min-h-screen flex bg-(--color-background)">
        {/* ── Left brand panel ── */}
        <div
          className="hidden lg:flex lg:w-[44%] xl:w-[42%] flex-col relative overflow-hidden"
          style={{ background: 'linear-gradient(160deg, #0C0C0B 0%, #161410 100%)' }}
        >
          {/* Orbs */}
          <div className="ob-orb pointer-events-none absolute -top-32 -left-32 w-[500px] h-[500px] rounded-full blur-3xl opacity-30"
            style={{ background: 'radial-gradient(circle, #E8593C 0%, transparent 65%)' }} />
          <div className="ob-orb pointer-events-none absolute -bottom-40 right-0 w-[400px] h-[400px] rounded-full blur-3xl opacity-20"
            style={{ background: 'radial-gradient(circle, #2EC4B6 0%, transparent 65%)', animationDelay: '-4s' }} />

          {/* Grain overlay */}
          <div className="pointer-events-none absolute inset-0 opacity-[0.03]"
            style={{ backgroundImage: 'url("data:image/svg+xml,%3Csvg viewBox=\'0 0 256 256\' xmlns=\'http://www.w3.org/2000/svg\'%3E%3Cfilter id=\'n\'%3E%3CfeTurbulence type=\'fractalNoise\' baseFrequency=\'0.9\' numOctaves=\'4\' stitchTiles=\'stitch\'/%3E%3C/filter%3E%3Crect width=\'100%25\' height=\'100%25\' filter=\'url(%23n)\'/%3E%3C/svg%3E")', backgroundSize: '200px 200px' }} />

          <div className="relative z-10 flex flex-col h-full p-10 justify-between">
            {/* Logo */}
            <span className="text-2xl font-bold text-white" style={{ fontFamily: 'var(--font-outfit)' }}>
              fl<span style={{ color: '#E8593C' }}>o</span>q
            </span>

            {/* Center content */}
            <div className="space-y-8">
              <div className="ob-slide" key={panelSlide}>
                <div className="w-12 h-12 rounded-2xl flex items-center justify-center mb-6"
                  style={{ background: 'rgba(232, 89, 60, 0.15)', border: '1px solid rgba(232, 89, 60, 0.25)' }}>
                  <slide.icon className="w-6 h-6" style={{ color: '#E8593C' }} />
                </div>
                <p className="text-3xl font-bold text-white leading-tight mb-3" style={{ fontFamily: 'var(--font-outfit)' }}>
                  {slide.title}
                </p>
                <p className="text-base text-white/50 leading-relaxed max-w-xs">
                  {slide.body}
                </p>
              </div>

              {/* Slide dots */}
              <div className="flex gap-2">
                {PANEL_SLIDES.map((_, i) => (
                  <button
                    key={i}
                    onClick={() => setPanelSlide(i)}
                    className="h-1.5 rounded-full transition-all duration-300"
                    style={{
                      width: i === panelSlide ? '24px' : '6px',
                      background: i === panelSlide ? '#E8593C' : 'rgba(255,255,255,0.2)',
                    }}
                  />
                ))}
              </div>
            </div>

            {/* Bottom fediverse hint */}
            <p className="text-xs text-white/25 tracking-wide">ActivityPub · Açık Kaynak · Senin</p>
          </div>
        </div>

        {/* ── Right step panel ── */}
        <div className="flex-1 flex flex-col items-center justify-center px-5 py-12 relative">
          {/* Mobile logo */}
          <div className="lg:hidden mb-8">
            <span className="text-2xl font-bold text-(--color-text-primary)" style={{ fontFamily: 'var(--font-outfit)' }}>
              fl<span style={{ color: '#E8593C' }}>o</span>q
            </span>
          </div>

          <div className="w-full max-w-md">
            {/* Step indicator */}
            {step !== 'done' && (
              <div className="flex items-center gap-2 justify-center mb-8">
                {(['welcome', 'profile', 'follow', 'interests'] as const).map((s, i) => (
                  <div key={s} className="flex items-center gap-2">
                    <div className={cn(
                      'w-7 h-7 rounded-full flex items-center justify-center text-xs font-semibold transition-all duration-300',
                      stepIndex > i
                        ? 'text-white'
                        : stepIndex === i
                          ? 'border-2 text-(--color-coral)'
                          : 'border-2 text-(--color-text-tertiary)',
                    )}
                      style={{
                        background: stepIndex > i ? '#E8593C' : undefined,
                        borderColor: stepIndex >= i ? '#E8593C' : undefined,
                      }}>
                      {stepIndex > i ? <Check className="w-3.5 h-3.5" /> : i + 1}
                    </div>
                    {i < 3 && (
                      <div className="w-8 h-0.5 rounded transition-all duration-500"
                        style={{ background: stepIndex > i ? '#E8593C' : 'var(--color-border)' }} />
                    )}
                  </div>
                ))}
              </div>
            )}

            {/* Card */}
            <div className="bg-(--color-surface) border border-(--color-border) rounded-2xl p-7 shadow-xl shadow-black/[0.06] dark:shadow-black/30 ob-in" key={step}>
              {step === 'welcome' && <WelcomeStep session={session} onNext={() => setStep('profile')} />}
              {step === 'profile' && <ProfileStep session={session} onNext={() => setStep('follow')} />}
              {step === 'follow' && <FollowStep onNext={() => setStep('interests')} />}
              {step === 'interests' && <InterestsStep onNext={() => setStep('done')} />}
              {step === 'done' && <DoneStep onFinish={() => router.replace('/home')} />}
            </div>
          </div>
        </div>
      </div>
    </>
  )
}

// ─── Step 1: Welcome ─────────────────────────────────────────────────────────

function WelcomeStep({
  session,
  onNext,
}: {
  session: ReturnType<typeof useSession>['data']
  onNext: () => void
}) {
  const name = session?.user.name ?? 'Merhaba'
  const handle = (session?.user as { handle?: string } | undefined)?.handle ?? ''

  return (
    <div className="space-y-6">
      <div className="space-y-1">
        <h1 className="text-2xl font-bold text-(--color-text-primary)" style={{ fontFamily: 'var(--font-outfit)' }}>
          Hoş geldin, {name}! 👋
        </h1>
        <p className="text-sm text-(--color-text-secondary) leading-relaxed">
          Birkaç adımda seni floq akışına hazırlayalım.
        </p>
      </div>

      {handle && (
        <div className="flex items-center gap-2.5 px-4 py-3 rounded-xl"
          style={{ background: 'rgba(232, 89, 60, 0.07)', border: '1px solid rgba(232, 89, 60, 0.2)' }}>
          <Globe className="w-4 h-4 flex-shrink-0" style={{ color: '#E8593C' }} />
          <div>
            <p className="text-xs text-(--color-text-tertiary) mb-0.5">Fediverse kimliğin</p>
            <p className="text-sm font-semibold text-(--color-text-primary) font-mono">@{handle}@floq.com</p>
          </div>
        </div>
      )}

      <ul className="space-y-3">
        {[
          { step: '1', label: 'Profilini tanıt' },
          { step: '2', label: 'İlginç kişileri takip et' },
          { step: '3', label: 'İlgi alanlarını seç' },
          { step: '4', label: 'Akışına başla' },
        ].map((item) => (
          <li key={item.step} className="flex items-center gap-3 text-sm text-(--color-text-secondary)">
            <span className="w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold text-white flex-shrink-0"
              style={{ background: 'var(--gradient-avatar)' }}>
              {item.step}
            </span>
            {item.label}
          </li>
        ))}
      </ul>

      <Button
        onClick={onNext}
        className="w-full text-white font-semibold gap-2 h-11"
        style={{ background: 'var(--gradient-avatar)' }}
      >
        Başlayalım <ArrowRight className="w-4 h-4" />
      </Button>
    </div>
  )
}

// ─── Step 2: Profile ─────────────────────────────────────────────────────────

function ProfileStep({
  session,
  onNext,
}: {
  session: ReturnType<typeof useSession>['data']
  onNext: () => void
}) {
  const [bio, setBio] = useState('')
  const [saving, setSaving] = useState(false)

  async function save() {
    if (!bio.trim()) { onNext(); return }
    setSaving(true)
    try { await api.account.updateProfile({ bio: bio.trim() }) } catch {}
    finally { setSaving(false); onNext() }
  }

  const handle = (session?.user as { handle?: string } | undefined)?.handle ?? ''
  const name = session?.user.name ?? ''
  const initials = name.slice(0, 2).toUpperCase() || '?'

  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-xl font-bold text-(--color-text-primary) mb-1" style={{ fontFamily: 'var(--font-outfit)' }}>
          Profilini tanıt
        </h2>
        <p className="text-sm text-(--color-text-tertiary)">
          Biyografi isteğe bağlı — her zaman değiştirebilirsin.
        </p>
      </div>

      <div className="flex items-center gap-4 p-4 rounded-xl bg-(--color-background-secondary)">
        <div className="w-14 h-14 rounded-full flex items-center justify-center text-white text-base font-bold flex-shrink-0"
          style={{ background: 'var(--gradient-avatar)' }}>
          {initials}
        </div>
        <div>
          <p className="text-sm font-semibold text-(--color-text-primary)">{name}</p>
          <p className="text-xs text-(--color-text-tertiary) font-mono">@{handle}@floq.com</p>
        </div>
      </div>

      <div>
        <Label className="text-sm text-(--color-text-secondary) mb-2 block">Biyografi</Label>
        <Textarea
          value={bio}
          onChange={(e) => setBio(e.target.value)}
          maxLength={500}
          rows={3}
          placeholder="Kendinden kısaca bahset…"
          className="resize-none"
        />
        <p className="text-xs text-(--color-text-tertiary) mt-1.5 text-right">{bio.length}/500</p>
      </div>

      <div className="flex gap-2 pt-1">
        <Button variant="ghost" onClick={onNext} className="flex-1 text-(--color-text-tertiary)">
          Atla
        </Button>
        <Button
          onClick={() => void save()}
          disabled={saving}
          className="flex-1 text-white font-semibold"
          style={{ background: 'var(--gradient-avatar)' }}
        >
          {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Kaydet & Devam'}
        </Button>
      </div>
    </div>
  )
}

// ─── Step 3: Follow ──────────────────────────────────────────────────────────

function FollowStep({ onNext }: { onNext: () => void }) {
  const [actors, setActors] = useState<Actor[]>([])
  const [loading, setLoading] = useState(true)
  const [following, setFollowing] = useState<Set<string>>(new Set())
  const [inFlight, setInFlight] = useState<Set<string>>(new Set())

  useEffect(() => {
    api.actors.suggested()
      .then((data) => setActors(data.actors.slice(0, 10)))
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  async function toggleFollow(handle: string) {
    if (inFlight.has(handle)) return
    setInFlight((s) => new Set(s).add(handle))
    try {
      if (following.has(handle)) {
        await api.actors.unfollow(handle)
        setFollowing((s) => { const n = new Set(s); n.delete(handle); return n })
      } else {
        await api.actors.follow(handle)
        setFollowing((s) => new Set(s).add(handle))
      }
    } catch {}
    finally {
      setInFlight((s) => { const n = new Set(s); n.delete(handle); return n })
    }
  }

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-xl font-bold text-(--color-text-primary) mb-1" style={{ fontFamily: 'var(--font-outfit)' }}>
          Kişileri takip et
        </h2>
        <p className="text-sm text-(--color-text-tertiary)">
          {actors.length > 0 ? 'Floq\'ta aktif kullanıcılar. İstediğini atla.' : 'İlk katılanlardan birisin!'}
        </p>
      </div>

      {loading ? (
        <div className="flex items-center justify-center h-36">
          <Loader2 className="w-5 h-5 animate-spin text-(--color-coral)" />
        </div>
      ) : actors.length === 0 ? (
        <div className="flex flex-col items-center justify-center h-36 text-center gap-3">
          <div className="w-12 h-12 rounded-2xl flex items-center justify-center bg-(--color-background-secondary)">
            <Users className="w-6 h-6 text-(--color-text-tertiary)" />
          </div>
          <p className="text-sm text-(--color-text-tertiary)">Henüz başka kullanıcı yok.</p>
        </div>
      ) : (
        <div className="space-y-1.5 max-h-64 overflow-y-auto -mx-1 px-1">
          {actors.map((actor) => {
            const initials = (actor.displayName ?? actor.handle).slice(0, 2).toUpperCase()
            const isFollowing = following.has(actor.handle)
            const pending = inFlight.has(actor.handle)
            return (
              <div
                key={actor.id}
                className="flex items-center gap-3 p-2.5 rounded-xl hover:bg-(--color-background-secondary) transition-colors"
              >
                <Avatar className="w-9 h-9 flex-shrink-0">
                  {actor.avatarUrl && <AvatarImage src={actor.avatarUrl} alt={actor.displayName ?? actor.handle} />}
                  <AvatarFallback className="text-xs font-bold text-white"
                    style={{ background: 'var(--gradient-avatar)' }}>
                    {initials}
                  </AvatarFallback>
                </Avatar>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-(--color-text-primary) truncate">
                    {actor.displayName ?? actor.handle}
                  </p>
                  <p className="text-xs text-(--color-text-tertiary)">@{actor.handle}</p>
                </div>
                <button
                  onClick={() => void toggleFollow(actor.handle)}
                  disabled={pending}
                  className={cn(
                    'flex-shrink-0 px-3.5 py-1.5 rounded-full text-xs font-semibold transition-all',
                    isFollowing
                      ? 'bg-(--color-background-secondary) text-(--color-text-secondary) hover:text-red-500'
                      : 'text-white',
                  )}
                  style={!isFollowing ? { background: 'var(--gradient-avatar)' } : undefined}
                >
                  {pending ? <Loader2 className="w-3 h-3 animate-spin" /> : isFollowing ? 'Takiptesin' : 'Takip et'}
                </button>
              </div>
            )
          })}
        </div>
      )}

      <div className="flex gap-2 pt-1">
        <Button variant="ghost" onClick={onNext} className="flex-1 text-(--color-text-tertiary)">
          Atla
        </Button>
        <Button
          onClick={onNext}
          className="flex-1 text-white font-semibold"
          style={{ background: 'var(--gradient-avatar)' }}
        >
          {following.size > 0 ? `${following.size} kişiyi takip et` : 'Devam'}
        </Button>
      </div>
    </div>
  )
}

// ─── Step 4: Interests ───────────────────────────────────────────────────────

const INTEREST_TOPICS = [
  { tag: 'teknoloji', emoji: '💻' },
  { tag: 'yazılım', emoji: '🛠️' },
  { tag: 'yapay-zeka', emoji: '🤖' },
  { tag: 'tasarım', emoji: '🎨' },
  { tag: 'müzik', emoji: '🎵' },
  { tag: 'sinema', emoji: '🎬' },
  { tag: 'oyun', emoji: '🎮' },
  { tag: 'kitap', emoji: '📚' },
  { tag: 'bilim', emoji: '🔭' },
  { tag: 'fotoğrafçılık', emoji: '📷' },
  { tag: 'spor', emoji: '⚽' },
  { tag: 'seyahat', emoji: '✈️' },
  { tag: 'yemek', emoji: '🍜' },
  { tag: 'doğa', emoji: '🌿' },
  { tag: 'sanat', emoji: '🖼️' },
  { tag: 'tarih', emoji: '🏛️' },
  { tag: 'politika', emoji: '🗳️' },
  { tag: 'ekonomi', emoji: '📈' },
]

function InterestsStep({ onNext }: { onNext: () => void }) {
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [saving, setSaving] = useState(false)

  function toggle(tag: string) {
    setSelected((s) => {
      const n = new Set(s)
      if (n.has(tag)) n.delete(tag)
      else n.add(tag)
      return n
    })
  }

  async function save() {
    if (selected.size === 0) { onNext(); return }
    setSaving(true)
    try {
      await Promise.allSettled([...selected].map((tag) => api.hashtags.follow(tag)))
    } finally {
      setSaving(false)
      onNext()
    }
  }

  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-xl font-bold text-(--color-text-primary) mb-1" style={{ fontFamily: 'var(--font-outfit)' }}>
          İlgi alanlarını seç
        </h2>
        <p className="text-sm text-(--color-text-tertiary)">
          Seçtiğin konular akışına yansır. İstediğin zaman değiştirebilirsin.
        </p>
      </div>

      <div className="flex flex-wrap gap-2">
        {INTEREST_TOPICS.map(({ tag, emoji }) => {
          const isSelected = selected.has(tag)
          return (
            <button
              key={tag}
              onClick={() => toggle(tag)}
              className={cn(
                'flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-medium transition-all active:scale-95',
                isSelected
                  ? 'text-white'
                  : 'bg-(--color-background-secondary) text-(--color-text-secondary) hover:bg-(--color-background-secondary) hover:text-(--color-text-primary) border border-(--color-border)',
              )}
              style={isSelected ? { background: 'var(--gradient-avatar)' } : undefined}
            >
              <span>{emoji}</span>
              <Hash className="w-3 h-3 opacity-60" />
              {tag}
            </button>
          )
        })}
      </div>

      {selected.size > 0 && (
        <p className="text-xs text-(--color-text-tertiary)">
          {selected.size} konu seçildi
        </p>
      )}

      <div className="flex gap-2 pt-1">
        <Button variant="ghost" onClick={onNext} className="flex-1 text-(--color-text-tertiary)">
          Atla
        </Button>
        <Button
          onClick={() => void save()}
          disabled={saving}
          className="flex-1 text-white font-semibold"
          style={{ background: 'var(--gradient-avatar)' }}
        >
          {saving
            ? <Loader2 className="w-4 h-4 animate-spin" />
            : selected.size > 0 ? `${selected.size} konuyu takip et` : 'Devam'
          }
        </Button>
      </div>
    </div>
  )
}

// ─── Step 5: Done ────────────────────────────────────────────────────────────

function DoneStep({ onFinish }: { onFinish: () => void }) {
  return (
    <div className="text-center space-y-6 py-2">
      <div className="relative w-20 h-20 mx-auto">
        {/* Pulse rings */}
        <div className="absolute inset-0 rounded-full opacity-20 animate-ping"
          style={{ background: '#E8593C' }} />
        <div className="absolute inset-2 rounded-full opacity-30 animate-ping animation-delay-150"
          style={{ background: '#E8593C', animationDelay: '0.15s' }} />
        <div className="relative w-20 h-20 rounded-full flex items-center justify-center"
          style={{ background: 'var(--gradient-avatar)' }}>
          <Check className="w-9 h-9 text-white" strokeWidth={3} />
        </div>
      </div>

      <div>
        <h2 className="text-2xl font-bold text-(--color-text-primary) mb-2" style={{ fontFamily: 'var(--font-outfit)' }}>
          Hazırsın!
        </h2>
        <p className="text-sm text-(--color-text-secondary) leading-relaxed">
          Profil hazır. Şimdi akışını keşfet ve fediverse'e katıl.
        </p>
      </div>

      <div className="grid grid-cols-3 gap-3 text-center">
        {[
          { label: 'Özgür', desc: 'Açık kaynak' },
          { label: 'Federe', desc: 'ActivityPub' },
          { label: 'Senin', desc: 'Veriler sende' },
        ].map((item) => (
          <div key={item.label} className="px-2 py-3 rounded-xl bg-(--color-background-secondary)">
            <p className="text-sm font-bold text-(--color-text-primary)">{item.label}</p>
            <p className="text-[11px] text-(--color-text-tertiary) mt-0.5">{item.desc}</p>
          </div>
        ))}
      </div>

      <Button
        onClick={onFinish}
        className="w-full text-white font-semibold h-11 gap-2"
        style={{ background: 'var(--gradient-avatar)' }}
      >
        Akışıma git <ArrowRight className="w-4 h-4" />
      </Button>
    </div>
  )
}
