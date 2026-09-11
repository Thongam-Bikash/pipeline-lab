import { isScalar, LineCounter, parseDocument, visit } from 'yaml'
import type { Diagnostic } from './types'

const describe = (value: unknown) => (value === null ? 'an empty value' : `a ${typeof value}`)

// YAML mistakes that GitHub's parser either crashes on or accepts silently.
export function findTraps(source: string): Diagnostic[] {
  const lineCounter = new LineCounter()
  const doc = parseDocument(source, { lineCounter })
  // Syntax errors are reported by the workflow parser with better context.
  if (doc.errors.length) return []

  const found: Diagnostic[] = []
  const at = (offset: number) => {
    const { line, col } = lineCounter.linePos(offset)
    return { line, column: col }
  }
  visit(doc, {
    Pair(_, pair) {
      if (isScalar(pair.key) && typeof pair.key.value !== 'string') {
        const [start, end] = pair.key.range!
        const text = source.slice(start, end)
        found.push({
          severity: 'error',
          ...at(start),
          key: text,
          message: `The key "${text}" is read as ${describe(pair.key.value)}, not as text.`,
          fix: `Put quotes around it: '${text}':`,
        })
      }
    },
    Scalar(key, node) {
      if (key === 'key' || typeof node.value !== 'number') return
      const [start, end] = node.range!
      const text = source.slice(start, end)
      if (/^\d+\.\d*0$/.test(text)) {
        found.push({
          severity: 'warning',
          ...at(start),
          message: `${text} is read as the number ${node.value}, so the trailing zero is lost.`,
          fix: `Quote it to keep it as text: '${text}'`,
        })
      }
    },
  })
  return found
}
