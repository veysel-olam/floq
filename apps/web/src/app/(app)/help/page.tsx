'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { cn } from '@/lib/utils'
import {
  BookOpen,
  Feather,
  Zap,
  Lock,
  Globe,
  Keyboard,
  ChevronRight,
  Hash,
  Heart,
  Repeat2,
  Bookmark,
  Bell,
  List,
  Layers,
  Search,
  Settings,
  ArrowRight,
  Users,
  Shield,
  Eye,
  TrendingUp,
  Clock,
  Flame,
  BarChart2,
  Shuffle,
} from 'lucide-react'

type Section = {
  id: string
  label: string
  icon: React.ReactNode
}

const sections: Section[] = [
  { id: 'getting-started', label: 'Başlarken', icon: <BookOpen className="w-4 h-4" /> },
  { id: 'posts', label: 'Gönderiler', icon: <Feather className="w-4 h-4" /> },
  { id: 'feed-algorithms', label: 'Feed Algoritmaları', icon: <Zap className="w-4 h-4" /> },
  { id: 'privacy', label: 'Gizlilik', icon: <Lock className="w-4 h-4" /> },
  { id: 'federation', label: 'Federasyon & AT Protocol', icon: <Globe className="w-4 h-4" /> },
  { id: 'shortcuts', label: 'Klavye Kısayolları', icon: <Keyboard className="w-4 h-4" /> },
]

