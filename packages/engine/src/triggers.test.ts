import { describe, expect, it } from 'vitest'
import { loadWorkflow } from './parse'
import { matchEvent, matchFilter } from './triggers'
import type { EventsConfig, SimEvent } from './types'

const eventsOf = async (on: string): Promise<EventsConfig> => {
  const { workflow, diagnostics } = await loadWorkflow(`${on}\njobs:\n  a:\n    runs-on: ubuntu-24.04\n    steps:\n      - run: echo hi\n`)
  expect(diagnostics).toEqual([])
  return workflow!.events
}

const run = async (on: string, event: SimEvent) => matchEvent(await eventsOf(on), event)

describe('matchFilter', () => {
  it.each([
    [['feature/*'], 'feature/my-branch', true],
    [['feature/*'], 'feature/beta/my-branch', false],
    [['feature/**'], 'feature/beta/my-branch', true],
    [['v2*'], 'v2.9', true],
    [['*.jsx?'], 'page.js', true],
    [['*.jsx?'], 'page.jsx', true],
    [['*.jsx?'], 'page.jsxx', false],
    [['v[12].[0-9]+.[0-9]+'], 'v1.10.1', true],
    [['v[12].[0-9]+.[0-9]+'], 'v3.0.0', false],
    [['**/README.md'], 'js/README.md', true],
    [['docs/*'], 'docs/mona/octocat.txt', false],
    // A later pattern flips the result, in file order.
    [['*.md', '!README.md'], 'README.md', false],
    [['*.md', '!README.md', 'README*'], 'README.md', true],
    [['!only-negative'], 'anything', false],
    // Backslash escapes a special character, and a stray bracket is literal.
    [['release\\+beta'], 'release+beta', true],
    [['release\\+beta'], 'releasebeta', false],
    [['[v'], '[v', true],
    [['a\\'], 'a\\', true],
  ])('%s matches %s -> %s', (patterns, value, expected) => {
    expect(matchFilter(patterns, value)).toBe(expected)
  })
})

