import type { Metadata } from 'next'

const API_URL = process.env['NEXT_PUBLIC_API_URL'] ?? 'http://localhost:3001'
const WEB_URL = process.env['NEXT_PUBLIC_APP_URL'] ?? 'http://localhost:3000'

async function fetchPost(id: string) {
  try {
    const res = await fetch(`${API_URL}/api/posts/${id}`, { next: { revalidate: 30 } })
    if (!res.ok) return null
    return res.json() as Promise<{
      id: string
      content: string
      sensitive: boolean
      contentWarning?: string | null
      author: {
        handle: string
        displayName?: string | null
        avatarUrl?: string | null
      }
      media?: Array<{ url: string; type: string; altText?: string | null }>
      createdAt: string
    }>
  } catch {
    return null
  }
}

export async function generateMetadata(
  { params }: { params: Promise<{ id: string }> },
): Promise<Metadata> {
  const { id } = await params
  const post = await fetchPost(id)

  if (!post) {
    return {
      title: 'Gönderi — floq',
      description: 'Bu gönderi bulunamadı.',
    }
  }

  const authorName = post.author.displayName ?? `@${post.author.handle}`
  const plainContent = post.content.replace(/<[^>]+>/g, '')
  const title = post.sensitive
    ? `${authorName} — İçerik uyarısı`
    : (plainContent.slice(0, 80) || `${authorName} gönderisi`)
  const description = post.sensitive
    ? post.contentWarning ?? 'Hassas içerik'
    : plainContent.slice(0, 160)

  const postUrl = `${WEB_URL}/${post.author.handle}/posts/${post.id}`
  const firstImage = post.media?.find((m) => m.type === 'image')

  return {
    title: `${title} — floq`,
    description,
    alternates: { canonical: postUrl },
    openGraph: {
      type: 'article',
      url: postUrl,
      title,
      description,
      siteName: 'floq',
      publishedTime: post.createdAt,
      authors: [`${WEB_URL}/${post.author.handle}`],
      images: firstImage && !post.sensitive
        ? [{ url: firstImage.url, alt: firstImage.altText ?? title }]
        : post.author.avatarUrl
          ? [{ url: post.author.avatarUrl, width: 400, height: 400, alt: authorName }]
          : [],
    },
    twitter: {
      card: firstImage && !post.sensitive ? 'summary_large_image' : 'summary',
      title,
      description,
      images: firstImage && !post.sensitive
        ? [firstImage.url]
        : post.author.avatarUrl
          ? [post.author.avatarUrl]
          : undefined,
    },
  }
}

export default function PostLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>
}
