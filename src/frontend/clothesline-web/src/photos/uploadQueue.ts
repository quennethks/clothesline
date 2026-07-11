import type { ClotheslineDatabase } from '../db'
import { nowIso } from '../domain/shared'
import { getBytes, markUploaded } from './byteStore'
import { putBlobBytes, requestUploadUrl } from './mediaApi'
import { PHOTO_CONTENT_TYPE } from './compress'

// The upload half of the byte plumbing we own (spec §8.2) — RxDB replicates
// the photo *documents* for us, but nothing carries the bytes, so this worker
// does: whenever we're online, every photo still flagged `local_only` gets a
// SAS URL, is PUT straight to Blob, and then has its `blob_key` written back
// as a normal RxDB write (which replication then syncs, telling every other
// device the bytes exist).

const POLL_INTERVAL_MS = 15_000
const BASE_BACKOFF_MS = 5_000
const MAX_BACKOFF_MS = 5 * 60_000

interface Failure {
  attempts: number
  retryAfter: number
}

export function startUploadQueue(
  db: ClotheslineDatabase,
  getToken: () => string | undefined,
): () => void {
  const failures = new Map<string, Failure>()
  let draining = false
  let stopped = false

  async function uploadOne(photoId: string, contentType: string): Promise<void> {
    const bytes = await getBytes(photoId)
    if (!bytes) {
      // A `local_only` doc with no bytes on this device can only be a doc
      // that replicated in from another device before that device drained
      // its own queue (its `local_only` doesn't travel — spec §8.1 — but a
      // stale local flag could otherwise spin here forever). Nothing to
      // upload; let the other device's queue do it.
      const photo = await db.photos.findOne(photoId).exec()
      await photo?.incrementalPatch({ local_only: false })
      return
    }

    const target = await requestUploadUrl(photoId, contentType || PHOTO_CONTENT_TYPE, getToken())
    await putBlobBytes(target.upload_url, bytes)

    const photo = await db.photos.findOne(photoId).exec()
    await photo?.incrementalPatch({
      blob_key: target.blob_key,
      local_only: false,
      updated_at: nowIso(),
    })
    // Bytes are kept, not deleted — they're this device's offline copy from
    // here on (spec §8.2 step 4), just now evictable under LRU (spec §8.3).
    await markUploaded(photoId)
  }

  async function drain(): Promise<void> {
    if (draining || stopped || !navigator.onLine) return
    draining = true
    try {
      const pending = await db.photos.find({ selector: { local_only: true } }).exec()
      for (const photo of pending) {
        const failure = failures.get(photo.id)
        if (failure && Date.now() < failure.retryAfter) continue
        try {
          await uploadOne(photo.id, photo.content_type ?? PHOTO_CONTENT_TYPE)
          failures.delete(photo.id)
        } catch {
          const attempts = (failure?.attempts ?? 0) + 1
          const backoff = Math.min(BASE_BACKOFF_MS * 2 ** (attempts - 1), MAX_BACKOFF_MS)
          failures.set(photo.id, { attempts, retryAfter: Date.now() + backoff })
        }
      }
    } finally {
      draining = false
    }
  }

  void drain()
  const interval = setInterval(() => void drain(), POLL_INTERVAL_MS)
  const onOnline = () => {
    // Reconnecting clears the backoff — the failures were almost certainly
    // the offline-ness itself, and the user expects an immediate drain.
    failures.clear()
    void drain()
  }
  window.addEventListener('online', onOnline)

  // A capture while already online shouldn't wait out the poll interval.
  const subscription = db.photos.insert$.subscribe(() => void drain())

  return () => {
    stopped = true
    clearInterval(interval)
    window.removeEventListener('online', onOnline)
    subscription.unsubscribe()
  }
}
