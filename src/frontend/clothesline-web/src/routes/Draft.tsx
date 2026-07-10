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
import { Stepper } from '../components/Stepper'

export function Draft({ loadId }: { loadId: string }) {
  const navigate = useNavigate()
  const db = useRxDatabase<ClotheslineDatabase>()
  const [newCategoryName, setNewCategoryName] = useState('')

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

  if (!load || !db) return <p className="screen-body">Loading…</p>

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

  async function handleSend() {
    await sendLoad(db!, loadId)
    navigate(`/loads/${loadId}`)
  }

  return (
    <section>
      <AppBar
        title={load.name}
        onBack={() => navigate('/')}
        actions={
          <button
            type="button"
            className="iconbtn"
            aria-label="Send load"
            title="Send load"
            onClick={handleSend}
          >
            <Icon name="send" />
          </button>
        }
      />

      <div className="screen-body">
        <div className="center-card">
          <div className="d-flex align-items-center gap-2 mb-1">
            <input
              className="form-control form-control-lg border-0 px-0 fw-bold"
              style={{ fontSize: '1.4rem', boxShadow: 'none' }}
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

          <div className="total-hero">
            <div className="num" data-testid="draft-total">
              {total}
            </div>
            <div className="lbl">Total items</div>
          </div>

          <div className="items-head">
            <h6>Items</h6>
          </div>

          <div>
            {categories.map((category) => (
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
                    aria-label={`Photos for ${category.category}`}
                    title="View photos"
                    onClick={() => navigate(`/loads/${loadId}/gallery`)}
                  >
                    <Icon name="images" />
                  </button>
                  <button
                    type="button"
                    className="mini danger"
                    aria-label={`Remove ${category.category}`}
                    title="Remove"
                    onClick={() => removeCategory(db!, category.id)}
                  >
                    <Icon name="trash3" />
                  </button>
                </div>
              </div>
            ))}
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
    </section>
  )
}
