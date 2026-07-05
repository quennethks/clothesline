import { useMemo } from 'react'
import { Link, useNavigate } from 'react-router'
import { useLiveRxQuery, useRxDatabase } from 'rxdb/plugins/react'
import type { ClotheslineDatabase } from '../db'
import { nowIso } from '../domain/shared'

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

  if (!load || !db) return <p>Loading…</p>

  async function handleSendDateChange(sendDate: string) {
    const doc = await db!.loads.findOne(loadId).exec()
    await doc?.incrementalPatch({ send_date: sendDate || null, updated_at: nowIso() })
  }

  return (
    <main>
      <button type="button" onClick={() => navigate('/')}>
        ← Home
      </button>
      <h1>{load.shop_name ?? load.name}</h1>
      <label>
        Send date
        <input
          type="date"
          value={load.send_date ?? ''}
          onChange={(e) => handleSendDateChange(e.target.value)}
        />
      </label>

      <ul>
        {categories.map((category) => (
          <li key={category.id}>
            <span>{category.category}</span>
            <span>{category.count_sent}</span>
            <Link to={`/loads/${loadId}/gallery`} aria-label={`Photos for ${category.category}`}>
              📷
            </Link>
          </li>
        ))}
      </ul>

      <p>Total sent: {load.total_sent}</p>
      <button type="button" onClick={() => navigate(`/loads/${loadId}/receive`)}>
        ✓ Start Receive
      </button>
    </main>
  )
}
