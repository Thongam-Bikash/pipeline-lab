import { expect, test } from '@playwright/test'

test('runs the fixture workflow and shows jobs, logs, and history', async ({ page }) => {
  await page.goto('/playground')
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Playground')

  await page.getByRole('button', { name: 'Run workflow' }).click()
  // Finish the run at once, so the assertions do not race the playback timer.
  await page.getByRole('button', { name: 'Instant' }).click()

  const graph = page.getByRole('group', { name: 'Jobs in this run' })
  for (const name of ['lint', 'build', 'test (22)', 'test (24)', 'deploy']) {
    await expect(graph.getByRole('button', { name: new RegExp(name.replace(/[()]/g, '\\$&')) })).toBeVisible()
  }

  // Successful steps start collapsed, the way GitHub shows them, so open the setup step.
  await graph.getByRole('button', { name: /test \(22\)/ }).click()
  await page.getByText('actions/setup-node@v7', { exact: true }).click()
  await expect(page.getByText('node -v -> v22')).toBeVisible()
  // Exact, because the same text also appears in the workflow listing and in the step's log line.
  await expect(page.getByText('### 128 tests passed', { exact: true })).toBeVisible()

  await expect(page.getByRole('button', { name: /Run 1/ })).toBeVisible()
})

test('lists what the simulator does not model', async ({ page }) => {
  await page.goto('/playground')
  await expect(page.getByText('This simulates a documented subset of GitHub Actions.', { exact: false })).toBeVisible()
})