export default function HelpPage() {
  const [active, setActive] = useState('getting-started')

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) setActive(entry.target.id)
        }
      },
      { rootMargin: '-20% 0px -70% 0px' },
    )
    for (const s of sections) {
      const el = document.getElementById(s.id)
      if (el) observer.observe(el)
    }
    return () => observer.disconnect()
  }, [])

  return (
    <div className="max-w-3xl mx-auto">
      {/* Mobile sticky header */}
      <header className="md:hidden sticky top-0 z-10 bg-(--color-background)/90 backdrop-blur-md border-b border-(--color-border) px-4 py-3.5 flex items-center gap-2">
        <BookOpen className="w-4 h-4 text-(--color-coral)" />
        <h1 className="text-base font-bold text-(--color-text-primary)" style={{ fontFamily: 'var(--font-outfit)' }}>
          Yardım & Kılavuz
        </h1>
      </header>

    <div className="flex gap-0">
      {/* Sticky section nav */}
      <aside className="hidden md:block w-48 flex-shrink-0 sticky top-0 self-start h-screen pt-6 pr-4 border-r border-(--color-border)">
        <p className="text-xs font-semibold text-(--color-text-tertiary) uppercase tracking-wider px-3 mb-2">
          İçindekiler
        </p>
        <nav className="space-y-0.5">
          {sections.map((s) => (
            <a
              key={s.id}
              href={`#${s.id}`}
              className={cn(
                'flex items-center gap-2 px-3 py-2 rounded-lg text-sm transition-colors',
                active === s.id
                  ? 'bg-(--color-blush) text-(--color-coral) font-medium dark:bg-(--color-coral)/10'
                  : 'text-(--color-text-secondary) hover:text-(--color-text-primary) hover:bg-(--color-background-secondary)',
              )}
            >
              {s.icon}
              {s.label}
            </a>
          ))}
        </nav>
      </aside>

      {/* Content */}
      <main className="flex-1 min-w-0 px-4 md:px-8 py-6 space-y-16">
        <header>
          <h1 className="text-2xl font-bold text-(--color-text-primary)" style={{ fontFamily: 'var(--font-outfit)' }}>
            Yardım & Kılavuz
          </h1>
          <p className="mt-1 text-sm text-(--color-text-tertiary)">
            floq&apos;u kullanmak için bilmeniz gereken her şey.
          </p>
        </header>

        {/* Başlarken */}
        <Section id="getting-started" title="Başlarken" icon={<BookOpen className="w-5 h-5" />}>
          <p className="text-sm text-(--color-text-secondary) leading-relaxed">
            floq, açık kaynak ve merkeziyetsiz bir sosyal ağdır. Verileriniz size aittir — hiçbir zaman bir şirketin
            sunucularına kilitli kalmaz.
          </p>

          <Steps>
            <Step number={1} title="Profil oluşturun">
              <Link href="/settings" className="text-(--color-coral) hover:underline">Ayarlar → Profil</Link> bölümünden
              görsel, biyografi ve web sitesi ekleyin. Profiliniz ActivityPub ile federe ağda herkes tarafından görülebilir.
            </Step>
            <Step number={2} title="Kişileri takip edin">
              <Link href="/explore" className="text-(--color-coral) hover:underline">Keşfet</Link>&apos;ten kullanıcı
              arayın veya{' '}
              <Link href="/network" className="text-(--color-coral) hover:underline">Ağ Haritası</Link>&apos;nı kullanarak
              takip ağınızı görselleştirin.
            </Step>
            <Step number={3} title="İlk gönderinizi paylaşın">
              Ana sayfadaki metin kutusuna yazın ve Gönder&apos;e tıklayın. Maksimum 500 karakter; hashtag, medya ve
              içerik uyarısı ekleyebilirsiniz.
            </Step>
            <Step number={4} title="Feed&apos;inizi özelleştirin">
              <Link href="/settings" className="text-(--color-coral) hover:underline">Ayarlar → Feed</Link> bölümünden
              varsayılan sıralama algoritmasını seçin veya{' '}
              <Link href="/flows" className="text-(--color-coral) hover:underline">Akışlar</Link>&apos;dan kişiselleştirilmiş
              feed kuralları oluşturun.
            </Step>
          </Steps>

          <InfoBox icon={<ArrowRight className="w-4 h-4" />} title="Hızlı erişim">
            <div className="grid grid-cols-2 gap-2 mt-2">
              {[
                { href: '/home', icon: <Hash className="w-3.5 h-3.5" />, label: 'Ana Sayfa' },
                { href: '/explore', icon: <Search className="w-3.5 h-3.5" />, label: 'Keşfet' },
                { href: '/notifications', icon: <Bell className="w-3.5 h-3.5" />, label: 'Bildirimler' },
                { href: '/settings', icon: <Settings className="w-3.5 h-3.5" />, label: 'Ayarlar' },
              ].map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  className="flex items-center gap-2 px-3 py-2 rounded-lg border border-(--color-border) bg-(--color-background) hover:border-(--color-coral) hover:text-(--color-coral) text-sm text-(--color-text-secondary) transition-colors"
                >
                  {item.icon} {item.label}
                </Link>
              ))}
            </div>
          </InfoBox>
        </Section>

        {/* Gönderiler */}
        <Section id="posts" title="Gönderiler" icon={<Feather className="w-5 h-5" />}>
          <FeatureGrid>
            <Feature icon={<Hash className="w-4 h-4" />} title="Hashtag">
              İçeriğinize <code>#hashtag</code> ekleyin. Hashtagler tıklanabilir ve arama yapılabilir. Birden fazla kelimeli hashtagler
              desteklenmez; alt çizgi kullanın (<code>#türk_müzik</code>).
            </Feature>
            <Feature icon={<Heart className="w-4 h-4" />} title="Beğeni">
              Bir gönderiyi beğenmek için kalp ikonuna tıklayın. Beğeniler profil sayfanızda görünür ve yazara
              bildirim gönderir.
            </Feature>
            <Feature icon={<Repeat2 className="w-4 h-4" />} title="Boost">
              Bir gönderiyi takipçilerinizle paylaşmak için boost yapın. Orijinal gönderi korunur, kaynak her zaman belirtilir.
            </Feature>
            <Feature icon={<Bookmark className="w-4 h-4" />} title="Yer İmi">
              Sonra okumak istediğiniz gönderileri yer imlerine ekleyin. Yer imleri yalnızca size görünür.
            </Feature>
            <Feature icon={<Eye className="w-4 h-4" />} title="Görünürlük">
              <strong>Herkese açık</strong> — herkes görebilir. <strong>Listelenmemiş</strong> — doğrudan URL ile erişilebilir
              ama feed&apos;lerde çıkmaz. <strong>Takipçiler</strong> — yalnızca takipçileriniz. <strong>Direkt</strong> —
              bahsedilen kişilerle özel.
            </Feature>
            <Feature icon={<Shield className="w-4 h-4" />} title="İçerik Uyarısı">
              Hassas konular için gönderi oluştururken İÜ alanını doldurun. Okuyucular içeriği açmayı seçebilir.
            </Feature>
          </FeatureGrid>

          <div className="mt-6 space-y-3">
            <h3 className="text-sm font-semibold text-(--color-text-primary)">Thread oluşturma</h3>
            <p className="text-sm text-(--color-text-secondary) leading-relaxed">
              Bir gönderiye yanıt vererek thread başlatırsınız. Gönderi detay sayfasında (<ChevronRight className="w-3.5 h-3.5 inline" />{' '}
              gönderiye tıklayın) tüm atayı ve yanıtları görebilirsiniz.
            </p>
          </div>
        </Section>

        {/* Feed Algoritmaları */}
        <Section id="feed-algorithms" title="Feed Algoritmaları" icon={<Zap className="w-5 h-5" />}>
          <p className="text-sm text-(--color-text-secondary) leading-relaxed">
            floq, algoritmayı gizlemez — istediğiniz sıralamayı kendiniz seçersiniz.{' '}
            <Link href="/flows" className="text-(--color-coral) hover:underline">Akışlar</Link> bölümünden her feed için
            ayrı kural oluşturabilirsiniz.
          </p>

          <div className="mt-6 space-y-4">
            <AlgoCard
              icon={<Clock className="w-4 h-4" />}
              name="Saf Kronolojik"
              tag="chronological"
              description="Sıfır algoritma. Gönderiler yalnızca oluşturulma zamanına göre sıralanır — en yeni en üstte."
              formula={null}
            />
            <AlgoCard
              icon={<Flame className="w-4 h-4" />}
              name="Ateşli (Hot)"
              tag="hot"
              description="Reddit benzeri zaman çürümeli skor. Etkileşim sayısını yaşa böler; eski postlar ne kadar viral olursa olsun yenilerin önüne geçemez."
              formula="(beğeni + boost×2 + yanıt×3 + 1) / (saat + 2)^1.5"
            />
            <AlgoCard
              icon={<TrendingUp className="w-4 h-4" />}
              name="Yükselen (Rising)"
              tag="rising"
              description="Son 6 saatte hızla ivme kazanan gönderileri öne çıkarır. Trend olmadan önce yakalamak için idealdir."
              formula="Yaşı 6 saati geçen gönderiler → 0 | Diğerleri: etkileşim / (saat + 0.5)^0.8"
            />
            <AlgoCard
              icon={<BarChart2 className="w-4 h-4" />}
              name="Günün En İyileri (Top Day)"
              tag="top_day"
              description="Son 24 saatin en fazla etkileşim alan gönderileri. Toplu tarama için idealdir."
              formula="beğeni + boost×2 + yanıt×3  (son 24 saat)"
            />
            <AlgoCard
              icon={<Shuffle className="w-4 h-4" />}
              name="Dengeli (Mixed)"
              tag="mixed"
              description="Hot score ile kronolojik tazelik bonusunun %60–%40 karışımı. Hem güncel hem ilgi çekici."
              formula="0.6 × hot_score + 0.4 × e^(−saat/12)"
            />
          </div>

          <InfoBox icon={<Layers className="w-4 h-4" />} title="Akışlar">
            <Link href="/flows" className="text-(--color-coral) hover:underline">Akışlar</Link> bölümünden birden fazla feed
            kuralı oluşturabilirsiniz. Her akışa farklı sıralama, kaynak (takip listesi, özel liste) ve yanıt filtresi atayın.
          </InfoBox>
        </Section>

        {/* Gizlilik */}
        <Section id="privacy" title="Gizlilik" icon={<Lock className="w-5 h-5" />}>
          <FeatureGrid>
            <Feature icon={<Shield className="w-4 h-4" />} title="Engelleme">
              Engellediğiniz kullanıcı sizi göremez, etkileşime giremez. <Link href="/settings" className="text-(--color-coral) hover:underline">Ayarlar → Moderasyon</Link>&apos;dan yönetin.
            </Feature>
            <Feature icon={<Eye className="w-4 h-4" />} title="Sessize alma">
              Sessize aldığınız kullanıcının gönderileri feed&apos;inizde görünmez ama o sizi görmeye devam edebilir.
            </Feature>
            <Feature icon={<List className="w-4 h-4" />} title="Kelime filtreleri">
              Belirli kelimeleri veya ifadeleri içeren gönderileri otomatik olarak gizleyin. <Link href="/settings" className="text-(--color-coral) hover:underline">Ayarlar → Filtreler</Link> bölümünden ekleyin.
            </Feature>
            <Feature icon={<Users className="w-4 h-4" />} title="Takipçi onayı">
              Profilinizi kilitleyerek takip isteklerini manuel olarak onaylayabilirsiniz.
            </Feature>
          </FeatureGrid>

          <div className="mt-6 p-4 rounded-xl border border-(--color-border) bg-(--color-background-secondary) space-y-2">
            <p className="text-xs font-semibold text-(--color-text-primary)">Veri taşınabilirliği</p>
            <p className="text-sm text-(--color-text-secondary) leading-relaxed">
              Hesabınızı ve tüm verilerinizi (gönderiler, takip listesi, medya) dışa aktarabilirsiniz.{' '}
              <Link href="/settings" className="text-(--color-coral) hover:underline">Ayarlar → Hesap → Veriyi İndir</Link>.
              ActivityPub uyumlu herhangi bir platforma taşıyabilirsiniz.
            </p>
          </div>
        </Section>

        {/* Federasyon */}
        <Section id="federation" title="Federasyon & AT Protocol" icon={<Globe className="w-5 h-5" />}>
          <p className="text-sm text-(--color-text-secondary) leading-relaxed">
            floq iki açık protokolü destekler: <strong>ActivityPub</strong> (Mastodon, Pixelfed, Pleroma ile uyumlu) ve
            yakında{' '}
            <strong>AT Protocol</strong> (Bluesky ile uyumlu).
          </p>

          <div className="mt-6 space-y-4">
            <div className="p-4 rounded-xl border border-(--color-border) space-y-2">
              <div className="flex items-center gap-2">
                <Globe className="w-4 h-4 text-(--color-coral)" />
                <p className="text-sm font-semibold text-(--color-text-primary)">ActivityPub</p>
              </div>
              <p className="text-sm text-(--color-text-secondary) leading-relaxed">
                Mastodon kullanıcıları sizi doğrudan <code>@kullanıcıadı@floq.com</code> formatıyla takip edebilir.
                Herkese açık gönderileriniz federe ağda görünür. Uzak kullanıcılara yanıt verebilir, onları boost
                yapabilirsiniz.
              </p>
            </div>

            <div className="p-4 rounded-xl border border-(--color-border) space-y-2">
              <div className="flex items-center gap-2">
                <Zap className="w-4 h-4 text-sky-500" />
                <p className="text-sm font-semibold text-(--color-text-primary)">AT Protocol (Bluesky)</p>
              </div>
              <p className="text-sm text-(--color-text-secondary) leading-relaxed">
                Bluesky&apos;dan floq profilinizi takip etmek için{' '}
                <Link href="/settings" className="text-(--color-coral) hover:underline">Ayarlar</Link>&apos;dan Bluesky
                handle&apos;ınızı bağlayın. Herkese açık keşfet feed&apos;iniz Bluesky&apos;dan da erişilebilir olur.
              </p>
            </div>
          </div>

          <InfoBox icon={<Shield className="w-4 h-4" />} title="Uzak içerik moderasyonu">
            Federe ağdan gelen gönderiler de engelleme ve sessize alma kurallarınıza tabidir. Uzak sunuculardaki
            davranışı kontrol edemeyiz; ancak platformumuzdaki deneyiminizi her zaman kendiniz şekillendirebilirsiniz.
          </InfoBox>
        </Section>

        {/* Klavye Kısayolları */}
        <Section id="shortcuts" title="Klavye Kısayolları" icon={<Keyboard className="w-5 h-5" />}>
          <p className="text-sm text-(--color-text-secondary) mb-6">
            Herhangi bir sayfada <Kbd>?</Kbd> tuşuna basarak bu listeyi görüntüleyebilirsiniz.
          </p>

          <div className="space-y-6">
            <ShortcutGroup title="Gezinme">
              <Shortcut keys={['g', 'h']} label="Ana Sayfa" />
              <Shortcut keys={['g', 'e']} label="Keşfet" />
              <Shortcut keys={['g', 'n']} label="Bildirimler" />
              <Shortcut keys={['g', 'b']} label="Yer İmleri" />
              <Shortcut keys={['g', 'p']} label="Profilim" />
              <Shortcut keys={['g', 's']} label="Ayarlar" />
            </ShortcutGroup>

            <ShortcutGroup title="Gönderi İşlemleri">
              <Shortcut keys={['n']} label="Yeni gönderi" />
              <Shortcut keys={['f']} label="Odaklanmış gönderiyi beğen" />
              <Shortcut keys={['r']} label="Yanıt ver" />
              <Shortcut keys={['t']} label="Boost yap" />
              <Shortcut keys={['b']} label="Yer imine ekle" />
              <Shortcut keys={['Enter']} label="Gönderi detayını aç" />
            </ShortcutGroup>

            <ShortcutGroup title="Sayfa">
              <Shortcut keys={['j']} label="Sonraki gönderi" />
              <Shortcut keys={['k']} label="Önceki gönderi" />
              <Shortcut keys={['.']} label="Yeni gönderileri yükle" />
              <Shortcut keys={['Esc']} label="Formu / modalı kapat" />
            </ShortcutGroup>
          </div>
        </Section>
      </main>
    </div>
    </div>
  )
}

