import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import type { ClotheslineDatabase } from '../db'
import { createLoad, sendLoad } from './loads'
import { closeLoad, setReceivedCount } from './reconcile'
import { createTestDb } from './testDb'

describe('reconcile', () => {
  let db: ClotheslineDatabase
  let loadId: string
  let categoryId: string

  beforeEach(async () => {
    db = await createTestDb()
    loadId = await createLoad(db, 'user-1')
    const category = (await db.load_item_categories.find({ selector: { load_id: loadId } }).exec())[0]!
    await category.incrementalPatch({ count_sent: 4, count_mode: 'manual' })
    categoryId = category.id
    await sendLoad(db, loadId)
  })

  afterEach(async () => {
    await db.close()
  })

  it('writes only count_received, never touching count_sent', async () => {
    await setReceivedCount(db, categoryId, 3)
    const category = await db.load_item_categories.findOne(categoryId).exec()
    expect(category?.count_received).toBe(3)
    expect(category?.count_sent).toBe(4)
  })

  it('closeLoad transitions sent -> closed', async () => {
    await closeLoad(db, loadId)
    const load = await db.loads.findOne(loadId).exec()
    expect(load?.status).toBe('closed')
  })
})
