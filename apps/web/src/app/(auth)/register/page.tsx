'use client'

import { useState, useEffect, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { signUp } from '@/lib/auth-client'
import { api } from '@/lib/api'
import { instanceDomain } from '@/lib/instance'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Loader2, Ticket, Globe } from 'lucide-react'

const schema = z.object({
  name: z.string().min(2, 'En az 2 karakter').max(50),
  handle: z
    .string()
    .min(3, 'En az 3 karakter')
    .max(30, 'En fazla 30 karakter')
    .regex(/^[a-z0-9_]+$/, 'Sadece küçük harf, rakam ve alt çizgi'),
  email: z.string().email('Geçerli bir e-posta gir'),
  password: z.string().min(8, 'En az 8 karakter'),
  birthYear: z.coerce.number()
    .int()
    .min(1900, 'Geçerli bir yıl gir')
    .max(new Date().getFullYear(), 'Geçerli bir yıl gir')
    .refine((y) => new Date().getFullYear() - y >= 13, '13 yaşından küçükler kayıt olamaz'),
  inviteCode: z.string().optional(),
  termsAccepted: z.boolean().refine((val) => val === true, 'Devam etmek için koşulları kabul etmelisin'),
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
    defaultValues: { inviteCode: urlInvite, termsAccepted: false },
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
      birthYear: data.birthYear,
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
                className="pl-9 rounded-xl border-(--color-border) bg-(--color-background) focus-visible:ring-(--color-coral) uppercase"
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
              className="rounded-xl border-(--color-border) bg-(--color-background) focus-visible:ring-(--color-coral)"
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
                className="pl-7 rounded-xl border-(--color-border) bg-(--color-background) focus-visible:ring-(--color-coral)"
                {...register('handle')}
              />
            </div>
            {errors.handle && <p className="text-xs text-red-500">{errors.handle.message}</p>}
            {!errors.handle && watch('handle') && (
              <div className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-(--color-background-secondary) border border-(--color-border)">
                <Globe className="w-3 h-3 text-(--color-coral) flex-shrink-0" />
                <p className="text-[11px] text-(--color-text-secondary) font-mono">@{watch('handle')}@{instanceDomain()}</p>
                <span className="text-[10px] text-(--color-text-tertiary) ml-auto">fediverse adresin</span>
              </div>
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
            className="rounded-xl border-(--color-border) bg-(--color-background) focus-visible:ring-(--color-coral)"
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
            className="rounded-xl border-(--color-border) bg-(--color-background) focus-visible:ring-(--color-coral)"
          />
          {errors.password && <p className="text-xs text-red-500">{errors.password.message}</p>}
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="birthYear" className="text-sm text-(--color-text-secondary)">Doğum yılı</Label>
          <Input
            id="birthYear"
            type="number"
            inputMode="numeric"
            placeholder="örn. 2000"
            {...register('birthYear')}
            className="rounded-xl border-(--color-border) bg-(--color-background) focus-visible:ring-(--color-coral)"
          />
          {errors.birthYear && <p className="text-xs text-red-500">{errors.birthYear.message}</p>}
          <p className="text-[11px] text-(--color-text-tertiary)">13 yaş ve üzeri kayıt olabilir. 13-17 yaş için bazı özellikler kısıtlıdır.</p>
        </div>

        <div className="space-y-1">
          <div className="flex items-start gap-2.5">
            <input
              id="termsAccepted"
              type="checkbox"
              className="mt-0.5 w-4 h-4 rounded accent-(--color-coral) cursor-pointer flex-shrink-0"
              {...register('termsAccepted')}
            />
            <p className="text-sm text-(--color-text-secondary) leading-snug">
              <Link href="/terms" target="_blank" className="font-medium text-(--color-coral) hover:underline">Kullanım Koşulları</Link>
              {' '}ve{' '}
              <Link href="/privacy" target="_blank" className="font-medium text-(--color-coral) hover:underline">Gizlilik Politikası</Link>
              &apos;nı okudum ve kabul ediyorum.
            </p>
          </div>
          {errors.termsAccepted && <p className="text-xs text-red-500 pl-6">{errors.termsAccepted.message}</p>}
        </div>

        {error && <p className="text-sm text-red-500 bg-red-50 dark:bg-red-950/20 px-3 py-2 rounded-lg">{error}</p>}

        <Button
          type="submit"
          disabled={isSubmitting || (requireInvite && inviteValid === false)}
          className="w-full text-white font-semibold h-11 rounded-xl gap-2"
          style={{ background: 'var(--color-coral)' }}
        >
          {isSubmitting
            ? <><Loader2 className="w-4 h-4 animate-spin" /> Oluşturuluyor…</>
            : 'Hesap oluştur'}
        </Button>
      </form>

<p className="text-center text-sm text-(--color-text-tertiary)">
        Hesabın var mı?{' '}
        <Link href="/login" className="font-semibold hover:opacity-80 transition-opacity" style={{ color: 'var(--color-coral)' }}>
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
