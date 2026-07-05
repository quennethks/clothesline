import { WebStorageStateStore } from 'oidc-client-ts'
import type { UserManagerSettings } from 'oidc-client-ts'

// Tokens are persisted in localStorage (not the oidc-client-ts default
// in-memory store) so an installed PWA stays signed in across offline
// sessions (spec §5.5/§9) — the refresh token is the sensitive item this
// trades away default in-memory isolation for; accepted for a single-user
// consumer MVP.
export const oidcConfig: UserManagerSettings = {
  authority: import.meta.env.VITE_OIDC_ISSUER,
  client_id: import.meta.env.VITE_OIDC_CLIENT_ID,
  redirect_uri: `${window.location.origin}/auth/callback`,
  post_logout_redirect_uri: window.location.origin,
  response_type: 'code',
  // offline_access requests a refresh token so access can be renewed on
  // reconnect without forcing the user through Login V2 again.
  scope: 'openid profile email offline_access',
  userStore: new WebStorageStateStore({ store: window.localStorage }),
  automaticSilentRenew: true,
}
