import { useSyncState } from './SyncProvider'

// The visible sync indicator (spec §6.4/§7). Reads the status the SyncProvider
// publishes; carries no lifecycle of its own, so it can be mounted only where
// it's shown — currently the account menu — without affecting replication.
// The data-testid/data-status hooks are what the offline e2e specs assert on.
export function SyncStatusBadge() {
  const { status, label } = useSyncState()
  return (
    <span className="sync-status" data-testid="sync-status" data-status={status}>
      <span className="sync-dot" aria-hidden="true" />
      {label}
    </span>
  )
}
