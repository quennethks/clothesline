import { WebStorageStateStore } from 'oidc-client-ts'
import type { UserManagerSettings } from 'oidc-client-ts'

import { getConfig } from '../runtimeConfig'

// A function, not a const: the issuer and client_id arrive from the API's
// /config at boot (see runtimeConfig.ts), so reading them at module-evaluation
// time would capture empty strings. Call this after loadRuntimeConfig().
//
// Tokens are persisted in localStorage (not the oidc-client-ts default
// in-memory store) so an installed PWA stays signed in across offline
// sessions (spec §5.5/§9) — the refresh token is the sensitive item this
// trades away default in-memory isolation for; accepted for a single-user
// consumer MVP.
export function getOidcConfig(): UserManagerSettings {
  const { oidcIssuer, oidcClientId } = getConfig()

  return {
    authority: oidcIssuer,
    client_id: oidcClientId,
    redirect_uri: `${window.location.origin}/auth/callback`,
    post_logout_redirect_uri: window.location.origin,
    response_type: 'code',
    // offline_access requests a refresh token so access can be renewed on
    // reconnect without forcing the user through Login V2 again.
    scope: 'openid profile email offline_access',
    userStore: new WebStorageStateStore({ store: window.localStorage }),
    automaticSilentRenew: true,
  }
}
