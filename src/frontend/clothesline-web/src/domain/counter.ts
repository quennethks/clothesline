import type { ClotheslineDatabase } from '../db'
import { nowIso } from './shared'

// A category's first tap/number-entry flips count_mode to 'manual'
// permanently (spec §4.4) — one-way and sticky. From then on, photo capture
// (M6) still creates/removes LoadItems but never changes count_sent again.

export async function incrementCount(db: ClotheslineDatabase, categoryId: string): Promise<void> {
  const category = await db.load_item_categories.findOne(categoryId).exec()
  if (!category) return
  await category.incrementalPatch({
    count_sent: category.count_sent + 1,
    count_mode: 'manual',
    updated_at: nowIso(),
  })
}

export async function decrementCount(db: ClotheslineDatabase, categoryId: string): Promise<void> {
  const category = await db.load_item_categories.findOne(categoryId).exec()
  if (!category) return
  await category.incrementalPatch({
    count_sent: Math.max(0, category.count_sent - 1),
    count_mode: 'manual',
    updated_at: nowIso(),
  })
}

export async function setCount(
  db: ClotheslineDatabase,
  categoryId: string,
  value: number,
): Promise<void> {
  const category = await db.load_item_categories.findOne(categoryId).exec()
  if (!category) return
  await category.incrementalPatch({
    count_sent: Math.max(0, value),
    count_mode: 'manual',
    updated_at: nowIso(),
  })
}
