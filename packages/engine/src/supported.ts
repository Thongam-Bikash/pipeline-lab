import { isMapping, isSequence, isString } from '@actions/workflow-parser'
import type { Diagnostic, TemplateToken } from './types'

// Keys the simulator models. `*` is one job id or list position; a trailing `.**` accepts everything below.
export const SUPPORTED = [
  'name',
  'run-name',
  'env.**',
  'defaults.**',
  'on',
  'on.push',
  'on.push.branches',
  'on.push.branches-ignore',
  'on.push.tags',
  'on.push.tags-ignore',
  'on.push.paths',
  'on.push.paths-ignore',
  'on.pull_request',
  'on.pull_request.types',
  'on.pull_request.branches',
  'on.pull_request.branches-ignore',
  'on.pull_request.paths',
  'on.pull_request.paths-ignore',
  'on.release.**',
  'on.repository_dispatch.**',
  'on.workflow_dispatch.**',
  'on.workflow_call',
  'on.workflow_call.inputs.**',
  'on.schedule.**',
  'jobs',
  'jobs.*',
  'jobs.*.name',
  'jobs.*.needs',
  'jobs.*.if',
  'jobs.*.runs-on',
  'jobs.*.timeout-minutes',
  'jobs.*.continue-on-error',
  'jobs.*.env.**',
  'jobs.*.defaults.**',
  'jobs.*.outputs.**',
  'jobs.*.strategy.**',
  'jobs.*.steps',
  'jobs.*.steps.*',
  'jobs.*.steps.*.id',
  'jobs.*.steps.*.name',
  'jobs.*.steps.*.if',
  'jobs.*.steps.*.uses',
  'jobs.*.steps.*.run',
  'jobs.*.steps.*.shell',
  'jobs.*.steps.*.working-directory',
  'jobs.*.steps.*.continue-on-error',
  'jobs.*.steps.*.timeout-minutes',
  'jobs.*.steps.*.with.**',
  'jobs.*.steps.*.env.**',
]

const PATTERNS = SUPPORTED.map((pattern) => {
  const subtree = pattern.endsWith('.**')
  const body = (subtree ? pattern.slice(0, -3) : pattern)
    .split('.')
    .map((part) => (part === '*' ? '[^.]+' : part))
    .join('\\.')
  return new RegExp(`^${body}${subtree ? '(\\..+)?' : ''}$`)
})

export function findUnsupported(root: TemplateToken): Diagnostic[] {
  const found: Diagnostic[] = []

  const check = (token: TemplateToken, path: string) => {
    if (PATTERNS.some((pattern) => pattern.test(path))) return true
    const { line, column } = token.range!.start
    const name = path.split('.').pop()!
    found.push({
      severity: 'not-simulated',
      line,
      column,
      key: path,
      message: `"${name}" isn't simulated yet, so this run ignores it. It still works on GitHub.`,
    })
    return false
  }

  const walk = (token: TemplateToken, path: string) => {
    if (isMapping(token)) {
      for (const { key, value } of token) {
        const child = path ? `${path}.${key.toString()}` : key.toString()
        if (check(key, child)) walk(value, child)
      }
    } else if (isSequence(token)) {
      for (const item of token) {
        // `on: [push, schedule]` names events as plain strings.
        if (path === 'on' && isString(item)) check(item, `on.${item.value}`)
        else walk(item, `${path}.*`)
      }
    } else if (path === 'on' && isString(token)) {
      check(token, `on.${token.value}`)
    }
  }

  walk(root, '')
  return found
}
