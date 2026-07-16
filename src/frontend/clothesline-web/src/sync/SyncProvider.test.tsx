import { render, screen, waitFor } from '@testing-library/react'
import { RxDatabaseProvider } from 'rxdb/plugins/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { ClotheslineDatabase } from '../db'
import { createTestDb } from '../domain/testDb'
import { SyncProvider } from './SyncProvider'
import { SyncStatusBadge } from './SyncStatusBadge'

// The engine's two background workers are stubbed: replication would hit the
// network, and — the point of this test — the upload queue would drain the
// pending photo and flip `local_only` before we could observe the badge.
vi.mock('../db/replication', () => ({ startReplication: () => [] }))
vi.mock('../photos/uploadQueue', () => ({ startUploadQueue: () => () => {} }))
vi.mock('../auth/useAuthToken', () => ({ useAuthToken: () => undefined }))

async function insertPhoto(db: ClotheslineDatabase, localOnly: boolean) {
  const now = new Date().toISOString()
  await db.photos.insert({
    id: crypto.randomUUID(),
    blob_key: localOnly ? null : 'blob/key',
    content_type: 'image/webp',
    local_only: localOnly,
    created_at: now,
    updated_at: now,
    _deleted: false,
  })
}

describe('SyncProvider photo-upload status', () => {
  let db: ClotheslineDatabase

  beforeEach(async () => {
    db = await createTestDb()
  })
  afterEach(async () => {
    await db.close()
  })

  const renderBadge = () =>
    render(
      <RxDatabaseProvider database={db}>
        <SyncProvider>
          <SyncStatusBadge />
        </SyncProvider>
      </RxDatabaseProvider>,
    )

  it('reports "Uploading photos…" while a photo is still local_only', async () => {
    await insertPhoto(db, true)
    renderBadge()

    await waitFor(() =>
      expect(screen.getByTestId('sync-status')).toHaveAttribute('data-status', 'uploading'),
    )
    expect(screen.getByTestId('sync-status')).toHaveTextContent('Uploading photos…')
  })

  it('reads "Synced" once no photos remain local_only', async () => {
    await insertPhoto(db, false)
    renderBadge()

    await waitFor(() =>
      expect(screen.getByTestId('sync-status')).toHaveAttribute('data-status', 'idle'),
    )
    expect(screen.getByTestId('sync-status')).toHaveTextContent('Synced')
  })

  it('flips from uploading to synced when the queue drains the last photo', async () => {
    await insertPhoto(db, true)
    renderBadge()

    await waitFor(() =>
      expect(screen.getByTestId('sync-status')).toHaveAttribute('data-status', 'uploading'),
    )

    const photo = await db.photos.findOne().exec()
    await photo!.incrementalPatch({ local_only: false, blob_key: 'blob/key' })

    await waitFor(() =>
      expect(screen.getByTestId('sync-status')).toHaveAttribute('data-status', 'idle'),
    )
  })
})
