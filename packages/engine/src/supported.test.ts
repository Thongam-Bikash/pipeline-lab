import { NoOperationTraceWriter, parseWorkflow } from '@actions/workflow-parser'
import { describe, expect, it } from 'vitest'
import { findUnsupported } from './supported'

const tokens = (content: string) => parseWorkflow({ name: 'workflow.yml', content }, new NoOperationTraceWriter()).value!
const keys = (content: string) => findUnsupported(tokens(content)).map((d) => [d.key, d.line, d.column])

describe('findUnsupported', () => {
  it('accepts every key the simulator models', () => {
    const workflow = `name: CI
run-name: Deploy by \${{ github.actor }}
env:
  CI: true
defaults:
  run:
    shell: bash
on:
  push:
    branches: [main]
    tags: ['v*']
    paths-ignore: ['docs/**']
  pull_request:
    types: [opened]
    branches-ignore: [wip]
  release:
    types: [published]
  repository_dispatch:
    types: [api-changed]
  workflow_dispatch:
    inputs:
      target:
        type: choice
        options: [dev, prod]
  workflow_call:
    inputs:
      version:
        type: string
  schedule:
    - cron: '0 3 * * *'
jobs:
  test:
    name: Test
    runs-on: ubuntu-24.04
    timeout-minutes: 10
    continue-on-error: false
    env:
      A: b
    defaults:
      run:
        working-directory: app
    outputs:
      v: \${{ steps.v.outputs.v }}
    strategy:
      fail-fast: false
      max-parallel: 2
      matrix:
        node: [22, 24]
        include:
          - node: 24
            experimental: true
    steps:
      - id: v
        name: Version
        if: always()
        run: echo "v=1" >> "$GITHUB_OUTPUT"
        shell: bash
        working-directory: app
        continue-on-error: true
        timeout-minutes: 2
        env:
          X: y
      - uses: actions/setup-node@v7
        with:
          node-version: \${{ matrix.node }}
  deploy:
    needs: [test]
    if: github.ref == 'refs/heads/main'
    runs-on: ubuntu-24.04
    steps:
      - run: echo deploy
`
    expect(findUnsupported(tokens(workflow))).toEqual([])
  })

  it('reports unsupported keys once, without descending into them', () => {
    const workflow = `on: push
permissions:
  contents: read
concurrency: ci
jobs:
  test:
    runs-on: ubuntu-24.04
    environment: production
    services:
      db:
        image: postgres
    steps:
      - run: echo hi
  call:
    uses: octo/repo/.github/workflows/ci.yml@main
`
    const found = findUnsupported(tokens(workflow))
    expect(found.map((d) => [d.key, d.line])).toEqual([
      ['permissions', 2],
      ['concurrency', 4],
      ['jobs.test.environment', 8],
      ['jobs.test.services', 9],
      ['jobs.call.uses', 15],
    ])
    expect(found[0]).toMatchObject({ severity: 'not-simulated', column: 1, message: `"permissions" isn't simulated yet, so this run ignores it. It still works on GitHub.` })
  })

  it('checks events written as a string, a list, or a mapping', () => {
    const job = 'jobs:\n  a:\n    runs-on: x\n    steps:\n      - run: echo\n'
    expect(keys(`on: pull_request_target\n${job}`)).toEqual([['on.pull_request_target', 1, 5]])
    expect(keys(`on: [push, workflow_run]\n${job}`)).toEqual([['on.workflow_run', 1, 12]])
    expect(keys(`on:\n  pull_request_target:\n    branches: [main]\n${job}`)).toEqual([['on.pull_request_target', 2, 3]])
  })
})
