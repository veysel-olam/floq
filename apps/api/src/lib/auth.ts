import { betterAuth } from 'better-auth'
import { bearer, twoFactor } from 'better-auth/plugins'
import { drizzleAdapter } from 'better-auth/adapters/drizzle'
import { db } from '../db/client.js'
import { user, session, account, verification, twoFactor as twoFactorTable, actors } from '../db/schema.js'
import { env } from './env.js'
import { generateActorKeyPair, generateEd25519KeyPair } from './keys.js'
import { sendEmail, passwordResetEmail, emailVerificationEmail } from './email.js'
import { eq } from 'drizzle-orm'

export const auth = betterAuth({
  baseURL: env.BETTER_AUTH_URL,
  secret: env.BETTER_AUTH_SECRET,

  database: drizzleAdapter(db, {
    provider: 'pg',
    schema: { user, session, account, verification, twoFactor: twoFactorTable },
  }),

  emailAndPassword: {
    enabled: true,
    requireEmailVerification: false,
    minPasswordLength: 8,
    sendResetPassword: async ({ user: u, url }) => {
      await sendEmail({
        to: u.email,
        subject: 'Floq — Şifre Sıfırlama',
        html: passwordResetEmail(url),
      })
    },
  },

  emailVerification: {
    sendVerificationEmail: async ({ user: u, url }) => {
      // Ensure the callbackURL redirects to the frontend after verification
      const fixedUrl = url.replace(
        /callbackURL=[^&]*/,
        `callbackURL=${encodeURIComponent(`${env.WEB_URL}/home`)}`,
      )
      await sendEmail({
        to: u.email,
        subject: 'Floq — E-posta Doğrulama',
        html: emailVerificationEmail(fixedUrl),
      })
    },
    autoSignInAfterVerification: true,
    sendOnSignUp: true,
  },

  session: {
    expiresIn: 60 * 60 * 24 * 30, // 30 gün
    updateAge: 60 * 60 * 24,       // her gün yenile
    cookieCache: { enabled: true, maxAge: 60 * 5 },
  },

  user: {
    additionalFields: {
      handle: {
        type: 'string',
        required: true,
        input: true,
      },
      birthYear: {
        type: 'number',
        required: false,
        input: true,
      },
    },
  },

  trustedOrigins: [env.WEB_URL],
  rateLimit: {
    enabled: env.NODE_ENV === 'production',
  },
  plugins: [bearer(), twoFactor()],

  databaseHooks: {
    user: {
      create: {
        // Child safety: reject under-13 signups (COPPA-style). Birth year is
        // collected at signup; <13 is hard-rejected, 13-17 → restricted mode.
        before: async (userData) => {
          const by = (userData as { birthYear?: number }).birthYear
          if (by) {
            const age = new Date().getFullYear() - by
            if (age < 13) {
              throw new Error('13 yaşından küçükler kayıt olamaz.')
            }
          }
        },
        after: async (createdUser) => {
          // Kayıt sonrası otomatik actor oluştur
          const domain = env.APP_DOMAIN
          const handle = (createdUser as typeof createdUser & { handle: string }).handle
          const apBase = `${env.APP_URL}/users/${handle}`

          const birthYear = (createdUser as { birthYear?: number }).birthYear ?? null
          const age = birthYear ? new Date().getFullYear() - birthYear : null
          const isMinor = age !== null && age >= 13 && age <= 17

          const { publicKeyPem, privateKeyEncrypted } = await generateActorKeyPair()
          const { publicKeyMultibase, privateKeyEncrypted: ed25519PrivateKeyEncrypted } = generateEd25519KeyPair()

          await db.insert(actors).values({
            userId: createdUser.id,
            apId: apBase,
            handle,
            displayName: createdUser.name,
            inboxUrl: `${apBase}/inbox`,
            outboxUrl: `${apBase}/outbox`,
            followersUrl: `${apBase}/followers`,
            followingUrl: `${apBase}/following`,
            profileUrl: `${env.APP_URL}/@${handle}`,
            sharedInboxUrl: `${env.APP_URL}/inbox`,
            publicKey: publicKeyPem,
            privateKeyEncrypted,
            ed25519PublicKey: publicKeyMultibase,
            ed25519PrivateKeyEncrypted,
            isLocal: true,
            instanceId: await getOrCreateLocalInstance(domain),
            birthYear,
            isMinor,
            // Minors are hidden from discovery/search by default (restricted mode).
            noIndex: isMinor,
          })
        },
      },
    },
  },
})

async function getOrCreateLocalInstance(domain: string): Promise<string> {
  const { instances } = await import('../db/schema.js')
  const existing = await db.query.instances.findFirst({
    where: eq(instances.domain, domain),
  })
  if (existing) return existing.id

  const [created] = await db
    .insert(instances)
    .values({ domain, software: 'floq', name: 'floq' })
    .returning({ id: instances.id })

  return created!.id
}

export type Auth = typeof auth
