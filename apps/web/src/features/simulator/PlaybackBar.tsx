import type { RunState } from '@pipeline-lab/engine'
import { Button } from '@/components/ui/Button/Button'
import { clock } from './LogViewer'
import { StatusIcon } from './StatusIcon'
import type { Speed } from './useRun'

type Props = {
  run: RunState | null
  playing: boolean
  speed: Speed
  onRun: () => void
  onPlayPause: () => void
  onStep: () => void
  onSpeed: (speed: Speed) => void
}

const SPEEDS: Speed[] = [1, 4, 'instant']
const speedLabel = (speed: Speed) => (speed === 'instant' ? 'Instant' : `${speed}x`)

export function PlaybackBar({ run, playing, speed, onRun, onPlayPause, onStep, onSpeed }: Props) {
  const finished = run?.status === 'completed'

  return (
    <div className="flex flex-wrap items-center gap-3 border-b border-rule pb-3">
      <Button variant="primary" onClick={onRun}>
        Run workflow
      </Button>

      {run ? (
        <>
          <StatusIcon status={run.status} conclusion={run.conclusion} />
          <span className="font-mono text-sm text-muted">{clock(run.clock)}</span>
          <Button onClick={onPlayPause} disabled={finished}>
            {playing ? 'Pause' : 'Resume'}
          </Button>
          <Button onClick={onStep} disabled={finished}>
            Step
          </Button>
          <span className="flex items-center gap-1 text-sm text-muted">
            Speed
            {SPEEDS.map((option) => (
              <Button key={String(option)} variant={option === speed ? 'primary' : 'quiet'} onClick={() => onSpeed(option)}>
                {speedLabel(option)}
              </Button>
            ))}
          </span>
        </>
      ) : null}
    </div>
  )
}
