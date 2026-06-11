import { Heart, MessageCircle, Repeat2, ArrowUpRight, Globe } from 'lucide-react'

/* ───────────────────────────────────────────────────────────
   /tema-v2 — RADİKAL REBRAND ÖNİZLEME (izole, canlıya dokunmaz)
   "Rahat" değil — iddialı, güncel, ayrışan 4 yön.
   Her yön kendi düzeni + tipografisiyle aynı içeriği işler.
   ─────────────────────────────────────────────────────────── */

/* ── 1. BRUTALIST / MONO ──────────────────────────────── */
function Brutalist() {
  const ink = '#111111'
  const acid = '#C6F24E'
  const hard = { boxShadow: `4px 4px 0 ${ink}`, border: `2px solid ${ink}` }
  return (
    <div style={{ background: '#F4F2EA', color: ink, fontFamily: "'Space Mono', monospace", padding: 24 }}>
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-baseline gap-2">
          <span className="text-2xl font-bold lowercase">floq</span>
          <span className="text-[10px] font-bold uppercase px-1.5 py-0.5" style={{ background: acid, ...hard, boxShadow: 'none', borderWidth: 1 }}>[beta]</span>
        </div>
        <span className="text-[10px] uppercase tracking-widest">01 / brutalist-mono</span>
      </div>

      <h3 className="text-3xl font-bold uppercase leading-none mb-3">AĞIN&nbsp;SENİN.<br /><span style={{ background: acid }}>&nbsp;KURALLARIN&nbsp;SENİN.&nbsp;</span></h3>
      <p className="text-xs leading-relaxed mb-6 uppercase">// algoritma yok &nbsp; // reklam yok &nbsp; // veri senin</p>

      <div className="flex gap-3 mb-6">
        <button className="px-4 h-10 text-xs font-bold uppercase" style={{ background: ink, color: '#fff' }}>HESAP_AÇ →</button>
        <button className="px-4 h-10 text-xs font-bold uppercase bg-white" style={hard}>GİRİŞ</button>
      </div>

      <div className="bg-white p-3 mb-6" style={hard}>
        <div className="flex items-center gap-2 mb-2">
          <div className="w-8 h-8 flex items-center justify-center text-[11px] font-bold text-white" style={{ background: ink }}>EÖ</div>
          <div className="text-[11px] leading-tight">
            <div className="font-bold uppercase">ELİF ÖZTÜRK</div>
            <div className="opacity-60">@elif@flq.social</div>
          </div>
        </div>
        <p className="text-xs leading-relaxed mb-2">Bir Mastodon kullanıcısını floq'tan takip ettim. Federe ağ çalışıyor. Kapalı adalar bitti.</p>
        <div className="flex gap-4 text-[11px] font-bold">↩ 12 &nbsp; ⇄ 8 &nbsp; ♥ 47</div>
      </div>

      <div className="grid grid-cols-3 gap-2">
        {[['311', 'SUNUCU'], ['2.5K', 'KULLANICI'], ['27.4K', 'MSJ/GÜN']].map(([v, l]) => (
          <div key={l} className="bg-white p-2 text-center" style={{ border: `2px solid ${ink}` }}>
            <div className="text-lg font-bold">{v}</div>
            <div className="text-[9px] uppercase tracking-wide opacity-70">{l}</div>
          </div>
        ))}
      </div>
    </div>
  )
}

/* ── 2. MAKSİMAL TİP ──────────────────────────────────── */
function Maximal() {
  const ink = '#16140F'
  const accent = '#E5421F'
  return (
    <div style={{ background: '#ECE9E1', color: ink, fontFamily: "'Archivo', sans-serif", padding: 24 }}>
      <div className="flex items-center justify-between mb-4">
        <span className="text-lg font-black tracking-tight">floq<span style={{ color: accent }}>.</span></span>
        <span className="text-[10px] uppercase tracking-widest opacity-60">02 / maksimal-tip</span>
      </div>

      <h3 style={{ fontFamily: "'Anton', sans-serif", lineHeight: 0.85, letterSpacing: '-0.02em' }} className="uppercase mb-4">
        <span className="block text-6xl">AĞIN</span>
        <span className="block text-6xl" style={{ color: accent }}>SENİN.</span>
        <span className="block text-6xl outline-text">KURALLAR</span>
        <span className="block text-6xl">SENİN.</span>
      </h3>

      <p className="text-sm font-medium leading-snug mb-6 max-w-[34ch]">
        Algoritma yok. Reklam yok. Verin sende. Üç ağ, tek kimlik — gerisi gürültü.
      </p>

      <button className="inline-flex items-center gap-2 px-6 h-12 text-base font-black uppercase mb-6" style={{ background: ink, color: '#fff' }}>
        Başla <ArrowUpRight className="w-5 h-5" />
      </button>

      <div className="border-t-2 pt-4" style={{ borderColor: ink }}>
        <div className="flex items-end gap-4">
          <span style={{ fontFamily: "'Anton', sans-serif", color: accent }} className="text-5xl leading-none">311</span>
          <span className="text-sm font-bold uppercase pb-1">federe<br />sunucu</span>
          <span className="ml-auto text-xs font-medium opacity-60 pb-1 text-right">2.5K kullanıcı<br />27.4K mesaj/gün</span>
        </div>
      </div>
    </div>
  )
}

