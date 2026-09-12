import { describe, expect, it } from 'vitest'
import { evaluate, evaluateIf, interpolate, isTruthy } from './expressions'

const contexts = {
  github: { ref: 'refs/heads/main', event_name: 'push', actor: 'octocat' },
  env: { STAGE: 'prod' },
  needs: { build: { outputs: { version: '1.2.3' } } },
  matrix: { node: 24 },
  vars: { ENABLED: true, PORTS: [80, 443], UNSET: null },
}

describe('evaluate', () => {
  it.each([
    ['1 == 1', true],
    ["'a' != 'b'", true],
    ['!false', true],
    ['1 < 2 && 3 >= 3', true],
    ['false || 2 > 3', false],
    ['null', null],
    ['42', 42],
  ])('evaluates %s', (expression, expected) => {
    expect(evaluate(expression)).toEqual(expected)
  })

  it('reads contexts, including nested values', () => {
    expect(evaluate('github.ref', contexts)).toBe('refs/heads/main')
    expect(evaluate('needs.build.outputs.version', contexts)).toBe('1.2.3')
    expect(evaluate('matrix.node', contexts)).toBe(24)
    expect(evaluate("env.STAGE == 'prod'", contexts)).toBe(true)
    expect(evaluate('vars.ENABLED', contexts)).toBe(true)
    expect(evaluate('vars.PORTS[1]', contexts)).toBe(443)
    expect(evaluate('vars.UNSET', contexts)).toBe(null)
  })

  it('returns a whole context as a plain object', () => {
    expect(evaluate('vars', contexts)).toEqual({ ENABLED: true, PORTS: [80, 443], UNSET: null })
  })

  it('supports the built-in functions', () => {
    expect(evaluate("contains('refs/heads/main', 'main')")).toBe(true)
    expect(evaluate("startsWith(github.ref, 'refs/heads/')", contexts)).toBe(true)
    expect(evaluate("endsWith(github.ref, '/main')", contexts)).toBe(true)
    expect(evaluate("format('{0} on {1}', 'build', 'main')")).toBe('build on main')
    expect(evaluate("join(fromJSON('[\"a\",\"b\"]'), '-')")).toBe('a-b')
    expect(evaluate("fromJSON('[1,2]')")).toEqual([1, 2])
    expect(evaluate('toJSON(matrix)', contexts)).toContain('"node"')
  })

  it('resolves status functions from the run status', () => {
    const failed = { failed: true, cancelled: false }
    const cancelled = { failed: false, cancelled: true }
    expect(evaluate('success()')).toBe(true)
    expect(evaluate('success()', {}, failed)).toBe(false)
    expect(evaluate('failure()', {}, failed)).toBe(true)
    expect(evaluate('failure()', {}, cancelled)).toBe(false)
    expect(evaluate('cancelled()', {}, cancelled)).toBe(true)
    expect(evaluate('always()', {}, cancelled)).toBe(true)
  })

  it('returns a stable stand-in hash for hashFiles', () => {
    const hash = evaluate("hashFiles('**/package-lock.json')")
    expect(hash).toMatch(/^[0-9a-f]{64}$/)
    expect(evaluate("hashFiles('**/package-lock.json')")).toBe(hash)
    expect(evaluate("hashFiles('**/other.lock')")).not.toBe(hash)
  })

  it('rejects unknown functions and contexts', () => {
    expect(() => evaluate('nope()')).toThrow()
    expect(() => evaluate('unknown.value')).toThrow()
  })
})

describe('interpolate', () => {
  it('replaces every expression in the text', () => {
    expect(interpolate('Deploy ${{ needs.build.outputs.version }} to ${{ env.STAGE }}', contexts)).toBe('Deploy 1.2.3 to prod')
  })

  it('leaves text without expressions alone', () => {
    expect(interpolate('npm test')).toBe('npm test')
  })
})

describe('isTruthy', () => {
  it.each([
    [null, false],
    [false, false],
    ['', false],
    [0, false],
    ['false', true],
    ['0', true],
    [1, true],
    [[], true],
  ])('%s -> %s', (value, expected) => {
    expect(isTruthy(value)).toBe(expected)
  })
})

describe('evaluateIf', () => {
  it('accepts bare and wrapped conditions', () => {
    expect(evaluateIf("github.ref == 'refs/heads/main'", contexts)).toBe(true)
    expect(evaluateIf("${{ github.ref == 'refs/heads/dev' }}", contexts)).toBe(false)
  })

  it('combines status functions with other checks', () => {
    expect(evaluateIf("success() && env.STAGE == 'prod'", contexts)).toBe(true)
    expect(evaluateIf("success() && env.STAGE == 'prod'", contexts, { failed: true, cancelled: false })).toBe(false)
    expect(evaluateIf('always()', contexts, { failed: true, cancelled: false })).toBe(true)
  })
})
