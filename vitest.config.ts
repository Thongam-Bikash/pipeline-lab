import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    projects: ['packages/*', 'apps/*'],
    passWithNoTests: true,
    coverage: {
      provider: 'v8',
      include: ['packages/engine/src/**/*.ts'],
      exclude: ['**/*.test.ts'],
      thresholds: { lines: 100, branches: 100, functions: 100, statements: 100 },
    },
  },
})
