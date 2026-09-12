import { expect, test } from '@playwright/test'

test('navigates to progress and shows the empty state', async ({ page }) => {
  await page.goto('/')
  await page.getByRole('banner').getByRole('link', { name: 'Progress', exact: true }).click()
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Your progress')
  await expect(page.getByText('You have not finished a lesson or a scenario yet.')).toBeVisible()
})

test('keeps the chosen theme after a reload, and auto leaves it to the system', async ({ page }) => {
  await page.goto('/')
  const html = page.locator('html')
  await expect(html).not.toHaveAttribute('data-theme', /.*/)

  await page.getByLabel('Theme').selectOption('dark')
  await expect(html).toHaveAttribute('data-theme', 'dark')

  await page.reload()
  await expect(html).toHaveAttribute('data-theme', 'dark')
  await expect(page.getByLabel('Theme')).toHaveValue('dark')

  await page.getByLabel('Theme').selectOption('auto')
  await expect(html).not.toHaveAttribute('data-theme', /.*/)
})

test('asks before resetting progress', async ({ page }) => {
  await page.goto('/progress')
  await page.getByRole('button', { name: 'Reset progress' }).click()

  const dialog = page.getByRole('dialog')
  await expect(dialog.getByRole('heading', { name: 'Reset progress?' })).toBeVisible()

  await dialog.getByRole('button', { name: 'Cancel' }).click()
  await expect(dialog).toBeHidden()

  await page.getByRole('button', { name: 'Reset progress' }).click()
  await dialog.getByRole('button', { name: 'Reset progress' }).click()
  await expect(dialog).toBeHidden()
  await expect(page.getByText('You have not finished a lesson or a scenario yet.')).toBeVisible()
})

test('shows a not found page for an unknown address', async ({ page }) => {
  await page.goto('/nope')
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Page not found')
})
