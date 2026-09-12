/// <reference types="vitest/config" />
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig({
  plugins: [react(), tailwindcss()],
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
