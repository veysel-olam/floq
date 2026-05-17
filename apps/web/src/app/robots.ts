import type { MetadataRoute } from 'next'

export default function robots(): MetadataRoute.Robots {
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'https://floq.com'

  return {
    rules: [
      {
        userAgent: '*',
        allow: ['/', '/explore', '/hashtag/', '/login', '/register'],
        disallow: [
          '/home',
          '/notifications',
          '/dm',
          '/settings',
          '/bookmarks',
          '/lists',
          '/network',
          '/pulse',
          '/onboarding',
          '/api/',
        ],
      },
    ],
    sitemap: `${appUrl}/sitemap.xml`,
  }
}
