import type { Conclusion, Phase } from '@pipeline-lab/engine'

type Props = { status: Phase; conclusion?: Conclusion; className?: string }

// Status is never carried by colour alone: every state has its own shape and word.
const STATES = {
  succeeded: { label: 'Succeeded', tone: 'text-go', shape: <path d="M3 7l3 3 5-6" /> },
  failed: { label: 'Failed', tone: 'text-stop', shape: <path d="M4 4l6 6M10 4l-6 6" /> },
  cancelled: { label: 'Cancelled', tone: 'text-muted', shape: <rect x="4" y="4" width="6" height="6" /> },
  skipped: { label: 'Skipped', tone: 'text-muted', shape: <><circle cx="7" cy="7" r="4" /><path d="M4.5 9.5l5-5" /></> },
  running: { label: 'Running', tone: 'text-signal', shape: <><circle cx="7" cy="7" r="4" /><path d="M7 3.5A3.5 3.5 0 0 1 10.5 7" strokeWidth="3" /></> },
  queued: { label: 'Queued', tone: 'text-muted', shape: <circle cx="7" cy="7" r="4" /> },
}

export type StatusName = keyof typeof STATES

export function statusOf(status: Phase, conclusion?: Conclusion): StatusName {
  if (status === 'running') return 'running'
  if (status === 'queued') return 'queued'
  if (conclusion === 'success') return 'succeeded'
  if (conclusion === 'failure') return 'failed'
  if (conclusion === 'cancelled') return 'cancelled'
  return 'skipped'
}

export function StatusIcon({ status, conclusion, className = '' }: Props) {
  const state = STATES[statusOf(status, conclusion)]
  return (
    <span className={`inline-flex items-center gap-1.5 ${state.tone} ${className}`}>
      <svg viewBox="0 0 14 14" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
        {state.shape}
      </svg>
      <span className="text-xs font-semibold">{state.label}</span>
    </span>
  )
}
