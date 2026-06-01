'use client'

import { useState, useEffect, useCallback } from 'react'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import {
  Home, Compass, Bell, Bookmark, List, Settings, LogOut,
  Layers, Activity, Radio, MessageSquare, Share2, FileEdit,
  ChevronDown, LayoutGrid, Users, Shield,
} from 'lucide-react'
import { FloqLogo } from '@/components/floq-logo'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { useSession, signOut } from '@/lib/auth-client'
import { api } from '@/lib/api'
import { useRealtime } from '@/hooks/use-realtime'
import { cn } from '@/lib/utils'

const primaryItems = [
  { href: '/home', icon: Home, label: 'Ana Sayfa' },
  { href: '/explore', icon: Compass, label: 'Keşfet' },
  { href: '/notifications', icon: Bell, label: 'Bildirimler' },
  { href: '/bookmarks', icon: Bookmark, label: 'Kaydedilenler' },
  { href: '/dm', icon: MessageSquare, label: 'Mesajlar' },
  { href: '/communities', icon: Users, label: 'Topluluklar' },
  { href: '/flows', icon: Layers, label: 'Akışlar' },
]

const secondaryItems = [
  { href: '/drafts', icon: FileEdit, label: 'Taslaklar' },
  { href: '/lists', icon: List, label: 'Listeler' },
  { href: '/halka', icon: Radio, label: 'Halka' },
  { href: '/pulse', icon: Activity, label: 'Pulse' },
  { href: '/network', icon: Share2, label: 'Ağ Haritası' },
  { href: '/settings', icon: Settings, label: 'Ayarlar' },
]

function NavItem({
  href, icon: Icon, label, badge, active,
}: {
  href: string; icon: React.ElementType; label: string; badge?: number; active: boolean
}) {
  const showBadge = !!badge && badge > 0
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Link
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
            <Icon className={cn('w-5 h-5 transition-all', active ? 'text-(--color-coral) stroke-[2.5]' : 'stroke-[1.75]')} />
            {showBadge && (
              <span className="lg:hidden absolute -top-1 -right-1 min-w-[16px] h-4 px-0.5 rounded-full bg-(--color-coral) text-white text-[10px] font-bold leading-4 text-center">
                {badge > 99 ? '99+' : badge}
              </span>
            )}
          </span>
          <span className="hidden lg:block" style={{ fontFamily: 'var(--font-outfit)' }}>{label}</span>
          {showBadge && (
            <span className="hidden lg:flex ml-auto min-w-[20px] h-5 px-1 rounded-full bg-(--color-coral) text-white text-[11px] font-bold items-center justify-center">
              {badge > 99 ? '99+' : badge}
            </span>
          )}
        </Link>
      </TooltipTrigger>
      <TooltipContent side="right" className="lg:hidden">{label}</TooltipContent>
    </Tooltip>
  )
}

