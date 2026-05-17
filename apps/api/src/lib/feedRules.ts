export type FeedSort = 'chronological' | 'hot' | 'rising' | 'top_day' | 'mixed'

export interface FeedRulesConfig {
  sort: FeedSort
  hideReplies: boolean
  sources: {
    following: boolean
    lists: string[]
  }
}

export const DEFAULT_RULES: FeedRulesConfig = {
  sort: 'chronological',
  hideReplies: false,
  sources: { following: true, lists: [] },
}

/**
 * Hot score: Reddit-benzeri, zaman çürümeli etkileşim skoru.
 * score = (likes + boosts*2 + replies*3 + 1) / (ageInHours + 2)^1.5
 * Eski postlar ne kadar etkileşim alırsa alsın yenilerin önüne geçemez.
 */
export const HOT_SCORE_SQL = `
  (likes_count + boosts_count * 2 + replies_count * 3 + 1)::float
  / POWER(EXTRACT(EPOCH FROM (NOW() - created_at)) / 3600.0 + 2, 1.5)
`

/**
 * Rising score: Son 6 saatte kazanılan etkileşim hızı.
 * Yeni ama hızla büyüyen gönderileri öne çıkarır.
 * score = etkileşim / (ageInHours + 0.5)^0.8
 */
export const RISING_SCORE_SQL = `
  CASE
    WHEN EXTRACT(EPOCH FROM (NOW() - created_at)) / 3600.0 > 6 THEN 0
    ELSE (likes_count + boosts_count * 2 + replies_count * 3 + 1)::float
         / POWER(EXTRACT(EPOCH FROM (NOW() - created_at)) / 3600.0 + 0.5, 0.8)
  END
`

/**
 * Mixed (Dengeli): %60 hot score + %40 kronoloik taze bonus.
 * Ne tamamen zaman sıralı ne tamamen etkileşim — ikisinin karışımı.
 */
export const MIXED_SCORE_SQL = `
  0.6 * (likes_count + boosts_count * 2 + replies_count * 3 + 1)::float
      / POWER(EXTRACT(EPOCH FROM (NOW() - created_at)) / 3600.0 + 2, 1.5)
  + 0.4 * EXP(-EXTRACT(EPOCH FROM (NOW() - created_at)) / 43200.0)
`

export const PRESETS: Record<string, { name: string; description: string; config: FeedRulesConfig }> = {
  chronological: {
    name: 'Saf Kronolojik',
    description: 'Zaman sırasına göre, sıfır algoritma. En yeni en üstte.',
    config: DEFAULT_RULES,
  },
  originals: {
    name: 'Sadece Orijinaller',
    description: 'Yanıtlar gizlenir, sadece orijinal gönderiler görünür.',
    config: { sort: 'chronological', hideReplies: true, sources: { following: true, lists: [] } },
  },
  hot: {
    name: 'Ateşli',
    description: 'Zaman çürümeli hot-score — viral içerik öne çıkar ama eski postlar domine edemez.',
    config: { sort: 'hot', hideReplies: false, sources: { following: true, lists: [] } },
  },
  rising: {
    name: 'Yükselen',
    description: 'Son 6 saatte hızla ivme kazanan gönderiler. Trend olmadan önce yakala.',
    config: { sort: 'rising', hideReplies: false, sources: { following: true, lists: [] } },
  },
  mixed: {
    name: 'Dengeli',
    description: 'Etkileşim ve tazeliğin %60–%40 karışımı. Hem güncel hem ilgi çekici.',
    config: { sort: 'mixed', hideReplies: false, sources: { following: true, lists: [] } },
  },
  top_day: {
    name: "Günün En İyileri",
    description: 'Son 24 saatin en fazla etkileşim alan gönderileri.',
    config: { sort: 'top_day', hideReplies: false, sources: { following: true, lists: [] } },
  },
}
