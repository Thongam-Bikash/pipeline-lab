import { convertWorkflowTemplate, isMapping, NoOperationTraceWriter, parseWorkflow } from '@actions/workflow-parser'
import { isTooFrequent, parseCron, zonedFormatter } from './cron'
import { findUnsupported } from './supported'
import { findTraps } from './traps'
import type { Diagnostic, ParseResult, TemplateToken } from './types'

type ParserError = { rawMessage: string; range?: { start: { line: number; column: number } } }
type Explanation = Pick<Diagnostic, 'message' | 'fix' | 'key'>

const REQUIRED_FIXES: Record<string, string> = {
  on: 'Add "on:" with the events that start the workflow, for example "on: push".',
  jobs: 'Add a "jobs:" section with at least one job.',
  'runs-on': 'Add "runs-on" with a runner label, for example "runs-on: ubuntu-24.04".',
  steps: 'Add a "steps:" list with at least one step.',
}

const DASHED_KEYS = new Set([
  'run-name',
  'runs-on',
  'timeout-minutes',
  'continue-on-error',
  'working-directory',
  'cancel-in-progress',
  'fail-fast',
  'max-parallel',
  'branches-ignore',
  'tags-ignore',
  'paths-ignore',
])

const RULES: [RegExp, (match: RegExpMatchArray) => Explanation][] = [
  [
    /^Required property is missing: (.+)$/,
    (m) => ({ key: m[1]!, message: `Missing required key "${m[1]}".`, fix: REQUIRED_FIXES[m[1]!] ?? `Add "${m[1]}" here.` }),
  ],
  [
    /^Unexpected value '(.+)'$/,
    (m) => {
      const dashed = m[1]!.replaceAll('_', '-')
      const fix = DASHED_KEYS.has(dashed) ? `Did you mean "${dashed}"?` : 'Check the spelling and indentation. Keys are case-sensitive.'
      return { key: m[1]!, message: `"${m[1]}" isn't a valid key here.`, fix }
    },
  ],
  [
    /^An? (\w+) was not expected$/,
    (m) => ({ message: `A ${m[1]} isn't allowed here.`, fix: 'Check the indentation. Lists such as "steps" need "- " before each item.' }),
  ],
  [/^Tabs are not allowed as indentation/, () => ({ message: 'Tabs are used for indentation.', fix: 'YAML only allows spaces. Replace each tab with two spaces.' })],
  [
    /^A block sequence may not be used as an implicit map key/,
    () => ({ message: 'A list item is indented differently from the items above it.', fix: 'Line up every "- " in the list at the same indentation.' }),
  ],
  [/^Missing closing "?quote/, () => ({ message: 'A quoted value is never closed.', fix: 'Add the missing closing quote.' })],
  [
    /^The workflow must contain at least one job with no dependencies/,
    () => ({
      message: 'Every job waits on another job, so nothing can start.',
      fix: 'Give at least one job no "needs", and check that "needs" only names jobs that exist and don\'t form a loop.',
    }),
  ],
]

export function explain(error: ParserError): Diagnostic {
  const { line, column } = error.range?.start ?? { line: 1, column: 1 }
  for (const [pattern, describe] of RULES) {
    const match = error.rawMessage.match(pattern)
    if (match) return { severity: 'error', line, column, ...describe(match) }
  }
  // YAML syntax errors repeat the position and a source excerpt after the message.
  return { severity: 'error', line, column, message: error.rawMessage.split(' at line ')[0]! }
}

function checkSchedules(root: TemplateToken): Diagnostic[] {
  const on = root.assertMapping('workflow').find('on')
  const schedule = on && isMapping(on) ? on.find('schedule') : undefined
  if (!schedule) return []

  return [...schedule.assertSequence('schedule')].flatMap((item) => {
    const entry = item.assertMapping('schedule entry')
    const cron = entry.find('cron')!.assertString('cron')
    const timeZone = entry.find('timezone')?.assertString('timezone')
    const found: Diagnostic[] = []
    const cronAt = { line: cron.range!.start.line, column: cron.range!.start.column, key: 'cron' }
    try {
      if (isTooFrequent(parseCron(cron.value))) {
        found.push({
          severity: 'warning',
          ...cronAt,
          message: 'This schedule asks to run more often than every 5 minutes.',
          fix: 'GitHub runs scheduled workflows at most once every 5 minutes. Use */5 or a longer interval.',
        })
      }
    } catch (err) {
      found.push({ severity: 'error', ...cronAt, message: (err as Error).message })
    }
    if (timeZone) {
      try {
        zonedFormatter(timeZone.value)
      } catch (err) {
        found.push({ severity: 'error', line: timeZone.range!.start.line, column: timeZone.range!.start.column, key: 'timezone', message: (err as Error).message })
      }
    }
    return found
  })
}

export async function loadWorkflow(source: string): Promise<ParseResult> {
  const traps = findTraps(source)
  // Non-text keys crash the workflow parser, so stop at the trap that explains them.
  if (traps.some((d) => d.severity === 'error')) return { diagnostics: traps }

  const { context, value } = parseWorkflow({ name: 'workflow.yml', content: source }, new NoOperationTraceWriter())
  const template = value ? await convertWorkflowTemplate(context, value) : undefined
  // The generic cron error is replaced by the specific checks in checkSchedules.
  const explained = context.errors
    .getErrors()
    .filter((e) => !e.rawMessage.startsWith('Invalid cron expression'))
    .map(explain)
  // One mistake often produces several errors on the same line; the first is the clearest.
  const errors = explained.filter((d, i) => explained.findIndex((other) => other.line === d.line) === i)
  const checks = errors.length ? [] : [...checkSchedules(value!), ...findUnsupported(value!)]
  const diagnostics = [...traps, ...errors, ...checks]
  if (diagnostics.some((d) => d.severity === 'error')) return { diagnostics }
  return { workflow: template, source: value, diagnostics }
}
