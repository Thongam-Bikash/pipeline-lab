import { data, Evaluator, Lexer, Parser, wellKnownFunctions } from '@actions/expressions'
import type { Contexts, Json } from './types'

type FunctionDefinition = (typeof wellKnownFunctions)[string]

// success() is not simply "not failed": a job whose dependency was skipped is not a success either.
export type RunStatus = { success: boolean; failed: boolean; cancelled: boolean }

// Every context a workflow may name, so an expression referring to an unused one still evaluates.
const CONTEXT_NAMES = ['github', 'env', 'vars', 'secrets', 'inputs', 'needs', 'matrix', 'steps', 'job', 'runner', 'strategy']

const OK: RunStatus = { success: true, failed: false, cancelled: false }

// ponytail: stands in for a real file hash, stable per pattern so cache keys behave
function fakeHash(input: string): string {
  let hash = 0x811c9dc5
  for (const char of input) hash = Math.imul(hash ^ char.charCodeAt(0), 0x01000193) >>> 0
  return hash.toString(16).padStart(8, '0').repeat(8)
}

function toData(value: Json): data.ExpressionData {
  if (value === null) return new data.Null()
  if (typeof value === 'string') return new data.StringData(value)
  if (typeof value === 'number') return new data.NumberData(value)
  if (typeof value === 'boolean') return new data.BooleanData(value)
  if (Array.isArray(value)) return new data.Array(...value.map(toData))
  const dictionary = new data.Dictionary()
  for (const [key, item] of Object.entries(value)) dictionary.add(key, toData(item))
  return dictionary
}

function fromData(value: data.ExpressionData): Json {
  switch (value.kind) {
    case data.Kind.Null:
      return null
    case data.Kind.String:
    case data.Kind.Number:
    case data.Kind.Boolean:
      return (value as data.StringData | data.NumberData | data.BooleanData).value
    case data.Kind.Array:
      return (value as data.Array).values().map(fromData)
    default:
      return Object.fromEntries((value as data.Dictionary).pairs().map((pair) => [pair.key, fromData(pair.value)]))
  }
}

function functionsFor(status: RunStatus): Map<string, FunctionDefinition> {
  const check = (name: string, result: () => boolean): [string, FunctionDefinition] => [
    name,
    { name, minArgs: 0, maxArgs: 0, call: () => new data.BooleanData(result()) },
  ]
  const hashFiles: FunctionDefinition = {
    name: 'hashFiles',
    minArgs: 1,
    maxArgs: 255,
    call: (...args) => new data.StringData(fakeHash(args.map((arg) => arg.coerceString()).join('|'))),
  }
  const functions = new Map<string, FunctionDefinition>([
    check('success', () => status.success),
    check('failure', () => status.failed),
    check('always', () => true),
    check('cancelled', () => status.cancelled),
    ['hashfiles', hashFiles],
  ])
  // Registered under both spellings because lookups are not always lowercased.
  functions.set('hashFiles', hashFiles)
  return functions
}

function evaluateData(expression: string, contexts: Contexts, status: RunStatus): data.ExpressionData {
  const values: Contexts = { ...Object.fromEntries(CONTEXT_NAMES.map((name) => [name, {}])), ...contexts }
  const functions = functionsFor(status)
  const { tokens } = new Lexer(expression).lex()
  const expr = new Parser(tokens, Object.keys(values), [...functions.values()]).parse()
  const dictionary = new data.Dictionary()
  for (const [name, value] of Object.entries(values)) dictionary.add(name, toData(value))
  return new Evaluator(expr, dictionary, functions).evaluate()
}

export function evaluate(expression: string, contexts: Contexts = {}, status: RunStatus = OK): Json {
  return fromData(evaluateData(expression, contexts, status))
}

// Replaces every ${{ }} in a string, using GitHub's own coercion for the result.
export function interpolate(text: string, contexts: Contexts = {}, status: RunStatus = OK): string {
  return text.replace(/\$\{\{(.*?)\}\}/gs, (_, expression: string) => evaluateData(expression, contexts, status).coerceString())
}

export function isTruthy(value: Json): boolean {
  if (value === null || value === false) return false
  if (typeof value === 'number') return value !== 0
  if (typeof value === 'string') return value !== ''
  return true
}

// A job or step `if` may be written bare or wrapped in ${{ }}.
export function evaluateIf(expression: string, contexts: Contexts = {}, status: RunStatus = OK): boolean {
  const inner = expression.trim().replace(/^\$\{\{(.*)\}\}$/s, '$1')
  return isTruthy(evaluate(inner, contexts, status))
}
