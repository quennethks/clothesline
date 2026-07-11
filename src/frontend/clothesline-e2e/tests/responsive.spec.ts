import { expect, test } from '@playwright/test'
import { signUp, uniqueEmail } from './helpers/auth'
import { countUp, createLoad, enterReceivedTotal, goHome, send } from './helpers/load'

// M7's desktop half (spec §6.5). Runs only in the desktop project (1440×900) —
// see playwright.config.ts's testMatch.

test('load screens stay centred at a fixed width on desktop', async ({ page }) => {
  await signUp(page, uniqueEmail())
  await createLoad(page, 'Desktop Wash')

  const card = page.locator('.center-card')
  const box = (await card.boundingBox())!
  const viewport = page.viewportSize()!

  // Fixed max-width, not full-bleed…
  expect(box.width).toBeLessThanOrEqual(680)
  // …and centred: equal gutters either side.
  const leftGutter = box.x
  const rightGutter = viewport.width - (box.x + box.width)
  expect(Math.abs(leftGutter - rightGutter)).toBeLessThan(24)
})

test('the home list becomes a multi-column card grid on desktop', async ({ page }) => {
  await signUp(page, uniqueEmail())
  await createLoad(page, 'One')
  await goHome(page)
  await createLoad(page, 'Two')
  await goHome(page)

  await expect(page.getByTestId('load-card')).toHaveCount(2)
  const first = (await page.getByTestId('load-card').nth(0).boundingBox())!
  const second = (await page.getByTestId('load-card').nth(1).boundingBox())!

  // Side by side, not stacked: same row, different columns.
  expect(second.y).toBeCloseTo(first.y, 0)
  expect(second.x).toBeGreaterThan(first.x)
})

test('the Closed screen lays Sent and Received out as side-by-side columns', async ({ page }) => {
  await signUp(page, uniqueEmail())
  await createLoad(page, 'Reflow Co')
  await countUp(page, 'Shirts', 2)
  await send(page)
  await enterReceivedTotal(page, 1)

  // On desktop the two totals sit next to each other rather than at opposite
  // ends of the manifest (spec §6.5).
  const sent = page.getByText('Total sent')
  const received = page.getByTestId('total-received-desktop')
  await expect(received).toBeVisible()
  await expect(page.getByTestId('total-received')).toBeHidden()

  const sentBox = (await sent.boundingBox())!
  const receivedBox = (await received.boundingBox())!
  expect(receivedBox.x).toBeGreaterThan(sentBox.x)
  expect(Math.abs(receivedBox.y - sentBox.y)).toBeLessThan(60)
})
