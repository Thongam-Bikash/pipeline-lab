import { expect, test } from '@playwright/test'

test('opens a lesson from the modules index and shows its prose', async ({ page }) => {
  await page.goto('/modules')
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Modules')

  await page.getByRole('link', { name: /Anatomy of a workflow/ }).click()
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Anatomy of a workflow')
  await expect(page.getByText('Module recap')).toBeVisible()

  await page.getByRole('link', { name: 'What a workflow file contains' }).click()
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('What a workflow file contains')
  // The MDX prose and its annotated example both render.
  await expect(page.getByText('Jobs run on machines, steps run in order')).toBeVisible()
  await expect(page.getByText('runs-on picks the machine.', { exact: false })).toBeVisible()
  await expect(page.getByText('Last verified', { exact: false })).toBeVisible()
})

test('records the lesson as finished after the quiz', async ({ page }) => {
  await page.goto('/modules/anatomy/what-a-workflow-contains')

  const quiz = page.getByText('Check yourself')
  await expect(quiz).toBeVisible()

  // Answer every question, taking the explanation each time.
  for (let question = 0; question < 4; question++) {
    await page.getByRole('button', { name: /^Where does GitHub look|^Two jobs in the same workflow|^What is the difference|^Why do most jobs start/ }).first().isVisible()
    const choices = page.locator('main button[aria-pressed]')
    await choices.first().click()
    await page.getByRole('button', { name: /Next question|Finish/ }).click()
  }

  await expect(page.getByText(/of 4 correct/)).toBeVisible()

  await page.goto('/progress')
  await expect(page.getByText('Lessons finished: 1')).toBeVisible()
  await expect(page.getByText('anatomy/what-a-workflow-contains')).toBeVisible()
})