export function Sidebar() {
  const pathname = usePathname()
  const router = useRouter()
  const { data: session } = useSession()
  const [unreadCount, setUnreadCount] = useState(0)
  const [unreadDm, setUnreadDm] = useState(0)

  const isOnSecondary = secondaryItems.some((i) => pathname.startsWith(i.href))
  const [moreOpen, setMoreOpen] = useState(isOnSecondary)

  useEffect(() => {
    if (isOnSecondary) setMoreOpen(true)
  }, [isOnSecondary])

  useEffect(() => {
    if (!session) return
    api.notifications.unreadCount().then((d) => setUnreadCount(d.count)).catch(() => {})
  }, [session])

  const onNotification = useCallback(() => setUnreadCount((n) => n + 1), [])
  const onDm = useCallback(() => setUnreadDm((n) => n + 1), [])
  useRealtime({ notification: onNotification, dm: onDm })

  useEffect(() => {
    if (pathname.startsWith('/notifications')) setUnreadCount(0)
    if (pathname.startsWith('/dm')) setUnreadDm(0)
  }, [pathname])

  useEffect(() => {
    document.title = unreadCount > 0 ? `(${unreadCount > 99 ? '99+' : unreadCount}) floq` : 'floq'
  }, [unreadCount])

  const handle = (session?.user as { handle?: string } | undefined)?.handle
  const name = session?.user.name ?? ''
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null)
  const [role, setRole] = useState<'user' | 'moderator' | 'admin' | null>(null)

  useEffect(() => {
    if (handle) api.actors.get(handle).then((a) => {
      setAvatarUrl(a.avatarUrl)
      setRole((a as { role?: 'user' | 'moderator' | 'admin' }).role ?? null)
    }).catch(() => {})
  }, [handle])

  const isStaff = role === 'moderator' || role === 'admin'

  const [mounted, setMounted] = useState(false)
  useEffect(() => { setMounted(true) }, [])

  const [appDomain, setAppDomain] = useState('flq.social')
  useEffect(() => { setAppDomain(window.location.hostname) }, [])

  async function handleSignOut() {
    await signOut()
    router.push('/login')
  }

  return (
    <aside className="fixed left-0 top-0 h-full w-16 lg:w-64 border-r border-(--color-border) bg-(--color-background) flex flex-col z-10">
      {/* Logo */}
      <div className="px-4 pt-5 pb-3 lg:px-5">
        <Link href="/home" aria-label="floq ana sayfa">
          <span className="hidden lg:flex"><FloqLogo size="sm" /></span>
          <span className="lg:hidden"><FloqLogo size="sm" iconOnly /></span>
        </Link>
      </div>

      {/* Nav */}
      <nav className="flex-1 px-2 lg:px-3 overflow-y-auto space-y-0.5">
        {/* Primary items */}
        {primaryItems.map(({ href, icon, label }) => (
          <NavItem
            key={href}
            href={href}
            icon={icon}
            label={label}
            active={pathname.startsWith(href)}
            badge={href === '/notifications' ? unreadCount : href === '/dm' ? unreadDm : undefined}
          />
        ))}

        {/* Separator */}
        <div className="my-2 mx-3 border-t border-(--color-border) hidden lg:block" />
        <div className="my-2 mx-auto w-5 border-t border-(--color-border) lg:hidden" />

        {/* Daha fazla toggle */}
        <Tooltip>
          <TooltipTrigger asChild>
            <button
              onClick={() => setMoreOpen((v) => !v)}
              className={cn(
                'w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all duration-150',
                moreOpen
                  ? 'text-(--color-text-primary)'
                  : 'text-(--color-text-secondary) hover:bg-(--color-background-secondary) hover:text-(--color-text-primary)',
              )}
              aria-label="Daha fazla"
            >
              <LayoutGrid className="w-5 h-5 flex-shrink-0 stroke-[1.75]" />
              <span className="hidden lg:block" style={{ fontFamily: 'var(--font-outfit)' }}>Daha fazla</span>
              <ChevronDown
                className={cn(
                  'hidden lg:block ml-auto w-4 h-4 text-(--color-text-tertiary) transition-transform duration-200',
                  moreOpen && 'rotate-180',
                )}
              />
            </button>
          </TooltipTrigger>
          <TooltipContent side="right" className="lg:hidden">Daha fazla</TooltipContent>
        </Tooltip>

        {/* Secondary items — animated */}
        <div
          className={cn(
            'overflow-hidden transition-all duration-200 ease-in-out',
            moreOpen ? 'max-h-96 opacity-100' : 'max-h-0 opacity-0',
          )}
        >
          <div className="space-y-0.5 pt-0.5">
            {secondaryItems.map(({ href, icon, label }) => (
              <NavItem
                key={href}
                href={href}
                icon={icon}
                label={label}
                active={pathname.startsWith(href)}
              />
            ))}
            {isStaff && (
              <NavItem
                href="/admin"
                icon={Shield}
                label="Yönetim Paneli"
                active={pathname.startsWith('/admin')}
              />
            )}
          </div>
        </div>
      </nav>

      {/* User profile */}
      {mounted && session && (
        <div className="p-2 lg:p-3 border-t border-(--color-border)">
          <div className="flex items-center gap-1">
            <Link
              href={handle ? `/${handle}` : '/'}
              className="flex-1 flex items-center gap-3 px-2 py-2 rounded-xl transition-colors hover:bg-(--color-background-secondary) min-w-0"
            >
              <div className="relative flex-shrink-0">
                <Avatar className="w-8 h-8">
                  <AvatarImage src={avatarUrl ?? undefined} alt={name} />
                  <AvatarFallback className="text-xs bg-(--color-coral)/20 text-(--color-coral)">
                    {name.slice(0, 2).toUpperCase()}
                  </AvatarFallback>
                </Avatar>
                <span className="absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full bg-emerald-500 border-2 border-(--color-background)" />
              </div>
              <div className="hidden lg:block text-left min-w-0">
                <p className="text-xs font-semibold text-(--color-text-primary) truncate leading-tight">{name}</p>
                <p className="text-[10px] text-(--color-text-tertiary) truncate leading-tight font-mono">
                  @{handle}@{appDomain}
                </p>
              </div>
            </Link>
            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  onClick={handleSignOut}
                  aria-label="Çıkış yap"
                  className="hidden lg:flex flex-shrink-0 p-2 rounded-lg text-(--color-text-tertiary) hover:text-red-500 hover:bg-red-500/10 transition-colors"
                >
                  <LogOut className="w-4 h-4" />
                </button>
              </TooltipTrigger>
              <TooltipContent side="top">Çıkış yap</TooltipContent>
            </Tooltip>
          </div>
        </div>
      )}
    </aside>
  )
}
