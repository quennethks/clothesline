import { useAuth } from 'react-oidc-context'

// Thin accessor for the current access token, used by RxDB replication's
// pull/push requests (M4) — react-oidc-context's automaticSilentRenew keeps
// `auth.user` refreshed, so callers always read the latest token.
export function useAuthToken(): string | undefined {
  const auth = useAuth()
  return auth.user?.access_token
}
