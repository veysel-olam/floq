'use client'

import { useState, useEffect, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { authClient } from '@/lib/auth-client'
import { Button } from '@/components/ui/button'
import { Loader2, Mail, CheckCircle2, AlertCircle } from 'lucide-react'

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001'

function VerifyEmailContent() {
  const router = useRouter()
  const params = useSearchParams()
  const token = params.get('token')
  const email = params.get('email')

  const [status, setStatus] = useState<'verifying' | 'success' | 'error' | 'resent' | 'sending'>('verifying')
  const [errorMsg, setErrorMsg] = useState('')

  useEffect(() => {
    if (!token) {
      // No token — show "check your email" screen
      setStatus('error')
      setErrorMsg('__no_token__')
      return
    }

    async function verify() {
      try {
        const res = await fetch(`${API_URL}/api/auth/verify-email?token=${token}`, {
          credentials: 'include',
          redirect: 'follow',
        })
        if (res.ok || res.redirected) {
          setStatus('success')
          setTimeout(() => router.push('/onboarding'), 2000)
        } else {
          const data = await res.json().catch(() => ({})) as { error?: string }
          setErrorMsg(data.error ?? 'Doğrulama başarısız.')
          setStatus('error')
        }
      } catch {
        setErrorMsg('Sunucuya ulaşılamadı.')
        setStatus('error')
      }
    }

    void verify()
  }, [token, router])

  async function resend() {
    const targetEmail = email ?? ''
    if (!targetEmail) return
    setStatus('sending')
    try {
      await fetch(`${API_URL}/api/auth/send-verification-email`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          email: targetEmail,
          callbackURL: `${window.location.origin}/verify-email`,
        }),
      })
      setStatus('resent')
    } catch {
      setStatus('error')
      setErrorMsg('Gönderilemedi, lütfen tekrar dene.')
    }
  }

  if (status === 'verifying') {
    return (
      <div className="space-y-4 text-center py-4">
        <Loader2 className="w-10 h-10 animate-spin mx-auto" style={{ color: 'var(--color-coral)' }} />
        <p className="text-sm text-(--color-text-tertiary)">E-posta adresi doğrulanıyor…</p>
      </div>
    )
  }

  if (status === 'success') {
    return (
      <div className="space-y-4 text-center">
        <div className="flex justify-center">
          <div className="w-14 h-14 rounded-2xl flex items-center justify-center bg-emerald-50 dark:bg-emerald-950/30">
            <CheckCircle2 className="w-7 h-7 text-emerald-500" />
          </div>
        </div>
        <div>
          <h1 className="text-xl font-bold text-(--color-text-primary) mb-1" style={{ fontFamily: 'var(--font-outfit)' }}>E-posta doğrulandı!</h1>
          <p className="text-sm text-(--color-text-tertiary)">Ana sayfaya yönlendiriliyorsun…</p>
        </div>
      </div>
    )
  }

  if (status === 'resent') {
    return (
      <div className="space-y-4 text-center">
        <div className="flex justify-center">
          <div className="w-14 h-14 rounded-2xl flex items-center justify-center bg-blue-50 dark:bg-blue-950/30">
            <Mail className="w-7 h-7 text-blue-500" />
          </div>
        </div>
        <div>
          <h1 className="text-xl font-bold text-(--color-text-primary) mb-1" style={{ fontFamily: 'var(--font-outfit)' }}>E-posta gönderildi</h1>
          <p className="text-sm text-(--color-text-tertiary)">Gelen kutunu ve spam klasörünü kontrol et.</p>
        </div>
      </div>
    )
  }

  // No token — "check your email" screen
  if (errorMsg === '__no_token__') {
    return (
      <div className="space-y-6 text-center">
        <div className="flex justify-center">
          <div className="w-14 h-14 rounded-2xl flex items-center justify-center" style={{ background: 'rgba(232, 89, 60, 0.1)' }}>
            <Mail className="w-7 h-7" style={{ color: 'var(--color-coral)' }} />
          </div>
        </div>
        <div>
          <h1 className="text-xl font-bold text-(--color-text-primary) mb-2" style={{ fontFamily: 'var(--font-outfit)' }}>
            E-postanı doğrula
          </h1>
          <p className="text-sm text-(--color-text-tertiary) leading-relaxed">
            {email
              ? <><strong className="text-(--color-text-secondary)">{email}</strong> adresine doğrulama bağlantısı gönderdik.</>
              : 'Kayıt sırasında verdiğin e-posta adresine doğrulama bağlantısı gönderdik.'}
            {' '}Gelmezse spam klasörünü kontrol et.
          </p>
        </div>
        {email && (
          <Button
            onClick={resend}
            disabled={status === 'sending'}
            variant="outline"
            className="w-full border-(--color-border)"
          >
            {status === 'sending' ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Tekrar Gönder'}
          </Button>
        )}
        <Link href="/login" className="block text-sm text-(--color-text-tertiary) hover:text-(--color-text-secondary) transition-colors">
          Giriş yap
        </Link>
      </div>
    )
  }

  return (
    <div className="space-y-4 text-center">
      <AlertCircle className="w-12 h-12 text-red-400 mx-auto" />
      <div>
        <h1 className="text-xl font-bold text-(--color-text-primary) mb-1" style={{ fontFamily: 'var(--font-outfit)' }}>Doğrulama başarısız</h1>
        <p className="text-sm text-(--color-text-tertiary)">{errorMsg}</p>
      </div>
      <Link href="/login" className="text-sm font-semibold" style={{ color: 'var(--color-coral)' }}>
        Giriş sayfasına dön
      </Link>
    </div>
  )
}

export default function VerifyEmailPage() {
  return (
    <Suspense fallback={<div className="flex justify-center py-8"><Loader2 className="w-6 h-6 animate-spin" style={{ color: 'var(--color-coral)' }} /></div>}>
      <VerifyEmailContent />
    </Suspense>
  )
}
