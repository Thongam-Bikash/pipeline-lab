export type LessonProgress = { completedAt: string; quizScore?: number }
export type ScenarioProgress = { passedAt: string; hintsUsed: number }
export type Project = { id: string; name: string; source: string; updatedAt: string }

export type State = {
  lessons: Record<string, LessonProgress>
  scenarios: Record<string, ScenarioProgress>
  projects: Record<string, Project>
}

// ISO-8601 strings sort as dates, so there is nothing to parse.
const earlier = (a: string, b: string) => (a < b ? a : b)

const best = (a: number | undefined, b: number | undefined) =>
  a === undefined ? b : b === undefined ? a : Math.max(a, b)

// A project is a document, so it merges whole rather than field by field.
const newer = (a: Project, b: Project): Project => {
  if (a.updatedAt !== b.updatedAt) return a.updatedAt > b.updatedAt ? a : b
  // Saved in the same instant on two devices: order by content so both converge either way.
  if (a.source !== b.source) return a.source > b.source ? a : b
  return a.name >= b.name ? a : b
}

const mergeBy = <T>(held: Record<string, T>, incoming: Record<string, T>, pick: (a: T, b: T) => T) => {
  const merged = { ...held }
  for (const [id, value] of Object.entries(incoming)) {
    const mine = merged[id]
    merged[id] = mine ? pick(mine, value) : value
  }
  return merged
}

// Every field keeps the learner's best result, so a sync can never take progress away.
// Keeping it commutative and idempotent is what lets a device sync in any order, twice,
// or after being offline, with no version numbers and no conflict to resolve.
export function mergeState(held: State, incoming: State): State {
  return {
    lessons: mergeBy(held.lessons, incoming.lessons, (a, b) => ({
      completedAt: earlier(a.completedAt, b.completedAt),
      quizScore: best(a.quizScore, b.quizScore),
    })),
    scenarios: mergeBy(held.scenarios, incoming.scenarios, (a, b) => ({
      passedAt: earlier(a.passedAt, b.passedAt),
      hintsUsed: Math.min(a.hintsUsed, b.hintsUsed),
    })),
    projects: mergeBy(held.projects, incoming.projects, newer),
  }
}

// Deleted projects stay deleted, though other devices still have a copy and send it back.
export function dropDeleted(incoming: State, deleted: ReadonlySet<string>): State {
  if (deleted.size === 0) return incoming
  return { ...incoming, projects: Object.fromEntries(Object.entries(incoming.projects).filter(([id]) => !deleted.has(id))) }
}

// A reset must hold even though other devices still have their old copy and send it back.
// ponytail: compares device clocks with the server's; a device running minutes slow can lose a lesson finished just after a reset.
export function dropCleared(incoming: State, clearedAt: string | undefined): State {
  if (!clearedAt) return incoming
  const since = <T>(record: Record<string, T>, at: (value: T) => string) =>
    Object.fromEntries(Object.entries(record).filter(([, value]) => at(value) > clearedAt))
  return {
    ...incoming,
    lessons: since(incoming.lessons, (lesson) => lesson.completedAt),
    scenarios: since(incoming.scenarios, (scenario) => scenario.passedAt),
  }
}
