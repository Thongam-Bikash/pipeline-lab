type Result = { id: string; label: string; ok: boolean }

type Props = { results: Result[] }

export function ScenarioChecks({ results }: Props) {
  const passed = results.filter((result) => result.ok).length

  return (
    <section>
      <h2 className="text-sm font-semibold">
        Checks: {passed} of {results.length} passing
      </h2>
      <ul className="mt-2 space-y-1">
        {results.map((result) => (
          <li key={result.id} className={`flex items-start gap-2 text-sm ${result.ok ? 'text-go' : 'text-muted'}`}>
            <svg viewBox="0 0 14 14" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true" className="mt-1 shrink-0">
              {result.ok ? <path d="M3 7l3 3 5-6" /> : <circle cx="7" cy="7" r="4" />}
            </svg>
            <span>
              <span className="sr-only">{result.ok ? 'Passing: ' : 'Not yet: '}</span>
              {result.label}
            </span>
          </li>
        ))}
      </ul>
    </section>
  )
}
