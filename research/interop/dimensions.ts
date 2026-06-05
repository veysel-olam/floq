/**
 * Interop semantic-loss study — dimension & target catalog.
 * See README.md for methodology.
 */

// The bridge targets floq can publish a post to.
export const TARGETS = ['ap', 'bluesky', 'nostr'] as const
export type Target = (typeof TARGETS)[number]

export const TARGET_LABEL: Record<Target, string> = {
  ap: 'ActivityPub (Mastodon)',
  bluesky: 'AT Protocol (Bluesky)',
  nostr: 'Nostr',
}

// Preservation score for a (dimension × target) cell.
//   1   = fully preserved (machine-readable in target)
//   0.5 = partial / lossy (present but degraded or text-embedded)
//   0   = lost (not carried to target)
//   null = n/a (out of scope or meaningless for this target)
export type Score = 1 | 0.5 | 0 | null

// A semantic unit of a post that may survive or be lost when bridged.
export interface Dimension {
  key: string
  label: string
  /** What is measured / what "preserved" means for this dimension. */
  measures: string
}

export const DIMENSIONS: Dimension[] = [
  { key: 'identity',        label: 'Kimlik',          measures: 'Yazarın aynı/bağlı kimlikle temsili' },
  { key: 'text',            label: 'Metin/biçim',     measures: 'Gövde metni + biçimlendirme korunması' },
  { key: 'visibility',      label: 'Görünürlük',      measures: 'public/unlisted/followers/direct semantiği' },
  { key: 'content_warning', label: 'İçerik uyarısı',  measures: 'CW/sensitive bayrağı + özet' },
  { key: 'hashtags',        label: 'Etiketler',       measures: 'Makine-okunur hashtag' },
  { key: 'mentions',        label: 'Bahsetmeler',     measures: 'Makine-okunur @mention' },
  { key: 'quote',           label: 'Alıntı',          measures: 'Alıntılı paylaşım bağlantısı' },
  { key: 'media',           label: 'Medya',           measures: 'Görsel ek(ler)i' },
  { key: 'media_alt',       label: 'Alt-metin',       measures: 'Erişilebilirlik alt-metni' },
  { key: 'reply_thread',    label: 'Yanıt/iplik',     measures: 'Yanıt bağlamı / thread' },
  { key: 'timestamp',       label: 'Zaman',           measures: 'Orijinal oluşturma zamanı' },
  { key: 'language',        label: 'Dil',             measures: 'Dil etiketi' },
]

export const DIM_BY_KEY: Record<string, Dimension> =
  Object.fromEntries(DIMENSIONS.map((d) => [d.key, d]))
