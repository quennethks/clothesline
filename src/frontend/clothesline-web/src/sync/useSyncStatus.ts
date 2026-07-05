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
    let hasError = false

    const recompute = () => {
      setStatus(hasError ? 'error' : activeFlags.some(Boolean) ? 'active' : 'idle')
    }

    const subs = replicationStates.flatMap((state, index) => [
      state.active$.subscribe((active) => {
        activeFlags[index] = active
        recompute()
      }),
      state.error$.subscribe(() => {
        hasError = true
        recompute()
      }),
    ])

    return () => {
      subs.forEach((sub) => sub.unsubscribe())
    }
  }, [replicationStates])

  return status
}
