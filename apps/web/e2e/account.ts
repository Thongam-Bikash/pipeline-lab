import { expect, type APIRequestContext, type Browser, type Page } from '@playwright/test'

// Matches use.baseURL in playwright.config.ts; the API trusts this origin in the test stack.
export const BASE = 'http://localhost:4173'
const MAILPIT = 'http://127.0.0.1:8083/api/v1'
export const PASSWORD = 'correct-horse-battery-staple'

// A fresh address per test, so parallel workers never read each other's mail.
export const newEmail = () => `e2e-${crypto.randomUUID()}@example.test`

// Emails link to the API's own origin. Keeping only the path sends the browser through the page under test.
export async function mailLink(request: APIRequestContext, to: string, contains: string) {
  let path = ''
  await expect
    .poll(
      async () => {
        const search = await (await request.get(`${MAILPIT}/search?query=${encodeURIComponent(`to:"${to}"`)}`)).json()
        for (const { ID } of search.messages ?? []) {
          const message = await (await request.get(`${MAILPIT}/message/${ID}`)).json()
          const url: string | undefined = message.Text.match(/https?:\/\/\S+/)?.[0]
          if (url?.includes(contains)) {
            const parsed = new URL(url)
            path = parsed.pathname + parsed.search
            return true
          }
        }
        return false
      },
      { timeout: 15_000 },
    )
    .toBe(true)
  return path
}

export async function signUp(request: APIRequestContext, email = newEmail()) {
  const response = await request.post(`${BASE}/api/auth/sign-up/email`, {
    headers: { origin: BASE },
    data: { email, password: PASSWORD, name: '' },
  })
  expect(response.ok(), 'sign-up through the API; is the stack running with RATE_LIMIT=off?').toBe(true)
  return email
}

// Signs up and confirms the address through the API, for tests about what comes after.
export async function verifiedAccount(request: APIRequestContext) {
  const email = await signUp(request)
  await request.get(`${BASE}${await mailLink(request, email, 'verify-email')}`, { maxRedirects: 0 })
  return email
}

export async function signIn(page: Page, email: string, password = PASSWORD) {
  await page.goto('/sign-in')
  await page.getByLabel('Email').fill(email)
  await page.getByLabel('Password', { exact: true }).fill(password)
  await page.getByRole('button', { name: 'Sign in' }).click()
  await expect(page).toHaveURL('/account')
}

// A separate browser context stands in for a second device: its own storage and its own cookies.
export const device = async (browser: Browser) => (await browser.newContext({ baseURL: BASE })).newPage()

// Dated an hour ago, so it counts as older than a reset made during the test.
export async function seedGuestLesson(page: Page, id: string) {
  await page.goto('/progress')
  await page.evaluate(
    ([lesson, at]) =>
      localStorage.setItem('pipeline-lab-progress', JSON.stringify({ state: { lessons: { [lesson]: { completedAt: at } }, scenarios: {} }, version: 1 })),
    [id, new Date(Date.now() - 3_600_000).toISOString()] as const,
  )
  await page.reload()
}
