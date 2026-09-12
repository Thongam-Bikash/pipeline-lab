import type { Json } from './types'

export type ActionLog = { seconds: number; logs: string[] }

const input = (values: Record<string, Json>, name: string, fallback = '') => {
  const value = values[name]
  return value === undefined || value === null ? fallback : String(value)
}

// Plausible logs for the actions the lessons use most.
const LIBRARY: Record<string, (values: Record<string, Json>) => ActionLog> = {
  'actions/checkout': () => ({
    seconds: 3,
    logs: ['Syncing repository', 'Getting Git version info', 'Fetching the repository', 'Determining the checkout info', 'Checking out the ref'],
  }),
  'actions/setup-node': (values) => {
    const version = input(values, 'node-version', '24')
    return { seconds: 5, logs: [`Attempting to resolve Node ${version}`, 'Acquiring tool from the runner cache', `Adding Node ${version} to the PATH`, `node -v -> v${version}`] }
  },
  'actions/setup-python': (values) => {
    const version = input(values, 'python-version', '3.13')
    return { seconds: 5, logs: [`Attempting to resolve Python ${version}`, `Successfully set up CPython (${version})`, `python --version -> Python ${version}`] }
  },
  'actions/setup-java': (values) => {
    const version = input(values, 'java-version', '21')
    return { seconds: 8, logs: [`Attempting to resolve Java ${version}`, `Setting up ${input(values, 'distribution', 'temurin')} JDK ${version}`, 'Creating toolchains.xml'] }
  },
  'actions/setup-go': (values) => {
    const version = input(values, 'go-version', '1.25')
    return { seconds: 6, logs: [`Attempting to resolve Go ${version}`, `Adding Go ${version} to the PATH`, `go version -> go${version}`] }
  },
  'actions/cache': (values) => ({
    seconds: 2,
    logs: [`Cache key: ${input(values, 'key', '(none)')}`, `Cache path: ${input(values, 'path', '(none)')}`, 'Cache not found, this run will save one'],
  }),
  'actions/upload-artifact': (values) => ({
    seconds: 4,
    logs: [`Uploading artifact "${input(values, 'name', 'artifact')}"`, `Path: ${input(values, 'path', '(none)')}`, 'Artifact upload complete'],
  }),
  'actions/download-artifact': (values) => ({
    seconds: 2,
    logs: [`Downloading artifact "${input(values, 'name', 'artifact')}"`, 'Artifact download complete'],
  }),
}

export function logsFor(uses: string, values: Record<string, Json>): ActionLog {
  const build = LIBRARY[uses.split('@')[0]!]
  if (!build) return { seconds: 2, logs: [`Run ${uses}`, 'This action is not simulated, so the run assumes it succeeds.'] }
  return build(values)
}
