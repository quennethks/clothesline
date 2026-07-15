import { expect, test, type Page } from '@playwright/test'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { signUp, uniqueEmail } from './helpers/auth'
import { createLoad } from './helpers/load'

// The in-app camera end-to-end (spec §8). Chromium runs with a synthetic camera
// (the fake-media launch flags in playwright.config.ts), so getUserMedia resolves
// headlessly and the permission is auto-accepted. This spec runs on BOTH device
// projects — the whole point of the feature is that desktop and mobile behave
// alike.

const SHIRT = fileURLToPath(new URL('./fixtures/shirt.png', import.meta.url))
const SHIRT_BYTES = readFileSync(SHIRT)

/** Opens the sheet from the Draft row — in place, scoped to the category. */
async function openDraftCamera(page: Page, category = 'Shirts'): Promise<void> {
  await page.getByRole('button', { name: `Take photo for ${category}` }).click()
  await expect(page.getByRole('dialog')).toBeVisible()
}

test.describe('camera', () => {
  test('shutter → review → Use photo adds a tile and bumps the count', async ({ page }) => {
    await signUp(page, uniqueEmail())
    await createLoad(page, 'Camera Shop')

    await openDraftCamera(page)
    const shutter = page.getByRole('button', { name: 'Take photo', exact: true })
    // The fake device produced a frame, so the shutter is live.
    await expect(shutter).toBeEnabled()
    await shutter.click()
    await page.getByRole('button', { name: 'Use photo' }).click()

    // Sheet closes; a category capture auto-creates an item and bumps the count.
    await expect(page.getByRole('dialog')).toBeHidden()
    await expect(page.getByTestId('count-Shirts')).toHaveText('1')

    // And it shows in the gallery.
    await page.getByRole('button', { name: 'Photos for Shirts' }).click()
    await expect(page.getByRole('button', { name: 'Enlarge photo' })).toHaveCount(1)
  })

  test('Retake discards the frame and writes nothing', async ({ page }) => {
    await signUp(page, uniqueEmail())
    await createLoad(page, 'Camera Shop')

    await openDraftCamera(page)
    await page.getByRole('button', { name: 'Take photo', exact: true }).click()
    await page.getByRole('button', { name: 'Retake' }).click()

    // Back on the live viewfinder, nothing committed.
    await expect(page.getByRole('button', { name: 'Take photo', exact: true })).toBeVisible()
    await page.getByRole('button', { name: 'Close camera' }).click()
    await expect(page.getByTestId('count-Shirts')).toHaveText('0')
  })

  test('the picker adds N photos at once in category scope', async ({ page }) => {
    await signUp(page, uniqueEmail())
    await createLoad(page, 'Camera Shop')

    await openDraftCamera(page)
    await page.getByTestId('photo-input').setInputFiles([SHIRT, SHIRT, SHIRT])

    // Every file landed → the sheet closes; N photos → N items → count +N.
    await expect(page.getByRole('dialog')).toBeHidden()
    await expect(page.getByTestId('count-Shirts')).toHaveText('3')
  })

  test('oversized and non-image files are skipped and reported; the good one still lands', async ({
    page,
  }) => {
    await signUp(page, uniqueEmail())
    await createLoad(page, 'Camera Shop')

    await openDraftCamera(page)
    await page.getByTestId('photo-input').setInputFiles([
      // Over the 25MB guard — refused before any decode (spec §5.1).
      { name: 'huge.jpg', mimeType: 'image/jpeg', buffer: Buffer.alloc(26 * 1024 * 1024, 1) },
      // A .zip wearing an image name — refused on type.
      { name: 'archive.zip', mimeType: 'application/zip', buffer: Buffer.from('not an image') },
      { name: 'ok.png', mimeType: 'image/png', buffer: SHIRT_BYTES },
    ])

    // The two bad files are reported; the good one is kept, not rolled back.
    await expect(page.getByRole('alert')).toContainText('2 of 3')
    await page.getByRole('button', { name: 'Close camera' }).click()
    await expect(page.getByTestId('count-Shirts')).toHaveText('1')
  })

  test('the Draft row opens the camera in place, not by navigating to the Gallery', async ({
    page,
  }) => {
    await signUp(page, uniqueEmail())
    await createLoad(page, 'Camera Shop')

    const before = page.url()
    await page.getByRole('button', { name: 'Take photo for Shirts' }).click()
    await expect(page.getByRole('dialog')).toBeVisible()
    // The sheet is a component, not a screen — no route change (spec §3.4).
    expect(page.url()).toBe(before)
    expect(page.url()).not.toContain('gallery')
  })

  test('when the camera cannot start, the sheet degrades to Unavailable but the picker still works', async ({
    page,
  }) => {
    // On this Chromium the fake capture pipeline needs --use-fake-ui-for-media-stream,
    // which auto-accepts the permission — so permission-based denial can't be
    // expressed. Stubbing getUserMedia to reject drives the exact same path
    // (useCamera's catch → Unavailable) and is more robust than the permission
    // model would be (spec §3.1).
    await page.addInitScript(() => {
      navigator.mediaDevices.getUserMedia = () =>
        Promise.reject(new DOMException('denied', 'NotAllowedError'))
    })
    await signUp(page, uniqueEmail())
    await createLoad(page, 'Camera Shop')

    await openDraftCamera(page)
    await expect(page.getByRole('button', { name: /Choose existing photo/ })).toBeVisible()

    await page.getByTestId('photo-input').setInputFiles(SHIRT)
    await expect(page.getByRole('dialog')).toBeHidden()
    await expect(page.getByTestId('count-Shirts')).toHaveText('1')
  })

  test('the control set proves the device branch (OS camera on touch only)', async ({ page }) => {
    await signUp(page, uniqueEmail())
    await createLoad(page, 'Camera Shop')

    await openDraftCamera(page)
    await expect(page.getByRole('button', { name: 'Take photo', exact: true })).toBeEnabled()

    // The touch-gated "Use device camera" is the reliable proof that
    // matchMedia('(pointer: coarse)') resolved correctly for this project: it
    // depends only on the pointer type, not on device count (the single fake
    // camera gives no second device to flip to). If Pixel 7 emulation didn't
    // satisfy the query, the mobile run would show the desktop control set and
    // still pass — so this asserts the branch directly (spec §8).
    const osCamera = page.getByRole('button', { name: /Use device camera/ })
    if (test.info().project.name.includes('mobile')) {
      await expect(osCamera).toBeVisible()
    } else {
      await expect(osCamera).toHaveCount(0)
    }
  })
})
