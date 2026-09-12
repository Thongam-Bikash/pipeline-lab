import { NoOperationTraceWriter, parseWorkflow } from '@actions/workflow-parser'
import { describe, expect, it } from 'vitest'
import { toValue } from './tokens'
import type { Json } from './types'

describe('toValue', () => {
  it('turns a parsed workflow into plain values', () => {
    const content = `name: CI
run-name: \${{ github.actor }}
on:
  push:
env:
  COUNT: 3
  STAGE: prod
jobs:
  a:
    runs-on: ubuntu-24.04
    timeout-minutes: 10
    continue-on-error: true
    steps:
      - run: echo hi
`
    const root = parseWorkflow({ name: 'workflow.yml', content }, new NoOperationTraceWriter()).value!
    const value = toValue(root) as Record<string, Json>

    expect(value).toMatchObject({
      name: 'CI',
      on: { push: null },
      // Environment values are typed as strings by the workflow schema.
      env: { COUNT: '3', STAGE: 'prod' },
      jobs: {
        a: {
          'runs-on': 'ubuntu-24.04',
          'timeout-minutes': 10,
          'continue-on-error': true,
          steps: [{ run: 'echo hi' }],
        },
      },
    })
    expect(value['run-name']).toMatch(/^\$\{\{ .*github\.actor.* \}\}$/)
  })
})
