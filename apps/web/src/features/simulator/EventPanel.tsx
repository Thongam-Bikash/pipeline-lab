import type { SimEvent } from '@pipeline-lab/engine'
import { Button } from '@/components/ui/Button/Button'

type Props = { event: SimEvent; onChange: (event: SimEvent) => void; onRun: () => void; disabled?: boolean }

const TYPES: SimEvent['type'][] = ['push', 'pull_request', 'workflow_dispatch', 'schedule', 'release', 'repository_dispatch', 'workflow_call']

const field = 'rounded-base border border-rule bg-surface px-2 py-1 text-ink'

const filesOf = (event: SimEvent) => ('files' in event ? (event.files ?? []).join(', ') : '')

export function EventPanel({ event, onChange, onRun, disabled }: Props) {
  const setFiles = (value: string) => {
    const files = value
      .split(',')
      .map((file) => file.trim())
      .filter(Boolean)
    onChange({ ...event, files } as SimEvent)
  }

  return (
    <div className="flex flex-wrap items-end gap-3">
      <label className="flex flex-col gap-1 text-xs text-muted">
        Event
        <select className={field} value={event.type} onChange={(e) => onChange({ type: e.target.value as SimEvent['type'] } as SimEvent)}>
          {TYPES.map((type) => (
            <option key={type} value={type}>
              {type}
            </option>
          ))}
        </select>
      </label>

      {event.type === 'push' ? (
        <>
          <label className="flex flex-col gap-1 text-xs text-muted">
            Branch
            <input className={field} value={event.branch ?? ''} placeholder="main" onChange={(e) => onChange({ ...event, branch: e.target.value, tag: undefined })} />
          </label>
          <label className="flex flex-col gap-1 text-xs text-muted">
            Tag instead
            <input className={field} value={event.tag ?? ''} placeholder="v1.0.0" onChange={(e) => onChange({ ...event, tag: e.target.value || undefined })} />
          </label>
        </>
      ) : null}

      {event.type === 'pull_request' ? (
        <>
          <label className="flex flex-col gap-1 text-xs text-muted">
            Base branch
            <input className={field} value={event.base ?? ''} placeholder="main" onChange={(e) => onChange({ ...event, base: e.target.value })} />
          </label>
          <label className="flex flex-col gap-1 text-xs text-muted">
            Action
            <select className={field} value={event.action ?? 'opened'} onChange={(e) => onChange({ ...event, action: e.target.value })}>
              {['opened', 'synchronize', 'reopened', 'closed', 'labeled'].map((action) => (
                <option key={action} value={action}>
                  {action}
                </option>
              ))}
            </select>
          </label>
          <label className="flex items-center gap-2 text-xs text-muted">
            <input type="checkbox" checked={event.fromFork ?? false} onChange={(e) => onChange({ ...event, fromFork: e.target.checked })} />
            From a fork
          </label>
        </>
      ) : null}

      {event.type === 'release' ? (
        <label className="flex flex-col gap-1 text-xs text-muted">
          Action
          <select className={field} value={event.action ?? 'published'} onChange={(e) => onChange({ ...event, action: e.target.value })}>
            {['published', 'created', 'prereleased', 'released', 'edited', 'deleted'].map((action) => (
              <option key={action} value={action}>
                {action}
              </option>
            ))}
          </select>
        </label>
      ) : null}

      {event.type === 'repository_dispatch' ? (
        <label className="flex flex-col gap-1 text-xs text-muted">
          Event type
          <input className={field} value={event.eventType ?? ''} placeholder="api-changed" onChange={(e) => onChange({ ...event, eventType: e.target.value })} />
        </label>
      ) : null}

      {'files' in event ? (
        <label className="flex min-w-52 flex-1 flex-col gap-1 text-xs text-muted">
          Changed files, comma separated
          <input className={field} value={filesOf(event)} placeholder="src/app.ts, README.md" onChange={(e) => setFiles(e.target.value)} />
        </label>
      ) : null}

      <Button variant="primary" onClick={onRun} disabled={disabled}>
        Run workflow
      </Button>
    </div>
  )
}
