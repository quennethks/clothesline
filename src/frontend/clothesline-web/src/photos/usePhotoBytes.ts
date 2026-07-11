import { useEffect, useState } from 'react'
import { useAuthToken } from '../auth/useAuthToken'
import { getBytes, putBytes } from './byteStore'
import { fetchBlobBytes, requestReadUrl } from './mediaApi'

// The read half of the byte plumbing (spec §8.3): lazy cache-on-view.
//
// - bytes on this device (captured here, or fetched once before) → shown, online or off
// - not local, but uploaded and we're online → fetch via a read SAS, then cache
//   them, so the photo is offline-viewable from now on
// - not local, uploaded, and offline → "connect to view"
// - no blob_key yet → the capturing device hasn't drained its upload queue

export type PhotoBytesState = 'loading' | 'ready' | 'pending' | 'offline'

export function usePhotoBytes(photoId: string, blobKey: string | null) {
  const token = useAuthToken()
  const [url, setUrl] = useState<string>()
  const [state, setState] = useState<PhotoBytesState>('loading')

  useEffect(() => {
    let cancelled = false
    let objectUrl: string | undefined

    const show = (bytes: Blob) => {
      if (cancelled) return
      objectUrl = URL.createObjectURL(bytes)
      setUrl(objectUrl)
      setState('ready')
    }

    async function resolve() {
      const local = await getBytes(photoId)
      if (local) return show(local)

      if (!blobKey) return void (!cancelled && setState('pending'))
      if (!navigator.onLine) return void (!cancelled && setState('offline'))

      try {
        const target = await requestReadUrl(photoId, token)
        const bytes = await fetchBlobBytes(target.url)
        await putBytes(photoId, bytes, true)
        show(bytes)
      } catch {
        if (!cancelled) setState('offline')
      }
    }

    setState('loading')
    void resolve()

    return () => {
      cancelled = true
      if (objectUrl) URL.revokeObjectURL(objectUrl)
    }
  }, [photoId, blobKey, token])

  return { url, state }
}
