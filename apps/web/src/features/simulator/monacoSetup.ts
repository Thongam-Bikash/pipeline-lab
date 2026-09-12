import loader from '@monaco-editor/loader'
// The core editor only. Importing "monaco-editor" would pull in every language it ships,
// which costs megabytes of TypeScript, CSS, HTML, and JSON workers this app never uses.
import * as monaco from 'monaco-editor/editor/editor.api.js'
// YAML highlighting, the one language we do need. This registers it with a lazy loader,
// so only YAML's tokenizer is fetched, not the other eighty languages Monaco ships.
import 'monaco-editor/languages/definitions/yaml/register.js'
import editorWorker from 'monaco-editor/editor/editor.worker.js?worker'
import { configureMonacoYaml, type JSONSchema } from 'monaco-yaml'
import schema from './github-workflow.schema.json'
import yamlWorker from './yaml.worker.js?worker'

let ready = false

export function setupMonaco(): void {
  if (ready) return
  ready = true

  const environment = { getWorker: (_id: string, label: string) => (label === 'yaml' ? new yamlWorker() : new editorWorker()) }
  ;(globalThis as unknown as { MonacoEnvironment: unknown }).MonacoEnvironment = environment

  // Bundle Monaco with the app rather than loading it from a CDN.
  loader.config({ monaco })

  configureMonacoYaml(monaco, {
    // The schema gives completions and hover text. Errors stay the engine's job, so the
    // editor never shows a second opinion that contradicts the run.
    validate: false,
    completion: true,
    enableSchemaRequest: false,
    // The vendored file is a draft-07 schema; TypeScript cannot check a literal this large.
    schemas: [{ uri: 'https://json.schemastore.org/github-workflow.json', fileMatch: ['**/*.yml'], schema: schema as unknown as JSONSchema }],
  })
}
