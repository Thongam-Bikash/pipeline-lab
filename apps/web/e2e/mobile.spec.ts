import { expect, test, type Page } from '@playwright/test'

test.use({ viewport: { width: 390, height: 844 } })

// A page may scroll down, never sideways.
async function expectNoSidewaysScroll(page: Page) {
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)
  expect(overflow).toBeLessThanOrEqual(1)
}

test('every page fits a phone screen', async ({ page }) => {
  const pages = ['/', '/modules', '/modules/anatomy', '/modules/anatomy/yaml-traps', '/progress', '/playground']
  const accountPages = ['/sign-in', '/sign-up', '/forgot-password', '/reset-password', '/account', '/privacy']
  for (const path of [...pages, ...accountPages]) {
    await page.goto(path)
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible()
    await expectNoSidewaysScroll(page)
  }
})

test('the run view stacks instead of sitting side by side', async ({ page }) => {
  await page.goto('/playground')
  const run = page.getByRole('button', { name: 'Run workflow' })
  await expect(run).toBeEnabled()

  const editorBox = await page.locator('.monaco-editor').first().boundingBox()
  const runBox = await run.boundingBox()
  expect(runBox!.y).toBeGreaterThan(editorBox!.y + editorBox!.height - 1)

  await run.click()
  await expect(page.getByRole('group', { name: 'Jobs in this run' })).toBeVisible()
  await expectNoSidewaysScroll(page)
})
