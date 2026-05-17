'use client'

import { useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { FloqLogo } from '@/components/floq-logo'

/* ── Scramble text hook ───────────────────────────────────────── */
const CHARS = 'abcçdefghiıjklmnoöprsştuüvyz'

function useScramble(target: string, startDelay: number) {
  const [text, setText] = useState(target)
  const done = useRef(false)

  useEffect(() => {
    const chars = target.split('')
    const settled = new Array(chars.length).fill(false)
    let current = chars.map(c => (/[a-zA-ZğüşıöçĞÜŞİÖÇ]/.test(c) ? CHARS[Math.floor(Math.random() * CHARS.length)]! : c))
    setText(current.join(''))

    const timer = setTimeout(() => {
      const scrambleInterval = setInterval(() => {
        let allDone = true
        current = current.map((_, i) => {
          if (settled[i]) return chars[i]!
          const progress = Math.random()
          if (progress > 0.88) { settled[i] = true; return chars[i]! }
          allDone = false
          return /[a-zA-ZğüşıöçĞÜŞİÖÇ]/.test(chars[i]!) ? CHARS[Math.floor(Math.random() * CHARS.length)]! : chars[i]!
        })
        setText(current.join(''))
        if (allDone) { clearInterval(scrambleInterval); done.current = true; setText(target) }
      }, 45)
      return () => clearInterval(scrambleInterval)
    }, startDelay)

    return () => clearTimeout(timer)
  }, [target, startDelay])

  return text
}

function useInView() {
  const ref = useRef<HTMLDivElement>(null)
  const [visible, setVisible] = useState(false)
  useEffect(() => {
    const el = ref.current
    if (!el) return
    const obs = new IntersectionObserver(
      ([e]) => { if (e!.isIntersecting) { setVisible(true); obs.disconnect() } },
      { threshold: 0.1 },
    )
    obs.observe(el)
    return () => obs.disconnect()
  }, [])
  return { ref, visible }
}

export default function Page() {
  const [scrolled, setScrolled] = useState(false)
  const line1 = useScramble('Sosyal medya,', 300)
  const line2 = useScramble('olması gerektiği gibi.', 800)
  useEffect(() => {
    const fn = () => setScrolled(window.scrollY > 20)
    window.addEventListener('scroll', fn, { passive: true })
    return () => window.removeEventListener('scroll', fn)
  }, [])

  return (
    <>
      <style>{`
        @keyframes fade-up  { from { opacity:0; transform:translateY(18px); } to { opacity:1; transform:translateY(0); } }
        @keyframes fade-in  { from { opacity:0; } to { opacity:1; } }
        .animate-fade-up { animation: fade-up 0.6s cubic-bezier(0.16,1,0.3,1) both; }
        .animate-fade-in { animation: fade-in 0.5s ease both; }
      `}</style>

      <div className="min-h-screen bg-(--color-background) text-(--color-text-primary)">

        {/* Nav */}
        <nav className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${scrolled ? 'bg-(--color-background)/95 backdrop-blur-sm border-b border-(--color-border-secondary) shadow-sm' : 'bg-transparent'}`}>
          <div className="max-w-5xl mx-auto px-6 h-14 flex items-center justify-between">
            <div className="animate-fade-in" style={{ animationDelay: '0ms' }}>
              <FloqLogo size="sm" />
            </div>
            <div className="flex items-center gap-2 animate-fade-in" style={{ animationDelay: '100ms' }}>
              <Link href="/login" className="px-4 py-1.5 text-sm text-(--color-text-tertiary) hover:text-(--color-text-primary) transition-colors">
                Giriş
              </Link>
              <Link href="/register" className="px-5 py-2 rounded-full text-sm font-semibold text-white bg-(--color-coral) hover:bg-(--color-coral-hover) transition-colors active:scale-[.97]">
                Katıl
              </Link>
            </div>
          </div>
        </nav>

        {/* Hero */}
        <section className="pt-32 pb-24 px-6 relative overflow-hidden">
          {/* Subtle background glow */}
          <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[600px] h-[400px] rounded-full opacity-[0.07] blur-3xl pointer-events-none" style={{ background: '#E8593C' }} />
          <div className="max-w-3xl mx-auto text-center relative">
            <p className="animate-fade-up text-sm font-semibold mb-5 text-(--color-coral)" style={{ animationDelay: '100ms' }}>
              Açık kaynak · Federe · ActivityPub
            </p>
            <h1
              className="font-bold tracking-tight mb-6"
              style={{
                fontFamily: 'var(--font-outfit)',
                fontSize: 'clamp(2.5rem, 6vw, 4.5rem)',
                lineHeight: 1.1,
                color: 'var(--color-text-primary)',
              }}
            >
              <span className="block" style={{ animation: 'fade-in 0.3s ease 200ms both' }}>
                {line1}
              </span>
              <span className="inline-block text-(--color-coral)" style={{ animation: 'fade-in 0.3s ease 650ms both' }}>
                {line2}
              </span>
            </h1>
            <p className="animate-fade-up text-lg text-(--color-text-secondary) leading-relaxed max-w-xl mx-auto mb-10" style={{ animationDelay: '250ms' }}>
              Takip ettiğin herkesin her gönderisini, kronolojik sırayla görürsün. Algoritma yok, reklam yok, verin sende kalır.
            </p>
            <div className="animate-fade-up flex flex-col sm:flex-row gap-3 justify-center" style={{ animationDelay: '350ms' }}>
              <Link
                href="/register"
                className="px-8 py-3.5 rounded-full font-semibold text-white text-base bg-(--color-coral) hover:bg-(--color-coral-hover) transition-all hover:-translate-y-px active:scale-[.97] shadow-sm"
              >
                Ücretsiz Başla
              </Link>
              <a
                href="#ozellikler"
                className="px-8 py-3.5 rounded-full font-semibold text-(--color-text-secondary) text-base border border-(--color-border) hover:border-(--color-border-secondary) hover:text-(--color-text-primary) transition-all hover:-translate-y-px"
              >
                Daha Fazla
              </a>
            </div>
          </div>
        </section>

        {/* Divider */}
        <div className="max-w-5xl mx-auto px-6">
          <div className="border-t border-(--color-border-secondary)" />
        </div>

        {/* Three pillars */}
        <PillarsSection />

        {/* Feature: Feed */}
        <FeedSection />

        {/* Feature: Fediverse */}
        <FediverseSection />

        {/* Feature: More */}
        <MoreSection />

        {/* CTA */}
        <CtaSection />

        {/* Footer */}
        <footer className="border-t border-(--color-border-secondary) py-8">
          <div className="max-w-5xl mx-auto px-6 flex flex-col sm:flex-row items-center justify-between gap-4">
            <FloqLogo size="sm" />
            <p className="text-xs text-(--color-text-tertiary)">© 2026 floq</p>
            <div className="flex gap-5 text-sm text-(--color-text-tertiary)">
              <Link href="/login" className="hover:text-(--color-text-secondary) transition-colors">Giriş</Link>
              <Link href="/register" className="hover:text-(--color-text-secondary) transition-colors">Kayıt</Link>
              <Link href="/privacy" className="hover:text-(--color-text-secondary) transition-colors">Gizlilik</Link>
            </div>
          </div>
        </footer>
      </div>
    </>
  )
}

/* ── Üç Temel ─────────────────────────────────────────────────── */
function PillarsSection() {
  const { ref, visible } = useInView()
  const items = [
    {
      title: 'Kronolojik akış',
      body: 'Algoritmalar içerik sıralamasına karışmaz. En son gönderi her zaman en üsttedir. Hiçbir şey gizlenmez.',
      icon: (
        <svg width="20" height="20" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24">
          <line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="12" x2="21" y2="12"/><line x1="3" y1="18" x2="21" y2="18"/>
        </svg>
      ),
    },
    {
      title: 'Federe ağ',
      body: 'Mastodon, Pixelfed ve tüm ActivityPub ekosistemiyle uyumlu. Tek hesapla tüm fediverse\'e ulaşırsın.',
      icon: (
        <svg width="20" height="20" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24">
          <circle cx="12" cy="12" r="10"/><line x1="2" y1="12" x2="22" y2="12"/>
          <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/>
        </svg>
      ),
    },
    {
      title: 'Verin sende',
      body: 'Paylaştığın her şey sana aittir. İstediğin zaman dışa aktar, başka bir platforma geç ya da tamamen sil.',
      icon: (
        <svg width="20" height="20" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24">
          <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
        </svg>
      ),
    },
  ]

  return (
    <section id="ozellikler" className="py-20 px-6">
      <div className="max-w-5xl mx-auto" ref={ref}>
        <div className="grid sm:grid-cols-3 gap-8">
          {items.map((item, i) => (
            <div
              key={item.title}
              className="group"
              style={{
                animation: visible ? `fade-up 0.6s cubic-bezier(0.16, 1, 0.3, 1) ${i * 80}ms both` : 'none',
                opacity: visible ? undefined : 0,
              }}
            >
              <div className="w-10 h-10 rounded-xl bg-(--color-background-secondary) border border-(--color-border) flex items-center justify-center mb-4 text-(--color-text-tertiary) group-hover:text-(--color-coral) group-hover:border-(--color-coral)/20 group-hover:bg-(--color-coral)/5 transition-all duration-200">
                {item.icon}
              </div>
              <h3 className="font-semibold text-(--color-text-primary) mb-2" style={{ fontFamily: 'var(--font-outfit)' }}>{item.title}</h3>
              <p className="text-sm text-(--color-text-tertiary) leading-relaxed">{item.body}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}

/* ── Feed Bölümü ──────────────────────────────────────────────── */
function FeedSection() {
  const { ref, visible } = useInView()

  return (
    <section className="py-20 px-6 bg-(--color-background-secondary) border-y border-(--color-border-secondary)">
      <div className="max-w-5xl mx-auto" ref={ref}>
        <div className="grid lg:grid-cols-2 gap-16 items-center">

          <div style={{ animation: visible ? 'fade-up 0.6s cubic-bezier(0.16, 1, 0.3, 1) both' : 'none', opacity: visible ? undefined : 0 }}>
            <p className="text-xs font-semibold tracking-wider uppercase text-(--color-text-tertiary) mb-4">Akış</p>
            <h2 className="font-bold text-(--color-text-primary) mb-4 leading-tight" style={{ fontFamily: 'var(--font-outfit)', fontSize: 'clamp(1.6rem, 3vw, 2.4rem)' }}>
              Takip ettiğin herkes.<br />
              <span className="text-(--color-text-tertiary) font-normal">Sırasıyla. Hepsi.</span>
            </h2>
            <p className="text-(--color-text-secondary) leading-relaxed mb-6">
              Algoritmalar etkileşim oranına, reklam bütçesine ya da platform çıkarına göre içerik seçer. floq bunu yapmaz — en son gönderi ilk sıradadır, her zaman.
            </p>
            <ul className="space-y-2.5">
              {['Hiçbir gönderi gizlenmez veya gömülmez', 'Sponsorlu içerik veya öne çıkarma yok', 'Sıralama sadece zamana göredir'].map(item => (
                <li key={item} className="flex items-center gap-2.5 text-sm text-(--color-text-secondary)">
                  <span className="w-4 h-4 rounded-full flex-shrink-0 flex items-center justify-center bg-(--color-coral)/10">
                    <svg width="8" height="8" viewBox="0 0 8 8" fill="none">
                      <polyline points="1,4 3,6.5 7,1.5" stroke="#E8593C" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                    </svg>
                  </span>
                  {item}
                </li>
              ))}
            </ul>
          </div>

          <div style={{ animation: visible ? 'fade-up 0.6s cubic-bezier(0.16, 1, 0.3, 1) 120ms both' : 'none', opacity: visible ? undefined : 0 }}>
            <div className="rounded-2xl border border-(--color-border) bg-(--color-background) overflow-hidden shadow-sm">
              <div className="px-4 py-3 border-b border-(--color-border-secondary) flex items-center gap-2">
                <div className="w-2 h-2 rounded-full bg-(--color-coral)" />
                <span className="text-xs font-semibold text-(--color-text-primary)" style={{ fontFamily: 'var(--font-outfit)' }}>Ana Akış</span>
                <span className="ml-auto text-[10px] text-(--color-text-tertiary)">Kronolojik</span>
              </div>
              {[
                { name: 'Zeynep K.', handle: 'zeynep', time: 'şimdi', text: 'Algoritma yok, reklam yok. Sadece takip ettiğim insanlar.' },
                { name: 'Mert A.', handle: 'mert_dev', time: '4dk', text: 'Mastodon hesabımdan floq\'taki herkesi takip edebildim.' },
                { name: 'Elif S.', handle: 'elif', time: '12dk', text: 'Verilerimi dışa aktardım, yeni sunucuya geçtim.' },
              ].map((post, i) => (
                <div key={i} className="px-4 py-3 border-b border-(--color-border-secondary) last:border-0 flex gap-3">
                  <div className="w-8 h-8 rounded-full flex-shrink-0 flex items-center justify-center text-xs font-bold text-white" style={{ background: `hsl(${i * 60 + 20}, 55%, 52%)` }}>
                    {post.name[0]}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-baseline gap-1.5 mb-0.5">
                      <span className="text-sm font-semibold text-(--color-text-primary)">{post.name}</span>
                      <span className="text-xs text-(--color-text-tertiary)">@{post.handle} · {post.time}</span>
                    </div>
                    <p className="text-sm text-(--color-text-secondary) leading-relaxed">{post.text}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}

/* ── Fediverse Bölümü ─────────────────────────────────────────── */
function FediverseSection() {
  const { ref, visible } = useInView()
  const platforms = [
    { name: 'Mastodon', color: '#6364FF' },
    { name: 'Pixelfed', color: '#D63638' },
    { name: 'PeerTube', color: '#F04E23' },
    { name: 'Lemmy', color: '#00BC8C' },
    { name: 'Misskey', color: '#ABA0C8' },
    { name: 'Pleroma', color: '#E08A00' },
  ]

  return (
    <section className="py-20 px-6">
      <div className="max-w-5xl mx-auto" ref={ref}>
        <div className="grid lg:grid-cols-2 gap-16 items-center">

          <div style={{ animation: visible ? 'fade-up 0.6s cubic-bezier(0.16, 1, 0.3, 1) 80ms both' : 'none', opacity: visible ? undefined : 0 }} className="order-2 lg:order-1">
            <div className="rounded-2xl border border-(--color-border) bg-(--color-background-secondary) p-6">
              <div className="flex justify-center mb-6">
                <div className="text-center">
                  <div className="w-14 h-14 rounded-2xl mx-auto mb-2 flex items-center justify-center bg-(--color-coral)">
                    <svg width="28" height="28" viewBox="0 0 44 44" fill="none">
                      <rect x="2" y="2" width="40" height="40" rx="13" fill="white" opacity="0.15"/>
                      <circle cx="15" cy="17" r="6" fill="white" opacity="0.9"/>
                      <circle cx="29" cy="17" r="6" fill="white" opacity="0.6"/>
                      <circle cx="22" cy="29" r="6" fill="white" opacity="0.35"/>
                    </svg>
                  </div>
                  <span className="text-xs font-bold text-(--color-text-tertiary) tracking-widest">FLOQ</span>
                </div>
              </div>
              <div className="grid grid-cols-3 gap-2">
                {platforms.map(p => (
                  <div key={p.name} className="flex items-center gap-2 bg-(--color-background) rounded-xl border border-(--color-border) px-3 py-2">
                    <div className="w-5 h-5 rounded-md flex-shrink-0" style={{ background: p.color }} />
                    <span className="text-xs text-(--color-text-secondary) font-medium">{p.name}</span>
                  </div>
                ))}
              </div>
              <div className="mt-3 text-center">
                <p className="text-xs text-(--color-text-tertiary)">+ 850 aktif sunucu</p>
              </div>
            </div>
          </div>

          <div style={{ animation: visible ? 'fade-up 0.6s cubic-bezier(0.16, 1, 0.3, 1) both' : 'none', opacity: visible ? undefined : 0 }} className="order-1 lg:order-2">
            <p className="text-xs font-semibold tracking-wider uppercase text-(--color-text-tertiary) mb-4">Fediverse</p>
            <h2 className="font-bold text-(--color-text-primary) mb-4 leading-tight" style={{ fontFamily: 'var(--font-outfit)', fontSize: 'clamp(1.6rem, 3vw, 2.4rem)' }}>
              Tek hesap.<br />
              <span className="text-(--color-text-tertiary) font-normal">Tüm fediverse.</span>
            </h2>
            <p className="text-(--color-text-secondary) leading-relaxed mb-6">
              floq hesabınla Mastodon&apos;dan Pixelfed&apos;e kadar tüm federe platformlardaki insanları takip edebilirsin. ActivityPub sayesinde platformlar arası duvarlar ortadan kalkar.
            </p>
            <ul className="space-y-2.5">
              {[
                "@kullanici@mastodon.social'u doğrudan takip et",
                'Hesabını başka sunucuya taşı, takipçilerini kaybetme',
                'Pixelfed, PeerTube ve Lemmy içerikleri akışında görünsün',
              ].map(item => (
                <li key={item} className="flex items-center gap-2.5 text-sm text-(--color-text-secondary)">
                  <span className="w-4 h-4 rounded-full flex-shrink-0 flex items-center justify-center bg-(--color-coral)/10">
                    <svg width="8" height="8" viewBox="0 0 8 8" fill="none">
                      <polyline points="1,4 3,6.5 7,1.5" stroke="#E8593C" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                    </svg>
                  </span>
                  {item}
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>
    </section>
  )
}

/* ── Daha Fazlası ─────────────────────────────────────────────── */
function MoreSection() {
  const { ref, visible } = useInView()
  const cards = [
    {
      title: 'Uçtan uca şifreli DM',
      body: 'Mesajların X25519 + AES-256-GCM ile şifrelenir. Sadece sen ve karşındaki okuyabilir.',
      icon: (
        <svg width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24">
          <rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/>
        </svg>
      ),
    },
    {
      title: 'Açık kaynak',
      body: 'Tüm kaynak kod herkese açık. İstediğin zaman denetleyebilir, katkıda bulunabilirsin.',
      icon: (
        <svg width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24">
          <circle cx="18" cy="18" r="3"/><circle cx="6" cy="6" r="3"/><path d="M6 21V9a9 9 0 0 0 9 9"/>
        </svg>
      ),
    },
    {
      title: 'Veri dışa aktarma',
      body: 'Tüm verilerini tek tıkla indir. Gönderi, medya, takipçi — hepsi sana ait.',
      icon: (
        <svg width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24">
          <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/>
        </svg>
      ),
    },
    {
      title: 'Sesli odalar',
      body: 'WebRTC tabanlı sesli toplantılar. Sohbetini başlat, takipçilerini davet et.',
      icon: (
        <svg width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24">
          <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"/><path d="M19 10v2a7 7 0 0 1-14 0v-2"/>
          <line x1="12" y1="19" x2="12" y2="23"/><line x1="8" y1="23" x2="16" y2="23"/>
        </svg>
      ),
    },
    {
      title: 'Gizlilik kontrolleri',
      body: 'Yakın çevre listesi, sessizleştirme, engelleme. Takipçilerini ve içeriğini yönet.',
      icon: (
        <svg width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24">
          <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/>
          <path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/>
        </svg>
      ),
    },
    {
      title: 'Akış listeleri',
      body: 'Takip ettiğin kişilerden özel listeler oluştur ve ayrı akışlarda takip et.',
      icon: (
        <svg width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24">
          <line x1="8" y1="6" x2="21" y2="6"/><line x1="8" y1="12" x2="21" y2="12"/><line x1="8" y1="18" x2="21" y2="18"/>
          <line x1="3" y1="6" x2="3.01" y2="6"/><line x1="3" y1="12" x2="3.01" y2="12"/><line x1="3" y1="18" x2="3.01" y2="18"/>
        </svg>
      ),
    },
  ]

  return (
    <section className="py-20 px-6 bg-(--color-background-secondary) border-y border-(--color-border-secondary)">
      <div className="max-w-5xl mx-auto" ref={ref}>
        <div className="mb-12" style={{ animation: visible ? 'fade-up 0.6s cubic-bezier(0.16, 1, 0.3, 1) both' : 'none', opacity: visible ? undefined : 0 }}>
          <p className="text-xs font-semibold tracking-wider uppercase text-(--color-text-tertiary) mb-3">Daha fazlası</p>
          <h2 className="font-bold text-(--color-text-primary) leading-tight" style={{ fontFamily: 'var(--font-outfit)', fontSize: 'clamp(1.6rem, 3vw, 2.4rem)' }}>
            Her şey düşünülerek tasarlandı.
          </h2>
        </div>
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {cards.map((card, i) => (
            <div
              key={card.title}
              className="bg-(--color-background) rounded-xl border border-(--color-border) p-5 hover:border-(--color-coral)/30 hover:shadow-sm transition-all duration-200"
              style={{ animation: visible ? `fade-up 0.6s cubic-bezier(0.16, 1, 0.3, 1) ${i * 60}ms both` : 'none', opacity: visible ? undefined : 0 }}
            >
              <div className="w-8 h-8 rounded-lg bg-(--color-background-secondary) border border-(--color-border) flex items-center justify-center text-(--color-text-tertiary) mb-3">
                {card.icon}
              </div>
              <h3 className="font-semibold text-(--color-text-primary) text-sm mb-1.5">{card.title}</h3>
              <p className="text-xs text-(--color-text-tertiary) leading-relaxed">{card.body}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}

/* ── CTA ──────────────────────────────────────────────────────── */
const CONTRASTS = [
  { them: 'Algoritmalar önce viral içeriği gösterir.', us: 'floq\'ta en son gönderi ilk sıradadır.' },
  { them: 'Verilerini kapatırsa takipçilerini kaybedersin.', us: 'ActivityPub ile hesabını istediğin sunucuya taşırsın.' },
  { them: 'Hangi içeriği gördüğüne platform karar verir.', us: 'Takip ettiğin insanların gönderileri, hepsi, sırasıyla.' },
]

function CtaSection() {
  const { ref, visible } = useInView()
  const [active, setActive] = useState(0)

  useEffect(() => {
    const t = setInterval(() => setActive(i => (i + 1) % CONTRASTS.length), 3000)
    return () => clearInterval(t)
  }, [])

  return (
    <section className="py-20 px-6" ref={ref}>
      <div className="max-w-5xl mx-auto">
        <div className="grid lg:grid-cols-5 gap-10 items-start">

          <div className="lg:col-span-2"
            style={{ animation: visible ? 'fade-up 0.6s cubic-bezier(0.16,1,0.3,1) both' : 'none', opacity: visible ? undefined : 0 }}>
            <p className="text-xs font-semibold tracking-wider uppercase text-(--color-text-tertiary) mb-4">Neden farklı</p>
            <h2 className="font-bold text-(--color-text-primary) leading-tight mb-6"
              style={{ fontFamily: 'var(--font-outfit)', fontSize: 'clamp(1.6rem, 2.8vw, 2.2rem)' }}>
              Diğerleri değil,<br />
              <span className="text-(--color-coral)">sen karar verirsin.</span>
            </h2>
            <div className="flex gap-2 mb-6">
              {CONTRASTS.map((_, i) => (
                <button
                  key={i}
                  onClick={() => setActive(i)}
                  className="h-1 rounded-full transition-all duration-300 bg-(--color-border)"
                  style={{ width: active === i ? 24 : 8, background: active === i ? '#E8593C' : undefined }}
                />
              ))}
            </div>
            <Link
              href="/register"
              className="inline-flex px-7 py-3 rounded-full font-semibold text-white text-sm bg-(--color-coral) hover:bg-(--color-coral-hover) transition-all hover:-translate-y-px active:scale-[.97]"
            >
              Hemen başla →
            </Link>
          </div>

          <div className="lg:col-span-3"
            style={{ animation: visible ? 'fade-up 0.6s cubic-bezier(0.16,1,0.3,1) 120ms both' : 'none', opacity: visible ? undefined : 0 }}>
            <div className="rounded-2xl border border-(--color-border) overflow-hidden bg-(--color-background)">
              <div className="px-5 py-4 border-b border-(--color-border-secondary) bg-(--color-background-secondary)">
                <p className="text-[10px] font-semibold uppercase tracking-wider text-(--color-text-tertiary) mb-2">Diğer platformlar</p>
                <p key={`them-${active}`} className="text-sm text-(--color-text-secondary) leading-relaxed"
                  style={{ animation: 'fade-up 0.35s cubic-bezier(0.16,1,0.3,1) both' }}>
                  {CONTRASTS[active]!.them}
                </p>
              </div>
              <div className="px-5 py-4">
                <div className="flex items-center gap-1.5 mb-2">
                  <div className="w-3 h-3 rounded-full flex-shrink-0 bg-(--color-coral)" />
                  <p className="text-[10px] font-semibold uppercase tracking-wider text-(--color-coral)">floq</p>
                </div>
                <p key={`us-${active}`} className="text-sm font-medium text-(--color-text-primary) leading-relaxed"
                  style={{ animation: 'fade-up 0.35s cubic-bezier(0.16,1,0.3,1) 60ms both' }}>
                  {CONTRASTS[active]!.us}
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}
