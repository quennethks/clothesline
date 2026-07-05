import { useMemo } from 'react'
import { useNavigate } from 'react-router'
import { useLiveRxQuery, useRxDatabase } from 'rxdb/plugins/react'
import type { ClotheslineDatabase } from '../db'
import { useCurrentUser } from '../auth/useCurrentUser'
import { createLoad, deleteLoad, duplicateLoad } from '../domain/loads'
import type { LoadDocType } from '../db/schemas/loads.schema'

// useLiveRxQuery's `query` must be a stable reference — a fresh object
// literal every render makes its live subscription re-run continuously
// (an infinite render loop), so every query object below is memoized.
const ALL_LOADS_QUERY = { selector: {}, sort: [{ updated_at: 'desc' as const }] }

function LoadItemCount({ loadId }: { loadId: string }) {
  const query = useMemo(() => ({ selector: { load_id: loadId } }), [loadId])
  const { results: categories } = useLiveRxQuery({ collection: 'load_item_categories', query })
  const total = categories.reduce((sum, category) => sum + category.count_sent, 0)
  return <span>{total} items</span>
}

function LoadCard({
  load,
  db,
  onOpen,
}: {
  load: LoadDocType
  db: ClotheslineDatabase
  onOpen: (id: string) => void
}) {
  async function handleDuplicate(event: React.MouseEvent) {
    event.stopPropagation()
    await duplicateLoad(db, load.id)
  }

  async function handleDelete(event: React.MouseEvent) {
    event.stopPropagation()
    if (window.confirm(`Delete "${load.name}"?`)) {
      await deleteLoad(db, load.id)
    }
  }

  return (
    <li data-testid="load-card" onClick={() => onOpen(load.id)}>
      <span>{load.name}</span>
      {load.shop_name && <span> · {load.shop_name}</span>}
      <span> · {load.status}</span>
      <span> · </span>
      <LoadItemCount loadId={load.id} />
      <button type="button" aria-label="Duplicate" onClick={handleDuplicate}>
        Duplicate
      </button>
      <button type="button" aria-label="Delete" onClick={handleDelete}>
        Delete
      </button>
    </li>
  )
}

export function Home() {
  const navigate = useNavigate()
  const db = useRxDatabase<ClotheslineDatabase>()
  const { user } = useCurrentUser()
  const { results: loads } = useLiveRxQuery({ collection: 'loads', query: ALL_LOADS_QUERY })

  async function handleCreate() {
    if (!db || !user) return
    const id = await createLoad(db, user.id)
    navigate(`/loads/${id}`)
  }

  return (
    <main>
      <header>
        <h1>Clothesline</h1>
        <button type="button" aria-label="New load" onClick={handleCreate} disabled={!user}>
          +
        </button>
      </header>
      <ul>
        {db &&
          loads.map((load) => (
            <LoadCard key={load.id} load={load} db={db} onOpen={(id) => navigate(`/loads/${id}`)} />
          ))}
      </ul>
    </main>
  )
}
