'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { api, type GifResult } from '@/lib/api'
import { Loader2, Search, X } from 'lucide-react'
import { cn } from '@/lib/utils'

interface GifPickerProps {
  onSelect: (gif: GifResult) => void
  onClose: () => void
}

export function GifPicker({ onSelect, onClose }: GifPickerProps) {
  const [query, setQuery] = useState('')
  const [gifs, setGifs] = useState<GifResult[]>([])
  const [loading, setLoading] = useState(true)
  const [enabled, setEnabled] = useState(true)
  const containerRef = useRef<HTMLDivElement>(null)

  const load = useCallback(async (q: string) => {
    setLoading(true)
    try {
      const res = q.trim() ? await api.gifs.search(q.trim()) : await api.gifs.featured()
      setGifs(res.gifs)
      setEnabled(res.enabled)
    } catch {
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { void load('') }, [load])

  useEffect(() => {
    const t = setTimeout(() => void load(query), 400)
    return () => clearTimeout(t)
  }, [query, load])

  useEffect(() => {
    function onKey(e: KeyboardEvent) { if (e.key === 'Escape') onClose() }
    function onOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) onClose()
    }
    document.addEventListener('keydown', onKey)
    document.addEventListener('mousedown', onOutside)
    return () => { document.removeEventListener('keydown', onKey); document.removeEventListener('mousedown', onOutside) }
  }, [onClose])

  // Split gifs into 2 columns for masonry layout
  const col1 = gifs.filter((_, i) => i % 2 === 0)
  const col2 = gifs.filter((_, i) => i % 2 === 1)

  return (
    <div
      ref={containerRef}
      className="absolute bottom-full left-0 mb-2 w-80 rounded-2xl border border-(--color-border) bg-(--color-background) shadow-xl z-30 flex flex-col overflow-hidden"
      style={{ maxHeight: '360px' }}
    >
      {/* Header */}
      <div className="flex items-center gap-2 p-2 border-b border-(--color-border)">
        <div className="relative flex-1">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-(--color-text-tertiary)" />
          <input
            autoFocus
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="GIF ara..."
            className="w-full pl-8 pr-2 py-1.5 text-xs rounded-lg bg-(--color-background-secondary) border-0 outline-none text-(--color-text-primary) placeholder:text-(--color-text-tertiary)"
          />
        </div>
        <button
          onClick={onClose}
          className="p-1 rounded-lg text-(--color-text-tertiary) hover:text-(--color-text-primary) hover:bg-(--color-background-secondary) transition-colors"
        >
          <X className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* Body */}
      <div className="flex-1 overflow-y-auto p-1.5">
        {!enabled ? (
          <div className="py-8 text-center">
            <p className="text-xs text-(--color-text-tertiary)">GIF arama aktif değil.</p>
            <p className="text-[10px] text-(--color-text-tertiary) mt-1">TENOR_API_KEY env değişkenini ayarla.</p>
          </div>
        ) : loading ? (
          <div className="py-8 flex justify-center">
            <Loader2 className="w-5 h-5 animate-spin text-(--color-coral)" />
          </div>
        ) : gifs.length === 0 ? (
          <div className="py-8 text-center">
            <p className="text-xs text-(--color-text-tertiary)">Sonuç bulunamadı.</p>
          </div>
        ) : (
          <div className="flex gap-1">
            {[col1, col2].map((col, ci) => (
              <div key={ci} className="flex-1 flex flex-col gap-1">
                {col.map((gif) => {
                  const aspectPct = gif.height && gif.width ? (gif.height / gif.width) * 100 : 56
                  return (
                    <button
                      key={gif.id}
                      onClick={() => onSelect(gif)}
                      className={cn(
                        'relative w-full rounded-lg overflow-hidden bg-(--color-background-secondary)',
                        'hover:ring-2 hover:ring-(--color-coral) transition-all',
                      )}
                      style={{ paddingBottom: `${Math.min(aspectPct, 120)}%` }}
                      title={gif.title}
                    >
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={gif.previewUrl}
                        alt={gif.title}
                        loading="lazy"
                        className="absolute inset-0 w-full h-full object-cover"
                      />
                    </button>
                  )
                })}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Tenor attribution */}
      {enabled && (
        <div className="px-2 py-1 border-t border-(--color-border) flex justify-end">
          <span className="text-[10px] text-(--color-text-tertiary)">Powered by Tenor</span>
        </div>
      )}
    </div>
  )
}
