'use client'

import { X } from 'lucide-react'

const SHORTCUTS = [
  { key: 'j', desc: 'Sonraki gönderi' },
  { key: 'k', desc: 'Önceki gönderi' },
  { key: 'n', desc: 'Yeni gönderi yaz' },
  { key: 'l', desc: 'Beğen / Beğeniyi kaldır' },
  { key: 'r', desc: 'Yanıtla' },
  { key: 'b', desc: 'Yeniden paylaş' },
  { key: '/', desc: 'Aramaya odaklan' },
  { key: '?', desc: 'Bu yardımı göster / kapat' },
]

export function KeyboardShortcutsHelp({ onClose }: { onClose: () => void }) {
  return (
    <>
      <div className="fixed inset-0 z-40 bg-black/40 backdrop-blur-sm" onClick={onClose} />
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 pointer-events-none">
        <div
          className="pointer-events-auto w-full max-w-sm rounded-2xl border border-(--color-border) bg-(--color-background) shadow-2xl overflow-hidden"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="flex items-center justify-between px-5 py-4 border-b border-(--color-border)">
            <p className="text-sm font-semibold text-(--color-text-primary)">Klavye kısayolları</p>
            <button
              onClick={onClose}
              aria-label="Kapat"
              className="p-1 rounded-lg text-(--color-text-tertiary) hover:text-(--color-text-primary) transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
          <div className="px-5 py-4 space-y-1">
            {SHORTCUTS.map(({ key, desc }) => (
              <div key={key} className="flex items-center justify-between py-1.5">
                <span className="text-sm text-(--color-text-secondary)">{desc}</span>
                <kbd className="inline-flex items-center justify-center min-w-[28px] h-7 px-2 rounded-lg bg-(--color-background-secondary) border border-(--color-border) text-xs font-mono font-medium text-(--color-text-primary)">
                  {key}
                </kbd>
              </div>
            ))}
          </div>
          <div className="px-5 pb-4">
            <p className="text-[11px] text-(--color-text-tertiary)">
              Kısayollar metin alanlarında devre dışıdır.
            </p>
          </div>
        </div>
      </div>
    </>
  )
}
