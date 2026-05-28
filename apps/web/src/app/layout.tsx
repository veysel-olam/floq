import type { Metadata, Viewport } from 'next'
import { Outfit, DM_Sans } from 'next/font/google'
import { ServiceWorkerRegister } from '@/components/service-worker-register'
import { ThemeProvider } from '@/components/theme-provider'
import { HapticsProvider } from '@/components/haptics-provider'
import { TooltipProvider } from '@/components/ui/tooltip'
import { Toaster } from 'sonner'
import './globals.css'

const outfit = Outfit({
  variable: '--font-outfit',
  subsets: ['latin'],
  weight: ['300', '400', '500', '600', '700'],
  preload: false,
})

const dmSans = DM_Sans({
  variable: '--font-dm-sans',
  subsets: ['latin'],
  weight: ['400', '500', '700'],
  preload: false,
})

export const metadata: Metadata = {
  title: {
    default: 'floq',
    template: '%s · floq',
  },
  description: 'Flow together, own your data.',
  metadataBase: new URL(process.env.NEXT_PUBLIC_APP_URL ?? 'https://floq.com'),
  applicationName: 'floq',
  manifest: '/manifest.json',
  icons: {
    icon: '/icons/icon.svg',
    apple: '/icons/icon.svg',
  },
  appleWebApp: {
    capable: true,
    title: 'floq',
    statusBarStyle: 'default',
  },
  formatDetection: { telephone: false },
  openGraph: {
    siteName: 'floq',
    type: 'website',
    title: 'floq — Flow together, own your data.',
    description: 'Federe, açık kaynak, kullanıcı özgürlüğü odaklı sosyal ağ.',
  },
  twitter: {
    card: 'summary',
    title: 'floq',
    description: 'Flow together, own your data.',
  },
}

export const viewport: Viewport = {
  themeColor: '#E8593C',
  colorScheme: 'light dark',
}

const restorePrefs = `try{var d=document.documentElement,ls=localStorage;var fs=ls.getItem('floq-font-size');if(fs&&fs!=='base'){var m={sm:'14px',lg:'18px'};if(m[fs])d.style.fontSize=m[fs];}var acc=ls.getItem('floq-accent');if(acc){var c=JSON.parse(acc),s=d.style;s.setProperty('--color-coral',c.main);s.setProperty('--color-coral-hover',c.hover);s.setProperty('--color-ember',c.hover);s.setProperty('--color-blush-light',c.blush);}var den=ls.getItem('floq-density');if(den)d.setAttribute('data-density',den);var ff=ls.getItem('floq-font-family');if(ff&&ff!=='system')d.setAttribute('data-font',ff);var bg=ls.getItem('floq-bg-tone');if(bg&&bg!=='warm')d.setAttribute('data-bg-tone',bg);d.setAttribute('data-post-style',ls.getItem('floq-post-style')||'card');if(ls.getItem('floq-reduce-motion')==='true')d.setAttribute('data-reduce-motion','');}catch(e){}`

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html
      lang="tr"
      className={`${outfit.variable} ${dmSans.variable} h-full`}
      suppressHydrationWarning
    >
      {/* Restores font size, accent color, and density from localStorage before first paint */}
      <head><script dangerouslySetInnerHTML={{ __html: restorePrefs }} /></head>
      <body className="min-h-full flex flex-col bg-(--color-background) text-(--color-text-primary) antialiased">
        <ThemeProvider>
          <HapticsProvider>
            <TooltipProvider>
              {children}
            </TooltipProvider>
          </HapticsProvider>
          <Toaster position="bottom-center" richColors closeButton theme="system" />
        </ThemeProvider>
        <ServiceWorkerRegister />
      </body>
    </html>
  )
}
