import { readFile } from 'node:fs/promises'
import { expect, test } from '@playwright/test'
import { PASSWORD, seedGuestLesson, signIn, verifiedAccount } from './account'

test('exports your data as a download with no credentials in it', async ({ page, request }) => {
  const email = await verifiedAccount(request)
  await seedGuestLesson(page, 'anatomy/runners')
  await signIn(page, email)
  await page.waitForLoadState('networkidle')

  const [download] = await Promise.all([page.waitForEvent('download'), page.getByRole('link', { name: 'Download your data' }).click()])
  const text = await readFile((await download.path())!, 'utf8')

  expect(download.suggestedFilename()).toMatch(/^pipeline-lab-export-\d{4}-\d{2}-\d{2}\.json$/)
  expect(JSON.parse(text).account.email).toBe(email)
  expect(JSON.parse(text).lessons).toHaveProperty(['anatomy/runners'])
  // Catches an export that starts selecting whole rows, which would carry the password hash and tokens.
  expect(text).not.toMatch(/password|token|hash/i)
})

test('deletes the account only after asking for the password again', async ({ page, request }) => {
  const email = await verifiedAccount(request)
  await signIn(page, email)
  const dialog = page.getByRole('dialog')

  await page.getByRole('button', { name: 'Delete account' }).click()
  await dialog.getByRole('button', { name: 'Cancel' }).click()
  await expect(page.getByRole('banner').getByRole('link', { name: 'Account', exact: true })).toBeVisible()

  await page.getByRole('button', { name: 'Delete account' }).click()
  await dialog.getByLabel('Your password').fill('not-the-password')
  await dialog.getByRole('button', { name: 'Delete account' }).click()
  await expect(dialog.getByRole('alert')).toHaveText('Invalid password')

  await dialog.getByLabel('Your password').fill(PASSWORD)
  await dialog.getByRole('button', { name: 'Delete account' }).click()
  await expect(page.getByText('Your account has been deleted.')).toBeVisible()

  await page.goto('/sign-in')
  await page.getByLabel('Email').fill(email)
  await page.getByLabel('Password', { exact: true }).fill(PASSWORD)
  await page.getByRole('button', { name: 'Sign in' }).click()
  await expect(page.getByRole('alert')).toHaveText('Invalid email or password')
})
