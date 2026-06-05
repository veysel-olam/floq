/**
 * Layer 1 — Static mapping audit (floq → AP / Bluesky / Nostr).
 *
 * Each cell scores whether floq's outbound builder carries a semantic dimension
 * to the target protocol, with a code citation + justification. This is derived
 * from the actual bridge builders, so it is reproducible and traceable:
 *   AP      → apps/api/src/lib/activityPub.ts  buildNote()
 *   Bluesky → apps/api/src/lib/bluesky.ts      crosspostToBluesky()
 *   Nostr   → apps/api/src/lib/nostr.ts        crosspostToNostr() / publishNote()
 *
 * Run:  npx tsx research/interop/audit.ts
 * Emits MATRIX.md + matrix.csv next to this file.
 *
 * Scope: OUTBOUND post-object bridging (floq → target). Inbound (target → floq)
 * and post-hoc interactions (likes/reactions) are out of scope here.
 */
import { writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import { DIMENSIONS, TARGETS, TARGET_LABEL, type Target, type Score, type Row } from './dimensions.js'

// ── The audit (one row per dimension) ───────────────────────────────────────────
export const OUTBOUND: Record<string, Row> = {
  identity: {
    ap:      { score: 1,   note: 'Gönderi aynı floq actor URL\'sine attributedTo — kimlik birebir.', cite: 'buildNote: attributedTo = actorUrl(author.handle)' },
    bluesky: { score: 0.5, note: 'Kullanıcının ayrı Bluesky hesabı (app-password) altında çıkar; floq↔Bluesky kimliği kriptografik olarak bağlı değil.', cite: 'crosspostToBluesky: stored connection agent' },
    nostr:   { score: 0.5, note: 'floq\'un ürettiği ayrı npub; floq handle\'ına yalnızca NIP-05 ile gevşek bağlı.', cite: 'crosspostToNostr → publishNote (ayrı anahtar)' },
  },
  text: {
    ap:      { score: 1,   note: 'Tam HTML içerik korunur.', cite: 'buildNote: content = post.content' },
    bluesky: { score: 0.5, note: 'HTML soyulur + 300 karaktere kırpılır.', cite: 'crosspostToBluesky: replace(/<[^>]+>/g) + slice(0,300)' },
    nostr:   { score: 0.5, note: 'HTML soyulur; biçim/bağlantı yapısı düz metne iner.', cite: 'crosspostToNostr: replace(/<[^>]+>/g)' },
  },
  visibility: {
    ap:      { score: 1,   note: 'public/unlisted/followers → to/cc doğru eşlenir.', cite: 'buildNote: to/cc by post.visibility' },
    bluesky: { score: 0,   note: 'Bluesky tüm gönderiler herkese açık; floq görünürlüğü taşınmaz (yalnızca public/unlisted zaten crosspost edilir).', cite: 'crosspostToBluesky: görünürlük alanı yok' },
    nostr:   { score: 0,   note: 'Nostr tümü herkese açık; görünürlük semantiği yok.', cite: 'crosspostToNostr: görünürlük alanı yok' },
  },
  content_warning: {
    ap:      { score: 1,   note: 'sensitive + summary (CW) taşınır.', cite: 'buildNote: note.sensitive + note.summary' },
    bluesky: { score: 0,   note: 'Bluesky self-label kullanılmıyor; CW kaybolur.', cite: 'crosspostToBluesky: label/sensitive yok' },
    nostr:   { score: 0,   note: 'NIP-36 content-warning tag\'i kullanılmıyor.', cite: 'crosspostToNostr: cw tag yok' },
  },
  hashtags: {
    ap:      { score: 1,   note: 'Hashtag tag\'leri eklenir.', cite: 'buildNote: tagArr Hashtag' },
    bluesky: { score: 1,   note: 'richtext facet (#tag) olarak eklenir.', cite: 'crosspostToBluesky: facets (app.bsky.richtext.facet#tag)' },
    nostr:   { score: 1,   note: '`t` tag\'lerine eşlenir.', cite: 'crosspostToNostr: hashtags → [t, tag]' },
  },
  mentions: {
    ap:      { score: 0.5, note: 'buildNote Mention tag eklemez; @ yalnızca metinde kalır → makine-okunur değil (alıcı çıkarabilir).', cite: 'buildNote: tagArr\'da Mention yok' },
    bluesky: { score: 0,   note: 'mention facet eklenmez.', cite: 'crosspostToBluesky: yalnızca tag facet' },
    nostr:   { score: 0,   note: '`p` (pubkey) mention tag\'i eklenmez.', cite: 'crosspostToNostr: p tag yok' },
  },
  quote: {
    ap:      { score: 1,   note: 'FEP-e232: quoteUri/quoteUrl/_misskey_quote + Link tag.', cite: 'buildNote: post.quotedApId → quote alanları' },
    bluesky: { score: 0,   note: 'app.bsky.embed.record (quote) eşlemesi yok.', cite: 'crosspostToBluesky: quote embed yok' },
    nostr:   { score: 0,   note: 'NIP-18 quote / `q` tag yok.', cite: 'crosspostToNostr: quote yok' },
  },
  media: {
    ap:      { score: 0,   note: 'buildNote gönderi medyasını attachment olarak eklemez (yalnızca actor profil alanları için attachment var).', cite: 'buildNote: obj.attachment yalnızca actor.profileFields' },
    bluesky: { score: 0.5, note: 'Görseller embed edilir (max 4); video taşınmaz; 4\'ten fazlası düşer.', cite: 'crosspostToBluesky: uploadImageToBluesky, images.slice(0,4)' },
    nostr:   { score: 0,   note: 'Medya gömülmez (imeta/URL yok).', cite: 'crosspostToNostr: medya yok' },
  },
  media_alt: {
    ap:      { score: 0,   note: 'Medya taşınmadığı için alt-metin de yok.', cite: 'buildNote: medya yok' },
    bluesky: { score: 1,   note: 'Gönderilen görsellerde alt-metin korunur.', cite: 'crosspostToBluesky: { image, alt: m.alt }' },
    nostr:   { score: 0,   note: 'Medya yok → alt yok.', cite: 'crosspostToNostr: medya yok' },
  },
  reply_thread: {
    ap:      { score: 1,   note: 'inReplyTo ile yanıt bağlamı korunur.', cite: 'buildNote: note.inReplyTo = post.apInReplyTo' },
    bluesky: { score: 0,   note: 'Yanıtlar zaten crosspost edilmez; edilse de thread\'siz düz gönderi olur.', cite: 'posts.ts: yalnızca !replyToId crosspost; record\'da reply yok' },
    nostr:   { score: 0,   note: '`e` (event) reply tag\'i eklenmez.', cite: 'crosspostToNostr: e tag yok' },
  },
  timestamp: {
    ap:      { score: 1,   note: 'published = orijinal createdAt.', cite: 'buildNote: published = post.createdAt' },
    bluesky: { score: 0.5, note: 'record.createdAt = crosspost anı (orijinal değil); gecikmede sapar.', cite: 'crosspostToBluesky: createdAt = new Date()' },
    nostr:   { score: 0.5, note: 'created_at = yayın anı (orijinal değil).', cite: 'publishNote: created_at = Date.now()/1000' },
  },
  language: {
    ap:      { score: 0,   note: 'buildNote dil/contentMap alanı set etmez.', cite: 'buildNote: language alanı yok' },
    bluesky: { score: 0.5, note: 'langs sabit [\'tr\'] — gerçek dil tespit edilmez.', cite: 'crosspostToBluesky: langs: [\'tr\']' },
    nostr:   { score: 0,   note: 'Dil etiketi yok.', cite: 'crosspostToNostr: dil tag yok' },
  },
}

// ── Rendering ────────────────────────────────────────────────────────────────
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

function renderMatrixMd(): string {
  const date = new Date().toISOString().slice(0, 10)
  let md = `# Anlamsal Kayıp Matrisi — floq Çıkış Köprüleri (Katman 1: Statik)\n\n`
  md += `> Otomatik üretildi (\`research/interop/audit.ts\`) · ${date}\n`
  md += `> Skor: \`✓ 1.0\` tam · \`◐ 0.5\` kısmi · \`✗ 0\` kayıp · \`–\` n/a\n`
  md += `> Kapsam: floq → hedef (çıkış), gönderi nesnesi.\n\n`

  // Matrix table
  md += `| Boyut | ${TARGETS.map((t) => TARGET_LABEL[t]).join(' | ')} |\n`
  md += `|---|${TARGETS.map(() => '---').join('|')}|\n`
  for (const d of DIMENSIONS) {
    const row = OUTBOUND[d.key]
    if (!row) continue
    md += `| ${d.label} | ${TARGETS.map((t) => glyph(row[t].score)).join(' | ')} |\n`
  }
  // Per-target average
  md += `| **Ortalama** | ${TARGETS.map((t) =>
    `**${avg(DIMENSIONS.map((d) => OUTBOUND[d.key]?.[t].score ?? null))}**`).join(' | ')} |\n\n`

  // Per-dimension fragility (avg across targets)
  md += `## Boyut kırılganlığı (hedefler ortalaması — düşük = kırılgan)\n\n`
  const dimAvgs = DIMENSIONS.map((d) => ({
    label: d.label,
    a: Number(avg(TARGETS.map((t) => OUTBOUND[d.key]?.[t].score ?? null))) || 0,
  })).sort((x, y) => x.a - y.a)
  md += `| Boyut | Ort. korunma |\n|---|---|\n`
  for (const r of dimAvgs) md += `| ${r.label} | ${r.a.toFixed(2)} |\n`
  md += `\n`

  // Justifications
  md += `## Gerekçeler ve kod alıntıları\n\n`
  for (const d of DIMENSIONS) {
    const row = OUTBOUND[d.key]
    if (!row) continue
    md += `### ${d.label} — *${d.measures}*\n`
    for (const t of TARGETS) {
      const c = row[t]
      md += `- **${TARGET_LABEL[t]}** \`${glyph(c.score)}\`: ${c.note} _(\`${c.cite}\`)_\n`
    }
    md += `\n`
  }

  md += `## Okuma notları\n`
  md += `- **AP en yüksek korunma** — floq native AP konuşur; \`buildNote\` çoğu boyutu taşır. Başlıca açık: **medya** (gönderi eki federe edilmiyor).\n`
  md += `- **Bluesky orta** — etiket/medya/alt iyi; görünürlük, CW, alıntı, yanıt, dil kaybı belirgin.\n`
  md += `- **Nostr en lossy** — yalnızca metin + hashtag; yapısal her şey (görünürlük, CW, alıntı, medya, yanıt, mention) düşer.\n`
  md += `- **Asimetri (RQ1):** Bu matris yalnızca çıkış (floq→X). Giriş (X→floq, \`importBlueskyPosts\`) ayrı bir matris gerektirir; yön asimetrisi orada görünür.\n`
  return md
}

function renderCsv(): string {
  let csv = 'dimension,' + TARGETS.join(',') + '\n'
  for (const d of DIMENSIONS) {
    const row = OUTBOUND[d.key]
    if (!row) continue
    csv += `${d.key},` + TARGETS.map((t) => (row[t].score ?? 'na')).join(',') + '\n'
  }
  return csv
}

// ── Main (only when run directly, not when imported) ───────────────────────────
if (import.meta.url === `file://${process.argv[1]}`) {
  const here = dirname(fileURLToPath(import.meta.url))
  writeFileSync(join(here, 'MATRIX.md'), renderMatrixMd())
  writeFileSync(join(here, 'matrix.csv'), renderCsv())
  console.log('✓ Üretildi: MATRIX.md + matrix.csv')
  console.log('Hedef ortalamaları:', TARGETS.map((t) =>
    `${t}=${avg(DIMENSIONS.map((d) => OUTBOUND[d.key]?.[t].score ?? null))}`).join('  '))
}
