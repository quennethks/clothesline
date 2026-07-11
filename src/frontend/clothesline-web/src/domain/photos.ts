import type { ClotheslineDatabase } from '../db'
import type { PhotoLinkDocType } from '../db/schemas/photoLinks.schema'
import { newId, nowIso } from './shared'

// The RxDB document side of a photo (spec §8.1) — the Photo/PhotoLink/LoadItem
// docs, which replicate through /sync like everything else. The image *bytes*
// are the other half and travel a separate path entirely (photos/byteStore.ts
// → photos/uploadQueue.ts → Blob); nothing in this module touches them, so it
// stays testable against an in-memory RxDB.

// The photo id is supplied by the caller rather than minted here: the image
// bytes must already be in the local byte store before the doc exists, or the
// upload queue — which wakes on the doc's insert — can race ahead of them
// (photos/capture.ts owns that ordering).

/**
 * The load's bundle photo (PRD §4.5) — links to the load itself and is the
 * `is_primary` one, so it doubles as the home-card thumbnail (spec §4.1).
 */
export async function captureLoadPhoto(
  db: ClotheslineDatabase,
  loadId: string,
  photoId: string,
  contentType: string,
): Promise<void> {
  const timestamp = nowIso()

  await db.photos.insert({
    id: photoId,
    blob_key: null,
    content_type: contentType,
    local_only: true,
    created_at: timestamp,
    updated_at: timestamp,
    _deleted: false,
  })
  await db.photo_links.insert({
    id: newId(),
    photo_id: photoId,
    entity_type: 'load',
    entity_id: loadId,
    is_primary: true,
    created_at: timestamp,
    updated_at: timestamp,
    _deleted: false,
  })
}

/**
 * A category photo. Each capture auto-creates its own `LoadItem` — the
 * individual piece being photographed — and the photo links to *that*, not to
 * the category (spec §4.4). So one photo == one item, and while the category
 * is still in `auto` mode the item count is what drives `count_sent`.
 */
export async function captureCategoryPhoto(
  db: ClotheslineDatabase,
  categoryId: string,
  photoId: string,
  contentType: string,
): Promise<string> {
  const category = await db.load_item_categories.findOne(categoryId).exec()
  if (!category) throw new Error(`Category ${categoryId} not found`)

  const loadItemId = newId()
  const timestamp = nowIso()

  await db.load_items.insert({
    id: loadItemId,
    load_item_category_id: categoryId,
    name: category.category,
    created_at: timestamp,
    updated_at: timestamp,
    _deleted: false,
  })
  await db.photos.insert({
    id: photoId,
    blob_key: null,
    content_type: contentType,
    local_only: true,
    created_at: timestamp,
    updated_at: timestamp,
    _deleted: false,
  })
  await db.photo_links.insert({
    id: newId(),
    photo_id: photoId,
    entity_type: 'load_item',
    entity_id: loadItemId,
    is_primary: true,
    created_at: timestamp,
    updated_at: timestamp,
    _deleted: false,
  })

  // Manual is sticky and one-way (spec §4.4): once the user has taken the
  // counter over for this category, photos still create items but never move
  // the count again.
  if (category.count_mode === 'auto') {
    await category.incrementalPatch({
      count_sent: category.count_sent + 1,
      updated_at: nowIso(),
    })
  }

  return loadItemId
}

/**
 * Soft-deletes the photo, its links, and any LoadItem the photo was the whole
 * reason for — decrementing the owning category's auto count (floored at 0).
 */
export async function deletePhoto(db: ClotheslineDatabase, photoId: string): Promise<void> {
  const links = await db.photo_links.find({ selector: { photo_id: photoId } }).exec()
  const timestamp = nowIso()

  for (const link of links) {
    await link.incrementalPatch({ _deleted: true, updated_at: timestamp })
    if (link.entity_type === 'load_item') {
      await deleteLoadItem(db, link.entity_id)
    }
  }

  const photo = await db.photos.findOne(photoId).exec()
  await photo?.incrementalPatch({ _deleted: true, updated_at: timestamp })
}

async function deleteLoadItem(db: ClotheslineDatabase, loadItemId: string): Promise<void> {
  const item = await db.load_items.findOne(loadItemId).exec()
  if (!item) return
  await item.incrementalPatch({ _deleted: true, updated_at: nowIso() })

  const category = await db.load_item_categories.findOne(item.load_item_category_id).exec()
  if (category?.count_mode === 'auto') {
    await category.incrementalPatch({
      count_sent: Math.max(0, category.count_sent - 1),
      updated_at: nowIso(),
    })
  }
}

export async function findLoadPhotoLink(
  db: ClotheslineDatabase,
  loadId: string,
): Promise<PhotoLinkDocType | undefined> {
  const links = await db.photo_links
    .find({ selector: { entity_type: 'load', entity_id: loadId } })
    .exec()
  return links[0]?.toJSON() as PhotoLinkDocType | undefined
}

/**
 * Every photo hanging off a load, however it's attached — the load itself, one
 * of its categories, or one of the items under those (spec §6.2: the gallery
 * joins load → categories → items → photos). Returned newest-first.
 */
export async function findLoadPhotoLinks(
  db: ClotheslineDatabase,
  loadId: string,
): Promise<PhotoLinkDocType[]> {
  const categories = await db.load_item_categories.find({ selector: { load_id: loadId } }).exec()
  const categoryIds = categories.map((category) => category.id)
  const items = await db.load_items
    .find({ selector: { load_item_category_id: { $in: categoryIds } } })
    .exec()

  const entityIds = [loadId, ...categoryIds, ...items.map((item) => item.id)]
  const links = await db.photo_links.find({ selector: { entity_id: { $in: entityIds } } }).exec()

  return links
    .map((link) => link.toJSON() as PhotoLinkDocType)
    .sort((a, b) => b.created_at.localeCompare(a.created_at))
}

/** The category a photo belongs to, for grouping the gallery. */
export async function categoryIdForLink(
  db: ClotheslineDatabase,
  link: PhotoLinkDocType,
): Promise<string | undefined> {
  if (link.entity_type === 'load_item_category') return link.entity_id
  if (link.entity_type !== 'load_item') return undefined
  const item = await db.load_items.findOne(link.entity_id).exec()
  return item?.load_item_category_id
}
