import type { WorkflowTemplate } from '@actions/workflow-parser'
import { logsFor } from './actions'
import { evaluateIf, interpolate, type RunStatus } from './expressions'
import { expandMatrix } from './matrix'
import { toValue } from './tokens'
import type { Annotation, Conclusion, Contexts, Json, JobRun, PendingStep, RunOptions, RunState, SimEvent, StepPlan, TemplateToken } from './types'

// The parser's entry point doesn't export the job type, so take it from the template.
type Job = Extract<WorkflowTemplate['jobs'][number], { type: 'job' }>

const MINUTE = 60_000
// GitHub cancels a job after this many minutes unless the workflow says otherwise.
const DEFAULT_JOB_TIMEOUT = 360

const strings = (value: Json | undefined): Record<string, string> =>
  value && typeof value === 'object' && !Array.isArray(value) ? Object.fromEntries(Object.entries(value).map(([k, v]) => [k, String(v)])) : {}

// Small deterministic hash so a run replays identically.
function jitter(seed: number, key: string): number {
  let hash = seed >>> 0
  for (const char of key) hash = Math.imul(hash ^ char.charCodeAt(0), 0x01000193) >>> 0
  return (hash % 1000) / 1000
}

function planSteps(job: Job, rawSteps: Record<string, Json>[], matrix: Record<string, Json>): StepPlan[] {
  return job.steps.map((step, index) => {
    const raw = rawSteps[index]!
    const uses = 'uses' in step ? step.uses : undefined
    const run = 'run' in step ? step.run : undefined
    const script = run?.toString()
    return {
      id: step.id,
      name: step.name ? interpolate(step.name.toString(), { matrix }) : (uses?.value ?? script!.split('\n')[0]!),
      line: (uses ?? run!).range!.start.line,
      // Run and uses steps always carry an if; GitHub's other step kinds are internal.
      if: step.if!.expression,
      run: script,
      uses: uses?.value,
      with: (raw['with'] ?? {}) as Record<string, Json>,
      env: strings(raw['env']),
      continueOnError: raw['continue-on-error'] === true,
      timeoutMinutes: typeof raw['timeout-minutes'] === 'number' ? raw['timeout-minutes'] : undefined,
    }
  })
}

function planJob(job: Job, raw: Record<string, Json>, matrix: Record<string, Json>, jobIndex: number, jobTotal: number, failFast: boolean, maxParallel?: number): JobRun {
  const id = job.id.value
  const suffix = Object.values(matrix).length ? ` (${Object.values(matrix).map(String).join(', ')})` : ''
  const plan = planSteps(job, raw['steps'] as Record<string, Json>[], matrix)
  // The converter always supplies a name, falling back to the job id; matrix jobs then show their combination.
  const label = interpolate(job.name!.toString(), { matrix })
  return {
    id,
    key: `${id}${suffix}`,
    name: label === id ? `${id}${suffix}` : label,
    line: job.id.range!.start.line,
    matrix,
    needs: job.needs?.map((need) => need.value) ?? [],
    runsOn: interpolate(String(raw['runs-on']), { matrix }),
    ifCondition: job.if.expression,
    env: strings(raw['env']),
    outputDefinitions: strings(raw['outputs']),
    status: 'queued',
    stepIndex: 0,
    plan,
    steps: plan.map((step) => ({ id: step.id, name: step.name, line: step.line, status: 'queued', logs: [], outputs: {}, annotations: [] })),
    outputs: {},
    summary: [],
    jobIndex,
    jobTotal,
    failFast,
    maxParallel,
    continueOnError: raw['continue-on-error'] === true,
    timeoutMinutes: typeof raw['timeout-minutes'] === 'number' ? raw['timeout-minutes'] : DEFAULT_JOB_TIMEOUT,
  }
}

