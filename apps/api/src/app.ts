import { zValidator } from '@hono/zod-validator'
import { Hono } from 'hono'
import { bodyLimit } from 'hono/body-limit'
import { createMiddleware } from 'hono/factory'
import { z } from 'zod'
import { auth } from './auth.js'
import { clearProgress, deleteProject, exportAccount, MAX_PROJECTS, syncState, TooManyProjects } from './state.js'

type Env = { Variables: { userId: string } }

// The same envelope Better Auth uses, so the web app reads every API error one way.
const fail = (message: string, code: string) => ({ message, code })

export const app = new Hono<Env>()

app.onError((error, c) => {
  console.error(`${c.req.method} ${c.req.path} failed`, error)
  return c.json(fail('Something went wrong', 'INTERNAL'), 500)
})

// Sign up, sign in, verification, reset, Google and account deletion all live here.
app.all('/api/auth/*', (c) => auth.handler(c.req.raw))

// The web container's healthcheck and Playwright's readiness probe both poll this.
app.get('/api/health', (c) => c.json({ ok: true }))

// The web app asks before rendering the Google button, so turning Google on needs no rebuild.
app.get('/api/config', (c) =>
  c.json({ google: Boolean(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET) }),
)

// The user id only ever comes from the session, never from a body or a path.
const signedIn = createMiddleware<Env>(async (c, next) => {
  const session = await auth.api.getSession({ headers: c.req.raw.headers })
  if (!session) return c.json(fail('Not signed in', 'UNAUTHORIZED'), 401)
  c.set('userId', session.user.id)
  await next()
})

const id = z.string().min(1).max(100)
// The merge compares instants as strings, so every client's format is normalised to one.
const instant = z.iso.datetime({ offset: true }).transform((value) => new Date(value).toISOString())
const atMost = (max: number) => (record: object) => Object.keys(record).length <= max

const stateBody = z.object({
  lessons: z
    .record(id, z.object({ completedAt: instant, quizScore: z.int().min(0).max(100).optional() }))
    .refine(atMost(500)),
  scenarios: z.record(id, z.object({ passedAt: instant, hintsUsed: z.int().min(0).max(20) })).refine(atMost(500)),
  projects: z
    .record(id, z.object({ id, name: z.string().min(1).max(80), source: z.string().max(16_000), updatedAt: instant }))
    .refine(atMost(MAX_PROJECTS))
    .refine((projects) => Object.entries(projects).every(([key, value]) => key === value.id)),
})

app.put(
  '/api/state',
  signedIn,
  bodyLimit({ maxSize: 1024 * 1024, onError: (c) => c.json(fail('Too much to sync in one request', 'TOO_LARGE'), 413) }),
  zValidator('json', stateBody, (result, c) => {
    if (!result.success) return c.json(fail('The progress sent is not in the expected shape', 'INVALID_STATE'), 400)
  }),
  async (c) => {
    try {
      return c.json(await syncState(c.get('userId'), c.req.valid('json')))
    } catch (error) {
      if (error instanceof TooManyProjects) {
        return c.json(fail(`Keep at most ${MAX_PROJECTS} saved projects`, 'TOO_MANY_PROJECTS'), 409)
      }
      throw error
    }
  },
)

app.delete('/api/progress', signedIn, async (c) => {
  await clearProgress(c.get('userId'))
  return c.body(null, 204)
})

app.delete('/api/projects/:id', signedIn, async (c) => {
  // 404 rather than 403, so nobody can learn which project ids exist in other accounts.
  if (!(await deleteProject(c.get('userId'), c.req.param('id')))) return c.json(fail('No such project', 'NOT_FOUND'), 404)
  return c.body(null, 204)
})

app.get('/api/account/export', signedIn, async (c) => {
  c.header('Content-Disposition', `attachment; filename="pipeline-lab-export-${new Date().toISOString().slice(0, 10)}.json"`)
  c.header('Cache-Control', 'no-store')
  return c.json(await exportAccount(c.get('userId')))
})