function Section({ id, title, icon, children }: { id: string; title: string; icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <section id={id} className="scroll-mt-4 space-y-4">
      <div className="flex items-center gap-2.5 pb-2 border-b border-(--color-border)">
        <span className="text-(--color-coral)">{icon}</span>
        <h2 className="text-lg font-bold text-(--color-text-primary)" style={{ fontFamily: 'var(--font-outfit)' }}>
          {title}
        </h2>
      </div>
      {children}
    </section>
  )
}

function Steps({ children }: { children: React.ReactNode }) {
  return <ol className="mt-4 space-y-3">{children}</ol>
}

function Step({ number, title, children }: { number: number; title: string; children: React.ReactNode }) {
  return (
    <li className="flex gap-3">
      <span className="flex-shrink-0 w-6 h-6 rounded-full bg-(--color-coral) text-white text-xs font-bold flex items-center justify-center mt-0.5">
        {number}
      </span>
      <div>
        <p className="text-sm font-semibold text-(--color-text-primary)">{title}</p>
        <p className="text-sm text-(--color-text-secondary) mt-0.5 leading-relaxed">{children}</p>
      </div>
    </li>
  )
}

function FeatureGrid({ children }: { children: React.ReactNode }) {
  return <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-3">{children}</div>
}

function Feature({ icon, title, children }: { icon: React.ReactNode; title: string; children: React.ReactNode }) {
  return (
    <div className="p-4 rounded-xl border border-(--color-border) space-y-1.5">
      <div className="flex items-center gap-2 text-(--color-coral)">
        {icon}
        <p className="text-sm font-semibold text-(--color-text-primary)">{title}</p>
      </div>
      <p className="text-xs text-(--color-text-secondary) leading-relaxed">{children}</p>
    </div>
  )
}

