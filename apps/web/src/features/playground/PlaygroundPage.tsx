import { loadWorkflow, type ParseResult } from '@pipeline-lab/engine'
import { useEffect, useState } from 'react'
import { LogViewer } from '@/features/simulator/LogViewer'
import { PipelineGraph } from '@/features/simulator/PipelineGraph'
import { PlaybackBar } from '@/features/simulator/PlaybackBar'
import { RunHistory } from '@/features/simulator/RunHistory'
import { useRun } from '@/features/simulator/useRun'

// A fixture until the editor arrives, so the run view has something real to show.
const FIXTURE = `name: CI
on:
  push:
    branches: [main]
jobs:
  lint:
    runs-on: ubuntu-24.04
    steps:
      - uses: actions/checkout@v7
      - run: npm run lint
  build:
    runs-on: ubuntu-24.04
    steps:
      - uses: actions/checkout@v7
      - run: npm run build
  test:
    needs: [lint, build]
    runs-on: ubuntu-24.04
    strategy:
      matrix:
        node: [22, 24]
    steps:
      - uses: actions/checkout@v7
      - uses: actions/setup-node@v7
        with:
          node-version: \${{ matrix.node }}
      - id: report
        run: |
          npm test
          echo "cases=128" >> "$GITHUB_OUTPUT"
          echo "### 128 tests passed" >> "$GITHUB_STEP_SUMMARY"
  deploy:
    needs: [test]
    if: github.ref == 'refs/heads/main'
    runs-on: ubuntu-24.04
    steps:
      - run: echo "Deploying"
`

export function PlaygroundPage() {
  const [parsed, setParsed] = useState<ParseResult>()
  const [selected, setSelected] = useState<string>()
  const { run, runs, current, playing, speed, start, step, changeSpeed, setCurrent, togglePlaying } = useRun({ seed: 3 })

  useEffect(() => {
    void loadWorkflow(FIXTURE).then(setParsed)
  }, [])

  const notices = parsed?.diagnostics ?? []
  const job = run?.jobs.find((candidate) => candidate.key === selected) ?? run?.jobs[0]

  return (
    <div>
      <div className="flex flex-wrap items-baseline justify-between gap-3">
        <h1 className="text-3xl font-bold">Playground</h1>
        <p className="text-sm text-muted">This simulates a documented subset of GitHub Actions. Anything it does not model is listed, never ignored.</p>
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-[minmax(0,22rem)_minmax(0,1fr)]">
        <section>
          <h2 className="text-sm font-semibold">.github/workflows/ci.yml</h2>
          <pre className="mt-2 max-h-[28rem] overflow-auto rounded-base border border-rule bg-surface p-3 font-mono text-xs">{FIXTURE}</pre>
          {notices.length === 0 ? null : (
            <ul className="mt-3 space-y-1 text-xs text-muted">
              {notices.map((notice, index) => (
                <li key={index}>
                  Line {notice.line}: {notice.message}
                </li>
              ))}
            </ul>
          )}
        </section>

        <section>
          <PlaybackBar
            run={run}
            playing={playing}
            speed={speed}
            onRun={() => parsed && start(parsed, { type: 'push', branch: 'main' })}
            onPlayPause={togglePlaying}
            onStep={step}
            onSpeed={changeSpeed}
          />

          {run ? (
            <>
              <div className="mt-6">
                <PipelineGraph jobs={run.jobs} selected={job?.key} onSelect={setSelected} />
              </div>
              <div className="mt-8">
                <LogViewer job={job} />
              </div>
              <div className="mt-8">
                <RunHistory runs={runs} current={current} onSelect={setCurrent} />
              </div>
            </>
          ) : (
            <p className="mt-6 text-muted">Run the workflow to watch the jobs execute.</p>
          )}
        </section>
      </div>
    </div>
  )
}
