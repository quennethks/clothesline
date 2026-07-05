import type { ClotheslineDatabase } from '../db'
import { nowIso } from './shared'

// The per-category check writes only count_received — the sent tally stays
// read-only (spec §5.4). May be filled anytime, not only on a mismatch, and
// works on a reopened closed load too (the receive-side double-check,
// PRD §3.1(11)).
export async function setReceivedCount(
  db: ClotheslineDatabase,
  categoryId: string,
  value: number,
): Promise<void> {
  const category = await db.load_item_categories.findOne(categoryId).exec()
  if (!category) return
  await category.incrementalPatch({
    count_received: Math.max(0, value),
    updated_at: nowIso(),
  })
}

export async function closeLoad(db: ClotheslineDatabase, loadId: string): Promise<void> {
  const load = await db.loads.findOne(loadId).exec()
  if (!load) return
  await load.incrementalPatch({ status: 'closed', updated_at: nowIso() })
}
