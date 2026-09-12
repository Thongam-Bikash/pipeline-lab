import { describe, expect, it } from 'vitest'
import { loadWorkflow } from './parse'
import { advance, runToEnd, startRun } from './scheduler'
import type { RunOptions, RunState, SimEvent } from './types'

const start = async (yaml: string, event: SimEvent = { type: 'push' }): Promise<RunState> => {
  const { workflow, source, diagnostics } = await loadWorkflow(yaml)
  expect(diagnostics.filter((d) => d.severity === 'error')).toEqual([])
  return startRun(workflow!, source!, event)
}

const run = async (yaml: string, event?: SimEvent, options: RunOptions = {}) => runToEnd(await start(yaml, event), options)

const results = (state: RunState) => Object.fromEntries(state.jobs.map((job) => [job.key, job.conclusion]))

const simple = `on: push
jobs:
  build:
    runs-on: ubuntu-24.04
    steps:
      - uses: actions/checkout@v7
      - run: npm test
`

describe('startRun', () => {
  it('plans one job per matrix combination', async () => {
    const state = await start(`on: push
jobs:
  test:
    runs-on: \${{ matrix.os }}
    strategy:
      matrix:
        os: [ubuntu-24.04, macos-15]
        node: [22]
    steps:
      - run: npm test
`)
    expect(state.jobs.map((job) => [job.key, job.runsOn, job.jobIndex, job.jobTotal])).toEqual([
      ['test (ubuntu-24.04, 22)', 'ubuntu-24.04', 0, 2],
      ['test (macos-15, 22)', 'macos-15', 1, 2],
    ])
  })

  it('reports a matrix it cannot expand instead of running', async () => {
    const state = await start(`on: push
jobs:
  test:
    runs-on: ubuntu-24.04
    strategy:
      matrix: \${{ fromJSON(needs.setup.outputs.matrix) }}
    steps:
      - run: npm test
`)
    expect(state.status).toBe('completed')
    expect(state.error).toMatch(/built from an expression/)
  })

})

describe('advance', () => {
  it('moves one step at a time and leaves the previous state alone', async () => {
    const first = await start(simple)
    const second = advance(first)
    expect(first.jobs[0]!.status).toBe('queued')
    expect(second.jobs[0]!.status).toBe('running')
    expect(second.jobs[0]!.steps[0]!.status).toBe('running')

    const third = advance(second)
    expect(third.clock).toBeGreaterThan(second.clock)
    expect(third.jobs[0]!.steps[0]!.conclusion).toBe('success')
    expect(runToEnd(third).status).toBe('completed')
  })

  it('does nothing once the run has finished', async () => {
    const finished = await run(simple)
    expect(advance(finished)).toBe(finished)
  })

  it('replays identically for the same seed', async () => {
    const once = await run(simple, undefined, { seed: 7 })
    const twice = await run(simple, undefined, { seed: 7 })
    expect(once.clock).toBe(twice.clock)
    expect(once.clock).toBeGreaterThan(0)
  })

  it('finishes whichever running job is due first', async () => {
    const state = await run(
      `on: push
jobs:
  slow:
    runs-on: ubuntu-24.04
    steps:
      - name: slow work
        run: make
  quick:
    runs-on: ubuntu-24.04
    steps:
      - name: quick work
        run: make
`,
      undefined,
      {
        rules: [
          { match: (step) => step.name === 'slow work', seconds: 60 },
          { match: (step) => step.name === 'quick work', seconds: 1 },
        ],
      },
    )
    const [slow, quick] = state.jobs
    expect(quick!.finishedAt).toBeLessThan(slow!.finishedAt!)
  })
})

