import { expect, test } from '@playwright/test'
import { device, seedGuestLesson, signIn, verifiedAccount } from './account'

// The acceptance test for accounts: this is the one to keep if the suite ever has to shrink.
test('two devices signed in to one account end up with the same progress', async ({ browser, request }) => {
  const email = await verifiedAccount(request)
  const laptop = await device(browser)
  const phone = await device(browser)

  await seedGuestLesson(laptop, 'anatomy/runners')
  await signIn(laptop, email)
  await seedGuestLesson(phone, 'triggers/filters')
  await signIn(phone, email)

  await phone.goto('/progress')
  await expect(phone.getByRole('heading', { name: 'Lessons finished: 2' })).toBeVisible()
  await laptop.goto('/progress')
  await expect(laptop.getByRole('heading', { name: 'Lessons finished: 2' })).toBeVisible()
})

test('a reset on one device holds when another device reloads', async ({ browser, request }) => {
  const email = await verifiedAccount(request)
  const laptop = await device(browser)
  const phone = await device(browser)
  await seedGuestLesson(laptop, 'anatomy/runners')
  await signIn(laptop, email)
  await signIn(phone, email)
  await phone.goto('/progress')
  await expect(phone.getByRole('heading', { name: 'Lessons finished: 1' })).toBeVisible()

  await phone.getByRole('button', { name: 'Reset progress' }).click()
  await phone.getByRole('dialog').getByRole('button', { name: 'Reset progress' }).click()
  await expect(phone.getByText('You have not finished a lesson or a scenario yet.')).toBeVisible()

  // Wait for each reload's sync to finish, or an empty page could be read before the answer arrives.
  await laptop.goto('/progress')
  await laptop.waitForLoadState('networkidle')
  await expect(laptop.getByText('You have not finished a lesson or a scenario yet.')).toBeVisible()
  await phone.reload()
  await phone.waitForLoadState('networkidle')
  await expect(phone.getByText('You have not finished a lesson or a scenario yet.')).toBeVisible()
})

test('a project saved on one device opens on another, and deleting it holds', async ({ browser, request }) => {
  const email = await verifiedAccount(request)
  const laptop = await device(browser)
  const phone = await device(browser)
  const title = 'Nightly build'

  await signIn(laptop, email)
  await laptop.goto('/playground')
  await laptop.getByLabel('Project name').fill(title)
  await laptop.getByRole('button', { name: 'Save project' }).click()
  await expect(laptop.getByRole('button', { name: 'Save changes' })).toBeVisible()
  await laptop.waitForLoadState('networkidle')

  await signIn(phone, email)
  await phone.goto('/playground')
  const phoneList = phone.getByLabel('Open').locator('option', { hasText: title })
  await expect(phoneList).toHaveCount(1)
  await phone.getByLabel('Open').selectOption({ label: title })
  await expect(phone.getByLabel('Project name')).toHaveValue(title)

  await phone.getByRole('button', { name: 'Delete project' }).click()
  await expect(phoneList).toHaveCount(0)
  await phone.waitForLoadState('networkidle')

  await laptop.reload()
  await laptop.waitForLoadState('networkidle')
  await expect(laptop.getByLabel('Open').locator('option', { hasText: title })).toHaveCount(0)
})

test('signing out clears this browser, and signing in brings the progress back', async ({ page, request }) => {
  const email = await verifiedAccount(request)
  await seedGuestLesson(page, 'anatomy/runners')
  await signIn(page, email)
  await page.waitForLoadState('networkidle')

  await page.getByRole('button', { name: 'Sign out' }).click()
  await expect(page.getByRole('banner').getByRole('link', { name: 'Sign in', exact: true })).toBeVisible()
  await page.goto('/progress')
  await expect(page.getByText('You have not finished a lesson or a scenario yet.')).toBeVisible()

  await signIn(page, email)
  await page.goto('/progress')
  await expect(page.getByRole('heading', { name: 'Lessons finished: 1' })).toBeVisible()
})
