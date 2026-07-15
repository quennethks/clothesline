import { PENDING_BUDGET_BYTES, pendingBytes } from './byteStore'

// Every MVP photo came from the OS camera app, so the input was implicitly
// bounded: one normal photo at a time. Opening a file picker onto the user's
// disk removes that bound, and nothing downstream replaces it — compress.ts
// calls createImageBitmap(), which decodes the *entire* image into memory
// before the resize that was meant to make it small, so a 200MB scan takes the
// tab out with it. These checks therefore run **before any decode** (spec §5.1).

export const MAX_FILE_BYTES = 25 * 1024 * 1024
export const MAX_BATCH_FILES = 200

export const PENDING_FULL_MESSAGE =
  'You have a lot of photos waiting to upload. Connect to the internet to free up space.'

export interface RejectedFile {
  file: File
  reason: string
}

export interface ScreenedBatch {
  /** Set when the *whole* batch is refused; nothing is written. */
  refusal: string | null
  accepted: File[]
  /** Skipped, not fatal — these flow into the partial-failure report (spec §5.3). */
  rejected: RejectedFile[]
}

/** Why this one file cannot be decoded, or null if it can. */
export function screenFile(file: File): string | null {
  // accept="image/*" is a picker filter, not enforcement, and is trivially
  // bypassed — a .zip renamed .jpg should fail here, not inside the decoder.
  if (!file.type.startsWith('image/')) return `${file.name} isn't an image`
  if (file.size > MAX_FILE_BYTES) return `${file.name} is larger than 25 MB`
  return null
}

/**
 * The guard that actually protects the offline case (spec §5.2). Un-uploaded
 * bytes are never evicted — they are the only copy — so a per-gesture cap does
 * nothing to stop a user offline in a shop picking 200 photos, then 200 again,
 * until IndexedDB writes start failing. The cumulative weight is the real bound.
 */
export async function pendingBudgetRefusal(): Promise<string | null> {
  return (await pendingBytes()) >= PENDING_BUDGET_BYTES ? PENDING_FULL_MESSAGE : null
}

export async function screenBatch(files: File[]): Promise<ScreenedBatch> {
  if (files.length > MAX_BATCH_FILES) {
    return {
      refusal: `That's more than ${MAX_BATCH_FILES} photos at once. Try a smaller selection.`,
      accepted: [],
      rejected: [],
    }
  }

  const refusal = await pendingBudgetRefusal()
  if (refusal) return { refusal, accepted: [], rejected: [] }

  const accepted: File[] = []
  const rejected: RejectedFile[] = []
  for (const file of files) {
    const reason = screenFile(file)
    if (reason) rejected.push({ file, reason })
    else accepted.push(file)
  }
  return { refusal: null, accepted, rejected }
}
