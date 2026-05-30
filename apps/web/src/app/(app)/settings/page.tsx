'use client'

import { useState, useEffect, useCallback, useRef, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { QRCodeSVG } from 'qrcode.react'
import { useSession, authClient } from '@/lib/auth-client'
import { api, type Actor, type MutedActor, type KeywordFilter, type SessionInfo, type FeedRule, type FeedRulesConfig, type ListInfo, type ActorPreferences, type NotificationPrefs } from '@/lib/api'
import { instanceDomain } from '@/lib/instance'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { cn } from '@/lib/utils'
import { useTheme } from 'next-themes'
import { usePushNotifications } from '@/hooks/use-push-notifications'
import {
  Loader2,
  User,
  Shield,
  MonitorSmartphone,
  Trash2,
  Check,
  AlertTriangle,
  Download,
  LogOut,
  Sliders,
  Camera,
  Sun,
  Moon,
  Monitor,
  ShieldOff,
  BellOff,
  Bell,
  X,
  Filter,
  Plus,
  MoveRight,
  Copy,
  AtSign,
  ExternalLink,
  Zap,
  HelpCircle,
  MessageCircle,
  BookOpen,
  GitBranch,
  FileText,
  Lock,
  ShieldCheck,
  RefreshCw,
  Clock,
  Flame,
  Scale,
  MessageSquare,
  Globe,
  List,
  Star,
  ChevronDown,
  ChevronRight,
  Pencil,
  BookMarked,
  Activity,
  Settings,
  UserCog,
  UserX,
  Palette,
  Snowflake,
} from 'lucide-react'

type Tab = 'profile' | 'privacy' | 'moderation' | 'filters' | 'feed' | 'notifications' | 'security' | 'sessions' | 'appearance' | 'account' | 'help'

const tabs: { id: Tab; label: string; icon: React.ReactNode }[] = [
  { id: 'profile', label: 'Profil', icon: <User className="w-4 h-4" /> },
  { id: 'privacy', label: 'Gizlilik', icon: <Lock className="w-4 h-4" /> },
  { id: 'moderation', label: 'Moderasyon', icon: <UserX className="w-4 h-4" /> },
  { id: 'filters', label: 'Filtreler', icon: <Filter className="w-4 h-4" /> },
  { id: 'feed', label: 'Feed', icon: <Sliders className="w-4 h-4" /> },
  { id: 'notifications', label: 'Bildirimler', icon: <Bell className="w-4 h-4" /> },
  { id: 'security', label: 'Güvenlik', icon: <Shield className="w-4 h-4" /> },
  { id: 'sessions', label: 'Oturumlar', icon: <MonitorSmartphone className="w-4 h-4" /> },
  { id: 'appearance', label: 'Görünüm', icon: <Palette className="w-4 h-4" /> },
  { id: 'account', label: 'Hesap', icon: <UserCog className="w-4 h-4" /> },
  { id: 'help', label: 'Yardım', icon: <HelpCircle className="w-4 h-4" /> },
]

const FONT_SIZES = { sm: '14px', base: '16px', lg: '18px' } as const
const ACCENTS = [
  { name: 'Mercan',   main: '#E8593C', hover: '#D44A2E', blush: '#FAE4DC' },
  { name: 'Şeftali',  main: '#E07A3A', hover: '#C56828', blush: '#FAE8D8' },
  { name: 'Safran',   main: '#C47B10', hover: '#A86608', blush: '#FDF0D0' },
  { name: 'Adaçayı',  main: '#2E8B6A', hover: '#247558', blush: '#D0EEE4' },
  { name: 'İncir',    main: '#8B4FC8', hover: '#7840B0', blush: '#EDE0FA' },
  { name: 'Erik',     main: '#C44060', hover: '#AC3050', blush: '#FAE0E8' },
]

const FONT_FAMILIES = [
  { id: 'system'  as const, name: 'Sistem',   desc: 'DM Sans',  css: 'var(--font-dm-sans, system-ui), sans-serif',        sample: 'Aa' },
  { id: 'rounded' as const, name: 'Yuvarlak', desc: 'Sıcak',    css: "'Trebuchet MS', system-ui, sans-serif",              sample: 'Aa' },
  { id: 'serif'   as const, name: 'Klasik',   desc: 'Editöryal',css: "Georgia, 'Times New Roman', serif",                  sample: 'Aa' },
  { id: 'mono'    as const, name: 'Mono',     desc: 'Minimal',  css: "'Menlo', 'Monaco', 'Courier New', monospace",        sample: 'Aa' },
]
type FontFamilyId = typeof FONT_FAMILIES[number]['id']

const BG_TONES = [
  { id: 'warm'  as const, label: 'Sıcak',  color: '#FFFBF8', desc: 'Floq klasik' },
  { id: 'pure'  as const, label: 'Saf',    color: '#FFFFFF', desc: 'Bembeyaz'    },
  { id: 'cream' as const, label: 'Krem',   color: '#FFF8F0', desc: 'Göz dostu'   },
  { id: 'paper' as const, label: 'Kağıt',  color: '#F5F0E8', desc: 'Gazete hissi'},
]
type BgToneId = typeof BG_TONES[number]['id']

// Kelvin sırasına göre: en sıcak → en soğuk
const BG_KELVIN: { id: BgToneId; k: number; color: string; label: string; desc: string }[] = [
  { id: 'paper', k: 3200, color: '#F5F0E8', label: 'Kağıt',  desc: 'Gazete hissi' },
  { id: 'cream', k: 4000, color: '#FFF8F0', label: 'Krem',   desc: 'Göz dostu'    },
  { id: 'warm',  k: 5000, color: '#FFFBF8', label: 'Sıcak',  desc: 'Floq klasik'  },
  { id: 'pure',  k: 6500, color: '#FFFFFF', label: 'Saf',    desc: 'Bembeyaz'     },
]

function deriveBlushDark(main: string): string {
  const rgb = hexToRgb(main)
  if (!rgb) return '#3D2420'
  // 20% of accent color blended into the dark background (#17171B)
  const r = Math.round(0x17 + 0.20 * (rgb.r - 0x17))
  const g = Math.round(0x17 + 0.20 * (rgb.g - 0x17))
  const b = Math.round(0x1B + 0.20 * (rgb.b - 0x1B))
  return rgbToHex(r, g, b)
}

function applyAccentColors(c: { main: string; hover: string; blush: string }) {
  const s = document.documentElement.style
  s.setProperty('--color-coral', c.main)
  s.setProperty('--color-coral-hover', c.hover)
  s.setProperty('--color-ember', c.hover)
  s.setProperty('--color-blush-light', c.blush)
  s.setProperty('--color-blush-dark', deriveBlushDark(c.main))
}

function hexToRgb(hex: string) {
  const h = hex.replace('#', '')
  if (h.length !== 6) return null
  const r = parseInt(h.slice(0, 2), 16)
  const g = parseInt(h.slice(2, 4), 16)
  const b = parseInt(h.slice(4, 6), 16)
  if ([r, g, b].some(isNaN)) return null
  return { r, g, b }
}

function rgbToHex(r: number, g: number, b: number) {
  return '#' + [r, g, b].map((c) => Math.min(255, Math.max(0, Math.round(c))).toString(16).padStart(2, '0')).join('')
}

function deriveAccentColors(main: string): { main: string; hover: string; blush: string } | null {
  const rgb = hexToRgb(main)
  if (!rgb) return null
  const hover = rgbToHex(rgb.r * 0.88, rgb.g * 0.88, rgb.b * 0.88)
  const blush = rgbToHex(rgb.r + (255 - rgb.r) * 0.88, rgb.g + (255 - rgb.g) * 0.88, rgb.b + (255 - rgb.b) * 0.88)
  return { main, hover, blush }
}

function hexToHsl(hex: string): { h: number; s: number; l: number } | null {
  const rgb = hexToRgb(hex)
  if (!rgb) return null
  const r = rgb.r / 255, g = rgb.g / 255, b = rgb.b / 255
  const max = Math.max(r, g, b), min = Math.min(r, g, b)
  const l = (max + min) / 2
  if (max === min) return { h: 0, s: 0, l: Math.round(l * 100) }
  const d = max - min
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min)
  let h = 0
  if (max === r) h = (g - b) / d + (g < b ? 6 : 0)
  else if (max === g) h = (b - r) / d + 2
  else h = (r - g) / d + 4
  return { h: Math.round(h * 60), s: Math.round(s * 100), l: Math.round(l * 100) }
}

function hslToHex(h: number, s: number, l: number): string {
  const sl = s / 100, ll = l / 100
  const k = (n: number) => (n + h / 30) % 12
  const a = sl * Math.min(ll, 1 - ll)
  const f = (n: number) => ll - a * Math.max(-1, Math.min(k(n) - 3, Math.min(9 - k(n), 1)))
  return rgbToHex(Math.round(f(0) * 255), Math.round(f(8) * 255), Math.round(f(4) * 255))
}

// ─── Section wrapper ──────────────────────────────────────────────────────────
function Section({ title, desc, children }: { title: string; desc?: string; children: React.ReactNode }) {
  return (
    <div className="pt-5 pb-1 first:pt-0">
      <div className="mb-2.5 flex items-baseline gap-2">
        <p className="text-[10px] font-semibold uppercase tracking-widest text-(--color-text-tertiary)">{title}</p>
        {desc && <p className="text-[11px] text-(--color-text-tertiary)/70 normal-case tracking-normal">{desc}</p>}
      </div>
      {children}
    </div>
  )
}

