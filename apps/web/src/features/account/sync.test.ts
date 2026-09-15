import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { useProgress } from '@/features/progress/store'
import { clearRemote, sessionChanged } from './sync'

const done = '2026-09-20T10:00:00.000Z'
const state = (lessons: Record<string, { completedAt: string }>) => ({ lessons, scenarios: {}, projects: {} })
const respond = (body: unknown) => new Response(JSON.stringify(body), { status: 200 })
const settle = () => new Promise((resolve) => setTimeout(resolve, 0))

beforeEach(() => {
  sessionChanged(undefined)
  useProgress.setState({ lessons: {}, scenarios: {} })
})

afterEach(() => vi.unstubAllGlobals())

it('never calls the API or clears progress for a guest', async () => {
  const fetch = vi.fn<typeof globalThis.fetch>()
  vi.stubGlobal('fetch', fetch)

  useProgress.getState().completeLesson('a')
  sessionChanged(undefined)
  await settle()

  expect(fetch).not.toHaveBeenCalled()
  expect(useProgress.getState().lessons).toHaveProperty('a')
})

it('sends guest progress on sign-in and adopts the merged answer once', async () => {
  useProgress.getState().completeLesson('guest-lesson')
  const fetch = vi.fn<typeof globalThis.fetch>(async () =>
    respond(state({ 'guest-lesson': { completedAt: done }, 'other-device': { completedAt: done } })),
  )
  vi.stubGlobal('fetch', fetch)

  sessionChanged('user-1')
  await vi.waitFor(() => expect(useProgress.getState().lessons).toHaveProperty('other-device'))

  expect(JSON.parse(String(fetch.mock.calls[0]![1]!.body)).lessons).toHaveProperty('guest-lesson')
  // Adopting the answer is itself a store change; it must not set off another push.
  expect(fetch).toHaveBeenCalledTimes(1)
})

it('keeps progress made while a sync was on its way', async () => {
  const answers: ((response: Response) => void)[] = []
  vi.stubGlobal('fetch', vi.fn<typeof globalThis.fetch>(() => new Promise((resolve) => answers.push(resolve))))

  sessionChanged('user-1')
  useProgress.getState().completeLesson('during')
  answers[0]!(respond(state({})))
  await settle()

  expect(useProgress.getState().lessons).toHaveProperty('during')

  answers[1]!(respond(state({ during: { completedAt: done } })))
  await settle()

  expect(useProgress.getState().lessons).toHaveProperty('during')
})

it('clears this browser on sign-out, so the next person does not inherit it', async () => {
  vi.stubGlobal('fetch', vi.fn<typeof globalThis.fetch>(async () => respond(state({ mine: { completedAt: done } }))))

  sessionChanged('user-1')
  await vi.waitFor(() => expect(useProgress.getState().lessons).toHaveProperty('mine'))
  sessionChanged(undefined)

  expect(useProgress.getState().lessons).toEqual({})
})

it('clears the account copy only when signed in', async () => {
  const fetch = vi.fn<typeof globalThis.fetch>(async () => new Response(null, { status: 204 }))
  vi.stubGlobal('fetch', fetch)

  await clearRemote()
  expect(fetch).not.toHaveBeenCalled()

  sessionChanged('user-1')
  await clearRemote()
  expect(fetch).toHaveBeenLastCalledWith('/api/progress', { method: 'DELETE' })
})
