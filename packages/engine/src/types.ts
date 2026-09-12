import type { isMapping, WorkflowTemplate } from '@actions/workflow-parser'

// The parser's entry point doesn't export its token class, but its type guards accept one.
export type TemplateToken = Parameters<typeof isMapping>[0]

export type EventsConfig = WorkflowTemplate['events']

export type Json = string | number | boolean | null | Json[] | { [key: string]: Json }

export type Contexts = Record<string, Json>

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
  // The raw tree, because the converted model drops `with` and `timeout-minutes`.
  source?: TemplateToken
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

export type Conclusion = 'success' | 'failure' | 'cancelled' | 'skipped'
export type Phase = 'queued' | 'running' | 'completed'

export type Annotation = { level: 'error' | 'warning' | 'notice'; message: string; file?: string; line?: number; title?: string }

export type LogLine = { at: number; text: string }

export type StepRun = {
  id: string
  name: string
  line: number
  status: Phase
  outcome?: Conclusion
  conclusion?: Conclusion
  startedAt?: number
  finishedAt?: number
  logs: LogLine[]
  outputs: Record<string, string>
  annotations: Annotation[]
}

export type StepPlan = {
  id: string
  name: string
  line: number
  if: string
  run?: string
  uses?: string
  with: Record<string, Json>
  env: Record<string, string>
  continueOnError: boolean
  timeoutMinutes?: number
}

export type PendingStep = {
  outcome: Conclusion
  outputs: Record<string, string>
  summary: string[]
  annotations: Annotation[]
}

export type JobRun = {
  // The job id from the workflow; matrix jobs share it, and `needs` waits for all of them.
  id: string
  key: string
  name: string
  line: number
  matrix: Record<string, Json>
  needs: string[]
  runsOn: string
  ifCondition: string
  env: Record<string, string>
  outputDefinitions: Record<string, string>
  status: Phase
  conclusion?: Conclusion
  startedAt?: number
  finishedAt?: number
  nextAt?: number
  stepIndex: number
  plan: StepPlan[]
  steps: StepRun[]
  pending?: PendingStep
  outputs: Record<string, string>
  summary: string[]
  jobIndex: number
  jobTotal: number
  failFast: boolean
  maxParallel?: number
  continueOnError: boolean
  timeoutMinutes: number
}

export type RunState = {
  clock: number
  event: SimEvent
  workflowName: string
  env: Record<string, string>
  status: Phase
  conclusion?: Conclusion
  jobs: JobRun[]
  // Set when the workflow cannot be turned into a run at all, such as an unsupported matrix.
  error?: string
}

export type StepMatch = {
  jobId: string
  stepId: string
  name: string
  run?: string
  uses?: string
  with: Record<string, Json>
  matrix: Record<string, Json>
}

export type StepRule = {
  match: (step: StepMatch) => boolean
  outcome?: 'success' | 'failure'
  seconds?: number
  logs?: string[]
}

export type RunOptions = {
  rules?: StepRule[]
  vars?: Record<string, Json>
  secrets?: Record<string, Json>
  seed?: number
  repository?: string
  actor?: string
}
