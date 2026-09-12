import { advance, runToEnd, startRun, type RunOptions, type RunState, type SimEvent } from '@pipeline-lab/engine'
import type { ParseResult } from '@pipeline-lab/engine'
import { useCallback, useEffect, useState } from 'react'

export type Speed = 1 | 4 | 'instant'

// Wall-clock pause between steps; the run's own clock is simulated.
const DELAY: Record<string, number> = { 1: 400, 4: 100 }

export function useRun(options: RunOptions = {}) {
  const [runs, setRuns] = useState<RunState[]>([])
  const [current, setCurrent] = useState(0)
  const [playing, setPlaying] = useState(false)
  const [speed, setSpeed] = useState<Speed>(1)

  const run = runs[current] ?? null

  const replace = useCallback((next: RunState) => setRuns((all) => all.map((item, index) => (index === current ? next : item))), [current])

  useEffect(() => {
    if (!playing || !run || run.status === 'completed' || speed === 'instant') return
    const timer = setTimeout(() => replace(advance(run, options)), DELAY[speed])
    return () => clearTimeout(timer)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [playing, run, speed, replace])

  const start = useCallback(
    (parsed: ParseResult, event: SimEvent) => {
      if (!parsed.workflow || !parsed.source) return
      const fresh = startRun(parsed.workflow, parsed.source, event)
      setRuns((all) => [speed === 'instant' ? runToEnd(fresh, options) : fresh, ...all])
      setCurrent(0)
      setPlaying(speed !== 'instant')
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [speed],
  )

  const step = useCallback(() => {
    if (run && run.status !== 'completed') {
      setPlaying(false)
      replace(advance(run, options))
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [run, replace])

  const changeSpeed = useCallback(
    (next: Speed) => {
      setSpeed(next)
      if (next === 'instant' && run && run.status !== 'completed') replace(runToEnd(run, options))
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [run, replace],
  )

  return { run, runs, current, playing, speed, start, step, changeSpeed, setCurrent, togglePlaying: () => setPlaying((value) => !value) }
}
