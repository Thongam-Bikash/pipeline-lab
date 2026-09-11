import { defineProject } from 'vitest/config'

export default defineProject({
  // Hides "missing sourcemap" warnings from the inlined parser packages.
  logLevel: 'error',
  test: {
    // The parser imports its JSON schema without an import attribute, which plain Node rejects.
    server: { deps: { inline: ['@actions/workflow-parser', '@actions/expressions'] } },
  },
})
