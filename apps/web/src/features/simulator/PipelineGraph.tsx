import type { JobRun } from '@pipeline-lab/engine'
import { useRef, type KeyboardEvent } from 'react'
import { layout, type GraphNode } from './graphLayout'
import { StatusIcon } from './StatusIcon'

type Props = { jobs: JobRun[]; selected?: string; onSelect: (key: string) => void }

const NODE_WIDTH = 168
const NODE_HEIGHT = 56
const GAP_X = 72
const GAP_Y = 20

const positionOf = (node: GraphNode) => ({ x: node.column * (NODE_WIDTH + GAP_X), y: node.row * (NODE_HEIGHT + GAP_Y) })

// Lines leave a station horizontally, change row on a 45 degree bend, then run in again.
function linePath(from: GraphNode, to: GraphNode): string {
  const start = positionOf(from)
  const end = positionOf(to)
  const x1 = start.x + NODE_WIDTH
  const y1 = start.y + NODE_HEIGHT / 2
  const x2 = end.x
  const y2 = end.y + NODE_HEIGHT / 2
  const bend = Math.min(Math.abs(y2 - y1), GAP_X) / 2
  const middle = (x1 + x2) / 2
  return `M ${x1} ${y1} H ${middle - bend} L ${middle + bend} ${y2} H ${x2}`
}

export function PipelineGraph({ jobs, selected, onSelect }: Props) {
  const { nodes, edges, columns, rows } = layout(jobs)
  const buttons = useRef(new Map<string, HTMLButtonElement>())

  const move = (event: KeyboardEvent<HTMLElement>, node: GraphNode) => {
    const step = { ArrowRight: [1, 0], ArrowLeft: [-1, 0], ArrowDown: [0, 1], ArrowUp: [0, -1] }[event.key]
    if (!step) return
    event.preventDefault()
    const target =
      nodes.find((other) => other.column === node.column + step[0]! && other.row === node.row + step[1]!) ??
      nodes.find((other) => other.column === node.column + step[0]! && step[1] === 0)
    if (target) buttons.current.get(target.key)?.focus()
  }

  const width = columns * NODE_WIDTH + (columns - 1) * GAP_X
  const height = rows * NODE_HEIGHT + (rows - 1) * GAP_Y

  return (
    <div className="overflow-x-auto">
      <div className="relative" style={{ width, height }} role="group" aria-label="Jobs in this run">
        <svg className="absolute inset-0 text-rule" width={width} height={height} aria-hidden="true">
          {edges.map((edge) => {
            const from = nodes.find((node) => node.key === edge.from)!
            const to = nodes.find((node) => node.key === edge.to)!
            const done = from.job.status === 'completed'
            return <path key={`${edge.from}->${edge.to}`} d={linePath(from, to)} fill="none" strokeWidth="2" className={done ? 'text-go' : ''} stroke="currentColor" />
          })}
        </svg>

        {nodes.map((node) => {
          const { x, y } = positionOf(node)
          const isSelected = selected === node.key
          return (
            <button
              key={node.key}
              ref={(element) => {
                if (element) buttons.current.set(node.key, element)
              }}
              type="button"
              onClick={() => onSelect(node.key)}
              onKeyDown={(event) => move(event, node)}
              aria-pressed={isSelected}
              className={`absolute flex flex-col justify-center gap-1 rounded-base border bg-surface px-3 text-left ${isSelected ? 'border-signal' : 'border-rule'}`}
              style={{ left: x, top: y, width: NODE_WIDTH, height: NODE_HEIGHT }}
            >
              <span className="truncate font-mono text-sm">{node.job.name}</span>
              <StatusIcon status={node.job.status} conclusion={node.job.conclusion} />
            </button>
          )
        })}
      </div>
    </div>
  )
}
