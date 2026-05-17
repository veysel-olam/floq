'use client'

import { useEffect, useState, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { useSession } from '@/lib/auth-client'
import { api, type Post, type Actor } from '@/lib/api'
import { PostComposer } from '@/components/posts/post-composer'
import { Loader2, Share2, ArrowLeft } from 'lucide-react'

function ShareContent() {
  const searchParams = useSearchParams()
  const router = useRouter()
  const { data: session, isPending } = useSession()
  const [initialContent, setInitialContent] = useState('')
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null)

  const handle = (session?.user as { handle?: string } | undefined)?.handle ?? ''
  const displayName = session?.user.name ?? ''

  useEffect(() => {
    if (!session && !isPending) { router.push('/login'); return }
  }, [session, isPending, router])

  useEffect(() => {
    const title = searchParams.get('title') ?? ''
    const text = searchParams.get('text') ?? ''
    const url = searchParams.get('url') ?? ''
    const parts: string[] = []
    if (text) parts.push(text)
    if (url && !text.includes(url)) parts.push(url)
    if (title && !parts.join(' ').includes(title)) parts.unshift(title)
    setInitialContent(parts.join('\n').trim())
  }, [searchParams])

  useEffect(() => {
    if (!handle) return
    api.actors.get(handle).then((p: Actor) => setAvatarUrl(p.avatarUrl ?? null)).catch(() => null)
  }, [handle])

  function handlePost(post: Post) { router.push(`/posts/${post.id}`) }

  if (isPending) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="w-6 h-6 animate-spin text-(--color-coral)" />
      </div>
    )
  }

  if (!session) return null

  return (
    <div className="max-w-xl mx-auto">
      <header className="sticky top-0 z-10 bg-(--color-background)/90 backdrop-blur-md border-b border-(--color-border) px-4 py-3.5">
        <div className="flex items-center gap-3">
          <Link href="/home" className="p-1.5 rounded-full hover:bg-(--color-background-secondary) transition-colors text-(--color-text-secondary)">
            <ArrowLeft className="w-5 h-5" />
          </Link>
          <Share2 className="w-4 h-4 text-(--color-coral)" />
          <h1 className="text-base font-bold text-(--color-text-primary)" style={{ fontFamily: 'var(--font-outfit)' }}>
            floq&apos;ta paylaş
          </h1>
        </div>
      </header>

      <div className="px-4 pt-4">
        <ShareComposer
          handle={handle}
          displayName={displayName}
          avatarUrl={avatarUrl}
          initialContent={initialContent}
          onPost={handlePost}
        />
      </div>
    </div>
  )
}

function ShareComposer({
  handle, displayName, avatarUrl, initialContent, onPost,
}: {
  handle: string
  displayName: string
  avatarUrl: string | null
  initialContent: string
  onPost: (post: Post) => void
}) {
  const [key, setKey] = useState(0)
  useEffect(() => { if (initialContent) setKey((k) => k + 1) }, [initialContent])

  if (!initialContent) {
    return <PostComposer handle={handle} displayName={displayName} avatarUrl={avatarUrl} onPost={onPost} />
  }

  return <ShareComposerWithContent key={key} handle={handle} displayName={displayName} avatarUrl={avatarUrl} initialContent={initialContent} onPost={onPost} />
}

function ShareComposerWithContent({
  handle, displayName, avatarUrl, initialContent, onPost,
}: {
  handle: string
  displayName: string
  avatarUrl: string | null
  initialContent: string
  onPost: (post: Post) => void
}) {
  useEffect(() => {
    const draftKey = 'floq:draft:home'
    const existing = (() => { try { return JSON.parse(localStorage.getItem(draftKey) ?? 'null') } catch { return null } })()
    if (!existing?.content) {
      localStorage.setItem(draftKey, JSON.stringify({ content: initialContent, cw: '' }))
    }
  }, [initialContent])

  return <PostComposer handle={handle} displayName={displayName} avatarUrl={avatarUrl} onPost={onPost} />
}

export default function SharePage() {
  return (
    <Suspense fallback={
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="w-6 h-6 animate-spin text-(--color-coral)" />
      </div>
    }>
      <ShareContent />
    </Suspense>
  )
}
