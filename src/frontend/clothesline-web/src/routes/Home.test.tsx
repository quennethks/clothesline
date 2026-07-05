import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router'
import { RxDatabaseProvider } from 'rxdb/plugins/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { ClotheslineDatabase } from '../db'
import { createLoad } from '../domain/loads'
import { createTestDb } from '../domain/testDb'
import { Home } from './Home'

vi.mock('../auth/useCurrentUser', () => ({
  useCurrentUser: () => ({
    user: { id: 'user-1', sub: 'sub-1', email: 'a@b.com' },
    loading: false,
  }),
}))

describe('Home', () => {
  let db: ClotheslineDatabase

  beforeEach(async () => {
    db = await createTestDb()
  })

  afterEach(async () => {
    await db.close()
  })

  it('renders one card per load with name, shop, status, and item count', async () => {
    const loadId = await createLoad(db, 'user-1')
    const load = await db.loads.findOne(loadId).exec()
    await load!.incrementalPatch({ shop_name: 'Wash & Fold' })

    render(
      <MemoryRouter>
        <RxDatabaseProvider database={db}>
          <Home />
        </RxDatabaseProvider>
      </MemoryRouter>,
    )

    const card = await screen.findByTestId('load-card')
    expect(card).toHaveTextContent(load!.name)
    expect(card).toHaveTextContent('Wash & Fold')
    expect(card).toHaveTextContent('draft')
    expect(card).toHaveTextContent('0 items')
  })

  it('has Duplicate and Delete icons wired on each card', async () => {
    await createLoad(db, 'user-1')

    render(
      <MemoryRouter>
        <RxDatabaseProvider database={db}>
          <Home />
        </RxDatabaseProvider>
      </MemoryRouter>,
    )

    await screen.findByTestId('load-card')
    expect(screen.getByLabelText('Duplicate')).toBeInTheDocument()
    expect(screen.getByLabelText('Delete')).toBeInTheDocument()
  })
})
