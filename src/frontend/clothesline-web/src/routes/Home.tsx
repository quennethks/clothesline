import { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router'
import { useLiveRxQuery, useRxDatabase } from 'rxdb/plugins/react'
import type { ClotheslineDatabase } from '../db'
import { useCurrentUser } from '../auth/useCurrentUser'
import { SignOutButton } from '../auth/SignOutButton'
import { createLoad, deleteLoad, duplicateLoad } from '../domain/loads'
import type { LoadDocType } from '../db/schemas/loads.schema'
import { AppBar } from '../components/AppBar'
import { ConfirmModal } from '../components/ConfirmModal'
import { Icon } from '../components/Icon'
import { StatusPill } from '../components/StatusPill'
import { displayStatus, type DisplayStatus } from '../components/loadStatus'

// useLiveRxQuery's `query` must be a stable reference — a fresh object
// literal every render makes its live subscription re-run continuously
// (an infinite render loop), so every query object below is memoized.
const ALL_LOADS_QUERY = { selector: {}, sort: [{ updated_at: 'desc' as const }] }

type FilterKey = 'all' | DisplayStatus

const FILTERS: { key: FilterKey; label: string }[] = [
  { key: 'all', label: 'All' },
  { key: 'draft', label: 'Draft' },
  { key: 'sent', label: 'Sent' },
  { key: 'receiving', label: 'Receiving' },
  { key: 'closed', label: 'Closed' },
]

function LoadItemCount({ loadId }: { loadId: string }) {
  const query = useMemo(() => ({ selector: { load_id: loadId } }), [loadId])
  const { results: categories } = useLiveRxQuery({ collection: 'load_item_categories', query })
  const total = categories.reduce((sum, category) => sum + category.count_sent, 0)
  // The badge shows the bare number; " items" stays in the accessible name.
  return (
    <span className="count">
      {total}
      <span className="visually-hidden"> items</span>
    </span>
  )
}

function LoadCard({
  load,
  db,
  onOpen,
  onAskDelete,
}: {
  load: LoadDocType
  db: ClotheslineDatabase
  onOpen: (id: string) => void
  onAskDelete: (load: LoadDocType) => void
}) {
  const [menuOpen, setMenuOpen] = useState(false)
  const ovfRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!menuOpen) return
    function onDocClick(event: MouseEvent) {
      if (!ovfRef.current?.contains(event.target as Node)) setMenuOpen(false)
    }
    document.addEventListener('click', onDocClick)
    return () => document.removeEventListener('click', onDocClick)
  }, [menuOpen])

  async function handleDuplicate(event: React.MouseEvent) {
    event.stopPropagation()
    setMenuOpen(false)
    await duplicateLoad(db, load.id)
  }

  function handleDelete(event: React.MouseEvent) {
    event.stopPropagation()
    setMenuOpen(false)
    onAskDelete(load)
  }

  return (
    <li
      data-testid="load-card"
      className="load-card"
      role="button"
      tabIndex={0}
      onClick={() => onOpen(load.id)}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') onOpen(load.id)
      }}
    >
      <span className="bag">
        <Icon name="bag" />
        <LoadItemCount loadId={load.id} />
      </span>

      <div className="meta">
        <div className="lname">{load.name}</div>
        {load.shop_name && <div className="shop">{load.shop_name}</div>}
        <StatusPill status={displayStatus(load)} />
      </div>

      <div className="card-actions" onClick={(e) => e.stopPropagation()}>
        <div className="inline-actions">
          <button type="button" className="mini" aria-label="Duplicate" onClick={handleDuplicate}>
            <Icon name="copy" />
          </button>
          <button type="button" className="mini danger" aria-label="Delete" onClick={handleDelete}>
            <Icon name="trash3" />
          </button>
        </div>

        {/* Narrow-screen collapse of the same two actions. These carry no
            aria-label — their visible text names them, and a second pair of
            "Duplicate"/"Delete" labels would make the inline buttons
            ambiguous to accessibility tooling and to getByLabelText. */}
        <div className={menuOpen ? 'ovf open' : 'ovf'} ref={ovfRef}>
          <button
            type="button"
            className="mini"
            aria-label="More actions"
            aria-expanded={menuOpen}
            onClick={(e) => {
              e.stopPropagation()
              setMenuOpen((open) => !open)
            }}
          >
            <Icon name="three-dots-vertical" />
          </button>
          {menuOpen && (
            <div className="ovf-menu">
              <button type="button" className="ovf-item" onClick={handleDuplicate}>
                <Icon name="copy" /> Duplicate
              </button>
              <button type="button" className="ovf-item danger" onClick={handleDelete}>
                <Icon name="trash3" /> Delete
              </button>
            </div>
          )}
        </div>
      </div>
    </li>
  )
}

export function Home() {
  const navigate = useNavigate()
  const db = useRxDatabase<ClotheslineDatabase>()
  const { user } = useCurrentUser()
  const { results: loads } = useLiveRxQuery({ collection: 'loads', query: ALL_LOADS_QUERY })
  const [filter, setFilter] = useState<FilterKey>('all')
  const [pendingDelete, setPendingDelete] = useState<LoadDocType | null>(null)

  async function handleCreate() {
    if (!db || !user) return
    const id = await createLoad(db, user.id)
    navigate(`/loads/${id}`)
  }

  async function handleConfirmDelete() {
    if (db && pendingDelete) await deleteLoad(db, pendingDelete.id)
    setPendingDelete(null)
  }

  const countFor = (key: FilterKey) =>
    key === 'all' ? loads.length : loads.filter((l) => displayStatus(l) === key).length

  const shown = loads.filter((l) => filter === 'all' || displayStatus(l) === filter)

  return (
    <section>
      <AppBar
        title="My Loads"
        actions={
          <div className="appbar-actions">
            <button
              type="button"
              className="iconbtn ghost"
              aria-label="New load"
              title="New load"
              onClick={handleCreate}
              disabled={!user}
            >
              <Icon name="plus-lg" />
            </button>
            <SignOutButton />
          </div>
        }
      />

      <div className="screen-body">
        <div className="filter-row">
          {FILTERS.map((f) => (
            <button
              key={f.key}
              type="button"
              className={filter === f.key ? 'chip active' : 'chip'}
              aria-pressed={filter === f.key}
              onClick={() => setFilter(f.key)}
            >
              {f.label}
              <span className="badge-count">{countFor(f.key)}</span>
            </button>
          ))}
        </div>

        {shown.length === 0 ? (
          <div className="empty-note">No loads with this status yet.</div>
        ) : (
          <ul className="desktop-grid list-unstyled m-0 p-0">
            {db &&
              shown.map((load) => (
                <LoadCard
                  key={load.id}
                  load={load}
                  db={db}
                  onOpen={(id) => navigate(`/loads/${id}`)}
                  onAskDelete={setPendingDelete}
                />
              ))}
          </ul>
        )}
      </div>

      <ConfirmModal
        open={pendingDelete !== null}
        title="Delete this load?"
        body={`"${pendingDelete?.name ?? ''}" will be removed. This can't be undone.`}
        onConfirm={handleConfirmDelete}
        onCancel={() => setPendingDelete(null)}
      />
    </section>
  )
}
