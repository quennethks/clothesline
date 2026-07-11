import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import type { ClotheslineDatabase } from '../db'
import { incrementCount } from './counter'
import { createLoad } from './loads'
import {
  captureCategoryPhoto,
  captureLoadPhoto,
  deletePhoto,
  findLoadPhotoLink,
  findLoadPhotoLinks,
} from './photos'
import { newId } from './shared'
import { createTestDb } from './testDb'

const WEBP = 'image/webp'

describe('photos', () => {
  let db: ClotheslineDatabase
  let loadId: string
  let categoryId: string

  beforeEach(async () => {
    db = await createTestDb()
    loadId = await createLoad(db, 'user-1')
    const categories = await db.load_item_categories.find({ selector: { load_id: loadId } }).exec()
    categoryId = categories[0]!.id
  })

  afterEach(async () => {
    await db.close()
  })

  async function category() {
    return db.load_item_categories.findOne(categoryId).exec()
  }

  it('a category photo auto-creates a LoadItem and bumps the auto count', async () => {
    const photoId = newId()
    const loadItemId = await captureCategoryPhoto(db, categoryId, photoId, WEBP)

    const item = await db.load_items.findOne(loadItemId).exec()
    expect(item?.load_item_category_id).toBe(categoryId)
    expect(item?.name).toBe((await category())?.category)
    expect((await category())?.count_sent).toBe(1)

    const photo = await db.photos.findOne(photoId).exec()
    expect(photo?.local_only).toBe(true)
    expect(photo?.blob_key).toBeNull()

    const links = await db.photo_links.find({ selector: { photo_id: photoId } }).exec()
    expect(links[0]?.entity_type).toBe('load_item')
    expect(links[0]?.entity_id).toBe(loadItemId)
  })

  it('deleting a category photo removes its LoadItem and decrements the auto count', async () => {
    const photoId = newId()
    const loadItemId = await captureCategoryPhoto(db, categoryId, photoId, WEBP)
    expect((await category())?.count_sent).toBe(1)

    await deletePhoto(db, photoId)

    expect((await category())?.count_sent).toBe(0)
    expect(await db.load_items.findOne(loadItemId).exec()).toBeNull()
    expect(await db.photos.findOne(photoId).exec()).toBeNull()
    expect(await db.photo_links.find({ selector: { photo_id: photoId } }).exec()).toHaveLength(0)
  })

  it('never touches the count once the category is manual, but still creates items', async () => {
    // A single tap makes the takeover permanent (spec §4.4).
    await incrementCount(db, categoryId)
    expect((await category())?.count_sent).toBe(1)

    const photoId = newId()
    const loadItemId = await captureCategoryPhoto(db, categoryId, photoId, WEBP)
    expect((await category())?.count_sent).toBe(1)
    expect(await db.load_items.findOne(loadItemId).exec()).not.toBeNull()

    await deletePhoto(db, photoId)
    expect((await category())?.count_sent).toBe(1)
  })

  it('the auto count floors at 0', async () => {
    const photoId = newId()
    await captureCategoryPhoto(db, categoryId, photoId, WEBP)
    await deletePhoto(db, photoId)
    await deletePhoto(db, photoId)
    expect((await category())?.count_sent).toBe(0)
  })

  it('a load photo is the primary load-linked photo (the card thumbnail)', async () => {
    const photoId = newId()
    await captureLoadPhoto(db, loadId, photoId, WEBP)

    const link = await findLoadPhotoLink(db, loadId)
    expect(link?.photo_id).toBe(photoId)
    expect(link?.entity_type).toBe('load')
    expect(link?.is_primary).toBe(true)
    // The bundle photo creates no LoadItem and moves no count.
    expect(await db.load_items.find().exec()).toHaveLength(0)
    expect((await category())?.count_sent).toBe(0)
  })

  it('the gallery join finds photos attached to the load and to its items', async () => {
    const bundleId = newId()
    const itemPhotoId = newId()
    await captureLoadPhoto(db, loadId, bundleId, WEBP)
    await captureCategoryPhoto(db, categoryId, itemPhotoId, WEBP)

    const links = await findLoadPhotoLinks(db, loadId)
    expect(links.map((link) => link.photo_id).sort()).toEqual([bundleId, itemPhotoId].sort())
  })
})
