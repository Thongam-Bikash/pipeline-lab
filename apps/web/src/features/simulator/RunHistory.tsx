import type { RunState } from '@pipeline-lab/engine'
import { clock } from './LogViewer'
import { StatusIcon } from './StatusIcon'

type Props = { runs: RunState[]; current: number; onSelect: (index: number) => void }

export function RunHistory({ runs, current, onSelect }: Props) {
  if (runs.length === 0) return null

  return (
    <section className="border-t border-rule pt-3">
      <h2 className="text-sm font-semibold">Run history</h2>
      <ul className="mt-2 flex flex-wrap gap-2">
        {runs.map((run, index) => (
          <li key={index}>
            <button
              type="button"
              onClick={() => onSelect(index)}
              aria-pressed={index === current}
              className={`flex items-center gap-2 rounded-base border px-2 py-1 text-sm ${index === current ? 'border-signal' : 'border-rule'}`}
            >
              <span className="font-mono">Run {runs.length - index}</span>
              <StatusIcon status={run.status} conclusion={run.conclusion} />
              <span className="font-mono text-xs text-muted">{clock(run.clock)}</span>
            </button>
          </li>
        ))}
      </ul>
    </section>
  )
}
