import type { ReactNode } from 'react'
import { AuthProvider as OidcAuthProvider } from 'react-oidc-context'
import { getOidcConfig } from './oidcConfig'

export function AuthProvider({ children }: { children: ReactNode }) {
  // Resolved at render, not at module load — the issuer and client_id come from
  // the API's /config, which main.tsx awaits before mounting the tree.
  return (
    <OidcAuthProvider
      {...getOidcConfig()}
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
