import { defineConfig, globalIgnores } from 'eslint/config'
import tseslint from 'typescript-eslint'
import reactHooks from 'eslint-plugin-react-hooks'

export default defineConfig(
  globalIgnores(['**/dist', '**/coverage', '**/playwright-report', '**/test-results']),
  tseslint.configs.recommended,
  {
    files: ['apps/web/**/*.{ts,tsx}'],
    extends: [reactHooks.configs.flat.recommended],
  },
  {
    // The engine must stay framework-free so it can be tested and reused anywhere.
    files: ['packages/engine/**/*.ts'],
    rules: {
      'no-restricted-imports': ['error', { patterns: ['react', 'react-*', 'react/*'] }],
    },
  },
)
