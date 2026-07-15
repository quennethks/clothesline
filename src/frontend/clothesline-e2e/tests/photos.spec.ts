import { expect, test, type Page } from '@playwright/test'
import { fileURLToPath } from 'node:url'
import { signIn, signUp, uniqueEmail } from './helpers/auth'
import { createLoad, goHome } from './helpers/load'

// Photos end-to-end against real Azurite (spec §8): capture → WebP-compress →
// stash bytes locally → SAS upload → read back. The M6 acceptance in one file.

const IMAGE = fileURLToPath(new URL('./fixtures/shirt.png', import.meta.url))

async function attachPhoto(page: Page): Promise<void> {
  const before = await page.getByRole('button', { name: 'Enlarge photo' }).count()
  // Capture is now inside the CameraSheet, so the sheet has to be opened before
  // the picker input exists (spec §8). The photo-input testid moved onto that
  // input, so this is the only change these write-path tests need — no camera
  // permission is granted here, so the sheet lands in Unavailable, whose
  // "Choose existing photo" picker is the same input.
  await page.getByRole('button', { name: 'Add photo' }).click()
  await page.getByTestId('photo-input').setInputFiles(IMAGE)
  await expect(page.getByRole('button', { name: 'Enlarge photo' })).toHaveCount(before + 1)
}

test.describe('photos', () => {
  test('a category photo auto-creates an item, bumps the auto count, and shows in the gallery', async ({
    page,
  }) => {
    await signUp(page, uniqueEmail())
    await createLoad(page, 'Photo Shop')

    await expect(page.getByTestId('count-Shirts')).toHaveText('0')
    await page.getByRole('button', { name: 'Photos for Shirts' }).click()
    await expect(page.getByTestId('gallery-empty')).toBeVisible()

    await attachPhoto(page)
    // The bytes were captured on this device, so they render straight from the
    // local byte store — no "waiting to upload" placeholder.
    await expect(page.locator('.photo-tile img')).toBeVisible()

    await page.getByRole('button', { name: 'Back' }).click()
    // Auto mode: the photo created a LoadItem, which drove the count (spec §4.4).
    await expect(page.getByTestId('count-Shirts')).toHaveText('1')
  })

  test('deleting the photo decrements the auto count again', async ({ page }) => {
    await signUp(page, uniqueEmail())
    await createLoad(page, 'Photo Shop')

    await page.getByRole('button', { name: 'Photos for Socks' }).click()
    await attachPhoto(page)
    await page.getByRole('button', { name: 'Back' }).click()
    await expect(page.getByTestId('count-Socks')).toHaveText('1')

    await page.getByRole('button', { name: 'Photos for Socks' }).click()
    await page.getByRole('button', { name: 'Enlarge photo' }).click()
    await page.getByRole('button', { name: 'Delete photo' }).click()
    await expect(page.getByTestId('gallery-empty')).toBeVisible()

    await page.getByRole('button', { name: 'Back' }).click()
    await expect(page.getByTestId('count-Socks')).toHaveText('0')
  })

  test('the bundle photo becomes the load card thumbnail', async ({ page }) => {
    await signUp(page, uniqueEmail())
    await createLoad(page, 'Bundle Co')

    await page.getByRole('button', { name: 'Load photos' }).click()
    await attachPhoto(page)
    await page.getByRole('button', { name: 'Back' }).click()
    await goHome(page)

    // The is_primary load-linked photo renders as the card's avatar (spec §4.1).
    await expect(page.getByTestId('load-card').locator('img.bag-photo')).toBeVisible()
  })

  test('a photo captured offline is viewable offline and uploads on reconnect', async ({
    page,
    context,
    browser,
  }) => {
    const email = uniqueEmail()
    await signUp(page, email)
    await createLoad(page, 'Offline Shop')
    await page.getByRole('button', { name: 'Photos for Towels' }).click()

    // --- offline capture ---
    await context.setOffline(true)
    await expect(page.getByTestId('sync-status')).toHaveAttribute('data-status', 'offline')
    await attachPhoto(page)
    // Viewable immediately, with no network: the bytes are on this device
    // (spec §8.3's dominant case).
    await expect(page.locator('.photo-tile img')).toBeVisible()

    // --- reconnect: the upload queue drains the bytes to Blob ---
    await context.setOffline(false)

    // A *different* device pulling the same account is the real proof the bytes
    // made it to Blob: this browser has none of them locally, so the photo can
    // only render by way of blob_key → read SAS → fetch (spec §8.3's lazy
    // cache-on-view). If the upload never happened it shows "Waiting to upload".
    const secondDevice = await browser.newContext({ ignoreHTTPSErrors: true })
    const secondPage = await secondDevice.newPage()
    await signIn(secondPage, email)
    await secondPage.getByTestId('load-card').click()
    await secondPage.getByRole('button', { name: 'Photos for Towels' }).click()
    await expect(secondPage.locator('.photo-tile img')).toBeVisible({ timeout: 60_000 })
    await secondDevice.close()
  })
})
