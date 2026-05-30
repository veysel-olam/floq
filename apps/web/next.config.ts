import type { NextConfig } from 'next'
import { withSentryConfig } from '@sentry/nextjs'

const apiUrl = process.env.NEXT_PUBLIC_API_URL ?? 'https://api.floq.com'

const isProd = process.env.NODE_ENV === 'production'

const securityHeaders = [
  {
    key: 'X-DNS-Prefetch-Control',
    value: 'on',
  },
  ...(isProd ? [{
    key: 'Strict-Transport-Security',
    value: 'max-age=63072000; includeSubDomains; preload',
  }] : []),
  {
    key: 'X-Content-Type-Options',
    value: 'nosniff',
  },
  {
    key: 'X-Frame-Options',
    value: 'SAMEORIGIN',
  },
  {
    key: 'X-XSS-Protection',
    value: '1; mode=block',
  },
  {
    key: 'Referrer-Policy',
    value: 'strict-origin-when-cross-origin',
  },
  {
    key: 'Permissions-Policy',
    value: 'camera=(), microphone=(), geolocation=(), payment=()',
  },
  {
    key: 'Content-Security-Policy',
    value: [
      "default-src 'self'",
      "script-src 'self' 'unsafe-eval' 'unsafe-inline'",
      "style-src 'self' 'unsafe-inline'",
      `img-src 'self' data: blob: https:`,
      "font-src 'self'",
      `connect-src 'self' ${apiUrl} ${apiUrl.replace('https://', 'wss://')} ${apiUrl.replace('http://', 'ws://')}`,
      "media-src 'self' https: blob:",
      "worker-src 'self' blob:",
      // Trusted embed providers (video / music / map). Without these the iframes
      // are blocked in production.
      [
        'frame-src',
        'https://www.youtube.com',
        'https://www.youtube-nocookie.com',
        'https://player.vimeo.com',
        'https://www.tiktok.com',
        'https://player.twitch.tv',
        'https://clips.twitch.tv',
        'https://open.spotify.com',
        'https://embed.music.apple.com',
        'https://widget.deezer.com',
        'https://w.soundcloud.com',
        'https://bandcamp.com',
        'https://www.openstreetmap.org',
      ].join(' '),
      "object-src 'none'",
      "base-uri 'self'",
      "form-action 'self'",
      "upgrade-insecure-requests",
    ].join('; '),
  },
]

const nextConfig: NextConfig = {
  ...(process.env.BUILD_STANDALONE === 'true' && { output: 'standalone' as const }),
  poweredByHeader: false,
  // Type checking runs in CI (typecheck job). The production build shouldn't fail
  // on third-party type friction (recharts tooltip generics).
  typescript: { ignoreBuildErrors: true },
  transpilePackages: ['@floq/ui', '@floq/types', '@floq/config'],
  images: {
    remotePatterns: [
      { protocol: 'https', hostname: '**' },
      { protocol: 'http', hostname: 'localhost' },
    ],
  },
  experimental: {
    optimizePackageImports: ['lucide-react'],
  },
  turbopack: {},
  async headers() {
    if (!isProd) return []
    return [
      {
        source: '/(.*)',
        headers: securityHeaders,
      },
    ]
  },
}

export default process.env.NEXT_PUBLIC_SENTRY_DSN || process.env.SENTRY_DSN
  ? withSentryConfig(nextConfig, {
      ...(process.env.SENTRY_ORG && { org: process.env.SENTRY_ORG }),
      ...(process.env.SENTRY_PROJECT && { project: process.env.SENTRY_PROJECT }),
      silent: !process.env.CI,
      widenClientFileUpload: true,
      sourcemaps: { disable: true },
      disableLogger: true,
      automaticVercelMonitors: false,
    })
  : nextConfig
