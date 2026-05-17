'use client'

import { useState, useEffect, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Loader2, ArrowRight, ShieldCheck, AlertCircle } from 'lucide-react'

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001'

function ResetPasswordForm() {
  const router = useRouter()
  const params = useSearchParams()
  const token = params.get('token')

  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [done, setDone] = useState(false)

  useEffect(() => {
    if (!token) setError('Geçersiz veya süresi dolmuş bağlantı.')
  }, [token])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!token) return
    if (password.length < 8) { setError('Şifre en az 8 karakter olmalı.'); return }
    if (password !== confirm) { setError('Şifreler eşleşmiyor.'); return }

    setLoading(true)
    setError(null)
    try {
      const res = await fetch(`${API_URL}/api/auth/reset-password`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ newPassword: password, token }),
      })
      if (!res.ok) {
        const data = await res.json().catch(() => ({})) as { error?: string }
        setError(data.error === 'INVALID_TOKEN' ? 'Bağlantı geçersiz veya süresi dolmuş.' : 'Bir hata oluştu.')
        return
      }
      setDone(true)
      setTimeout(() => router.push('/login'), 2500)
    } catch {
      setError('Sunucuya ulaşılamadı.')
    } finally {
      setLoading(false)
    }
  }

  if (done) {
    return (
      <div className="space-y-4 text-center">
        <div className="flex justify-center">
          <div className="w-14 h-14 rounded-2xl flex items-center justify-center bg-emerald-50 dark:bg-emerald-950/30">
            <ShieldCheck className="w-7 h-7 text-emerald-500" />
          </div>
        </div>
        <div>
          <h1 className="text-xl font-bold text-(--color-text-primary) mb-1" style={{ fontFamily: 'var(--font-outfit)' }}>Şifre güncellendi!</h1>
          <p className="text-sm text-(--color-text-tertiary)">Giriş sayfasına yönlendiriliyorsun…</p>
        </div>
      </div>
    )
  }

  if (!token) {
    return (
      <div className="space-y-4 text-center">
        <AlertCircle className="w-12 h-12 text-red-400 mx-auto" />
        <div>
          <h1 className="text-xl font-bold text-(--color-text-primary) mb-1" style={{ fontFamily: 'var(--font-outfit)' }}>Geçersiz bağlantı</h1>
          <p className="text-sm text-(--color-text-tertiary)">Bu şifre sıfırlama bağlantısı geçersiz veya süresi dolmuş.</p>
        </div>
        <Link href="/forgot-password" className="text-sm font-semibold" style={{ color: '#E8593C' }}>
          Yeni bağlantı iste
        </Link>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
          style={{ background: 'rgba(232, 89, 60, 0.1)', border: '1px solid rgba(232, 89, 60, 0.2)' }}>
          <ShieldCheck className="w-5 h-5" style={{ color: '#E8593C' }} />
        </div>
        <div>
          <h1 className="text-xl font-bold text-(--color-text-primary)" style={{ fontFamily: 'var(--font-outfit)' }}>
            Yeni şifre belirle
          </h1>
          <p className="text-xs text-(--color-text-tertiary)">En az 8 karakter olmalı.</p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="password" className="text-sm font-medium text-(--color-text-secondary)">Yeni Şifre</Label>
          <Input
            id="password"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="••••••••"
            minLength={8}
            required
            autoFocus
            className="h-11 border-(--color-border) bg-(--color-background) focus-visible:ring-(--color-coral)"
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="confirm" className="text-sm font-medium text-(--color-text-secondary)">Şifreyi Tekrarla</Label>
          <Input
            id="confirm"
            type="password"
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
            placeholder="••••••••"
            required
            className="h-11 border-(--color-border) bg-(--color-background) focus-visible:ring-(--color-coral)"
          />
        </div>

        {error && (
          <p className="text-sm text-red-500 bg-red-50 dark:bg-red-950/20 px-3 py-2.5 rounded-xl">
            {error}
          </p>
        )}

        <Button
          type="submit"
          disabled={loading || !password || !confirm}
          className="w-full text-white font-semibold h-11 gap-2"
          style={{ background: 'var(--gradient-avatar)' }}
        >
          {loading
            ? <Loader2 className="w-4 h-4 animate-spin" />
            : <>Şifremi Güncelle <ArrowRight className="w-4 h-4" /></>}
        </Button>
      </form>
    </div>
  )
}

export default function ResetPasswordPage() {
  return (
    <Suspense fallback={<div className="flex justify-center py-8"><Loader2 className="w-6 h-6 animate-spin" style={{ color: '#E8593C' }} /></div>}>
      <ResetPasswordForm />
    </Suspense>
  )
}
