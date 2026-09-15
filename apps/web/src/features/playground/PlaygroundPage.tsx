import { loadWorkflow, matchEvent, type ParseResult, type SimEvent } from '@pipeline-lab/engine'
import { useEffect, useRef, useState } from 'react'
import { EventPanel } from '@/features/simulator/EventPanel'
import { LogViewer } from '@/features/simulator/LogViewer'
import { PipelineGraph } from '@/features/simulator/PipelineGraph'
import { PlaybackBar } from '@/features/simulator/PlaybackBar'
import { RunHistory } from '@/features/simulator/RunHistory'
import { SimNotice } from '@/features/simulator/SimNotice'
import { WorkflowEditor, type EditorApi } from '@/features/simulator/WorkflowEditor'
import { useRun } from '@/features/simulator/useRun'

const TEMPLATE = `name: CI
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
  const [source, setSource] = useState(TEMPLATE)
  const [parsed, setParsed] = useState<ParseResult>()
  const [event, setEvent] = useState<SimEvent>({ type: 'push', branch: 'main', files: ['src/app.ts'] })
  const [selected, setSelected] = useState<string>()
  const editor = useRef<EditorApi | undefined>(undefined)
  const { run, runs, current, playing, speed, start, step, changeSpeed, setCurrent, togglePlaying } = useRun({ seed: 3 })

  // Re-parse shortly after typing stops, so every keystroke does not run the parser.
  useEffect(() => {
    const timer = setTimeout(() => void loadWorkflow(source).then(setParsed), 250)
    return () => clearTimeout(timer)
  }, [source])

  const errors = parsed?.diagnostics.filter((diagnostic) => diagnostic.severity === 'error') ?? []
  const match = parsed?.workflow ? matchEvent(parsed.workflow.events, event) : undefined
  const startRun = () => parsed && match?.runs && start(parsed, event)

  // Space and full stop drive playback, unless the focus is somewhere that takes typing.
  useEffect(() => {
    const onKeyDown = (keyEvent: KeyboardEvent) => {
      const target = keyEvent.target as HTMLElement | null
      // The focused control comes first: space types, and space activates a button.
      if (target?.closest('input, textarea, select, button, a, summary, [contenteditable], .monaco-editor')) return
      if (keyEvent.key === ' ') {
        keyEvent.preventDefault()
        togglePlaying()
      }
      if (keyEvent.key === '.') step()
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [togglePlaying, step])

  const job = run?.jobs.find((candidate) => candidate.key === selected) ?? run?.jobs[0]

  return (
    <div>
      <div className="flex flex-wrap items-baseline justify-between gap-3">
        <h1 className="text-3xl font-bold">Playground</h1>
        <p className="text-xs text-muted">Ctrl+Enter runs the workflow. Space pauses, full stop steps. Ctrl+M moves focus out of the editor.</p>
      </div>

      <div className="mt-6 grid gap-8 lg:grid-cols-2">
        {/* min-w-0 lets the graph scroll inside its own box; a grid item will not shrink below its content otherwise. */}
        <section className="min-w-0">
          <h2 className="font-mono text-sm">.github/workflows/ci.yml</h2>
          <div className="mt-2">
            <WorkflowEditor value={source} onChange={setSource} onRun={startRun} onReady={(api) => (editor.current = api)} />
          </div>
          <SimNotice diagnostics={parsed?.diagnostics ?? []} onGoToLine={(line) => editor.current?.goToLine(line)} />
        </section>

        <section className="min-w-0">
          {/* Disabled until the workflow has been parsed, so an enabled button really can run. */}
          <EventPanel event={event} onChange={setEvent} onRun={startRun} disabled={!parsed || errors.length > 0 || match?.runs === false} />

          {match ? <p className={`mt-2 text-xs ${match.runs ? 'text-muted' : 'text-caution'}`}>{match.reason}</p> : null}

          <div className="mt-4">
            <PlaybackBar run={run} playing={playing} speed={speed} onPlayPause={togglePlaying} onStep={step} onSpeed={changeSpeed} />
          </div>

          {run ? (
            <>
              <div className="mt-6">
                <PipelineGraph jobs={run.jobs} selected={job?.key} onSelect={setSelected} />
              </div>
              <div className="mt-8">
                <LogViewer job={job} onGoToLine={(line) => editor.current?.goToLine(line)} />
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
