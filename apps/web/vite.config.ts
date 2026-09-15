/// <reference types="vitest/config" />
import mdx from '@mdx-js/rollup'
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig({
  // MDX has to compile lessons to JSX before the React plugin sees them.
  plugins: [{ enforce: 'pre', ...mdx() }, react(), tailwindcss()],
  resolve: {
    alias: {
      '@': new URL('./src', import.meta.url).pathname,
      // monaco-worker-manager, pulled in by monaco-yaml, imports this old deep path, which
      // monaco 0.56's exports map turns into esm/vs/esm/vs/... Point it at the real file.
      'monaco-editor/esm/vs/editor/editor.worker.js': new URL('../../node_modules/monaco-editor/esm/vs/editor/editor.worker.js', import.meta.url).pathname,
    },
  },
  // Same origin in development as in the container, so cookies and paths behave identically.
  // Playwright runs `vite preview`, so both servers need the rule.
  server: { proxy: { '/api': 'http://localhost:8082' } },
  preview: { proxy: { '/api': 'http://localhost:8082' } },
  test: {
    include: ['src/**/*.test.{ts,tsx}'],
    // The workflow parser imports its JSON schema without an import attribute, which plain Node rejects.
    server: { deps: { inline: ['@actions/workflow-parser', '@actions/expressions'] } },
  },
})
