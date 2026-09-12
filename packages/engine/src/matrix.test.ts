import { describe, expect, it } from 'vitest'
import { expandMatrix } from './matrix'
import { loadWorkflow } from './parse'

const strategyOf = async (body: string) => {
  const { workflow, diagnostics } = await loadWorkflow(`on: push\njobs:\n  test:\n    runs-on: ubuntu-24.04\n${body}    steps:\n      - run: echo hi\n`)
  expect(diagnostics).toEqual([])
  return workflow!.jobs[0]!.strategy
}

const expand = async (body: string) => expandMatrix(await strategyOf(body))

describe('expandMatrix', () => {
  it('returns a single job when there is no matrix', async () => {
    expect(expandMatrix(undefined)).toEqual({ combinations: [{}], failFast: true })
    expect(await expand('    strategy:\n      max-parallel: 2\n')).toEqual({ combinations: [{}], failFast: true, maxParallel: 2 })
  })

  it('combines variables with the first one varying slowest', async () => {
    const { combinations } = await expand('    strategy:\n      matrix:\n        os: [ubuntu-24.04, macos-15]\n        node: [22, 24]\n')
    expect(combinations).toEqual([
      { os: 'ubuntu-24.04', node: 22 },
      { os: 'ubuntu-24.04', node: 24 },
      { os: 'macos-15', node: 22 },
      { os: 'macos-15', node: 24 },
    ])
  })

  it('reads fail-fast and max-parallel', async () => {
    const strategy = await expand('    strategy:\n      fail-fast: false\n      max-parallel: 2\n      matrix:\n        node: [22, 24]\n')
    expect(strategy).toMatchObject({ failFast: false, maxParallel: 2 })
    expect(strategy.combinations).toHaveLength(2)
  })

  it('extends a matching combination with include, without overwriting matrix values', async () => {
    const { combinations } = await expand(
      '    strategy:\n      matrix:\n        os: [windows-2025, ubuntu-24.04]\n        node: [14, 16]\n        include:\n          - os: windows-2025\n            node: 16\n            npm: 6\n',
    )
    expect(combinations).toHaveLength(4)
    expect(combinations).toContainEqual({ os: 'windows-2025', node: 16, npm: 6 })
    expect(combinations).toContainEqual({ os: 'windows-2025', node: 14 })
  })

  it('adds a new combination when include matches nothing', async () => {
    const { combinations } = await expand(
      '    strategy:\n      matrix:\n        os: [macos-15, windows-2025, ubuntu-24.04]\n        version: [12, 14, 16]\n        include:\n          - os: windows-2025\n            version: 17\n',
    )
    expect(combinations).toHaveLength(10)
    expect(combinations[9]).toEqual({ os: 'windows-2025', version: 17 })
  })

  it('runs one job per include entry when there are no variables', async () => {
    const { combinations } = await expand(
      '    strategy:\n      matrix:\n        include:\n          - site: production\n            datacenter: site-a\n          - site: staging\n            datacenter: site-b\n',
    )
    expect(combinations).toEqual([
      { site: 'production', datacenter: 'site-a' },
      { site: 'staging', datacenter: 'site-b' },
    ])
  })

  it('excludes partial matches before applying include', async () => {
    const excluded = await expand('    strategy:\n      matrix:\n        os: [ubuntu-24.04, macos-15]\n        node: [22, 24]\n        exclude:\n          - os: macos-15\n            node: 22\n')
    expect(excluded.combinations).toHaveLength(3)
    expect(excluded.combinations).not.toContainEqual({ os: 'macos-15', node: 22 })

    const addedBack = await expand('    strategy:\n      matrix:\n        node: [22, 24]\n        exclude:\n          - node: 24\n        include:\n          - node: 24\n')
    expect(addedBack.combinations).toEqual([{ node: 22 }, { node: 24 }])

    const unknownKey = await expand('    strategy:\n      matrix:\n        node: [22, 24]\n        exclude:\n          - os: macos-15\n')
    expect(unknownKey.combinations).toEqual([{ node: 22 }, { node: 24 }])
  })

  it('keeps object values', async () => {
    const { combinations } = await expand(
      '    strategy:\n      matrix:\n        node:\n          - version: 14\n          - version: 20\n            env: NODE_OPTIONS=--openssl-legacy-provider\n',
    )
    expect(combinations).toEqual([{ node: { version: 14 } }, { node: { version: 20, env: 'NODE_OPTIONS=--openssl-legacy-provider' } }])
  })

  it('leaves nothing to run when every combination is excluded', async () => {
    const { combinations } = await expand('    strategy:\n      matrix:\n        node: [22]\n        exclude:\n          - node: 22\n')
    expect(combinations).toEqual([])
  })

  it('refuses a matrix that is too large or built from an expression', async () => {
    const five = '[1, 2, 3, 4, 5]'
    await expect(expand(`    strategy:\n      matrix:\n        a: ${five}\n        b: ${five}\n        c: ${five}\n        d: ${five}\n`)).rejects.toThrow(
      /at most 256 jobs, but this one creates 625/,
    )
    await expect(expand('    strategy:\n      matrix: ${{ fromJSON(needs.setup.outputs.matrix) }}\n')).rejects.toThrow(/built from an expression is not simulated/)
    await expect(expand('    strategy:\n      matrix:\n        node: ${{ fromJSON(needs.setup.outputs.versions) }}\n')).rejects.toThrow(
      /variable "node" is built from an expression/,
    )
  })
})
