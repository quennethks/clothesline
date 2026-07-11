import { expect, type Page } from '@playwright/test'

// Sign-in, driven for real against Zitadel Login V2 (spec §5.5) — the app
// redirects there, Zitadel authenticates, and we come back with tokens. Nothing
// about auth is stubbed.
//
// NOTE: username + password, not the email one-time code the spec originally
// described. Login V2 offers only Passkey or Password as a *primary* factor —
// Zitadel supports email OTP as a second factor, not as the way you log in — so
// email-code-only sign-in isn't buildable on Zitadel as it stands. Password is
// the agreed interim; see the spec's §5.5 note.

export const TEST_PASSWORD = 'E2ePassw0rd!'

export function uniqueEmail(): string {
  return `e2e-${Date.now()}-${Math.floor(Math.random() * 10_000)}@example.com`
}

/** Registers a brand-new user through Login V2 and returns signed in. */
export async function signUp(page: Page, email: string): Promise<void> {
  await page.goto('/')
  await page.getByRole('button', { name: /continue with email/i }).click()
  await page.waitForURL(/\/ui\/v2\/login/, { timeout: 30_000 })

  await page.getByRole('button', { name: /register new user/i }).click()
  await page.locator('input[name="firstname"]').fill('E2E')
  await page.locator('input[name="lastname"]').fill('Tester')
  await page.locator('input[name="email"]').fill(email)
  await page.getByRole('radio', { name: /password/i }).click()
  await page.getByRole('button', { name: /continue/i }).click()

  await page.locator('input[name="password"]').fill(TEST_PASSWORD)
  await page.locator('input[name="confirmPassword"]').fill(TEST_PASSWORD)
  await page.getByRole('button', { name: /continue/i }).click()

  await expectSignedIn(page)
}

/** Signs an already-registered user back in (a second device / a fresh browser). */
export async function signIn(page: Page, email: string): Promise<void> {
  await page.goto('/')
  await page.getByRole('button', { name: /continue with email/i }).click()
  await page.waitForURL(/\/ui\/v2\/login/, { timeout: 30_000 })

  // Login V2 renders the username field twice (one is a hidden/duplicate copy),
  // so this has to be narrowed rather than matched by label alone.
  await page.locator('input[name="loginName"]').first().fill(email)
  await page.getByRole('button', { name: /continue/i }).click()
  await page.locator('input[name="password"]').fill(TEST_PASSWORD)
  await page.getByRole('button', { name: /continue/i }).click()

  await expectSignedIn(page)
}

export async function expectSignedIn(page: Page): Promise<void> {
  await expect(page.getByRole('heading', { name: 'My Loads' })).toBeVisible({ timeout: 30_000 })
}
