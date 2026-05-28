'use client'

import { useEffect, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { Loader2, Users, AlertTriangle } from 'lucide-react'
import { api } from '@/lib/api'
import { FloqLogo } from '@/components/floq-logo'
import { toast } from 'sonner'

export default function JoinPage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const token = searchParams.get('invite')

  const [status, setStatus] = useState<'loading' | 'success' | 'error'>('loading')
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!token) {
      setError('Davet linki geçersiz.')
      setStatus('error')
      return
    }

    api.communities.joinByInvite(token)
      .then((result) => {
        setStatus('success')
        toast.success('Topluluğa katıldın!')
        setTimeout(() => router.push(`/c/${result.handle}`), 1200)
      })
      .catch((err: unknown) => {
        const msg = (err as { message?: string }).message ?? 'Davet linki geçersiz veya süresi dolmuş.'
        setError(msg)
        setStatus('error')
      })
  }, [token, router])

  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-6">
      <div className="mb-8">
        <FloqLogo size="md" />
      </div>

      <div className="w-full max-w-sm text-center space-y-4">
        {status === 'loading' && (
          <>
            <div className="w-14 h-14 rounded-2xl bg-(--color-background-secondary) flex items-center justify-center mx-auto">
              <Loader2 className="w-6 h-6 animate-spin text-(--color-coral)" />
            </div>
            <p className="font-semibold text-(--color-text-primary)">Topluluğa katılıyorsun…</p>
            <p className="text-sm text-(--color-text-tertiary)">Bir saniye bekle.</p>
          </>
        )}

        {status === 'success' && (
          <>
            <div className="w-14 h-14 rounded-2xl bg-(--color-coral)/10 flex items-center justify-center mx-auto">
              <Users className="w-6 h-6 text-(--color-coral)" />
            </div>
            <p className="font-semibold text-(--color-text-primary)">Katıldın!</p>
            <p className="text-sm text-(--color-text-tertiary)">Topluluk sayfasına yönlendiriliyorsun…</p>
          </>
        )}

        {status === 'error' && (
          <>
            <div className="w-14 h-14 rounded-2xl bg-red-50 dark:bg-red-950/20 flex items-center justify-center mx-auto">
              <AlertTriangle className="w-6 h-6 text-red-500" />
            </div>
            <p className="font-semibold text-(--color-text-primary)">Katılım başarısız</p>
            <p className="text-sm text-(--color-text-tertiary)">{error}</p>
            <button
              onClick={() => router.push('/communities')}
              className="mt-2 text-sm text-(--color-coral) font-medium hover:underline"
            >
              Toplulukları keşfet
            </button>
          </>
        )}
      </div>
    </div>
  )
}
