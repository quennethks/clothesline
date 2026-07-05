import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import type { ClotheslineDatabase } from '../db'
import { createLoad, sendLoad } from './loads'
import { submitReceivedTotal } from './receive'
import { createTestDb } from './testDb'

async function createSentLoad(db: ClotheslineDatabase, totalSent: number): Promise<string> {
  const loadId = await createLoad(db, 'user-1')
  const categories = await db.load_item_categories.find({ selector: { load_id: loadId } }).exec()
  await categories[0]!.incrementalPatch({ count_sent: totalSent, count_mode: 'manual' })
  await sendLoad(db, loadId)
  return loadId
}

describe('receive', () => {
  let db: ClotheslineDatabase

  beforeEach(async () => {
    db = await createTestDb()
  })

  afterEach(async () => {
    await db.close()
  })

  it('match closes the load', async () => {
    const loadId = await createSentLoad(db, 5)
    const outcome = await submitReceivedTotal(db, loadId, 5)
    expect(outcome).toBe('matched')

    const load = await db.loads.findOne(loadId).exec()
    expect(load?.status).toBe('closed')
    expect(load?.total_received).toBe(5)
  })

  it('mismatch keeps the load open for the per-category check', async () => {
    const loadId = await createSentLoad(db, 5)
    const outcome = await submitReceivedTotal(db, loadId, 3)
    expect(outcome).toBe('mismatch')

    const load = await db.loads.findOne(loadId).exec()
    expect(load?.status).toBe('sent')
    expect(load?.total_received).toBe(3)
  })

  it('surplus (received > sent) is accepted without error', async () => {
    const loadId = await createSentLoad(db, 5)
    const outcome = await submitReceivedTotal(db, loadId, 8)
    expect(outcome).toBe('mismatch')

    const load = await db.loads.findOne(loadId).exec()
    expect(load?.total_received).toBe(8)
  })

  it('skip routes to the same per-category check without setting total_received', async () => {
    const loadId = await createSentLoad(db, 5)
    const outcome = await submitReceivedTotal(db, loadId, null)
    expect(outcome).toBe('skipped')

    const load = await db.loads.findOne(loadId).exec()
    expect(load?.status).toBe('sent')
    expect(load?.total_received).toBeNull()
  })
})
