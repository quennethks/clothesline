import { afterEach, describe, expect, it, vi } from 'vitest'
import { compressToWebP } from './compress'

// jsdom has neither createImageBitmap nor canvas.toBlob, so both are stubbed —
// this test is only about the *option we pass the decoder* (spec §4.1), not the
// pixels. The default createImageBitmap leaves imageOrientation at a value the
// browsers disagree on, which re-encodes EXIF-rotated library photos sideways.

describe('compressToWebP', () => {
  afterEach(() => vi.restoreAllMocks())

  it('decodes with imageOrientation: from-image so EXIF rotation is honoured', async () => {
    const createImageBitmap = vi
      .fn()
      .mockResolvedValue({ width: 100, height: 80, close: vi.fn() } as unknown as ImageBitmap)
    vi.stubGlobal('createImageBitmap', createImageBitmap)

    // canvas.toBlob is absent in jsdom — hand back a Blob so compress resolves.
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue({
      drawImage: vi.fn(),
    } as unknown as CanvasRenderingContext2D)
    vi.spyOn(HTMLCanvasElement.prototype, 'toBlob').mockImplementation((cb) =>
      cb(new Blob(['webp'], { type: 'image/webp' })),
    )

    const file = new Blob(['jpeg'], { type: 'image/jpeg' })
    await compressToWebP(file)

    expect(createImageBitmap).toHaveBeenCalledWith(file, { imageOrientation: 'from-image' })
  })
})
