import { useState } from 'react'
import { Button } from '@/components/ui/Button/Button'
import { Dialog } from '@/components/ui/Dialog/Dialog'
import { useProgress } from './store'

const formatDate = (iso: string) => new Date(iso).toLocaleDateString(undefined, { day: 'numeric', month: 'long', year: 'numeric' })

export function ProgressPage() {
  const lessons = useProgress((state) => state.lessons)
  const scenarios = useProgress((state) => state.scenarios)
  const reset = useProgress((state) => state.reset)
  const [confirming, setConfirming] = useState(false)

  const lessonEntries = Object.entries(lessons)
  const scenarioEntries = Object.entries(scenarios)
  const nothingYet = lessonEntries.length === 0 && scenarioEntries.length === 0

  return (
    <div className="max-w-[68ch]">
      <h1 className="text-3xl font-bold">Your progress</h1>
      <p className="mt-2 text-muted">Progress is kept in this browser. Signing in to sync it across devices comes later.</p>

      {nothingYet ? (
        <p className="mt-8">You have not finished a lesson or a scenario yet.</p>
      ) : (
        <div className="mt-8 space-y-8">
          <section>
            <h2 className="text-lg font-semibold">Lessons finished: {lessonEntries.length}</h2>
            <ul className="mt-2 divide-y divide-rule border-y border-rule">
              {lessonEntries.map(([id, lesson]) => (
                <li key={id} className="flex justify-between gap-4 py-2">
                  <span className="font-mono text-sm">{id}</span>
                  <span className="text-sm text-muted">
                    {formatDate(lesson.completedAt)}
                    {lesson.quizScore === undefined ? '' : `, quiz ${lesson.quizScore}%`}
                  </span>
                </li>
              ))}
            </ul>
          </section>

          <section>
            <h2 className="text-lg font-semibold">Scenarios passed: {scenarioEntries.length}</h2>
            <ul className="mt-2 divide-y divide-rule border-y border-rule">
              {scenarioEntries.map(([id, scenario]) => (
                <li key={id} className="flex justify-between gap-4 py-2">
                  <span className="font-mono text-sm">{id}</span>
                  <span className="text-sm text-muted">
                    {formatDate(scenario.passedAt)}, {scenario.hintsUsed} {scenario.hintsUsed === 1 ? 'hint' : 'hints'}
                  </span>
                </li>
              ))}
            </ul>
          </section>
        </div>
      )}

      <div className="mt-10 border-t border-rule pt-6">
        <Button onClick={() => setConfirming(true)}>Reset progress</Button>
      </div>

      <Dialog open={confirming} title="Reset progress?" onClose={() => setConfirming(false)}>
        <p className="max-w-[40ch] text-sm">This clears every finished lesson and scenario in this browser. Your theme setting is kept.</p>
        <div className="mt-5 flex gap-3">
          <Button
            variant="primary"
            onClick={() => {
              reset()
              setConfirming(false)
            }}
          >
            Reset progress
          </Button>
          <Button onClick={() => setConfirming(false)}>Cancel</Button>
        </div>
      </Dialog>
    </div>
  )
}
