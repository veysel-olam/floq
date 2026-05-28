'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Snowflake, Loader2 } from 'lucide-react'
import { api } from '@/lib/api'
import { Button } from '@/components/ui/button'

export default function FrozenPage() {
  const router = useRouter()
  const [loading, setLoading] = useState(false)

  async function unfreeze() {
    setLoading(true)
    try {
      await api.account.unfreeze()
      router.push('/home')
    } catch {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-(--color-background) px-4">
      <div className="max-w-sm w-full text-center space-y-6">
        <div className="w-16 h-16 rounded-full bg-(--color-blush) dark:bg-(--color-coral)/12 flex items-center justify-center mx-auto">
          <Snowflake className="w-8 h-8 text-(--color-coral)" />
        </div>
        <div className="space-y-2">
          <h1 className="text-xl font-bold text-(--color-text-primary)">Hesabın dondurulmuş</h1>
          <p className="text-sm text-(--color-text-tertiary) leading-relaxed">
            Floq'tan geçici olarak ayrıldın. Kaldığın yerden devam etmek için hesabını yeniden etkinleştirebilirsin.
          </p>
        </div>
        <Button
          onClick={() => void unfreeze()}
          disabled={loading}
          className="w-full bg-(--color-coral) hover:bg-(--color-coral-hover) text-white rounded-full gap-2"
        >
          {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Snowflake className="w-4 h-4" />}
          Hesabımı Yeniden Etkinleştir
        </Button>
        <p className="text-xs text-(--color-text-tertiary)">
          Hesabını kalıcı olarak silmek istiyorsan{' '}
          <a href="/settings?tab=account" className="text-(--color-coral) hover:underline">
            Hesap Ayarları
          </a>
          &apos;na git.
        </p>
      </div>
    </div>
  )
}