function InfoBox({ icon, title, children }: { icon: React.ReactNode; title: string; children: React.ReactNode }) {
  return (
    <div className="mt-4 flex gap-3 p-4 rounded-xl bg-(--color-blush) dark:bg-(--color-coral)/10 border border-(--color-coral)/20">
      <span className="flex-shrink-0 mt-0.5 text-(--color-coral)">{icon}</span>
      <div>
        <p className="text-sm font-semibold text-(--color-coral)">{title}</p>
        <div className="text-sm text-(--color-text-secondary) mt-1 leading-relaxed">{children}</div>
      </div>
    </div>
  )
}

function AlgoCard({
  icon,
  name,
  tag,
  description,
  formula,
}: {
  icon: React.ReactNode
  name: string
  tag: string
  description: string
  formula: string | null
}) {
  return (
    <div className="p-4 rounded-xl border border-(--color-border) space-y-2">
      <div className="flex items-center gap-2">
        <span className="text-(--color-coral)">{icon}</span>
        <p className="text-sm font-semibold text-(--color-text-primary)">{name}</p>
        <span className="ml-auto text-xs px-2 py-0.5 rounded-full bg-(--color-background-secondary) text-(--color-text-tertiary) font-mono">
          {tag}
        </span>
      </div>
      <p className="text-sm text-(--color-text-secondary) leading-relaxed">{description}</p>
      {formula && (
        <p className="text-xs font-mono px-3 py-2 rounded-lg bg-(--color-background-secondary) text-(--color-text-secondary)">
          {formula}
        </p>
      )}
    </div>
  )
}

function ShortcutGroup({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="text-xs font-semibold text-(--color-text-tertiary) uppercase tracking-wider mb-2">{title}</p>
      <div className="space-y-1">{children}</div>
    </div>
  )
}

function Shortcut({ keys, label }: { keys: string[]; label: string }) {
  return (
    <div className="flex items-center justify-between py-1.5 px-3 rounded-lg hover:bg-(--color-background-secondary) transition-colors">
      <span className="text-sm text-(--color-text-secondary)">{label}</span>
      <div className="flex items-center gap-1">
        {keys.map((k, i) => (
          <span key={i} className="flex items-center gap-1">
            <Kbd>{k}</Kbd>
            {i < keys.length - 1 && <span className="text-xs text-(--color-text-tertiary)">sonra</span>}
          </span>
        ))}
      </div>
    </div>
  )
}

function Kbd({ children }: { children: React.ReactNode }) {
  return (
    <kbd className="inline-flex items-center justify-center min-w-[28px] h-6 px-1.5 rounded-md border border-(--color-border) bg-(--color-background-secondary) text-xs font-mono text-(--color-text-secondary) shadow-sm">
      {children}
    </kbd>
  )
}
