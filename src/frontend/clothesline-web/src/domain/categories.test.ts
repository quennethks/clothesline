import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import type { ClotheslineDatabase } from '../db'
import { addCustomCategory, removeCategory } from './categories'
import { createLoad } from './loads'
import { createTestDb } from './testDb'

describe('categories', () => {
  let db: ClotheslineDatabase
  let loadId: string

  beforeEach(async () => {
    db = await createTestDb()
    loadId = await createLoad(db, 'user-1')
  })

  afterEach(async () => {
    await db.close()
  })

  it('adds a free-text custom category at auto/0', async () => {
    const id = await addCustomCategory(db, loadId, "Grandma's Doilies")
    const category = await db.load_item_categories.findOne(id).exec()
    expect(category?.category).toBe("Grandma's Doilies")
    expect(category?.count_sent).toBe(0)
    expect(category?.count_mode).toBe('auto')
  })

  it('removes a category via soft delete (hidden, not hard-removed)', async () => {
    const id = await addCustomCategory(db, loadId, 'Scarves')
    await removeCategory(db, id)

    // Deletion is done via incrementalPatch({_deleted: true}), not RxDB's own
    // .remove() — the tombstone convention M4's replication relies on. RxDB
    // unconditionally excludes _deleted docs from every query, so the row is
    // invisible here even though it isn't hard-removed from local storage.
    const visible = await db.load_item_categories.findOne(id).exec()
    expect(visible).toBeNull()
  })
})
