import type { ClotheslineDatabase } from '../db'
import { DEFAULT_CATEGORIES } from './categoryTemplate'
import { newId, nowIso, todayDateName } from './shared'

export async function createLoad(db: ClotheslineDatabase, userId: string): Promise<string> {
  const loadId = newId()
  const timestamp = nowIso()

  await db.loads.insert({
    id: loadId,
    user_id: userId,
    name: todayDateName(),
    shop_name: null,
    shop_location: null,
    send_date: null,
    status: 'draft',
    total_sent: 0,
    total_received: null,
    reconciled: false,
    created_at: timestamp,
    updated_at: timestamp,
    _deleted: false,
  })

  await db.load_item_categories.bulkInsert(
    DEFAULT_CATEGORIES.map((category) => ({
      id: newId(),
      load_id: loadId,
      category,
      count_sent: 0,
      count_received: null,
      count_mode: 'auto' as const,
      created_at: timestamp,
      updated_at: timestamp,
      _deleted: false,
    })),
  )

  return loadId
}

// Duplicate carries the source load's category set only (spec §5.3) —
// everything else (name, shop fields, counts, photos) resets. This is the
// only reuse path for one-load-only custom categories (spec §4.3).
export async function duplicateLoad(db: ClotheslineDatabase, sourceLoadId: string): Promise<string> {
  const sourceCategories = await db.load_item_categories
    .find({ selector: { load_id: sourceLoadId } })
    .exec()

  const newLoadId = newId()
  const timestamp = nowIso()

  await db.loads.insert({
    id: newLoadId,
    user_id: (await db.loads.findOne(sourceLoadId).exec())!.user_id,
    name: todayDateName(),
    shop_name: null,
    shop_location: null,
    send_date: null,
    status: 'draft',
    total_sent: 0,
    total_received: null,
    reconciled: false,
    created_at: timestamp,
    updated_at: timestamp,
    _deleted: false,
  })

  await db.load_item_categories.bulkInsert(
    sourceCategories.map((sourceCategory) => ({
      id: newId(),
      load_id: newLoadId,
      category: sourceCategory.category,
      count_sent: 0,
      count_received: null,
      count_mode: 'auto' as const,
      created_at: timestamp,
      updated_at: timestamp,
      _deleted: false,
    })),
  )

  return newLoadId
}

// Freezes total_sent = Σ count_sent (spec §4.6); the sent manifest becomes
// read-only thereafter (enforced server-side at push time in M4).
export async function sendLoad(db: ClotheslineDatabase, loadId: string): Promise<void> {
  const categories = await db.load_item_categories.find({ selector: { load_id: loadId } }).exec()
  const totalSent = categories.reduce((sum, category) => sum + category.count_sent, 0)

  const load = await db.loads.findOne(loadId).exec()
  if (!load) return
  await load.incrementalPatch({
    status: 'sent',
    total_sent: totalSent,
    updated_at: nowIso(),
  })
}

// Soft-delete → tombstone that syncs (spec §7); the only cleanup for
// abandoned drafts (spec §14 / PRD §7.2), works for a load of any status.
export async function deleteLoad(db: ClotheslineDatabase, loadId: string): Promise<void> {
  const load = await db.loads.findOne(loadId).exec()
  if (!load) return
  await load.incrementalPatch({ _deleted: true, updated_at: nowIso() })
}