export function startRun(workflow: WorkflowTemplate, source: TemplateToken, event: SimEvent): RunState {
  const raw = toValue(source) as Record<string, Json>
  const rawJobs = raw['jobs'] as Record<string, Record<string, Json>>
  const state: RunState = {
    clock: 0,
    event,
    workflowName: String(raw['name'] ?? 'Workflow'),
    env: strings(raw['env']),
    status: 'queued',
    jobs: [],
  }
  const stop = (error: string): RunState => ({ ...state, jobs: [], status: 'completed', conclusion: 'failure', error })

  for (const job of workflow.jobs) {
    // Reusable workflow jobs are reported as not simulated when the workflow is parsed.
    if (job.type !== 'job') continue
    try {
      const { combinations, failFast, maxParallel } = expandMatrix(job.strategy)
      combinations.forEach((matrix, index) => state.jobs.push(planJob(job, rawJobs[job.id.value]!, matrix, index, combinations.length, failFast, maxParallel)))
    } catch (err) {
      return stop((err as Error).message)
    }
  }
  // A needs that names a missing job is reported by the parser, before a run is ever planned.
  return state
}

function needsResult(state: RunState, id: string): Conclusion {
  const siblings = state.jobs.filter((job) => job.id === id)
  const order: Conclusion[] = ['failure', 'cancelled', 'skipped', 'success']
  return order.find((result) => siblings.some((job) => job.conclusion === result))!
}

function contextsFor(state: RunState, job: JobRun, options: RunOptions, stepEnv: Record<string, string> = {}): Contexts {
  const event = state.event
  const ref = event.type === 'push' && event.tag ? `refs/tags/${event.tag}` : `refs/heads/${event.type === 'push' ? (event.branch ?? 'main') : 'main'}`
  const repository = options.repository ?? 'octo/pipeline-lab'
  const needs = Object.fromEntries(
    job.needs.map((id) => [
      id,
      {
        result: needsResult(state, id),
        outputs: Object.assign({}, ...state.jobs.filter((other) => other.id === id).map((other) => other.outputs)) as Json,
      },
    ]),
  )
  const failed = job.steps.some((step) => step.conclusion === 'failure')
  return {
    github: {
      event_name: event.type,
      ref,
      ref_name: ref.replace(/^refs\/(heads|tags)\//, ''),
      ref_type: event.type === 'push' && event.tag ? 'tag' : 'branch',
      sha: '3d3c42e5aac5ba805825da76410c181273ba90b1',
      actor: options.actor ?? 'octocat',
      repository,
      repository_owner: repository.split('/')[0]!,
      workflow: state.workflowName,
      job: job.id,
      run_id: '1',
      run_number: '1',
      run_attempt: '1',
      server_url: 'https://github.com',
      workspace: '/home/runner/work/pipeline-lab/pipeline-lab',
      base_ref: event.type === 'pull_request' ? (event.base ?? 'main') : '',
      event: {},
    },
    env: { ...state.env, ...job.env, ...stepEnv },
    vars: options.vars ?? {},
    secrets: options.secrets ?? {},
    inputs: event.type === 'workflow_dispatch' ? (event.inputs ?? {}) : {},
    needs,
    matrix: job.matrix,
    steps: Object.fromEntries(
      job.steps
        .filter((step) => !step.id.startsWith('__') && step.status === 'completed')
        .map((step) => [step.id, { outputs: step.outputs, outcome: step.outcome!, conclusion: step.conclusion! }]),
    ),
    job: { status: failed ? 'failure' : 'success' },
    runner: {
      os: job.runsOn.includes('windows') ? 'Windows' : job.runsOn.includes('macos') ? 'macOS' : 'Linux',
      arch: 'X64',
      name: 'GitHub Actions 2',
      temp: '/home/runner/work/_temp',
      tool_cache: '/opt/hostedtoolcache',
      debug: '0',
      environment: 'github-hosted',
    },
    strategy: { 'fail-fast': job.failFast, 'job-index': job.jobIndex, 'job-total': job.jobTotal, 'max-parallel': job.maxParallel ?? job.jobTotal },
  }
}

function readScript(script: string): Pick<PendingStep, 'outputs' | 'summary' | 'annotations'> {
  const outputs: Record<string, string> = {}
  const summary: string[] = []
  const annotations: Annotation[] = []
  let delimiter: { name: string; token: string; value: string[] } | undefined

  for (const raw of script.split('\n')) {
    const line = raw.trim()
    if (delimiter) {
      const text = line.replace(/^echo\s+"?(.*?)"?\s*(>>\s*"?\$GITHUB_OUTPUT"?)?$/, '$1')
      if (text === delimiter.token) {
        outputs[delimiter.name] = delimiter.value.join('\n')
        delimiter = undefined
      } else {
        delimiter.value.push(text)
      }
      continue
    }
    const multiline = line.match(/^echo\s+"?([^"<]+)<<(\S+?)"?\s*>>\s*"?\$GITHUB_OUTPUT"?$/)
    if (multiline) {
      delimiter = { name: multiline[1]!.trim(), token: multiline[2]!, value: [] }
      continue
    }
    const output = line.match(/^echo\s+"?([^"=]+)=([^"]*)"?\s*>>\s*"?\$GITHUB_OUTPUT"?$/)
    if (output) {
      outputs[output[1]!.trim()] = output[2]!.trim()
      continue
    }
    const note = line.match(/^echo\s+"?(.*?)"?\s*>>\s*"?\$GITHUB_STEP_SUMMARY"?$/)
    if (note) {
      summary.push(note[1]!)
      continue
    }
    const annotation = line.match(/^echo\s+"?::(error|warning|notice)\s*([^:]*)::(.*?)"?$/)
    if (annotation) {
      const params = Object.fromEntries(
        annotation[2]!
          .split(',')
          .filter(Boolean)
          .map((pair) => pair.split('=').map((part) => part.trim())),
      )
      annotations.push({
        level: annotation[1] as Annotation['level'],
        message: annotation[3]!,
        ...(params['file'] ? { file: params['file'] } : {}),
        ...(params['line'] ? { line: Number(params['line']) } : {}),
        ...(params['title'] ? { title: params['title'] } : {}),
      })
    }
  }
  return { outputs, summary, annotations }
}