// ─── Kelvin slider ────────────────────────────────────────────────────────────
function KelvinSlider({ value, onChange }: { value: BgToneId; onChange: (id: BgToneId) => void }) {
  const idx = Math.max(0, BG_KELVIN.findIndex((s) => s.id === value))
  const current = BG_KELVIN[idx]
  const pct = (idx / (BG_KELVIN.length - 1)) * 100

  return (
    <div className="space-y-3">
      {/* Current value display */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <div
            className="w-6 h-6 rounded-full border border-(--color-border) shadow-sm flex-shrink-0"
            style={{ background: current.color }}
          />
          <div>
            <span className="text-sm font-semibold text-(--color-text-primary)">{current.label}</span>
            <span className="text-xs text-(--color-text-tertiary) ml-2">{current.desc}</span>
          </div>
        </div>
        <span className="text-sm font-mono font-medium text-(--color-coral) tabular-nums">{current.k}K</span>
      </div>

      {/* Track + thumb */}
      <div className="relative h-10 flex items-center">
        {/* Gradient track */}
        <div
          className="absolute inset-x-0 h-3 rounded-full border border-(--color-border) shadow-inner"
          style={{ background: 'linear-gradient(to right, #F5F0E8 0%, #FFF8F0 33%, #FFFBF8 66%, #FFFFFF 100%)' }}
        />
        {/* Snap dots */}
        {BG_KELVIN.map((_, i) => (
          <div
            key={i}
            className="absolute top-1/2 -translate-y-1/2 w-1.5 h-1.5 rounded-full bg-white/70 border border-black/10 pointer-events-none"
            style={{ left: `calc(${(i / (BG_KELVIN.length - 1)) * 100}% - 3px)` }}
          />
        ))}
        {/* Visual thumb */}
        <div
          className="absolute top-1/2 -translate-y-1/2 w-5 h-5 rounded-full bg-white border-2 border-(--color-coral) shadow-md pointer-events-none transition-all duration-150"
          style={{ left: `calc(${pct}% - 10px)` }}
        />
        {/* Invisible range input */}
        <input
          type="range"
          min={0}
          max={BG_KELVIN.length - 1}
          step={1}
          value={idx}
          onChange={(e) => onChange(BG_KELVIN[parseInt(e.target.value)].id)}
          className="kelvin-slider absolute inset-0 w-full cursor-pointer"
          aria-label="Arka plan sıcaklığı"
        />
      </div>

      {/* K labels */}
      <div className="flex justify-between px-0.5">
        {BG_KELVIN.map((s) => (
          <button
            key={s.id}
            onClick={() => onChange(s.id)}
            className="flex flex-col items-center gap-0.5 group cursor-pointer"
          >
            <span className={cn(
              'text-[11px] font-semibold transition-colors leading-none',
              s.id === value ? 'text-(--color-coral)' : 'text-(--color-text-secondary) group-hover:text-(--color-text-primary)',
            )}>
              {s.label}
            </span>
            <span className={cn(
              'text-[9px] tabular-nums transition-colors',
              s.id === value ? 'text-(--color-coral)/70' : 'text-(--color-text-tertiary)',
            )}>
              {s.k}K
            </span>
          </button>
        ))}
      </div>
    </div>
  )
}

// ─── Segmented pill control ───────────────────────────────────────────────────
function SegmentedPill({
  options,
  value,
  onChange,
}: {
  options: { value: string; label: string; icon?: React.ReactNode }[]
  value: string
  onChange: (v: string) => void
}) {
  return (
    <div
      className="grid p-1 gap-1 rounded-2xl bg-(--color-background-secondary) border border-(--color-border)"
      style={{ gridTemplateColumns: `repeat(${options.length}, 1fr)` }}
    >
      {options.map((o) => (
        <button
          key={o.value}
          onClick={() => onChange(o.value)}
          className={cn(
            'flex items-center justify-center gap-1.5 py-2.5 rounded-xl text-sm font-medium transition-all',
            value === o.value
              ? 'bg-(--color-surface) shadow-sm text-(--color-text-primary) font-medium'
              : 'text-(--color-text-tertiary) hover:text-(--color-text-secondary) hover:bg-(--color-background)/50',
          )}
        >
          {o.icon}
          <span>{o.label}</span>
        </button>
      ))}
    </div>
  )
}

// ─── Live preview card ────────────────────────────────────────────────────────
function PreviewCard({
  accent, fontCss, textSize, density, postStyle, bgColor, isDark,
}: {
  accent: string; fontCss: string; textSize: string
  density: 'compact' | 'comfortable'; postStyle: 'card' | 'stream'
  bgColor: string; isDark: boolean
}) {
  const bg        = isDark ? '#141414' : bgColor
  const cardBg    = isDark ? '#1f1f1f' : (postStyle === 'card' ? '#ffffff' : bgColor)
  const border    = isDark ? '#2a2a2a' : '#e5e7eb'
  const textPri   = isDark ? '#f3f4f6' : '#111827'
  const textMuted = isDark ? '#9ca3af' : '#6b7280'
  const py        = density === 'compact' ? '10px' : '14px'
  const gap       = density === 'compact' ? '8px'  : '12px'

  return (
    <div
      style={{ background: bg, borderRadius: 16, overflow: 'hidden', border: `1px solid ${border}`, fontFamily: fontCss, fontSize: textSize }}
      aria-hidden="true"
    >
      {/* header bar */}
      <div style={{ background: isDark ? '#1a1a1a' : bgColor, borderBottom: `1px solid ${border}`, padding: '10px 16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <span style={{ fontWeight: 800, fontSize: '17px', color: accent, letterSpacing: '-0.5px' }}>floq</span>
        <div style={{ display: 'flex', gap: 8 }}>
          {['Akış', 'Keşfet'].map((l) => (
            <span key={l} style={{ fontSize: '12px', fontWeight: 600, color: l === 'Akış' ? accent : textMuted, paddingBottom: 2, borderBottom: l === 'Akış' ? `2px solid ${accent}` : '2px solid transparent' }}>{l}</span>
          ))}
        </div>
      </div>

      {/* two fake posts */}
      {[
        { name: 'Ayşe Kaya', handle: 'ayse', time: '2d', body: 'Bu bir önizleme gönderisidir. Renk, yazı ve düzeni burada canlı görebilirsin. ✨', likes: 42, boosts: 12 },
        { name: 'Mehmet D.',  handle: 'mehmet', time: '4d', body: 'floq ile kendi verilerinin sahibi ol. Açık kaynak, federe, özgür. 🌐',              likes: 89, boosts: 31 },
      ].map((p, i) => (
        <div
          key={i}
          style={{
            background: cardBg,
            padding: `${py} 16px`,
            borderBottom: `1px solid ${border}`,
            boxShadow: postStyle === 'card' && !isDark ? '0 1px 3px rgba(0,0,0,0.04)' : 'none',
            margin: postStyle === 'card' ? '8px' : 0,
            borderRadius: postStyle === 'card' ? 12 : 0,
            border: postStyle === 'card' ? `1px solid ${border}` : `0 0 1px 0 solid ${border}`,
          }}
        >
          <div style={{ display: 'flex', gap, alignItems: 'flex-start' }}>
            <div style={{ width: 34, height: 34, borderRadius: '50%', background: i === 0 ? accent : '#6b7280', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '13px', fontWeight: 700, color: '#fff' }}>
              {p.name[0]}
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: 6, flexWrap: 'wrap' }}>
                <span style={{ fontWeight: 700, color: textPri, fontSize: textSize }}>{p.name}</span>
                <span style={{ color: textMuted, fontSize: '11px' }}>@{p.handle} · {p.time}</span>
              </div>
              <p style={{ color: textPri, marginTop: 4, lineHeight: 1.55, fontSize: textSize }}>{p.body}</p>
              <div style={{ display: 'flex', gap: 18, marginTop: 8 }}>
                {[['💬', p.boosts], ['🔁', p.boosts], ['♥', p.likes]].map(([icon, count], j) => (
                  <span key={j} style={{ display: 'flex', alignItems: 'center', gap: 4, color: j === 2 ? accent : textMuted, fontSize: '12px' }}>
                    <span>{icon}</span><span>{count}</span>
                  </span>
                ))}
              </div>
            </div>
          </div>
        </div>
      ))}
    </div>
  )
}

function ThemeTab() {
  const { theme, setTheme, resolvedTheme } = useTheme()
  const [fontSize,    setFontSize]    = useState<'sm' | 'base' | 'lg'>('base')
  const [density,     setDensity]     = useState<'compact' | 'comfortable'>('comfortable')
  const [accent,      setAccent]      = useState('#E8593C')
  const [fontFamily,  setFontFamily]  = useState<FontFamilyId>('system')
  const [bgTone,      setBgTone]      = useState<BgToneId>('warm')
  const [postStyle,   setPostStyle]   = useState<'card' | 'stream'>('card')
  const [reduceMotion,setReduceMotion]= useState(false)
  const [colorPickerOpen, setColorPickerOpen] = useState(false)
  const [hsl, setHsl] = useState<{ h: number; s: number; l: number }>({ h: 16, s: 78, l: 56 })

  useEffect(() => {
    const savedFont    = (localStorage.getItem('floq-font-size')    ?? 'base') as 'sm' | 'base' | 'lg'
    const savedDensity = (localStorage.getItem('floq-density')      ?? 'comfortable') as 'compact' | 'comfortable'
    const savedFamily  = (localStorage.getItem('floq-font-family')  ?? 'system') as FontFamilyId
    const savedBg      = (localStorage.getItem('floq-bg-tone')      ?? 'warm') as BgToneId
    const savedStyle   = (localStorage.getItem('floq-post-style')   ?? 'card') as 'card' | 'stream'
    const savedMotion   = localStorage.getItem('floq-reduce-motion') === 'true'
    const savedAccent  = localStorage.getItem('floq-accent')

    setFontSize(savedFont)
    document.documentElement.style.fontSize = FONT_SIZES[savedFont]

    setDensity(savedDensity)
    document.documentElement.setAttribute('data-density', savedDensity)

    setFontFamily(savedFamily)
    if (savedFamily !== 'system') {
      document.documentElement.setAttribute('data-font', savedFamily)
    }

    setBgTone(savedBg)
    if (savedBg !== 'warm') {
      document.documentElement.setAttribute('data-bg-tone', savedBg)
    }

    setPostStyle(savedStyle)
    document.documentElement.setAttribute('data-post-style', savedStyle)

    setReduceMotion(savedMotion)
    if (savedMotion) {
      document.documentElement.setAttribute('data-reduce-motion', '')
    }

    if (savedAccent) {
      try {
        const c = JSON.parse(savedAccent) as { main: string; hover: string; blush: string }
        applyAccentColors(c)
        setAccent(c.main)
        const h = hexToHsl(c.main)
        if (h) setHsl(h)
      } catch { /* ignore */ }
    }
  }, [])

  function handleFontSize(size: 'sm' | 'base' | 'lg') {
    document.documentElement.style.fontSize = FONT_SIZES[size]
    localStorage.setItem('floq-font-size', size)
    setFontSize(size)
  }

  function handleDensity(d: 'compact' | 'comfortable') {
    document.documentElement.setAttribute('data-density', d)
    localStorage.setItem('floq-density', d)
    setDensity(d)
  }

  function handleAccent(preset: typeof ACCENTS[number]) {
    applyAccentColors(preset)
    localStorage.setItem('floq-accent', JSON.stringify(preset))
    setAccent(preset.main)
    const h = hexToHsl(preset.main)
    if (h) setHsl(h)
    setColorPickerOpen(false)
  }

  function applyHsl(h: number, s: number, l: number) {
    const hex = hslToHex(h, s, l)
    const derived = deriveAccentColors(hex)
    if (!derived) return
    applyAccentColors(derived)
    localStorage.setItem('floq-accent', JSON.stringify(derived))
    setAccent(derived.main)
  }

  function handleFontFamily(id: FontFamilyId) {
    if (id === 'system') {
      document.documentElement.removeAttribute('data-font')
    } else {
      document.documentElement.setAttribute('data-font', id)
    }
    localStorage.setItem('floq-font-family', id)
    setFontFamily(id)
  }

  function handleBgTone(id: BgToneId) {
    if (id === 'warm') {
      document.documentElement.removeAttribute('data-bg-tone')
    } else {
      document.documentElement.setAttribute('data-bg-tone', id)
    }
    localStorage.setItem('floq-bg-tone', id)
    setBgTone(id)
  }

  function handlePostStyle(s: 'card' | 'stream') {
    document.documentElement.setAttribute('data-post-style', s)
    localStorage.setItem('floq-post-style', s)
    setPostStyle(s)
  }

  function handleReduceMotion(val: boolean) {
    if (val) {
      document.documentElement.setAttribute('data-reduce-motion', '')
    } else {
      document.documentElement.removeAttribute('data-reduce-motion')
    }
    localStorage.setItem('floq-reduce-motion', String(val))
    setReduceMotion(val)
  }

  const isDark      = resolvedTheme === 'dark'
  const previewFont = FONT_FAMILIES.find((f) => f.id === fontFamily)?.css ?? 'system-ui'
  const previewSize = FONT_SIZES[fontSize]
  const previewBg   = BG_TONES.find((b) => b.id === bgTone)?.color ?? '#FFFBF8'

  return (
    <div className="max-w-lg divide-y divide-(--color-border)">

      {/* ── Canlı Önizleme ── */}
      <div className="pb-6">
        <p className="text-[11px] font-semibold uppercase tracking-widest text-(--color-text-tertiary) mb-3">Canlı Önizleme</p>
        <PreviewCard
          accent={accent}
          fontCss={previewFont}
          textSize={previewSize}
          density={density}
          postStyle={postStyle}
          bgColor={previewBg}
          isDark={isDark}
        />
      </div>

      {/* ── Tema ── */}
      <Section title="Tema">
        <div className="rounded-2xl border border-(--color-border) overflow-hidden divide-y divide-(--color-border)">
          {([
            {
              value: 'light' as const,
              label: 'Açık',
              desc: 'Açık ve ferah görünüm',
              palette: ['#FAFAF8', '#FFFFFF', '#E8E7E3', accent],
            },
            {
              value: 'dark' as const,
              label: 'Koyu',
              desc: 'Göz yormuyan karanlık mod',
              palette: ['#1A1A18', '#242422', '#3D3D3A', accent],
            },
            {
              value: 'system' as const,
              label: 'Sistem',
              desc: 'Cihaz ayarını otomatik takip et',
              palette: ['#FAFAF8', '#1A1A18', '#E8E7E3', accent],
            },
          ]).map((o) => {
            const active = theme === o.value
            return (
              <button
                key={o.value}
                onClick={() => setTheme(o.value)}
                className={cn(
                  'w-full flex items-center gap-4 px-4 py-3.5 transition-colors text-left',
                  active ? 'bg-(--color-blush)/25 dark:bg-(--color-coral)/8' : 'hover:bg-(--color-background-secondary)/50',
                )}
              >
                <div className="flex -space-x-2 flex-shrink-0">
                  {o.palette.map((color, i) => (
                    <div
                      key={i}
                      className="w-7 h-7 rounded-full border-2 border-(--color-background) shadow-sm"
                      style={{ background: color, zIndex: o.palette.length - i }}
                    />
                  ))}
                </div>
                <div className="flex-1 min-w-0">
                  <p className={cn('text-sm font-semibold leading-tight', active ? 'text-(--color-coral)' : 'text-(--color-text-primary)')}>
                    {o.label}
                  </p>
                  <p className="text-xs text-(--color-text-tertiary) mt-0.5">{o.desc}</p>
                </div>
                <div className={cn(
                  'w-4 h-4 rounded-full border-2 flex items-center justify-center flex-shrink-0 transition-all',
                  active ? 'border-(--color-coral) bg-(--color-coral)' : 'border-(--color-text-tertiary)/30',
                )}>
                  {active && <div className="w-1.5 h-1.5 rounded-full bg-white" />}
                </div>
              </button>
            )
          })}
        </div>
      </Section>

      {/* ── Vurgu Rengi ── */}
      <Section title="Vurgu Rengi">
        <div className="flex justify-between items-start">
          {ACCENTS.map((a) => {
            const active = accent === a.main
            return (
              <button
                key={a.main}
                aria-label={a.name}
                aria-pressed={active}
                onClick={() => handleAccent(a)}
                className="flex flex-col items-center gap-2 group focus:outline-none flex-1"
              >
                <div
                  className="relative w-10 h-10 rounded-full transition-transform duration-150 group-hover:scale-110 active:scale-95 shadow-md"
                  style={{
                    backgroundColor: a.main,
                    boxShadow: active ? `0 0 0 2px var(--color-background), 0 0 0 4px ${a.main}` : '0 2px 6px rgba(0,0,0,0.15)',
                  }}
                >
                  {active && <Check className="absolute inset-0 m-auto w-4 h-4 text-white drop-shadow" />}
                </div>
                <span className={cn(
                  'text-[10px] font-medium leading-none transition-colors',
                  active ? 'text-(--color-coral)' : 'text-(--color-text-tertiary) group-hover:text-(--color-text-secondary)',
                )}>
                  {a.name}
                </span>
              </button>
            )
          })}
          <button
            aria-label="Özel renk seç"
            onClick={() => setColorPickerOpen((v) => !v)}
            className="flex flex-col items-center gap-2 group focus:outline-none flex-1"
          >
            <div
              className="relative w-10 h-10 rounded-full transition-transform duration-150 group-hover:scale-110 active:scale-95 overflow-hidden"
              style={
                !ACCENTS.some((a) => a.main === accent)
                  ? { backgroundColor: accent, boxShadow: `0 0 0 2px var(--color-background), 0 0 0 4px ${accent}` }
                  : { background: 'conic-gradient(from 0deg, #E8593C, #E07A3A, #C47B10, #2E8B6A, #8B4FC8, #C44060, #E8593C)', boxShadow: '0 2px 6px rgba(0,0,0,0.15)' }
              }
            >
              {!ACCENTS.some((a) => a.main === accent) && (
                <Check className="absolute inset-0 m-auto w-4 h-4 text-white drop-shadow" />
              )}
            </div>
            <span className={cn(
              'text-[10px] font-medium leading-none transition-colors',
              !ACCENTS.some((a) => a.main === accent)
                ? 'text-(--color-coral)'
                : 'text-(--color-text-tertiary) group-hover:text-(--color-text-secondary)',
            )}>
              Özel
            </span>
          </button>
        </div>

        {/* HSL Color Picker Panel */}
        {colorPickerOpen && (
          <div className="mt-4 p-4 rounded-2xl border border-(--color-border) bg-(--color-background-secondary)/40 space-y-4">
            {/* Preview */}
            <div className="flex items-center gap-3">
              <div
                className="w-10 h-10 rounded-full shadow-md flex-shrink-0 border-2 border-white/20"
                style={{ backgroundColor: hslToHex(hsl.h, hsl.s, hsl.l) }}
              />
              <div>
                <p className="text-xs font-medium text-(--color-text-secondary)">Özel Renk</p>
                <p className="text-[11px] font-mono text-(--color-text-tertiary) uppercase">{hslToHex(hsl.h, hsl.s, hsl.l)}</p>
              </div>
            </div>

            {/* Hue */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-medium text-(--color-text-tertiary)">Ton</span>
                <span className="text-[11px] font-mono text-(--color-text-tertiary) tabular-nums w-8 text-right">{hsl.h}°</span>
              </div>
              <div className="relative h-4 rounded-full overflow-hidden" style={{ background: 'linear-gradient(to right,#f00 0%,#ff0 17%,#0f0 33%,#0ff 50%,#00f 67%,#f0f 83%,#f00 100%)' }}>
                <input
                  type="range" min={0} max={359} value={hsl.h}
                  onChange={(e) => {
                    const next = { ...hsl, h: Number(e.target.value) }
                    setHsl(next)
                    applyHsl(next.h, next.s, next.l)
                  }}
                  className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                />
                <div
                  className="absolute top-1/2 -translate-y-1/2 w-4 h-4 rounded-full border-2 border-white shadow-md pointer-events-none"
                  style={{ left: `calc(${(hsl.h / 359) * 100}% - 8px)`, backgroundColor: `hsl(${hsl.h},100%,50%)` }}
                />
              </div>
            </div>

            {/* Saturation */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-medium text-(--color-text-tertiary)">Doygunluk</span>
                <span className="text-[11px] font-mono text-(--color-text-tertiary) tabular-nums w-8 text-right">{hsl.s}%</span>
              </div>
              <div className="relative h-4 rounded-full overflow-hidden" style={{ background: `linear-gradient(to right, hsl(${hsl.h},0%,50%), hsl(${hsl.h},100%,50%))` }}>
                <input
                  type="range" min={20} max={100} value={hsl.s}
                  onChange={(e) => {
                    const next = { ...hsl, s: Number(e.target.value) }
                    setHsl(next)
                    applyHsl(next.h, next.s, next.l)
                  }}
                  className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                />
                <div
                  className="absolute top-1/2 -translate-y-1/2 w-4 h-4 rounded-full border-2 border-white shadow-md pointer-events-none"
                  style={{ left: `calc(${((hsl.s - 20) / 80) * 100}% - 8px)`, backgroundColor: `hsl(${hsl.h},${hsl.s}%,50%)` }}
                />
              </div>
            </div>

            {/* Lightness */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-medium text-(--color-text-tertiary)">Parlaklık</span>
                <span className="text-[11px] font-mono text-(--color-text-tertiary) tabular-nums w-8 text-right">{hsl.l}%</span>
              </div>
              <div className="relative h-4 rounded-full overflow-hidden" style={{ background: `linear-gradient(to right, hsl(${hsl.h},${hsl.s}%,20%), hsl(${hsl.h},${hsl.s}%,50%), hsl(${hsl.h},${hsl.s}%,80%))` }}>
                <input
                  type="range" min={20} max={75} value={hsl.l}
                  onChange={(e) => {
                    const next = { ...hsl, l: Number(e.target.value) }
                    setHsl(next)
                    applyHsl(next.h, next.s, next.l)
                  }}
                  className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                />
                <div
                  className="absolute top-1/2 -translate-y-1/2 w-4 h-4 rounded-full border-2 border-white shadow-md pointer-events-none"
                  style={{ left: `calc(${((hsl.l - 20) / 55) * 100}% - 8px)`, backgroundColor: `hsl(${hsl.h},${hsl.s}%,${hsl.l}%)` }}
                />
              </div>
            </div>
          </div>
        )}
      </Section>

      {/* ── Arka Plan Sıcaklığı ── */}
      {!isDark && (
        <Section title="Arka Plan Sıcaklığı" desc="Beyazın sıcaklığını Kelvin cinsinden ayarla.">
          <KelvinSlider value={bgTone} onChange={handleBgTone} />
        </Section>
      )}

      {/* ── Yazı Tipi ── */}
      <Section title="Yazı Tipi">
        <div className="grid grid-cols-2 gap-2">
          {FONT_FAMILIES.map((f) => (
            <button
              key={f.id}
              onClick={() => handleFontFamily(f.id)}
              className={cn(
                'flex flex-col items-center gap-2 py-5 px-3 rounded-2xl border transition-all',
                fontFamily === f.id
                  ? 'border-(--color-coral) bg-(--color-blush)/50 dark:bg-(--color-coral)/12'
                  : 'border-(--color-border) hover:bg-(--color-background-secondary)/70',
              )}
            >
              <span
                style={{
                  fontFamily: f.css,
                  fontSize: 30,
                  fontWeight: 700,
                  lineHeight: 1,
                  color: fontFamily === f.id ? 'var(--color-coral)' : 'var(--color-text-secondary)',
                }}
              >
                Aa
              </span>
              <div className="text-center">
                <p className={cn('text-xs font-semibold', fontFamily === f.id ? 'text-(--color-coral)' : 'text-(--color-text-primary)')}>{f.name}</p>
                <p className="text-[10px] text-(--color-text-tertiary) mt-0.5">{f.desc}</p>
              </div>
            </button>
          ))}
        </div>
      </Section>

      {/* ── Yazı Boyutu ── */}
      <Section title="Yazı Boyutu">
        <div className="grid grid-cols-3 gap-2">
          {([
            { value: 'sm'   as const, label: 'Küçük',  px: '14px', displayPx: 20 },
            { value: 'base' as const, label: 'Normal', px: '16px', displayPx: 26 },
            { value: 'lg'   as const, label: 'Büyük',  px: '18px', displayPx: 34 },
          ]).map((o) => (
            <button
              key={o.value}
              onClick={() => handleFontSize(o.value)}
              className={cn(
                'flex flex-col items-center gap-2 py-4 rounded-2xl border transition-all',
                fontSize === o.value
                  ? 'border-(--color-coral) bg-(--color-blush)/50 dark:bg-(--color-coral)/12'
                  : 'border-(--color-border) hover:bg-(--color-background-secondary)/70',
              )}
            >
              <span style={{ fontSize: o.displayPx, fontWeight: 800, lineHeight: 1, color: fontSize === o.value ? 'var(--color-coral)' : 'var(--color-text-secondary)' }}>
                A
              </span>
              <div className="text-center">
                <p className={cn('text-xs font-semibold', fontSize === o.value ? 'text-(--color-coral)' : 'text-(--color-text-primary)')}>{o.label}</p>
                <p className="text-[10px] font-mono text-(--color-text-tertiary)">{o.px}</p>
              </div>
            </button>
          ))}
        </div>
      </Section>

      {/* ── Gönderi Stili ── */}
      <Section title="Gönderi Stili">
        <div className="grid grid-cols-2 gap-2">
          {([
            { value: 'card'   as const, label: 'Kart',  desc: 'Gölgeli beyaz kutu'  },
            { value: 'stream' as const, label: 'Akış',  desc: 'Sadece ayırıcı çizgi'},
          ]).map((o) => (
            <button
              key={o.value}
              onClick={() => handlePostStyle(o.value)}
              className={cn(
                'flex flex-col items-start gap-3 p-3.5 rounded-2xl border transition-all',
                postStyle === o.value
                  ? 'border-(--color-coral) bg-(--color-blush)/50 dark:bg-(--color-coral)/12'
                  : 'border-(--color-border) hover:bg-(--color-background-secondary)/70',
              )}
            >
              {/* mini post visualization */}
              <div className="w-full space-y-2 pt-0.5">
                {[0, 1].map((i) => (
                  <div
                    key={i}
                    className={cn('w-full px-2 py-2', o.value === 'card' ? 'rounded-lg' : '')}
                    style={{
                      background: o.value === 'card' ? 'var(--color-surface)' : 'transparent',
                      border: o.value === 'card' ? '1px solid var(--color-border)' : 'none',
                      borderBottom: o.value === 'stream' ? '1px solid var(--color-border)' : undefined,
                      boxShadow: o.value === 'card' ? '0 1px 3px rgba(0,0,0,0.05)' : 'none',
                    }}
                  >
                    <div className="flex items-center gap-1.5">
                      <div className="w-4 h-4 rounded-full flex-shrink-0" style={{ background: i === 0 ? 'var(--color-coral)' : 'var(--color-stone)' }} />
                      <div className="flex-1 space-y-1">
                        <div className="h-1.5 rounded-full" style={{ width: '60%', background: 'var(--color-text-tertiary)', opacity: 0.5 }} />
                        <div className="h-1.5 rounded-full" style={{ width: '85%', background: 'var(--color-text-tertiary)', opacity: 0.25 }} />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
              <div>
                <p className={cn('text-sm font-semibold', postStyle === o.value ? 'text-(--color-coral)' : 'text-(--color-text-primary)')}>{o.label}</p>
                <p className="text-[11px] text-(--color-text-tertiary)">{o.desc}</p>
              </div>
            </button>
          ))}
        </div>
      </Section>

      {/* ── Gönderi Yoğunluğu ── */}
      <Section title="Gönderi Yoğunluğu">
        <div className="grid grid-cols-2 gap-2">
          {([
            { value: 'comfortable' as const, label: 'Rahat',   desc: 'Daha fazla nefes',   pads: [10, 10, 10] },
            { value: 'compact'     as const, label: 'Kompakt', desc: 'Daha fazla gönderi',  pads: [5,  5,  5]  },
          ]).map((o) => (
            <button
              key={o.value}
              onClick={() => handleDensity(o.value)}
              className={cn(
                'flex flex-col items-start gap-3 p-3.5 rounded-2xl border transition-all',
                density === o.value
                  ? 'border-(--color-coral) bg-(--color-blush)/50 dark:bg-(--color-coral)/12'
                  : 'border-(--color-border) hover:bg-(--color-background-secondary)/70',
              )}
            >
              {/* visual: rows with varying padding */}
              <div className="w-full">
                {([0, 1, 2] as const).map((i) => (
                  <div
                    key={i}
                    className="flex items-center gap-2 border-b border-(--color-border)/50 last:border-0"
                    style={{ paddingTop: o.pads[i], paddingBottom: o.pads[i] }}
                  >
                    <div className="w-3.5 h-3.5 rounded-full flex-shrink-0" style={{ background: 'var(--color-text-tertiary)', opacity: 0.35 }} />
                    <div className="h-1.5 rounded-full flex-1" style={{ background: 'var(--color-text-tertiary)', opacity: 0.22, maxWidth: ['75%', '60%', '80%'][i] }} />
                  </div>
                ))}
              </div>
              <div>
                <p className={cn('text-sm font-semibold', density === o.value ? 'text-(--color-coral)' : 'text-(--color-text-primary)')}>{o.label}</p>
                <p className="text-[11px] text-(--color-text-tertiary)">{o.desc}</p>
              </div>
            </button>
          ))}
        </div>
      </Section>

      {/* ── Animasyon ── */}
      <Section title="Animasyon">
        <button
          role="switch"
          aria-checked={reduceMotion}
          onClick={() => handleReduceMotion(!reduceMotion)}
          className={cn(
            'flex items-center justify-between w-full px-4 py-3.5 rounded-2xl border transition-all',
            reduceMotion
              ? 'border-(--color-coral) bg-(--color-blush)/50 dark:bg-(--color-coral)/12'
              : 'border-(--color-border) hover:bg-(--color-background-secondary)/70',
          )}
        >
          <div className="text-left">
            <p className={cn('text-sm font-semibold', reduceMotion ? 'text-(--color-coral)' : 'text-(--color-text-primary)')}>
              Hareketi Azalt
            </p>
            <p className="text-xs text-(--color-text-tertiary) mt-0.5">Animasyonları ve geçişleri kapat</p>
          </div>
          <div className={cn('w-11 h-6 rounded-full transition-colors flex items-center px-0.5 flex-shrink-0', reduceMotion ? 'bg-(--color-coral)' : 'bg-(--color-border)')}>
            <div className={cn('w-5 h-5 rounded-full bg-white shadow-sm transition-transform duration-200', reduceMotion ? 'translate-x-5' : 'translate-x-0')} />
          </div>
        </button>
      </Section>

    </div>
  )
}

// ─── Crop Modal ──────────────────────────────────────────────────────────────

interface CropModalProps {
  file: File
  shape: 'circle' | 'banner'
  onSave: (blob: Blob) => void
  onCancel: () => void
}

function CropModal({ file, shape, onSave, onCancel }: CropModalProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [imgEl, setImgEl] = useState<HTMLImageElement | null>(null)
  const [offset, setOffset] = useState({ x: 0, y: 0 })
  const [scale, setScale] = useState(1)
  const [minScale, setMinScale] = useState(0.1)
  const [dragging, setDragging] = useState(false)
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 })

  const CANVAS_W = shape === 'banner' ? 360 : 280
  const CANVAS_H = shape === 'banner' ? 120 : 280
  const OUT_W = shape === 'banner' ? 900 : 400
  const OUT_H = shape === 'banner' ? 300 : 400

  useEffect(() => {
    const img = new Image()
    const objectUrl = URL.createObjectURL(file)
    img.onload = () => {
      setImgEl(img)
      const scaleW = CANVAS_W / img.naturalWidth
      const scaleH = CANVAS_H / img.naturalHeight
      const initialScale = Math.max(scaleW, scaleH)
      setMinScale(initialScale)
      setScale(initialScale)
      const scaledW = img.naturalWidth * initialScale
      const scaledH = img.naturalHeight * initialScale
      const cx = Math.min(0, Math.max(CANVAS_W - scaledW, (CANVAS_W - scaledW) / 2))
      const cy = Math.min(0, Math.max(CANVAS_H - scaledH, (CANVAS_H - scaledH) / 2))
      setOffset({ x: cx, y: cy })
    }
    img.onerror = () => { URL.revokeObjectURL(objectUrl); onCancel() }
    img.src = objectUrl
    return () => URL.revokeObjectURL(objectUrl)
  }, [file, CANVAS_W, CANVAS_H, onCancel])

  useEffect(() => {
    if (!imgEl || !canvasRef.current) return
    const canvas = canvasRef.current
    const ctx = canvas.getContext('2d')!
    ctx.clearRect(0, 0, CANVAS_W, CANVAS_H)

    ctx.save()
    ctx.drawImage(imgEl, offset.x, offset.y, imgEl.naturalWidth * scale, imgEl.naturalHeight * scale)
    ctx.restore()

    // Overlay: draw ONLY outside the crop area using evenodd fill rule
    // This avoids destination-out which makes the crop area transparent (shows page bg instead of image)
    const radius = Math.min(CANVAS_W, CANVAS_H) / 2 - 4
    ctx.save()
    ctx.fillStyle = 'rgba(0,0,0,0.55)'
    ctx.beginPath()
    ctx.rect(0, 0, CANVAS_W, CANVAS_H)  // outer boundary
    if (shape === 'circle') {
      ctx.arc(CANVAS_W / 2, CANVAS_H / 2, radius, 0, Math.PI * 2)
    } else {
      ctx.rect(4, 4, CANVAS_W - 8, CANVAS_H - 8)  // inner crop rect
    }
    ctx.fill('evenodd')  // fills only between outer rect and inner shape
    ctx.restore()

    // Border
    ctx.save()
    ctx.strokeStyle = 'rgba(255,255,255,0.85)'
    ctx.lineWidth = 2
    if (shape === 'circle') {
      ctx.beginPath()
      ctx.arc(CANVAS_W / 2, CANVAS_H / 2, radius, 0, Math.PI * 2)
      ctx.stroke()
    } else {
      ctx.strokeRect(4, 4, CANVAS_W - 8, CANVAS_H - 8)
    }
    ctx.restore()
  }, [imgEl, offset, scale, shape, CANVAS_W, CANVAS_H])

  function clampOffset(x: number, y: number, currentScale: number) {
    if (!imgEl) return { x, y }
    const scaledW = imgEl.naturalWidth * currentScale
    const scaledH = imgEl.naturalHeight * currentScale
    return {
      x: Math.min(0, Math.max(CANVAS_W - scaledW, x)),
      y: Math.min(0, Math.max(CANVAS_H - scaledH, y)),
    }
  }

  function cssToCanvas(canvas: HTMLCanvasElement) {
    const rect = canvas.getBoundingClientRect()
    return { sx: CANVAS_W / rect.width, sy: CANVAS_H / rect.height }
  }

  function handleMouseDown(e: React.MouseEvent<HTMLCanvasElement>) {
    setDragging(true)
    setDragStart({ x: e.clientX, y: e.clientY })
  }

  function handleMouseMove(e: React.MouseEvent<HTMLCanvasElement>) {
    if (!dragging) return
    const { sx, sy } = cssToCanvas(e.currentTarget)
    setOffset((prev) => clampOffset(
      prev.x + (e.clientX - dragStart.x) * sx,
      prev.y + (e.clientY - dragStart.y) * sy,
      scale,
    ))
    setDragStart({ x: e.clientX, y: e.clientY })
  }

  function handleMouseUp() {
    setDragging(false)
  }

  const lastTouchRef = useRef<{ x: number; y: number } | null>(null)

  function handleTouchStart(e: React.TouchEvent<HTMLCanvasElement>) {
    if (e.touches.length === 1) {
      const t = e.touches[0]!
      lastTouchRef.current = { x: t.clientX, y: t.clientY }
    }
  }

  function handleTouchMove(e: React.TouchEvent<HTMLCanvasElement>) {
    e.preventDefault()
    if (e.touches.length === 1 && lastTouchRef.current) {
      const t = e.touches[0]!
      const { sx, sy } = cssToCanvas(e.currentTarget)
      const dx = (t.clientX - lastTouchRef.current.x) * sx
      const dy = (t.clientY - lastTouchRef.current.y) * sy
      setOffset((prev) => clampOffset(prev.x + dx, prev.y + dy, scale))
      lastTouchRef.current = { x: t.clientX, y: t.clientY }
    }
  }

  function handleTouchEnd() {
    lastTouchRef.current = null
  }

  function handleSave() {
    if (!imgEl) return
    const offscreen = document.createElement('canvas')
    offscreen.width = OUT_W
    offscreen.height = OUT_H
    const ctx = offscreen.getContext('2d')!
    const scaleX = OUT_W / CANVAS_W
    const scaleY = OUT_H / CANVAS_H
    ctx.drawImage(
      imgEl,
      offset.x * scaleX,
      offset.y * scaleY,
      imgEl.naturalWidth * scale * scaleX,
      imgEl.naturalHeight * scale * scaleY,
    )
    offscreen.toBlob((blob) => {
      if (blob) onSave(blob)
    }, 'image/jpeg', 0.92)
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
      <div className="bg-(--color-background) rounded-2xl shadow-2xl w-full max-w-sm overflow-hidden">
        <div className="flex items-center justify-between px-4 py-3 border-b border-(--color-border)">
          <h3 className="font-semibold text-sm text-(--color-text-primary)">Fotoğrafı Konumlandır</h3>
          <button
            onClick={onCancel}
            className="text-(--color-text-tertiary) hover:text-(--color-text-primary) transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
        <div className="p-4 flex flex-col items-center gap-4">
          {imgEl ? (
            <canvas
              ref={canvasRef}
              width={CANVAS_W}
              height={CANVAS_H}
              className="rounded-xl cursor-move select-none"
              style={{ touchAction: 'none', maxWidth: '100%' }}
              onMouseDown={handleMouseDown}
              onMouseMove={handleMouseMove}
              onMouseUp={handleMouseUp}
              onMouseLeave={handleMouseUp}
              onTouchStart={handleTouchStart}
              onTouchMove={handleTouchMove}
              onTouchEnd={handleTouchEnd}
            />
          ) : (
            <div
              className="rounded-xl bg-(--color-background-secondary) flex items-center justify-center"
              style={{ width: CANVAS_W, height: CANVAS_H, maxWidth: '100%' }}
            >
              <Loader2 className="w-6 h-6 animate-spin text-(--color-text-tertiary)" />
            </div>
          )}
          <div className="w-full flex items-center gap-3">
            <span className="text-xs text-(--color-text-tertiary) flex-shrink-0">Yakınlaştır</span>
            <input
              type="range"
              min={minScale}
              max={minScale * 4}
              step={minScale * 0.05}
              value={scale}
              onChange={(e) => {
                const newScale = Number(e.target.value)
                setScale(newScale)
                setOffset((prev) => clampOffset(prev.x, prev.y, newScale))
              }}
              className="flex-1 accent-[--color-coral]"
            />
          </div>
        </div>
        <div className="flex gap-2 justify-end px-4 pb-4">
          <Button variant="ghost" size="sm" onClick={onCancel}>
            İptal
          </Button>
          <Button
            size="sm"
            onClick={handleSave}
            disabled={!imgEl}
            className="bg-(--color-coral) hover:bg-(--color-coral-hover) text-white"
          >
            Kaydet
          </Button>
        </div>
      </div>
    </div>
  )
}

// ─── Profile Tab ─────────────────────────────────────────────────────────────

function ProfileTab({ session }: { session: ReturnType<typeof useSession>['data'] }) {
  const [displayName, setDisplayName] = useState(session?.user.name ?? '')
  const [bio, setBio] = useState('')
  const [location, setLocation] = useState('')
  const [website, setWebsite] = useState('')
  const [isLocked, setIsLocked] = useState(false)
  const [profileFields, setProfileFields] = useState<Array<{ name: string; value: string }>>([{ name: '', value: '' }])
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null)
  const [headerUrl, setHeaderUrl] = useState<string | null>(null)
  const [uploadingAvatar, setUploadingAvatar] = useState(false)
  const [uploadingHeader, setUploadingHeader] = useState(false)
  const avatarInputRef = useRef<HTMLInputElement>(null)
  const headerInputRef = useRef<HTMLInputElement>(null)
  const [cropFile, setCropFile] = useState<File | null>(null)
  const [cropShape, setCropShape] = useState<'circle' | 'banner'>('circle')

  // Bluesky linking
  const [blueskyHandle, setBlueskyHandle] = useState('')
  const [savingBluesky, setSavingBluesky] = useState(false)
  const [savedBluesky, setSavedBluesky] = useState(false)

  // Domain handle
  const [customHandle, setCustomHandle] = useState('')
  const [customHandleVerifiedAt, setCustomHandleVerifiedAt] = useState<string | null>(null)
  const [savingDomain, setSavingDomain] = useState(false)
  const [verifyingDomain, setVerifyingDomain] = useState(false)
  const [domainError, setDomainError] = useState<string | null>(null)
  const [domainSaved, setDomainSaved] = useState(false)

  const handle = (session?.user as { handle?: string } | undefined)?.handle
  const email = session?.user.email

  useEffect(() => {
    if (handle) {
      api.actors.get(handle).then((actor) => {
        setDisplayName(actor.displayName ?? session?.user.name ?? '')
        setBio(actor.bio ?? '')
        setLocation(actor.location ?? '')
        setWebsite(actor.website ?? '')
        setAvatarUrl(actor.avatarUrl)
        setHeaderUrl(actor.headerUrl)
        setIsLocked(actor.isLocked ?? false)
        setBlueskyHandle(actor.blueskyHandle ?? '')
        setCustomHandle(actor.customHandle ?? '')
        setCustomHandleVerifiedAt(actor.customHandleVerifiedAt ?? null)
        const fields = actor.profileFields ?? []
        setProfileFields(fields.length > 0 ? fields : [{ name: '', value: '' }])
      }).catch(() => {})
    }
  }, [handle, session])

  async function saveBluesky() {
    setSavingBluesky(true)
    try {
      const cleaned = blueskyHandle.replace(/^@/, '').trim() || null
      await api.account.linkBluesky(cleaned)
      setSavedBluesky(true)
      setTimeout(() => setSavedBluesky(false), 2000)
    } catch {
    } finally {
      setSavingBluesky(false)
    }
  }

  async function saveDomain() {
    setSavingDomain(true)
    setDomainError(null)
    try {
      const cleaned = customHandle.replace(/^@/, '').trim().toLowerCase() || null
      await api.account.setDomainHandle(cleaned)
      setCustomHandle(cleaned ?? '')
      setCustomHandleVerifiedAt(null)
      setDomainSaved(true)
      setTimeout(() => setDomainSaved(false), 2000)
    } catch (err) {
      setDomainError((err as Error).message ?? 'Kaydedilemedi')
    } finally {
      setSavingDomain(false)
    }
  }

  async function verifyDomain() {
    setVerifyingDomain(true)
    setDomainError(null)
    try {
      const res = await api.account.verifyDomainHandle()
      if (res.verified) {
        setCustomHandleVerifiedAt(res.verifiedAt ?? new Date().toISOString())
      } else {
        setDomainError(res.error ?? 'Doğrulama başarısız')
      }
    } catch (err) {
      setDomainError((err as Error).message ?? 'Doğrulama başarısız')
    } finally {
      setVerifyingDomain(false)
    }
  }

  function handleAvatarFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    e.target.value = ''
    setCropShape('circle')
    setCropFile(file)
  }

  function handleHeaderFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    e.target.value = ''
    setCropShape('banner')
    setCropFile(file)
  }

  async function onCropSave(blob: Blob) {
    const file = new File([blob], 'image.jpg', { type: 'image/jpeg' })
    setCropFile(null)
    if (cropShape === 'circle') {
      setUploadingAvatar(true)
      try {
        const { url } = await api.account.uploadAvatar(file)
        setAvatarUrl(url)
      } catch { /* ignore */ } finally {
        setUploadingAvatar(false)
      }
    } else {
      setUploadingHeader(true)
      try {
        const { url } = await api.account.uploadHeader(file)
        setHeaderUrl(url)
      } catch { /* ignore */ } finally {
        setUploadingHeader(false)
      }
    }
  }

  async function save() {
    setSaving(true)
    try {
      const websiteTrimmed = website.trim()
      await api.account.updateProfile({
        displayName: displayName || undefined,
        bio: bio || undefined,
        location: location.trim() || null,
        website: websiteTrimmed ? (websiteTrimmed.startsWith('http') ? websiteTrimmed : `https://${websiteTrimmed}`) : null,
        isLocked,
        profileFields: profileFields.filter((f) => f.name.trim() || f.value.trim()),
      })
      setSaved(true)
      setTimeout(() => setSaved(false), 2000)
    } catch {
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="space-y-6 max-w-md">
      {/* ── Profile visuals ── */}
      <div>
        <p className="text-sm font-semibold text-(--color-text-primary) mb-3">Görsel</p>
        {/* Header image + overlaid avatar */}
        <div className="relative mb-10">
          <div
            className="relative h-28 rounded-xl overflow-hidden bg-(--color-background-secondary) cursor-pointer group"
            onClick={() => headerInputRef.current?.click()}
          >
            {headerUrl
              // eslint-disable-next-line @next/next/no-img-element
              ? <img src={headerUrl} alt="" className="w-full h-full object-cover" />
              : <div className="w-full h-full" style={{ background: 'linear-gradient(135deg, var(--color-background-secondary), var(--color-background-tertiary))' }} />}
            <div className="absolute inset-0 flex items-center justify-center gap-1.5 bg-black/35 opacity-0 group-hover:opacity-100 transition-opacity">
              {uploadingHeader
                ? <Loader2 className="w-4 h-4 text-white animate-spin" />
                : <><Camera className="w-4 h-4 text-white" /><span className="text-xs text-white font-medium">Kapak</span></>}
            </div>
          </div>
          {/* Avatar overlaid on header bottom-left */}
          <div
            className="absolute -bottom-8 left-4 w-16 h-16 rounded-full border-2 border-(--color-background) overflow-hidden cursor-pointer group"
            onClick={() => avatarInputRef.current?.click()}
          >
            {avatarUrl
              // eslint-disable-next-line @next/next/no-img-element
              ? <img src={avatarUrl} alt="" className="w-full h-full object-cover" />
              : <div className="w-full h-full" style={{ background: 'linear-gradient(135deg, var(--color-coral), var(--color-peach))' }} />}
            <div className="absolute inset-0 flex items-center justify-center bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity rounded-full">
              {uploadingAvatar
                ? <Loader2 className="w-3.5 h-3.5 text-white animate-spin" />
                : <Camera className="w-3.5 h-3.5 text-white" />}
            </div>
          </div>
        </div>
        <input ref={headerInputRef} type="file" accept="image/*" className="hidden" onChange={handleHeaderFileChange} />
        <input ref={avatarInputRef} type="file" accept="image/*" className="hidden" onChange={handleAvatarFileChange} />
        <p className="text-xs text-(--color-text-tertiary)">Başlık veya profil fotoğrafına tıkla.</p>
      </div>

      {/* ── Account info (read-only) ── */}
      {(handle || email) && (
        <div className="rounded-xl border border-(--color-border) bg-(--color-background-secondary) divide-y divide-(--color-border-secondary)">
          {handle && (
            <div className="flex items-center justify-between px-4 py-2.5">
              <span className="text-xs text-(--color-text-tertiary)">Kullanıcı adı</span>
              <span className="text-xs font-mono font-medium text-(--color-text-primary)">@{handle}</span>
            </div>
          )}
          {email && (
            <div className="flex items-center justify-between px-4 py-2.5">
              <span className="text-xs text-(--color-text-tertiary)">E-posta</span>
              <span className="text-xs text-(--color-text-secondary) truncate ml-6 max-w-[200px]">{email}</span>
            </div>
          )}
        </div>
      )}

      {/* ── Display name + bio ── */}
      <div className="space-y-4">
        <div>
          <Label htmlFor="displayName" className="text-xs font-medium text-(--color-text-secondary) mb-1.5 block">
            Görünen Ad
          </Label>
          <Input
            id="displayName"
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
            maxLength={100}
            placeholder="Adın"
          />
        </div>
        <div>
          <Label htmlFor="bio" className="text-xs font-medium text-(--color-text-secondary) mb-1.5 block">
            Biyografi
          </Label>
          <Textarea
            id="bio"
            value={bio}
            onChange={(e) => setBio(e.target.value)}
            maxLength={500}
            rows={3}
            placeholder="Kendinden kısaca bahset…"
            className="resize-none"
          />
          <p className="text-xs text-(--color-text-tertiary) mt-1 text-right">{bio.length}/500</p>
        </div>
        <div>
          <Label htmlFor="location" className="text-xs font-medium text-(--color-text-secondary) mb-1.5 block">
            Konum
          </Label>
          <Input
            id="location"
            value={location}
            onChange={(e) => setLocation(e.target.value)}
            maxLength={200}
            placeholder="İstanbul, Türkiye"
          />
        </div>
        <div>
          <Label htmlFor="website" className="text-xs font-medium text-(--color-text-secondary) mb-1.5 block">
            Web Sitesi
          </Label>
          <Input
            id="website"
            value={website}
            onChange={(e) => setWebsite(e.target.value)}
            maxLength={2048}
            placeholder="ornek.com"
            type="url"
          />
        </div>
        {/* Profile fields / link list */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <Label className="text-xs font-medium text-(--color-text-secondary)">Profil Bağlantıları</Label>
            <span className="text-[11px] text-(--color-text-tertiary)">{profileFields.filter((f) => f.name || f.value).length}/8</span>
          </div>
          <p className="text-xs text-(--color-text-tertiary) mb-3">Profilinde görünen isim-değer çiftleri. Bağlantılar, sosyal profiller, iletişim bilgisi.</p>
          <div className="space-y-2">
            {profileFields.map((field, i) => (
              <div key={i} className="flex gap-2 items-center">
                <input
                  value={field.name}
                  onChange={(e) => setProfileFields((prev) => prev.map((f, fi) => fi === i ? { ...f, name: e.target.value } : f))}
                  placeholder="Etiket (ör. GitHub)"
                  maxLength={255}
                  className="w-28 flex-shrink-0 text-sm bg-(--color-background-secondary) border border-(--color-border) rounded-lg px-2.5 py-1.5 text-(--color-text-primary) placeholder:text-(--color-text-tertiary) focus:outline-none focus:border-(--color-coral)/50"
                />
                <input
                  value={field.value}
                  onChange={(e) => setProfileFields((prev) => prev.map((f, fi) => fi === i ? { ...f, value: e.target.value } : f))}
                  placeholder="URL veya metin"
                  maxLength={2048}
                  className="flex-1 text-sm bg-(--color-background-secondary) border border-(--color-border) rounded-lg px-2.5 py-1.5 text-(--color-text-primary) placeholder:text-(--color-text-tertiary) focus:outline-none focus:border-(--color-coral)/50"
                />
                <button
                  onClick={() => setProfileFields((prev) => prev.filter((_, fi) => fi !== i))}
                  className="flex-shrink-0 p-1.5 rounded-lg text-(--color-text-tertiary) hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-950/20 transition-colors"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
            ))}
          </div>
          {profileFields.length < 8 && (
            <button
              onClick={() => setProfileFields((prev) => [...prev, { name: '', value: '' }])}
              className="mt-2 flex items-center gap-1.5 text-xs text-(--color-coral) hover:underline"
            >
              <Plus className="w-3.5 h-3.5" /> Bağlantı ekle
            </button>
          )}
        </div>
      </div>

      {/* ── Privacy ── */}
      <div className="flex items-center justify-between p-3.5 rounded-xl border border-(--color-border) bg-(--color-background-secondary)">
        <div>
          <p className="text-sm font-medium text-(--color-text-primary)">Hesabı Kilitle</p>
          <p className="text-xs text-(--color-text-tertiary) mt-0.5">Takip isteklerini manuel onayla</p>
        </div>
        <button
          onClick={() => setIsLocked((v) => !v)}
          className={cn(
            'relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none flex-shrink-0',
            isLocked ? 'bg-(--color-coral)' : 'bg-(--color-border)',
          )}
        >
          <span className={cn('inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform', isLocked ? 'translate-x-6' : 'translate-x-1')} />
        </button>
      </div>

      <Button
        onClick={save}
        disabled={saving || saved}
        className="bg-(--color-coral) hover:bg-(--color-peach) text-white"
      >
        {saving ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : saved ? <Check className="w-4 h-4 mr-2" /> : null}
        {saved ? 'Kaydedildi' : 'Kaydet'}
      </Button>

      {/* ── Bluesky & AT Protocol ── */}
      <div className="border-t border-(--color-border) pt-6 space-y-5">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <AtSign className="w-4 h-4 text-(--color-text-secondary)" />
            <p className="text-sm font-semibold text-(--color-text-primary)">AT Protocol / Bluesky</p>
          </div>
          <p className="text-xs text-(--color-text-tertiary)">
            floq, AT Protocol destekli bir sunucudur. Hesabın Bluesky ekosistemine köprülenebilir.
          </p>
        </div>

        {/* DID badge */}
        {handle && (
          <div className="rounded-xl border border-(--color-border) bg-(--color-background-secondary) p-3 space-y-1">
            <p className="text-[10px] text-(--color-text-tertiary) uppercase tracking-wide font-medium">Decentralized ID</p>
            <p className="text-xs font-mono text-(--color-text-primary) break-all">
              {`did:web:${typeof window !== 'undefined' ? new URL(process.env['NEXT_PUBLIC_API_URL'] ?? 'http://localhost:3001').host : '…'}:users:${handle}`}
            </p>
          </div>
        )}

        {/* Bridgy Fed bridge */}
        <div className="rounded-xl border border-(--color-border) bg-(--color-background-secondary) p-4 space-y-3">
          <div className="flex items-center gap-2">
            <Zap className="w-3.5 h-3.5 text-sky-500" />
            <p className="text-xs font-semibold text-(--color-text-primary)">Bridgy Fed Köprüsü</p>
            <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-sky-100 text-sky-600 dark:bg-sky-900/30 dark:text-sky-400 font-medium">Ücretsiz</span>
          </div>
          <p className="text-xs text-(--color-text-tertiary) leading-relaxed">
            Bluesky kullanıcıları seni <span className="font-mono text-(--color-text-secondary)">{handle ? `@${handle}.ap.brid.gy` : '@kullanici.ap.brid.gy'}</span> üzerinden takip edebilir. Aktivasyon gerekmez — hesabın zaten görünür.
          </p>
          {handle && (
            <a
              href={`https://bsky.app/profile/${handle}.${typeof window !== 'undefined' ? new URL(process.env['NEXT_PUBLIC_API_URL'] ?? 'http://localhost:3001').host : 'floq.com'}.ap.brid.gy`}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 text-xs text-sky-500 hover:text-sky-400 transition-colors"
            >
              <ExternalLink className="w-3 h-3" />
              Bluesky'da profili gör
            </a>
          )}
        </div>

        {/* Mevcut Bluesky hesabını bağla */}
        <div className="space-y-2">
          <p className="text-xs font-medium text-(--color-text-secondary)">Bluesky hesabını profilinde göster</p>
          <p className="text-xs text-(--color-text-tertiary)">
            Zaten bir Bluesky hesabın varsa handle'ını ekle. (örn. <span className="font-mono">kullanici.bsky.social</span>)
          </p>
          <div className="flex gap-2">
            <Input
              value={blueskyHandle}
              onChange={(e) => setBlueskyHandle(e.target.value)}
              placeholder="kullanici.bsky.social"
              className="font-mono text-sm"
            />
            <Button
              onClick={saveBluesky}
              disabled={savingBluesky || savedBluesky}
              variant="outline"
              className="flex-shrink-0"
            >
              {savingBluesky ? <Loader2 className="w-4 h-4 animate-spin" /> : savedBluesky ? <Check className="w-4 h-4" /> : 'Kaydet'}
            </Button>
          </div>
          {blueskyHandle && (
            <button
              onClick={() => { setBlueskyHandle(''); api.account.linkBluesky(null).catch(() => {}) }}
              className="text-xs text-(--color-text-tertiary) hover:text-red-500 transition-colors"
            >
              Bağlantıyı kaldır
            </button>
          )}
        </div>

        {/* Domain tabanlı handle */}
        <div className="border-t border-(--color-border) pt-5 space-y-3">
          <div>
            <p className="text-xs font-medium text-(--color-text-secondary)">Özel Domain Handle</p>
            <p className="text-xs text-(--color-text-tertiary) mt-0.5 leading-relaxed">
              Kendi domainini floq handle'ı olarak kullan. (örn. <span className="font-mono">adın.dev</span>)
            </p>
          </div>

          {customHandleVerifiedAt && (
            <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-emerald-50 dark:bg-emerald-950/20 border border-emerald-200 dark:border-emerald-900/50">
              <Check className="w-3.5 h-3.5 text-emerald-600 flex-shrink-0" />
              <p className="text-xs text-emerald-700 dark:text-emerald-400">
                <span className="font-mono font-semibold">@{customHandle}</span> doğrulandı
              </p>
            </div>
          )}

          <div className="flex gap-2">
            <Input
              value={customHandle}
              onChange={(e) => { setCustomHandle(e.target.value); setCustomHandleVerifiedAt(null) }}
              placeholder="adın.dev"
              className="font-mono text-sm"
            />
            <Button
              onClick={() => void saveDomain()}
              disabled={savingDomain || domainSaved}
              variant="outline"
              className="flex-shrink-0"
            >
              {savingDomain ? <Loader2 className="w-4 h-4 animate-spin" /> : domainSaved ? <Check className="w-4 h-4 text-emerald-500" /> : 'Kaydet'}
            </Button>
          </div>

          {/* Doğrulama adımları */}
          {customHandle && !customHandleVerifiedAt && (
            <div className="rounded-xl border border-(--color-border) bg-(--color-background-secondary) p-4 space-y-3">
              <p className="text-xs font-medium text-(--color-text-secondary)">Doğrulama adımları</p>
              <ol className="space-y-2 text-xs text-(--color-text-tertiary)">
                <li className="flex gap-2">
                  <span className="w-4 h-4 rounded-full bg-(--color-coral) text-white text-[9px] font-bold flex items-center justify-center flex-shrink-0 mt-0.5">1</span>
                  <span>
                    <span className="font-mono bg-(--color-background) px-1.5 py-0.5 rounded border border-(--color-border)">
                      https://{customHandle}/.well-known/floq-verification
                    </span>{' '}
                    adresinde bir dosya yayınla
                  </span>
                </li>
                <li className="flex gap-2">
                  <span className="w-4 h-4 rounded-full bg-(--color-coral) text-white text-[9px] font-bold flex items-center justify-center flex-shrink-0 mt-0.5">2</span>
                  <span>
                    Dosyanın içeriği tam olarak şu olsun:{' '}
                    <span className="font-mono bg-(--color-background) px-1.5 py-0.5 rounded border border-(--color-border)">
                      @{handle}@{instanceDomain()}
                    </span>
                  </span>
                </li>
              </ol>
              <Button
                onClick={() => void verifyDomain()}
                disabled={verifyingDomain}
                size="sm"
                className="text-white"
                style={{ background: 'var(--gradient-avatar)' }}
              >
                {verifyingDomain ? <><Loader2 className="w-3.5 h-3.5 animate-spin mr-1.5" />Kontrol ediliyor…</> : 'Doğrula'}
              </Button>
            </div>
          )}

          {domainError && (
            <p className="text-xs text-red-500">{domainError}</p>
          )}

          {customHandle && (
            <button
              onClick={() => { setCustomHandle(''); setCustomHandleVerifiedAt(null); api.account.setDomainHandle(null).catch(() => {}) }}
              className="text-xs text-(--color-text-tertiary) hover:text-red-500 transition-colors"
            >
              Domain handle'ı kaldır
            </button>
          )}
        </div>
      </div>

      {cropFile && (
        <CropModal
          file={cropFile}
          shape={cropShape}
          onSave={onCropSave}
          onCancel={() => setCropFile(null)}
        />
      )}
    </div>
  )
}

// ─── Moderation Tab ───────────────────────────────────────────────────────────

type ModerationSection = 'blocks' | 'mutes'

function ModerationTab() {
  const [section, setSection] = useState<ModerationSection>('blocks')
  const [blocked, setBlocked] = useState<Actor[]>([])
  const [muted, setMuted] = useState<MutedActor[]>([])
  const [loading, setLoading] = useState(true)
  const [acting, setActing] = useState<Set<string>>(new Set())
  const [search, setSearch] = useState('')
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [bulkActing, setBulkActing] = useState(false)

  useEffect(() => {
    setLoading(true)
    Promise.all([api.moderation.blocks.list(), api.moderation.mutes.list()])
      .then(([b, m]) => { setBlocked(b.blocked); setMuted(m.muted) })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  useEffect(() => { setSearch(''); setSelected(new Set()) }, [section])

  async function unblock(handle: string) {
    setActing((prev) => new Set([...prev, handle]))
    try {
      await api.moderation.blocks.unblock(handle)
      setBlocked((prev) => prev.filter((a) => a.handle !== handle))
      setSelected((prev) => { const s = new Set(prev); s.delete(handle); return s })
    } catch {
    } finally {
      setActing((prev) => { const s = new Set(prev); s.delete(handle); return s })
    }
  }

  async function unmute(handle: string) {
    setActing((prev) => new Set([...prev, handle]))
    try {
      await api.moderation.mutes.unmute(handle)
      setMuted((prev) => prev.filter((m) => m.actor.handle !== handle))
      setSelected((prev) => { const s = new Set(prev); s.delete(handle); return s })
    } catch {
    } finally {
      setActing((prev) => { const s = new Set(prev); s.delete(handle); return s })
    }
  }

  async function bulkUnblock() {
    setBulkActing(true)
    await Promise.allSettled([...selected].map((h) => api.moderation.blocks.unblock(h)))
    setBlocked((prev) => prev.filter((a) => !selected.has(a.handle)))
    setSelected(new Set())
    setBulkActing(false)
  }

  async function bulkUnmute() {
    setBulkActing(true)
    await Promise.allSettled([...selected].map((h) => api.moderation.mutes.unmute(h)))
    setMuted((prev) => prev.filter((m) => !selected.has(m.actor.handle)))
    setSelected(new Set())
    setBulkActing(false)
  }

  const q = search.toLowerCase()
  const filteredBlocked = blocked.filter((a) =>
    !q || (a.displayName ?? a.handle).toLowerCase().includes(q) || a.handle.toLowerCase().includes(q)
  )
  const filteredMuted = muted.filter(({ actor: a }) =>
    !q || (a.displayName ?? a.handle).toLowerCase().includes(q) || a.handle.toLowerCase().includes(q)
  )

  const currentHandles = section === 'blocks'
    ? filteredBlocked.map((a) => a.handle)
    : filteredMuted.map(({ actor }) => actor.handle)
  const allSelected = currentHandles.length > 0 && currentHandles.every((h) => selected.has(h))

  function toggleAll() {
    if (allSelected) setSelected(new Set())
    else setSelected(new Set(currentHandles))
  }

  function toggleOne(handle: string) {
    setSelected((prev) => {
      const s = new Set(prev)
      if (s.has(handle)) s.delete(handle)
      else s.add(handle)
      return s
    })
  }

  return (
    <div className="space-y-4 max-w-md">
      {/* Section tabs */}
      <div className="flex gap-1">
        {(['blocks', 'mutes'] as const).map((s) => (
          <button
            key={s}
            onClick={() => setSection(s)}
            className={cn(
              'flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors',
              section === s ? 'bg-(--color-blush) text-(--color-coral) dark:bg-(--color-coral)/12' : 'text-(--color-text-tertiary) hover:text-(--color-text-primary)',
            )}
          >
            {s === 'blocks' ? <ShieldOff className="w-3.5 h-3.5" /> : <BellOff className="w-3.5 h-3.5" />}
            {s === 'blocks'
              ? `Engellenenler${blocked.length ? ` (${blocked.length})` : ''}`
              : `Susturulanlar${muted.length ? ` (${muted.length})` : ''}`}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="flex items-center justify-center h-24">
          <Loader2 className="w-5 h-5 animate-spin text-(--color-coral)" />
        </div>
      ) : (
        <>
          {/* Search */}
          {(section === 'blocks' ? blocked : muted).length > 3 && (
            <div className="relative">
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Ara..."
                className="w-full text-sm bg-(--color-background-secondary) border border-(--color-border) rounded-xl px-3 py-2 pl-8 text-(--color-text-primary) placeholder:text-(--color-text-tertiary) focus:outline-none focus:border-(--color-coral)/50"
              />
              <AtSign className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-(--color-text-tertiary)" />
              {search && (
                <button onClick={() => setSearch('')} className="absolute right-2.5 top-1/2 -translate-y-1/2">
                  <X className="w-3.5 h-3.5 text-(--color-text-tertiary)" />
                </button>
              )}
            </div>
          )}

          {/* Bulk action bar */}
          {selected.size > 0 && (
            <div className="flex items-center justify-between px-3 py-2 rounded-xl bg-(--color-background-secondary) border border-(--color-border)">
              <span className="text-xs text-(--color-text-secondary)">{selected.size} seçildi</span>
              <button
                onClick={() => void (section === 'blocks' ? bulkUnblock() : bulkUnmute())}
                disabled={bulkActing}
                className="flex items-center gap-1.5 text-xs font-medium text-red-500 hover:text-red-600 disabled:opacity-50"
              >
                {bulkActing ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />}
                {section === 'blocks' ? 'Engeli Kaldır' : 'Susturmayı Kaldır'}
              </button>
            </div>
          )}

          {section === 'blocks' ? (
            filteredBlocked.length === 0 ? (
              <p className="text-sm text-(--color-text-tertiary) py-8 text-center">
                {search ? 'Sonuç bulunamadı.' : 'Engellediğin kimse yok.'}
              </p>
            ) : (
              <div className="rounded-xl border border-(--color-border) overflow-hidden divide-y divide-(--color-border-secondary)">
                {/* Select all */}
                <div className="flex items-center gap-2 px-3 py-2 bg-(--color-background-secondary)">
                  <input type="checkbox" checked={allSelected} onChange={toggleAll} className="w-3.5 h-3.5 accent-(--color-coral)" />
                  <span className="text-xs text-(--color-text-tertiary)">Tümünü seç</span>
                </div>
                {filteredBlocked.map((actor) => (
                  <div key={actor.id} className="flex items-center gap-3 px-3 py-2.5 bg-(--color-background)">
                    <input
                      type="checkbox"
                      checked={selected.has(actor.handle)}
                      onChange={() => toggleOne(actor.handle)}
                      className="w-3.5 h-3.5 flex-shrink-0 accent-(--color-coral)"
                    />
                    <div className="w-8 h-8 rounded-full flex-shrink-0 overflow-hidden bg-(--color-background-secondary) ring-1 ring-(--color-border)">
                      {actor.avatarUrl
                        // eslint-disable-next-line @next/next/no-img-element
                        ? <img src={actor.avatarUrl} alt="" className="w-full h-full object-cover" />
                        : <div className="w-full h-full flex items-center justify-center text-xs font-bold text-(--color-text-tertiary)">{(actor.displayName ?? actor.handle)[0]?.toUpperCase()}</div>
                      }
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-(--color-text-primary) truncate">{actor.displayName ?? actor.handle}</p>
                      <p className="text-xs text-(--color-text-tertiary)">@{actor.handle}</p>
                    </div>
                    <button
                      onClick={() => void unblock(actor.handle)}
                      disabled={acting.has(actor.handle)}
                      className="flex-shrink-0 flex items-center gap-1 text-xs text-red-500 hover:text-red-600 disabled:opacity-50 px-2 py-1 rounded-lg hover:bg-red-50 dark:hover:bg-red-950/20"
                    >
                      {acting.has(actor.handle) ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <X className="w-3.5 h-3.5" />}
                      Kaldır
                    </button>
                  </div>
                ))}
              </div>
            )
          ) : (
            filteredMuted.length === 0 ? (
              <p className="text-sm text-(--color-text-tertiary) py-8 text-center">
                {search ? 'Sonuç bulunamadı.' : 'Susturduğun kimse yok.'}
              </p>
            ) : (
              <div className="rounded-xl border border-(--color-border) overflow-hidden divide-y divide-(--color-border-secondary)">
                <div className="flex items-center gap-2 px-3 py-2 bg-(--color-background-secondary)">
                  <input type="checkbox" checked={allSelected} onChange={toggleAll} className="w-3.5 h-3.5 accent-(--color-coral)" />
                  <span className="text-xs text-(--color-text-tertiary)">Tümünü seç</span>
                </div>
                {filteredMuted.map(({ actor, hideNotifications, expiresAt }) => (
                  <div key={actor.id} className="flex items-center gap-3 px-3 py-2.5 bg-(--color-background)">
                    <input
                      type="checkbox"
                      checked={selected.has(actor.handle)}
                      onChange={() => toggleOne(actor.handle)}
                      className="w-3.5 h-3.5 flex-shrink-0 accent-(--color-coral)"
                    />
                    <div className="w-8 h-8 rounded-full flex-shrink-0 overflow-hidden bg-(--color-background-secondary) ring-1 ring-(--color-border)">
                      {actor.avatarUrl
                        // eslint-disable-next-line @next/next/no-img-element
                        ? <img src={actor.avatarUrl} alt="" className="w-full h-full object-cover" />
                        : <div className="w-full h-full flex items-center justify-center text-xs font-bold text-(--color-text-tertiary)">{(actor.displayName ?? actor.handle)[0]?.toUpperCase()}</div>
                      }
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-(--color-text-primary) truncate">{actor.displayName ?? actor.handle}</p>
                      <p className="text-xs text-(--color-text-tertiary)">@{actor.handle}</p>
                      <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                        {hideNotifications && (
                          <span className="text-[10px] text-(--color-text-tertiary) flex items-center gap-0.5">
                            <BellOff className="w-3 h-3" /> bildirimler gizli
                          </span>
                        )}
                        {expiresAt && (
                          <span className="text-[10px] text-(--color-text-tertiary)">
                            · {new Date(expiresAt).toLocaleDateString('tr-TR', { day: 'numeric', month: 'short' })} sona erer
                          </span>
                        )}
                      </div>
                    </div>
                    <button
                      onClick={() => void unmute(actor.handle)}
                      disabled={acting.has(actor.handle)}
                      className="flex-shrink-0 flex items-center gap-1 text-xs text-red-500 hover:text-red-600 disabled:opacity-50 px-2 py-1 rounded-lg hover:bg-red-50 dark:hover:bg-red-950/20"
                    >
                      {acting.has(actor.handle) ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <X className="w-3.5 h-3.5" />}
                      Kaldır
                    </button>
                  </div>
                ))}
              </div>
            )
          )}
        </>
      )}
    </div>
  )
}

// ─── Filters Tab ─────────────────────────────────────────────────────────────

const CONTEXTS = [
  { value: 'home', label: 'Ana Feed' },
  { value: 'explore', label: 'Keşfet' },
  { value: 'all', label: 'Her Yerde' },
]

function FiltersTab() {
  const [filters, setFilters] = useState<KeywordFilter[]>([])
  const [loading, setLoading] = useState(true)
  const [adding, setAdding] = useState(false)
  const [newKeyword, setNewKeyword] = useState('')
  const [newWholeWord, setNewWholeWord] = useState(false)
  const [newContext, setNewContext] = useState('home')
  const [newAction, setNewAction] = useState<'warn' | 'hide'>('warn')
  const [saving, setSaving] = useState(false)
  const [deleting, setDeleting] = useState<string | null>(null)

  useEffect(() => {
    api.filters.list()
      .then((data) => setFilters(data.filters))
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  async function addFilter() {
    if (!newKeyword.trim()) return
    setSaving(true)
    try {
      const filter = await api.filters.create({
        keyword: newKeyword.trim(),
        wholeWord: newWholeWord,
        contexts: newContext,
        action: newAction,
      })
      setFilters((prev) => [filter, ...prev])
      setNewKeyword('')
      setNewWholeWord(false)
      setNewContext('home')
      setNewAction('warn')
      setAdding(false)
    } catch {} finally {
      setSaving(false)
    }
  }

  async function deleteFilter(id: string) {
    setDeleting(id)
    try {
      await api.filters.delete(id)
      setFilters((prev) => prev.filter((f) => f.id !== id))
    } catch {} finally {
      setDeleting(null)
    }
  }

  return (
    <div className="space-y-4 max-w-md">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm font-medium text-(--color-text-primary)">Anahtar Kelime Filtreleri</p>
          <p className="text-xs text-(--color-text-tertiary) mt-0.5">
            Eşleşen gönderiler gizlenir veya uyarı gösterir.
          </p>
        </div>
        <button
          onClick={() => setAdding((v) => !v)}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-(--color-coral) text-white hover:bg-(--color-coral-hover) transition-colors"
        >
          <Plus className="w-3.5 h-3.5" />
          Ekle
        </button>
      </div>

      {adding && (
        <div className="border border-(--color-border) rounded-xl p-4 space-y-3 bg-(--color-background-secondary)">
          <div>
            <Label className="text-xs text-(--color-text-secondary) mb-1 block">Anahtar Kelime</Label>
            <Input
              value={newKeyword}
              onChange={(e) => setNewKeyword(e.target.value)}
              placeholder="örn. spam, reklam…"
              onKeyDown={(e) => { if (e.key === 'Enter') void addFilter() }}
              autoFocus
            />
          </div>
          <div className="flex gap-3 flex-wrap">
            <div>
              <Label className="text-xs text-(--color-text-secondary) mb-1 block">Bağlam</Label>
              <div className="flex gap-1">
                {CONTEXTS.map((c) => (
                  <button
                    key={c.value}
                    onClick={() => setNewContext(c.value)}
                    className={cn(
                      'px-2.5 py-1 rounded-lg text-xs font-medium border transition-colors',
                      newContext === c.value
                        ? 'border-(--color-coral) bg-(--color-blush) text-(--color-coral) dark:bg-(--color-coral)/12'
                        : 'border-(--color-border) text-(--color-text-secondary)',
                    )}
                  >
                    {c.label}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <Label className="text-xs text-(--color-text-secondary) mb-1 block">Eylem</Label>
              <div className="flex gap-1">
                {(['warn', 'hide'] as const).map((a) => (
                  <button
                    key={a}
                    onClick={() => setNewAction(a)}
                    className={cn(
                      'px-2.5 py-1 rounded-lg text-xs font-medium border transition-colors',
                      newAction === a
                        ? 'border-(--color-coral) bg-(--color-blush) text-(--color-coral) dark:bg-(--color-coral)/12'
                        : 'border-(--color-border) text-(--color-text-secondary)',
                    )}
                  >
                    {a === 'warn' ? 'Uyar' : 'Gizle'}
                  </button>
                ))}
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setNewWholeWord((v) => !v)}
              className={cn(
                'relative inline-flex h-5 w-9 items-center rounded-full transition-colors flex-shrink-0',
                newWholeWord ? 'bg-(--color-coral)' : 'bg-(--color-border)',
              )}
            >
              <span className={cn('inline-block h-3.5 w-3.5 transform rounded-full bg-white shadow transition-transform', newWholeWord ? 'translate-x-4' : 'translate-x-0.5')} />
            </button>
            <span className="text-xs text-(--color-text-secondary)">Tam kelime eşleşmesi</span>
          </div>
          <div className="flex gap-2">
            <Button variant="ghost" size="sm" onClick={() => setAdding(false)} className="flex-1 text-(--color-text-tertiary)">
              İptal
            </Button>
            <Button
              size="sm"
              onClick={() => void addFilter()}
              disabled={saving || !newKeyword.trim()}
              className="flex-1 bg-(--color-coral) hover:bg-(--color-coral-hover) text-white"
            >
              {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : 'Kaydet'}
            </Button>
          </div>
        </div>
      )}

      {loading ? (
        <div className="flex items-center justify-center h-24">
          <Loader2 className="w-5 h-5 animate-spin text-(--color-coral)" />
        </div>
      ) : filters.length === 0 ? (
        <p className="text-sm text-(--color-text-tertiary) py-8 text-center">Henüz filtre eklemedin.</p>
      ) : (
        <div className="space-y-2">
          {filters.map((filter) => (
            <div
              key={filter.id}
              className="flex items-center justify-between p-3 rounded-xl border border-(--color-border) bg-(--color-background-secondary)"
            >
              <div className="min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <p className="text-sm font-medium text-(--color-text-primary) font-mono">
                    {filter.wholeWord ? `"${filter.keyword}"` : filter.keyword}
                  </p>
                  <span className={cn(
                    'text-[10px] px-1.5 py-0.5 rounded-full font-medium',
                    filter.action === 'hide'
                      ? 'bg-red-100 text-red-600 dark:bg-red-900/30'
                      : 'bg-(--color-blush) text-(--color-coral) dark:bg-(--color-coral)/12',
                  )}>
                    {filter.action === 'hide' ? 'Gizle' : 'Uyar'}
                  </span>
                  <span className="text-[10px] text-(--color-text-tertiary)">
                    {CONTEXTS.find((c) => c.value === filter.contexts)?.label ?? filter.contexts}
                  </span>
                </div>
                {filter.expiresAt && (
                  <p className="text-[10px] text-(--color-text-tertiary) mt-0.5">
                    {new Date(filter.expiresAt).toLocaleDateString('tr-TR')} sona erer
                  </p>
                )}
              </div>
              <button
                onClick={() => void deleteFilter(filter.id)}
                disabled={deleting === filter.id}
                className="ml-3 flex-shrink-0 text-(--color-text-tertiary) hover:text-red-500 transition-colors"
              >
                {deleting === filter.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <X className="w-4 h-4" />}
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// ─── Security (2FA) Tab ───────────────────────────────────────────────────────

function ChangePasswordSection() {
  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [done, setDone] = useState(false)

  async function change() {
    if (!currentPassword || !newPassword) return
    setLoading(true)
    setError('')
    try {
      const res = await authClient.changePassword({ currentPassword, newPassword, revokeOtherSessions: false })
      if (res.error) { setError(res.error.message ?? 'Hata oluştu'); return }
      setDone(true)
      setCurrentPassword('')
      setNewPassword('')
      setTimeout(() => setDone(false), 3000)
    } catch {
      setError('Hata oluştu')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="space-y-3">
      <h3 className="text-sm font-semibold text-(--color-text-primary)">Şifre Değiştir</h3>
      <div>
        <Label htmlFor="currentPassword" className="text-sm text-(--color-text-secondary) mb-1.5 block">Mevcut Şifre</Label>
        <Input id="currentPassword" type="password" value={currentPassword} onChange={(e) => setCurrentPassword(e.target.value)} />
      </div>
      <div>
        <Label htmlFor="newPassword" className="text-sm text-(--color-text-secondary) mb-1.5 block">Yeni Şifre</Label>
        <Input id="newPassword" type="password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} />
      </div>
      {error && <p className="text-xs text-red-500">{error}</p>}
      <Button
        onClick={change}
        disabled={loading || !currentPassword || !newPassword || done}
        className="bg-(--color-coral) hover:bg-(--color-peach) text-white"
      >
        {loading && <Loader2 className="w-4 h-4 animate-spin mr-2" />}
        {done ? <><Check className="w-4 h-4 mr-2" />Değiştirildi</> : 'Şifreyi Değiştir'}
      </Button>
    </div>
  )
}

type TwoFAStep = 'idle' | 'done'

function SecurityTab({ session }: { session: ReturnType<typeof useSession>['data'] }) {
  const twoFAEnabled = (session?.user as { twoFactorEnabled?: boolean } | null)?.twoFactorEnabled ?? false
  const [step, setStep] = useState<TwoFAStep>('idle')
  const [totpUri, setTotpUri] = useState('')
  const [backupCodes, setBackupCodes] = useState<string[]>([])
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  async function enableTwoFactor() {
    setLoading(true)
    setError('')
    try {
      const res = await authClient.twoFactor.enable({ password })
      if (res.error) { setError(res.error.message ?? 'Hata oluştu'); return }
      const data = res.data as { totpURI?: string; backupCodes?: string[] } | null
      setTotpUri(data?.totpURI ?? '')
      setBackupCodes(data?.backupCodes ?? [])
      setStep('done')
    } finally {
      setLoading(false)
    }
  }

  async function disableTwoFactor() {
    setLoading(true)
    setError('')
    try {
      const res = await authClient.twoFactor.disable({ password })
      if (res.error) { setError(res.error.message ?? 'Hata oluştu'); return }
      setPassword('')
    } finally {
      setLoading(false)
    }
  }

  if (twoFAEnabled) {
    return (
      <div className="space-y-8 max-w-md">
        <ChangePasswordSection />
        <div className="border-t border-(--color-border) pt-6 space-y-4">
          <div className="flex items-center gap-2 text-green-600">
            <Check className="w-4 h-4" />
            <p className="text-sm font-medium">İki faktörlü doğrulama aktif</p>
          </div>
          <p className="text-xs text-(--color-text-tertiary)">
            Hesabın TOTP uygulamasıyla korunuyor. Devre dışı bırakmak için şifreni gir.
          </p>
          <div>
            <Label className="text-sm text-(--color-text-secondary) mb-1.5 block">Şifren</Label>
            <Input type="password" value={password} onChange={(e) => setPassword(e.target.value)} />
          </div>
          {error && <p className="text-xs text-red-500">{error}</p>}
          <Button
            variant="outline"
            onClick={disableTwoFactor}
            disabled={loading || !password}
            className="text-red-500 border-red-200 hover:bg-red-50 hover:text-red-600"
          >
            {loading && <Loader2 className="w-4 h-4 animate-spin mr-2" />}
            2FA&apos;yı Devre Dışı Bırak
          </Button>
        </div>
        <div className="border-t border-(--color-border) pt-5">
          <h3 className="text-sm font-semibold text-(--color-text-primary) mb-0.5">Uçtan Uca Şifreleme</h3>
          <p className="text-xs text-(--color-text-tertiary) mb-3">
            Mesajların yalnızca sen ve alıcı tarafından okunabilmesi için cihazına özel şifreleme anahtarı kullanılır.
            Anahtar yenilenirse eski mesajlar bu cihazda çözümlenemez.
          </p>
          <E2EKeyStatus />
        </div>
      </div>
    )
  }

  if (step === 'done') {
    return (
      <div className="space-y-8 max-w-md">
        <ChangePasswordSection />
        <div className="border-t border-(--color-border) pt-6 space-y-4">
          <div className="flex items-center gap-2 text-green-600">
            <Check className="w-4 h-4" />
            <p className="text-sm font-medium">2FA etkinleştirildi!</p>
          </div>
          <p className="text-sm text-(--color-text-secondary)">
            Authenticator uygulamanla bu QR kodu tara.
          </p>
          {totpUri && (
            <div className="p-3 bg-white rounded-xl border border-(--color-border) inline-block">
              <QRCodeSVG value={totpUri} size={180} />
            </div>
          )}
          <p className="text-sm text-(--color-text-secondary) pt-2">
            Yedek kodlarını güvenli bir yerde sakla:
          </p>
          <div className="bg-(--color-background-secondary) rounded-xl p-3 font-mono text-xs grid grid-cols-2 gap-1.5">
            {backupCodes.map((c) => (
              <span key={c} className="text-(--color-text-primary)">{c}</span>
            ))}
          </div>
          <Button
            onClick={() => { setStep('idle'); setPassword('') }}
            className="bg-(--color-coral) hover:bg-(--color-peach) text-white"
          >
            Tamam
          </Button>
        </div>
        <div className="border-t border-(--color-border) pt-5">
          <h3 className="text-sm font-semibold text-(--color-text-primary) mb-0.5">Uçtan Uca Şifreleme</h3>
          <p className="text-xs text-(--color-text-tertiary) mb-3">
            Mesajların yalnızca sen ve alıcı tarafından okunabilmesi için cihazına özel şifreleme anahtarı kullanılır.
            Anahtar yenilenirse eski mesajlar bu cihazda çözümlenemez.
          </p>
          <E2EKeyStatus />
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-8 max-w-md">
      <ChangePasswordSection />
      <div className="border-t border-(--color-border) pt-6 space-y-4">
        <h3 className="text-sm font-semibold text-(--color-text-primary)">İki Faktörlü Doğrulama</h3>
        <p className="text-sm text-(--color-text-secondary)">
          İki faktörlü doğrulama hesabına ekstra güvenlik katmanı ekler.
        </p>
        <div>
          <Label className="text-sm text-(--color-text-secondary) mb-1.5 block">
            Devam etmek için şifreni gir
          </Label>
          <Input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Şifren"
          />
        </div>
        {error && <p className="text-xs text-red-500">{error}</p>}
        <Button
          onClick={enableTwoFactor}
          disabled={loading || !password}
          className="bg-(--color-coral) hover:bg-(--color-peach) text-white"
        >
          {loading && <Loader2 className="w-4 h-4 animate-spin mr-2" />}
          2FA Kur
        </Button>
      </div>
      <div className="border-t border-(--color-border) pt-5">
        <h3 className="text-sm font-semibold text-(--color-text-primary) mb-0.5">Uçtan Uca Şifreleme</h3>
        <p className="text-xs text-(--color-text-tertiary) mb-3">
          Mesajların yalnızca sen ve alıcı tarafından okunabilmesi için cihazına özel şifreleme anahtarı kullanılır.
          Anahtar yenilenirse eski mesajlar bu cihazda çözümlenemez.
        </p>
        <E2EKeyStatus />
      </div>
    </div>
  )
}

// ─── E2E Key Status ───────────────────────────────────────────────────────────

function E2EKeyStatus() {
  const [hasKey, setHasKey] = useState<boolean | null>(null)
  const [refreshing, setRefreshing] = useState(false)

  useEffect(() => {
    import('@/lib/e2e-crypto').then(({ loadPrivateKey }) =>
      loadPrivateKey().then((k) => setHasKey(k !== null))
    ).catch(() => setHasKey(false))
  }, [])

  async function handleRefresh() {
    if (!confirm('Anahtarı yenilemek eski şifreli mesajları bu cihazda okunamaz hale getirir. Devam et?')) return
    setRefreshing(true)
    try {
      const { generateAndStoreKeyPair } = await import('@/lib/e2e-crypto')
      const pubKey = await generateAndStoreKeyPair()
      await api.dm.registerDmKey(pubKey)
      setHasKey(true)
    } catch {
      // ignore
    } finally {
      setRefreshing(false)
    }
  }

  return (
    <div className="flex items-center justify-between p-3 rounded-xl bg-(--color-background-secondary) border border-(--color-border)">
      <div className="flex items-center gap-2.5">
        {hasKey === null ? (
          <Loader2 className="w-4 h-4 animate-spin text-(--color-text-tertiary)" />
        ) : hasKey ? (
          <ShieldCheck className="w-4 h-4 text-green-500" />
        ) : (
          <ShieldOff className="w-4 h-4 text-amber-500" />
        )}
        <div>
          <p className="text-xs font-medium text-(--color-text-primary)">
            {hasKey === null ? 'Kontrol ediliyor...' : hasKey ? 'Şifreleme aktif' : 'Anahtar bulunamadı'}
          </p>
          <p className="text-xs text-(--color-text-tertiary)">
            {hasKey ? 'Bu cihaz E2E şifreleme kullanıyor' : 'DM gönderdiğinde otomatik oluşturulur'}
          </p>
        </div>
      </div>
      {hasKey && (
        <Button variant="ghost" size="sm" onClick={handleRefresh} disabled={refreshing} className="text-xs text-(--color-text-tertiary)">
          {refreshing ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <><RefreshCw className="w-3.5 h-3.5 mr-1" />Yenile</>}
        </Button>
      )}
    </div>
  )
}

// ─── Sessions Tab ─────────────────────────────────────────────────────────────

function SessionsTab() {
  const [sessions, setSessions] = useState<SessionInfo[]>([])
  const [loading, setLoading] = useState(true)
  const [revoking, setRevoking] = useState<string | null>(null)

  const load = useCallback(async () => {
    try {
      const data = await api.account.sessions.list()
      setSessions(data.sessions)
    } catch {
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { void load() }, [load])

  async function revoke(id: string) {
    setRevoking(id)
    try {
      await api.account.sessions.revoke(id)
      setSessions((prev) => prev.filter((s) => s.id !== id))
    } catch {
    } finally {
      setRevoking(null)
    }
  }

  async function revokeAll() {
    setRevoking('all')
    try {
      await api.account.sessions.revokeAll()
      setSessions((prev) => prev.filter((s) => s.current))
    } catch {
    } finally {
      setRevoking(null)
    }
  }

  function parseUA(ua: string | null) {
    if (!ua) return 'Bilinmeyen cihaz'
    if (ua.includes('Mobile')) return 'Mobil tarayıcı'
    if (ua.includes('Chrome')) return 'Chrome'
    if (ua.includes('Firefox')) return 'Firefox'
    if (ua.includes('Safari')) return 'Safari'
    return 'Tarayıcı'
  }

  function formatDate(d: string) {
    return new Date(d).toLocaleDateString('tr-TR', { day: 'numeric', month: 'short', year: 'numeric' })
  }

  if (loading) {
    return <div className="flex items-center justify-center h-24"><Loader2 className="w-5 h-5 animate-spin text-(--color-coral)" /></div>
  }

  const otherSessions = sessions.filter((s) => !s.current)

  return (
    <div className="space-y-4 max-w-md">
      {sessions.length === 0 ? (
        <p className="text-sm text-(--color-text-tertiary)">Aktif oturum bulunamadı.</p>
      ) : (
        <div className="space-y-2">
          {sessions.map((s) => (
            <div
              key={s.id}
              className="flex items-center justify-between p-3 rounded-xl border border-(--color-border) bg-(--color-background-secondary)"
            >
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <p className="text-sm font-medium text-(--color-text-primary)">{parseUA(s.userAgent)}</p>
                  {s.current && (
                    <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-(--color-blush) dark:bg-(--color-coral)/12 text-(--color-coral) font-medium">
                      Bu oturum
                    </span>
                  )}
                </div>
                <p className="text-xs text-(--color-text-tertiary) mt-0.5">
                  {s.ipAddress ?? 'IP bilinmiyor'} · {formatDate(s.createdAt)}
                </p>
              </div>
              {!s.current && (
                <button
                  onClick={() => revoke(s.id)}
                  disabled={revoking === s.id}
                  className="ml-3 flex-shrink-0 text-xs text-red-500 hover:text-red-600 disabled:opacity-50"
                >
                  {revoking === s.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <LogOut className="w-3.5 h-3.5" />}
                </button>
              )}
            </div>
          ))}
        </div>
      )}
      {otherSessions.length > 1 && (
        <Button
          variant="outline"
          size="sm"
          onClick={revokeAll}
          disabled={revoking === 'all'}
          className="text-red-500 border-red-200 hover:bg-red-50"
        >
          {revoking === 'all' && <Loader2 className="w-3.5 h-3.5 animate-spin mr-2" />}
          Diğer tüm oturumları kapat
        </Button>
      )}
    </div>
  )
}

// ─── Freeze Section ───────────────────────────────────────────────────────────

function FreezeSection() {
  const router = useRouter()
  const [confirm, setConfirm] = useState(false)
  const [freezing, setFreezing] = useState(false)

  async function freeze() {
    setFreezing(true)
    try {
      await api.account.freeze()
      router.push('/login')
    } catch {
      setFreezing(false)
    }
  }

  return (
    <div className="border-t border-(--color-border) pt-6 space-y-3">
      <div>
        <h3 className="text-sm font-semibold text-(--color-text-primary) mb-1">Hesabı Geçici Olarak Dondur</h3>
        <p className="text-xs text-(--color-text-tertiary) leading-relaxed">
          Profilin ve gönderilerin gizlenir. İstediğin zaman giriş yaparak hesabını yeniden etkinleştirebilirsin.
        </p>
      </div>
      {!confirm ? (
        <Button
          variant="outline"
          size="sm"
          onClick={() => setConfirm(true)}
          className="gap-2"
        >
          <Snowflake className="w-4 h-4" />
          Hesabımı Dondur
        </Button>
      ) : (
        <div className="rounded-xl border border-(--color-border) bg-(--color-background-secondary) p-4 space-y-3">
          <p className="text-sm font-medium text-(--color-text-primary)">Emin misin?</p>
          <p className="text-xs text-(--color-text-tertiary)">
            Hesabın dondurulacak ve oturum kapatılacak. Giriş yaparak istediğin zaman geri dönebilirsin.
          </p>
          <div className="flex gap-2">
            <Button
              size="sm"
              onClick={() => void freeze()}
              disabled={freezing}
              className="bg-(--color-coral) hover:bg-(--color-coral-hover) text-white gap-2"
            >
              {freezing ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Snowflake className="w-3.5 h-3.5" />}
              Evet, dondur
            </Button>
            <Button size="sm" variant="outline" onClick={() => setConfirm(false)}>
              Vazgeç
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}

// ─── Account Tab ──────────────────────────────────────────────────────────────

const API_BASE = process.env['NEXT_PUBLIC_API_URL'] ?? 'http://localhost:3001'

function AccountTab() {
  const { data: session } = useSession()
  const router = useRouter()

  // Export
  const [exporting, setExporting] = useState(false)

  // Migration OUT (floq → other server)
  const [targetActorUri, setTargetActorUri] = useState('')
  const [migrating, setMigrating] = useState(false)
  const [migrateError, setMigrateError] = useState<string | null>(null)
  const [migrateDone, setMigrateDone] = useState(false)
  const [copied, setCopied] = useState(false)

  // Migration IN (other server → floq)
  const [oldAccountUri, setOldAccountUri] = useState('')
  const [savingAlsoKnownAs, setSavingAlsoKnownAs] = useState(false)
  const [savedAlsoKnownAs, setSavedAlsoKnownAs] = useState(false)
  const [alsoKnownAsError, setAlsoKnownAsError] = useState<string | null>(null)

  // Delete
  const [deleteConfirm, setDeleteConfirm] = useState('')
  const [deleting, setDeleting] = useState(false)

  const handle = (session?.user as { handle?: string } | undefined)?.handle
  const localActorUrl = handle ? `${API_BASE}/users/${handle}` : null

  async function exportData() {
    setExporting(true)
    try {
      const res = await api.account.exportData()
      const blob = await res.blob()
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = res.headers.get('Content-Disposition')?.split('filename=')[1] ?? 'floq-export.json'
      a.click()
      URL.revokeObjectURL(url)
    } catch {
    } finally {
      setExporting(false)
    }
  }

  async function migrate() {
    if (!targetActorUri.trim()) return
    setMigrating(true)
    setMigrateError(null)
    try {
      await api.account.migrate(targetActorUri.trim())
      setMigrateDone(true)
    } catch (err) {
      setMigrateError((err as Error).message ?? 'Taşıma başarısız.')
    } finally {
      setMigrating(false)
    }
  }

  function copyActorUrl() {
    if (!localActorUrl) return
    void navigator.clipboard.writeText(localActorUrl)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  async function saveAlsoKnownAs() {
    const uri = oldAccountUri.trim()
    if (!uri) return
    setSavingAlsoKnownAs(true)
    setAlsoKnownAsError(null)
    try {
      await api.account.setAlsoKnownAs(uri ? [uri] : [])
      setSavedAlsoKnownAs(true)
      setTimeout(() => setSavedAlsoKnownAs(false), 2000)
    } catch (err) {
      setAlsoKnownAsError((err as Error).message ?? 'Kaydedilemedi')
    } finally {
      setSavingAlsoKnownAs(false)
    }
  }

  async function deleteAccount() {
    setDeleting(true)
    try {
      await api.account.delete()
      await authClient.signOut()
      router.replace('/login')
    } catch {
    } finally {
      setDeleting(false)
    }
  }

  return (
    <div className="space-y-8 max-w-md">

      {/* ── Veri dışa aktarma ── */}
      <div>
        <h3 className="text-sm font-semibold text-(--color-text-primary) mb-1">Verilerini İndir</h3>
        <p className="text-xs text-(--color-text-tertiary) mb-3">
          Tüm gönderilerini, takip listeni ve profil bilgilerini JSON olarak indir.
        </p>
        <Button variant="outline" onClick={exportData} disabled={exporting} className="gap-2">
          {exporting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
          Veri İndir
        </Button>
      </div>

      {/* ── Başka Sunucudan Taşın (migrate IN) ── */}
      <div className="border-t border-(--color-border) pt-6 space-y-4">
        <div>
          <h3 className="text-sm font-semibold text-(--color-text-primary) mb-1">Başka Sunucudan Taşın</h3>
          <p className="text-xs text-(--color-text-tertiary) leading-relaxed">
            Mastodon veya başka bir ActivityPub sunucusundan floq'a taşınıyorsan, eski hesabını buraya bağla.
          </p>
        </div>

        <div className="rounded-xl border border-(--color-border) bg-(--color-background-secondary) p-4 space-y-3">
          <div className="flex items-center gap-2">
            <span className="w-5 h-5 rounded-full bg-(--color-coral) text-white text-[10px] font-bold flex items-center justify-center flex-shrink-0">1</span>
            <p className="text-xs font-medium text-(--color-text-primary)">Eski hesabının ActivityPub URI'sini gir</p>
          </div>
          <p className="text-xs text-(--color-text-tertiary)">(örn. <span className="font-mono">https://mastodon.social/users/adın</span>)</p>
          <div className="flex gap-2">
            <Input
              value={oldAccountUri}
              onChange={(e) => setOldAccountUri(e.target.value)}
              placeholder="https://mastodon.social/users/..."
              className="font-mono text-xs"
            />
            <Button
              onClick={() => void saveAlsoKnownAs()}
              disabled={savingAlsoKnownAs || savedAlsoKnownAs}
              variant="outline"
              className="flex-shrink-0"
            >
              {savingAlsoKnownAs ? <Loader2 className="w-4 h-4 animate-spin" /> : savedAlsoKnownAs ? <Check className="w-4 h-4 text-emerald-500" /> : 'Kaydet'}
            </Button>
          </div>
          {alsoKnownAsError && <p className="text-xs text-red-500">{alsoKnownAsError}</p>}
        </div>

        <div className="rounded-xl border border-(--color-border) bg-(--color-background-secondary) p-4 space-y-2">
          <div className="flex items-center gap-2">
            <span className="w-5 h-5 rounded-full bg-(--color-coral) text-white text-[10px] font-bold flex items-center justify-center flex-shrink-0">2</span>
            <p className="text-xs font-medium text-(--color-text-primary)">Eski sunucuda "Taşın" başlat</p>
          </div>
          <p className="text-xs text-(--color-text-tertiary) leading-relaxed">
            Eski hesabının ayarlarında "Hesabı Taşı" veya "Move to" alanına şu adresi gir:
          </p>
          {localActorUrl && (
            <div className="flex items-center gap-2 p-2.5 rounded-lg bg-(--color-background) border border-(--color-border)">
              <code className="text-xs text-(--color-text-primary) flex-1 break-all">{localActorUrl}</code>
              <button
                onClick={copyActorUrl}
                className="flex-shrink-0 p-1.5 rounded-md text-(--color-text-tertiary) hover:text-(--color-coral) transition-colors"
                title="Kopyala"
              >
                {copied ? <Check className="w-3.5 h-3.5 text-green-500" /> : <Copy className="w-3.5 h-3.5" />}
              </button>
            </div>
          )}
          <p className="text-xs text-(--color-text-tertiary)">
            Taşıma tamamlandığında eski sunucundaki takipçilerin otomatik olarak seni floq'ta takip eder.
          </p>
        </div>
      </div>

      {/* ── Hesap Taşıma (migrate OUT) ── */}
      <div className="border-t border-(--color-border) pt-6 space-y-4">
        <div>
          <h3 className="text-sm font-semibold text-(--color-text-primary) mb-1">Hesabı Taşı</h3>
          <p className="text-xs text-(--color-text-tertiary) leading-relaxed">
            Mastodon veya başka bir ActivityPub sunucusuna taşın. Takipçilerin otomatik olarak yeni hesabını takip eder.
          </p>
        </div>

        {migrateDone ? (
          <div className="flex items-start gap-3 p-4 rounded-xl border border-green-200 bg-green-50 dark:border-green-900/50 dark:bg-green-950/20">
            <Check className="w-4 h-4 text-green-600 mt-0.5 flex-shrink-0" />
            <div>
              <p className="text-sm font-medium text-green-700 dark:text-green-400">Taşıma başlatıldı</p>
              <p className="text-xs text-green-600/80 dark:text-green-500/80 mt-0.5">
                Move aktivitesi takipçilerine iletildi. Hesabın kilitlendi.
              </p>
            </div>
          </div>
        ) : (
          <>
            {/* Adım 1 — Hedef sunucuda alsoKnownAs ekle */}
            <div className="rounded-xl border border-(--color-border) bg-(--color-background-secondary) p-4 space-y-3">
              <div className="flex items-center gap-2">
                <span className="w-5 h-5 rounded-full bg-(--color-coral) text-white text-[10px] font-bold flex items-center justify-center flex-shrink-0">1</span>
                <p className="text-xs font-medium text-(--color-text-primary)">
                  Hedef sunucuda <span className="font-mono">alsoKnownAs</span> ekle
                </p>
              </div>
              <p className="text-xs text-(--color-text-tertiary) leading-relaxed">
                Taşınacağın sunucuda (ör. Mastodon) hesap ayarlarına git ve <span className="font-semibold text-(--color-text-secondary)">"taşın / move from"</span> alanına şu adresi gir:
              </p>
              {localActorUrl && (
                <div className="flex items-center gap-2 p-2.5 rounded-lg bg-(--color-background) border border-(--color-border)">
                  <code className="text-xs text-(--color-text-primary) flex-1 break-all">{localActorUrl}</code>
                  <button
                    onClick={copyActorUrl}
                    className="flex-shrink-0 p-1.5 rounded-md text-(--color-text-tertiary) hover:text-(--color-coral) hover:bg-(--color-blush) dark:hover:bg-(--color-coral)/12 transition-colors"
                    title="Kopyala"
                  >
                    {copied ? <Check className="w-3.5 h-3.5 text-green-500" /> : <Copy className="w-3.5 h-3.5" />}
                  </button>
                </div>
              )}
            </div>

            {/* Adım 2 — Hedef URI gir ve başlat */}
            <div className="rounded-xl border border-(--color-border) bg-(--color-background-secondary) p-4 space-y-3">
              <div className="flex items-center gap-2">
                <span className="w-5 h-5 rounded-full bg-(--color-coral) text-white text-[10px] font-bold flex items-center justify-center flex-shrink-0">2</span>
                <p className="text-xs font-medium text-(--color-text-primary)">Yeni hesabının ActivityPub URI'sini gir</p>
              </div>
              <p className="text-xs text-(--color-text-tertiary)">
                Örn: <span className="font-mono">https://mastodon.social/users/kullaniciadi</span>
              </p>
              <Input
                value={targetActorUri}
                onChange={(e) => { setTargetActorUri(e.target.value); setMigrateError(null) }}
                placeholder="https://mastodon.social/users/…"
                className="font-mono text-xs"
              />
              {migrateError && (
                <p className="text-xs text-red-500 flex items-start gap-1.5">
                  <AlertTriangle className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" />
                  <span className="whitespace-pre-line">{migrateError}</span>
                </p>
              )}
              <div className="flex items-start gap-3 p-3 rounded-lg bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-900/50">
                <AlertTriangle className="w-3.5 h-3.5 text-amber-500 flex-shrink-0 mt-0.5" />
                <p className="text-xs text-amber-700 dark:text-amber-400">
                  Bu işlem geri alınamaz. Hesabın kilitlenir ve tüm takipçilerin yeni hesabına yönlendirilir.
                </p>
              </div>
              <Button
                onClick={() => void migrate()}
                disabled={migrating || !targetActorUri.trim()}
                className="bg-(--color-coral) hover:bg-(--color-ember) text-white gap-2"
              >
                {migrating
                  ? <Loader2 className="w-4 h-4 animate-spin" />
                  : <MoveRight className="w-4 h-4" />}
                Hesabı Taşı
              </Button>
            </div>
          </>
        )}
      </div>

      {/* ── Hesabı Dondur ── */}
      <FreezeSection />

      {/* ── Hesap Silme ── */}
      <div className="border-t border-(--color-border) pt-6 space-y-3">
        <div className="flex items-center gap-2 text-red-500">
          <AlertTriangle className="w-4 h-4" />
          <h3 className="text-sm font-semibold">Hesabı Sil</h3>
        </div>
        <p className="text-xs text-(--color-text-tertiary)">
          Bu işlem geri alınamaz. Tüm gönderilerin, takipçilerin ve verilerinin kalıcı olarak silinir.
        </p>
        <p className="text-xs text-(--color-text-secondary)">
          Onaylamak için <span className="font-mono font-semibold">hesabımı sil</span> yaz:
        </p>
        <Input
          value={deleteConfirm}
          onChange={(e) => setDeleteConfirm(e.target.value)}
          placeholder="hesabımı sil"
        />
        <Button
          variant="outline"
          onClick={deleteAccount}
          disabled={deleting || deleteConfirm !== 'hesabımı sil'}
          className="text-red-500 border-red-200 hover:bg-red-50 hover:text-red-600"
        >
          {deleting && <Loader2 className="w-4 h-4 animate-spin mr-2" />}
          Hesabı Kalıcı Olarak Sil
        </Button>
      </div>
    </div>
  )
}

// ─── Feed Tab ─────────────────────────────────────────────────────────────────

const PRESET_DEFS = [
  {
    key: 'chronological' as const,
    name: 'Saf Kronolojik',
    tagline: 'Algoritma sıfır',
    desc: 'Gönderiler yalnızca zaman damgasına göre sıralanır. Hiçbir skor, ağırlık ya da müdahale yok.',
    icon: Clock,
    config: { sort: 'chronological' as const, hideReplies: false },
    badge: 'Özgürlükçü',
    badgeColor: 'text-emerald-600 bg-emerald-50 dark:bg-emerald-900/20',
  },
  {
    key: 'mixed' as const,
    name: 'Dengeli',
    tagline: 'Hafif algoritma',
    desc: 'Yenilik ile etkileşim ağırlığı dengelenir. Popüler içerik biraz öne çıkar.',
    icon: Scale,
    config: { sort: 'mixed' as const, hideReplies: false },
    badge: 'Varsayılan',
    badgeColor: 'text-blue-600 bg-blue-50 dark:bg-blue-900/20',
  },
  {
    key: 'trending' as const,
    name: 'Etkileşim Odaklı',
    tagline: 'Topluluk seçimi',
    desc: 'En çok reaksiyon alan gönderiler öne alınır. Ateşli tartışmalar ve viral içerik.',
    icon: Flame,
    config: { sort: 'engagement' as const, hideReplies: false },
    badge: 'Yoğun',
    badgeColor: 'text-orange-600 bg-orange-50 dark:bg-orange-900/20',
  },
  {
    key: 'originals' as const,
    name: 'Sadece Orijinaller',
    tagline: 'Yanıt zinciri yok',
    desc: 'Yanıt gönderileri gizlenir. Yalnızca ilk gönderiler görünür, akış daha temiz olur.',
    icon: MessageSquare,
    config: { sort: 'chronological' as const, hideReplies: true },
    badge: 'Minimal',
    badgeColor: 'text-violet-600 bg-violet-50 dark:bg-violet-900/20',
  },
] as const

type PresetKey = typeof PRESET_DEFS[number]['key']

// ─── Privacy Tab ─────────────────────────────────────────────────────────────

const PREF_DEFAULTS: ActorPreferences = {
  dmEnabled: true, allowReplyFrom: 'everyone', hideLikesCount: false,
  hideReadReceipts: false, defaultVisibility: 'public', filterBots: false,
  hideBoosts: false, minAccountAgeFilter: 0, nsfwMode: 'blur',
  preferredLanguages: [], hideShortVideos: false, usageTimeLimit: 0,
}

function PrivacyTab() {
  const [prefs, setPrefs] = useState<ActorPreferences>(PREF_DEFAULTS)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState<string | null>(null)

  useEffect(() => {
    api.account.getPreferences()
      .then((p) => setPrefs({ ...PREF_DEFAULTS, ...p }))
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  async function save<K extends keyof ActorPreferences>(key: K, value: ActorPreferences[K]) {
    setPrefs((p) => ({ ...p, [key]: value }))
    setSaving(key)
    try {
      await api.account.updatePreferences({ [key]: value })
    } catch {
      setPrefs((p) => ({ ...p, [key]: prefs[key] }))
    } finally {
      setSaving(null)
    }
  }

  if (loading) return <div className="py-12 flex justify-center"><Loader2 className="w-5 h-5 animate-spin text-(--color-coral)" /></div>

  return (
    <div className="space-y-1">

      {/* ── İletişim ── */}
      <Section title="İletişim">
        <PrivacyRow
          icon={<MessageSquare className="w-4 h-4" />}
          label="Mesajlaşma"
          desc="Kapatırsan kimse sana DM gönderemez."
          saving={saving === 'dmEnabled'}
        >
          <Toggle on={prefs.dmEnabled} onChange={(v) => void save('dmEnabled', v)} />
        </PrivacyRow>

        <PrivacyRow
          icon={<MessageCircle className="w-4 h-4" />}
          label="Okundu bilgisi"
          desc="Kapatırsan karşı taraf mesajını okuduğunu görmez."
          saving={saving === 'hideReadReceipts'}
        >
          <Toggle on={!prefs.hideReadReceipts} onChange={(v) => void save('hideReadReceipts', !v)} />
        </PrivacyRow>
      </Section>

      {/* ── Gönderiler ── */}
      <Section title="Gönderiler">
        <PrivacyRow
          icon={<Globe className="w-4 h-4" />}
          label="Varsayılan görünürlük"
          desc="Yeni gönderiler için başlangıç ayarı."
          saving={saving === 'defaultVisibility'}
        >
          <select
            value={prefs.defaultVisibility}
            onChange={(e) => void save('defaultVisibility', e.target.value as ActorPreferences['defaultVisibility'])}
            className="text-sm border border-(--color-border) rounded-lg px-2.5 py-1.5 bg-(--color-background) text-(--color-text-primary) focus:outline-none focus:border-(--color-coral)"
          >
            <option value="public">Herkese açık</option>
            <option value="unlisted">Listede gizli</option>
            <option value="followers">Sadece takipçiler</option>
          </select>
        </PrivacyRow>

        <PrivacyRow
          icon={<MessageCircle className="w-4 h-4" />}
          label="Yanıt verebilecekler"
          desc="Gönderilerine kim yanıt atabilir?"
          saving={saving === 'allowReplyFrom'}
        >
          <select
            value={prefs.allowReplyFrom}
            onChange={(e) => void save('allowReplyFrom', e.target.value as ActorPreferences['allowReplyFrom'])}
            className="text-sm border border-(--color-border) rounded-lg px-2.5 py-1.5 bg-(--color-background) text-(--color-text-primary) focus:outline-none focus:border-(--color-coral)"
          >
            <option value="everyone">Herkes</option>
            <option value="followers">Takipçilerim</option>
            <option value="nobody">Kimse</option>
          </select>
        </PrivacyRow>

        <PrivacyRow
          icon={<Activity className="w-4 h-4" />}
          label="Beğeni sayısını gizle"
          desc="Gönderilerindeki beğeni sayısını başkaları göremez."
          saving={saving === 'hideLikesCount'}
        >
          <Toggle on={prefs.hideLikesCount} onChange={(v) => void save('hideLikesCount', v)} />
        </PrivacyRow>
      </Section>

      {/* ── Akış & İçerik ── */}
      <Section title="Akış & İçerik">
        <PrivacyRow
          icon={<RefreshCw className="w-4 h-4" />}
          label="Boost'ları gizle"
          desc="Akışında repost edilen gönderiler görünmez."
          saving={saving === 'hideBoosts'}
        >
          <Toggle on={prefs.hideBoosts} onChange={(v) => void save('hideBoosts', v)} />
        </PrivacyRow>

        <PrivacyRow
          icon={<Zap className="w-4 h-4" />}
          label="Moments & kısa video"
          desc="Kapatırsan stories, reels ve dikey videolar akışında çıkmaz."
          saving={saving === 'hideShortVideos'}
        >
          <Toggle on={!prefs.hideShortVideos} onChange={(v) => void save('hideShortVideos', !v)} />
        </PrivacyRow>

        <PrivacyRow
          icon={<ShieldOff className="w-4 h-4" />}
          label="NSFW içerik"
          desc="18+ olarak işaretlenmiş içeriklere ne yapılsın?"
          saving={saving === 'nsfwMode'}
        >
          <select
            value={prefs.nsfwMode}
            onChange={(e) => void save('nsfwMode', e.target.value as ActorPreferences['nsfwMode'])}
            className="text-sm border border-(--color-border) rounded-lg px-2.5 py-1.5 bg-(--color-background) text-(--color-text-primary) focus:outline-none focus:border-(--color-coral)"
          >
            <option value="blur">Bulanıklaştır</option>
            <option value="hide">Gizle</option>
            <option value="show">Göster</option>
          </select>
        </PrivacyRow>

        <PrivacyRow
          icon={<Filter className="w-4 h-4" />}
          label="Bot hesapları filtrele"
          desc="Doğrulanmış bot hesaplarının gönderileri akışında görünmez."
          saving={saving === 'filterBots'}
        >
          <Toggle on={prefs.filterBots} onChange={(v) => void save('filterBots', v)} />
        </PrivacyRow>

        <PrivacyRow
          icon={<Clock className="w-4 h-4" />}
          label="Min. hesap yaşı filtresi"
          desc={prefs.minAccountAgeFilter === 0 ? 'Kapalı — tüm hesaplar görünür.' : `${prefs.minAccountAgeFilter} günden eski hesaplar görünür.`}
          saving={saving === 'minAccountAgeFilter'}
        >
          <select
            value={prefs.minAccountAgeFilter}
            onChange={(e) => void save('minAccountAgeFilter', Number(e.target.value))}
            className="text-sm border border-(--color-border) rounded-lg px-2.5 py-1.5 bg-(--color-background) text-(--color-text-primary) focus:outline-none focus:border-(--color-coral)"
          >
            <option value={0}>Kapalı</option>
            <option value={7}>7 gün</option>
            <option value={30}>30 gün</option>
            <option value={90}>90 gün</option>
            <option value={180}>6 ay</option>
          </select>
        </PrivacyRow>
      </Section>

      {/* ── Dil ── */}
      <Section title="Dil Filtresi" desc="Boş bırakırsan tüm diller gösterilir.">
        <LanguageFilter
          value={prefs.preferredLanguages}
          saving={saving === 'preferredLanguages'}
          onChange={(langs) => void save('preferredLanguages', langs)}
        />
      </Section>

      {/* ── Kullanım Süresi ── */}
      <Section title="Kullanım Süresi">
        <PrivacyRow
          icon={<Clock className="w-4 h-4" />}
          label="Günlük hatırlatıcı"
          desc={prefs.usageTimeLimit === 0 ? 'Kapalı.' : `${prefs.usageTimeLimit} dakika sonra hatırlatıcı çıkar.`}
          saving={saving === 'usageTimeLimit'}
        >
          <select
            value={prefs.usageTimeLimit}
            onChange={(e) => void save('usageTimeLimit', Number(e.target.value))}
            className="text-sm border border-(--color-border) rounded-lg px-2.5 py-1.5 bg-(--color-background) text-(--color-text-primary) focus:outline-none focus:border-(--color-coral)"
          >
            <option value={0}>Kapalı</option>
            <option value={30}>30 dakika</option>
            <option value={60}>1 saat</option>
            <option value={90}>1.5 saat</option>
            <option value={120}>2 saat</option>
          </select>
        </PrivacyRow>
      </Section>
    </div>
  )
}

function PrivacyRow({
  icon, label, desc, children, saving,
}: {
  icon: React.ReactNode
  label: string
  desc: string
  children: React.ReactNode
  saving?: boolean
}) {
  return (
    <div className="flex items-center justify-between gap-4 py-3.5 border-b border-(--color-border-secondary) last:border-0">
      <div className="flex items-start gap-3 min-w-0">
        <div className="mt-0.5 flex-shrink-0 text-(--color-text-tertiary)">{icon}</div>
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <p className="text-sm font-medium text-(--color-text-primary)">{label}</p>
            {saving && <Loader2 className="w-3 h-3 animate-spin text-(--color-text-tertiary)" />}
          </div>
          <p className="text-xs text-(--color-text-tertiary) leading-relaxed mt-0.5">{desc}</p>
        </div>
      </div>
      <div className="flex-shrink-0">{children}</div>
    </div>
  )
}

const LANGUAGE_OPTIONS = [
  { code: 'tr', label: 'Türkçe' },
  { code: 'en', label: 'İngilizce' },
  { code: 'de', label: 'Almanca' },
  { code: 'fr', label: 'Fransızca' },
  { code: 'es', label: 'İspanyolca' },
  { code: 'ja', label: 'Japonca' },
  { code: 'ar', label: 'Arapça' },
  { code: 'pt', label: 'Portekizce' },
  { code: 'ru', label: 'Rusça' },
  { code: 'zh', label: 'Çince' },
]

function LanguageFilter({ value, onChange, saving }: { value: string[]; onChange: (v: string[]) => void; saving?: boolean }) {
  function toggle(code: string) {
    if (value.includes(code)) onChange(value.filter((c) => c !== code))
    else if (value.length < 10) onChange([...value, code])
  }
  return (
    <div className="py-2">
      {saving && <div className="flex items-center gap-1.5 mb-2 text-xs text-(--color-text-tertiary)"><Loader2 className="w-3 h-3 animate-spin" /> Kaydediliyor…</div>}
      <div className="flex flex-wrap gap-2">
        {LANGUAGE_OPTIONS.map((lang) => {
          const active = value.includes(lang.code)
          return (
            <button
              key={lang.code}
              onClick={() => toggle(lang.code)}
              className={cn(
                'px-3 py-1.5 rounded-full text-xs font-medium border transition-colors',
                active
                  ? 'bg-(--color-coral) border-(--color-coral) text-white'
                  : 'border-(--color-border) text-(--color-text-secondary) hover:border-(--color-coral)/40 hover:text-(--color-coral)',
              )}
            >
              {lang.label}
            </button>
          )
        })}
      </div>
      {value.length === 0 && (
        <p className="text-xs text-(--color-text-tertiary) mt-2">Seçim yapılmadı — tüm diller gösterilir.</p>
      )}
    </div>
  )
}

// Mini toggle component
function Toggle({ on, onChange }: { on: boolean; onChange: (v: boolean) => void }) {
  return (
    <button
      role="switch"
      aria-checked={on}
      onClick={() => onChange(!on)}
      className={cn(
        'relative inline-flex h-5 w-9 flex-shrink-0 items-center rounded-full transition-colors',
        on ? 'bg-(--color-coral)' : 'bg-(--color-border)',
      )}
    >
      <span className={cn(
        'inline-block h-3.5 w-3.5 transform rounded-full bg-white shadow-sm transition-transform',
        on ? 'translate-x-4' : 'translate-x-0.5',
      )} />
    </button>
  )
}

function FeedTab() {
  const [rules, setRules]                   = useState<FeedRule[]>([])
  const [userLists, setUserLists]           = useState<ListInfo[]>([])
  const [loading, setLoading]               = useState(true)
  const [applyingPreset, setApplyingPreset] = useState<PresetKey | null>(null)
  const [saving, setSaving]                 = useState(false)
  const [saved, setSaved]                   = useState(false)
  const [activeSection, setActiveSection]   = useState<'presets' | 'custom' | 'profiles'>('presets')
  const [editingRuleId, setEditingRuleId]   = useState<string | null>(null)
  const [newRuleName, setNewRuleName]       = useState('')
  const [showNewRule, setShowNewRule]       = useState(false)
  const [creatingRule, setCreatingRule]     = useState(false)

  const [draft, setDraft] = useState<FeedRulesConfig>({
    sort: 'chronological',
    hideReplies: false,
    sources: { following: true, lists: [] },
  })

  const defaultRule = rules.find((r) => r.isDefault)

  useEffect(() => {
    Promise.all([
      api.feedRules.list(),
      api.lists.list(),
    ]).then(([feedData, listData]) => {
      setRules(feedData.feedRules)
      const def = feedData.feedRules.find((r) => r.isDefault)
      if (def) setDraft(def.rules)
      setUserLists(listData.lists)
    }).catch(() => {}).finally(() => setLoading(false))
  }, [])

  async function applyPreset(key: PresetKey) {
    setApplyingPreset(key)
    try {
      await api.feedRules.applyPreset(key)
      const data = await api.feedRules.list()
      setRules(data.feedRules)
      const def = data.feedRules.find((r) => r.isDefault)
      if (def) setDraft(def.rules)
      flashSaved()
    } catch {} finally {
      setApplyingPreset(null)
    }
  }

  async function saveCustom() {
    setSaving(true)
    try {
      if (defaultRule) {
        await api.feedRules.update(defaultRule.id, { rules: draft })
      } else {
        await api.feedRules.create({ name: 'Özel Feed', rules: draft })
      }
      const data = await api.feedRules.list()
      setRules(data.feedRules)
      flashSaved()
    } catch {} finally {
      setSaving(false)
    }
  }

  async function createRule() {
    if (!newRuleName.trim()) return
    setCreatingRule(true)
    try {
      await api.feedRules.create({ name: newRuleName.trim(), rules: draft })
      const data = await api.feedRules.list()
      setRules(data.feedRules)
      setNewRuleName('')
      setShowNewRule(false)
    } catch {} finally {
      setCreatingRule(false)
    }
  }

  async function setDefault(id: string) {
    try {
      await api.feedRules.setDefault(id)
      const data = await api.feedRules.list()
      setRules(data.feedRules)
      const def = data.feedRules.find((r) => r.isDefault)
      if (def) setDraft(def.rules)
    } catch {}
  }

  async function deleteRule(id: string) {
    try {
      await api.feedRules.delete(id)
      setRules((prev) => prev.filter((r) => r.id !== id))
    } catch {}
  }

  function flashSaved() {
    setSaved(true)
    setTimeout(() => setSaved(false), 2200)
  }

  function toggleListSource(id: string) {
    setDraft((d) => ({
      ...d,
      sources: {
        ...d.sources,
        lists: d.sources.lists.includes(id)
          ? d.sources.lists.filter((l) => l !== id)
          : [...d.sources.lists, id],
      },
    }))
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-32">
        <Loader2 className="w-5 h-5 animate-spin text-(--color-coral)" />
      </div>
    )
  }

  // ── active preset detection ──────────────────────────────────
  const activePreset = PRESET_DEFS.find((p) =>
    p.config.sort === (defaultRule?.rules.sort ?? 'chronological') &&
    p.config.hideReplies === (defaultRule?.rules.hideReplies ?? false),
  )

  // ── algorithm transparency score ────────────────────────────
  const algoScore =
    draft.sort === 'chronological' ? 0
    : draft.sort === 'mixed' ? 1
    : 2

  const algoLabels = ['Algoritmik müdahale yok', 'Hafif sıralama', 'Aktif algoritma']
  const algoColors = ['text-emerald-600', 'text-amber-500', 'text-orange-500']
  const algoBars   = [1, 2, 3]

  return (
    <div className="max-w-lg">

      {/* ── Nav tabs ── */}
      <div className="flex gap-1 mb-5 p-1 rounded-xl bg-(--color-background-secondary) border border-(--color-border)">
        {([
          { id: 'presets',  label: 'Presetler',   icon: <BookMarked className="w-3.5 h-3.5" /> },
          { id: 'custom',   label: 'Özelleştir',  icon: <Sliders className="w-3.5 h-3.5" /> },
          { id: 'profiles', label: 'Profiller',   icon: <Activity className="w-3.5 h-3.5" /> },
        ] as const).map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveSection(tab.id)}
            className={cn(
              'flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg text-xs font-medium transition-all',
              activeSection === tab.id
                ? 'bg-(--color-surface) shadow-sm text-(--color-text-primary)'
                : 'text-(--color-text-tertiary) hover:text-(--color-text-secondary)',
            )}
          >
            {tab.icon}
            {tab.label}
          </button>
        ))}
      </div>

      {/* ── Active preset summary ── */}
      {activePreset && (
        <div className="flex items-center gap-3 px-3 py-2.5 mb-4 rounded-xl bg-(--color-background-secondary) border border-(--color-border)">
          <div className="w-7 h-7 rounded-lg bg-(--color-blush)/60 dark:bg-(--color-coral)/15 flex items-center justify-center flex-shrink-0">
            <activePreset.icon className="w-3.5 h-3.5 text-(--color-coral)" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-xs font-semibold text-(--color-text-primary) truncate">
              Aktif: {defaultRule?.name ?? activePreset.name}
            </p>
            <p className="text-[11px] text-(--color-text-tertiary) truncate">{activePreset.tagline}</p>
          </div>
          <span className={cn('text-[10px] font-semibold px-1.5 py-0.5 rounded-full flex-shrink-0', activePreset.badgeColor)}>
            {activePreset.badge}
          </span>
        </div>
      )}

      {/* ══════════════════════════════════════════════════════
          PRESETS
      ══════════════════════════════════════════════════════ */}
      {activeSection === 'presets' && (
        <div className="space-y-2">
          {PRESET_DEFS.map((p) => {
            const Icon = p.icon
            const isActive = activePreset?.key === p.key
            const isLoading = applyingPreset === p.key
            return (
              <button
                key={p.key}
                onClick={() => void applyPreset(p.key)}
                disabled={applyingPreset !== null}
                className={cn(
                  'w-full text-left p-4 rounded-2xl border transition-all',
                  isActive
                    ? 'border-(--color-coral) bg-(--color-blush)/40 dark:bg-(--color-coral)/12'
                    : 'border-(--color-border) hover:bg-(--color-background-secondary)/70',
                )}
              >
                <div className="flex items-start gap-3">
                  <div className={cn(
                    'w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 mt-0.5',
                    isActive ? 'bg-(--color-coral) text-white' : 'bg-(--color-background-secondary) text-(--color-text-tertiary)',
                  )}>
                    {isLoading
                      ? <Loader2 className="w-4 h-4 animate-spin" />
                      : <Icon className="w-4 h-4" />
                    }
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-0.5">
                      <p className={cn('text-sm font-semibold', isActive ? 'text-(--color-coral)' : 'text-(--color-text-primary)')}>
                        {p.name}
                      </p>
                      <span className={cn('text-[10px] font-semibold px-1.5 py-0.5 rounded-full', p.badgeColor)}>
                        {p.badge}
                      </span>
                      {isActive && <Check className="w-3.5 h-3.5 text-(--color-coral) ml-auto flex-shrink-0" />}
                    </div>
                    <p className="text-[11px] text-(--color-text-tertiary) leading-relaxed">{p.desc}</p>
                  </div>
                </div>
              </button>
            )
          })}
        </div>
      )}

      {/* ══════════════════════════════════════════════════════
          CUSTOM BUILDER
      ══════════════════════════════════════════════════════ */}
      {activeSection === 'custom' && (
        <div className="space-y-4">

          {/* Algorithm transparency meter */}
          <div className="p-4 rounded-2xl border border-(--color-border) bg-(--color-background-secondary)/40">
            <div className="flex items-center justify-between mb-3">
              <p className="text-[10px] font-semibold uppercase tracking-widest text-(--color-text-tertiary)">
                Algoritma Şeffaflığı
              </p>
              <span className={cn('text-xs font-semibold', algoColors[algoScore])}>
                {algoLabels[algoScore]}
              </span>
            </div>
            <div className="flex gap-1.5">
              {algoBars.map((n) => (
                <div
                  key={n}
                  className={cn(
                    'flex-1 h-1.5 rounded-full transition-colors',
                    n <= algoScore + 1
                      ? algoScore === 0 ? 'bg-emerald-400'
                        : algoScore === 1 ? 'bg-amber-400'
                        : 'bg-orange-400'
                      : 'bg-(--color-border)',
                  )}
                />
              ))}
            </div>
            <p className="text-[11px] text-(--color-text-tertiary) mt-2">
              {algoScore === 0
                ? 'Verilerini sen kontrol ediyorsun. Hiçbir şey gizlenmiyor ya da öne çıkarılmıyor.'
                : algoScore === 1
                ? 'Hafif etkileşim ağırlığı uygulanıyor. Popüler gönderiler biraz öne çıkabilir.'
                : 'Etkileşim skoru sıralamayı belirliyor. Viral içerik öne alınıyor.'}
            </p>
          </div>

          {/* Sort */}
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-widest text-(--color-text-tertiary) mb-2">Sıralama</p>
            <div className="grid grid-cols-3 gap-1.5">
              {([
                { value: 'chronological' as const, label: 'Kronolojik', icon: Clock },
                { value: 'mixed'         as const, label: 'Karma',      icon: Scale },
                { value: 'engagement'   as const, label: 'Etkileşim',  icon: Flame },
              ]).map((o) => {
                const Icon = o.icon
                const active = draft.sort === o.value
                return (
                  <button
                    key={o.value}
                    onClick={() => setDraft((d) => ({ ...d, sort: o.value }))}
                    className={cn(
                      'flex flex-col items-center gap-1.5 py-3 rounded-xl border transition-all',
                      active
                        ? 'border-(--color-coral) bg-(--color-blush)/40 dark:bg-(--color-coral)/12'
                        : 'border-(--color-border) hover:bg-(--color-background-secondary)/70',
                    )}
                  >
                    <Icon className={cn('w-4 h-4', active ? 'text-(--color-coral)' : 'text-(--color-text-tertiary)')} />
                    <span className={cn('text-xs font-medium', active ? 'text-(--color-coral)' : 'text-(--color-text-secondary)')}>{o.label}</span>
                  </button>
                )
              })}
            </div>
          </div>

          {/* Content filters */}
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-widest text-(--color-text-tertiary) mb-2">İçerik Filtreleri</p>
            <div className="rounded-2xl border border-(--color-border) divide-y divide-(--color-border) overflow-hidden">
              <div className="flex items-center justify-between px-4 py-3">
                <div>
                  <p className="text-sm font-medium text-(--color-text-primary)">Yanıtları Gizle</p>
                  <p className="text-xs text-(--color-text-tertiary) mt-0.5">Yalnızca ilk gönderileri göster</p>
                </div>
                <Toggle on={draft.hideReplies} onChange={(v) => setDraft((d) => ({ ...d, hideReplies: v }))} />
              </div>
              <div className="flex items-center justify-between px-4 py-3">
                <div>
                  <p className="text-sm font-medium text-(--color-text-primary)">Takip edilenleri dahil et</p>
                  <p className="text-xs text-(--color-text-tertiary) mt-0.5">Her zaman aktif</p>
                </div>
                <Toggle on={true} onChange={() => {}} />
              </div>
            </div>
          </div>

          {/* List sources */}
          {userLists.length > 0 && (
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-widest text-(--color-text-tertiary) mb-2">Liste Kaynakları</p>
              <div className="rounded-2xl border border-(--color-border) divide-y divide-(--color-border) overflow-hidden">
                {userLists.map((l) => {
                  const included = draft.sources.lists.includes(l.id)
                  return (
                    <div key={l.id} className="flex items-center justify-between px-4 py-3">
                      <div className="flex items-center gap-2.5">
                        <List className="w-3.5 h-3.5 text-(--color-text-tertiary) flex-shrink-0" />
                        <p className="text-sm text-(--color-text-primary)">{l.title}</p>
                      </div>
                      <Toggle on={included} onChange={() => toggleListSource(l.id)} />
                    </div>
                  )
                })}
              </div>
            </div>
          )}

          {/* Save */}
          <div className="flex items-center gap-3 pt-1">
            <Button
              onClick={() => void saveCustom()}
              disabled={saving || saved}
              className="bg-(--color-coral) hover:bg-(--color-coral-hover) text-white"
            >
              {saving
                ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Kaydediliyor</>
                : saved
                ? <><Check className="w-4 h-4 mr-2" />Kaydedildi</>
                : 'Kaydet'
              }
            </Button>
            {saved && (
              <p className="text-xs text-(--color-text-tertiary) animate-in fade-in">
                Varsayılan kural güncellendi.
              </p>
            )}
          </div>
        </div>
      )}

      {/* ══════════════════════════════════════════════════════
          RULE PROFILES
      ══════════════════════════════════════════════════════ */}
      {activeSection === 'profiles' && (
        <div className="space-y-3">
          <p className="text-xs text-(--color-text-tertiary) leading-relaxed">
            Farklı durumlar için ayrı feed profilleri oluştur. Ana sayfadan istediğin zaman değiştirebilirsin.
          </p>

          {rules.map((rule) => (
            <div
              key={rule.id}
              className={cn(
                'flex items-center gap-3 p-3.5 rounded-2xl border transition-all',
                rule.isDefault
                  ? 'border-(--color-coral) bg-(--color-blush)/30 dark:bg-(--color-coral)/10'
                  : 'border-(--color-border)',
              )}
            >
              <div className={cn(
                'w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0',
                rule.isDefault ? 'bg-(--color-coral) text-white' : 'bg-(--color-background-secondary) text-(--color-text-tertiary)',
              )}>
                <Activity className="w-3.5 h-3.5" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1.5">
                  <p className={cn('text-sm font-semibold truncate', rule.isDefault ? 'text-(--color-coral)' : 'text-(--color-text-primary)')}>
                    {rule.name}
                  </p>
                  {rule.isDefault && (
                    <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded-full bg-emerald-50 text-emerald-600 dark:bg-emerald-900/20 flex-shrink-0">
                      Aktif
                    </span>
                  )}
                </div>
                <p className="text-[11px] text-(--color-text-tertiary) mt-0.5">
                  {rule.rules.sort === 'chronological' ? 'Kronolojik'
                    : rule.rules.sort === 'engagement' ? 'Etkileşim odaklı'
                    : 'Karma'}
                  {rule.rules.hideReplies ? ' · Yanıtsız' : ''}
                  {rule.rules.sources.lists.length > 0 ? ` · ${rule.rules.sources.lists.length} liste` : ''}
                </p>
              </div>
              <div className="flex items-center gap-1 flex-shrink-0">
                {!rule.isDefault && (
                  <button
                    onClick={() => void setDefault(rule.id)}
                    className="px-2.5 py-1 rounded-lg text-xs font-medium text-(--color-coral) hover:bg-(--color-blush)/50 dark:bg-(--color-coral)/12 transition-colors"
                  >
                    Aktifleştir
                  </button>
                )}
                {rules.length > 1 && !rule.isDefault && (
                  <button
                    onClick={() => void deleteRule(rule.id)}
                    className="p-1.5 rounded-lg text-(--color-text-tertiary) hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
            </div>
          ))}

          {/* New rule */}
          {showNewRule ? (
            <div className="p-4 rounded-2xl border border-(--color-border) space-y-3">
              <p className="text-xs font-semibold text-(--color-text-primary)">Yeni Profil</p>
              <Input
                placeholder="Profil adı (örn: Sabah Akışı)"
                value={newRuleName}
                onChange={(e) => setNewRuleName(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') void createRule() }}
                className="text-sm"
                autoFocus
              />
              <p className="text-[11px] text-(--color-text-tertiary)">
                Mevcut Özelleştir ayarlarıyla oluşturulacak.
              </p>
              <div className="flex gap-2">
                <Button
                  size="sm"
                  onClick={() => void createRule()}
                  disabled={!newRuleName.trim() || creatingRule}
                  className="bg-(--color-coral) hover:bg-(--color-coral-hover) text-white"
                >
                  {creatingRule ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : 'Oluştur'}
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => { setShowNewRule(false); setNewRuleName('') }}
                >
                  İptal
                </Button>
              </div>
            </div>
          ) : (
            <button
              onClick={() => setShowNewRule(true)}
              className="w-full flex items-center justify-center gap-2 py-3 rounded-2xl border border-dashed border-(--color-border) text-sm text-(--color-text-tertiary) hover:text-(--color-text-secondary) hover:border-(--color-text-tertiary)/40 transition-colors"
            >
              <Plus className="w-4 h-4" />
              Yeni profil ekle
            </button>
          )}
        </div>
      )}
    </div>
  )
}

// ─── Help Tab ─────────────────────────────────────────────────────────────────

function HelpTab() {
  const faq = [
    { q: 'Hesabımı nasıl silebilirim?', a: 'Ayarlar → Hesap sekmesinden hesabını kalıcı olarak silebilirsin.' },
    { q: 'İki faktörlü doğrulamayı nasıl etkinleştiririm?', a: 'Ayarlar → Güvenlik sekmesine git ve TOTP kurulumunu başlat.' },
    { q: 'Gönderilerimi nasıl dışa aktarırım?', a: 'Ayarlar → Hesap → "Veri İndir" butonunu kullan. JSON formatında indir.' },
    { q: 'Başka bir sunucuya nasıl taşınırım?', a: 'Ayarlar → Hesap → "Hesabı Taşı" bölümünü kullan. ActivityPub ile uyumlu herhangi bir sunucuya taşınabilirsin.' },
    { q: 'Momentler ne kadar süre görünür?', a: 'Momentler paylaşımdan 24 saat sonra otomatik olarak silinir.' },
    { q: 'Yakın Çevre özelliği ne işe yarar?', a: 'Takip ettiğin birini Yakın Çevre\'ye ekleyebilirsin. Sadece yakın çevrene özel paylaşımlar yapabilirsin.' },
  ]

  return (
    <div className="space-y-6 max-w-lg">
      <div className="grid gap-3">
        <div className="flex items-center gap-3 p-4 rounded-xl border border-(--color-border) bg-(--color-background-secondary) hover:bg-(--color-background) transition-colors">
          <div className="w-9 h-9 rounded-xl bg-(--color-blush) dark:bg-(--color-coral)/12 flex items-center justify-center flex-shrink-0">
            <GitBranch className="w-4 h-4 text-(--color-coral)" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-(--color-text-primary)">Hata Bildir / Öneri</p>
            <p className="text-xs text-(--color-text-tertiary) mt-0.5">GitHub Issues üzerinden geri bildirim gönder</p>
          </div>
          <a
            href="https://github.com/anthropics/claude-code/issues"
            target="_blank"
            rel="noopener noreferrer"
            className="text-xs text-(--color-coral) hover:underline flex-shrink-0"
          >
            Aç
          </a>
        </div>

        <div className="flex items-center gap-3 p-4 rounded-xl border border-(--color-border) bg-(--color-background-secondary)">
          <div className="w-9 h-9 rounded-xl bg-(--color-blush) dark:bg-(--color-coral)/12 flex items-center justify-center flex-shrink-0">
            <BookOpen className="w-4 h-4 text-(--color-coral)" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-(--color-text-primary)">AT Protocol Nedir?</p>
            <p className="text-xs text-(--color-text-tertiary) mt-0.5">floq, açık bir federasyon protokolü kullanır</p>
          </div>
          <a
            href="https://atproto.com"
            target="_blank"
            rel="noopener noreferrer"
            className="text-xs text-(--color-coral) hover:underline flex-shrink-0"
          >
            Aç
          </a>
        </div>

        <div className="flex items-center gap-3 p-4 rounded-xl border border-(--color-border) bg-(--color-background-secondary)">
          <div className="w-9 h-9 rounded-xl bg-(--color-blush) dark:bg-(--color-coral)/12 flex items-center justify-center flex-shrink-0">
            <MessageCircle className="w-4 h-4 text-(--color-coral)" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-(--color-text-primary)">Topluluk</p>
            <p className="text-xs text-(--color-text-tertiary) mt-0.5">Diğer floq kullanıcılarıyla bağlan</p>
          </div>
        </div>

        <a
          href="/terms"
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-3 p-4 rounded-xl border border-(--color-border) bg-(--color-background-secondary) hover:bg-(--color-background) transition-colors"
        >
          <div className="w-9 h-9 rounded-xl bg-(--color-blush) dark:bg-(--color-coral)/12 flex items-center justify-center flex-shrink-0">
            <FileText className="w-4 h-4 text-(--color-coral)" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-(--color-text-primary)">Hizmet Koşulları</p>
            <p className="text-xs text-(--color-text-tertiary) mt-0.5">floq kullanım şartları</p>
          </div>
          <span className="text-xs text-(--color-coral) hover:underline flex-shrink-0">Aç</span>
        </a>

        <a
          href="/privacy"
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-3 p-4 rounded-xl border border-(--color-border) bg-(--color-background-secondary) hover:bg-(--color-background) transition-colors"
        >
          <div className="w-9 h-9 rounded-xl bg-(--color-blush) dark:bg-(--color-coral)/12 flex items-center justify-center flex-shrink-0">
            <Lock className="w-4 h-4 text-(--color-coral)" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-(--color-text-primary)">Gizlilik Politikası</p>
            <p className="text-xs text-(--color-text-tertiary) mt-0.5">Verilerinin nasıl korunduğunu öğren</p>
          </div>
          <span className="text-xs text-(--color-coral) hover:underline flex-shrink-0">Aç</span>
        </a>
      </div>

      <div className="border-t border-(--color-border) pt-5">
        <p className="text-sm font-semibold text-(--color-text-primary) mb-3">Sık Sorulan Sorular</p>
        <div className="space-y-2">
          {faq.map(({ q, a }) => (
            <details key={q} className="group rounded-xl border border-(--color-border) bg-(--color-background-secondary) overflow-hidden">
              <summary className="flex items-center justify-between px-4 py-3 cursor-pointer text-sm font-medium text-(--color-text-primary) list-none select-none hover:bg-(--color-background) transition-colors">
                {q}
                <span className="text-(--color-text-tertiary) group-open:rotate-180 transition-transform duration-200 text-xs ml-2 flex-shrink-0">▼</span>
              </summary>
              <div className="px-4 pb-3 pt-1 text-sm text-(--color-text-secondary) leading-relaxed border-t border-(--color-border-secondary)">
                {a}
              </div>
            </details>
          ))}
        </div>
      </div>

      <div className="text-center pt-2">
        <p className="text-xs text-(--color-text-tertiary)">
          floq v0.1 · Mezuniyet projesi
        </p>
      </div>
    </div>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────

const DEFAULT_NOTIF_PREFS: NotificationPrefs = {
  notifyLike: true, notifyBoost: true, notifyReply: true,
  notifyMention: true, notifyFollow: true, notifyFollowRequest: true, notifyPollEnded: true,
}

const NOTIF_TYPES: { key: keyof NotificationPrefs; label: string; desc: string; icon: React.ReactNode }[] = [
  { key: 'notifyReply',         label: 'Yanıtlar',        desc: 'Birisi gönderini yanıtladığında',         icon: <MessageCircle className="w-4 h-4" /> },
  { key: 'notifyMention',       label: 'Bahsetmeler',     desc: 'Birisi senden @bahsettiğinde',             icon: <AtSign className="w-4 h-4" /> },
  { key: 'notifyLike',          label: 'Beğeniler',       desc: 'Birisi gönderini beğendiğinde',            icon: <Bell className="w-4 h-4" /> },
  { key: 'notifyBoost',         label: 'Boostlar',        desc: 'Birisi gönderini boostladığında',          icon: <Zap className="w-4 h-4" /> },
  { key: 'notifyFollow',        label: 'Takip',           desc: 'Birisi seni takip ettiğinde',              icon: <Bell className="w-4 h-4" /> },
  { key: 'notifyFollowRequest', label: 'Takip isteği',    desc: 'Hesabın kilitliyken takip isteği geldiğinde', icon: <Bell className="w-4 h-4" /> },
  { key: 'notifyPollEnded',     label: 'Anket sonuçları', desc: 'Oy verdiğin anket sona erdiğinde',         icon: <Activity className="w-4 h-4" /> },
]

function ToggleSwitch({ checked, onChange, disabled }: { checked: boolean; onChange: (v: boolean) => void; disabled?: boolean }) {
  return (
    <button
      role="switch"
      aria-checked={checked}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={cn(
        'relative inline-flex h-5 w-9 flex-shrink-0 rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none disabled:opacity-50',
        checked ? 'bg-(--color-coral)' : 'bg-(--color-border)',
      )}
    >
      <span
        className={cn(
          'pointer-events-none inline-block h-4 w-4 rounded-full bg-white shadow transform transition-transform duration-200 ease-in-out',
          checked ? 'translate-x-4' : 'translate-x-0',
        )}
      />
    </button>
  )
}

function NotificationsTab() {
  const { state, subscribe, unsubscribe } = usePushNotifications()
  const [prefs, setPrefs] = useState<NotificationPrefs>(DEFAULT_NOTIF_PREFS)
  const [prefsLoading, setPrefsLoading] = useState(true)
  const [saving, setSaving] = useState<keyof NotificationPrefs | null>(null)
  const [hapticsOn, setHapticsOn] = useState(true)

  useEffect(() => {
    setHapticsOn(localStorage.getItem('floq-haptics') !== 'false')
  }, [])

  useEffect(() => {
    api.account.getNotificationPrefs()
      .then(setPrefs)
      .catch(() => {})
      .finally(() => setPrefsLoading(false))
  }, [])

  async function toggle(key: keyof NotificationPrefs, value: boolean) {
    setSaving(key)
    const prev = prefs[key]
    setPrefs((p) => ({ ...p, [key]: value }))
    try {
      await api.account.updateNotificationPrefs({ [key]: value })
    } catch {
      setPrefs((p) => ({ ...p, [key]: prev }))
    } finally {
      setSaving(null)
    }
  }

  const statusMap: Record<typeof state, { label: string; desc: string; color: string }> = {
    unsupported: { label: 'Desteklenmiyor', desc: 'Tarayıcın veya cihazın push bildirimlerini desteklemiyor.', color: 'text-(--color-text-tertiary)' },
    loading:     { label: 'Yükleniyor…',   desc: '',                                                           color: 'text-(--color-text-tertiary)' },
    disabled:    { label: 'Kapalı',         desc: 'Bildirimler şu an kapalı.',                                  color: 'text-amber-500' },
    subscribed:  { label: 'Açık',           desc: 'Push bildirimleri aktif. Yeni etkileşimlerde anında haberdar olursun.', color: 'text-green-500' },
    error:       { label: 'Hata',           desc: 'Bir sorun oluştu. Tekrar dene.',                             color: 'text-red-500' },
  }
  const s = statusMap[state]

  return (
    <div className="space-y-6">
      {/* In-app notification types */}
      <div>
        <h2 className="text-base font-semibold text-(--color-text-primary) mb-1" style={{ fontFamily: 'var(--font-outfit)' }}>
          Bildirim Tercihleri
        </h2>
        <p className="text-sm text-(--color-text-tertiary)">
          Hangi durumlarda bildirim almak istediğini seç. Bu ayarlar hem uygulama içi hem de push bildirimleri için geçerlidir.
        </p>
      </div>

      <div className="rounded-2xl border border-(--color-border) bg-(--color-background) overflow-hidden">
        {prefsLoading ? (
          <div className="p-5 flex items-center justify-center">
            <Loader2 className="w-4 h-4 animate-spin text-(--color-text-tertiary)" />
          </div>
        ) : (
          NOTIF_TYPES.map((item, i) => (
            <div
              key={item.key}
              className={cn(
                'flex items-center justify-between gap-4 px-5 py-3.5',
                i < NOTIF_TYPES.length - 1 && 'border-b border-(--color-border-secondary)',
              )}
            >
              <div className="flex items-center gap-3 min-w-0">
                <div className={cn(
                  'w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0',
                  prefs[item.key] ? 'bg-(--color-coral)/10 text-(--color-coral)' : 'bg-(--color-background-secondary) text-(--color-text-tertiary)',
                )}>
                  {item.icon}
                </div>
                <div className="min-w-0">
                  <p className="text-sm font-medium text-(--color-text-primary)">{item.label}</p>
                  <p className="text-xs text-(--color-text-tertiary) truncate">{item.desc}</p>
                </div>
              </div>
              <ToggleSwitch
                checked={prefs[item.key]}
                onChange={(v) => void toggle(item.key, v)}
                disabled={saving === item.key}
              />
            </div>
          ))
        )}
      </div>

      {/* Push notification toggle */}
      <div>
        <h2 className="text-base font-semibold text-(--color-text-primary) mb-1" style={{ fontFamily: 'var(--font-outfit)' }}>
          Push Bildirimleri
        </h2>
        <p className="text-sm text-(--color-text-tertiary)">
          Tarayıcı push bildirimleri sayesinde uygulamayı açmadan anlık bildirim alabilirsin.
        </p>
      </div>

      <div className="rounded-2xl border border-(--color-border) bg-(--color-background) p-5">
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-start gap-3">
            <div className={cn(
              'w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0',
              state === 'subscribed' ? 'bg-green-500/10' : 'bg-(--color-background-secondary)',
            )}>
              {state === 'loading'
                ? <Loader2 className="w-4 h-4 animate-spin text-(--color-text-tertiary)" />
                : state === 'subscribed'
                  ? <Bell className="w-4 h-4 text-green-500" />
                  : <BellOff className="w-4 h-4 text-(--color-text-tertiary)" />}
            </div>
            <div>
              <p className="text-sm font-medium text-(--color-text-primary)">Tarayıcı Bildirimleri</p>
              <p className={cn('text-xs mt-0.5', s.color)}>{s.label}</p>
              {s.desc && <p className="text-xs text-(--color-text-tertiary) mt-0.5 max-w-xs">{s.desc}</p>}
            </div>
          </div>
          {state !== 'unsupported' && state !== 'loading' && (
            <Button
              size="sm"
              variant={state === 'subscribed' ? 'outline' : 'default'}
              onClick={state === 'subscribed' ? unsubscribe : subscribe}
              className={cn(
                'flex-shrink-0 text-xs',
                state !== 'subscribed' && 'bg-(--color-coral) hover:bg-(--color-coral-hover) text-white border-0',
              )}
            >
              {state === 'subscribed' ? 'Kapat' : 'Aç'}
            </Button>
          )}
        </div>
      </div>

      {state === 'disabled' && Notification.permission === 'denied' && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 dark:bg-amber-500/10 dark:border-amber-500/30 p-4">
          <p className="text-xs text-amber-700 dark:text-amber-400">
            Tarayıcın bildirimleri engelledi. Tarayıcı ayarlarından floq için bildirimlere izin ver, sonra tekrar dene.
          </p>
        </div>
      )}

      {/* ── Titreşim ── */}
      <Section title="Titreşim">
        <button
          role="switch"
          aria-checked={hapticsOn}
          onClick={() => {
            const next = !hapticsOn
            setHapticsOn(next)
            localStorage.setItem('floq-haptics', String(next))
          }}
          className={cn(
            'flex items-center justify-between w-full px-4 py-3.5 rounded-2xl border transition-all',
            hapticsOn
              ? 'border-(--color-coral) bg-(--color-blush)/50 dark:bg-(--color-coral)/12'
              : 'border-(--color-border) hover:bg-(--color-background-secondary)/70',
          )}
        >
          <div className="text-left">
            <p className={cn('text-sm font-semibold', hapticsOn ? 'text-(--color-coral)' : 'text-(--color-text-primary)')}>
              Dokunsal Geri Bildirim
            </p>
            <p className="text-xs text-(--color-text-tertiary) mt-0.5">Beğeni, gönderi, hata gibi etkileşimlerde titreşim</p>
          </div>
          <div className={cn('w-11 h-6 rounded-full transition-colors flex items-center px-0.5 flex-shrink-0', hapticsOn ? 'bg-(--color-coral)' : 'bg-(--color-border)')}>
            <div className={cn('w-5 h-5 rounded-full bg-white shadow-sm transition-transform duration-200', hapticsOn ? 'translate-x-5' : 'translate-x-0')} />
          </div>
        </button>
        <button
          onClick={() => {
            const label = document.querySelector<HTMLElement>('label[for^="web-haptics-"]')
            label?.click()
          }}
          className="mt-2 w-full py-2 rounded-xl border border-dashed border-(--color-border) text-xs text-(--color-text-tertiary) hover:text-(--color-text-primary) hover:border-(--color-border-hover) transition-colors"
        >
          Test titreşim
        </button>
        <p className="text-xs text-(--color-text-tertiary) mt-2 px-1">
          Android Chrome ve destekleyen tarayıcılarda çalışır. iOS için alternatif yöntem kullanılır.
        </p>
      </Section>
    </div>
  )
}

function SettingsPageContent() {
  const { data: session, isPending } = useSession()
  const router = useRouter()
  const searchParams = useSearchParams()
  const [activeTab, setActiveTab] = useState<Tab>(() => {
    const t = searchParams.get('tab')
    return (t && ['profile','privacy','moderation','filters','feed','notifications','security','sessions','appearance','account','help'].includes(t) ? t : 'profile') as Tab
  })

  // Avoid hydration mismatch: useSession resolves synchronously on the client
  // (cached session) but is pending during SSR, so gate tab content on mount.
  const [mounted, setMounted] = useState(false)
  useEffect(() => { setMounted(true) }, [])

  useEffect(() => {
    if (!isPending && !session) router.push('/login')
  }, [isPending, session, router])

  return (
    <div className="max-w-2xl mx-auto">
      <header className="sticky top-0 z-10 bg-(--color-background)/90 backdrop-blur-md border-b border-(--color-border) px-4 py-3.5">
        <div className="flex items-center gap-2">
          <Settings className="w-5 h-5 text-(--color-coral)" />
          <h1 className="text-base font-bold text-(--color-text-primary)" style={{ fontFamily: 'var(--font-outfit)' }}>
            Ayarlar
          </h1>
        </div>
      </header>

      <div className="flex flex-col sm:flex-row">
        <nav className="sm:w-44 sm:min-h-[calc(100vh-57px)] border-b sm:border-b-0 sm:border-r border-(--color-border) flex sm:flex-col overflow-x-auto sm:overflow-visible p-2 sm:p-3 gap-0.5 flex-shrink-0">
          {tabs.map((t) => (
            <button
              key={t.id}
              onClick={() => setActiveTab(t.id)}
              className={cn(
                'flex items-center gap-2 px-3 py-2 rounded-xl text-sm font-medium whitespace-nowrap transition-colors',
                activeTab === t.id
                  ? 'bg-(--color-blush) text-(--color-coral) dark:bg-(--color-coral)/10'
                  : 'text-(--color-text-secondary) hover:bg-(--color-background-secondary) hover:text-(--color-text-primary)',
              )}
            >
              {t.icon}
              <span>{t.label}</span>
            </button>
          ))}
        </nav>

        <main className="flex-1 p-4 sm:p-6">
          {!mounted || isPending ? (
            <div className="flex items-center justify-center h-48">
              <Loader2 className="w-5 h-5 animate-spin text-(--color-coral)" />
            </div>
          ) : (
            <>
              {activeTab === 'profile' && <ProfileTab session={session} />}
              {activeTab === 'privacy' && <PrivacyTab />}
              {activeTab === 'moderation' && <ModerationTab />}
              {activeTab === 'filters' && <FiltersTab />}
              {activeTab === 'feed' && <FeedTab />}
              {activeTab === 'notifications' && <NotificationsTab />}
              {activeTab === 'security' && <SecurityTab session={session} />}
              {activeTab === 'sessions' && <SessionsTab />}
              {activeTab === 'appearance' && <ThemeTab />}
              {activeTab === 'account' && <AccountTab />}
              {activeTab === 'help' && <HelpTab />}
            </>
          )}
        </main>
      </div>
    </div>
  )
}

export default function SettingsPage() {
  return (
    <Suspense>
      <SettingsPageContent />
    </Suspense>
  )
}
