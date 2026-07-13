import { useMemo } from 'react'
import { useParams } from 'react-router'
import { useLiveRxQuery } from 'rxdb/plugins/react'
import { Closed } from './Closed'
import { Draft } from './Draft'
import { Sent } from './Sent'

export function LoadDetail() {
  const { id } = useParams<{ id: string }>()
  // useLiveRxQuery's `query` must be a stable reference (see Home.tsx).
  const loadQuery = useMemo(() => ({ selector: { id } }), [id])
  const { results: loads } = useLiveRxQuery({ collection: 'loads', query: loadQuery })
  const load = loads[0]

  if (!id) return <p>Load not found</p>
  if (!load) return <p>Loading…</p>
  if (load.status === 'draft') return <Draft loadId={id} />
  if (load.status === 'sent') return <Sent loadId={id} />
  return <Closed loadId={id} />
}
