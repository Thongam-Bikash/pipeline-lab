import { describe, expect, it } from 'vitest'
import { findTraps } from './traps'

describe('findTraps', () => {
  it('leaves syntax errors and clean files alone', () => {
    expect(findTraps('a: "unclosed\n')).toEqual([])
    expect(findTraps('on: push\nname: CI\n')).toEqual([])
  })

  it('flags keys that YAML reads as something other than text', () => {
    const found = findTraps('true:\n  x: 1\n123: y\nnull: z\n')
    expect(found).toEqual([
      { severity: 'error', line: 1, column: 1, key: 'true', message: 'The key "true" is read as a boolean, not as text.', fix: "Put quotes around it: 'true':" },
      { severity: 'error', line: 3, column: 1, key: '123', message: 'The key "123" is read as a number, not as text.', fix: "Put quotes around it: '123':" },
      { severity: 'error', line: 4, column: 1, key: 'null', message: 'The key "null" is read as an empty value, not as text.', fix: "Put quotes around it: 'null':" },
    ])
  })

  it('warns when a version number loses its trailing zero', () => {
    const found = findTraps("with:\n  python-version: 3.10\n  node: [3.10, 22, 1.5]\n  label: '3.10'\n")
    expect(found).toEqual([
      { severity: 'warning', line: 2, column: 19, message: '3.10 is read as the number 3.1, so the trailing zero is lost.', fix: "Quote it to keep it as text: '3.10'" },
      { severity: 'warning', line: 3, column: 10, message: '3.10 is read as the number 3.1, so the trailing zero is lost.', fix: "Quote it to keep it as text: '3.10'" },
    ])
  })
})
