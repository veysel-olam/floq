'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { signIn, authClient } from '@/lib/auth-client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Loader2, ArrowRight, ShieldCheck } from 'lucide-react'

const schema = z.object({
  email: z.string().email('Geçerli bir e-posta gir'),
  password: z.string().min(1, 'Şifre gerekli'),
})

type FormData = z.infer<typeof schema>

export default function LoginPage() {
  const router = useRouter()
  const [error, setError] = useState<string | null>(null)
  const [twoFARequired, setTwoFARequired] = useState(false)
  const [totpCode, setTotpCode] = useState('')
  const [verifying, setVerifying] = useState(false)

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<FormData>({ resolver: zodResolver(schema) })

  async function onSubmit(data: FormData) {
    setError(null)
    const result = await signIn.email({ email: data.email, password: data.password })
    if (result.error) {
      if ((result.error as { code?: string }).code === 'TWO_FACTOR_REQUIRED') {
        setTwoFARequired(true)
        return
      }
      setError('E-posta veya şifre hatalı')
      return
    }
    router.push('/home')
  }

  async function verifyTotp() {
    setVerifying(true)
    setError(null)
    try {
      const result = await authClient.twoFactor.verifyTotp({ code: totpCode })
      if (result.error) { setError('Doğrulama kodu hatalı'); return }
      router.push('/home')
    } finally {
      setVerifying(false)
    }
  }

  if (twoFARequired) {
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
            style={{ background: 'rgba(232, 89, 60, 0.1)', border: '1px solid rgba(232, 89, 60, 0.2)' }}>
            <ShieldCheck className="w-5 h-5" style={{ color: 'var(--color-coral)' }} />
          </div>
          <div>
            <h1 className="text-xl font-bold text-(--color-text-primary)" style={{ fontFamily: 'var(--font-outfit)' }}>
              İki adımlı doğrulama
            </h1>
            <p className="text-xs text-(--color-text-tertiary)">Authenticator uygulamanızdaki kodu gir.</p>
          </div>
        </div>

        <div className="space-y-2">
          <Label className="text-sm text-(--color-text-secondary)">Doğrulama Kodu</Label>
          <Input
            value={totpCode}
            onChange={(e) => setTotpCode(e.target.value)}
            maxLength={6}
            placeholder="· · · · · ·"
            className="tracking-[0.5em] text-center text-xl font-mono h-12 rounded-xl border-(--color-border) bg-(--color-background) focus-visible:ring-(--color-coral)"
            autoFocus
          />
        </div>

        {error && (
          <p className="text-sm text-red-500 bg-red-50 dark:bg-red-950/20 px-3 py-2.5 rounded-xl">
            {error}
          </p>
        )}

        <Button
          onClick={verifyTotp}
          disabled={verifying || totpCode.length !== 6}
          className="w-full text-white font-semibold h-11 rounded-xl gap-2"
          style={{ background: 'var(--color-coral)' }}
        >
          {verifying ? <Loader2 className="w-4 h-4 animate-spin" /> : <>Doğrula <ArrowRight className="w-4 h-4" /></>}
        </Button>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-(--color-text-primary) mb-1" style={{ fontFamily: 'var(--font-outfit)' }}>
          Tekrar hoş geldin
        </h1>
        <p className="text-sm text-(--color-text-tertiary)">Akışına kaldığın yerden devam et.</p>
      </div>

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="email" className="text-sm font-medium text-(--color-text-secondary)">E-posta</Label>
          <Input
            id="email"
            type="email"
            placeholder="ornek@mail.com"
            {...register('email')}
            className="h-11 rounded-xl border-(--color-border) bg-(--color-background) focus-visible:ring-(--color-coral)"
          />
          {errors.email && <p className="text-xs text-red-500">{errors.email.message}</p>}
        </div>

        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <Label htmlFor="password" className="text-sm font-medium text-(--color-text-secondary)">Şifre</Label>
            <Link href="/forgot-password" className="text-xs hover:opacity-80 transition-opacity" style={{ color: 'var(--color-coral)' }}>
              Şifremi unuttum
            </Link>
          </div>
          <Input
            id="password"
            type="password"
            placeholder="••••••••"
            {...register('password')}
            className="h-11 rounded-xl border-(--color-border) bg-(--color-background) focus-visible:ring-(--color-coral)"
          />
          {errors.password && <p className="text-xs text-red-500">{errors.password.message}</p>}
        </div>

        {error && (
          <p className="text-sm text-red-500 bg-red-50 dark:bg-red-950/20 px-3 py-2.5 rounded-xl">
            {error}
          </p>
        )}

        <Button
          type="submit"
          disabled={isSubmitting}
          className="w-full text-white font-semibold h-11 rounded-xl gap-2 mt-2"
          style={{ background: 'var(--color-coral)' }}
        >
          {isSubmitting
            ? <><Loader2 className="w-4 h-4 animate-spin" /> Giriş yapılıyor…</>
            : <>Giriş yap <ArrowRight className="w-4 h-4" /></>}
        </Button>
      </form>

      <p className="text-center text-sm text-(--color-text-tertiary)">
        Hesabın yok mu?{' '}
        <Link href="/register" className="font-semibold hover:opacity-80 transition-opacity" style={{ color: 'var(--color-coral)' }}>
          Ücretsiz kaydol
        </Link>
      </p>
    </div>
  )
}
