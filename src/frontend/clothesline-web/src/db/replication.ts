import { replicateRxCollection } from 'rxdb/plugins/replication'
import type { RxReplicationState } from 'rxdb/plugins/replication'
import type { ClotheslineDatabase } from './index'
import type { LoadDocType } from './schemas/loads.schema'
import type { LoadItemCategoryDocType } from './schemas/loadItemCategories.schema'
import type { LoadItemDocType } from './schemas/loadItems.schema'
import type { PhotoDocType } from './schemas/photos.schema'
import type { PhotoLinkDocType } from './schemas/photoLinks.schema'
import {
  createPullHandler,
  createPushHandler,
  defaultLocalOnly,
  stripLocalOnly,
  type SyncCheckpoint,
} from './pullPushHandlers'

// MVP has no live pull-stream (deferred to Phase 3, spec §7.8) — an
// explicit interval covers "pull-on-reconnect + interval polling" instead.
const RESYNC_INTERVAL_MS = 30_000

// Written out per-collection (rather than looped over a union of names) so
// each replicateRxCollection call keeps its own concrete RxDocType instead
// of collapsing to `unknown` across a heterogeneous array.
export function startReplication(
  db: ClotheslineDatabase,
  getToken: () => string | undefined,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
): RxReplicationState<any, SyncCheckpoint>[] {
  const loads = replicateRxCollection({
    collection: db.loads,
    replicationIdentifier: 'clothesline-sync-loads',
    live: true,
    deletedField: '_deleted',
    pull: { handler: createPullHandler<LoadDocType>('loads', getToken) },
    push: { handler: createPushHandler<LoadDocType>('loads', getToken) },
  })

  const loadItemCategories = replicateRxCollection({
    collection: db.load_item_categories,
    replicationIdentifier: 'clothesline-sync-load_item_categories',
    live: true,
    deletedField: '_deleted',
    pull: {
      handler: createPullHandler<LoadItemCategoryDocType>('load_item_categories', getToken),
    },
    push: {
      handler: createPushHandler<LoadItemCategoryDocType>('load_item_categories', getToken),
    },
  })

  const loadItems = replicateRxCollection({
    collection: db.load_items,
    replicationIdentifier: 'clothesline-sync-load_items',
    live: true,
    deletedField: '_deleted',
    pull: { handler: createPullHandler<LoadItemDocType>('load_items', getToken) },
    push: { handler: createPushHandler<LoadItemDocType>('load_items', getToken) },
  })

  const photos = replicateRxCollection({
    collection: db.photos,
    replicationIdentifier: 'clothesline-sync-photos',
    live: true,
    deletedField: '_deleted',
    pull: {
      handler: createPullHandler<PhotoDocType>('photos', getToken),
      modifier: defaultLocalOnly,
    },
    push: {
      handler: createPushHandler<PhotoDocType>('photos', getToken),
      modifier: stripLocalOnly,
    },
  })

  const photoLinks = replicateRxCollection({
    collection: db.photo_links,
    replicationIdentifier: 'clothesline-sync-photo_links',
    live: true,
    deletedField: '_deleted',
    pull: { handler: createPullHandler<PhotoLinkDocType>('photo_links', getToken) },
    push: { handler: createPushHandler<PhotoLinkDocType>('photo_links', getToken) },
  })

  const states = [loads, loadItemCategories, loadItems, photos, photoLinks]
  for (const state of states) {
    const intervalId = setInterval(() => state.reSync(), RESYNC_INTERVAL_MS)
    const originalCancel = state.cancel.bind(state)
    state.cancel = () => {
      clearInterval(intervalId)
      return originalCancel()
    }
  }
  return states
}
