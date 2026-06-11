'use client'

import { useState, type CSSProperties } from 'react'
import { Heart, MessageCircle, Repeat2, Hash, Globe, Sun, Moon } from 'lucide-react'

/* ───────────────────────────────────────────────────────────
   /tema — REBRAND ÖNİZLEME (izole, canlı uygulamaya dokunmaz)
   3 yön × {açık, koyu} — "Sıcak editoryal sükûnet"
   Beğenileni globals.css token'larına yazıp tüm uygulamaya yayarız.
   ─────────────────────────────────────────────────────────── */

type Mode = 'light' | 'dark'
type Theme = {
  id: string
  name: string
  blurb: string
  display: string
  body: string
  light: Record<string, string>
  dark: Record<string, string>
}

const THEMES: Theme[] = [
  {
    id: 'kagit',
    name: 'Kâğıt',
    blurb: 'Karakterli serif başlık (Fraunces) + sıcak humanist sans. Editoryal, defter hissi.',
    display: "'Fraunces', serif",
    body: "'Hanken Grotesk', sans-serif",
    light: {
      '--color-background': '#F7F3EC', '--color-background-secondary': '#FBF8F2', '--color-border': '#E6DDCE',
      '--color-text-primary': '#2B2622', '--color-text-secondary': '#5C544A', '--color-text-tertiary': '#9A9080',
      '--color-coral': '#C2603F', '--color-coral-hover': '#AC5234', '--color-teal': '#7C8A6B',
      '--gradient-avatar': 'linear-gradient(135deg,#C2603F,#D98E5A)',
    },
    dark: {
      '--color-background': '#221E1A', '--color-background-secondary': '#2B2620', '--color-border': '#3B332A',
      '--color-text-primary': '#EDE6D9', '--color-text-secondary': '#B8AE9D', '--color-text-tertiary': '#807766',
      '--color-coral': '#D8784F', '--color-coral-hover': '#C26640', '--color-teal': '#9AA886',
      '--gradient-avatar': 'linear-gradient(135deg,#D8784F,#E09A68)',
    },
  },
  {
    id: 'kil',
    name: 'Kil',
    blurb: 'Yumuşak serif (Newsreader) + Figtree. Topraksı, olgun, sakin paslı accent.',
    display: "'Newsreader', serif",
    body: "'Figtree', sans-serif",
    light: {
      '--color-background': '#FAF6F1', '--color-background-secondary': '#FFFDFA', '--color-border': '#ECE2D6',
      '--color-text-primary': '#33291F', '--color-text-secondary': '#6B5E4F', '--color-text-tertiary': '#A99C8A',
      '--color-coral': '#B25539', '--color-coral-hover': '#9E4A30', '--color-teal': '#8A8253',
      '--gradient-avatar': 'linear-gradient(135deg,#B25539,#C9805A)',
    },
    dark: {
      '--color-background': '#1F1A14', '--color-background-secondary': '#29221A', '--color-border': '#3A3026',
      '--color-text-primary': '#EDE3D5', '--color-text-secondary': '#B5A892', '--color-text-tertiary': '#7C715E',
      '--color-coral': '#C96B4A', '--color-coral-hover': '#B45A3B', '--color-teal': '#A39A6A',
      '--gradient-avatar': 'linear-gradient(135deg,#C96B4A,#DA906A)',
    },
  },
  {
    id: 'sade',
    name: 'Sade',
    blurb: 'Serifsiz, tek humanist sans (Hanken Grotesk). En minimal, en huzurlu, sıcak nötr.',
    display: "'Hanken Grotesk', sans-serif",
    body: "'Hanken Grotesk', sans-serif",
    light: {
      '--color-background': '#F5F2EE', '--color-background-secondary': '#FCFAF7', '--color-border': '#E8E2D9',
      '--color-text-primary': '#26211C', '--color-text-secondary': '#5A534A', '--color-text-tertiary': '#9A9183',
      '--color-coral': '#BC6A4A', '--color-coral-hover': '#A85838', '--color-teal': '#8B9384',
      '--gradient-avatar': 'linear-gradient(135deg,#BC6A4A,#D29372)',
    },
    dark: {
      '--color-background': '#1E1A16', '--color-background-secondary': '#27221D', '--color-border': '#372F28',
      '--color-text-primary': '#EBE5DC', '--color-text-secondary': '#B2A99C', '--color-text-tertiary': '#7E7568',
      '--color-coral': '#CE7B5A', '--color-coral-hover': '#BA6A48', '--color-teal': '#9BA391',
      '--gradient-avatar': 'linear-gradient(135deg,#CE7B5A,#DE9B79)',
    },
  },
]

