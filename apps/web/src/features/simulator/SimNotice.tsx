import { SUPPORTED, type Diagnostic } from '@pipeline-lab/engine'
import { useState } from 'react'
import { Button } from '@/components/ui/Button/Button'

type Props = { diagnostics: Diagnostic[]; onGoToLine?: (line: number) => void }

const TONE = {
  error: 'text-stop',
  warning: 'text-caution',
  'not-simulated': 'text-muted',
}

const WORD = {
  error: 'Error',
  warning: 'Warning',
  'not-simulated': 'Not simulated',
}

export function SimNotice({ diagnostics, onGoToLine }: Props) {
  const [showingCoverage, setShowingCoverage] = useState(false)

  return (
    <section className="mt-3">
      <p className="text-xs text-muted">
        This simulates a documented subset of GitHub Actions.{' '}
        <button type="button" className="underline underline-offset-4" onClick={() => setShowingCoverage((value) => !value)}>
          {showingCoverage ? 'Hide what it covers' : 'See what it covers'}
        </button>
      </p>

      {showingCoverage ? (
        <ul className="mt-2 max-h-40 overflow-auto rounded-base border border-rule p-2 font-mono text-xs text-muted">
          {SUPPORTED.map((key) => (
            <li key={key}>{key}</li>
          ))}
        </ul>
      ) : null}

      {diagnostics.length === 0 ? null : (
        <ul className="mt-3 space-y-1 text-xs">
          {diagnostics.map((diagnostic, index) => (
            <li key={index} className="flex flex-wrap items-baseline gap-2">
              <span className={`font-semibold ${TONE[diagnostic.severity]}`}>{WORD[diagnostic.severity]}</span>
              {onGoToLine ? (
                <button type="button" className="font-mono underline underline-offset-4" onClick={() => onGoToLine(diagnostic.line)}>
                  line {diagnostic.line}
                </button>
              ) : (
                <span className="font-mono">line {diagnostic.line}</span>
              )}
              <span>{diagnostic.message}</span>
              {diagnostic.fix ? <span className="text-muted">{diagnostic.fix}</span> : null}
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}

export function DiagnosticCount({ diagnostics }: { diagnostics: Diagnostic[] }) {
  const errors = diagnostics.filter((diagnostic) => diagnostic.severity === 'error').length
  if (errors === 0) return null
  return (
    <Button variant="quiet" disabled>
      {errors} {errors === 1 ? 'error' : 'errors'} to fix
    </Button>
  )
}
