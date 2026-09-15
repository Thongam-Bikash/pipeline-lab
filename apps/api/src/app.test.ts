import { afterEach, expect, it, vi } from 'vitest'
import { app } from './app.js'

afterEach(() => vi.unstubAllEnvs())

it('reports itself healthy', async () => {
  const response = await app.request('/api/health')

  expect(response.status).toBe(200)
  await expect(response.json()).resolves.toEqual({ ok: true })
})

it('hides Google until both credentials are set', async () => {
  vi.stubEnv('GOOGLE_CLIENT_ID', 'an-id')
  vi.stubEnv('GOOGLE_CLIENT_SECRET', '')

  await expect((await app.request('/api/config')).json()).resolves.toEqual({ google: false })
})

it('offers Google once both credentials are set', async () => {
  vi.stubEnv('GOOGLE_CLIENT_ID', 'an-id')
  vi.stubEnv('GOOGLE_CLIENT_SECRET', 'a-secret')

  await expect((await app.request('/api/config')).json()).resolves.toEqual({ google: true })
})
