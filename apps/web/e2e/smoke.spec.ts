import { expect, test } from '@playwright/test'

test('home page loads', async ({ page }) => {
  await page.goto('/')
  await expect(page).toHaveTitle('Pipeline Lab')
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Pipeline Lab')
})
