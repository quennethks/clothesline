import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from 'react'
import { useRxDatabase } from 'rxdb/plugins/react'
import { useAuthToken } from '../auth/useAuthToken'
import type { ClotheslineDatabase } from '../db'
import { startReplication } from '../db/replication'
import { startUploadQueue } from '../photos/uploadQueue'
import { useOnline } from './useOnline'
import { useSyncStatus } from './useSyncStatus'

// The sync *engine*, split from the sync *badge* (SyncStatusBadge). It starts
// replication and the photo upload queue once, high in the authenticated tree,
// and publishes the resulting status through context — so the badge can live
// wherever it's shown (now: only inside the account menu) without the two
// background workers' lifecycle being tied to whether that menu is open.
//
// Mounted once, always on. Rendering the badge somewhere it isn't always
// present must not stop replication — hence the engine is here, not in the badge.

export type SyncState = 'idle' | 'active' | 'uploading' | 'error' | 'offline'

interface SyncValue {
  status: SyncState
  label: string
}

function labelFor(status: SyncState): string {
  switch (status) {
    case 'offline':
      return 'Offline — changes saved'
    case 'active':
      return 'Syncing…'
    case 'uploading':
      return 'Uploading photos…'
    case 'error':
      return 'Sync error — will retry'
    default:
      return 'Synced'
  }
}

// Default so the badge still renders (as "Synced") when read outside a provider,
// e.g. in a unit test that mounts a screen without the engine.
const SyncContext = createContext<SyncValue>({ status: 'idle', label: labelFor('idle') })

export function useSyncState(): SyncValue {
  return useContext(SyncContext)
}

export function SyncProvider({ children }: { children: ReactNode }) {
  const db = useRxDatabase<ClotheslineDatabase>()
  const token = useAuthToken()
  const tokenRef = useRef(token)
  tokenRef.current = token

  const [replicationStates, setReplicationStates] = useState<ReturnType<typeof startReplication>>(
    [],
  )

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

  // Photo *documents* replicate, but the image *bytes* upload on a separate
  // path (photos/uploadQueue.ts): a photo is `local_only` until this device has
  // PUT its bytes to Blob and written back `blob_key`. Replication can be fully
  // caught up while bytes are still pending — so the badge must count these, or
  // it reads "Synced" while the other device only sees "Waiting to upload".
  const [pendingUploads, setPendingUploads] = useState(0)
  useEffect(() => {
    if (!db) return
    const sub = db.photos
      .count({ selector: { local_only: true } })
      .$.subscribe((count) => setPendingUploads(count))
    return () => sub.unsubscribe()
  }, [db])

  const replicationStatus = useSyncStatus(replicationStates)
  const online = useOnline()

  // Offline is expected, not broken (spec §6.4) — and while offline every
  // replication attempt errors, so it would otherwise read "Sync error" for the
  // entire time the app is doing exactly what it's designed to do. When online
  // and replication is quiet, outstanding photo bytes still keep us out of
  // "Synced" — the upload queue settles them within a poll interval, either by
  // uploading the bytes or by removing a photo whose bytes are gone.
  const status: SyncState = !online
    ? 'offline'
    : replicationStatus === 'error'
      ? 'error'
      : replicationStatus === 'active'
        ? 'active'
        : pendingUploads > 0
          ? 'uploading'
          : 'idle'

  return (
    <SyncContext.Provider value={{ status, label: labelFor(status) }}>
      {children}
    </SyncContext.Provider>
  )
}
