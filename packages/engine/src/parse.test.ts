import { describe, expect, it } from 'vitest'
import { explain, loadWorkflow } from './parse'

const steps = '    steps:\n      - run: echo hi\n'

describe('loadWorkflow', () => {
  it('returns the workflow when it is valid', async () => {
    const result = await loadWorkflow(`name: CI
on:
  push:
    branches: [main]
  schedule:
    - cron: '0 3 * * 1-5'
      timezone: America/New_York
jobs:
  build:
    runs-on: ubuntu-24.04
    steps:
      - uses: actions/checkout@v7
      - run: npm test
`)
    expect(result.diagnostics).toEqual([])
    expect(result.workflow?.jobs[0]?.id.value).toBe('build')
  })

  it('explains a missing runs-on', async () => {
    const result = await loadWorkflow(`on: push\njobs:\n  build:\n${steps}`)
    expect(result.workflow).toBeUndefined()
    expect(result.diagnostics).toEqual([
      {
        severity: 'error',
        line: 4,
        column: 5,
        key: 'runs-on',
        message: 'Missing required key "runs-on".',
        fix: 'Add "runs-on" with a runner label, for example "runs-on: ubuntu-24.04".',
      },
    ])
  })

  it('suggests the dashed spelling for an underscored key, once per line', async () => {
    const { diagnostics } = await loadWorkflow(`on: push\njobs:\n  build:\n    runs_on: ubuntu-24.04\n${steps}`)
    expect(diagnostics).toEqual([
      { severity: 'error', line: 4, column: 5, key: 'runs_on', message: `"runs_on" isn't a valid key here.`, fix: 'Did you mean "runs-on"?' },
    ])
  })

  it.each([
    ['an unknown key', `on: push\njobs:\n  build:\n    runson: x\n${steps}`, { line: 4, fix: 'Check the spelling and indentation. Keys are case-sensitive.' }],
    ['steps written as a mapping', 'on: push\njobs:\n  build:\n    runs-on: x\n    steps:\n      run: echo hi\n', { line: 6, message: `A mapping isn't allowed here.` }],
    ['tab indentation', 'on: push\njobs:\n\tbuild:\n\t\truns-on: ubuntu-24.04\n', { line: 3, column: 1, message: 'Tabs are used for indentation.' }],
    ['a mis-indented list item', 'on: push\njobs:\n  build:\n    runs-on: x\n    steps:\n    - run: echo ok\n  - run: echo bad\n', { line: 7, message: 'A list item is indented differently from the items above it.' }],
    ['an unclosed quote', 'on: push\njobs:\n  build:\n    runs-on: "ubuntu\n', { line: 5, message: 'A quoted value is never closed.' }],
    ['a broken expression', `on: push\njobs:\n  a:\n    if: \${{ github.ref == }}\n    runs-on: x\n${steps}`, { line: 4, message: "Unexpected end of expression: '=='" }],
    [
      'jobs that all wait on each other',
      'on: push\njobs:\n  a:\n    needs: b\n    runs-on: x\n    steps: [{run: echo}]\n  b:\n    needs: a\n    runs-on: x\n    steps: [{run: echo}]\n',
      { line: 3, message: 'Every job waits on another job, so nothing can start.' },
    ],
  ])('explains %s', async (_, source, expected) => {
    const { workflow, diagnostics } = await loadWorkflow(source)
    expect(workflow).toBeUndefined()
    expect(diagnostics[0]).toMatchObject({ severity: 'error', ...expected })
  })

  it('replaces the generic cron error with a specific one', async () => {
    const { workflow, diagnostics } = await loadWorkflow(`on:\n  schedule:\n    - cron: '*/1 * * *'\njobs:\n  a:\n    runs-on: x\n${steps}`)
    expect(workflow).toBeUndefined()
    expect(diagnostics).toEqual([
      {
        severity: 'error',
        line: 3,
        column: 13,
        key: 'cron',
        message: 'A cron schedule needs 5 fields (minute, hour, day of month, month, day of week), but "*/1 * * *" has 4.',
      },
    ])
  })

  it('warns about schedules faster than every 5 minutes but still runs', async () => {
    const { workflow, diagnostics } = await loadWorkflow(`on:\n  schedule:\n    - cron: '* * * * *'\njobs:\n  a:\n    runs-on: x\n${steps}`)
    expect(workflow).toBeDefined()
    expect(diagnostics).toMatchObject([{ severity: 'warning', line: 3, key: 'cron' }])
  })

  it('rejects an unknown time zone', async () => {
    const { diagnostics } = await loadWorkflow(`on:\n  schedule:\n    - cron: '0 3 * * *'\n      timezone: Mars/Olympus\njobs:\n  a:\n    runs-on: x\n${steps}`)
    expect(diagnostics).toMatchObject([{ severity: 'error', line: 4, column: 17, key: 'timezone', message: expect.stringMatching(/not a known time zone/) }])
  })

  it('stops at keys the parser cannot read', async () => {
    const { workflow, diagnostics } = await loadWorkflow(`true:\n  push:\njobs:\n  a:\n    runs-on: x\n${steps}`)
    expect(workflow).toBeUndefined()
    expect(diagnostics).toMatchObject([{ severity: 'error', line: 1, key: 'true' }])
  })

  it('keeps warnings and not-simulated notices alongside a runnable workflow', async () => {
    const { workflow, diagnostics } = await loadWorkflow(`on: push
jobs:
  test:
    runs-on: x
    services:
      db:
        image: postgres
    steps:
      - uses: actions/setup-python@v6
        with:
          python-version: 3.10
`)
    expect(workflow).toBeDefined()
    expect(diagnostics.map((d) => [d.severity, d.line])).toEqual([
      ['warning', 11],
      ['not-simulated', 5],
    ])
  })
})

describe('explain', () => {
  const range = { start: { line: 2, column: 3 } }

  it('falls back to the first position and the plain message', () => {
    expect(explain({ rawMessage: 'Something odd' })).toEqual({ severity: 'error', line: 1, column: 1, message: 'Something odd' })
  })

  it('strips the excerpt that YAML errors append', () => {
    expect(explain({ rawMessage: 'Implicit keys need to be on a single line at line 7, column 3:\n\n  - run: x\n  ^\n', range }).message).toBe(
      'Implicit keys need to be on a single line',
    )
  })

  it('has a generic fix for other required keys', () => {
    expect(explain({ rawMessage: 'Required property is missing: cron', range }).fix).toBe('Add "cron" here.')
  })
})
