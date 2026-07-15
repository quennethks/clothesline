import { expect, type Page } from '@playwright/test'

// Shared drive-the-UI steps. Everything here goes through the real UI — these
// flows are local RxDB writes (spec §5.2: no REST CRUD for loads), so there is
// no API shortcut to set a load up with, and using one would skip the code
// under test.

export async function createLoad(page: Page, shopName: string): Promise<void> {
  await page.getByRole('button', { name: 'New load' }).click()
  await expect(page.getByLabel('Load name')).toBeVisible()
  await page.getByLabel('Shop name').fill(shopName)
}

/** Taps `+` on a category the given number of times. */
export async function countUp(page: Page, category: string, times: number): Promise<void> {
  const plus = page.getByRole('button', { name: `Increase ${category}` })
  for (let i = 0; i < times; i++) await plus.click()
  await expect(page.getByTestId(`count-${category}`)).toHaveText(String(times))
}

export async function send(page: Page): Promise<void> {
  await page.getByRole('button', { name: 'Send load' }).click()
  await expect(page.getByText('This load has been sent')).toBeVisible()
}

export async function enterReceivedTotal(page: Page, total: number | null): Promise<void> {
  // Two controls share this name by design — the app-bar icon and the main
  // button at the foot of the manifest. Either does the job; take the first.
  await page.getByRole('button', { name: 'Start Receive' }).first().click()
  await expect(page.getByRole('heading', { name: 'Count your clothes' })).toBeVisible()
  if (total === null) {
    await page.getByRole('button', { name: 'Skip' }).click()
    return
  }
  await page.getByLabel('Total received').fill(String(total))
  await page.getByRole('button', { name: 'Continue' }).click()
}

export async function goHome(page: Page): Promise<void> {
  await page.getByRole('button', { name: 'Back' }).click()
  await expect(page.getByRole('heading', { name: 'My Loads' })).toBeVisible()
}

/**
 * The sync indicator now lives inside the Home account menu (the ⋮) rather than
 * on every screen, so reading it means opening that menu. Must be called on the
 * Home screen. Opens the menu, asserts the status, then closes it again so the
 * overlay doesn't intercept later clicks.
 */
export async function expectSyncStatus(
  page: Page,
  status: string,
  opts?: { timeout?: number },
): Promise<void> {
  await page.getByRole('button', { name: 'Account menu' }).click()
  await expect(page.getByTestId('sync-status')).toHaveAttribute('data-status', status, opts)
  await page.keyboard.press('Escape')
  // The badge only exists while the menu is open, so its absence confirms closed.
  await expect(page.getByTestId('sync-status')).toHaveCount(0)
}

/**
 * Clicks a load card's Duplicate/Delete. Below 420px those collapse into an
 * overflow menu (theme.css) — which is exactly the width a phone runs at, so
 * the helper opens the menu when the inline buttons aren't there.
 */
export async function cardAction(page: Page, name: 'Duplicate' | 'Delete'): Promise<void> {
  const inline = page.getByRole('button', { name, exact: true }).first()
  if (await inline.isVisible().catch(() => false)) {
    await inline.click()
    return
  }
  // exact — the card's own accessible name *contains* its buttons' names, so a
  // substring match (Playwright's default) resolves to the card itself, and
  // clicking that just opens the load.
  await page.getByRole('button', { name: 'More actions', exact: true }).first().click()
  await page.getByRole('button', { name, exact: true }).first().click()
}
