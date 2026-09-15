import { expect, test } from '@playwright/test'

test('runs and drives the simulator from the keyboard alone', async ({ page }) => {
  await page.goto('/playground')
  await expect(page.getByRole('button', { name: 'Run workflow' })).toBeEnabled()

  // Ctrl+Enter starts the run from inside the editor.
  await page.getByRole('textbox', { name: 'Editor content' }).focus()
  await page.keyboard.press('ControlOrMeta+Enter')
  const graph = page.getByRole('group', { name: 'Jobs in this run' })
  await expect(graph).toBeVisible()

  // Move focus out of the editor. A heading is not interactive, so focus returns to the page.
  await page.getByRole('heading', { level: 1 }).click()

  // Space pauses.
  await page.keyboard.press('Space')
  await expect(page.getByRole('button', { name: 'Resume' })).toBeVisible()

  // Full stop steps, so the whole run can be finished without touching the mouse.
  for (let press = 0; press < 60; press++) await page.keyboard.press('.')
  await expect(page.getByText('Succeeded').first()).toBeVisible()

  // Arrow keys move between jobs, and Enter opens the one you land on.
  await graph.getByRole('button', { name: /lint/ }).focus()
  await page.keyboard.press('ArrowDown')
  await expect(page.locator(':focus')).toContainText('build')
  await page.keyboard.press('ArrowRight')
  await expect(page.locator(':focus')).toContainText('test')
  await page.keyboard.press('Enter')
  await expect(page.getByRole('heading', { level: 3 })).toContainText('test')
})

test('space activates the focused button instead of pausing', async ({ page }) => {
  await page.goto('/playground')
  await expect(page.getByRole('button', { name: 'Run workflow' })).toBeEnabled()

  // Space on the Run button must run the workflow, not be swallowed by the playback shortcut.
  await page.getByRole('button', { name: 'Run workflow' }).focus()
  await page.keyboard.press('Space')
  await expect(page.getByRole('group', { name: 'Jobs in this run' })).toBeVisible()
})
