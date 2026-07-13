import { fireEvent, render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { SignIn } from './SignIn'

const signinRedirect = vi.fn()
let auth: {
  signinRedirect: typeof signinRedirect
  error?: Error
  activeNavigator?: string
}

vi.mock('react-oidc-context', () => ({
  useAuth: () => auth,
}))

describe('SignIn', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    auth = { signinRedirect }
  })

  it('starts the Zitadel redirect from the email CTA', () => {
    render(<SignIn />)

    fireEvent.click(screen.getByRole('button', { name: /continue with email/i }))
    expect(signinRedirect).toHaveBeenCalledOnce()
  })

  it('disables the CTA while the redirect is in flight', () => {
    auth = { signinRedirect, activeNavigator: 'signinRedirect' }
    render(<SignIn />)

    expect(screen.getByRole('button', { name: /opening sign-in/i })).toBeDisabled()
  })

  it('surfaces a failed sign-in as an alert', () => {
    auth = { signinRedirect, error: new Error('code expired') }
    render(<SignIn />)

    expect(screen.getByRole('alert')).toHaveTextContent('code expired')
  })
})
