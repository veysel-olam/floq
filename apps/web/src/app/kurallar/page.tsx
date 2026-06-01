'use client'

import Link from 'next/link'
import { useEffect, useState } from 'react'
import { ArrowLeft, Check, X, Scale, ShieldCheck } from 'lucide-react'
import { api } from '@/lib/api'

type MonthStat = { month: string; total: number; accepted: number; rejected: number; pending: number }

export default function RulesPage() {
  const [stats, setStats] = useState<MonthStat[] | null>(null)
  useEffect(() => { api.transparency().then((d) => setStats(d.months)).catch(() => setStats([])) }, [])

  return (
    <div className="min-h-screen bg-(--color-background)">
      <div className="max-w-2xl mx-auto px-6 py-12">
        <Link href="/" className="inline-flex items-center gap-1.5 text-sm text-(--color-text-tertiary) hover:text-(--color-text-primary) transition-colors mb-8">
          <ArrowLeft className="w-4 h-4" /> Ana sayfaya dön
        </Link>

        <div className="mb-8">
          <h1 className="text-3xl font-bold text-(--color-coral) mb-2">Topluluk Kuralları ve Moderasyon</h1>
          <p className="text-sm text-(--color-text-tertiary)">
            floq merkeziyetsiz bir ağdır. Moderasyon vardır — ama kurallar önceden bellidir, uygulama tutarlıdır ve itiraz yolu açıktır.
          </p>
        </div>

        {/* Eylem vs söylem */}
        <section className="grid sm:grid-cols-2 gap-4 mb-10">
          <div className="rounded-2xl border border-red-500/20 bg-red-500/5 p-4">
            <div className="flex items-center gap-2 mb-2 text-red-500 font-semibold text-sm"><X className="w-4 h-4" /> Kaldırılır</div>
            <ul className="space-y-1.5 text-sm text-(--color-text-secondary)">
              <li>• Doğrudan tehdit (kişiye yönelik)</li>
              <li>• Doxxing (kimlik, adres, iş yeri ifşası)</li>
              <li>• Koordineli taciz (organize saldırı)</li>
              <li>• Çocuk istismarı içeriği (CSAM)</li>
            </ul>
          </div>
          <div className="rounded-2xl border border-emerald-500/20 bg-emerald-500/5 p-4">
            <div className="flex items-center gap-2 mb-2 text-emerald-500 font-semibold text-sm"><Check className="w-4 h-4" /> Dokunulmaz</div>
            <ul className="space-y-1.5 text-sm text-(--color-text-secondary)">
              <li>• Siyasi eleştiri</li>
              <li>• Kamuya mal olmuş kişilerin eleştirisi</li>
              <li>• Kaba ama tehdit içermeyen içerik</li>
              <li>• &ldquo;Yanlış&rdquo; görüşler</li>
            </ul>
          </div>
        </section>

        {/* Meşruiyetin dört şartı */}
        <section className="mb-10">
          <h2 className="flex items-center gap-2 text-lg font-semibold text-(--color-text-primary) mb-3"><Scale className="w-5 h-5 text-(--color-coral)" /> Moderasyonun dört taahhüdü</h2>
          <ol className="space-y-2 text-sm text-(--color-text-secondary)">
            <li><strong>1. Yazılı ve açık kurallar</strong> — Bu sayfa. Kurallar gizli değil.</li>
            <li><strong>2. İtiraz hakkı</strong> — Kaldırılan içerik için itiraz edebilir, yöneticiden geri dönüş alırsın.</li>
            <li><strong>3. Siyasi tarafsızlık</strong> — Görüşten değil, eylemden moderasyon. &ldquo;Yanlış&rdquo; fikir kaldırılmaz.</li>
            <li><strong>4. Şeffaf kayıt</strong> — Aylık moderasyon istatistiği herkese açık (aşağıda).</li>
          </ol>
        </section>

        {/* Çocuk koruma */}
        <section className="mb-10">
          <h2 className="flex items-center gap-2 text-lg font-semibold text-(--color-text-primary) mb-3"><ShieldCheck className="w-5 h-5 text-(--color-coral)" /> Çocuk koruma</h2>
          <ul className="space-y-1.5 text-sm text-(--color-text-secondary)">
            <li>• Kayıt için <strong>13 yaş ve üzeri</strong> olmak gerekir; 13 altı kabul edilmez.</li>
            <li>• 13-17 yaş <strong>kısıtlı mod</strong>: hassas/NSFW içerik gizli, yabancılardan DM kapalı, konum paylaşımı devre dışı, keşfette görünmez.</li>
            <li>• Yanlış yaş bilgisi tespit edilirse hesap kalıcı olarak silinir.</li>
          </ul>
        </section>

        {/* Şeffaflık istatistiği */}
        <section className="mb-10">
          <h2 className="text-lg font-semibold text-(--color-text-primary) mb-3">Şeffaflık — Aylık moderasyon</h2>
          {stats === null ? (
            <p className="text-sm text-(--color-text-tertiary)">Yükleniyor…</p>
          ) : stats.length === 0 ? (
            <p className="text-sm text-(--color-text-tertiary)">Henüz raporlanmış içerik yok.</p>
          ) : (
            <div className="overflow-hidden rounded-2xl border border-(--color-border)">
              <table className="w-full text-sm">
                <thead className="bg-(--color-background-secondary) text-(--color-text-tertiary)">
                  <tr>
                    <th className="text-left px-3 py-2 font-medium">Ay</th>
                    <th className="text-right px-3 py-2 font-medium">Rapor</th>
                    <th className="text-right px-3 py-2 font-medium">Kabul</th>
                    <th className="text-right px-3 py-2 font-medium">Ret</th>
                    <th className="text-right px-3 py-2 font-medium">Bekleyen</th>
                  </tr>
                </thead>
                <tbody>
                  {stats.map((m) => (
                    <tr key={m.month} className="border-t border-(--color-border-secondary)">
                      <td className="px-3 py-2 text-(--color-text-secondary) font-mono">{m.month}</td>
                      <td className="px-3 py-2 text-right text-(--color-text-primary)">{m.total}</td>
                      <td className="px-3 py-2 text-right text-emerald-500">{m.accepted}</td>
                      <td className="px-3 py-2 text-right text-(--color-text-tertiary)">{m.rejected}</td>
                      <td className="px-3 py-2 text-right text-amber-500">{m.pending}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>

        <section>
          <h2 className="text-lg font-semibold text-(--color-text-primary) mb-2">Nasıl rapor edilir?</h2>
          <p className="text-sm text-(--color-text-secondary)">
            Herhangi bir gönderi veya profildeki <strong>⋯</strong> menüsünden &ldquo;Şikayet et&rdquo; ile rapor edebilirsin. Raporlar moderasyon ekibine iletilir; CSAM raporları en yüksek öncelikle değerlendirilir.
          </p>
        </section>
      </div>
    </div>
  )
}
