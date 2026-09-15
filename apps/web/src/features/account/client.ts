import { createAuthClient } from 'better-auth/react'

// No base URL: the API shares the page's origin in dev, preview and the web container.
export const authClient = createAuthClient()

export function explain(error: { code?: string; message?: string; status?: number }) {
  if (error.status === 429) return 'Too many attempts. Wait a minute, then try again.'
  if (error.code === 'EMAIL_NOT_VERIFIED') return 'Confirm your email address first, using the link we sent when you signed up.'
  return error.message || 'Something went wrong. Try again.'
}
