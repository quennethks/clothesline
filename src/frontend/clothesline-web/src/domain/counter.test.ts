import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import type { ClotheslineDatabase } from '../db'
import { decrementCount, incrementCount, setCount } from './counter'
import { createLoad } from './loads'
import { createTestDb } from './testDb'

describe('counter', () => {
  let db: ClotheslineDatabase
  let categoryId: string

  beforeEach(async () => {
    db = await createTestDb()
    const loadId = await createLoad(db, 'user-1')
    const category = (await db.load_item_categories.find({ selector: { load_id: loadId } }).exec())[0]!
    categoryId = category.id
  })

  afterEach(async () => {
    await db.close()
  })

  it('first tap flips count_mode to manual permanently', async () => {
    await incrementCount(db, categoryId)
    let category = await db.load_item_categories.findOne(categoryId).exec()
    expect(category?.count_sent).toBe(1)
    expect(category?.count_mode).toBe('manual')

    await incrementCount(db, categoryId)
    category = await db.load_item_categories.findOne(categoryId).exec()
    expect(category?.count_sent).toBe(2)
    expect(category?.count_mode).toBe('manual')
  })

  it('decrement floors at 0 and also flips to manual', async () => {
    await decrementCount(db, categoryId)
    const category = await db.load_item_categories.findOne(categoryId).exec()
    expect(category?.count_sent).toBe(0)
    expect(category?.count_mode).toBe('manual')
  })

  it('direct number entry sets the count and flips to manual', async () => {
    await setCount(db, categoryId, 7)
    const category = await db.load_item_categories.findOne(categoryId).exec()
    expect(category?.count_sent).toBe(7)
    expect(category?.count_mode).toBe('manual')
  })
})
