import { expect, test } from '@playwright/test'
import { mailLink, newEmail, PASSWORD, signIn, signUp, verifiedAccount } from './account'

test('signs up, confirms the address by email, and signs out', async ({ page, request }) => {
  const email = newEmail()
  const banner = page.getByRole('banner')

  await page.goto('/sign-up')
  await page.getByLabel('Email').fill(email)
  await page.getByLabel('Password', { exact: true }).fill(PASSWORD)
  await page.getByRole('button', { name: 'Create account' }).click()
  await expect(page.getByRole('heading', { name: 'Check your inbox' })).toBeVisible()

  await page.goto(await mailLink(request, email, 'verify-email'))
  await expect(page.getByText('Your email address is confirmed.')).toBeVisible()
  await expect(page.getByText(email)).toBeVisible()
  await expect(banner.getByRole('link', { name: 'Account', exact: true })).toBeVisible()

  await page.getByRole('button', { name: 'Sign out' }).click()
  await expect(banner.getByRole('link', { name: 'Sign in', exact: true })).toBeVisible()
})

test('refuses to sign in before the address is confirmed', async ({ page, request }) => {
  const email = await signUp(request)

  await page.goto('/sign-in')
  await page.getByLabel('Email').fill(email)
  await page.getByLabel('Password', { exact: true }).fill(PASSWORD)
  await page.getByRole('button', { name: 'Sign in' }).click()

  await expect(page.getByRole('alert')).toContainText('Confirm your email address first')
})

test('says so when the password is wrong', async ({ page, request }) => {
  const email = await verifiedAccount(request)

  await page.goto('/sign-in')
  await page.getByLabel('Email').fill(email)
  await page.getByLabel('Password', { exact: true }).fill('not-the-password')
  await page.getByRole('button', { name: 'Sign in' }).click()

  await expect(page.getByRole('alert')).toHaveText('Invalid email or password')
})

test('resets a forgotten password by email', async ({ page, request }) => {
  const email = await verifiedAccount(request)
  const newPassword = 'a-brand-new-passphrase'

  await page.goto('/forgot-password')
  await page.getByLabel('Email').fill(email)
  await page.getByRole('button', { name: 'Send reset link' }).click()
  await expect(page.getByRole('status')).toContainText('If an account uses that address')

  await page.goto(await mailLink(request, email, 'reset-password'))
  await page.getByLabel('New password').fill(newPassword)
  await page.getByRole('button', { name: 'Save new password' }).click()
  await expect(page.getByRole('heading', { name: 'Password changed' })).toBeVisible()

  await signIn(page, email, newPassword)
})

test('answers a reset request the same way for an address with no account', async ({ page }) => {
  await page.goto('/forgot-password')
  await page.getByLabel('Email').fill(newEmail())
  await page.getByRole('button', { name: 'Send reset link' }).click()

  await expect(page.getByRole('status')).toContainText('If an account uses that address')
})

test('offers no Google sign-in until it is configured', async ({ page }) => {
  await page.goto('/sign-in')
  await page.waitForLoadState('networkidle')

  await expect(page.getByRole('button', { name: 'Continue with Google' })).toHaveCount(0)
})
