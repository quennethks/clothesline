import { expect, test } from '@playwright/test'
import { signIn, signUp, uniqueEmail } from './helpers/auth'
import { countUp, createLoad, enterReceivedTotal, goHome, send } from './helpers/load'

// The premise of the whole app (PRD §4, spec §6.4): the counter flow runs with
// no network at all, and reconnecting produces exactly one load server-side —
// not a duplicate, because ids are client-generated and /sync upserts by id
// (spec §7.1).

test('the whole flow works offline and syncs as a single load on reconnect', async ({
  page,
  context,
  browser,
}) => {
  const email = uniqueEmail()
  await signUp(page, email)

  // --- pull the plug ---
  await context.setOffline(true)
  await expect(page.getByTestId('sync-status')).toHaveAttribute('data-status', 'offline')

  await createLoad(page, 'Offline Laundry')
  await countUp(page, 'Shirts', 3)
  await countUp(page, 'Socks', 2)
  await expect(page.getByTestId('draft-total')).toHaveText('5')
  await send(page)
  await enterReceivedTotal(page, 5)
  await goHome(page)
  await expect(page.getByTestId('load-card').getByText('Closed')).toBeVisible()

  // --- reconnect ---
  await context.setOffline(false)
  // 'idle' is the indicator's settled state — everything pushed, nothing in
  // flight (it reads "Synced" to the user).
  await expect(page.getByTestId('sync-status')).toHaveAttribute('data-status', 'idle', {
    timeout: 60_000,
  })

  // A fresh device sees exactly one load, closed, with the counts intact — so
  // the offline session replicated once, not twice.
  const secondDevice = await browser.newContext({ ignoreHTTPSErrors: true })
  const secondPage = await secondDevice.newPage()
  await signIn(secondPage, email)
  await expect(secondPage.getByTestId('load-card')).toHaveCount(1, { timeout: 60_000 })
  await expect(secondPage.getByTestId('load-card').getByText('Closed')).toBeVisible()

  await secondPage.getByTestId('load-card').click()
  await expect(secondPage.getByTestId('received-Shirts')).toHaveText('0')
  await expect(secondPage.getByText('5').first()).toBeVisible()
  await secondDevice.close()
})
