import type { isMapping, WorkflowTemplate } from '@actions/workflow-parser'

// The parser's entry point doesn't export its token class, but its type guards accept one.
export type TemplateToken = Parameters<typeof isMapping>[0]

export type Severity = 'error' | 'warning' | 'not-simulated'

export type Diagnostic = {
  severity: Severity
  line: number
  column: number
  message: string
  key?: string
  fix?: string
}

export type ParseResult = {
  workflow?: WorkflowTemplate
  diagnostics: Diagnostic[]
}
