import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { ClotheslineDatabase } from '../db'
import { captureCategoryPhoto } from '../domain/photos'
import { createLoad } from '../domain/loads'
import { newId } from '../domain/shared'
import { createTestDb } from '../domain/testDb'

// The byte store is IndexedDB (absent in jsdom) and mediaApi talks to the
// network — both are stubbed so this exercises the queue's own state machine:
// which photos it picks up, what it writes back, and how it backs off.
const bytes = new Map<string, Blob>()
const uploaded = new Set<string>()

vi.mock('./byteStore', () => ({
  getBytes: async (photoId: string) => bytes.get(photoId),
  markUploaded: async (photoId: string) => void uploaded.add(photoId),
  putBytes: async () => {},
  deleteBytes: async () => {},
}))

const requestUploadUrl = vi.fn()
const putBlobBytes = vi.fn()

vi.mock('./mediaApi', () => ({
  requestUploadUrl: (...args: unknown[]) => requestUploadUrl(...args),
  putBlobBytes: (...args: unknown[]) => putBlobBytes(...args),
}))

const { startUploadQueue } = await import('./uploadQueue')

async function settle() {
  // The queue drains asynchronously off insert$/its own kickoff — let the
  // microtask chain and RxDB's change stream run out.
  for (let i = 0; i < 12; i++) await new Promise((resolve) => setTimeout(resolve, 0))
}

describe('uploadQueue', () => {
  let db: ClotheslineDatabase
  let categoryId: string
  let stop: () => void

  beforeEach(async () => {
    bytes.clear()
    uploaded.clear()
    requestUploadUrl.mockReset()
    putBlobBytes.mockReset()
    vi.spyOn(navigator, 'onLine', 'get').mockReturnValue(true)

    db = await createTestDb()
    const loadId = await createLoad(db, 'user-1')
    categoryId = (
      await db.load_item_categories.find({ selector: { load_id: loadId } }).exec()
    )[0]!.id
  })

  afterEach(async () => {
    stop?.()
    await db.close()
    vi.restoreAllMocks()
  })

  async function capture(): Promise<string> {
    const photoId = newId()
    bytes.set(photoId, new Blob(['x'], { type: 'image/webp' }))
    await captureCategoryPhoto(db, categoryId, photoId, 'image/webp')
    return photoId
  }

  it('uploads a local_only photo, then records blob_key and clears the flag', async () => {
    const photoId = await capture()
    requestUploadUrl.mockResolvedValue({
      blob_key: `user-1/${photoId}`,
      upload_url: 'https://blob.test/put',
      expires_at: '2026-01-01T00:00:00Z',
    })
    putBlobBytes.mockResolvedValue(undefined)

    stop = startUploadQueue(db, () => 'token')
    await settle()

    const photo = await db.photos.findOne(photoId).exec()
    expect(photo?.blob_key).toBe(`user-1/${photoId}`)
    expect(photo?.local_only).toBe(false)
    // Bytes are kept as this device's offline copy, just now evictable.
    expect(uploaded.has(photoId)).toBe(true)
    expect(putBlobBytes).toHaveBeenCalledWith('https://blob.test/put', bytes.get(photoId))
  })

  it('leaves the photo pending (to retry) when the upload fails', async () => {
    const photoId = await capture()
    requestUploadUrl.mockRejectedValue(new Error('offline'))

    stop = startUploadQueue(db, () => 'token')
    await settle()

    const photo = await db.photos.findOne(photoId).exec()
    expect(photo?.local_only).toBe(true)
    expect(photo?.blob_key).toBeNull()
  })

  it('does not reach the network while offline', async () => {
    vi.spyOn(navigator, 'onLine', 'get').mockReturnValue(false)
    const photoId = await capture()

    stop = startUploadQueue(db, () => 'token')
    await settle()

    expect(requestUploadUrl).not.toHaveBeenCalled()
    expect((await db.photos.findOne(photoId).exec())?.local_only).toBe(true)
  })

  it('soft-deletes a local_only photo whose bytes are gone', async () => {
    // `local_only` + no bytes can only mean this device captured it and the
    // browser evicted the only copy. It can never be uploaded and no other
    // device can supply it, so it must not linger as forever-pending.
    const photoId = newId()
    await captureCategoryPhoto(db, categoryId, photoId, 'image/webp')

    stop = startUploadQueue(db, () => 'token')
    await settle()

    expect(requestUploadUrl).not.toHaveBeenCalled()
    expect(await db.photos.findOne(photoId).exec()).toBeNull()
  })

  it('takes the orphaned photo out of the pending set rather than retrying it', async () => {
    const photoId = newId()
    await captureCategoryPhoto(db, categoryId, photoId, 'image/webp')

    stop = startUploadQueue(db, () => 'token')
    await settle()

    // The whole point of the old flag-clear: it must not spin. A soft-deleted
    // doc drops out of the drain selector, so the queue has nothing pending.
    expect(await db.photos.find({ selector: { local_only: true } }).exec()).toHaveLength(0)
  })

  it('drops the auto-created LoadItem and decrements the category count', async () => {
    const photoId = newId()
    const loadItemId = await captureCategoryPhoto(db, categoryId, photoId, 'image/webp')
    expect((await db.load_item_categories.findOne(categoryId).exec())?.count_sent).toBe(1)

    stop = startUploadQueue(db, () => 'token')
    await settle()

    // The item's only evidence was the photo, so it goes too (spec §4.4) —
    // otherwise the count would keep claiming a piece nobody can show.
    expect(await db.load_items.findOne(loadItemId).exec()).toBeNull()
    expect((await db.load_item_categories.findOne(categoryId).exec())?.count_sent).toBe(0)
  })

  it('leaves an uploadable photo untouched while orphaning the byteless one', async () => {
    const orphanId = newId()
    await captureCategoryPhoto(db, categoryId, orphanId, 'image/webp')
    const goodId = await capture()
    requestUploadUrl.mockResolvedValue({
      blob_key: `user-1/${goodId}`,
      upload_url: 'https://blob.test/put',
      expires_at: '2026-01-01T00:00:00Z',
    })
    putBlobBytes.mockResolvedValue(undefined)

    stop = startUploadQueue(db, () => 'token')
    await settle()

    expect(await db.photos.findOne(orphanId).exec()).toBeNull()
    const good = await db.photos.findOne(goodId).exec()
    expect(good?.blob_key).toBe(`user-1/${goodId}`)
    expect(good?.local_only).toBe(false)
  })
})
