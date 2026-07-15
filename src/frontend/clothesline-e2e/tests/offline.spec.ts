import { expect, test } from '@playwright/test'
import { signIn, signUp, uniqueEmail } from './helpers/auth'
import {
  countUp,
  createLoad,
  enterReceivedTotal,
  expectSyncStatus,
  goHome,
  send,
} from './helpers/load'

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

  // Let the one online-only bootstrap finish before pulling the plug. Creating a
  // load needs the server-assigned User.id, which GET /auth/me fetches once and
  // caches (see useCurrentUser.ts: "by the time we're offline this has always
  // been fetched at least once") — until it lands, "New load" is disabled.
  // Going offline the instant the heading paints raced that fetch, so this spec
  // was passing on how fast the page happened to load rather than on the offline
  // behaviour it means to test.
  await expect(page.getByRole('button', { name: 'New load' })).toBeEnabled()

  // --- pull the plug ---
  await context.setOffline(true)
  await expectSyncStatus(page, 'offline')

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
  // flight (it reads "Synced" to the user). goHome above left us on Home, where
  // the account menu (and so the sync badge) lives.
  await expectSyncStatus(page, 'idle', { timeout: 60_000 })

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
