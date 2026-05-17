'use client'

import { useState } from 'react'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Loader2, ArrowLeft, Mail, CheckCircle2 } from 'lucide-react'

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001'

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('')
  const [loading, setLoading] = useState(false)
  const [sent, setSent] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!email.trim()) return
    setLoading(true)
    setError(null)
    try {
      const res = await fetch(`${API_URL}/api/auth/request-password-reset`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          email,
          redirectTo: `${window.location.origin}/reset-password`,
        }),
      })
      if (!res.ok && res.status !== 200) {
        // better-auth returns 200 even for unknown emails (security best practice)
        const data = await res.json().catch(() => ({})) as { error?: string }
        setError(data.error ?? 'Bir hata oluştu. Lütfen tekrar dene.')
        return
      }
      setSent(true)
    } catch {
      setError('Sunucuya ulaşılamadı. Lütfen tekrar dene.')
    } finally {
      setLoading(false)
    }
  }

  if (sent) {
    return (
      <div className="space-y-6 text-center">
        <div className="flex justify-center">
          <div className="w-14 h-14 rounded-2xl flex items-center justify-center bg-emerald-50 dark:bg-emerald-950/30">
            <CheckCircle2 className="w-7 h-7 text-emerald-500" />
          </div>
        </div>
        <div>
          <h1 className="text-xl font-bold text-(--color-text-primary) mb-2" style={{ fontFamily: 'var(--font-outfit)' }}>
            E-posta gönderildi
          </h1>
          <p className="text-sm text-(--color-text-tertiary) leading-relaxed">
            <strong className="text-(--color-text-secondary)">{email}</strong> adresine şifre sıfırlama bağlantısı gönderdik.
            Gelmezse spam klasörünü kontrol et.
          </p>
        </div>
        <Link
          href="/login"
          className="flex items-center justify-center gap-2 text-sm font-medium"
          style={{ color: '#E8593C' }}
        >
          <ArrowLeft className="w-4 h-4" />
          Giriş sayfasına dön
        </Link>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
          style={{ background: 'rgba(232, 89, 60, 0.1)', border: '1px solid rgba(232, 89, 60, 0.2)' }}>
          <Mail className="w-5 h-5" style={{ color: '#E8593C' }} />
        </div>
        <div>
          <h1 className="text-xl font-bold text-(--color-text-primary)" style={{ fontFamily: 'var(--font-outfit)' }}>
            Şifreni sıfırla
          </h1>
          <p className="text-xs text-(--color-text-tertiary)">Sıfırlama bağlantısını e-postana gönderelim.</p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="email" className="text-sm font-medium text-(--color-text-secondary)">E-posta</Label>
          <Input
            id="email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="ornek@mail.com"
            required
            autoFocus
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
          disabled={loading || !email.trim()}
          className="w-full text-white font-semibold h-11 gap-2"
          style={{ background: 'var(--gradient-avatar)' }}
        >
          {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Bağlantı Gönder'}
        </Button>
      </form>

      <p className="text-center text-sm text-(--color-text-tertiary)">
        <Link href="/login" className="flex items-center justify-center gap-1.5 hover:opacity-80 transition-opacity" style={{ color: '#E8593C' }}>
          <ArrowLeft className="w-3.5 h-3.5" />
          Giriş sayfasına dön
        </Link>
      </p>
    </div>
  )
}
