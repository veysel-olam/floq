import type { KeywordFilter, Post } from './api'

function buildPattern(filter: KeywordFilter): RegExp {
  const escaped = filter.keyword.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  const pattern = filter.wholeWord ? `\\b${escaped}\\b` : escaped
  return new RegExp(pattern, 'i')
}

export type FilterResult = 'pass' | 'warn' | 'hide'

export function applyFilters(
  post: Post,
  filters: KeywordFilter[],
  context: string,
): FilterResult {
  const active = filters.filter((f) => {
    if (f.expiresAt && new Date(f.expiresAt) < new Date()) return false
    const contexts = f.contexts.split(',').map((c) => c.trim())
    return contexts.includes(context) || contexts.includes('all')
  })

  if (active.length === 0) return 'pass'

  const text = [post.content, post.contentWarning].filter(Boolean).join(' ')

  let result: FilterResult = 'pass'
  for (const filter of active) {
    const pattern = buildPattern(filter)
    if (pattern.test(text)) {
      if (filter.action === 'hide') return 'hide'
      result = 'warn'
    }
  }
  return result
}
