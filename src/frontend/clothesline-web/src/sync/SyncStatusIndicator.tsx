import { useEffect, useRef, useState } from 'react'
import { useRxDatabase } from 'rxdb/plugins/react'
import { useAuthToken } from '../auth/useAuthToken'
import type { ClotheslineDatabase } from '../db'
import { startReplication } from '../db/replication'
import { startUploadQueue } from '../photos/uploadQueue'
import { useOnline } from './useOnline'
import { useSyncStatus } from './useSyncStatus'

// Starts replication once the database and an access token are available,
// and renders the resulting sync-status badge (spec §6.4/§7). Mounted once
// near the top of the authenticated app. Also starts the photo upload queue —
// the byte-side counterpart to replication (spec §8.2), which RxDB does not
// cover — so both background workers share one lifecycle.
export function SyncStatusIndicator() {
  const db = useRxDatabase<ClotheslineDatabase>()
  const token = useAuthToken()
  const tokenRef = useRef(token)
  tokenRef.current = token

  const [replicationStates, setReplicationStates] = useState<ReturnType<typeof startReplication>>([])

  useEffect(() => {
    if (!db) return
    const states = startReplication(db, () => tokenRef.current)
    const stopUploadQueue = startUploadQueue(db, () => tokenRef.current)
    setReplicationStates(states)
    return () => {
      stopUploadQueue()
      for (const state of states) {
        void state.cancel()
      }
    }
  }, [db])

  const replicationStatus = useSyncStatus(replicationStates)
  const online = useOnline()

  // Offline is expected, not broken (spec §6.4) — and while offline every
  // replication attempt errors, so it would otherwise read "Sync error" for
  // the entire time the app is doing exactly what it's designed to do.
  const status = online ? replicationStatus : 'offline'
  const label =
    status === 'offline'
      ? 'Offline — changes saved'
      : status === 'active'
        ? 'Syncing…'
        : status === 'error'
          ? 'Sync error — will retry'
          : 'Synced'

  return (
    <span className="sync-status" data-testid="sync-status" data-status={status}>
      <span className="sync-dot" aria-hidden="true" />
      {label}
    </span>
  )
}