function FloqIcon({ size = 28, color = '#C2603F' }: { size?: number; color?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 44 44" fill="none" aria-hidden>
      <rect x="1" y="1" width="42" height="42" rx="13" fill={color} />
      <circle cx="17" cy="19" r="7" fill="white" />
      <circle cx="27" cy="19" r="7" fill="white" opacity="0.65" />
      <circle cx="22" cy="29" r="7" fill="white" opacity="0.4" />
    </svg>
  )
}

function ThemePreview({ theme, mode }: { theme: Theme; mode: Mode }) {
  const tokens = theme[mode]
  const style = { ...tokens, fontFamily: theme.body, backgroundColor: 'var(--color-background)', borderColor: 'var(--color-border)' } as CSSProperties
  const display = { fontFamily: theme.display } as CSSProperties

  return (
    <div className="rounded-3xl border p-6 flex flex-col gap-6" style={style}>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <FloqIcon color={tokens['--color-coral']} />
          <span className="text-2xl font-semibold tracking-tight" style={{ ...display, color: 'var(--color-text-primary)' }}>floq</span>
          <span className="self-start px-1.5 py-0.5 rounded-full text-[9px] font-bold uppercase tracking-wide"
            style={{ background: tokens['--color-coral'] + '22', color: 'var(--color-coral)' }}>beta</span>
        </div>
        <span className="text-[11px] font-medium px-2 py-1 rounded-full" style={{ background: 'var(--color-background-secondary)', color: 'var(--color-text-tertiary)' }}>
          {theme.name} · {mode === 'light' ? 'açık' : 'koyu'}
        </span>
      </div>

      <p className="text-sm leading-relaxed" style={{ color: 'var(--color-text-secondary)' }}>{theme.blurb}</p>

      <div>
        <h3 className="text-2xl leading-tight mb-1.5" style={{ ...display, color: 'var(--color-text-primary)', fontWeight: 600 }}>
          Ağın senin, kuralların senin.
        </h3>
        <p className="text-sm leading-relaxed" style={{ color: 'var(--color-text-secondary)' }}>
          Algoritma yok, reklam yok. Verilerin sana ait; istediğin an taşı, dilediğin sunucuya bağlan.
        </p>
      </div>

      <div className="flex gap-3">
        <button className="h-10 px-5 rounded-xl text-sm font-semibold text-white" style={{ background: 'var(--color-coral)' }}>Hesap oluştur</button>
        <button className="h-10 px-5 rounded-xl text-sm font-semibold border" style={{ borderColor: 'var(--color-border)', color: 'var(--color-text-secondary)' }}>Giriş yap</button>
      </div>

      <div className="rounded-2xl border p-4" style={{ borderColor: 'var(--color-border)', background: 'var(--color-background-secondary)' }}>
        <div className="flex items-center gap-3 mb-2.5">
          <div className="w-10 h-10 rounded-full flex items-center justify-center text-white text-sm font-bold relative" style={{ background: 'var(--gradient-avatar)' }}>
            EÖ
            <span className="absolute -bottom-0.5 -right-0.5 w-4 h-4 rounded-full flex items-center justify-center" style={{ background: 'var(--color-background-secondary)' }}>
              <Globe className="w-2.5 h-2.5" style={{ color: 'var(--color-teal)' }} />
            </span>
          </div>
          <div>
            <p className="text-sm font-semibold leading-tight" style={{ ...display, color: 'var(--color-text-primary)' }}>Elif Öztürk</p>
            <p className="text-xs" style={{ color: 'var(--color-text-tertiary)' }}>@elif@flq.social · 2s</p>
          </div>
        </div>
        <p className="text-sm leading-relaxed mb-3" style={{ color: 'var(--color-text-primary)' }}>
          Bugün ilk kez bir Mastodon kullanıcısını floq'tan takip ettim ve sohbet ettik. Federe ağ gerçekten çalışıyor — kapalı adalar dönemi bitiyor. 🌍
        </p>
        <div className="flex items-center gap-6" style={{ color: 'var(--color-text-tertiary)' }}>
          <span className="flex items-center gap-1.5 text-xs"><MessageCircle className="w-4 h-4" /> 12</span>
          <span className="flex items-center gap-1.5 text-xs"><Repeat2 className="w-4 h-4" /> 8</span>
          <span className="flex items-center gap-1.5 text-xs"><Heart className="w-4 h-4" /> 47</span>
        </div>
      </div>

      <div className="flex flex-col gap-5">
        <div>
          <div className="flex items-center justify-between mb-2.5">
            <span className="text-[11px] font-semibold uppercase tracking-wider" style={{ color: 'var(--color-text-tertiary)' }}>Federe Ağ</span>
            <span className="flex items-center gap-1.5 text-[10px] font-semibold" style={{ color: 'var(--color-teal)' }}>
              <span className="w-1.5 h-1.5 rounded-full" style={{ background: 'var(--color-teal)' }} />Canlı
            </span>
          </div>
          <div className="flex justify-between">
            {[['311', 'sunucu'], ['2.5K', 'kullanıcı'], ['27.4K', 'mesaj/gün']].map(([v, l]) => (
              <div key={l} className="flex flex-col items-center gap-0.5 flex-1">
                <span className="text-xl font-bold tabular-nums" style={{ ...display, color: 'var(--color-text-primary)' }}>{v}</span>
                <span className="text-[10px]" style={{ color: 'var(--color-text-tertiary)' }}>{l}</span>
              </div>
            ))}
          </div>
        </div>
        <div className="h-px" style={{ background: 'var(--color-border)' }} />
        <div>
          <span className="text-[11px] font-semibold uppercase tracking-wider" style={{ color: 'var(--color-text-tertiary)' }}>Gündem</span>
          <div className="flex flex-col mt-2.5">
            {[['catsofmastodon', '21'], ['fediverse', '14'], ['acikkaynak', '9']].map(([t, c], i) => (
              <div key={t} className="flex items-center gap-2.5 py-1.5">
                <span className="w-4 text-[11px] font-semibold tabular-nums text-right" style={{ color: 'var(--color-text-tertiary)' }}>{i + 1}</span>
                <Hash className="w-3 h-3" style={{ color: 'var(--color-text-tertiary)' }} />
                <span className="flex-1 text-sm font-medium" style={{ color: 'var(--color-text-primary)' }}>{t}</span>
                <span className="text-[11px] tabular-nums" style={{ color: 'var(--color-text-tertiary)' }}>{c}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}

export default function TemaPage() {
  const [mode, setMode] = useState<Mode>('light')
  return (
    <>
      <style
        dangerouslySetInnerHTML={{
          __html: `@import url('https://fonts.googleapis.com/css2?family=Figtree:wght@400;500;600;700&family=Fraunces:opsz,wght@9..144,400;9..144,500;9..144,600&family=Hanken+Grotesk:wght@400;500;600;700&family=Newsreader:opsz,wght@6..72,400;6..72,500;6..72,600&display=swap');`,
        }}
      />
      <main className={mode === 'dark' ? 'min-h-screen bg-neutral-950 px-6 py-12' : 'min-h-screen bg-neutral-100 px-6 py-12'}>
        <div className="max-w-[1400px] mx-auto">
          <header className="mb-8 text-center">
            <h1 className={mode === 'dark' ? 'text-3xl font-bold text-neutral-100' : 'text-3xl font-bold text-neutral-900'}>floq — Rebrand Önizleme</h1>
            <p className={mode === 'dark' ? 'mt-2 text-sm text-neutral-400 max-w-2xl mx-auto' : 'mt-2 text-sm text-neutral-500 max-w-2xl mx-auto'}>
              "Sıcak editoryal sükûnet" yönü — fediverse'ten ayrışan, sıcak/insancıl ve sakin.
              Üç palet+tipografi denemesi aynı bileşenler üzerinde. Bu sayfa izoledir; canlı uygulamayı etkilemez.
            </p>
            <div className="mt-5 inline-flex items-center gap-1 rounded-full border p-1"
              style={{ borderColor: mode === 'dark' ? '#333' : '#ddd', background: mode === 'dark' ? '#171717' : '#fff' }}>
              {(['light', 'dark'] as Mode[]).map((m) => (
                <button key={m} onClick={() => setMode(m)}
                  className="flex items-center gap-1.5 px-3.5 h-8 rounded-full text-xs font-semibold transition-colors"
                  style={m === mode
                    ? { background: '#C2603F', color: '#fff' }
                    : { color: mode === 'dark' ? '#aaa' : '#666' }}>
                  {m === 'light' ? <Sun className="w-3.5 h-3.5" /> : <Moon className="w-3.5 h-3.5" />}
                  {m === 'light' ? 'Açık' : 'Koyu'}
                </button>
              ))}
            </div>
          </header>
          <div className="grid gap-6 lg:grid-cols-3 items-start">
            {THEMES.map((t) => <ThemePreview key={t.id} theme={t} mode={mode} />)}
          </div>
          <p className={mode === 'dark' ? 'mt-8 text-center text-xs text-neutral-500' : 'mt-8 text-center text-xs text-neutral-400'}>
            Beğendiğin yönü söyle → globals.css token'larına yazıp tüm uygulamaya uygularız.
          </p>
        </div>
      </main>
    </>
  )
}
