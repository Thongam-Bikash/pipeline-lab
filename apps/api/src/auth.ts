import { drizzleAdapter } from '@better-auth/drizzle-adapter'
import { betterAuth } from 'better-auth'
import * as authSchema from './auth-schema.js'
import { db } from './db.js'
import { sendMail } from './mail.js'

const google = {
  clientId: process.env.GOOGLE_CLIENT_ID ?? '',
  clientSecret: process.env.GOOGLE_CLIENT_SECRET ?? '',
}

// Not awaited: an awaited send would make a reset request slower for a registered address than an
// unknown one, which gives away who has an account.
const send = (to: string, subject: string, text: string) => {
  sendMail(to, subject, text).catch((error: unknown) => console.error(`Could not send "${subject}"`, error))
}

// The secret and base URL come from BETTER_AUTH_SECRET and BETTER_AUTH_URL.
export const auth = betterAuth({
  // Without the schema the adapter cannot map its models to tables, and every request fails.
  database: drizzleAdapter(db, { provider: 'pg', schema: authSchema }),
  trustedOrigins: process.env.TRUSTED_ORIGINS?.split(',').filter(Boolean) ?? [],
  emailVerification: {
    sendOnSignUp: true,
    autoSignInAfterVerification: true,
    sendVerificationEmail: async ({ user, url }) =>
      send(
        user.email,
        'Confirm your email for Pipeline Lab',
        `Open this link to confirm your email address and finish creating your account:\n\n${url}\n\nIf you did not sign up, you can ignore this email.`,
      ),
  },
  emailAndPassword: {
    enabled: true,
    requireEmailVerification: true,
    sendResetPassword: async ({ user, url }) =>
      send(
        user.email,
        'Reset your Pipeline Lab password',
        `Open this link to choose a new password:\n\n${url}\n\nIf you did not ask for this, you can ignore this email. Your password has not changed.`,
      ),
  },
  // Both values or neither, so a half-configured Google sign-in cannot exist.
  ...(google.clientId && google.clientSecret ? { socialProviders: { google } } : {}),
  user: { deleteUser: { enabled: true } },
  // On by default when NODE_ENV is production, which is how the API image runs.
  rateLimit: {
    // Only the end-to-end test stack turns this off: it signs up far more often than any person would.
    ...(process.env.RATE_LIMIT === 'off' ? { enabled: false } : {}),
    customRules: {
      '/sign-in/email': { window: 60, max: 5 },
      '/sign-up/email': { window: 3600, max: 5 },
      '/request-password-reset': { window: 3600, max: 5 },
      '/reset-password': { window: 3600, max: 10 },
    },
  },
})
