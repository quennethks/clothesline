import {
  addRxPlugin,
  createRxDatabase,
  type RxCollection,
  type RxDatabase,
  type RxStorage,
} from 'rxdb'
import { getRxStorageDexie } from 'rxdb/plugins/storage-dexie'
import { wrappedValidateAjvStorage } from 'rxdb/plugins/validate-ajv'
import { loadSchema, type LoadDocType } from './schemas/loads.schema'
import {
  loadItemCategorySchema,
  type LoadItemCategoryDocType,
} from './schemas/loadItemCategories.schema'
import { loadItemSchema, type LoadItemDocType } from './schemas/loadItems.schema'
import { photoSchema, type PhotoDocType } from './schemas/photos.schema'
import { photoLinkSchema, type PhotoLinkDocType } from './schemas/photoLinks.schema'

export type ClotheslineCollections = {
  loads: RxCollection<LoadDocType>
  load_item_categories: RxCollection<LoadItemCategoryDocType>
  load_items: RxCollection<LoadItemDocType>
  photos: RxCollection<PhotoDocType>
  photo_links: RxCollection<PhotoLinkDocType>
}

export type ClotheslineDatabase = RxDatabase<ClotheslineCollections>

const collectionSchemas = {
  loads: { schema: loadSchema },
  load_item_categories: { schema: loadItemCategorySchema },
  load_items: { schema: loadItemSchema },
  photos: { schema: photoSchema },
  photo_links: { schema: photoLinkSchema },
}

// Exported so tests can build an isolated database over an in-memory
// storage (spec §10.2) instead of the real Dexie/IndexedDB one below.
export async function createClotheslineDatabase<Internals, InstanceCreationOptions>(
  name: string,
  storage: RxStorage<Internals, InstanceCreationOptions>,
): Promise<ClotheslineDatabase> {
  const db = await createRxDatabase<ClotheslineCollections>({ name, storage })
  await db.addCollections(collectionSchemas)
  return db
}

let dbPromise: Promise<ClotheslineDatabase> | undefined

export function getDb(): Promise<ClotheslineDatabase> {
  if (!dbPromise) {
    dbPromise = (async () => {
      // AJV schema validation only in dev — real IndexedDB storage (Dexie)
      // is RxDB's free/community storage engine; the premium engines
      // (OPFS/SQLite) require a license.
      const dexieStorage = getRxStorageDexie()
      if (!import.meta.env.DEV) {
        return createClotheslineDatabase('clothesline', dexieStorage)
      }
      const { RxDBDevModePlugin } = await import('rxdb/plugins/dev-mode')
      addRxPlugin(RxDBDevModePlugin)
      return createClotheslineDatabase(
        'clothesline',
        wrappedValidateAjvStorage({ storage: dexieStorage }),
      )
    })()
  }
  return dbPromise
}
