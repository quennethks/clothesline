import { useMemo } from 'react'
import { Link, useNavigate } from 'react-router'
import { useLiveRxQuery, useRxDatabase } from 'rxdb/plugins/react'
import type { ClotheslineDatabase } from '../db'
import { closeLoad, setReceivedCount } from '../domain/reconcile'

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

  if (!load || !db) return <p>Loading…</p>

  const totalReceived = categories.reduce((sum, category) => sum + (category.count_received ?? 0), 0)

  async function handleSave() {
    if (load!.status !== 'closed') {
      await closeLoad(db!, loadId)
    }
    navigate(`/loads/${loadId}`)
  }

  return (
    <main>
      <button type="button" onClick={() => navigate('/')}>
        ← Home
      </button>
      <h1>{load.shop_name ?? load.name}</h1>

      <ul>
        {categories.map((category) => (
          <li key={category.id}>
            <span>{category.category}</span>
            <span>
              Sent: <Link to={`/loads/${loadId}/gallery`}>{category.count_sent}</Link>
            </span>
            <span>
              Received:
              <button
                type="button"
                aria-label={`Decrease received ${category.category}`}
                onClick={() =>
                  setReceivedCount(db!, category.id, (category.count_received ?? 0) - 1)
                }
              >
                −
              </button>
              {category.count_received ?? 0}
              <button
                type="button"
                aria-label={`Increase received ${category.category}`}
                onClick={() =>
                  setReceivedCount(db!, category.id, (category.count_received ?? 0) + 1)
                }
              >
                +
              </button>
            </span>
          </li>
        ))}
      </ul>

      <p>Total sent: {load.total_sent}</p>
      <p>Total received: {totalReceived}</p>
      <button type="button" onClick={handleSave}>
        Save
      </button>
    </main>
  )
}
