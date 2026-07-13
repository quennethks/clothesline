import { expect, test } from '@playwright/test'
import { signUp, uniqueEmail } from './helpers/auth'
import { createLoad, send } from './helpers/load'

// The PRD's make-or-break number, measured rather than asserted by eye
// (spec §13 / §6.3): create → itemize 8 categories → mark sent, under 60s.
//
// The clock starts *after* sign-in, which is a one-off and not part of the
// counter flow. A headless click is faster than a thumb, so this is a
// regression guard on the interaction cost — a modal, a navigation between
// taps, or a network round-trip in the counter path would blow it out — not a
// substitute for the real-device stopwatch the PRD asks for.

const ITEMIZE_BUDGET_MS = 60_000

test('create → itemize → send lands well under the 60s target', async ({ page }) => {
  await signUp(page, uniqueEmail())

  const started = Date.now()

  await createLoad(page, 'Speed Run')
  const counts: [string, number][] = [
    ['Shirts', 4],
    ['Trousers', 2],
    ['Shorts', 3],
    ['Underwear', 6],
    ['Socks', 5],
    ['Towels', 2],
    ['Bedsheets', 1],
    ['Jackets', 1],
  ]
  for (const [category, times] of counts) {
    for (let i = 0; i < times; i++) {
      await page.getByRole('button', { name: `Increase ${category}` }).click()
    }
  }
  await expect(page.getByTestId('draft-total')).toHaveText('24')
  await send(page)

  const elapsed = Date.now() - started
  console.log(`itemize flow: ${(elapsed / 1000).toFixed(1)}s (budget ${ITEMIZE_BUDGET_MS / 1000}s)`)
  expect(elapsed).toBeLessThan(ITEMIZE_BUDGET_MS)
})
