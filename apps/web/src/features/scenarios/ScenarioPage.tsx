import { loadWorkflow, toValue, type Json, type ParseResult } from '@pipeline-lab/engine'
import { useEffect, useRef, useState } from 'react'
import { Link, useParams } from 'react-router'
import { Button } from '@/components/ui/Button/Button'
import { findScenario } from '@/content/scenarios'
import type { ScenarioCheck, ScenarioContext } from '@/content/scenarios/types'
import { useProgress } from '@/features/progress/store'
import { LogViewer } from '@/features/simulator/LogViewer'
import { PipelineGraph } from '@/features/simulator/PipelineGraph'
import { PlaybackBar } from '@/features/simulator/PlaybackBar'
import { SimNotice } from '@/features/simulator/SimNotice'
import { WorkflowEditor, type EditorApi } from '@/features/simulator/WorkflowEditor'
import { useRun } from '@/features/simulator/useRun'
import { ScenarioChecks } from './ScenarioChecks'

// A check reads the learner's workflow, which may be half-edited, so a throw just means "not yet".
const evaluate = (check: ScenarioCheck, context: ScenarioContext): boolean => {
  try {
    return check.test(context)
  } catch {
    return false
  }
}

export function ScenarioPage() {
  const { scenarioId = '' } = useParams()
  const scenario = findScenario(scenarioId)
  const [source, setSource] = useState(scenario?.starting ?? '')
  const [parsed, setParsed] = useState<ParseResult>()
  const [hintsShown, setHintsShown] = useState(0)
  const [selected, setSelected] = useState<string>()
  const editor = useRef<EditorApi | undefined>(undefined)
  const passScenario = useProgress((state) => state.passScenario)
  const alreadyPassed = useProgress((state) => (scenario ? state.scenarios[scenario.id] : undefined))
  const { run, playing, speed, start, step, changeSpeed, togglePlaying } = useRun({ rules: scenario?.rules ?? [], seed: 5 })

  useEffect(() => {
    const timer = setTimeout(() => void loadWorkflow(source).then(setParsed), 250)
    return () => clearTimeout(timer)
  }, [source])

  const raw = parsed?.source ? (toValue(parsed.source) as Record<string, Json>) : undefined
  const results = (scenario?.checks ?? []).map((check) => ({
    id: check.id,
    label: check.label,
    ok: raw ? evaluate(check, { raw, run: run ?? undefined }) : false,
  }))
  const solved = results.length > 0 && results.every((result) => result.ok)

  useEffect(() => {
    if (solved && scenario && !alreadyPassed) passScenario(scenario.id, hintsShown)
  }, [solved, scenario, alreadyPassed, passScenario, hintsShown])

  if (!scenario) {
    return (
      <div className="max-w-[68ch]">
        <h1 className="text-3xl font-bold">Scenario not found</h1>
        <p className="mt-4">
          <Link to="/modules" className="text-signal underline underline-offset-4">
            Back to the modules
          </Link>
        </p>
      </div>
    )
  }

  const errors = parsed?.diagnostics.filter((diagnostic) => diagnostic.severity === 'error') ?? []

  return (
    <div>
      <p className="text-sm text-muted">Scenario {scenario.order}</p>
      <h1 className="mt-1 text-3xl font-bold">{scenario.title}</h1>

      <div className="mt-6 grid gap-8 lg:grid-cols-2">
        {/* min-w-0 lets the graph scroll inside its own box; a grid item will not shrink below its content otherwise. */}
        <section className="min-w-0">
          <div className="max-w-[68ch] space-y-3">
            {scenario.story.map((paragraph) => (
              <p key={paragraph}>{paragraph}</p>
            ))}
          </div>

          <div className="mt-6">
            <ScenarioChecks results={results} />
          </div>

          <div className="mt-6">
            {hintsShown > 0 ? (
              <ol className="mb-3 list-decimal space-y-2 pl-5 text-sm text-muted">
                {scenario.hints.slice(0, hintsShown).map((hint) => (
                  <li key={hint}>{hint}</li>
                ))}
              </ol>
            ) : null}
            {hintsShown < scenario.hints.length ? (
              <Button onClick={() => setHintsShown((shown) => shown + 1)}>
                Show a hint ({hintsShown + 1} of {scenario.hints.length})
              </Button>
            ) : null}
          </div>

          {solved ? (
            <section className="mt-8 rounded-base border border-go p-4">
              <h2 className="font-semibold text-go">Solved</h2>
              <div className="mt-2 space-y-3 text-sm">
                {scenario.debrief.map((paragraph) => (
                  <p key={paragraph}>{paragraph}</p>
                ))}
              </div>
              <p className="mt-3 text-xs text-muted">
                {hintsShown === 0 ? 'No hints used.' : `${hintsShown} ${hintsShown === 1 ? 'hint' : 'hints'} used.`}
              </p>
            </section>
          ) : null}
        </section>

        <section className="min-w-0">
          <h2 className="font-mono text-sm">{scenario.file}</h2>
          <div className="mt-2">
            <WorkflowEditor value={source} onChange={setSource} onRun={() => parsed && start(parsed, scenario.event)} onReady={(api) => (editor.current = api)} />
          </div>
          <SimNotice diagnostics={parsed?.diagnostics ?? []} onGoToLine={(line) => editor.current?.goToLine(line)} />

          <div className="mt-4 flex flex-wrap items-center gap-3">
            <Button variant="primary" onClick={() => parsed && start(parsed, scenario.event)} disabled={!parsed || errors.length > 0}>
              Run workflow
            </Button>
            <span className="text-xs text-muted">Event: {scenario.event.type}</span>
          </div>

          {run ? (
            <>
              <div className="mt-4">
                <PlaybackBar run={run} playing={playing} speed={speed} onPlayPause={togglePlaying} onStep={step} onSpeed={changeSpeed} />
              </div>
              <div className="mt-6">
                <PipelineGraph jobs={run.jobs} selected={selected} onSelect={setSelected} />
              </div>
              <div className="mt-8">
                <LogViewer job={run.jobs.find((job) => job.key === selected) ?? run.jobs[0]} onGoToLine={(line) => editor.current?.goToLine(line)} />
              </div>
            </>
          ) : null}
        </section>
      </div>
    </div>
  )
}
