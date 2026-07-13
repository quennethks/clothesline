import type { ClotheslineDatabase } from '../db'
import { newId, nowIso } from './shared'

// Custom categories are free text (spec §4.3) — the server accepts any
// string, the template is a convenience default, not a closed allow-list.
export async function addCustomCategory(
  db: ClotheslineDatabase,
  loadId: string,
  categoryName: string,
): Promise<string> {
  const id = newId()
  const timestamp = nowIso()
  await db.load_item_categories.insert({
    id,
    load_id: loadId,
    category: categoryName,
    count_sent: 0,
    count_received: null,
    count_mode: 'auto',
    created_at: timestamp,
    updated_at: timestamp,
    _deleted: false,
  })
  return id
}

export async function removeCategory(db: ClotheslineDatabase, categoryId: string): Promise<void> {
  const category = await db.load_item_categories.findOne(categoryId).exec()
  if (!category) return
  await category.incrementalPatch({ _deleted: true, updated_at: nowIso() })
}
