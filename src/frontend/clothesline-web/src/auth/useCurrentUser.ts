import { useEffect, useState } from 'react'
import { useAuth } from 'react-oidc-context'

export interface CurrentUser {
  id: string
  sub: string
  email: string
}

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? ''
const CACHE_KEY = 'clothesline.current-user'

// Fetches GET /auth/me to learn our server-generated User.id (spec §4.1) — the
// client needs it to stamp `user_id` on every Load it creates locally.
//
// The result is cached, because that fetch is the *only* network call standing
// between a signed-in user and the core flow: without a cached id, an offline
// launch can't create a load at all (spec §6.4 requires it can). Sign-in itself
// is online-only by nature, so by the time we're offline this has always been
// fetched at least once. The cache is keyed by `sub` so a different user
// signing in on the same device can never inherit the previous one's id.

function readCache(sub: string | undefined): CurrentUser | null {
  if (!sub) return null
  try {
    const cached = JSON.parse(localStorage.getItem(CACHE_KEY) ?? 'null') as CurrentUser | null
    return cached?.sub === sub ? cached : null
  } catch {
    return null
  }
}

export function useCurrentUser(): { user: CurrentUser | null; loading: boolean } {
  const auth = useAuth()
  const accessToken = auth.user?.access_token
  const sub = auth.user?.profile.sub

  const [user, setUser] = useState<CurrentUser | null>(() => readCache(sub))
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    if (!accessToken) {
      setLoading(false)
      return
    }

    // Show the cached identity immediately; refresh it from the server in the
    // background (the email can change upstream, spec §5.5).
    const cached = readCache(sub)
    if (cached && !cancelled) setUser(cached)
    setLoading(!cached)

    fetch(`${API_BASE_URL}/auth/me`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    })
      .then((res) => (res.ok ? (res.json() as Promise<CurrentUser>) : Promise.reject(res)))
      .then((data) => {
        localStorage.setItem(CACHE_KEY, JSON.stringify(data))
        if (!cancelled) setUser(data)
      })
      .catch(() => {
        // Offline (or the API is down) — the cached identity stands. Only clear
        // it if we never had one, so the UI can say we're not ready yet.
        if (!cancelled && !cached) setUser(null)
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })

    return () => {
      cancelled = true
    }
  }, [accessToken, sub])

  return { user, loading }
}
