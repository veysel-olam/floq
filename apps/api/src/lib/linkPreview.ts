export interface LinkPreview {
  url: string
  title: string | null
  description: string | null
  image: string | null
  siteName: string | null
  // Music-specific fields (present when URL is from a music platform)
  musicPlatform?: string        // 'spotify' | 'youtube' | 'applemusic' | 'deezer' | 'soundcloud' | 'tidal'
  musicType?: string            // 'track' | 'album' | 'playlist'
  musicEmbedUrl?: string        // iframe src
  musicArtist?: string          // parsed from OGP/title
  musicTrack?: string           // parsed track name
}

const URL_RE = /https?:\/\/[^\s<>"{}|\\^`[\]]+/

function decodeHtmlEntities(str: string): string {
  return str
    .replace(/&#x([0-9a-fA-F]+);/g, (_, hex) => String.fromCharCode(parseInt(hex, 16)))
    .replace(/&#(\d+);/g, (_, dec) => String.fromCharCode(Number(dec)))
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
}

export function extractFirstUrl(text: string): string | null {
  const m = text.match(URL_RE)
  if (!m) return null
  return m[0].replace(/[.,!?)]+$/, '')
}

function getMeta(html: string, property: string): string | null {
  const re = new RegExp(
    `<meta[^>]+(?:property|name)=["']${property}["'][^>]+content=["']([^"']+)["']` +
    `|<meta[^>]+content=["']([^"']+)["'][^>]+(?:property|name)=["']${property}["']`,
    'i',
  )
  const m = html.match(re)
  if (!m) return null
  return (m[1] ?? m[2] ?? '').trim() || null
}

function getTitle(html: string): string | null {
  const m = html.match(/<title[^>]*>([^<]{1,300})<\/title>/i)
  return m?.[1]?.trim() ?? null
}

// ─── Music platform detection ─────────────────────────────────────────────────

interface MusicMeta {
  platform: string
  type: string
  embedUrl: string | null
}

function detectMusicPlatform(url: URL): MusicMeta | null {
  const host = url.hostname.replace(/^www\./, '')
  const path = url.pathname

  // Spotify: open.spotify.com/track|album|playlist/ID
  if (host === 'open.spotify.com' || host === 'spotify.com') {
    const m = path.match(/^\/(track|album|playlist|episode)\/([A-Za-z0-9]+)/)
    if (m) {
      const [, type, id] = m
      return {
        platform: 'spotify',
        type: type === 'episode' ? 'track' : (type ?? 'track'),
        embedUrl: `https://open.spotify.com/embed/${type}/${id}?utm_source=generator&theme=0`,
      }
    }
  }

  // YouTube / YT Music: youtube.com/watch?v=ID or youtu.be/ID
  if (host === 'youtube.com' || host === 'youtu.be' || host === 'music.youtube.com') {
    let videoId: string | null = null
    if (host === 'youtu.be') {
      videoId = path.slice(1).split('?')[0] ?? null
    } else {
      videoId = url.searchParams.get('v')
    }
    if (videoId) {
      return {
        platform: host === 'music.youtube.com' ? 'ytmusic' : 'youtube',
        type: 'track',
        embedUrl: `https://www.youtube.com/embed/${videoId}?rel=0`,
      }
    }
  }

  // Apple Music: music.apple.com/{locale}/album/{name}/{id}?i={songId}
  if (host === 'music.apple.com') {
    const songId = url.searchParams.get('i')
    const m = path.match(/^\/([a-z]{2})\/album\/[^/]+\/(\d+)/)
    if (m) {
      const [, locale, albumId] = m
      const embedPath = songId
        ? `/${locale}/album/${albumId}?i=${songId}`
        : `/${locale}/album/${albumId}`
      return {
        platform: 'applemusic',
        type: songId ? 'track' : 'album',
        embedUrl: `https://embed.music.apple.com${embedPath}`,
      }
    }
  }

  // Deezer: deezer.com/track|album|playlist/ID
  if (host === 'deezer.com' || host === 'www.deezer.com') {
    const m = path.match(/^\/(track|album|playlist)\/(\d+)/)
    if (m) {
      const [, type, id] = m
      return {
        platform: 'deezer',
        type: type ?? 'track',
        embedUrl: `https://widget.deezer.com/widget/dark/${type}/${id}`,
      }
    }
  }

  // SoundCloud: soundcloud.com/artist/track
  if (host === 'soundcloud.com') {
    const parts = path.split('/').filter(Boolean)
    if (parts.length >= 2) {
      return {
        platform: 'soundcloud',
        type: 'track',
        embedUrl: `https://w.soundcloud.com/player/?url=${encodeURIComponent(url.href)}&color=%23E8593C&auto_play=false&hide_related=true&show_comments=false&show_user=true`,
      }
    }
  }

  // Tidal: tidal.com/browse/track|album/ID
  if (host === 'tidal.com' || host === 'listen.tidal.com') {
    const m = path.match(/\/(track|album|playlist)\/(\d+)/)
    if (m) {
      return {
        platform: 'tidal',
        type: m[1] ?? 'track',
        embedUrl: null, // Tidal has no public embed
      }
    }
  }

  return null
}

// Parse artist/track from OGP data per platform
function parseMusicNames(
  platform: string,
  title: string | null,
  description: string | null,
  html: string,
): { artist: string | null; track: string | null } {
  // Try OGP music extension tags first
  const ogArtist = getMeta(html, 'music:musician') ?? getMeta(html, 'og:music:musician')
  const ogTrack = getMeta(html, 'music:song') ?? getMeta(html, 'music:title')

  if (ogArtist || ogTrack) {
    return { artist: ogArtist, track: ogTrack ?? title }
  }

  if (!title) return { artist: null, track: null }

  // Spotify: title = "Track Name", description = "Song · Artist · Album on Spotify"
  if (platform === 'spotify') {
    if (description) {
      // "Song · Artist Name · Album" or "Listen to Track on Spotify."
      const m = description.match(/^(.+?)\s[·•]\s(.+?)\s[·•]/)
      if (m) return { track: m[1] ?? null, artist: m[2] ?? null }
      // Fallback: "Listen to X by Y on Spotify"
      const m2 = description.match(/Listen to (.+?) by (.+?) on Spotify/i)
      if (m2) return { track: m2[1] ?? null, artist: m2[2] ?? null }
    }
    return { track: title, artist: null }
  }

  // Apple Music: title = "Track Name - Single - Artist" or "Album - Artist"
  if (platform === 'applemusic') {
    const parts = title.split(' - ')
    if (parts.length >= 2) {
      return {
        track: parts[0]?.trim() ?? null,
        artist: parts[parts.length - 1]?.trim() ?? null,
      }
    }
  }

  // YouTube: title = "Track Name - Artist - Topic" or "Artist - Track Name (Official)"
  if (platform === 'youtube' || platform === 'ytmusic') {
    const m = title.match(/^(.+?)\s[-–]\s(.+?)(?:\s[-–]|$)/)
    if (m) return { track: m[1]?.trim() ?? null, artist: m[2]?.trim() ?? null }
  }

  // Deezer: title = "Track Name - Artist Name"
  if (platform === 'deezer') {
    const parts = title.split(' - ')
    if (parts.length >= 2) {
      return { track: parts[0]?.trim() ?? null, artist: parts.slice(1).join(' - ').trim() || null }
    }
  }

  return { track: title, artist: null }
}

export async function fetchLinkPreview(rawUrl: string): Promise<LinkPreview | null> {
  let url: URL
  try {
    url = new URL(rawUrl)
  } catch {
    return null
  }
  if (!['http:', 'https:'].includes(url.protocol)) return null

  const musicMeta = detectMusicPlatform(url)

  try {
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), 6000)
    const res = await fetch(url.href, {
      signal: controller.signal,
      headers: {
        'User-Agent': 'floq-preview-bot/1.0 (+https://floq.com)',
        Accept: 'text/html',
      },
      redirect: 'follow',
    })
    clearTimeout(timer)

    if (!res.ok) return null
    const ct = res.headers.get('content-type') ?? ''
    if (!ct.includes('text/html')) return null

    const reader = res.body?.getReader()
    if (!reader) return null
    const chunks: Uint8Array[] = []
    let total = 0
    while (total < 65_536) {
      const { done, value } = await reader.read()
      if (done || !value) break
      chunks.push(value)
      total += value.byteLength
    }
    reader.cancel().catch(() => {})
    const html = new TextDecoder().decode(
      chunks.reduce((a, b) => { const c = new Uint8Array(a.length + b.length); c.set(a); c.set(b, a.length); return c }, new Uint8Array()),
    )

    const image = getMeta(html, 'og:image') ?? getMeta(html, 'twitter:image')
    const rawTitle = getMeta(html, 'og:title') ?? getMeta(html, 'twitter:title') ?? getTitle(html)
    const rawDesc = getMeta(html, 'og:description') ?? getMeta(html, 'description') ?? getMeta(html, 'twitter:description')
    const rawSite = getMeta(html, 'og:site_name') ?? url.hostname.replace(/^www\./, '')

    const base: LinkPreview = {
      url: url.href,
      title: rawTitle ? decodeHtmlEntities(rawTitle) : null,
      description: rawDesc ? decodeHtmlEntities(rawDesc) : null,
      image: image ? resolveUrl(image, url) : null,
      siteName: rawSite ? decodeHtmlEntities(rawSite) : null,
    }

    if (musicMeta) {
      const { artist, track } = parseMusicNames(
        musicMeta.platform,
        base.title,
        base.description,
        html,
      )
      return {
        ...base,
        musicPlatform: musicMeta.platform,
        musicType: musicMeta.type,
        musicEmbedUrl: musicMeta.embedUrl ?? undefined,
        musicArtist: artist ?? undefined,
        musicTrack: track ?? undefined,
      }
    }

    return base
  } catch {
    // If fetch fails but we know it's a music URL, return minimal music preview
    if (musicMeta) {
      return {
        url: url.href,
        title: null,
        description: null,
        image: null,
        siteName: null,
        musicPlatform: musicMeta.platform,
        musicType: musicMeta.type,
        musicEmbedUrl: musicMeta.embedUrl ?? undefined,
      }
    }
    return null
  }
}

function resolveUrl(src: string, base: URL): string {
  try {
    return new URL(src, base).href
  } catch {
    return src
  }
}
