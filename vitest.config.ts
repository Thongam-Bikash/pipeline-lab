import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    projects: ['packages/*', 'apps/*'],
    coverage: {
      provider: 'v8',
      // The merge is the one API file that can silently lose a learner's progress.
      include: ['packages/engine/src/**/*.ts', 'apps/api/src/merge.ts'],
      exclude: ['**/*.test.ts', '**/index.ts'],
      thresholds: { lines: 100, branches: 100, functions: 100, statements: 100 },
    },
  },
})
