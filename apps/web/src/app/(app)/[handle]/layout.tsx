import type { Metadata } from 'next'

const API_URL = process.env['NEXT_PUBLIC_API_URL'] ?? 'http://localhost:3001'
const WEB_URL = process.env['NEXT_PUBLIC_APP_URL'] ?? 'http://localhost:3000'

async function fetchActor(handle: string) {
  try {
    const res = await fetch(`${API_URL}/api/actors/${handle}`, { next: { revalidate: 60 } })
    if (!res.ok) return null
    return res.json() as Promise<{
      handle: string
      displayName?: string | null
      bio?: string | null
      avatarUrl?: string | null
      followersCount: number
      postsCount: number
    }>
  } catch {
    return null
  }
}

export async function generateMetadata(
  { params }: { params: Promise<{ handle: string }> },
): Promise<Metadata> {
  const { handle } = await params
  const actor = await fetchActor(handle)

  if (!actor) {
    return {
      title: `@${handle} — floq`,
      description: 'Bu hesap bulunamadı.',
    }
  }

  const name = actor.displayName ?? `@${actor.handle}`
  const description = actor.bio
    ? actor.bio.replace(/<[^>]+>/g, '').slice(0, 160)
    : `${actor.followersCount} takipçi · ${actor.postsCount} gönderi`

  const profileUrl = `${WEB_URL}/${actor.handle}`
  const images = actor.avatarUrl ? [{ url: actor.avatarUrl, width: 400, height: 400, alt: name }] : []

  return {
    title: `${name} (@${actor.handle}) — floq`,
    description,
    alternates: {
      canonical: profileUrl,
      types: {
        'application/rss+xml': `${API_URL}/${actor.handle}/rss`,
      },
    },
    openGraph: {
      type: 'profile',
      url: profileUrl,
      title: `${name} (@${actor.handle})`,
      description,
      siteName: 'floq',
      images,
      username: actor.handle,
    },
    twitter: {
      card: actor.avatarUrl ? 'summary' : 'summary',
      title: `${name} (@${actor.handle})`,
      description,
      images: actor.avatarUrl ? [actor.avatarUrl] : undefined,
    },
  }
}

export default function HandleLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>
}
