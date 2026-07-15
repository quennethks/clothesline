import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router'
import { useLiveRxQuery, useRxDatabase } from 'rxdb/plugins/react'
import type { ClotheslineDatabase } from '../db'
import { addCustomCategory, removeCategory } from '../domain/categories'
import { decrementCount, incrementCount } from '../domain/counter'
import { sendLoad } from '../domain/loads'
import { nowIso } from '../domain/shared'
import { AppBar } from '../components/AppBar'
import { Icon } from '../components/Icon'
import { LoadScreenSkeleton } from '../components/Skeleton'
import { Stepper } from '../components/Stepper'
import { useToast } from '../components/Toast'
import { CameraSheet } from '../photos/CameraSheet'

export function Draft({ loadId }: { loadId: string }) {
  const navigate = useNavigate()
  const db = useRxDatabase<ClotheslineDatabase>()
  const toast = useToast()
  const [newCategoryName, setNewCategoryName] = useState('')
  // The row camera opens the sheet *in place* rather than detouring through the
  // Gallery (spec §3.4) — scoped to the category the button belongs to.
  const [camera, setCamera] = useState<{ id: string; name: string } | null>(null)

  // useLiveRxQuery's `query` must be a stable reference (see Home.tsx).
  const loadQuery = useMemo(() => ({ selector: { id: loadId } }), [loadId])
  const categoriesQuery = useMemo(
    () => ({ selector: { load_id: loadId }, sort: [{ created_at: 'asc' as const }] }),
    [loadId],
  )

  const { results: loads } = useLiveRxQuery({ collection: 'loads', query: loadQuery })
  const load = loads[0]

  const { results: categories } = useLiveRxQuery({
    collection: 'load_item_categories',
    query: categoriesQuery,
  })

  if (!load || !db) return <LoadScreenSkeleton />

  const total = categories.reduce((sum, category) => sum + category.count_sent, 0)

  async function patchLoad(patch: Partial<{ name: string; shop_name: string | null }>) {
    const doc = await db!.loads.findOne(loadId).exec()
    await doc?.incrementalPatch({ ...patch, updated_at: nowIso() })
  }

  async function handleAddCategory() {
    if (!newCategoryName.trim()) return
    await addCustomCategory(db!, loadId, newCategoryName.trim())
    setNewCategoryName('')
  }

  async function handleRemoveCategory(categoryId: string, name: string) {
    await removeCategory(db!, categoryId)
    toast(`Removed ${name}`)
  }

  async function handleSend() {
    await sendLoad(db!, loadId)
    toast(`Sent — ${total} ${total === 1 ? 'item' : 'items'} on the manifest`)
    navigate(`/loads/${loadId}`)
  }

  return (
    <section>
      <AppBar
        title={load.name}
        onBack={() => navigate('/')}
        actions={
          <div className="appbar-actions">
            {/* Load-level gallery — where the bundle photo (the home card's
                thumbnail) is added; the per-row icons below scope to a category. */}
            <button
              type="button"
              className="iconbtn"
              aria-label="Load photos"
              title="Load photos"
              onClick={() => navigate(`/loads/${loadId}/gallery`)}
            >
              <Icon name="images" />
            </button>
            <button
              type="button"
              className="iconbtn ghost"
              aria-label="Send load"
              title="Send load"
              onClick={handleSend}
            >
              <Icon name="send" />
            </button>
          </div>
        }
      />

      <div className="screen-body">
        <div className="center-card">
          <div className="d-flex align-items-center gap-2 mb-3">
            <input
              className="title-input"
              aria-label="Load name"
              value={load.name}
              onChange={(e) => patchLoad({ name: e.target.value })}
            />
            <Icon name="pencil" className="text-muted" />
          </div>

          <div className="mb-3">
            <label className="field-label mb-1 d-block" htmlFor="draft-shop">
              Shop
            </label>
            <input
              id="draft-shop"
              className="form-control"
              aria-label="Shop name"
              placeholder="Select a shop"
              value={load.shop_name ?? ''}
              onChange={(e) => patchLoad({ shop_name: e.target.value || null })}
            />
          </div>

          {/* Sticky so the running total stays on screen through the whole
              itemize scroll — spec §6.3 makes it a hard requirement, and it's
              also what the user is watching while they tap. */}
          <div className="total-hero sticky">
            <div className="num" data-testid="draft-total">
              {total}
            </div>
            <div className="lbl">Total items</div>
          </div>

          <div className="items-head">
            <h6>Items</h6>
          </div>

          <div>
            {categories.length === 0 ? (
              <div className="empty-note">
                <span className="empty-icon">
                  <Icon name="bag" />
                </span>
                No categories left. Add one below to start counting.
              </div>
            ) : (
              categories.map((category) => (
                <div className="item-row" key={category.id}>
                  <span className="iname">{category.category}</span>
                  <Stepper
                    value={category.count_sent}
                    valueTestId={`count-${category.category}`}
                    decrementLabel={`Decrease ${category.category}`}
                    incrementLabel={`Increase ${category.category}`}
                    onDecrement={() => decrementCount(db!, category.id)}
                    onIncrement={() => incrementCount(db!, category.id)}
                  />
                  <div className="item-tools">
                    <button
                      type="button"
                      className="mini"
                      aria-label={`Take photo for ${category.category}`}
                      title="Take photo"
                      onClick={() => setCamera({ id: category.id, name: category.category })}
                    >
                      <Icon name="camera" />
                    </button>
                    <button
                      type="button"
                      className="mini"
                      aria-label={`Photos for ${category.category}`}
                      title="View photos"
                      onClick={() => navigate(`/loads/${loadId}/gallery?category=${category.id}`)}
                    >
                      <Icon name="images" />
                    </button>
                    <button
                      type="button"
                      className="mini danger"
                      aria-label={`Remove ${category.category}`}
                      title="Remove"
                      onClick={() => handleRemoveCategory(category.id, category.category)}
                    >
                      <Icon name="trash3" />
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>

          <div className="d-flex align-items-center gap-2 mt-3">
            <input
              className="form-control"
              aria-label="New category"
              placeholder="Add category"
              value={newCategoryName}
              onChange={(e) => setNewCategoryName(e.target.value)}
            />
            <button
              type="button"
              className="btn btn-sm btn-outline-aqua text-nowrap"
              onClick={handleAddCategory}
            >
              <Icon name="plus-lg" /> Add
            </button>
          </div>

          <div className="d-flex justify-content-end mt-4">
            <button type="button" className="btn btn-aqua" onClick={handleSend}>
              <Icon name="send" /> Send
            </button>
          </div>
        </div>
      </div>

      {camera && (
        <CameraSheet
          loadId={loadId}
          categoryId={camera.id}
          title={camera.name}
          onClose={() => setCamera(null)}
        />
      )}
    </section>
  )
}
