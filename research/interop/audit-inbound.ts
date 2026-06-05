/**
 * Layer 1 (inbound) — Static mapping audit for target → floq.
 *
 * Mirror of audit.ts for the OTHER direction. Inbound paths:
 *   AP      → apps/api/src/lib/ingest.ts   ingestRemoteNote()  (+ inbox Create)
 *   Bluesky → apps/api/src/lib/bluesky.ts  importBlueskyPosts()
 *   Nostr   → (not implemented — no inbound mirror)
 *
 * Run: npx tsx research/interop/audit-inbound.ts
 * Emits MATRIX_INBOUND.md + matrix-inbound.csv, plus a direction-asymmetry table
 * (RQ1) by diffing against the OUTBOUND audit.
 */
import { writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import { DIMENSIONS, TARGETS, TARGET_LABEL, type Target, type Score, type Row } from './dimensions.js'
import { OUTBOUND } from './audit.js'

const NA = { score: null as Score, note: 'Nostr→floq import implement edilmedi (inbound köprü yok).', cite: '—' }

export const INBOUND: Record<string, Row> = {
  identity: {
    ap:      { score: 1,   note: 'fetchRemoteActor ile uzak yazar tam kimliğiyle çözülür.', cite: 'ingestRemoteNote: fetchRemoteActor(attributedTo)' },
    bluesky: { score: 1,   note: 'Kullanıcının kendi floq aktörü altında aynalanır (aynı kişi).', cite: 'importBlueskyPosts: authorId = actor.id' },
    nostr:   NA,
  },
  text: {
    ap:      { score: 1,   note: 'note.content tam HTML olarak saklanır.', cite: 'ingestRemoteNote: content = note.content' },
    bluesky: { score: 1,   note: 'record.text olduğu gibi alınır (Bluesky zaten düz metin) — kayıp yok.', cite: 'importBlueskyPosts: content = record.text' },
    nostr:   NA,
  },
  visibility: {
    ap:      { score: 1,   note: 'to/cc\'den görünürlük çözülür.', cite: 'ingestRemoteNote: resolveVisibility(to, cc)' },
    bluesky: { score: 0,   note: 'Daima public olarak eklenir (Bluesky görünürlük modeli yok).', cite: 'importBlueskyPosts: visibility = public' },
    nostr:   NA,
  },
  content_warning: {
    ap:      { score: 1,   note: 'summary + sensitive korunur.', cite: 'ingestRemoteNote: contentWarning = note.summary, sensitive' },
    bluesky: { score: 0,   note: 'Bluesky self-label okunmuyor → CW yok.', cite: 'importBlueskyPosts: label okunmaz' },
    nostr:   NA,
  },
  hashtags: {
    ap:      { score: 1,   note: 'Hashtag tag\'leri okunur.', cite: 'ingestRemoteNote: note.tag Hashtag → tags' },
    bluesky: { score: 1,   note: 'Metinden regex ile çıkarılıp floq tag\'lerine yazılır.', cite: 'importBlueskyPosts: matchAll(/#.../) → tags' },
    nostr:   NA,
  },
  mentions: {
    ap:      { score: 0.5, note: 'Yalnızca Hashtag okunur; Mention tag düşer (@ metinde kalır).', cite: 'ingestRemoteNote: yalnızca Hashtag filtrelenir' },
    bluesky: { score: 0,   note: 'Mention facet okunmuyor.', cite: 'importBlueskyPosts: mention parse edilmez' },
    nostr:   NA,
  },
  quote: {
    ap:      { score: 0,   note: 'ingestRemoteNote alıntı (FEP-e232) çözmez (gerçek-zamanlı inbox Create kısmen çözebilir).', cite: 'ingestRemoteNote: quotedPostId set edilmez' },
    bluesky: { score: 0,   note: 'Alıntı embed\'i içe aktarılmaz.', cite: 'importBlueskyPosts: quote yok' },
    nostr:   NA,
  },
  media: {
    ap:      { score: 1,   note: 'attachRemoteMediaAndPreview ile medya (hotlink) eklenir.', cite: 'ingestRemoteNote: attachRemoteMediaAndPreview(note)' },
    bluesky: { score: 0.5, note: 'Görseller hotlink (max 4); video yok.', cite: 'importBlueskyPosts: extractBskyimages (images, slice 4)' },
    nostr:   NA,
  },
  media_alt: {
    ap:      { score: 0.5, note: 'Alt-metin attachRemoteMediaAndPreview eşlemesine bağlı (kısmi).', cite: 'attachRemoteMediaAndPreview' },
    bluesky: { score: 1,   note: 'Görsel alt-metni korunur.', cite: 'importBlueskyPosts: altText = im.alt' },
    nostr:   NA,
  },
  reply_thread: {
    ap:      { score: 1,   note: 'inReplyTo çözülür, gerekirse zincir yukarı ingest edilir.', cite: 'ingestRemoteNote: inReplyTo → replyToId/rootId' },
    bluesky: { score: 0,   note: 'Yanıtlar hiç içe aktarılmaz (posts_no_replies filtresi).', cite: 'importBlueskyPosts: filter posts_no_replies; record.reply skip' },
    nostr:   NA,
  },
  timestamp: {
    ap:      { score: 1,   note: 'note.published orijinal zaman korunur.', cite: 'ingestRemoteNote: createdAt = note.published' },
    bluesky: { score: 1,   note: 'record.createdAt — Bluesky\'deki ORİJİNAL zaman korunur.', cite: 'importBlueskyPosts: createdAt = record.createdAt' },
    nostr:   NA,
  },
  language: {
    ap:      { score: 0,   note: 'Dil etiketi saklanmaz.', cite: 'ingestRemoteNote: language alanı yok' },
    bluesky: { score: 0,   note: 'Bluesky langs okunmuyor.', cite: 'importBlueskyPosts: langs okunmaz' },
    nostr:   NA,
  },
}

// ── Rendering helpers (mirror audit.ts) ─────────────────────────────────────────
function glyph(s: Score): string {
  if (s === 1) return '✓ 1.0'
  if (s === 0.5) return '◐ 0.5'
  if (s === 0) return '✗ 0'
  return '–'
}
function avg(scores: Score[]): string {
  const nums = scores.filter((s): s is 1 | 0.5 | 0 => s !== null)
  if (!nums.length) return '–'
  return (nums.reduce<number>((a, b) => a + b, 0) / nums.length).toFixed(2)
}

function render(): string {
  const date = new Date().toISOString().slice(0, 10)
  let md = `# Anlamsal Kayıp Matrisi — floq Giriş Köprüleri (Katman 1: Statik, INBOUND)\n\n`
  md += `> Otomatik üretildi (\`research/interop/audit-inbound.ts\`) · ${date}\n`
  md += `> Yön: hedef → floq. Nostr inbound implement edilmedi (\`–\`).\n\n`

  md += `| Boyut | ${TARGETS.map((t) => TARGET_LABEL[t]).join(' | ')} |\n`
  md += `|---|${TARGETS.map(() => '---').join('|')}|\n`
  for (const d of DIMENSIONS) {
    const row = INBOUND[d.key]; if (!row) continue
    md += `| ${d.label} | ${TARGETS.map((t) => glyph(row[t].score)).join(' | ')} |\n`
  }
  md += `| **Ortalama** | ${TARGETS.map((t) =>
    `**${avg(DIMENSIONS.map((d) => INBOUND[d.key]?.[t].score ?? null))}**`).join(' | ')} |\n\n`

  // ── Direction asymmetry (RQ1): where does in ≠ out? ──
  md += `## Yön Asimetrisi (RQ1) — çıkış ≠ giriş\n\n`
  md += `> Aynı (boyut × protokol) için çıkış ve giriş skorunun farklı olduğu hücreler.\n`
  md += `> Bunlar protokol model farkının en somut kanıtı.\n\n`
  md += `| Boyut | Protokol | Çıkış | Giriş | Fark |\n|---|---|---|---|---|\n`
  let asymCount = 0
  for (const d of DIMENSIONS) {
    for (const t of TARGETS) {
      const out = OUTBOUND[d.key]?.[t].score ?? null
      const inn = INBOUND[d.key]?.[t].score ?? null
      if (out === null || inn === null) continue
      if (out !== inn) {
        const dir = inn > out ? '↑ giriş daha iyi' : '↓ çıkış daha iyi'
        md += `| ${d.label} | ${TARGET_LABEL[t]} | ${glyph(out)} | ${glyph(inn)} | ${dir} |\n`
        asymCount++
      }
    }
  }
  md += `\n${asymCount} asimetrik hücre.\n\n`
  md += `**Öne çıkanlar:**\n`
  md += `- **Medya / AP:** çıkışta kayıp (\`buildNote\` ek koymaz), girişte tam (\`attachRemoteMediaAndPreview\`) → floq medyayı *alır ama vermez*.\n`
  md += `- **Zaman / Bluesky:** çıkışta crosspost anı, girişte orijinal \`record.createdAt\` → giriş daha sadık.\n`
  md += `- **Metin / Bluesky:** çıkışta kırpma (300), girişte tam → asimetrik kayıp.\n\n`

  // Justifications
  md += `## Gerekçeler ve kod alıntıları\n\n`
  for (const d of DIMENSIONS) {
    const row = INBOUND[d.key]; if (!row) continue
    md += `### ${d.label} — *${d.measures}*\n`
    for (const t of TARGETS) {
      const c = row[t]
      md += `- **${TARGET_LABEL[t]}** \`${glyph(c.score)}\`: ${c.note} _(\`${c.cite}\`)_\n`
    }
    md += `\n`
  }
  return md
}

function renderCsv(): string {
  let csv = 'dimension,' + TARGETS.join(',') + '\n'
  for (const d of DIMENSIONS) {
    const row = INBOUND[d.key]; if (!row) continue
    csv += `${d.key},` + TARGETS.map((t) => (row[t].score ?? 'na')).join(',') + '\n'
  }
  return csv
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const here = dirname(fileURLToPath(import.meta.url))
  writeFileSync(join(here, 'MATRIX_INBOUND.md'), render())
  writeFileSync(join(here, 'matrix-inbound.csv'), renderCsv())
  console.log('✓ Üretildi: MATRIX_INBOUND.md + matrix-inbound.csv')
  console.log('Giriş ortalamaları:', TARGETS.map((t) =>
    `${t}=${avg(DIMENSIONS.map((d) => INBOUND[d.key]?.[t].score ?? null))}`).join('  '))
}
