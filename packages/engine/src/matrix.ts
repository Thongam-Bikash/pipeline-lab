import { toValue } from './tokens'
import type { Json, TemplateToken } from './types'

export type Combination = Record<string, Json>
export type Strategy = { combinations: Combination[]; failFast: boolean; maxParallel?: number }

// GitHub creates at most 256 jobs from one matrix.
const MAX_JOBS = 256

const same = (a: Json | undefined, b: Json) => JSON.stringify(a ?? null) === JSON.stringify(b)

function cartesian(variables: Record<string, Json>): Combination[] {
  const entries = Object.entries(variables)
  if (!entries.length) return []
  // The first variable varies slowest, so jobs are grouped by its values.
  return entries.reduce<Combination[]>((combinations, [name, values]) => {
    if (!Array.isArray(values)) {
      throw new Error(`The matrix variable "${name}" is built from an expression, which is not simulated yet. Use a literal list here.`)
    }
    return combinations.flatMap((combination) => values.map((value) => ({ ...combination, [name]: value })))
  }, [{}])
}

function applyInclude(combinations: Combination[], include: Combination[], variableNames: string[]): Combination[] {
  const fromVariables = combinations.map((combination) => ({ ...combination }))
  // Entries that match nothing become jobs of their own, and later entries do not extend those.
  const added: Combination[] = []
  for (const entry of include) {
    let extended = false
    for (const combination of fromVariables) {
      // An include entry may extend a combination, but never overwrite a matrix variable's value.
      const conflicts = Object.entries(entry).some(([key, value]) => variableNames.includes(key) && !same(combination[key], value))
      if (conflicts) continue
      Object.assign(combination, entry)
      extended = true
    }
    if (!extended) added.push({ ...entry })
  }
  return [...fromVariables, ...added]
}

export function expandMatrix(strategy: TemplateToken | undefined): Strategy {
  if (!strategy) return { combinations: [{}], failFast: true }

  const value = toValue(strategy) as Record<string, Json>
  const failFast = value['fail-fast'] !== false
  const maxParallel = typeof value['max-parallel'] === 'number' ? value['max-parallel'] : undefined
  const matrix = value['matrix']
  if (matrix === undefined) return { combinations: [{}], failFast, maxParallel }
  if (typeof matrix !== 'object' || matrix === null || Array.isArray(matrix)) {
    throw new Error('A matrix built from an expression is not simulated yet. Use a literal matrix here.')
  }

  const { include, exclude, ...variables } = matrix
  const excluded = (exclude ?? []) as Combination[]
  const kept = cartesian(variables).filter((combination) => !excluded.some((entry) => Object.entries(entry).every(([k, v]) => same(combination[k], v))))
  const combinations = applyInclude(kept, (include ?? []) as Combination[], Object.keys(variables))
  if (combinations.length > MAX_JOBS) {
    throw new Error(`A matrix can create at most ${MAX_JOBS} jobs, but this one creates ${combinations.length}.`)
  }
  return { combinations, failFast, maxParallel }
}
