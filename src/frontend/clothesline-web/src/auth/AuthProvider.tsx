import type { ReactNode } from 'react'
import { AuthProvider as OidcAuthProvider } from 'react-oidc-context'
import { oidcConfig } from './oidcConfig'

export function AuthProvider({ children }: { children: ReactNode }) {
  return (
    <OidcAuthProvider
      {...oidcConfig}
      onSigninCallback={() => {
        // strips the ?code=&state= query off the callback URL once the
        // exchange completes, so a page reload doesn't replay it
        window.history.replaceState({}, document.title, window.location.pathname)
      }}
    >
      {children}
    </OidcAuthProvider>
  )
}
