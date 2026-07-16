import { Icon } from '../components/Icon'
import { usePhotoBytes } from './usePhotoBytes'

// Renders whichever of the four byte states a photo is in (spec §8.3) — the
// document always exists locally, the bytes may not.
export function PhotoImage({
  photoId,
  blobKey,
  alt,
  className,
}: {
  photoId: string
  blobKey: string | null
  alt: string
  className?: string
}) {
  const { url, state } = usePhotoBytes(photoId, blobKey)

  if (state === 'ready' && url) {
    // Bytes are on this device but `blob_key` is still null: this is the
    // capturing device and its upload queue hasn't drained yet. The image
    // shows, but other devices can't see it until the bytes reach Blob — so
    // flag that it's still going up rather than looking done (spec §8.2).
    if (!blobKey) {
      return (
        <span className={className ? `${className} photo-uploading` : 'photo-uploading'}>
          <img src={url} alt={alt} />
          <span className="photo-uploading-badge" aria-label="Uploading" title="Uploading…">
            <Icon name="arrow-repeat" />
          </span>
        </span>
      )
    }
    return <img className={className} src={url} alt={alt} />
  }

  const message =
    state === 'pending' ? 'Waiting to upload' : state === 'offline' ? 'Connect to view' : 'Loading…'

  return (
    <div className={className ? `${className} photo-placeholder` : 'photo-placeholder'} role="img" aria-label={`${alt} — ${message}`}>
      <Icon name={state === 'offline' ? 'cloud-check' : 'image'} />
      <span>{message}</span>
    </div>
  )
}
