import type { DisplayStatus } from './loadStatus'

// Raw lowercase status stays the text content (CSS uppercases it) so it
// remains readable to assistive tech and to the existing Home tests.
export function StatusPill({ status }: { status: DisplayStatus }) {
  return <span className={`status-pill st-${status}`}>{status}</span>
}
