import type { FastifyInstance } from 'fastify'
import { requireActor } from '../lib/session.js'

const SUPPORTED_LANGS: Record<string, string> = {
  tr: 'Türkçe', en: 'İngilizce', de: 'Almanca', fr: 'Fransızca',
  es: 'İspanyolca', it: 'İtalyanca', pt: 'Portekizce', ru: 'Rusça',
  zh: 'Çince', ja: 'Japonca', ko: 'Korece', ar: 'Arapça',
}

const LANG_NAMES: Record<string, string> = {
  tr: 'Türkçe', en: 'İngilizce', de: 'Almanca', fr: 'Fransızca',
  es: 'İspanyolca', it: 'İtalyanca', pt: 'Portekizce', ru: 'Rusça',
  zh: 'Çince', ja: 'Japonca', ko: 'Korece', ar: 'Arapça',
}

export async function translateRoutes(app: FastifyInstance) {
  // POST /api/translate
  app.post<{ Body: { text: string; to?: string } }>('/api/translate', {
    config: { rateLimit: { max: 30, timeWindow: '1 minute' } },
  }, async (req, reply) => {
    const ctx = await requireActor(req, reply)
    if (!ctx) return

    const text = (req.body.text ?? '').trim()
    const to = req.body.to ?? 'tr'

    if (!text) return reply.code(400).send({ error: 'text required' })
    if (text.length > 2000) return reply.code(400).send({ error: 'text too long' })
    if (!SUPPORTED_LANGS[to]) return reply.code(400).send({ error: 'unsupported target language' })

    try {
      const url = `https://translate.googleapis.com/translate_a/single?client=gtx&sl=auto&tl=${encodeURIComponent(to)}&dt=t&q=${encodeURIComponent(text)}`
      const res = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0' } })
      if (!res.ok) return reply.code(502).send({ error: 'Translation service unavailable' })

      // Response shape: [[["translated","original",null,null,10],...],null,"detectedLang",...]
      const data = (await res.json()) as unknown[]
      const parts = (data[0] as [string, string][]).map(([t]) => t ?? '').join('')
      const detectedLang = (data[2] as unknown as string | undefined) ?? 'unknown'

      return reply.send({
        translated: parts,
        detectedLang,
        detectedLangName: LANG_NAMES[detectedLang] ?? detectedLang,
        toLang: to,
        toLangName: LANG_NAMES[to] ?? to,
      })
    } catch {
      return reply.code(502).send({ error: 'Translation service unavailable' })
    }
  })

  // GET /api/translate/languages — desteklenen diller listesi
  app.get('/api/translate/languages', async (_req, reply) => {
    return reply.send({
      languages: Object.entries(LANG_NAMES).map(([code, name]) => ({ code, name })),
    })
  })
}
