import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router'
import { RxDatabaseProvider } from 'rxdb/plugins/react'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import type { ClotheslineDatabase } from '../db'
import { createLoad } from '../domain/loads'
import { createTestDb } from '../domain/testDb'
import { Draft } from './Draft'

describe('Draft', () => {
  let db: ClotheslineDatabase
  let loadId: string

  beforeEach(async () => {
    db = await createTestDb()
    loadId = await createLoad(db, 'user-1')
  })

  afterEach(async () => {
    await db.close()
  })

  it('tap increments the count and the running total immediately', async () => {
    render(
      <MemoryRouter>
        <RxDatabaseProvider database={db}>
          <Draft loadId={loadId} />
        </RxDatabaseProvider>
      </MemoryRouter>,
    )

    await waitFor(() => expect(screen.getByTestId('draft-total')).toHaveTextContent('0'))

    fireEvent.click(await screen.findByLabelText('Increase Shirts'))

    await waitFor(() => expect(screen.getByTestId('count-Shirts')).toHaveTextContent('1'))
    await waitFor(() => expect(screen.getByTestId('draft-total')).toHaveTextContent('1'))
  })
})
