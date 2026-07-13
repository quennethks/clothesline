import { useEffect, useState } from 'react'
import type { RxReplicationState } from 'rxdb/plugins/replication'

export type SyncStatus = 'idle' | 'active' | 'error'

// Merges every collection's replication state into one badge (spec §6.4) —
// a subtle indicator that never blocks the core flow.
export function useSyncStatus(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  replicationStates: RxReplicationState<any, any>[],
): SyncStatus {
  const [status, setStatus] = useState<SyncStatus>('idle')

  useEffect(() => {
    if (replicationStates.length === 0) {
      setStatus('idle')
      return
    }

    const activeFlags = new Array(replicationStates.length).fill(false)
    const errorFlags = new Array(replicationStates.length).fill(false)

    const recompute = () => {
      setStatus(errorFlags.some(Boolean) ? 'error' : activeFlags.some(Boolean) ? 'active' : 'idle')
    }

    const subs = replicationStates.flatMap((state, index) => [
      state.active$.subscribe((active) => {
        activeFlags[index] = active
        recompute()
      }),
      state.error$.subscribe(() => {
        errorFlags[index] = true
        recompute()
      }),
      // An error must be *clearable*. Going offline guarantees one, so a
      // latching error flag would leave the app permanently claiming to be
      // broken after its most ordinary event. A completed pull or push is the
      // proof this collection is talking to the server again.
      state.received$.subscribe(() => {
        errorFlags[index] = false
        recompute()
      }),
      state.sent$.subscribe(() => {
        errorFlags[index] = false
        recompute()
      }),
    ])

    // A cycle with nothing to send and nothing to receive emits on neither of
    // those, so reconnecting clears the errors and re-drives replication too.
    const onOnline = () => {
      errorFlags.fill(false)
      recompute()
      for (const state of replicationStates) void state.reSync()
    }
    window.addEventListener('online', onOnline)

    return () => {
      window.removeEventListener('online', onOnline)
      subs.forEach((sub) => sub.unsubscribe())
    }
  }, [replicationStates])

  return status
}