function resolveStep(state: RunState, job: JobRun, plan: StepPlan, options: RunOptions): { pending: PendingStep; seconds: number; logs: string[] } {
  const contexts = contextsFor(state, job, options, plan.env)
  // The schema types `with` values as strings, like env.
  const values = Object.fromEntries(Object.entries(plan.with).map(([key, value]) => [key, interpolate(String(value), contexts)]))
  const uses = plan.uses === undefined ? undefined : interpolate(plan.uses, contexts)
  const script = plan.run === undefined ? undefined : interpolate(plan.run, contexts)
  const base = uses === undefined ? { seconds: 2, logs: script!.split('\n').filter(Boolean) } : logsFor(uses, values)
  const rule = options.rules?.find((candidate) =>
    candidate.match({ jobId: job.id, stepId: plan.id, name: plan.name, run: script, uses, with: values, matrix: job.matrix }),
  )
  const seconds = rule?.seconds ?? Math.round((base.seconds + jitter(options.seed ?? 1, job.key + plan.id) * 2) * 10) / 10
  return {
    pending: { outcome: rule?.outcome === 'failure' ? 'failure' : 'success', ...readScript(script ?? '') },
    seconds,
    logs: [...base.logs, ...(rule?.logs ?? [])],
  }
}

function beginStep(state: RunState, job: JobRun, options: RunOptions): void {
  while (job.stepIndex < job.plan.length) {
    const plan = job.plan[job.stepIndex]!
    const step = job.steps[job.stepIndex]!
    const failed = job.steps.some((other) => other.conclusion === 'failure')
    const status: RunStatus = { success: !failed, failed, cancelled: false }
    if (!evaluateIf(plan.if, contextsFor(state, job, options, plan.env), status)) {
      step.status = 'completed'
      step.outcome = 'skipped'
      step.conclusion = 'skipped'
      job.stepIndex++
      continue
    }
    const { pending, seconds, logs } = resolveStep(state, job, plan, options)
    step.status = 'running'
    step.startedAt = state.clock
    step.logs = logs.map((text, index) => ({ at: state.clock + Math.round(((index + 1) / (logs.length + 1)) * seconds * 1000), text }))
    job.pending = pending
    job.nextAt = state.clock + Math.round(seconds * 1000)
    return
  }
  completeJob(state, job, options)
}

