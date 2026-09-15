import type { Json, RunState, SimEvent, StepRule } from '@pipeline-lab/engine'

// What a check gets to look at: the workflow as plain values, and the run if one has happened.
export type ScenarioContext = { raw: Record<string, Json>; run?: RunState }

export type ScenarioCheck = {
  id: string
  label: string
  test: (context: ScenarioContext) => boolean
}

export type Scenario = {
  id: string
  order: number
  title: string
  // The module this scenario belongs with.
  moduleSlug: string
  story: string[]
  file: string
  starting: string
  event: SimEvent
  rules?: StepRule[]
  checks: ScenarioCheck[]
  hints: string[]
  debrief: string[]
  // The reference fix. The content tests run it to prove the checks can be satisfied.
  solution: string
  lastVerified: string
  sources: string[]
}
