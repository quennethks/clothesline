import { expect, test } from '@playwright/test'
import { signUp, uniqueEmail } from './helpers/auth'
import { cardAction, countUp, createLoad, enterReceivedTotal, goHome, send } from './helpers/load'

// The core lifecycle, end to end against the real graph (spec §10.3): sign in
// passwordlessly, then create → itemize → send → receive, for each of the three
// receive outcomes the state machine allows (§4.2).

test.describe('counter flow', () => {
  test.beforeEach(async ({ page }) => {
    await signUp(page, uniqueEmail())
  })

  test('sign-in is scoped to the user who signed in', async ({ page }) => {
    // A brand-new user's list is empty — proof the API scoped the sync pull to
    // them and not to whatever the previous test left behind (spec §5.5).
    await expect(page.getByText('No loads yet')).toBeVisible()
  })

  test('create → itemize → send → receive a matching total closes the load', async ({ page }) => {
    await createLoad(page, 'Sunny Wash')
    await countUp(page, 'Shirts', 3)
    await countUp(page, 'Socks', 2)
    await expect(page.getByTestId('draft-total')).toHaveText('5')

    await send(page)
    await enterReceivedTotal(page, 5)

    // Match closes immediately — no per-category check (spec §5.4).
    await expect(page.getByText('This load has been sent')).toBeHidden()
    await goHome(page)
    await expect(page.getByTestId('load-card').getByText('Closed')).toBeVisible()
  })

  test('a mismatched total routes to the per-category check', async ({ page }) => {
    await createLoad(page, 'Bubble Co')
    await countUp(page, 'Shirts', 4)
    await send(page)
    await enterReceivedTotal(page, 3)

    // Mismatch → the Closed screen's check-off, where only the received side
    // is editable and the sent tally stays read-only.
    await expect(page.getByTestId('total-received')).toBeVisible()
    await page.getByRole('button', { name: 'Increase received Shirts' }).click()
    await page.getByRole('button', { name: 'Increase received Shirts' }).click()
    await page.getByRole('button', { name: 'Increase received Shirts' }).click()
    await expect(page.getByTestId('received-Shirts')).toHaveText('3')

    await page.getByRole('button', { name: 'Close load' }).click()
    await goHome(page)
    await expect(page.getByTestId('load-card').getByText('Closed')).toBeVisible()
  })

  test('skipping the total routes to the per-category check too', async ({ page }) => {
    await createLoad(page, 'Quick Clean')
    await countUp(page, 'Towels', 2)
    await send(page)
    await enterReceivedTotal(page, null)

    await expect(page.getByTestId('total-received')).toBeVisible()
    await page.getByRole('button', { name: 'Increase received Towels' }).click()
    await expect(page.getByTestId('received-Towels')).toHaveText('1')

    await page.getByRole('button', { name: 'Close load' }).click()
    await goHome(page)
    await expect(page.getByTestId('load-card').getByText('Closed')).toBeVisible()
  })

  test('duplicate carries the categories forward and delete removes the load', async ({ page }) => {
    await createLoad(page, 'Reuse Me')
    await page.getByLabel('New category').fill('Curtains')
    await page.getByRole('button', { name: /add/i }).click()
    await expect(page.getByTestId('count-Curtains')).toBeVisible()
    await countUp(page, 'Curtains', 2)
    await goHome(page)

    await cardAction(page, 'Duplicate')
    await expect(page.getByTestId('load-card')).toHaveCount(2)

    // The duplicate carries the custom category but resets its count (spec §5.3).
    await page.getByTestId('load-card').first().click()
    await expect(page.getByTestId('count-Curtains')).toHaveText('0')
    await goHome(page)

    await cardAction(page, 'Delete')
    // Scoped to the confirm dialog — the cards carry Delete buttons too.
    await page.getByRole('dialog').getByRole('button', { name: 'Delete' }).click()
    await expect(page.getByTestId('load-card')).toHaveCount(1)
  })
})
