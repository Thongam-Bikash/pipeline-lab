import type { JobRun } from '@pipeline-lab/engine'

export type GraphNode = { key: string; id: string; column: number; row: number; job: JobRun }
export type GraphEdge = { from: string; to: string }
export type Graph = { nodes: GraphNode[]; edges: GraphEdge[]; columns: number; rows: number }

// A job sits one column to the right of the furthest job it waits for.
function depthOf(id: string, needsById: Map<string, string[]>, cache: Map<string, number>): number {
  const known = cache.get(id)
  if (known !== undefined) return known
  const needs = needsById.get(id) ?? []
  // Guard against a cycle, which the parser rejects before a run is planned.
  cache.set(id, 0)
  const depth = needs.length === 0 ? 0 : Math.max(...needs.map((need) => depthOf(need, needsById, cache) + 1))
  cache.set(id, depth)
  return depth
}

export function layout(jobs: JobRun[]): Graph {
  const needsById = new Map(jobs.map((job) => [job.id, job.needs]))
  const cache = new Map<string, number>()
  const rowsPerColumn = new Map<number, number>()

  const nodes = jobs.map((job) => {
    const column = depthOf(job.id, needsById, cache)
    const row = rowsPerColumn.get(column) ?? 0
    rowsPerColumn.set(column, row + 1)
    return { key: job.key, id: job.id, column, row, job }
  })

  // Every matrix job of a dependency must finish, so each one gets its own line.
  const byId = new Map<string, GraphNode[]>()
  for (const node of nodes) byId.set(node.id, [...(byId.get(node.id) ?? []), node])
  const edges = nodes.flatMap((node) => node.job.needs.flatMap((need) => (byId.get(need) ?? []).map((from) => ({ from: from.key, to: node.key }))))

  return {
    nodes,
    edges,
    columns: Math.max(...nodes.map((node) => node.column), 0) + 1,
    rows: Math.max(...[...rowsPerColumn.values()], 0),
  }
}
