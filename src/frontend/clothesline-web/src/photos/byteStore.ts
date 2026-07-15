// The local cache of photo *bytes* (spec §8.1) — the half of a photo that
// RxDB never carries. A plain IndexedDB store, separate from RxDB's own, keyed
// by photo_id: bytes are written here on capture (before any network exists),
// drained to Blob by the upload queue, and kept afterwards as this device's
// offline copy (spec §8.2 step 4).

const DB_NAME = 'clothesline-photo-bytes'
const DB_VERSION = 1
const STORE = 'bytes'

// Budget for *uploaded* bytes only. Un-uploaded bytes are the only copy in
// existence and are never counted against it or evicted (spec §8.3).
export const CACHE_BUDGET_BYTES = 150 * 1024 * 1024

// The bound on the *un-uploaded* pile, which the cache budget above does not
// guard (spec §5.2). It must stay **below** CACHE_BUDGET_BYTES: trimCache sums
// every entry but evicts only uploaded ones, so a pending pile near 150MB makes
// it evict the entire offline cache and still finish over budget. 100MB leaves
// ~50MB of headroom in which the uploaded cache can still exist.
export const PENDING_BUDGET_BYTES = 100 * 1024 * 1024

export interface StoredBytes {
  photo_id: string
  blob: Blob
  /** Mirrors the inverse of the doc's `local_only`: false = bytes exist only here. */
  uploaded: boolean
  /** Drives least-recently-used eviction (spec §8.3). */
  last_viewed_at: number
}

let dbPromise: Promise<IDBDatabase> | undefined

function openDb(): Promise<IDBDatabase> {
  if (!dbPromise) {
    dbPromise = new Promise((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, DB_VERSION)
      request.onupgradeneeded = () => {
        const store = request.result.createObjectStore(STORE, { keyPath: 'photo_id' })
        store.createIndex('last_viewed_at', 'last_viewed_at')
      }
      request.onsuccess = () => resolve(request.result)
      request.onerror = () => reject(request.error)
    })
  }
  return dbPromise
}

function run<T>(mode: IDBTransactionMode, work: (store: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  return openDb().then(
    (db) =>
      new Promise<T>((resolve, reject) => {
        const transaction = db.transaction(STORE, mode)
        const request = work(transaction.objectStore(STORE))
        request.onsuccess = () => resolve(request.result)
        request.onerror = () => reject(request.error)
      }),
  )
}

export async function putBytes(photoId: string, blob: Blob, uploaded: boolean): Promise<void> {
  await run('readwrite', (store) =>
    store.put({ photo_id: photoId, blob, uploaded, last_viewed_at: Date.now() } satisfies StoredBytes),
  )
  if (uploaded) await trimCache()
}

/** Returns the bytes and touches their LRU timestamp — this *is* "a view". */
export async function getBytes(photoId: string): Promise<Blob | undefined> {
  const entry = await run<StoredBytes | undefined>('readonly', (store) => store.get(photoId))
  if (!entry) return undefined
  await run('readwrite', (store) => store.put({ ...entry, last_viewed_at: Date.now() }))
  return entry.blob
}

/**
 * Total bytes of entries not yet drained to Blob — the un-uploaded pile the
 * batch guard checks against PENDING_BUDGET_BYTES (spec §5.2). The `uploaded`
 * flag is already stored per entry, so this is a getAll + filter + sum.
 */
export async function pendingBytes(): Promise<number> {
  const entries = await run<StoredBytes[]>('readonly', (store) => store.getAll())
  return entries
    .filter((entry) => !entry.uploaded)
    .reduce((sum, entry) => sum + entry.blob.size, 0)
}

export async function markUploaded(photoId: string): Promise<void> {
  const entry = await run<StoredBytes | undefined>('readonly', (store) => store.get(photoId))
  if (!entry) return
  await run('readwrite', (store) => store.put({ ...entry, uploaded: true }))
  await trimCache()
}

export async function deleteBytes(photoId: string): Promise<void> {
  await run('readwrite', (store) => store.delete(photoId))
}

/**
 * Evicts least-recently-viewed entries until the cache is back under budget.
 * **Only uploaded bytes are ever evicted** — a photo captured offline and not
 * yet drained to Blob is the only copy there is (spec §8.3).
 */
export async function trimCache(): Promise<void> {
  const entries = await run<StoredBytes[]>('readonly', (store) => store.getAll())
  const evictable = entries
    .filter((entry) => entry.uploaded)
    .sort((a, b) => a.last_viewed_at - b.last_viewed_at)

  let total = entries.reduce((sum, entry) => sum + entry.blob.size, 0)
  for (const entry of evictable) {
    if (total <= CACHE_BUDGET_BYTES) return
    await deleteBytes(entry.photo_id)
    total -= entry.blob.size
  }
}
