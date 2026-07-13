import type { ClotheslineDatabase } from '../db'
import { nowIso } from './shared'

export type ReceiveOutcome = 'matched' | 'mismatch' | 'skipped'

// The total is skippable (PRD §3.1(10)); surplus (received > sent) is
// allowed without validation — it's recorded as reality, not blocked
// (spec §5.4 / PRD §7.4). Match closes immediately; mismatch/skip route to
// the per-category check (Closed.tsx), which later calls closeLoad.
export async function submitReceivedTotal(
  db: ClotheslineDatabase,
  loadId: string,
  totalReceived: number | null,
): Promise<ReceiveOutcome> {
  const load = await db.loads.findOne(loadId).exec()
  if (!load) throw new Error(`Load ${loadId} not found`)

  if (totalReceived === null) {
    return 'skipped'
  }

  if (totalReceived === load.total_sent) {
    await load.incrementalPatch({
      total_received: totalReceived,
      status: 'closed',
      updated_at: nowIso(),
    })
    return 'matched'
  }

  await load.incrementalPatch({ total_received: totalReceived, updated_at: nowIso() })
  return 'mismatch'
}
