import { useEffect, useRef, useState } from 'react'
import { useRxDatabase } from 'rxdb/plugins/react'
import { useAuthToken } from '../auth/useAuthToken'
import type { ClotheslineDatabase } from '../db'
import { startReplication } from '../db/replication'
import { useSyncStatus } from './useSyncStatus'

// Starts replication once the database and an access token are available,
// and renders the resulting sync-status badge (spec §6.4/§7). Mounted once
// near the top of the authenticated app.
export function SyncStatusIndicator() {
  const db = useRxDatabase<ClotheslineDatabase>()
  const token = useAuthToken()
  const tokenRef = useRef(token)
  tokenRef.current = token

  const [replicationStates, setReplicationStates] = useState<ReturnType<typeof startReplication>>([])

  useEffect(() => {
    if (!db) return
    const states = startReplication(db, () => tokenRef.current)
    setReplicationStates(states)
    return () => {
      for (const state of states) {
        void state.cancel()
      }
    }
  }, [db])

  const status = useSyncStatus(replicationStates)

  const label = status === 'active' ? 'Syncing…' : status === 'error' ? 'Sync error' : 'Synced'

  return (
    <span className="sync-status" data-testid="sync-status" data-status={status}>
      {label}
    </span>
  )
}
