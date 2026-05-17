'use client'

import { useState, useEffect, useCallback } from 'react'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { Home, Compass, Bell, Bookmark, List, Settings, LogOut, Layers, Activity, Radio, MessageSquare, Share2, Clock, FileEdit } from 'lucide-react'
import { FloqLogo } from '@/components/floq-logo'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { useSession, signOut } from '@/lib/auth-client'
import { api } from '@/lib/api'
import { useRealtime } from '@/hooks/use-realtime'
import { cn } from '@/lib/utils'

const navItems = [
  { href: '/home', icon: Home, label: 'Ana Sayfa' },
  { href: '/explore', icon: Compass, label: 'Keşfet' },
  { href: '/notifications', icon: Bell, label: 'Bildirimler' },
  { href: '/bookmarks', icon: Bookmark, label: 'Kaydedilenler' },
  { href: '/scheduled', icon: Clock, label: 'Zamanlanmış' },
  { href: '/drafts', icon: FileEdit, label: 'Taslaklar' },
  { href: '/dm', icon: MessageSquare, label: 'Mesajlar' },
  { href: '/lists', icon: List, label: 'Listeler' },
  { href: '/flows', icon: Layers, label: 'Akışlar' },
  { href: '/pulse', icon: Activity, label: 'Pulse' },
  { href: '/network', icon: Share2, label: 'Ağ Haritası' },
  { href: '/halka', icon: Radio, label: 'Halka' },
  { href: '/settings', icon: Settings, label: 'Ayarlar' },
]

export function Sidebar() {
  const pathname = usePathname()
  const router = useRouter()
  const { data: session } = useSession()
  const [unreadCount, setUnreadCount] = useState(0)

  useEffect(() => {
    if (!session) return
    api.notifications.unreadCount().then((d) => setUnreadCount(d.count)).catch(() => {})
  }, [session])

  const onNotification = useCallback(() => {
    setUnreadCount((n) => n + 1)
  }, [])

  useRealtime({ notification: onNotification })

  useEffect(() => {
    if (pathname.startsWith('/notifications')) setUnreadCount(0)
  }, [pathname])

  useEffect(() => {
    document.title = unreadCount > 0 ? `(${unreadCount > 99 ? '99+' : unreadCount}) floq` : 'floq'
  }, [unreadCount])

  const handle = (session?.user as { handle?: string } | undefined)?.handle
  const name = session?.user.name ?? ''
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null)

  useEffect(() => {
    if (handle) api.actors.get(handle).then((a) => setAvatarUrl(a.avatarUrl)).catch(() => {})
  }, [handle])

  const [mounted, setMounted] = useState(false)
  useEffect(() => { setMounted(true) }, [])

  const [appDomain, setAppDomain] = useState('floq.com')
  useEffect(() => { setAppDomain(window.location.hostname) }, [])

  async function handleSignOut() {
    await signOut()
    router.push('/login')
  }

  return (
    <aside className="fixed left-0 top-0 h-full w-16 lg:w-64 border-r border-(--color-border) bg-(--color-background) flex flex-col z-10">
      {/* Logo */}
      <div className="px-4 pt-5 pb-3 lg:px-5">
        <Link href="/home">
          <span className="hidden lg:block">
            <FloqLogo size="sm" />
          </span>
          <span className="lg:hidden flex justify-center">
            <FloqLogo size="sm" iconOnly />
          </span>
        </Link>
      </div>

      {/* Nav */}
      <nav className="flex-1 px-2 lg:px-3 space-y-0.5 overflow-y-auto">
        {navItems.map(({ href, icon: Icon, label }) => {
          const active = pathname.startsWith(href)
          const isNotifications = href === '/notifications'
          const showBadge = isNotifications && unreadCount > 0
          return (
            <Link
              key={href}
              href={href}
              aria-label={label}
              className={cn(
                'flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm transition-all duration-150',
                active
                  ? 'bg-(--color-coral)/10 text-(--color-coral) font-semibold'
                  : 'text-(--color-text-secondary) font-medium hover:bg-(--color-background-secondary) hover:text-(--color-text-primary)',
              )}
            >
              <span className="relative flex-shrink-0">
                <Icon
                  className={cn(
                    'w-5 h-5 transition-all',
                    active ? 'text-(--color-coral) stroke-[2.5]' : 'stroke-[1.75]',
                  )}
                />
                {showBadge && (
                  <span className="absolute -top-1 -right-1 min-w-[16px] h-4 px-0.5 rounded-full bg-(--color-coral) text-white text-[10px] font-bold leading-4 text-center">
                    {unreadCount > 99 ? '99+' : unreadCount}
                  </span>
                )}
              </span>
              <span className="hidden lg:block" style={{ fontFamily: 'var(--font-outfit)' }}>{label}</span>
              {showBadge && (
                <span className="hidden lg:flex ml-auto min-w-[20px] h-5 px-1 rounded-full bg-(--color-coral) text-white text-[11px] font-bold items-center justify-center">
                  {unreadCount > 99 ? '99+' : unreadCount}
                </span>
              )}
            </Link>
          )
        })}
      </nav>

      {/* User profile */}
      {mounted && session && (
        <div className="p-2 lg:p-3 border-t border-(--color-border)">
          <div className="flex items-center gap-1">
            <Link
              href={handle ? `/${handle}` : '/'}
              className="flex-1 flex items-center gap-3 px-2 py-2 rounded-xl transition-colors hover:bg-(--color-background-secondary) min-w-0 group"
            >
              <div className="relative flex-shrink-0">
                <Avatar className="w-8 h-8">
                  <AvatarImage src={avatarUrl ?? undefined} alt={name} />
                  <AvatarFallback className="text-xs bg-(--color-coral)/20 text-(--color-coral)">
                    {name.slice(0, 2).toUpperCase()}
                  </AvatarFallback>
                </Avatar>
                <span
                  className="absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full bg-emerald-500 border-2 border-(--color-background)"
                  title="Bağlı"
                />
              </div>
              <div className="hidden lg:block text-left min-w-0">
                <p className="text-xs font-semibold text-(--color-text-primary) truncate leading-tight">{name}</p>
                <p className="text-[10px] text-(--color-text-tertiary) truncate leading-tight font-mono">
                  @{handle}@{appDomain}
                </p>
              </div>
            </Link>
            <button
              onClick={handleSignOut}
              aria-label="Çıkış yap"
              className="hidden lg:flex flex-shrink-0 p-2 rounded-lg text-(--color-text-tertiary) hover:text-red-500 hover:bg-red-500/10 transition-colors"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}
    </aside>
  )
}
