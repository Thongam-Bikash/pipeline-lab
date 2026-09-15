import { inArray } from 'drizzle-orm'
import { afterAll, describe, expect, it } from 'vitest'
import { app } from './app.js'
import { auth } from './auth.js'
import { user } from './auth-schema.js'
import { db } from './db.js'

const emails: string[] = []
const empty = { lessons: {}, scenarios: {}, projects: {} }

async function signIn() {
  const email = `route-test-${crypto.randomUUID()}@example.test`
  const password = 'correct-horse-battery-staple'
  emails.push(email)
  await auth.api.signUpEmail({ body: { email, password, name: 'Route test' } })
  await db.update(user).set({ emailVerified: true }).where(inArray(user.email, [email]))
  const response = await auth.api.signInEmail({ body: { email, password }, asResponse: true })
  const cookie = response.headers.getSetCookie().find((value) => value.startsWith('better-auth.session_token='))
  return cookie!.split(';')[0]!
}

const call = (path: string, { method = 'GET', cookie, body }: { method?: string; cookie?: string; body?: unknown } = {}) =>
  app.request(path, {
    method,
    headers: { 'content-type': 'application/json', ...(cookie ? { cookie } : {}) },
    body: body === undefined ? undefined : JSON.stringify(body),
  })

// These need Postgres: run with DATABASE_URL set, against a migrated database.
describe.skipIf(!process.env.DATABASE_URL)('routes against Postgres', () => {
  afterAll(async () => {
    if (emails.length > 0) await db.delete(user).where(inArray(user.email, emails))
  })

  it('refuses every learner route without a session', async () => {
    for (const [method, path] of [['PUT', '/api/state'], ['DELETE', '/api/progress'], ['DELETE', '/api/projects/x'], ['GET', '/api/account/export']] as const) {
      const response = await call(path, { method, body: method === 'PUT' ? empty : undefined })
      expect(response.status, `${method} ${path}`).toBe(401)
      await expect(response.json()).resolves.toEqual({ message: 'Not signed in', code: 'UNAUTHORIZED' })
    }
  })

  it('merges two devices, normalises instants, and gives the same answer on a retry', async () => {
    const cookie = await signIn()
    const laptop = { ...empty, lessons: { 'anatomy/runners': { completedAt: '2026-09-20T15:30:00+05:30', quizScore: 60 } } }
    const phone = { ...empty, lessons: { 'triggers/filters': { completedAt: '2026-09-21T08:00:00Z' } } }

    await call('/api/state', { method: 'PUT', cookie, body: laptop })
    const response = await call('/api/state', { method: 'PUT', cookie, body: phone })
    const expected = {
      lessons: {
        'anatomy/runners': { completedAt: '2026-09-20T10:00:00.000Z', quizScore: 60 },
        'triggers/filters': { completedAt: '2026-09-21T08:00:00.000Z' },
      },
      scenarios: {},
      projects: {},
    }

    expect(response.status).toBe(200)
    await expect(response.json()).resolves.toEqual(expected)
    await expect((await call('/api/state', { method: 'PUT', cookie, body: phone })).json()).resolves.toEqual(expected)
  })

  it('loses neither update when two devices sync at the same moment', async () => {
    const cookie = await signIn()
    const at = '2026-09-20T10:00:00.000Z'

    await Promise.all(
      ['a', 'b', 'c', 'd'].map((lesson) => call('/api/state', { method: 'PUT', cookie, body: { ...empty, lessons: { [lesson]: { completedAt: at } } } })),
    )
    const state = await (await call('/api/state', { method: 'PUT', cookie, body: empty })).json()

    expect(Object.keys(state.lessons).sort()).toEqual(['a', 'b', 'c', 'd'])
  })

  it('rejects a body that is not in the expected shape', async () => {
    const cookie = await signIn()
    const body = { ...empty, lessons: { a: { completedAt: '2026-09-20T10:00:00Z', quizScore: 101 } } }

    const response = await call('/api/state', { method: 'PUT', cookie, body })

    expect(response.status).toBe(400)
    expect((await response.json()).code).toBe('INVALID_STATE')
  })

  it("never lets one account overwrite or delete another account's project", async () => {
    const owner = await signIn()
    const intruder = await signIn()
    const original = { id: `p-${crypto.randomUUID()}`, name: 'Mine', source: 'name: Mine', updatedAt: '2026-09-20T10:00:00.000Z' }
    await call('/api/state', { method: 'PUT', cookie: owner, body: { ...empty, projects: { [original.id]: original } } })

    const hijack = { ...original, name: 'Taken', source: 'name: Taken', updatedAt: '2030-01-01T00:00:00.000Z' }
    const synced = await (await call('/api/state', { method: 'PUT', cookie: intruder, body: { ...empty, projects: { [original.id]: hijack } } })).json()
    const deleted = await call(`/api/projects/${original.id}`, { method: 'DELETE', cookie: intruder })
    const ownerState = await (await call('/api/state', { method: 'PUT', cookie: owner, body: empty })).json()

    expect(synced.projects).toEqual({})
    expect(deleted.status).toBe(404)
    expect(ownerState.projects[original.id]).toEqual(original)
  })

  it('deletes your own project, then reports it gone', async () => {
    const cookie = await signIn()
    const saved = { id: `p-${crypto.randomUUID()}`, name: 'CI', source: 'name: CI', updatedAt: '2026-09-20T10:00:00.000Z' }
    await call('/api/state', { method: 'PUT', cookie, body: { ...empty, projects: { [saved.id]: saved } } })

    expect((await call(`/api/projects/${saved.id}`, { method: 'DELETE', cookie })).status).toBe(204)
    expect((await call(`/api/projects/${saved.id}`, { method: 'DELETE', cookie })).status).toBe(404)
  })

  it('resets progress', async () => {
    const cookie = await signIn()
    await call('/api/state', { method: 'PUT', cookie, body: { ...empty, lessons: { a: { completedAt: '2026-09-20T10:00:00Z' } } } })

    expect((await call('/api/progress', { method: 'DELETE', cookie })).status).toBe(204)
    await expect((await call('/api/state', { method: 'PUT', cookie, body: empty })).json()).resolves.toEqual(empty)
  })

  it('does not let another device bring progress back after a reset', async () => {
    const cookie = await signIn()
    const beforeReset = { ...empty, lessons: { old: { completedAt: new Date(Date.now() - 60_000).toISOString() } } }
    await call('/api/state', { method: 'PUT', cookie, body: beforeReset })
    await call('/api/progress', { method: 'DELETE', cookie })

    const laptop = await (await call('/api/state', { method: 'PUT', cookie, body: beforeReset })).json()
    const afterReset = { ...empty, lessons: { fresh: { completedAt: new Date(Date.now() + 60_000).toISOString() } } }
    const phone = await (await call('/api/state', { method: 'PUT', cookie, body: afterReset })).json()

    expect(laptop.lessons).toEqual({})
    expect(Object.keys(phone.lessons)).toEqual(['fresh'])
  })

  it('exports your data as a download, with no credentials in it', async () => {
    const cookie = await signIn()
    await call('/api/state', { method: 'PUT', cookie, body: { ...empty, lessons: { 'anatomy/runners': { completedAt: '2026-09-20T10:00:00Z' } } } })

    const response = await call('/api/account/export', { cookie })
    const text = await response.text()

    expect(response.status).toBe(200)
    expect(response.headers.get('content-disposition')).toMatch(/^attachment; filename="pipeline-lab-export-\d{4}-\d{2}-\d{2}\.json"$/)
    expect(response.headers.get('cache-control')).toBe('no-store')
    expect(Object.keys(JSON.parse(text)).sort()).toEqual(['account', 'exportedAt', 'lessons', 'projects', 'scenarios'])
    expect(JSON.parse(text).lessons).toHaveProperty(['anatomy/runners'])
    expect(text).not.toMatch(/password|token|hash/i)
  })
})
