import { isBasicExpression, isBoolean, isMapping, isNumber, isSequence, isString } from '@actions/workflow-parser'
import type { Json, TemplateToken } from './types'

// Expressions keep their source text; the scheduler resolves them once it has contexts.
export function toValue(token: TemplateToken): Json {
  if (isMapping(token)) return Object.fromEntries([...token].map(({ key, value }) => [key.toString(), toValue(value)]))
  if (isSequence(token)) return [...token].map(toValue)
  if (isString(token) || isNumber(token) || isBoolean(token)) return token.value
  if (isBasicExpression(token)) return `\${{ ${token.expression} }}`
  return null
}
