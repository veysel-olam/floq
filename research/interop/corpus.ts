/**
 * Canonical test corpus for the empirical (Layer 2) round-trip.
 *
 * Each case exercises ONE dimension with a known, checkable payload, so that
 * after bridging we can ask: did this dimension survive in the target?
 * Probe = the concrete thing harness.ts looks for in the received object.
 */
import type { Dimension } from './dimensions.js'

export interface CorpusCase {
  dimension: Dimension['key']
  /** Human label for the report. */
  label: string
  /** A floq post spec — the fields that matter for this dimension. */
  post: {
    content: string
    visibility?: 'public' | 'unlisted' | 'followers'
    sensitive?: boolean
    contentWarning?: string
    tags?: string[]
    quotedApId?: string
    media?: { url: string; alt: string }[]
    inReplyTo?: string
    language?: string
  }
  /** What the harness should verify in the received object per target. */
  probe: string
}

export const CORPUS: CorpusCase[] = [
  {
    dimension: 'text',
    label: 'Biçimli metin',
    post: { content: '<p>Merhaba <strong>dünya</strong> — bağlantı: <a href="https://flq.social">flq</a></p>' },
    probe: 'Gövde metni ve (varsa) biçim/bağlantı korundu mu? Kırpma var mı (>300?)',
  },
  {
    dimension: 'visibility',
    label: 'Unlisted görünürlük',
    post: { content: 'Unlisted test #interop', visibility: 'unlisted' },
    probe: 'Hedefte unlisted/karşılığı var mı, yoksa public mi oldu?',
  },
  {
    dimension: 'content_warning',
    label: 'İçerik uyarısı',
    post: { content: 'CW gövdesi', sensitive: true, contentWarning: 'Spoiler' },
    probe: 'CW/sensitive bayrağı + özet taşındı mı?',
  },
  {
    dimension: 'hashtags',
    label: 'Hashtag',
    post: { content: 'Etiket testi #interop #fediverse', tags: ['interop', 'fediverse'] },
    probe: 'Etiketler makine-okunur (facet / t-tag / Hashtag) mı?',
  },
  {
    dimension: 'mentions',
    label: 'Bahsetme',
    post: { content: 'Selam @veyselolam@flq.social' },
    probe: 'Mention makine-okunur tag olarak mı, yoksa düz metin mi?',
  },
  {
    dimension: 'quote',
    label: 'Alıntı',
    post: { content: 'Bunu alıntılıyorum', quotedApId: 'https://flq.social/users/veyselolam/posts/QUOTE_ID' },
    probe: 'Alıntı bağlantısı (FEP-e232 / embed.record / NIP-18) korundu mu?',
  },
  {
    dimension: 'media',
    label: 'Görsel ek',
    post: { content: 'Görselli', media: [{ url: 'https://media.flq.social/test.jpg', alt: 'kırmızı kare' }] },
    probe: 'Görsel hedefe taşındı mı? Kaç tanesi? Video?',
  },
  {
    dimension: 'media_alt',
    label: 'Alt-metin',
    post: { content: 'Alt testi', media: [{ url: 'https://media.flq.social/test.jpg', alt: 'kırmızı kare' }] },
    probe: 'Alt-metin korundu mu?',
  },
  {
    dimension: 'reply_thread',
    label: 'Yanıt',
    post: { content: 'Bu bir yanıt', inReplyTo: 'https://flq.social/users/veyselolam/posts/PARENT_ID' },
    probe: 'Yanıt bağlamı (inReplyTo / reply ref / e-tag) korundu mu?',
  },
  {
    dimension: 'timestamp',
    label: 'Zaman damgası',
    post: { content: 'Zaman testi' },
    probe: 'Yayın zamanı orijinal createdAt mı, yoksa köprüleme anı mı?',
  },
  {
    dimension: 'language',
    label: 'Dil etiketi',
    post: { content: 'Dil testi', language: 'tr' },
    probe: 'Dil etiketi doğru mu (tr), sabit mi, yok mu?',
  },
]
