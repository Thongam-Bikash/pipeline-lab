import { expect, it } from 'vitest'
import { mergeState, type Project, type State } from './merge.js'

const state = (over: Partial<State> = {}): State => ({ lessons: {}, scenarios: {}, projects: {}, ...over })

const project = (over: Partial<Project> = {}): Project => ({
  id: 'p1',
  name: 'CI',
  source: 'name: CI',
  updatedAt: '2026-09-20T10:00:00.000Z',
  ...over,
})

const permutations = <T>(items: T[]): T[][] =>
  items.length <= 1
    ? [items]
    : items.flatMap((item, index) =>
        permutations([...items.slice(0, index), ...items.slice(index + 1)]).map((rest) => [item, ...rest]),
      )

it('keeps the best quiz score and the earliest completion', () => {
  const laptop = state({ lessons: { 'anatomy/runners': { completedAt: '2026-09-20T10:00:00.000Z', quizScore: 60 } } })
  const phone = state({ lessons: { 'anatomy/runners': { completedAt: '2026-09-21T09:00:00.000Z', quizScore: 100 } } })

  expect(mergeState(laptop, phone).lessons['anatomy/runners']).toEqual({
    completedAt: '2026-09-20T10:00:00.000Z',
    quizScore: 100,
  })
})

it('treats any score as better than none', () => {
  const unscored = state({ lessons: { a: { completedAt: '2026-09-20T10:00:00.000Z' } } })
  const scored = state({ lessons: { a: { completedAt: '2026-09-20T10:00:00.000Z', quizScore: 40 } } })

  expect(mergeState(unscored, scored).lessons.a?.quizScore).toBe(40)
  expect(mergeState(scored, unscored).lessons.a?.quizScore).toBe(40)
})

it('keeps the fewest hints and the earliest pass', () => {
  const hinted = state({ scenarios: { 'three-am-job': { passedAt: '2026-09-20T09:00:00.000Z', hintsUsed: 3 } } })
  const cold = state({ scenarios: { 'three-am-job': { passedAt: '2026-09-20T11:00:00.000Z', hintsUsed: 0 } } })

  expect(mergeState(hinted, cold).scenarios['three-am-job']).toEqual({
    passedAt: '2026-09-20T09:00:00.000Z',
    hintsUsed: 0,
  })
})

it('keeps progress only one side has, whichever way round', () => {
  const laptop = state({ lessons: { 'anatomy/runners': { completedAt: '2026-09-20T10:00:00.000Z' } } })
  const phone = state({ lessons: { 'triggers/filters': { completedAt: '2026-09-21T08:00:00.000Z' } } })

  expect(Object.keys(mergeState(laptop, phone).lessons).sort()).toEqual(['anatomy/runners', 'triggers/filters'])
  expect(Object.keys(mergeState(phone, laptop).lessons).sort()).toEqual(['anatomy/runners', 'triggers/filters'])
})

it('replaces a project with the newer document, not a field-by-field blend', () => {
  const old = state({ projects: { p1: project({ name: 'Old', source: 'name: Old', updatedAt: '2026-09-20T10:00:00.000Z' }) } })
  const fresh = state({ projects: { p1: project({ name: 'New', source: 'name: New', updatedAt: '2026-09-22T10:00:00.000Z' }) } })

  expect(mergeState(old, fresh).projects.p1).toEqual(fresh.projects.p1)
  expect(mergeState(fresh, old).projects.p1).toEqual(fresh.projects.p1)
})

it('settles a same-instant project save identically in both orders', () => {
  const one = state({ projects: { p1: project({ source: 'name: A' }) } })
  const two = state({ projects: { p1: project({ source: 'name: B' }) } })
  // Same instant and same source, so only the name can tell them apart.
  const original = state({ projects: { p1: project() } })
  const renamed = state({ projects: { p1: project({ name: 'Renamed' }) } })

  expect(mergeState(one, two)).toEqual(mergeState(two, one))
  expect(mergeState(original, renamed)).toEqual(mergeState(renamed, original))
})

it('is commutative', () => {
  const laptop = state({
    lessons: { a: { completedAt: '2026-09-20T10:00:00.000Z', quizScore: 60 }, b: { completedAt: '2026-09-19T10:00:00.000Z' } },
    scenarios: { s: { passedAt: '2026-09-20T09:00:00.000Z', hintsUsed: 3 } },
    projects: { p1: project({ updatedAt: '2026-09-20T10:00:00.000Z' }) },
  })
  const phone = state({
    lessons: { a: { completedAt: '2026-09-21T09:00:00.000Z', quizScore: 100 }, c: { completedAt: '2026-09-22T10:00:00.000Z' } },
    scenarios: { s: { passedAt: '2026-09-18T09:00:00.000Z', hintsUsed: 1 } },
    projects: { p1: project({ name: 'Renamed', updatedAt: '2026-09-23T10:00:00.000Z' }) },
  })

  expect(mergeState(laptop, phone)).toEqual(mergeState(phone, laptop))
})

it('is idempotent, so a retried sync changes nothing', () => {
  const held = state({ lessons: { a: { completedAt: '2026-09-20T10:00:00.000Z', quizScore: 60 } } })
  const incoming = state({ lessons: { a: { completedAt: '2026-09-21T09:00:00.000Z', quizScore: 100 } } })

  const once = mergeState(held, incoming)

  expect(mergeState(once, incoming)).toEqual(once)
  expect(mergeState(held, once)).toEqual(once)
})

it('converges on the same state however three devices interleave', () => {
  const devices = [
    state({
      lessons: { a: { completedAt: '2026-09-20T10:00:00.000Z', quizScore: 60 } },
      projects: { p1: project({ updatedAt: '2026-09-20T10:00:00.000Z' }) },
    }),
    state({
      lessons: { a: { completedAt: '2026-09-19T10:00:00.000Z', quizScore: 80 }, b: { completedAt: '2026-09-21T10:00:00.000Z' } },
      scenarios: { s: { passedAt: '2026-09-20T09:00:00.000Z', hintsUsed: 2 } },
    }),
    state({
      lessons: { c: { completedAt: '2026-09-22T10:00:00.000Z' } },
      scenarios: { s: { passedAt: '2026-09-21T09:00:00.000Z', hintsUsed: 0 } },
      projects: { p1: project({ name: 'Renamed', updatedAt: '2026-09-25T10:00:00.000Z' }) },
    }),
  ]

  const results = permutations(devices).map((order) => order.reduce((held, incoming) => mergeState(held, incoming)))

  expect(results).toHaveLength(6)
  for (const result of results) expect(result).toEqual(results[0])
})
