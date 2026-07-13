import { getRxStorageMemory } from 'rxdb/plugins/storage-memory'
import { createClotheslineDatabase, type ClotheslineDatabase } from '../db'

// In-memory RxDB storage for tests (spec §10.2) — jsdom has no native
// IndexedDB, and this avoids pulling in a fake-indexeddb polyfill.
export async function createTestDb(): Promise<ClotheslineDatabase> {
  return createClotheslineDatabase(`test-${crypto.randomUUID()}`, getRxStorageMemory())
}
