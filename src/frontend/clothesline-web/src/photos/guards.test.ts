import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { CACHE_BUDGET_BYTES, PENDING_BUDGET_BYTES } from './byteStore'
import {
  MAX_BATCH_FILES,
  MAX_FILE_BYTES,
  PENDING_FULL_MESSAGE,
  screenBatch,
  screenFile,
} from './guards'

// byteStore is IndexedDB (absent in jsdom); only pendingBytes is exercised here,
// so it is the one thing mocked — the constants stay real, because the whole
// point of one of these assertions is that the *real* two budgets are ordered.
const pendingBytes = vi.fn<() => Promise<number>>()
vi.mock('./byteStore', async (importOriginal) => ({
  ...(await importOriginal<typeof import('./byteStore')>()),
  pendingBytes: () => pendingBytes(),
}))

function imageFile(name: string, size: number, type = 'image/jpeg'): File {
  const file = new File(['x'], name, { type })
  // File.size is read-only and derived from the parts; override it so we can
  // describe a huge file without allocating one.
  Object.defineProperty(file, 'size', { value: size })
  return file
}

describe('guards', () => {
  beforeEach(() => pendingBytes.mockResolvedValue(0))
  afterEach(() => vi.restoreAllMocks())

  describe('the pre-decode file guards run before anything OOMs (spec §5.1)', () => {
    it('rejects an oversized file and a non-image file without decoding them', async () => {
      // The guard existing *before* the decoder is the entire point, so assert
      // the decoder is never reached.
      const createImageBitmap = vi.fn()
      vi.stubGlobal('createImageBitmap', createImageBitmap)

      const files = [
        imageFile('scan.jpg', MAX_FILE_BYTES + 1),
        imageFile('archive.zip', 1024, 'application/zip'),
        imageFile('good.jpg', 2 * 1024 * 1024),
      ]
      const result = await screenBatch(files)

      expect(result.refusal).toBeNull()
      expect(result.accepted.map((f) => f.name)).toEqual(['good.jpg'])
      expect(result.rejected.map((r) => r.file.name)).toEqual(['scan.jpg', 'archive.zip'])
      expect(createImageBitmap).not.toHaveBeenCalled()
    })

    it('screenFile names why, or returns null for a valid image', () => {
      expect(screenFile(imageFile('a.jpg', 1024))).toBeNull()
      expect(screenFile(imageFile('big.jpg', MAX_FILE_BYTES + 1))).toContain('larger than 25 MB')
      expect(screenFile(imageFile('x.zip', 1024, 'application/zip'))).toContain("isn't an image")
    })
  })

  describe('batch size (spec §5.2)', () => {
    it('refuses a selection over the 200-file cap, writing nothing', async () => {
      const files = Array.from({ length: MAX_BATCH_FILES + 1 }, (_, i) =>
        imageFile(`p${i}.jpg`, 1024),
      )
      const result = await screenBatch(files)

      expect(result.refusal).toContain('200')
      expect(result.accepted).toHaveLength(0)
    })

    it('accepts exactly the cap', async () => {
      const files = Array.from({ length: MAX_BATCH_FILES }, (_, i) => imageFile(`p${i}.jpg`, 1024))
      const result = await screenBatch(files)

      expect(result.refusal).toBeNull()
      expect(result.accepted).toHaveLength(MAX_BATCH_FILES)
    })
  })

  describe('the pending-bytes budget — the guard that protects the offline case', () => {
    it('refuses the whole batch when the un-uploaded pile is at budget', async () => {
      pendingBytes.mockResolvedValue(PENDING_BUDGET_BYTES)
      const result = await screenBatch([imageFile('a.jpg', 1024)])

      expect(result.refusal).toBe(PENDING_FULL_MESSAGE)
      expect(result.accepted).toHaveLength(0)
    })

    it('accepts again once the queue has drained back under budget', async () => {
      pendingBytes.mockResolvedValue(PENDING_BUDGET_BYTES - 1)
      const result = await screenBatch([imageFile('a.jpg', 1024)])

      expect(result.refusal).toBeNull()
      expect(result.accepted).toHaveLength(1)
    })

    it('keeps the pending budget below the cache budget (spec §5.2)', () => {
      // Invert these and trimCache evicts the whole offline cache while a
      // pending pile it may not touch keeps it over budget — silently.
      expect(PENDING_BUDGET_BYTES).toBeLessThan(CACHE_BUDGET_BYTES)
    })
  })
})
