import type { Json } from '@pipeline-lab/engine'
import type { Scenario, ScenarioContext } from './types'

// The code needs Node 24, the Active LTS line. CI is still pinned to 22, which is in
// maintenance, so the tests fail there and nowhere else. 26 is Current, and becomes LTS soon.
const REQUIRED = 24
const NEXT = 26

function testJob(raw: Record<string, Json>): Record<string, Json> | undefined {
  const jobs = raw['jobs']
  if (!jobs || typeof jobs !== 'object' || Array.isArray(jobs)) return undefined
  const job = (jobs as Record<string, Json>)['test']
  return job && typeof job === 'object' && !Array.isArray(job) ? (job as Record<string, Json>) : undefined
}

function matrixVersions(raw: Record<string, Json>): number[] {
  const strategy = testJob(raw)?.['strategy']
  if (!strategy || typeof strategy !== 'object' || Array.isArray(strategy)) return []
  const matrix = (strategy as Record<string, Json>)['matrix']
  if (!matrix || typeof matrix !== 'object' || Array.isArray(matrix)) return []
  const node = (matrix as Record<string, Json>)['node']
  return Array.isArray(node) ? node.map(Number).filter((value) => !Number.isNaN(value)) : []
}

function setupNodeVersion(raw: Record<string, Json>): string {
  const steps = testJob(raw)?.['steps']
  if (!Array.isArray(steps)) return ''
  for (const step of steps) {
    if (!step || typeof step !== 'object' || Array.isArray(step)) continue
    const uses = (step as Record<string, Json>)['uses']
    if (typeof uses !== 'string' || !uses.startsWith('actions/setup-node')) continue
    const withValues = (step as Record<string, Json>)['with']
    if (!withValues || typeof withValues !== 'object' || Array.isArray(withValues)) return ''
    return String((withValues as Record<string, Json>)['node-version'] ?? '')
  }
  return ''
}

const ran = (context: ScenarioContext) => context.run?.status === 'completed'

export const worksOnMyMachine: Scenario = {
  id: 'works-on-my-machine',
  order: 1,
  title: 'Works on my machine',
  moduleSlug: 'expressions',
  story: [
    'Your tests pass on your laptop and fail in CI, with a syntax error about a language feature the code relies on.',
    'Your laptop runs Node 24, the Active LTS line, and the code is written for it. The workflow pins Node 22, which is only in maintenance, and the pin is buried in a setup step where nobody reads it.',
    'Make CI test the versions the team actually supports: 24 now, and 26, which becomes the next LTS line. Both must pass, and the workflow should say which version it is testing rather than hiding it.',
  ],
  file: '.github/workflows/ci.yml',
  starting: `name: CI
on: push
jobs:
  test:
    runs-on: ubuntu-24.04
    steps:
      - uses: actions/checkout@v7
      - uses: actions/setup-node@v7
        with:
          node-version: 22
      - run: npm ci
      - run: npm test
`,
  event: { type: 'push', branch: 'main' },
  rules: [
    {
      // The code needs Node 24, so the suite fails on anything older, whatever the workflow claims.
      match: (step) => step.run === 'npm test' && Number(step.matrix['node'] ?? step.with['node-version'] ?? 22) < REQUIRED,
      outcome: 'failure',
      logs: ['SyntaxError: unsupported syntax in src/report.ts', 'Tests failed on this Node version'],
    },
    { match: (step) => step.run === 'npm test', logs: ['128 passing'] },
  ],
  checks: [
    {
      id: 'matrix-covers-lts',
      label: `The tests run on Node ${REQUIRED}, the version the code needs`,
      test: (context) => matrixVersions(context.raw).includes(REQUIRED),
    },
    {
      id: 'matrix-covers-next',
      label: `Node ${NEXT} is covered too, so the next LTS line does not surprise you`,
      test: (context) => matrixVersions(context.raw).includes(NEXT),
    },
    {
      id: 'setup-uses-matrix',
      label: 'setup-node takes its version from the matrix, not a hardcoded number',
      test: (context) => /\$\{\{\s*matrix\.node\s*\}\}/.test(setupNodeVersion(context.raw)),
    },
    {
      id: 'run-is-green',
      label: 'The run passes on every version in the matrix',
      test: (context) => ran(context) && context.run!.conclusion === 'success' && context.run!.jobs.length >= 2,
    },
  ],
  hints: [
    'The failure names a Node version, and the workflow pins one. Which version is the code written for?',
    'A strategy matrix runs the same job once per value. Give it a node list holding the versions the team supports.',
    'Then have setup-node read that value with ${{ matrix.node }}, so the pin and the matrix cannot disagree.',
  ],
  debrief: [
    'Deleting the failing test, or pinning CI to the old version, would have turned the check green and left the bug. Testing the versions you actually support is the fix.',
    'Dropping Node 22 here was a decision, not an accident: it is in maintenance, and the code needs a feature it does not have. A matrix makes that decision visible in the workflow instead of hidden in a setup step.',
    'The same pattern covers anything versioned: language runtimes, database engines, operating systems. Name the versions you support, and let CI hold you to them.',
  ],
  solution: `name: CI
on: push
jobs:
  test:
    runs-on: ubuntu-24.04
    strategy:
      matrix:
        node: [24, 26]
    steps:
      - uses: actions/checkout@v7
      - uses: actions/setup-node@v7
        with:
          node-version: \${{ matrix.node }}
      - run: npm ci
      - run: npm test
`,
  lastVerified: '2026-09-15',
  sources: [
    'https://docs.github.com/en/actions/reference/workflows-and-actions/workflow-syntax#jobsjob_idstrategymatrix',
    'https://github.com/nodejs/Release',
  ],
}
