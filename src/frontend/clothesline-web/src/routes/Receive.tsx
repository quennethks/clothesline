import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router'
import { useLiveRxQuery, useRxDatabase } from 'rxdb/plugins/react'
import type { ClotheslineDatabase } from '../db'
import { submitReceivedTotal } from '../domain/receive'
import { AppBar } from '../components/AppBar'

export function Receive({ loadId }: { loadId: string }) {
  const navigate = useNavigate()
  const db = useRxDatabase<ClotheslineDatabase>()
  const [value, setValue] = useState('')
  // useLiveRxQuery's `query` must be a stable reference (see Home.tsx).
  const loadQuery = useMemo(() => ({ selector: { id: loadId } }), [loadId])
  const { results: loads } = useLiveRxQuery({ collection: 'loads', query: loadQuery })
  const load = loads[0]

  if (!load || !db) return <p className="screen-body">Loading…</p>

  async function submit(total: number | null) {
    const outcome = await submitReceivedTotal(db!, loadId, total)
    navigate(outcome === 'matched' ? `/loads/${loadId}` : `/loads/${loadId}/checkoff`)
  }

  return (
    <section>
      <AppBar title={load.shop_name ?? load.name} onBack={() => navigate(`/loads/${loadId}`)} />

      <div className="screen-body">
        <div className="center-card">
          <div className="count-wrap">
            <h4>Count your clothes</h4>
            <div className="count-q">How many items did you receive?</div>
            <input
              className="count-input"
              type="number"
              inputMode="numeric"
              min={0}
              placeholder="0"
              aria-label="Total received"
              value={value}
              onChange={(e) => setValue(e.target.value)}
            />
            <div className="expected">Expected count: {load.total_sent}</div>
          </div>

          <div className="d-flex justify-content-end gap-2 mt-2">
            <button type="button" className="btn btn-outline-secondary" onClick={() => submit(null)}>
              Skip
            </button>
            <button
              type="button"
              className="btn btn-aqua"
              disabled={value === ''}
              onClick={() => submit(Number(value))}
            >
              Continue
            </button>
          </div>
        </div>
      </div>
    </section>
  )
}
