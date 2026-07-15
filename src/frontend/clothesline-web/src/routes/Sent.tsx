import { useMemo } from 'react'
import { useNavigate } from 'react-router'
import { useLiveRxQuery, useRxDatabase } from 'rxdb/plugins/react'
import type { ClotheslineDatabase } from '../db'
import { nowIso } from '../domain/shared'
import { AppBar } from '../components/AppBar'
import { Icon } from '../components/Icon'
import { LoadScreenSkeleton } from '../components/Skeleton'

export function Sent({ loadId }: { loadId: string }) {
  const navigate = useNavigate()
  const db = useRxDatabase<ClotheslineDatabase>()
  // useLiveRxQuery's `query` must be a stable reference (see Home.tsx).
  const loadQuery = useMemo(() => ({ selector: { id: loadId } }), [loadId])
  const categoriesQuery = useMemo(() => ({ selector: { load_id: loadId } }), [loadId])

  const { results: loads } = useLiveRxQuery({ collection: 'loads', query: loadQuery })
  const load = loads[0]
  const { results: categories } = useLiveRxQuery({
    collection: 'load_item_categories',
    query: categoriesQuery,
  })

  if (!load || !db) return <LoadScreenSkeleton />

  async function handleSendDateChange(sendDate: string) {
    const doc = await db!.loads.findOne(loadId).exec()
    await doc?.incrementalPatch({ send_date: sendDate || null, updated_at: nowIso() })
  }

  return (
    <section>
      <AppBar
        title={load.shop_name ?? load.name}
        onBack={() => navigate('/')}
        actions={
          <button
            type="button"
            className="iconbtn ghost"
            aria-label="Start Receive"
            title="Confirm sent"
            onClick={() => navigate(`/loads/${loadId}/receive`)}
          >
            <Icon name="check-circle" />
          </button>
        }
      />

      <div className="screen-body">
        <div className="center-card">
          <div className="mb-2">
            <div className="field-label">Shop</div>
            <div className="fw-semibold">{load.shop_name ?? '—'}</div>
          </div>

          <div className="mb-3">
            <label className="field-label mb-1 d-block" htmlFor="sent-date">
              Send date
            </label>
            <input
              id="sent-date"
              type="date"
              className="form-control"
              value={load.send_date ?? ''}
              onChange={(e) => handleSendDateChange(e.target.value)}
            />
          </div>

          <div className="total-hero">
            <div className="num">{load.total_sent}</div>
            <div className="lbl">Total items</div>
          </div>

          <h6 className="fw-bold mb-2">Items</h6>
          <div>
            {categories.map((category) => (
              <div className="item-row" key={category.id}>
                <span className="iname">{category.category}</span>
                <button
                  type="button"
                  className="thumb border-0"
                  aria-label={`Photos for ${category.category}`}
                  onClick={() => navigate(`/loads/${loadId}/gallery?category=${category.id}`)}
                >
                  <Icon name="image" />
                </button>
                <span className="qty d-inline-flex align-items-center justify-content-center bg-light">
                  {category.count_sent}
                </span>
              </div>
            ))}
          </div>

          <div className="noneditable-note">
            <Icon name="lock" /> This load has been sent and can no longer be edited.
          </div>

          <div className="d-flex justify-content-end mt-3">
            <button
              type="button"
              className="btn btn-aqua"
              onClick={() => navigate(`/loads/${loadId}/receive`)}
            >
              <Icon name="check-circle" /> Start Receive
            </button>
          </div>
        </div>
      </div>
    </section>
  )
}