/* ── 3. MEKÂNSAL / KOYU ───────────────────────────────── */
function Spatial() {
  const glass = { background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', backdropFilter: 'blur(12px)' }
  return (
    <div
      className="relative overflow-hidden"
      style={{ background: '#0A0A12', color: '#E8E8F0', fontFamily: "'Inter', sans-serif", padding: 24 }}
    >
      {/* glow orbs */}
      <div className="pointer-events-none absolute -top-20 -right-16 w-64 h-64 rounded-full" style={{ background: 'radial-gradient(circle,#7C5CFF55,transparent 70%)', filter: 'blur(20px)' }} />
      <div className="pointer-events-none absolute -bottom-24 -left-12 w-64 h-64 rounded-full" style={{ background: 'radial-gradient(circle,#FF6B4A40,transparent 70%)', filter: 'blur(20px)' }} />

      <div className="relative">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-2">
            <span className="text-xl font-semibold tracking-tight">floq</span>
            <span className="text-[9px] font-bold uppercase px-1.5 py-0.5 rounded-full" style={{ background: 'linear-gradient(90deg,#7C5CFF,#FF6B4A)', color: '#fff' }}>beta</span>
          </div>
          <span className="text-[10px] uppercase tracking-widest opacity-50">03 / mekânsal-koyu</span>
        </div>

        <h3 className="text-3xl font-semibold leading-tight tracking-tight mb-2">
          Ağın senin,<br />
          <span style={{ background: 'linear-gradient(90deg,#A78BFF,#FF8A6A)', WebkitBackgroundClip: 'text', backgroundClip: 'text', color: 'transparent' }}>kuralların senin.</span>
        </h3>
        <p className="text-sm leading-relaxed mb-6" style={{ color: 'rgba(232,232,240,0.6)' }}>
          Algoritma yok, reklam yok. Üç merkeziyetsiz ağ, tek kimlik.
        </p>

        <div className="flex gap-3 mb-6">
          <button className="h-10 px-5 rounded-xl text-sm font-semibold text-white" style={{ background: 'linear-gradient(90deg,#7C5CFF,#9B7BFF)', boxShadow: '0 8px 24px -8px #7C5CFFaa' }}>Hesap oluştur</button>
          <button className="h-10 px-5 rounded-xl text-sm font-semibold" style={glass}>Giriş yap</button>
        </div>

        <div className="rounded-2xl p-4 mb-6" style={glass}>
          <div className="flex items-center gap-3 mb-2.5">
            <div className="w-9 h-9 rounded-full flex items-center justify-center text-white text-xs font-bold" style={{ background: 'linear-gradient(135deg,#7C5CFF,#FF6B4A)' }}>EÖ</div>
            <div className="text-xs leading-tight">
              <div className="font-semibold flex items-center gap-1">Elif Öztürk <Globe className="w-3 h-3 opacity-60" /></div>
              <div style={{ color: 'rgba(232,232,240,0.5)' }}>@elif@flq.social · 2s</div>
            </div>
          </div>
          <p className="text-sm leading-relaxed mb-3">Bir Mastodon kullanıcısını floq'tan takip ettim. Federe ağ çalışıyor — kapalı adalar bitiyor.</p>
          <div className="flex gap-5 text-xs" style={{ color: 'rgba(232,232,240,0.55)' }}>
            <span className="flex items-center gap-1.5"><MessageCircle className="w-4 h-4" />12</span>
            <span className="flex items-center gap-1.5"><Repeat2 className="w-4 h-4" />8</span>
            <span className="flex items-center gap-1.5"><Heart className="w-4 h-4" />47</span>
          </div>
        </div>

        <div className="grid grid-cols-3 gap-3">
          {[['311', 'sunucu'], ['2.5K', 'kullanıcı'], ['27.4K', 'mesaj/gün']].map(([v, l]) => (
            <div key={l} className="rounded-xl p-3 text-center" style={glass}>
              <div className="text-lg font-bold" style={{ background: 'linear-gradient(90deg,#A78BFF,#FF8A6A)', WebkitBackgroundClip: 'text', backgroundClip: 'text', color: 'transparent' }}>{v}</div>
              <div className="text-[10px]" style={{ color: 'rgba(232,232,240,0.5)' }}>{l}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

/* ── 4. SWISS-RADİKAL ─────────────────────────────────── */
function Swiss() {
  const ink = '#0A0A0A'
  const red = '#FF2E1F'
  return (
    <div style={{ background: '#FFFFFF', color: ink, fontFamily: "'Archivo', sans-serif", padding: 24 }}>
      <div className="flex items-center justify-between border-b-2 pb-2 mb-5" style={{ borderColor: ink }}>
        <span className="text-base font-black tracking-tight">floq</span>
        <span className="text-[10px] font-bold uppercase tracking-widest">04 — SWISS-RADİKAL</span>
      </div>

      <div className="grid grid-cols-12 gap-2 mb-5">
        <h3 className="col-span-12 font-black uppercase leading-[0.9] tracking-tight" style={{ fontSize: 44 }}>
          Ağın senin,<br />kuralların <span style={{ color: red }}>senin</span>
        </h3>
      </div>

      <div className="grid grid-cols-12 gap-3 mb-5">
        <p className="col-span-7 text-sm font-medium leading-snug">
          Algoritma yok, reklam yok. Verin sende; istediğin an taşı, dilediğin sunucuya bağlan.
        </p>
        <div className="col-span-5 flex flex-col gap-2">
          <button className="h-10 text-xs font-bold uppercase text-white" style={{ background: ink }}>Hesap oluştur</button>
          <button className="h-10 text-xs font-bold uppercase border-2" style={{ borderColor: ink }}>Giriş yap</button>
        </div>
      </div>

      <div className="border-t-2 pt-4 grid grid-cols-3 gap-0" style={{ borderColor: ink }}>
        {[['311', 'SUNUCU'], ['2.5K', 'KULLANICI'], ['27.4K', 'MESAJ/GÜN']].map(([v, l], i) => (
          <div key={l} className={i < 2 ? 'border-r-2 pr-3' : 'pl-3'} style={{ borderColor: ink }}>
            <div className="text-3xl font-black leading-none">{v}</div>
            <div className="text-[10px] font-bold uppercase tracking-wide mt-1">{l}</div>
          </div>
        ))}
      </div>

      <div className="border-t-2 mt-4 pt-3 flex items-center gap-3" style={{ borderColor: ink }}>
        <div className="w-9 h-9 flex items-center justify-center text-xs font-black text-white" style={{ background: red }}>EÖ</div>
        <p className="text-xs font-medium leading-tight flex-1">
          <span className="font-black uppercase">Elif Öztürk</span> — "Federe ağ çalışıyor, kapalı adalar bitiyor."
        </p>
      </div>
    </div>
  )
}

const DIRS = [
  { id: 'brutalist', name: 'Brutalist / Mono', note: 'Ham, yüksek kontrast, mono font, sert gölge, asit accent. Anti-design, indie-web.', el: <Brutalist /> },
  { id: 'maximal', name: 'Maksimal Tip', note: 'Dev poster tipografisi (Anton) baskın; tip = tasarım. Az renk, sert ölçek kontrastı.', el: <Maximal /> },
  { id: 'spatial', name: 'Mekânsal / Koyu', note: 'Linear/Arc havası: derin koyu, gradyan glow, cam (glass) kartlar, derinlik.', el: <Spatial /> },
  { id: 'swiss', name: 'Swiss-Radikal', note: 'Katı grid, dev tip, 2 renk (siyah + kırmızı), çizgiler. Editoryal, keskin.', el: <Swiss /> },
]

export default function TemaV2Page() {
  return (
    <>
      <style
        dangerouslySetInnerHTML={{
          __html: `@import url('https://fonts.googleapis.com/css2?family=Anton&family=Archivo:wght@400;500;600;700;800;900&family=Inter:wght@400;500;600;700&family=Space+Mono:wght@400;700&display=swap');
            .outline-text{color:transparent;-webkit-text-stroke:2px #16140F;}`,
        }}
      />
      <main className="min-h-screen bg-neutral-200 px-6 py-12">
        <div className="max-w-[1400px] mx-auto">
          <header className="mb-8 text-center">
            <h1 className="text-3xl font-bold text-neutral-900">floq — Radikal Rebrand (v2)</h1>
            <p className="mt-2 text-sm text-neutral-600 max-w-2xl mx-auto">
              "Rahat" değil — iddialı, güncel, ayrışan dört yön. Her biri kendi düzeni + tipografisiyle aynı içeriği işler.
              İzoledir; canlı uygulamaya dokunmaz. Beğendiğin yönü (ya da karışımı) söyle.
            </p>
          </header>
          <div className="grid gap-6 lg:grid-cols-2 items-start">
            {DIRS.map((d) => (
              <div key={d.id} className="rounded-2xl overflow-hidden border border-neutral-300 bg-white shadow-sm">
                <div className="px-4 py-2.5 border-b border-neutral-200 flex items-center justify-between">
                  <span className="text-sm font-semibold text-neutral-900">{d.name}</span>
                </div>
                {d.el}
                <p className="px-4 py-3 text-xs text-neutral-500 border-t border-neutral-200">{d.note}</p>
              </div>
            ))}
          </div>
          <p className="mt-8 text-center text-xs text-neutral-400">
            Seçince globals.css token + font kurgusuna işleyip tüm uygulamaya uygularız.
          </p>
        </div>
      </main>
    </>
  )
}
