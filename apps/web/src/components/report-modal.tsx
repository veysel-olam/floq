'use client'

import { useState } from 'react'
import { X, Flag } from 'lucide-react'
import { api } from '@/lib/api'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

const REASONS = [
  { value: 'spam', label: 'Spam' },
  { value: 'harassment', label: 'Taciz veya zorbalık' },
  { value: 'hate_speech', label: 'Nefret söylemi' },
  { value: 'misinformation', label: 'Yanlış bilgi' },
  { value: 'nsfw', label: 'Uygunsuz içerik' },
  { value: 'violence', label: 'Şiddet içeriği' },
  { value: 'other', label: 'Diğer' },
] as const

interface ReportModalProps {
  postId?: string
  reportedActorHandle?: string
  onClose: () => void
}

export function ReportModal({ postId, reportedActorHandle, onClose }: ReportModalProps) {
  const [reason, setReason] = useState<string | null>(null)
  const [details, setDetails] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [done, setDone] = useState(false)

  async function submit() {
    if (!reason) return
    setSubmitting(true)
    try {
      await api.reports.submit({
        postId,
        reportedActorHandle,
        reason,
        details: details.trim() || undefined,
      })
      setDone(true)
    } catch {
      // ignore
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4" onClick={onClose}>
      <div
        className="bg-(--color-background) rounded-2xl shadow-2xl w-full max-w-sm overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-4 py-3 border-b border-(--color-border)">
          <div className="flex items-center gap-2">
            <Flag className="w-4 h-4 text-(--color-coral)" />
            <h3 className="font-semibold text-sm text-(--color-text-primary)">Raporla</h3>
          </div>
          <button onClick={onClose} className="text-(--color-text-tertiary) hover:text-(--color-text-primary)">
            <X className="w-4 h-4" />
          </button>
        </div>

        {done ? (
          <div className="px-4 py-8 text-center">
            <div className="w-10 h-10 rounded-full bg-green-100 dark:bg-green-900/30 flex items-center justify-center mx-auto mb-3">
              <Flag className="w-5 h-5 text-green-600 dark:text-green-400" />
            </div>
            <p className="text-sm font-medium text-(--color-text-primary) mb-1">Rapor alındı</p>
            <p className="text-xs text-(--color-text-tertiary)">İncelendikten sonra gerekli işlem yapılacaktır.</p>
            <Button size="sm" variant="ghost" onClick={onClose} className="mt-4">Kapat</Button>
          </div>
        ) : (
          <div className="p-4 space-y-3">
            <p className="text-xs text-(--color-text-tertiary)">Bu içeriği neden raporluyorsunuz?</p>

            <div className="space-y-1.5">
              {REASONS.map((r) => (
                <button
                  key={r.value}
                  onClick={() => setReason(r.value)}
                  className={cn(
                    'w-full text-left px-3 py-2 rounded-xl text-sm transition-colors border',
                    reason === r.value
                      ? 'border-(--color-coral) bg-(--color-blush) dark:bg-(--color-coral)/12 text-(--color-coral) dark:bg-(--color-coral)/12'
                      : 'border-(--color-border) text-(--color-text-secondary) hover:border-(--color-border-secondary) hover:text-(--color-text-primary)',
                  )}
                >
                  {r.label}
                </button>
              ))}
            </div>

            {reason && (
              <textarea
                value={details}
                onChange={(e) => setDetails(e.target.value)}
                placeholder="Ek detay (isteğe bağlı)"
                maxLength={500}
                rows={2}
                className="w-full resize-none rounded-xl border border-(--color-border) bg-(--color-background-secondary) px-3 py-2 text-sm text-(--color-text-primary) placeholder:text-(--color-text-tertiary) focus:outline-none focus:border-(--color-coral) transition-colors"
              />
            )}

            <div className="flex gap-2 justify-end pt-1">
              <Button variant="ghost" size="sm" onClick={onClose}>İptal</Button>
              <Button
                size="sm"
                disabled={!reason || submitting}
                onClick={submit}
                className="bg-(--color-coral) hover:bg-(--color-coral-hover) text-white"
              >
                {submitting ? 'Gönderiliyor...' : 'Raporla'}
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
