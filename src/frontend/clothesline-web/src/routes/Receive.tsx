import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router'
import { useLiveRxQuery, useRxDatabase } from 'rxdb/plugins/react'
import type { ClotheslineDatabase } from '../db'
import { submitReceivedTotal } from '../domain/receive'

export function Receive({ loadId }: { loadId: string }) {
  const navigate = useNavigate()
  const db = useRxDatabase<ClotheslineDatabase>()
  const [value, setValue] = useState('')
  // useLiveRxQuery's `query` must be a stable reference (see Home.tsx).
  const loadQuery = useMemo(() => ({ selector: { id: loadId } }), [loadId])
  const { results: loads } = useLiveRxQuery({ collection: 'loads', query: loadQuery })
  const load = loads[0]

  if (!load || !db) return <p>Loading…</p>

  async function submit(total: number | null) {
    const outcome = await submitReceivedTotal(db!, loadId, total)
    navigate(outcome === 'matched' ? `/loads/${loadId}` : `/loads/${loadId}/checkoff`)
  }

  return (
    <main>
      <h1>Count your clothes</h1>
      <p>Expected: {load.total_sent}</p>
      <label>
        Total received
        <input
          type="number"
          min={0}
          value={value}
          onChange={(e) => setValue(e.target.value)}
        />
      </label>
      <button type="button" onClick={() => submit(Number(value))} disabled={value === ''}>
        Submit
      </button>
      <button type="button" onClick={() => submit(null)}>
        Skip
      </button>
    </main>
  )
}
