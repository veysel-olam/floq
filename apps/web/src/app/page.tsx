'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { FloqLogo } from '@/components/floq-logo'
import { PostCard } from '@/components/posts/post-card'
import { Input } from '@/components/ui/input'
import { TooltipProvider } from '@/components/ui/tooltip'
import { api, type Post } from '@/lib/api'
import { Search, TrendingUp, Hash, Loader2, Check } from 'lucide-react'

const API_URL = process.env['NEXT_PUBLIC_API_URL'] ?? 'http://localhost:3001'

/* ── Types ── */
interface NodeInfo {
  usage: { users: { total: number }; localPosts: number }
}

/* ── Mock post builder (fallback while API loads) ── */
// Fixed reference avoids SSR/client hydration mismatch on relative timestamps
const MOCK_BASE = new Date('2026-05-27T12:00:00Z').getTime()

function mockPost(
  id: string, handle: string, displayName: string, isLocal: boolean,
  content: string, likesCount: number, boostsCount: number, repliesCount: number,
  minsAgo: number, extra?: Partial<Post>,
): Post {
  return {
    id, apId: '', content, contentWarning: null,
    visibility: 'public', sensitive: false,
    likesCount, boostsCount, repliesCount,
    quotesCount: 0, viewCount: 0,
    replyToId: null, quotedPostId: null,
    replyToAuthor: null, replyTo: null, quotedPost: null,
    poll: null, linkPreview: null, tags: [],
    createdAt: new Date(MOCK_BASE - minsAgo * 60 * 1000).toISOString(),
    editedAt: null,
    author: {
      id: `mock-${id}`, handle, displayName, bio: null,
      avatarUrl: null, headerUrl: null,
      followersCount: 0, followingCount: 0, postsCount: 0, likesCount: 0,
      isLocal, isLocked: false, location: null, website: null,
      blueskyHandle: null, customHandle: null, customHandleVerifiedAt: null,
      movedToUri: null, pinnedPostId: null,
      createdAt: new Date().toISOString(),
    },
    media: [], reactions: {},
    ...extra,
  }
}

const FALLBACK_POSTS: Post[] = [
  mockPost('m1', 'zeynep', 'Zeynep K.', true,
    "İki yıl önce Twitter'dan ayrıldım, bugün floq'a geçtim. Kronolojik akış o kadar rahatlatıcı ki — hangi gönderinin \"öne çıkarıldığını\" merak etmiyorsun artık.",
    187, 34, 12, 2),
  mockPost('m2', 'mert_dev', 'Mert Aydın', false,
    "Mastodon hesabımdan floq'taki herkesi tek tıkla takip edebildim. ActivityPub gerçekten sihir gibi çalışıyor. Platform değişse de bağlantılar kalıyor.",
    94, 21, 8, 14,
    { linkPreview: { url: 'https://fediverse.info', title: "ActivityPub Nedir? Fediverse'e Giriş", description: null, image: null, siteName: 'fediverse.info' } }),
  mockPost('m3', 'elif', 'Elif Şahin', true,
    "Verilerimi dışa aktardım, yedekledim, başka bir sunucuya taşıdım. Hiçbir şey kaybolmadı. Takipçilerim hâlâ orada.\n\nPlatform bağımlılığının son bulması bu demek.",
    312, 67, 23, 31),
  mockPost('m4', 'selin', 'Selin Yıldız', false,
    'Reklamsız bir gün geçirmek bu kadar güzel hissettirirmiş. Akış açıyorum, görmek istediğim insanlar var — başka bir şey değil.',
    228, 43, 17, 60),
  mockPost('m5', 'burak', 'Burak T.', true,
    'Açık kaynak bir sosyal medya platformunun kod tabanına bakabilmek çok farklı bir his. Neyin nasıl çalıştığını görebiliyorsun, güvenmek zorunda kalmıyorsun.',
    405, 88, 31, 120,
    { linkPreview: { url: 'https://github.com', title: 'floq / floq.com — GitHub', description: null, image: null, siteName: 'github.com' } }),
  mockPost('m6', 'can', 'Can Arslan', true, 'floq dark mode mükemmel 🌙', 71, 9, 4, 58),
]

/* ─────────────────────────────────────────────────────────── */

