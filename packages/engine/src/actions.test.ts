import { describe, expect, it } from 'vitest'
import { logsFor } from './actions'

describe('logsFor', () => {
  it('describes checkout without needing inputs', () => {
    const { seconds, logs } = logsFor('actions/checkout@v7', {})
    expect(seconds).toBeGreaterThan(0)
    expect(logs[0]).toBe('Syncing repository')
  })

  it('uses the version given to a setup action', () => {
    expect(logsFor('actions/setup-node@v7', { 'node-version': 22 }).logs).toContain('node -v -> v22')
    expect(logsFor('actions/setup-node@v7', {}).logs).toContain('node -v -> v24')
    expect(logsFor('actions/setup-python@v6', { 'python-version': '3.12' }).logs).toContain('python --version -> Python 3.12')
    expect(logsFor('actions/setup-java@v5', { 'java-version': 21, distribution: 'zulu' }).logs).toContain('Setting up zulu JDK 21')
    expect(logsFor('actions/setup-go@v6', { 'go-version': '1.24' }).logs).toContain('go version -> go1.24')
  })

  it('echoes cache and artifact inputs', () => {
    expect(logsFor('actions/cache@v6', { key: 'node-abc', path: '~/.npm' }).logs).toContain('Cache key: node-abc')
    expect(logsFor('actions/upload-artifact@v7', { name: 'dist' }).logs).toContain('Uploading artifact "dist"')
    expect(logsFor('actions/download-artifact@v7', {}).logs).toContain('Downloading artifact "artifact"')
    expect(logsFor('actions/cache@v6', { key: null }).logs).toContain('Cache key: (none)')
  })

  it('says plainly when an action is not simulated', () => {
    expect(logsFor('octo/secret-scanner@v1', {}).logs).toEqual(['Run octo/secret-scanner@v1', 'This action is not simulated, so the run assumes it succeeds.'])
  })
})