describe('matchEvent', () => {
  it('reports when the workflow has no such trigger', async () => {
    expect(await run('on: push', { type: 'pull_request' })).toEqual({ runs: false, reason: 'This workflow has no "pull_request" trigger.' })
  })

  it('matches a push by branch', async () => {
    const on = "on:\n  push:\n    branches: [main, 'releases/**']"
    expect(await run(on, { type: 'push', branch: 'releases/10' })).toMatchObject({ runs: true })
    expect(await run(on, { type: 'push' })).toMatchObject({ runs: true, reason: 'The push to branch "main" matches this workflow.' })
    expect(await run(on, { type: 'push', branch: 'wip' })).toMatchObject({ runs: false, reason: expect.stringContaining('does not match branches') })
  })

  it('excludes branches with branches-ignore', async () => {
    const on = 'on:\n  push:\n    branches-ignore: [wip]'
    expect(await run(on, { type: 'push', branch: 'main' })).toMatchObject({ runs: true })
    expect(await run(on, { type: 'push', branch: 'wip' })).toMatchObject({ runs: false, reason: expect.stringContaining('branches-ignore') })
  })

  it('matches tags, and keeps branch-only and tag-only filters apart', async () => {
    const tags = "on:\n  push:\n    tags: ['v1.*']"
    expect(await run(tags, { type: 'push', tag: 'v1.9' })).toMatchObject({ runs: true })
    expect(await run(tags, { type: 'push', tag: 'v2' })).toMatchObject({ runs: false, reason: expect.stringContaining('does not match tags') })
    expect(await run(tags, { type: 'push', branch: 'main' })).toMatchObject({ runs: false, reason: expect.stringContaining('filters tags only') })
    expect(await run('on:\n  push:\n    branches: [main]', { type: 'push', tag: 'v1' })).toMatchObject({
      runs: false,
      reason: expect.stringContaining('filters branches only'),
    })
    expect(await run("on:\n  push:\n    tags-ignore: ['v1.*']", { type: 'push', tag: 'v1.9' })).toMatchObject({
      runs: false,
      reason: expect.stringContaining('tags-ignore'),
    })
  })

  it('matches changed files against paths filters', async () => {
    const paths = "on:\n  push:\n    paths: ['**.js']"
    expect(await run(paths, { type: 'push', files: ['src/a.js'] })).toMatchObject({ runs: true })
    expect(await run(paths, { type: 'push', files: ['README.md'] })).toMatchObject({ runs: false, reason: expect.stringContaining('No changed file matches paths') })
    expect(await run(paths, { type: 'push' })).toMatchObject({ runs: false, reason: 'A paths filter needs changed files, and this event has none.' })
    const ignore = "on:\n  push:\n    paths-ignore: ['docs/**']"
    expect(await run(ignore, { type: 'push', files: ['docs/a.md'] })).toMatchObject({ runs: false, reason: expect.stringContaining('paths-ignore') })
    expect(await run(ignore, { type: 'push', files: ['docs/a.md', 'src/a.js'] })).toMatchObject({ runs: true })
  })

  it('ignores path filters for tag pushes', async () => {
    const on = "on:\n  push:\n    tags: ['v*']\n    paths: ['src/**']"
    expect(await run(on, { type: 'push', tag: 'v1' })).toMatchObject({ runs: true })
  })

  it('needs both the branch and the path filter to match', async () => {
    const on = "on:\n  push:\n    branches: [main]\n    paths: ['src/**']"
    expect(await run(on, { type: 'push', branch: 'main', files: ['src/a.ts'] })).toMatchObject({ runs: true })
    expect(await run(on, { type: 'push', branch: 'main', files: ['docs/a.md'] })).toMatchObject({ runs: false })
    expect(await run(on, { type: 'push', branch: 'wip', files: ['src/a.ts'] })).toMatchObject({ runs: false })
  })

  it('uses the default pull request activity types', async () => {
    expect(await run('on: pull_request', { type: 'pull_request' })).toMatchObject({ runs: true, reason: 'The pull request into "main" matches this workflow.' })
    expect(await run('on: pull_request', { type: 'pull_request', action: 'closed' })).toMatchObject({
      runs: false,
      reason: 'The pull request action "closed" is not in types (opened, synchronize, reopened).',
    })
    expect(await run('on:\n  pull_request:\n    types: [closed]', { type: 'pull_request', action: 'closed' })).toMatchObject({ runs: true })
  })

  it('filters pull requests by their base branch and files', async () => {
    const on = "on:\n  pull_request:\n    branches: ['releases/**']\n    paths: ['src/**']"
    expect(await run(on, { type: 'pull_request', base: 'releases/10', files: ['src/a.ts'] })).toMatchObject({ runs: true })
    expect(await run(on, { type: 'pull_request', base: 'main', files: ['src/a.ts'] })).toMatchObject({ runs: false })
  })

  it('runs every release and dispatch type unless types narrows them', async () => {
    expect(await run('on: release', { type: 'release', action: 'created' })).toMatchObject({ runs: true })
    expect(await run('on: release', { type: 'release' })).toMatchObject({ runs: true, reason: 'The release "published" matches this workflow.' })
    expect(await run('on:\n  release:\n    types: [published]', { type: 'release', action: 'created' })).toMatchObject({ runs: false })
    expect(await run('on:\n  repository_dispatch:',{ type: 'repository_dispatch', eventType: 'anything' })).toMatchObject({ runs: true })
    expect(await run('on:\n  repository_dispatch:',{ type: 'repository_dispatch' })).toMatchObject({ runs: true })
    expect(await run('on:\n  repository_dispatch:\n    types: [api-changed]', { type: 'repository_dispatch', eventType: 'other' })).toMatchObject({
      runs: false,
      reason: 'The event type "other" is not in types (api-changed).',
    })
  })

  it('runs manual, scheduled, and called workflows when the trigger exists', async () => {
    expect(await run('on: workflow_dispatch', { type: 'workflow_dispatch' })).toMatchObject({ runs: true })
    expect(await run("on:\n  schedule:\n    - cron: '0 3 * * *'", { type: 'schedule' })).toMatchObject({ runs: true })
    expect(await run('on: workflow_call', { type: 'workflow_call' })).toMatchObject({ runs: true })
  })
})
