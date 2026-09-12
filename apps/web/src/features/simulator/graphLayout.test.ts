import type { JobRun } from '@pipeline-lab/engine'
import { describe, expect, it } from 'vitest'
import { layout } from './graphLayout'

const job = (id: string, needs: string[] = [], key = id) => ({ id, key, needs }) as JobRun

describe('layout', () => {
  it('puts independent jobs in the first column', () => {
    const { nodes, columns, rows } = layout([job('lint'), job('build')])
    expect(nodes.map((node) => [node.key, node.column, node.row])).toEqual([
      ['lint', 0, 0],
      ['build', 0, 1],
    ])
    expect([columns, rows]).toEqual([1, 2])
  })

  it('places a job after the furthest job it waits for', () => {
    const { nodes, columns } = layout([job('lint'), job('build'), job('test', ['lint', 'build']), job('deploy', ['test'])])
    expect(Object.fromEntries(nodes.map((node) => [node.key, node.column]))).toEqual({ lint: 0, build: 0, test: 1, deploy: 2 })
    expect(columns).toBe(3)
  })

  it('draws a line from every matrix job of a dependency', () => {
    const { edges } = layout([job('test', [], 'test (22)'), job('test', [], 'test (24)'), job('deploy', ['test'])])
    expect(edges).toEqual([
      { from: 'test (22)', to: 'deploy' },
      { from: 'test (24)', to: 'deploy' },
    ])
  })
})
