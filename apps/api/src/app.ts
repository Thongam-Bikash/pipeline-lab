import { Hono } from 'hono'
import { auth } from './auth.js'

export const app = new Hono()

// Sign up, sign in, verification, reset, Google and account deletion all live here.
app.all('/api/auth/*', (c) => auth.handler(c.req.raw))

// The web container's healthcheck and Playwright's readiness probe both poll this.
app.get('/api/health', (c) => c.json({ ok: true }))

// The web app asks before rendering the Google button, so turning Google on needs no rebuild.
app.get('/api/config', (c) =>
  c.json({ google: Boolean(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET) }),
)
