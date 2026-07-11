import type { ClotheslineDatabase } from '../db'
import {
  captureCategoryPhoto,
  captureLoadPhoto,
  deletePhoto,
  findLoadPhotoLink,
} from '../domain/photos'
import { newId } from '../domain/shared'
import { deleteBytes, putBytes } from './byteStore'
import { compressToWebP, PHOTO_CONTENT_TYPE } from './compress'

// Where the two halves of a photo meet (spec §8.1): compress → stash the bytes
// locally → write the docs. Identical online and offline — nothing here awaits
// the network. The bytes land *before* the docs on purpose: the upload queue
// wakes on the photo doc's insert, and would otherwise find a doc whose bytes
// hadn't been written yet.

export async function capturePhotoForLoad(
  db: ClotheslineDatabase,
  loadId: string,
  file: Blob,
): Promise<string> {
  // One photo per entity is app-enforced (spec §4.1), so a second bundle photo
  // replaces the first rather than piling up.
  const existing = await findLoadPhotoLink(db, loadId)
  if (existing) await removePhoto(db, existing.photo_id)

  const photoId = newId()
  await putBytes(photoId, await compressToWebP(file), false)
  await captureLoadPhoto(db, loadId, photoId, PHOTO_CONTENT_TYPE)
  return photoId
}

export async function capturePhotoForCategory(
  db: ClotheslineDatabase,
  categoryId: string,
  file: Blob,
): Promise<string> {
  const photoId = newId()
  await putBytes(photoId, await compressToWebP(file), false)
  await captureCategoryPhoto(db, categoryId, photoId, PHOTO_CONTENT_TYPE)
  return photoId
}

export async function removePhoto(db: ClotheslineDatabase, photoId: string): Promise<void> {
  await deletePhoto(db, photoId)
  await deleteBytes(photoId)
}
