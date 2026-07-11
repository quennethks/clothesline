// Photos are compressed to WebP on the device before anything else happens to
// them (spec §8.2 step 1) — a phone camera's several-MB JPEG becomes a couple
// hundred KB, which is what makes uploading over mobile data (and caching
// dozens of them locally) reasonable.

export const PHOTO_CONTENT_TYPE = 'image/webp'

const MAX_DIMENSION = 1600
const QUALITY = 0.8

function scaleToFit(width: number, height: number): { width: number; height: number } {
  const longest = Math.max(width, height)
  if (longest <= MAX_DIMENSION) return { width, height }
  const scale = MAX_DIMENSION / longest
  return { width: Math.round(width * scale), height: Math.round(height * scale) }
}

export async function compressToWebP(file: Blob): Promise<Blob> {
  const bitmap = await createImageBitmap(file)
  const { width, height } = scaleToFit(bitmap.width, bitmap.height)

  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  const context = canvas.getContext('2d')
  if (!context) throw new Error('could not get a 2d canvas context')
  context.drawImage(bitmap, 0, 0, width, height)
  bitmap.close()

  const blob = await new Promise<Blob | null>((resolve) =>
    canvas.toBlob(resolve, PHOTO_CONTENT_TYPE, QUALITY),
  )
  if (!blob) throw new Error('WebP encoding failed')
  return blob
}
