// The /media pair (spec §5.2). These two calls only ever exchange *URLs* —
// the bytes themselves go straight between the device and Blob Storage over
// the returned SAS URL, never through the API (spec §8).

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? ''

export interface UploadTarget {
  blob_key: string
  upload_url: string
  expires_at: string
}

interface ReadTarget {
  url: string
  expires_at: string
}

async function authorized(path: string, init: RequestInit, token: string | undefined) {
  const headers = new Headers(init.headers)
  if (token) headers.set('Authorization', `Bearer ${token}`)
  const res = await fetch(`${API_BASE_URL}${path}`, { ...init, headers })
  if (!res.ok) throw new Error(`${init.method ?? 'GET'} ${path} failed: ${res.status}`)
  return res
}

export async function requestUploadUrl(
  photoId: string,
  contentType: string,
  token: string | undefined,
): Promise<UploadTarget> {
  const res = await authorized(
    '/media/upload-url',
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ photo_id: photoId, content_type: contentType }),
    },
    token,
  )
  return (await res.json()) as UploadTarget
}

export async function requestReadUrl(
  photoId: string,
  token: string | undefined,
): Promise<ReadTarget> {
  const res = await authorized(`/media/${photoId}`, { method: 'GET' }, token)
  return (await res.json()) as ReadTarget
}

export async function putBlobBytes(uploadUrl: string, bytes: Blob): Promise<void> {
  const res = await fetch(uploadUrl, {
    method: 'PUT',
    // Azure Blob rejects a PUT without this header — it names the blob type
    // being created, not the payload's media type (that's Content-Type).
    headers: { 'x-ms-blob-type': 'BlockBlob', 'Content-Type': bytes.type || 'image/webp' },
    body: bytes,
  })
  if (!res.ok) throw new Error(`blob upload failed: ${res.status}`)
}

export async function fetchBlobBytes(readUrl: string): Promise<Blob> {
  const res = await fetch(readUrl)
  if (!res.ok) throw new Error(`blob download failed: ${res.status}`)
  return res.blob()
}
