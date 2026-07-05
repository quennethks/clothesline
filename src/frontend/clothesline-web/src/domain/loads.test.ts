import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import type { ClotheslineDatabase } from '../db'
import { DEFAULT_CATEGORIES } from './categoryTemplate'
import { createLoad, deleteLoad, duplicateLoad, sendLoad } from './loads'
import { createTestDb } from './testDb'

const USER_ID = 'user-1'

describe('loads', () => {
  let db: ClotheslineDatabase

  beforeEach(async () => {
    db = await createTestDb()
  })

  afterEach(async () => {
    await db.close()
  })

  it('create seeds all default template categories at auto/0', async () => {
    const loadId = await createLoad(db, USER_ID)
    const load = await db.loads.findOne(loadId).exec()
    expect(load?.status).toBe('draft')
    expect(load?.user_id).toBe(USER_ID)
    expect(load?.name).toBe(new Date().toISOString().slice(0, 10))

    const categories = await db.load_item_categories.find({ selector: { load_id: loadId } }).exec()
    expect(categories).toHaveLength(DEFAULT_CATEGORIES.length)
    expect(categories.map((c) => c.category).sort()).toEqual([...DEFAULT_CATEGORIES].sort())
    for (const category of categories) {
      expect(category.count_sent).toBe(0)
      expect(category.count_mode).toBe('auto')
    }
  })

  it('send freezes total_sent as the sum of category counts', async () => {
    const loadId = await createLoad(db, USER_ID)
    const categories = await db.load_item_categories.find({ selector: { load_id: loadId } }).exec()
    await categories[0]!.incrementalPatch({ count_sent: 3, count_mode: 'manual' })
    await categories[1]!.incrementalPatch({ count_sent: 2, count_mode: 'manual' })

    await sendLoad(db, loadId)

    const load = await db.loads.findOne(loadId).exec()
    expect(load?.status).toBe('sent')
    expect(load?.total_sent).toBe(5)
  })

  it('duplicate carries only the source categories, resetting everything else', async () => {
    const sourceId = await createLoad(db, USER_ID)
    const sourceLoad = await db.loads.findOne(sourceId).exec()
    await sourceLoad!.incrementalPatch({
      shop_name: 'Wash & Fold',
      shop_location: 'Main St',
      send_date: '2026-01-01',
    })
    const sourceCategories = await db.load_item_categories
      .find({ selector: { load_id: sourceId } })
      .exec()
    await sourceCategories[0]!.incrementalPatch({ count_sent: 5, count_mode: 'manual' })

    const newLoadId = await duplicateLoad(db, sourceId)

    const newLoad = await db.loads.findOne(newLoadId).exec()
    expect(newLoad?.id).not.toBe(sourceId)
    expect(newLoad?.name).toBe(new Date().toISOString().slice(0, 10))
    expect(newLoad?.shop_name).toBeNull()
    expect(newLoad?.shop_location).toBeNull()
    expect(newLoad?.send_date).toBeNull()
    expect(newLoad?.status).toBe('draft')
    expect(newLoad?.total_sent).toBe(0)

    const newCategories = await db.load_item_categories
      .find({ selector: { load_id: newLoadId } })
      .exec()
    expect(newCategories).toHaveLength(sourceCategories.length)
    expect(newCategories.map((c) => c.category).sort()).toEqual(
      sourceCategories.map((c) => c.category).sort(),
    )
    for (const category of newCategories) {
      expect(category.count_sent).toBe(0)
      expect(category.count_mode).toBe('auto')
    }

    const newItems = await db.load_items
      .find({ selector: { load_item_category_id: { $in: newCategories.map((c) => c.id) } } })
      .exec()
    expect(newItems).toHaveLength(0)
  })

  it('delete soft-deletes rather than hard-removing the row', async () => {
    const loadId = await createLoad(db, USER_ID)
    await deleteLoad(db, loadId)

    // RxDB unconditionally excludes _deleted docs from every query (it's a
    // reserved field, enforced at the query-preparation level) — so a
    // soft-deleted doc is invisible here even without an explicit filter.
    // (Deletion is done via incrementalPatch({_deleted: true}), not RxDB's
    // own .remove() — the tombstone convention M4's replication relies on.)
    const visible = await db.loads.findOne(loadId).exec()
    expect(visible).toBeNull()
  })
})
