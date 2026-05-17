import type { MetadataRoute } from 'next'

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'floq',
    short_name: 'floq',
    description: 'Flow together, own your data.',
    start_url: '/home',
    display: 'standalone',
    orientation: 'portrait',
    background_color: '#FFFBF8',
    theme_color: '#E8593C',
    categories: ['social', 'news'],
    icons: [
      {
        src: '/icons/icon-192.png',
        sizes: '192x192',
        type: 'image/png',
        purpose: 'maskable',
      },
      {
        src: '/icons/icon-512.png',
        sizes: '512x512',
        type: 'image/png',
        purpose: 'any',
      },
    ],
    screenshots: [],
    shortcuts: [
      {
        name: 'Ana Sayfa',
        url: '/home',
        description: 'Takip ettiğin kişilerin gönderileri',
      },
      {
        name: 'Bildirimler',
        url: '/notifications',
        description: 'Yeni bildirimler',
      },
    ],
    share_target: {
      action: '/share',
      method: 'GET',
      params: {
        title: 'title',
        text: 'text',
        url: 'url',
      },
    },
  }
}
