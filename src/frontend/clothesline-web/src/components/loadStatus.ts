import type { LoadDocType } from '../db/schemas/loads.schema'

// Display-only status. The persisted state machine is draft|sent|closed
// (loads.schema.ts); "receiving" is derived — a sent load that already has a
// received total recorded — and is never written back to the document.
export type DisplayStatus = 'draft' | 'sent' | 'receiving' | 'closed'

export function displayStatus(load: LoadDocType): DisplayStatus {
  if (load.status === 'sent' && load.total_received !== null) return 'receiving'
  return load.status
}
