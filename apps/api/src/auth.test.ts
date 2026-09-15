import { expect, it } from 'vitest'
import { auth } from './auth.js'

// A rule keyed on a path that no longer exists limits nothing, and nothing warns about it.
it('rate-limits only paths that are real endpoints', () => {
  const paths = Object.values(auth.api).map((endpoint) => endpoint.path)
  const rules = Object.keys(auth.options.rateLimit?.customRules ?? {})

  expect(rules.length).toBeGreaterThan(0)
  for (const rule of rules) expect(paths, `${rule} is not an auth endpoint`).toContain(rule)
})
