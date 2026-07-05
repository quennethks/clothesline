const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? ''

export interface SyncCheckpoint {
  id: string
  updated_at: string
}

interface PullResponse<RxDocType> {
  documents: RxDocType[]
  checkpoint: SyncCheckpoint
}

// RxDB's push handler rows use camelCase (newDocumentState/assumedMasterState)
// internally — the wire contract to our API is snake_case end-to-end
// (spec §4), so this is the one place that gets translated.
interface PushRow<RxDocType> {
  newDocumentState: RxDocType
  assumedMasterState?: RxDocType
}

async function authorizedFetch(
  path: string,
  init: RequestInit,
  getToken: () => string | undefined,
): Promise<Response> {
  const token = getToken()
  const headers = new Headers(init.headers)
  if (token) headers.set('Authorization', `Bearer ${token}`)
  return fetch(`${API_BASE_URL}${path}`, { ...init, headers })
}

export function createPullHandler<RxDocType>(collectionName: string, getToken: () => string | undefined) {
  return async (
    lastCheckpoint: SyncCheckpoint | undefined,
    batchSize: number,
  ): Promise<PullResponse<RxDocType>> => {
    const params = new URLSearchParams({ batch_size: String(batchSize) })
    if (lastCheckpoint) {
      params.set('id', lastCheckpoint.id)
      params.set('updated_at', lastCheckpoint.updated_at)
    }
    const res = await authorizedFetch(
      `/sync/${collectionName}?${params.toString()}`,
      { method: 'GET' },
      getToken,
    )
    if (!res.ok) {
      throw new Error(`pull ${collectionName} failed: ${res.status}`)
    }
    return (await res.json()) as PullResponse<RxDocType>
  }
}

export function createPushHandler<RxDocType>(collectionName: string, getToken: () => string | undefined) {
  return async (rows: PushRow<RxDocType>[]): Promise<RxDocType[]> => {
    const body = rows.map((row) => ({
      new_document_state: row.newDocumentState,
      assumed_master_state: row.assumedMasterState ?? null,
    }))
    const res = await authorizedFetch(
      `/sync/${collectionName}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      },
      getToken,
    )
    if (!res.ok) {
      throw new Error(`push ${collectionName} failed: ${res.status}`)
    }
    const conflicts = (await res.json()) as (RxDocType | null)[]
    // A `null` conflict entry means a rejected create with no prior master
    // doc to hand back (spec §5.1/§5.2's polymorphic photo_links edge
    // case) — RxDB's push contract has no "drop this local doc" signal, so
    // it's dropped from what we report back rather than surfaced as a
    // resolvable conflict. Accepted simplification: nothing produces this
    // case yet (M6 is the first UI that creates photo_links).
    return conflicts.filter((doc): doc is RxDocType => doc !== null)
  }
}

// The client-only `local_only` flag (spec §4.1/§8.1) never travels to the
// server — stripped before push, defaulted to false on pull (a doc that
// synced in from elsewhere is, by definition, not "local-only-and-unsynced"
// on this device).
export function stripLocalOnly<T extends { local_only?: boolean }>(doc: T): Omit<T, 'local_only'> {
  const { local_only: _localOnly, ...rest } = doc
  return rest
}

export function defaultLocalOnly<T extends { local_only?: boolean }>(doc: T): T & { local_only: boolean } {
  return { ...doc, local_only: doc.local_only ?? false }
}
