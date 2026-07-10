import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
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

// Home renders SignOutButton, which reaches for the OIDC context this test
// deliberately doesn't mount.
const signoutRedirect = vi.fn()
const removeUser = vi.fn()
vi.mock('react-oidc-context', () => ({
  useAuth: () => ({ signoutRedirect, removeUser }),
}))

describe('Home', () => {
  let db: ClotheslineDatabase

  beforeEach(async () => {
    vi.clearAllMocks()
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

  it('signs out after the confirm dialog is accepted', async () => {
    render(
      <MemoryRouter>
        <RxDatabaseProvider database={db}>
          <Home />
        </RxDatabaseProvider>
      </MemoryRouter>,
    )

    fireEvent.click(screen.getByLabelText('Sign out'))
    expect(signoutRedirect).not.toHaveBeenCalled()

    // The icon button and the dialog's confirm button share the name
    // "Sign out", so reach for the one inside the dialog.
    const dialog = screen.getByRole('dialog')
    fireEvent.click(within(dialog).getByRole('button', { name: 'Sign out' }))
    await waitFor(() => expect(signoutRedirect).toHaveBeenCalledOnce())
  })
})
