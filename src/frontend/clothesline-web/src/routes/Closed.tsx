import { useMemo } from 'react'
import { useNavigate } from 'react-router'
import { useLiveRxQuery, useRxDatabase } from 'rxdb/plugins/react'
import type { ClotheslineDatabase } from '../db'
import { closeLoad, setReceivedCount } from '../domain/reconcile'
import { AppBar } from '../components/AppBar'
import { Icon } from '../components/Icon'
import { Stepper } from '../components/Stepper'

// Doubles as both the post-receive per-category check (reached at
// /loads/:id/checkoff while status is still 'sent' — spec's conceptual
// "checkoff" phase isn't a persisted status) and the finalized/reopenable
// Closed screen (reached at /loads/:id once status is 'closed').
export function Closed({ loadId }: { loadId: string }) {
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

  if (!load || !db) return <p className="screen-body">Loading…</p>

  const totalReceived = categories.reduce((sum, category) => sum + (category.count_received ?? 0), 0)
  const isClosed = load.status === 'closed'

  async function handleSave() {
    if (!isClosed) await closeLoad(db!, loadId)
    navigate(`/loads/${loadId}`)
  }

  return (
    <section>
      <AppBar
        title={load.shop_name ?? load.name}
        onBack={() => navigate('/')}
        actions={
          <button type="button" className="iconbtn" aria-label="Save" title="Save" onClick={handleSave}>
            <Icon name="save" />
          </button>
        }
      />

      <div className="screen-body">
        <div className="center-card">
          <div className="mb-2">
            <div className="field-label">Shop</div>
            <div className="fw-semibold">{load.shop_name ?? '—'}</div>
          </div>

          <div className="total-hero">
            <div className="num">{load.total_sent}</div>
            <div className="lbl">Total sent</div>
          </div>

          <div className="recv-head">
            <div>Items</div>
            <div className="text-center">Sent</div>
            <div />
            <div className="text-center">Received</div>
          </div>

          <div>
            {categories.map((category) => (
              <div className="recv-row" key={category.id}>
                <span className="fw-semibold">{category.category}</span>
                <button
                  type="button"
                  className="sent-badge"
                  aria-label={`Photos for ${category.category}`}
                  title="View gallery"
                  onClick={() => navigate(`/loads/${loadId}/gallery?category=${category.id}`)}
                >
                  {category.count_sent}
                </button>
                <span className="text-muted">→</span>
                <Stepper
                  value={category.count_received ?? 0}
                  valueTestId={`received-${category.category}`}
                  decrementLabel={`Decrease received ${category.category}`}
                  incrementLabel={`Increase received ${category.category}`}
                  onDecrement={() =>
                    setReceivedCount(db!, category.id, (category.count_received ?? 0) - 1)
                  }
                  onIncrement={() =>
                    setReceivedCount(db!, category.id, (category.count_received ?? 0) + 1)
                  }
                />
              </div>
            ))}
          </div>

          <div className="total-hero mt-2">
            <div className="num" data-testid="total-received">
              {totalReceived}
            </div>
            <div className="lbl">Total received</div>
          </div>

          <div className="d-flex justify-content-end mt-2">
            <button type="button" className="btn btn-aqua" onClick={handleSave}>
              {isClosed ? 'Save' : 'Close load'}
            </button>
          </div>
        </div>
      </div>
    </section>
  )
}
