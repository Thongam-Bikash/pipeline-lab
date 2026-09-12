import type { EventsConfig, MatchResult, SimEvent } from './types'

type Filters = {
  branches?: string[]
  'branches-ignore'?: string[]
  tags?: string[]
  'tags-ignore'?: string[]
  paths?: string[]
  'paths-ignore'?: string[]
  types?: string[]
}

// GitHub runs a pull_request workflow for these activity types unless `types` says otherwise.
const DEFAULT_PULL_REQUEST_TYPES = ['opened', 'synchronize', 'reopened']

const yes = (reason: string): MatchResult => ({ runs: true, reason })
const no = (reason: string): MatchResult => ({ runs: false, reason })
const list = (patterns: string[]) => patterns.join(', ')

function escapeLiteral(char: string): string {
  return char.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

// Filter patterns: * stops at /, ** crosses it, ? and + repeat the character before them.
function toRegExp(pattern: string): RegExp {
  let body = ''
  for (let i = 0; i < pattern.length; i++) {
    const char = pattern[i]!
    if (char === '\\') {
      body += escapeLiteral(pattern[++i] ?? '\\')
    } else if (char === '*') {
      const double = pattern[i + 1] === '*'
      body += double ? '.*' : '[^/]*'
      if (double) i++
    } else if (char === '?' || char === '+') {
      body += char
    } else if (char === '[' && pattern.indexOf(']', i) > i) {
      const end = pattern.indexOf(']', i)
      body += pattern.slice(i, end + 1)
      i = end
    } else {
      body += escapeLiteral(char)
    }
  }
  return new RegExp(`^${body}$`)
}

// Patterns are checked in order: a later match flips the result, so "!" can exclude and re-include.
export function matchFilter(patterns: string[], value: string): boolean {
  let matched = false
  for (const pattern of patterns) {
    const negated = pattern.startsWith('!')
    if (toRegExp(negated ? pattern.slice(1) : pattern).test(value)) matched = !negated
  }
  return matched
}

function checkRef(f: Filters, kind: 'branch' | 'tag', name: string): MatchResult | undefined {
  const plural = kind === 'branch' ? 'branches' : 'tags'
  const include = kind === 'branch' ? f.branches : f.tags
  const ignore = kind === 'branch' ? f['branches-ignore'] : f['tags-ignore']
  if (include && !matchFilter(include, name)) return no(`The ${kind} "${name}" does not match ${plural} (${list(include)}).`)
  if (ignore && matchFilter(ignore, name)) return no(`The ${kind} "${name}" is excluded by ${plural}-ignore (${list(ignore)}).`)
  return undefined
}

function checkPaths(f: Filters, files: string[] | undefined): MatchResult | undefined {
  const include = f.paths
  const ignore = f['paths-ignore']
  if (!include && !ignore) return undefined
  const changed = files ?? []
  if (!changed.length) return no('A paths filter needs changed files, and this event has none.')
  if (include && !changed.some((file) => matchFilter(include, file))) return no(`No changed file matches paths (${list(include)}).`)
  if (ignore && changed.every((file) => matchFilter(ignore, file))) return no(`Every changed file is excluded by paths-ignore (${list(ignore)}).`)
  return undefined
}

function matchPush(f: Filters, event: Extract<SimEvent, { type: 'push' }>): MatchResult {
  const branchFilters = f.branches ?? f['branches-ignore']
  const tagFilters = f.tags ?? f['tags-ignore']
  if (event.tag !== undefined) {
    if (!tagFilters && branchFilters) return no('This workflow filters branches only, so it does not run for tag pushes.')
    // Path filters are not applied to tag pushes.
    return checkRef(f, 'tag', event.tag) ?? yes(`The push of tag "${event.tag}" matches this workflow.`)
  }
  const branch = event.branch ?? 'main'
  if (!branchFilters && tagFilters) return no('This workflow filters tags only, so it does not run for branch pushes.')
  return checkRef(f, 'branch', branch) ?? checkPaths(f, event.files) ?? yes(`The push to branch "${branch}" matches this workflow.`)
}

function matchPullRequest(f: Filters, event: Extract<SimEvent, { type: 'pull_request' }>): MatchResult {
  const action = event.action ?? 'opened'
  const types = f.types ?? DEFAULT_PULL_REQUEST_TYPES
  if (!types.includes(action)) return no(`The pull request action "${action}" is not in types (${list(types)}).`)
  const base = event.base ?? 'main'
  return checkRef(f, 'branch', base) ?? checkPaths(f, event.files) ?? yes(`The pull request into "${base}" matches this workflow.`)
}

function matchTypes(f: Filters, value: string, label: string): MatchResult {
  if (f.types && !f.types.includes(value)) return no(`The ${label} "${value}" is not in types (${list(f.types)}).`)
  return yes(`The ${label} "${value}" matches this workflow.`)
}

export function matchEvent(events: EventsConfig, event: SimEvent): MatchResult {
  const config = events[event.type] as Filters | undefined
  if (!config) return no(`This workflow has no "${event.type}" trigger.`)
  switch (event.type) {
    case 'push':
      return matchPush(config, event)
    case 'pull_request':
      return matchPullRequest(config, event)
    case 'release':
      return matchTypes(config, event.action ?? 'published', 'release')
    case 'repository_dispatch':
      return matchTypes(config, event.eventType ?? 'run', 'event type')
    default:
      return yes(`This workflow has an "${event.type}" trigger.`)
  }
}
