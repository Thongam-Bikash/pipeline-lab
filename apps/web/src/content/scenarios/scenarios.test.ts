import { loadWorkflow, runToEnd, startRun, toValue, type Json, type RunState } from '@pipeline-lab/engine'
import { describe, expect, it } from 'vitest'
import { scenarios } from './index'
import type { Scenario, ScenarioContext } from './types'

async function contextFor(scenario: Scenario, source: string): Promise<ScenarioContext> {
  const parsed = await loadWorkflow(source)
  expect(parsed.diagnostics.filter((diagnostic) => diagnostic.severity === 'error'), `${scenario.id}: ${source.slice(0, 40)}`).toEqual([])
  const run: RunState = runToEnd(startRun(parsed.workflow!, parsed.source!, scenario.event), { rules: scenario.rules ?? [], seed: 5 })
  return { raw: toValue(parsed.source!) as Record<string, Json>, run }
}

describe.each(scenarios.map((scenario) => [scenario.id, scenario] as const))('%s', (_, scenario) => {
  it('has a story, hints, a debrief, and a source', () => {
    expect(scenario.story.length).toBeGreaterThan(0)
    expect(scenario.hints.length).toBeGreaterThan(0)
    expect(scenario.hints.length).toBeLessThanOrEqual(3)
    expect(scenario.debrief.length).toBeGreaterThan(0)
    expect(scenario.checks.length).toBeGreaterThanOrEqual(2)
    expect(scenario.sources.length).toBeGreaterThan(0)
    expect(Number.isNaN(Date.parse(scenario.lastVerified))).toBe(false)
  })

  it('starts unsolved, so there is something to fix', async () => {
    const context = await contextFor(scenario, scenario.starting)
    const failing = scenario.checks.filter((check) => !check.test(context))
    expect(failing.length, `${scenario.id} starts with every check already passing`).toBeGreaterThan(0)
  })

  it('is solved by its reference solution', async () => {
    const context = await contextFor(scenario, scenario.solution)
    for (const check of scenario.checks) {
      expect(check.test(context), `${scenario.id}: "${check.label}" fails for the reference solution`).toBe(true)
    }
  })
})
