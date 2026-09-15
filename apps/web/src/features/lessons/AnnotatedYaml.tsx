import { useState } from 'react'
import { Button } from '@/components/ui/Button/Button'

type Note = { line: number; text: string }
type Props = { yaml: string; file?: string; notes?: Note[] }

export function AnnotatedYaml({ yaml, file = 'ci.yml', notes = [] }: Props) {
  const [copied, setCopied] = useState(false)
  const lines = yaml.replace(/\n$/, '').split('\n')
  const marked = new Map(notes.map((note, index) => [note.line, index + 1]))

  const copy = async () => {
    await navigator.clipboard.writeText(yaml)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <figure className="my-6">
      <figcaption className="flex items-center justify-between gap-3 rounded-t-base border border-rule bg-surface px-3 py-1.5">
        <span className="font-mono text-xs">{file}</span>
        <Button onClick={copy}>{copied ? 'Copied' : 'Copy'}</Button>
      </figcaption>

      <pre className="overflow-x-auto rounded-b-base border border-t-0 border-rule p-3 font-mono text-xs">
        <code>
          {lines.map((line, index) => {
            const number = index + 1
            const note = marked.get(number)
            return (
              <span key={number} className={`grid grid-cols-[2.5rem_1.5rem_1fr] ${note ? 'bg-signal/10' : ''}`}>
                <span className="select-none text-muted">{number}</span>
                <span className="select-none text-signal">{note ? `${note}.` : ''}</span>
                <span>{line || ' '}</span>
              </span>
            )
          })}
        </code>
      </pre>

      {notes.length === 0 ? null : (
        <ol className="mt-3 space-y-1 text-sm">
          {notes.map((note, index) => (
            <li key={note.line} className="flex gap-2">
              <span className="text-signal">{index + 1}.</span>
              <span>{note.text}</span>
            </li>
          ))}
        </ol>
      )}
    </figure>
  )
}
