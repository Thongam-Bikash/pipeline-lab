import type { isMapping, WorkflowTemplate } from '@actions/workflow-parser'

// The parser's entry point doesn't export its token class, but its type guards accept one.
export type TemplateToken = Parameters<typeof isMapping>[0]

export type EventsConfig = WorkflowTemplate['events']

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

export type SimEvent =
  | { type: 'push'; branch?: string; tag?: string; files?: string[] }
  | { type: 'pull_request'; base?: string; action?: string; files?: string[]; fromFork?: boolean }
  | { type: 'workflow_dispatch'; ref?: string; inputs?: Record<string, string | number | boolean> }
  | { type: 'schedule'; cron?: string }
  | { type: 'release'; action?: string }
  | { type: 'repository_dispatch'; eventType?: string }
  | { type: 'workflow_call' }

export type MatchResult = { runs: boolean; reason: string }