describe('run results', () => {
  it('runs jobs in dependency order and passes outputs on', async () => {
    const state = await run(`on: push
jobs:
  build:
    runs-on: ubuntu-24.04
    outputs:
      version: \${{ steps.v.outputs.version }}
    steps:
      - id: v
        run: echo "version=1.2.3" >> "$GITHUB_OUTPUT"
  deploy:
    needs: build
    runs-on: ubuntu-24.04
    steps:
      - run: echo "Deploying \${{ needs.build.outputs.version }}"
`)
    const [build, deploy] = state.jobs
    expect(build!.outputs).toEqual({ version: '1.2.3' })
    expect(deploy!.startedAt).toBeGreaterThanOrEqual(build!.finishedAt!)
    expect(deploy!.steps[0]!.logs.map((line) => line.text)).toEqual(['echo "Deploying 1.2.3"'])
    expect(state.conclusion).toBe('success')
  })

  it('collects multiline outputs, summaries, and annotations', async () => {
    const state = await run(`on: push
jobs:
  build:
    runs-on: ubuntu-24.04
    steps:
      - id: notes
        run: |
          echo "notes<<EOF" >> "$GITHUB_OUTPUT"
          echo "first" >> "$GITHUB_OUTPUT"
          echo "second" >> "$GITHUB_OUTPUT"
          echo "EOF" >> "$GITHUB_OUTPUT"
          echo "### Test results" >> "$GITHUB_STEP_SUMMARY"
          echo "::error file=app.js,line=12,title=Broke::Missing semicolon"
          echo "::warning::Check this later"
`)
    const step = state.jobs[0]!.steps[0]!
    expect(step.outputs).toEqual({ notes: 'first\nsecond' })
    expect(state.jobs[0]!.summary).toEqual(['### Test results'])
    expect(step.annotations).toEqual([
      { level: 'error', message: 'Missing semicolon', file: 'app.js', line: 12, title: 'Broke' },
      { level: 'warning', message: 'Check this later' },
    ])
  })

  it('skips a step whose if is false, and keeps always() steps running after a failure', async () => {
    const state = await run(
      `on: push
jobs:
  build:
    runs-on: ubuntu-24.04
    steps:
      - name: only on tags
        if: github.ref_type == 'tag'
        run: echo tag
      - name: failing
        run: npm test
      - name: after
        run: echo after
      - name: always
        if: always()
        run: echo always
`,
      { type: 'push' },
      { rules: [{ match: (step) => step.name === 'failing', outcome: 'failure' }] },
    )
    const [tagStep, failing, after, always] = state.jobs[0]!.steps
    expect(tagStep!.conclusion).toBe('skipped')
    expect(failing!.conclusion).toBe('failure')
    expect(after!.conclusion).toBe('skipped')
    expect(always!.conclusion).toBe('success')
    expect(state.conclusion).toBe('failure')
  })

  it('treats a continue-on-error step as a success for the job', async () => {
    const state = await run(
      `on: push
jobs:
  build:
    runs-on: ubuntu-24.04
    steps:
      - name: flaky
        continue-on-error: true
        run: npm test
      - run: echo after
`,
      undefined,
      { rules: [{ match: (step) => step.name === 'flaky', outcome: 'failure' }] },
    )
    expect(state.jobs[0]!.steps[0]).toMatchObject({ outcome: 'failure', conclusion: 'success' })
    expect(state.jobs[0]!.steps[1]!.conclusion).toBe('success')
    expect(state.conclusion).toBe('success')
  })

  it('skips jobs that need a failed job, unless they ask to run anyway', async () => {
    const state = await run(
      `on: push
jobs:
  build:
    runs-on: ubuntu-24.04
    steps:
      - run: npm test
  deploy:
    needs: build
    runs-on: ubuntu-24.04
    steps:
      - run: echo deploy
  report:
    needs: build
    if: always()
    runs-on: ubuntu-24.04
    steps:
      - run: echo report
  onlyOnFailure:
    needs: build
    if: failure()
    runs-on: ubuntu-24.04
    steps:
      - run: echo failed
`,
      undefined,
      { rules: [{ match: (step) => step.jobId === 'build', outcome: 'failure' }] },
    )
    expect(results(state)).toEqual({ build: 'failure', deploy: 'skipped', report: 'success', onlyOnFailure: 'success' })
  })

  it('skips a job whose dependency was skipped', async () => {
    const state = await run(`on: push
jobs:
  build:
    if: github.event_name == 'schedule'
    runs-on: ubuntu-24.04
    steps:
      - run: echo build
  deploy:
    needs: build
    runs-on: ubuntu-24.04
    steps:
      - run: echo deploy
`)
    expect(results(state)).toEqual({ build: 'skipped', deploy: 'skipped' })
    expect(state.conclusion).toBe('success')
  })

  it('cancels the other matrix jobs when fail-fast is on, and keeps them when it is off', async () => {
    const yaml = (failFast: boolean) => `on: push
jobs:
  test:
    runs-on: ubuntu-24.04
    strategy:
      fail-fast: ${failFast}
      matrix:
        node: [22, 24]
    steps:
      - name: setup
        run: npm ci
      - name: test
        run: npm test
`
    const rules = [
      { match: (step: { name: string }) => step.name === 'setup', seconds: 5 },
      { match: (step: { name: string; matrix: Record<string, unknown> }) => step.name === 'test' && step.matrix['node'] === 22, outcome: 'failure' as const, seconds: 1 },
      { match: (step: { name: string }) => step.name === 'test', seconds: 30 },
    ]
    const stopped = await run(yaml(true), undefined, { rules })
    expect(results(stopped)).toEqual({ 'test (22)': 'failure', 'test (24)': 'cancelled' })
    // The cancelled job keeps the step it had already finished.
    expect(stopped.jobs[1]!.steps.map((step) => step.conclusion)).toEqual(['success', 'cancelled'])
    expect(stopped.conclusion).toBe('failure')

    const finished = await run(yaml(false), undefined, { rules })
    expect(results(finished)).toEqual({ 'test (22)': 'failure', 'test (24)': 'success' })
  })

  it('honours max-parallel', async () => {
    let state = await start(`on: push
jobs:
  test:
    runs-on: ubuntu-24.04
    strategy:
      max-parallel: 1
      matrix:
        node: [20, 22, 24]
    steps:
      - run: npm test
`)
    state = advance(state)
    expect(state.jobs.filter((job) => job.status === 'running')).toHaveLength(1)
    expect(runToEnd(state).jobs.every((job) => job.conclusion === 'success')).toBe(true)
  })

  it('fails a step that runs past its timeout', async () => {
    const state = await run(
      `on: push
jobs:
  build:
    runs-on: ubuntu-24.04
    steps:
      - name: slow
        timeout-minutes: 1
        run: npm test
`,
      undefined,
      { rules: [{ match: (step) => step.name === 'slow', seconds: 300 }] },
    )
    expect(state.jobs[0]!.steps[0]!.conclusion).toBe('failure')
    expect(state.jobs[0]!.steps[0]!.logs.at(-1)!.text).toMatch(/longer than its timeout of 1 minutes/)
    expect(state.conclusion).toBe('failure')
  })

  it('cancels a job that runs past its timeout', async () => {
    const state = await run(
      `on: push
jobs:
  build:
    runs-on: ubuntu-24.04
    timeout-minutes: 5
    steps:
      - run: npm test
`,
      undefined,
      { rules: [{ match: (step) => step.jobId === 'build', seconds: 3600 }] },
    )
    expect(state.jobs[0]!.conclusion).toBe('cancelled')
    expect(state.conclusion).toBe('cancelled')
  })

  it('keeps the run green when a failing job is marked continue-on-error', async () => {
    const state = await run(
      `on: push
jobs:
  experimental:
    runs-on: ubuntu-24.04
    continue-on-error: true
    steps:
      - run: npm test
`,
      undefined,
      { rules: [{ match: () => true, outcome: 'failure' }] },
    )
    expect(state.jobs[0]!.conclusion).toBe('failure')
    expect(state.conclusion).toBe('success')
  })

  it('fills the contexts a workflow can read', async () => {
    const state = await run(
      `on: push
env:
  STAGE: prod
jobs:
  build:
    runs-on: \${{ matrix.os }}
    strategy:
      matrix:
        os: [ubuntu-24.04, macos-15, windows-2025]
    env:
      EXTRA: yes
    steps:
      - uses: actions/checkout@v7
        with:
          fetch-depth: 0
      - run: echo "\${{ github.repository }} \${{ github.ref_name }} \${{ env.STAGE }} \${{ env.EXTRA }} \${{ runner.os }} \${{ strategy.job-total }} \${{ vars.REGION }} \${{ secrets.TOKEN }}"
`,
      { type: 'push', branch: 'release/1' },
      { vars: { REGION: 'eu' }, secrets: { TOKEN: 'abc' }, repository: 'octo/demo' },
    )
    const lastLine = (index: number) => state.jobs[index]!.steps[1]!.logs[0]!.text
    expect(lastLine(0)).toBe('echo "octo/demo release/1 prod yes Linux 3 eu abc"')
    expect(lastLine(1)).toContain(' macOS ')
    expect(lastLine(2)).toContain(' Windows ')
  })

  it('uses the tag ref for a tag push', async () => {
    const state = await run(
      `on: push
jobs:
  build:
    runs-on: ubuntu-24.04
    steps:
      - run: echo "\${{ github.ref }} \${{ github.ref_type }}"
`,
      { type: 'push', tag: 'v1.2.3' },
    )
    expect(state.jobs[0]!.steps[0]!.logs[0]!.text).toBe('echo "refs/tags/v1.2.3 tag"')
  })

  it('reads dispatch inputs and the pull request base branch', async () => {
    const yaml = `on:
  workflow_dispatch:
    inputs:
      target:
        type: string
  pull_request:
jobs:
  build:
    runs-on: ubuntu-24.04
    steps:
      - run: echo "\${{ inputs.target }} \${{ github.base_ref }}"
`
    const dispatched = await run(yaml, { type: 'workflow_dispatch', inputs: { target: 'staging' } })
    expect(dispatched.jobs[0]!.steps[0]!.logs[0]!.text).toBe('echo "staging "')

    const withoutInputs = await run(yaml, { type: 'workflow_dispatch' })
    expect(withoutInputs.jobs[0]!.steps[0]!.logs[0]!.text).toBe('echo " "')

    const pull = await run(yaml, { type: 'pull_request', base: 'release/2' })
    expect(pull.jobs[0]!.steps[0]!.logs[0]!.text).toBe('echo " release/2"')

    const defaultBase = await run(yaml, { type: 'pull_request' })
    expect(defaultBase.jobs[0]!.steps[0]!.logs[0]!.text).toBe('echo " main"')
  })

  it('names a job and its steps from the workflow', async () => {
    const state = await run(`on: push
jobs:
  test:
    name: Test on \${{ matrix.node }}
    runs-on: ubuntu-24.04
    strategy:
      matrix:
        node: [24]
    steps:
      - name: Run \${{ matrix.node }} tests
        run: npm test
`)
    expect(state.jobs[0]!.name).toBe('Test on 24')
    expect(state.jobs[0]!.steps[0]!.name).toBe('Run 24 tests')
  })

  it('ignores a reusable workflow job', async () => {
    const state = await run(`on: push
jobs:
  call:
    uses: octo/repo/.github/workflows/ci.yml@main
  build:
    runs-on: ubuntu-24.04
    steps:
      - run: echo hi
`)
    expect(state.jobs.map((job) => job.id)).toEqual(['build'])
  })
})