function finishStep(state: RunState, job: JobRun, options: RunOptions): void {
  const plan = job.plan[job.stepIndex]!
  const step = job.steps[job.stepIndex]!
  const pending = job.pending!
  const timedOut = plan.timeoutMinutes !== undefined && state.clock - step.startedAt! > plan.timeoutMinutes * MINUTE
  if (timedOut) step.logs.push({ at: state.clock, text: `Error: The step ran longer than its timeout of ${plan.timeoutMinutes} minutes.` })
  step.status = 'completed'
  step.finishedAt = state.clock
  step.outcome = timedOut ? 'failure' : pending.outcome
  // continue-on-error keeps the outcome but reports success as the conclusion.
  step.conclusion = step.outcome === 'failure' && plan.continueOnError ? 'success' : step.outcome
  step.outputs = pending.outputs
  step.annotations = pending.annotations
  job.summary.push(...pending.summary)
  job.pending = undefined
  job.nextAt = undefined
  job.stepIndex++
  beginStep(state, job, options)
}

function cancel(job: JobRun, at: number): void {
  job.status = 'completed'
  job.conclusion = 'cancelled'
  job.finishedAt = at
  job.nextAt = undefined
  job.pending = undefined
  for (const step of job.steps) {
    if (step.status === 'completed') continue
    step.status = 'completed'
    step.outcome = 'cancelled'
    step.conclusion = 'cancelled'
  }
}

function completeJob(state: RunState, job: JobRun, options: RunOptions, forced?: Conclusion): void {
  job.status = 'completed'
  job.finishedAt = state.clock
  job.nextAt = undefined
  if (forced) {
    job.conclusion = forced
    return
  }
  const failed = job.steps.some((step) => step.conclusion === 'failure')
  const timedOut = state.clock - job.startedAt! > job.timeoutMinutes * MINUTE
  job.conclusion = timedOut ? 'cancelled' : failed ? 'failure' : 'success'
  const contexts = contextsFor(state, job, options)
  job.outputs = Object.fromEntries(Object.entries(job.outputDefinitions).map(([name, value]) => [name, interpolate(value, contexts)]))
  if (job.conclusion === 'failure' && job.failFast) {
    for (const sibling of state.jobs) {
      if (sibling.id === job.id && sibling.key !== job.key && sibling.status !== 'completed') cancel(sibling, state.clock)
    }
  }
}

function startReadyJobs(state: RunState, options: RunOptions): boolean {
  let changed = false
  for (const job of state.jobs) {
    if (job.status !== 'queued') continue
    const needed = state.jobs.filter((other) => job.needs.includes(other.id))
    if (needed.some((other) => other.status !== 'completed')) continue
    const running = state.jobs.filter((other) => other.id === job.id && other.status === 'running').length
    if (job.maxParallel !== undefined && running >= job.maxParallel) continue
    const results = job.needs.map((id) => needsResult(state, id))
    const status: RunStatus = {
      success: results.every((result) => result === 'success'),
      failed: results.some((result) => result === 'failure'),
      cancelled: results.some((result) => result === 'cancelled'),
    }
    if (evaluateIf(job.ifCondition, contextsFor(state, job, options), status)) {
      job.status = 'running'
      job.startedAt = state.clock
      beginStep(state, job, options)
    } else {
      completeJob(state, job, options, 'skipped')
    }
    changed = true
  }
  return changed
}

function completeRun(state: RunState): void {
  state.status = 'completed'
  const failed = state.jobs.some((job) => job.conclusion === 'failure' && !job.continueOnError)
  const cancelled = state.jobs.some((job) => job.conclusion === 'cancelled')
  state.conclusion = failed ? 'failure' : cancelled ? 'cancelled' : 'success'
}

export function advance(state: RunState, options: RunOptions = {}): RunState {
  if (state.status === 'completed') return state
  // The run state is plain data, so a JSON round trip is a safe clone.
  const next = JSON.parse(JSON.stringify(state)) as RunState
  next.status = 'running'
  if (startReadyJobs(next, options)) return next
  const running = next.jobs.filter((job) => job.status === 'running')
  if (!running.length) {
    completeRun(next)
    return next
  }
  const job = running.reduce((soonest, other) => (soonest.nextAt! <= other.nextAt! ? soonest : other))
  next.clock = Math.max(next.clock, job.nextAt!)
  finishStep(next, job, options)
  return next
}

export function runToEnd(state: RunState, options: RunOptions = {}): RunState {
  let current = state
  // ponytail: bounded so a scheduling bug cannot spin forever
  for (let i = 0; i < 10_000 && current.status !== 'completed'; i++) current = advance(current, options)
  return current
}
