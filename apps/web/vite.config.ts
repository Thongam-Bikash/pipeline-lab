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
  test: { include: ['src/**/*.test.{ts,tsx}'] },
})
