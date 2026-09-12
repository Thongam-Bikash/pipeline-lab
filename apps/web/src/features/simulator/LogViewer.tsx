import type { JobRun } from '@pipeline-lab/engine'
import { StatusIcon } from './StatusIcon'

type Props = { job?: JobRun; onGoToLine?: (line: number) => void }

export const clock = (ms: number) => {
  const total = Math.round(ms / 1000)
  return `${String(Math.floor(total / 60)).padStart(2, '0')}:${String(total % 60).padStart(2, '0')}`
}

export function LogViewer({ job, onGoToLine }: Props) {
  if (!job) return <p className="text-muted">Pick a job to read its logs.</p>

  return (
    <div>
      <h3 className="flex items-center gap-3 text-sm font-semibold">
        <span className="font-mono">{job.name}</span>
        <StatusIcon status={job.status} conclusion={job.conclusion} />
      </h3>

      <div className="mt-3 divide-y divide-rule border-y border-rule">
        {job.steps.map((step, index) => (
          <details key={`${step.id}-${index}`} open={step.conclusion === 'failure'}>
            <summary className="flex cursor-pointer items-center gap-3 py-2">
              <StatusIcon status={step.status} conclusion={step.conclusion} />
              <span className="truncate">{step.name}</span>
              {step.finishedAt === undefined ? null : <span className="ml-auto font-mono text-xs text-muted">{clock(step.finishedAt - step.startedAt!)}</span>}
            </summary>

            <div className="pb-3 pl-1 font-mono text-xs">
              {step.logs.length === 0 ? <p className="text-muted">No output.</p> : null}
              {step.logs.map((line, position) => (
                <p key={position} className="flex gap-3">
                  <span className="shrink-0 text-muted">{clock(line.at)}</span>
                  <span className="whitespace-pre-wrap">{line.text}</span>
                </p>
              ))}

              {step.annotations.map((annotation, position) => (
                <p key={`annotation-${position}`} className={`mt-2 flex flex-wrap items-center gap-2 ${annotation.level === 'error' ? 'text-stop' : 'text-caution'}`}>
                  <span>
                    {annotation.level}: {annotation.message}
                  </span>
                  {annotation.line !== undefined && onGoToLine ? (
                    <button type="button" className="underline underline-offset-4" onClick={() => onGoToLine(annotation.line!)}>
                      Go to line {annotation.line}
                    </button>
                  ) : null}
                </p>
              ))}
            </div>
          </details>
        ))}
      </div>

      {job.summary.length === 0 ? null : (
        <section className="mt-6">
          <h4 className="text-sm font-semibold">Job summary</h4>
          <pre className="mt-2 whitespace-pre-wrap font-mono text-xs text-muted">{job.summary.join('\n')}</pre>
        </section>
      )}
    </div>
  )
}
