import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router'
import { useLiveRxQuery, useRxDatabase } from 'rxdb/plugins/react'
import type { ClotheslineDatabase } from '../db'
import { addCustomCategory, removeCategory } from '../domain/categories'
import { decrementCount, incrementCount } from '../domain/counter'
import { sendLoad } from '../domain/loads'
import { nowIso } from '../domain/shared'

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

  if (!load || !db) return <p>Loading…</p>

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
    <main>
      <button type="button" onClick={() => navigate('/')}>
        ← Home
      </button>

      <label>
        Name
        <input
          aria-label="Load name"
          value={load.name}
          onChange={(e) => patchLoad({ name: e.target.value })}
        />
      </label>
      <label>
        Shop name
        <input
          aria-label="Shop name"
          placeholder="Shop name (optional)"
          value={load.shop_name ?? ''}
          onChange={(e) => patchLoad({ shop_name: e.target.value || null })}
        />
      </label>

      <ul>
        {categories.map((category) => (
          <li key={category.id}>
            <span>{category.category}</span>
            <button
              type="button"
              aria-label={`Decrease ${category.category}`}
              onClick={() => decrementCount(db!, category.id)}
            >
              −
            </button>
            <span data-testid={`count-${category.category}`}>{category.count_sent}</span>
            <button
              type="button"
              aria-label={`Increase ${category.category}`}
              onClick={() => incrementCount(db!, category.id)}
            >
              +
            </button>
            <button
              type="button"
              aria-label={`Remove ${category.category}`}
              onClick={() => removeCategory(db!, category.id)}
            >
              Remove
            </button>
          </li>
        ))}
      </ul>

      <label>
        Add category
        <input
          aria-label="New category"
          value={newCategoryName}
          onChange={(e) => setNewCategoryName(e.target.value)}
        />
      </label>
      <button type="button" onClick={handleAddCategory}>
        ITEMS +
      </button>

      <p>Total: {total}</p>
      <button type="button" onClick={handleSend}>
        Send ➤
      </button>
    </main>
  )
}