/* ── Left sidebar — server info ── */
function ServerInfoSidebar() {
  const [userCount, setUserCount] = useState<number | null>(null)
  const [postCount, setPostCount] = useState<number | null>(null)

  useEffect(() => {
    fetch(`${API_URL}/nodeinfo/2.1`)
      .then(r => r.json() as Promise<NodeInfo>)
      .then(d => {
        setUserCount(d.usage.users.total)
        setPostCount(d.usage.localPosts)
      })
      .catch(() => {})
  }, [])

  function fmt(n: number) {
    if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`
    if (n >= 1_000) return `${(n / 1_000).toFixed(1)}B`
    return n.toString()
  }

  const DIFFERENTIATORS = [
    { text: 'Algoritma yok' },
    { text: 'Reklam yok' },
    { text: 'Açık kaynak ve federe', sub: 'Mastodon, Bluesky ile bağlantılı' },
    { text: 'Veriler sana ait' },
  ]

  return (
    <aside className="hidden lg:flex flex-col sticky top-0 h-screen w-[280px] xl:w-[300px] flex-shrink-0 border-r border-(--color-border-secondary) px-6 py-6 gap-5 overflow-y-auto scrollbar-none">
      <FloqLogo size="md" beta />

      {/* Tagline */}
      <p className="text-base font-semibold text-(--color-text-primary) leading-snug" style={{ fontFamily: 'var(--font-outfit)' }}>
        Sosyal medya, senin kurallarınla.
      </p>

      {/* Beta note */}
      <p className="-mt-3 text-xs text-(--color-text-tertiary) leading-relaxed">
        floq erken aşamada bir projedir; özellikler ve veriler zamanla değişebilir.
      </p>

      {/* Differentiators */}
      <ul className="flex flex-col gap-2.5">
        {DIFFERENTIATORS.map((d) => (
          <li key={d.text} className="flex items-start gap-2">
            <Check className="w-4 h-4 text-(--color-coral) flex-shrink-0 mt-0.5" />
            <span className="text-sm text-(--color-text-secondary)">
              {d.text}
              {d.sub && <span className="text-(--color-text-tertiary)"> — {d.sub}</span>}
            </span>
          </li>
        ))}
      </ul>

      {/* CTAs */}
      <div className="flex flex-col gap-3">
        <Link
          href="/login"
          className="flex items-center justify-center px-5 py-2.5 rounded-full font-semibold text-white text-sm bg-(--color-coral) hover:bg-(--color-coral-hover) transition-colors active:scale-[0.97]"
        >
          Giriş yap
        </Link>
        <p className="text-sm text-(--color-text-tertiary) text-center">
          Hesabın yok mu?{' '}
          <Link href="/register" className="font-medium text-(--color-coral) hover:underline underline-offset-2 transition-colors">
            Hesap oluştur
          </Link>
        </p>
      </div>

      {/* Stats + footer in one card */}
      <div className="rounded-2xl border border-(--color-border) overflow-hidden">
        <div className="divide-y divide-(--color-border)">
          <div className="flex items-center justify-between px-4 py-3">
            <p className="text-sm text-(--color-text-tertiary)">Kullanıcılar</p>
            <p className="text-sm font-semibold text-(--color-text-primary) tabular-nums">
              {userCount !== null ? fmt(userCount) : '—'}
            </p>
          </div>
          <div className="flex items-center justify-between px-4 py-3">
            <p className="text-sm text-(--color-text-tertiary)">Gönderiler</p>
            <p className="text-sm font-semibold text-(--color-text-primary) tabular-nums">
              {postCount !== null ? fmt(postCount) : '—'}
            </p>
          </div>
          <div className="flex items-center justify-between px-4 py-3">
            <p className="text-sm text-(--color-text-tertiary)">Kayıt</p>
            <span className="inline-flex items-center gap-1.5 text-xs font-semibold px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />Açık
            </span>
          </div>
        </div>
        <div className="px-4 py-3 border-t border-(--color-border) bg-(--color-background-secondary) flex flex-wrap gap-x-3 gap-y-1.5">
          {['Hakkında', 'Kurallar', 'Gizlilik', 'Kaynak kod', 'API', '© 2026 floq'].map(l => (
            <span key={l} className="text-[11px] text-(--color-text-tertiary) hover:text-(--color-text-secondary) cursor-pointer transition-colors">
              {l}
            </span>
          ))}
        </div>
      </div>

    </aside>
  )
}

/* ── Right sidebar — search + trending ── */
function RightSidebar() {
  const router = useRouter()
  const [query, setQuery] = useState('')
  const [tags, setTags] = useState<{ tag: string; count: number }[]>([])
  const [tagsLoading, setTagsLoading] = useState(true)

  useEffect(() => {
    api.search.trendingTags()
      .then(d => setTags(d.tags.slice(0, 8)))
      .catch(() => {})
      .finally(() => setTagsLoading(false))
  }, [])

  function handleSearch(e: React.FormEvent) {
    e.preventDefault()
    const q = query.trim()
    if (q) router.push(`/explore?q=${encodeURIComponent(q)}`)
  }

  return (
    <aside className="hidden xl:flex flex-col w-[300px] xl:w-[320px] flex-shrink-0 sticky top-0 h-screen overflow-y-auto pt-[53px] px-4 gap-3 scrollbar-none">

      {/* Search — identical to RightPanel */}
      <form onSubmit={handleSearch} className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-(--color-text-tertiary) pointer-events-none" />
        <Input
          value={query}
          onChange={e => setQuery(e.target.value)}
          placeholder="floq'ta ara…"
          className="pl-9 rounded-full bg-(--color-background-secondary) border-0 focus-visible:ring-1 focus-visible:ring-(--color-coral)"
        />
      </form>

      {/* Trending — identical to RightPanel's TrendingSection */}
      {tagsLoading ? (
        <div className="flex justify-center py-4">
          <Loader2 className="w-4 h-4 animate-spin text-(--color-text-tertiary)" />
        </div>
      ) : tags.length > 0 && (
        <section className="rounded-2xl border border-(--color-border) bg-(--color-background-secondary) overflow-hidden">
          <div className="px-4 py-3 border-b border-(--color-border)">
            <div className="flex items-center gap-2">
              <TrendingUp className="w-4 h-4 text-(--color-coral)" />
              <h2 className="text-sm font-semibold text-(--color-text-primary)" style={{ fontFamily: 'var(--font-outfit)' }}>
                Gündem
              </h2>
            </div>
          </div>
          <div className="divide-y divide-(--color-border)">
            {tags.map(({ tag, count }, i) => (
              <Link
                key={tag}
                href={`/hashtag/${encodeURIComponent(tag)}`}
                className="flex items-center gap-3 px-4 py-2.5 hover:bg-(--color-background) transition-colors group"
              >
                <span className="w-5 text-[11px] font-bold text-(--color-text-tertiary) tabular-nums flex-shrink-0 text-right">
                  {i + 1}
                </span>
                <div className="flex items-center gap-1.5 flex-1 min-w-0">
                  <Hash className="w-3 h-3 text-(--color-text-tertiary) flex-shrink-0" />
                  <span className="text-sm font-medium text-(--color-text-primary) group-hover:text-(--color-coral) transition-colors truncate">
                    {tag}
                  </span>
                </div>
                <span className="text-[11px] text-(--color-text-tertiary) flex-shrink-0 tabular-nums">
                  {count >= 1000 ? `${(count / 1000).toFixed(1)}K` : count}
                </span>
              </Link>
            ))}
          </div>
        </section>
      )}

    </aside>
  )
}

/* ─────────────────────────────────────────────────────────── */
export default function Page() {
  const [posts, setPosts] = useState<Post[]>(FALLBACK_POSTS)

  useEffect(() => {
    // Show real posts whenever any exist; mock posts are only a last-resort
    // fallback for a brand-new instance with zero posts.
    api.timeline.explore()
      .then(data => { if (data.posts.length >= 1) setPosts(data.posts.slice(0, 8)) })
      .catch(() => {})
  }, [])

  return (
    <TooltipProvider>
    <div className="min-h-screen bg-(--color-background) text-(--color-text-primary)">
      <div className="max-w-[1280px] mx-auto flex min-h-screen">

        <ServerInfoSidebar />

        {/* ── Main feed ── */}
        <main className="flex-1 min-w-0 lg:border-r border-(--color-border-secondary)">

          {/* Mobile sticky header — hidden on desktop */}
          <div className="lg:hidden sticky top-0 z-20 bg-(--color-background)/95 backdrop-blur-sm border-b border-(--color-border-secondary) px-4 py-3 flex items-center justify-between">
            <FloqLogo size="sm" beta />
            <div className="flex gap-2">
              <Link href="/login" className="px-4 py-1.5 rounded-full text-sm font-medium border border-(--color-border) text-(--color-text-secondary) hover:bg-(--color-background-secondary) transition-colors">
                Giriş
              </Link>
              <Link href="/register" className="px-4 py-1.5 rounded-full text-sm font-semibold text-white transition-colors" style={{ background: '#E8593C' }}>
                Katıl
              </Link>
            </div>
          </div>

          {/* Feed header — desktop only, mobile header already covers it */}
          <div className="hidden lg:block border-b border-(--color-border-secondary) sticky top-0 z-10 bg-(--color-background)/95 backdrop-blur-sm px-4 py-3.5">
            <h2 className="text-sm font-semibold text-(--color-text-secondary)" style={{ fontFamily: 'var(--font-outfit)' }}>Keşfet</h2>
          </div>

          {/* Posts — pb-28 so last card clears the sticky bottom fade */}
          <div className="max-w-xl mx-auto pb-28">
            {posts.map(post => (
              <PostCard key={post.id} post={post} />
            ))}
          </div>

          {/* Bottom fade — desktop only, mobile header handles navigation */}
          <div className="hidden lg:block sticky bottom-0">
            <div className="h-20 bg-gradient-to-t from-(--color-background) to-transparent pointer-events-none" />
            <div className="bg-(--color-background) pb-5 flex justify-center">
              <Link
                href="/register"
                className="text-sm text-(--color-text-tertiary) hover:text-(--color-coral) transition-colors flex items-center gap-1"
              >
                Devamını görmek için katıl →
              </Link>
            </div>
          </div>
        </main>

        <RightSidebar />

      </div>
    </div>
    </TooltipProvider>
  )
}
