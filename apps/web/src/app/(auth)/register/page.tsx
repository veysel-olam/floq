'use client'

import { useState, useEffect, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { signUp } from '@/lib/auth-client'
import { api } from '@/lib/api'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Loader2, Ticket, Globe, Lock, Database } from 'lucide-react'

const schema = z.object({
  name: z.string().min(2, 'En az 2 karakter').max(50),
  handle: z
    .string()
    .min(3, 'En az 3 karakter')
    .max(30, 'En fazla 30 karakter')
    .regex(/^[a-z0-9_]+$/, 'Sadece küçük harf, rakam ve alt çizgi'),
  email: z.string().email('Geçerli bir e-posta gir'),
  password: z.string().min(8, 'En az 8 karakter'),
  inviteCode: z.string().optional(),
})

type FormData = z.infer<typeof schema>

function RegisterForm() {
  const router = useRouter()
  const params = useSearchParams()
  const [error, setError] = useState<string | null>(null)
  const [requireInvite, setRequireInvite] = useState(false)
  const [inviteValid, setInviteValid] = useState<boolean | null>(null)
  const [checkingInvite, setCheckingInvite] = useState(false)

  const urlInvite = params.get('invite') ?? ''

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    formState: { errors, isSubmitting },
  } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: { inviteCode: urlInvite },
  })

  const inviteCode = watch('inviteCode') ?? ''

  useEffect(() => {
    async function check() {
      try {
        const data = await api.invites.validate(urlInvite || '__probe__')
        if (data.open) {
          setRequireInvite(false)
        } else {
          setRequireInvite(true)
          if (urlInvite) setInviteValid(data.valid)
        }
      } catch {
        setRequireInvite(false)
      }
    }
    void check()
  }, [urlInvite])

  useEffect(() => {
    if (!requireInvite || !inviteCode || inviteCode === urlInvite) return
    setInviteValid(null)
    const t = setTimeout(async () => {
      setCheckingInvite(true)
      try {
        const data = await api.invites.validate(inviteCode)
        setInviteValid(data.valid)
      } catch {
        setInviteValid(false)
      } finally {
        setCheckingInvite(false)
      }
    }, 400)
    return () => clearTimeout(t)
  }, [inviteCode, requireInvite, urlInvite])

  async function onSubmit(data: FormData) {
    setError(null)
    if (requireInvite && !inviteCode) { setError('Davet kodu gerekli.'); return }
    if (requireInvite && inviteValid === false) { setError('Geçersiz veya süresi dolmuş davet kodu.'); return }

    const result = await signUp.email({
      email: data.email,
      password: data.password,
      name: data.name,
      // @ts-expect-error: better-auth additional fields
      handle: data.handle,
    })

    if (result.error) { setError(result.error.message ?? 'Kayıt başarısız'); return }

    if (requireInvite && inviteCode && result.data?.user?.id) {
      try {
        await api.invites.use(inviteCode, result.data.user.id)
      } catch {
        setError('Davet kodu geçersiz. Hesabın oluşturulamadı.')
        return
      }
    }

    router.push(`/verify-email?email=${encodeURIComponent(data.email)}`)
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-(--color-text-primary) mb-1" style={{ fontFamily: 'var(--font-outfit)' }}>
          Hesap oluştur
        </h1>
        <p className="text-sm text-(--color-text-tertiary)">
          {requireInvite ? 'Beta erişimi için davet kodun gerekli.' : 'Akışına katıl. Ücretsiz, her zaman.'}
        </p>
      </div>

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
        {requireInvite && (
          <div className="space-y-1.5">
            <Label htmlFor="inviteCode" className="text-sm text-(--color-text-secondary)">Davet Kodu</Label>
            <div className="relative">
              <Ticket className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-(--color-text-tertiary)" />
              <Input
                id="inviteCode"
                placeholder="A3F9B2C1D4"
                className="pl-9 border-(--color-border) bg-(--color-background) focus-visible:ring-(--color-coral) uppercase"
                {...register('inviteCode')}
                onChange={(e) => setValue('inviteCode', e.target.value.toUpperCase())}
              />
              {checkingInvite && <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 animate-spin text-(--color-text-tertiary)" />}
              {!checkingInvite && inviteValid === true && <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-green-500 font-medium">✓ Geçerli</span>}
              {!checkingInvite && inviteValid === false && inviteCode && <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-red-500 font-medium">✗ Geçersiz</span>}
            </div>
          </div>
        )}

        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <Label htmlFor="name" className="text-sm text-(--color-text-secondary)">İsim</Label>
            <Input
              id="name"
              placeholder="Adın Soyadın"
              {...register('name')}
              className="border-(--color-border) bg-(--color-background) focus-visible:ring-(--color-coral)"
            />
            {errors.name && <p className="text-xs text-red-500">{errors.name.message}</p>}
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="handle" className="text-sm text-(--color-text-secondary)">Kullanıcı adı</Label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-(--color-text-tertiary) text-sm">@</span>
              <Input
                id="handle"
                placeholder="kullanici"
                className="pl-7 border-(--color-border) bg-(--color-background) focus-visible:ring-(--color-coral)"
                {...register('handle')}
              />
            </div>
            {errors.handle && <p className="text-xs text-red-500">{errors.handle.message}</p>}
            {!errors.handle && inviteCode !== undefined && watch('handle') && (
              <p className="text-[11px] text-(--color-text-tertiary) font-mono flex items-center gap-1">
                <Globe className="w-3 h-3 text-(--color-teal) flex-shrink-0" />
                @{watch('handle')}@floq.com
              </p>
            )}
          </div>
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="email" className="text-sm text-(--color-text-secondary)">E-posta</Label>
          <Input
            id="email"
            type="email"
            placeholder="ornek@mail.com"
            {...register('email')}
            className="border-(--color-border) bg-(--color-background) focus-visible:ring-(--color-coral)"
          />
          {errors.email && <p className="text-xs text-red-500">{errors.email.message}</p>}
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="password" className="text-sm text-(--color-text-secondary)">Şifre</Label>
          <Input
            id="password"
            type="password"
            placeholder="En az 8 karakter"
            {...register('password')}
            className="border-(--color-border) bg-(--color-background) focus-visible:ring-(--color-coral)"
          />
          {errors.password && <p className="text-xs text-red-500">{errors.password.message}</p>}
        </div>

        {error && <p className="text-sm text-red-500 bg-red-50 dark:bg-red-950/20 px-3 py-2 rounded-lg">{error}</p>}

        <Button
          type="submit"
          disabled={isSubmitting || (requireInvite && inviteValid === false)}
          className="w-full text-white font-semibold h-11 gap-2"
          style={{ background: 'var(--gradient-avatar)' }}
        >
          {isSubmitting
            ? <><Loader2 className="w-4 h-4 animate-spin" /> Oluşturuluyor…</>
            : 'Hesap oluştur'}
        </Button>
      </form>

      <div className="flex items-center justify-center gap-3 pt-1">
        <span className="flex items-center gap-1.5 text-[10px] font-semibold text-(--color-text-tertiary)">
          <Globe className="w-3 h-3 text-(--color-teal)" />
          ActivityPub
        </span>
        <span className="w-px h-3 bg-(--color-border)" />
        <span className="flex items-center gap-1.5 text-[10px] font-semibold text-(--color-text-tertiary)">
          <Lock className="w-3 h-3 text-(--color-teal)" />
          Açık Kaynak
        </span>
        <span className="w-px h-3 bg-(--color-border)" />
        <span className="flex items-center gap-1.5 text-[10px] font-semibold text-(--color-text-tertiary)">
          <Database className="w-3 h-3 text-(--color-teal)" />
          Verin Sende
        </span>
      </div>

      <p className="text-center text-sm text-(--color-text-tertiary)">
        Hesabın var mı?{' '}
        <Link href="/login" className="font-semibold hover:opacity-80 transition-opacity" style={{ color: '#E8593C' }}>
          Giriş yap
        </Link>
      </p>
    </div>
  )
}

export default function RegisterPage() {
  return (
    <Suspense>
      <RegisterForm />
    </Suspense>
  )
}
