import type { ClotheslineDatabase } from '../db'
import { nowIso } from '../domain/shared'
import { getBytes, markUploaded } from './byteStore'
import { removePhoto } from './capture'
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
      // `local_only` means *this* device captured it and is the only place the
      // bytes ever existed — a doc that replicated in arrives `local_only:
      // false` (the flag never travels, and the pull modifier defaults it), so
      // it never reaches here. Missing bytes therefore aren't "not yet mine to
      // upload"; they're gone — evicted by the browser under storage pressure,
      // most often on a phone. There is nothing left to upload and no other
      // copy to fetch, so the photo is unrecoverable rather than pending.
      //
      // Clearing `local_only` instead would strand it: it would drop out of the
      // drain query forever with a null `blob_key`, leaving every other device
      // showing "Waiting to upload" for bytes that are never coming, while this
      // one reported "Synced". Soft-delete it so the loss replicates honestly —
      // this also drops the auto-created LoadItem and decrements the category's
      // count, since that item's only evidence was the photo (spec §4.4).
      await removePhoto(db, photoId)
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
