import { useMemo, useRef, useState } from 'react'
import { useNavigate, useParams, useSearchParams } from 'react-router'
import { useLiveRxQuery, useRxDatabase } from 'rxdb/plugins/react'
import type { ClotheslineDatabase } from '../db'
import type { PhotoDocType } from '../db/schemas/photos.schema'
import { AppBar } from '../components/AppBar'
import { Icon } from '../components/Icon'
import { capturePhotoForCategory, capturePhotoForLoad, removePhoto } from '../photos/capture'
import { PhotoImage } from '../photos/PhotoTile'

// The load's photos, joined load → categories → items → photos (spec §6.2).
// Reached from the per-row photo icons (Draft/Sent) and the hyperlinked Sent
// numbers (Closed); a `?category=` param scopes it to one category, which is
// also what the Add button then attaches to (a category capture auto-creates
// a LoadItem and bumps the auto count — spec §4.4). Without the param the Add
// button attaches the load's bundle photo instead.
export function Gallery() {
  const navigate = useNavigate()
  const { id: loadId } = useParams<{ id: string }>()
  const [searchParams] = useSearchParams()
  const categoryId = searchParams.get('category')
  const db = useRxDatabase<ClotheslineDatabase>()
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [enlarged, setEnlarged] = useState<PhotoDocType | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // useLiveRxQuery's `query` must be a stable reference (see Home.tsx).
  const categoriesQuery = useMemo(() => ({ selector: { load_id: loadId } }), [loadId])
  const { results: categories } = useLiveRxQuery({
    collection: 'load_item_categories',
    query: categoriesQuery,
  })

  const scopedCategoryIds = useMemo(
    () => (categoryId ? [categoryId] : categories.map((category) => category.id)),
    [categoryId, categories],
  )
  const itemsQuery = useMemo(
    () => ({ selector: { load_item_category_id: { $in: scopedCategoryIds } } }),
    [scopedCategoryIds],
  )
  const { results: items } = useLiveRxQuery({ collection: 'load_items', query: itemsQuery })

  // A photo hangs off the load itself (the bundle photo), a category, or an
  // item — one query over all three, since PhotoLink is polymorphic.
  const entityIds = useMemo(() => {
    const ids = [...scopedCategoryIds, ...items.map((item) => item.id)]
    if (!categoryId && loadId) ids.push(loadId)
    return ids
  }, [categoryId, loadId, scopedCategoryIds, items])

  const linksQuery = useMemo(() => ({ selector: { entity_id: { $in: entityIds } } }), [entityIds])
  const { results: links } = useLiveRxQuery({ collection: 'photo_links', query: linksQuery })

  const photoIds = useMemo(() => links.map((link) => link.photo_id), [links])
  const photosQuery = useMemo(
    () => ({ selector: { id: { $in: photoIds } }, sort: [{ created_at: 'desc' as const }] }),
    [photoIds],
  )
  const { results: photos } = useLiveRxQuery({ collection: 'photos', query: photosQuery })

  const scopedCategory = categories.find((category) => category.id === categoryId)
  const title = scopedCategory ? scopedCategory.category : 'Photos'

  async function handleFile(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]
    // Cleared immediately so re-picking the same file still fires a change event.
    event.target.value = ''
    if (!file || !db || !loadId) return

    setBusy(true)
    setError(null)
    try {
      if (categoryId) await capturePhotoForCategory(db, categoryId, file)
      else await capturePhotoForLoad(db, loadId, file)
    } catch (cause) {
      console.error('photo capture failed', cause)
      setError("That image couldn't be added. Try another photo.")
    } finally {
      setBusy(false)
    }
  }

  async function handleDelete(photoId: string) {
    setEnlarged(null)
    if (db) await removePhoto(db, photoId)
  }

  return (
    <section>
      <AppBar
        title={title}
        onBack={() => navigate(-1)}
        actions={
          <button
            className="iconbtn ghost"
            type="button"
            aria-label="Add photo"
            title="Add photo"
            disabled={busy || !db}
            onClick={() => fileInputRef.current?.click()}
          >
            <Icon name="camera" />
          </button>
        }
      />

      {/* `capture` asks a phone for its camera directly; on desktop the same
          input falls back to the file picker. */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="visually-hidden"
        aria-label="Photo file"
        data-testid="photo-input"
        onChange={handleFile}
      />

      <div className="screen-body">
        <div className="center-card">
          {error && (
            <div className="alert alert-danger py-2" role="alert">
              {error}
            </div>
          )}

          {!categoryId && (
            <p className="field-label mb-2">
              The load's bundle photo, plus every photo taken against a category.
            </p>
          )}

          {photos.length === 0 ? (
            <div className="empty-note" data-testid="gallery-empty">
              <span className="empty-icon">
                <Icon name="images" />
              </span>
              No photos yet. Tap the camera to add one.
            </div>
          ) : (
            <ul className="photo-grid list-unstyled m-0 p-0">
              {photos.map((photo) => (
                <li key={photo.id}>
                  <button
                    type="button"
                    className="photo-tile"
                    aria-label="Enlarge photo"
                    onClick={() => setEnlarged(photo.toJSON() as PhotoDocType)}
                  >
                    <PhotoImage photoId={photo.id} blobKey={photo.blob_key} alt="Load photo" />
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      {enlarged && (
        <div className="photo-lightbox" role="dialog" aria-modal="true" aria-label="Photo">
          <div className="photo-lightbox-bar">
            <button
              type="button"
              className="iconbtn ghost"
              aria-label="Close photo"
              onClick={() => setEnlarged(null)}
            >
              <Icon name="arrow-left" />
            </button>
            <button
              type="button"
              className="iconbtn ghost danger"
              aria-label="Delete photo"
              onClick={() => handleDelete(enlarged.id)}
            >
              <Icon name="trash3" />
            </button>
          </div>
          <PhotoImage
            photoId={enlarged.id}
            blobKey={enlarged.blob_key}
            alt="Load photo"
            className="photo-full"
          />
        </div>
      )}
    </section>
  )
}
