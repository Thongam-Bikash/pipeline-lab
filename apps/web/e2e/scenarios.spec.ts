import { expect, test } from '@playwright/test'

test('solving the 3 a.m. job scenario records it as passed', async ({ page }) => {
  await page.goto('/scenarios/three-am-job')
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('The 3 a.m. job')
  // One check passes from the start, because the report does already run every weekday.
  await expect(page.getByRole('heading', { name: 'Solved' })).toBeHidden()

  // A hint is available before the answer is.
  await page.getByRole('button', { name: /Show a hint \(1 of 3\)/ }).click()
  await expect(page.getByText('Without a timezone, cron times are UTC.', { exact: false })).toBeVisible()

  // Fix the schedule in the editor: weekdays only, in Berlin time.
  // Monaco's real input is the "Editor content" textbox. Focus it rather than clicking:
  // the rendered text layer sits on top and intercepts pointer events.
  await page.getByRole('textbox', { name: 'Editor content' }).focus()
  await page.keyboard.press('ControlOrMeta+a')
  await page.keyboard.insertText(`name: Daily report
on:
  schedule:
    - cron: '0 7 * * 1-5'
      timezone: Europe/Berlin
jobs:
  report:
    runs-on: ubuntu-24.04
    steps:
      - run: ./scripts/build-report.sh
`)

  await expect(page.getByText('Checks: 3 of 3 passing')).toBeVisible()
  await expect(page.getByRole('heading', { name: 'Solved' })).toBeVisible()
  await expect(page.getByText('1 hint used.')).toBeVisible()

  await page.goto('/progress')
  await expect(page.getByText('Scenarios passed: 1')).toBeVisible()
  await expect(page.getByText('three-am-job')).toBeVisible()
})
