import MonacoEditor, { type OnMount } from '@monaco-editor/react'
import { useEffect, useRef, useState } from 'react'
import { useSettings } from '@/app/settings'
import { setupMonaco } from './monacoSetup'

export type EditorApi = { goToLine: (line: number) => void }

type Props = {
  value: string
  onChange: (value: string) => void
  onRun: () => void
  onReady?: (api: EditorApi) => void
}

setupMonaco()

// Monaco ships its own light and dark themes; follow whichever one the page is showing.
function useMonacoTheme(): 'vs' | 'vs-dark' {
  const theme = useSettings((state) => state.theme)
  const [systemDark, setSystemDark] = useState(() => window.matchMedia('(prefers-color-scheme: dark)').matches)

  useEffect(() => {
    const query = window.matchMedia('(prefers-color-scheme: dark)')
    const listen = (event: MediaQueryListEvent) => setSystemDark(event.matches)
    query.addEventListener('change', listen)
    return () => query.removeEventListener('change', listen)
  }, [])

  const dark = theme === 'dark' || (theme === 'auto' && systemDark)
  return dark ? 'vs-dark' : 'vs'
}

export function WorkflowEditor({ value, onChange, onRun, onReady }: Props) {
  const theme = useMonacoTheme()
  const run = useRef(onRun)

  // Updated in an effect, so the editor command always calls the latest handler.
  useEffect(() => {
    run.current = onRun
  }, [onRun])

  const mount: OnMount = (editor, instance) => {
    editor.addCommand(instance.KeyMod.CtrlCmd | instance.KeyCode.Enter, () => run.current())
    onReady?.({
      goToLine: (line) => {
        editor.revealLineInCenter(line)
        editor.setPosition({ lineNumber: line, column: 1 })
        editor.focus()
      },
    })
  }

  return (
    <div className="rounded-base border border-rule">
      <MonacoEditor
        height="26rem"
        language="yaml"
        theme={theme}
        value={value}
        onChange={(next) => onChange(next ?? '')}
        onMount={mount}
        options={{
          fontSize: 13,
          fontFamily: 'JetBrains Mono Variable, ui-monospace, monospace',
          minimap: { enabled: false },
          scrollBeyondLastLine: false,
          tabSize: 2,
          renderLineHighlight: 'line',
          padding: { top: 8, bottom: 8 },
          // In YAML the indentation is the meaning, and lessons expect you to paste whole
          // workflows in. Automatic indenting and closing quotes would corrupt what you paste.
          autoIndent: 'none',
          autoClosingQuotes: 'never',
          autoClosingBrackets: 'never',
          formatOnPaste: false,
        }}
      />
    </div>
  )
}
