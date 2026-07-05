import { useEffect, useState } from 'react'
import { useAuth } from 'react-oidc-context'

export interface CurrentUser {
  id: string
  sub: string
  email: string
}

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? ''

// Fetches GET /auth/me once per sign-in to learn our server-generated
// User.id (spec §4.1) — the client needs this to stamp `user_id` on every
// Load it creates locally, since that field is required for server-side
// ownership scoping once M4's sync lands.
export function useCurrentUser(): { user: CurrentUser | null; loading: boolean } {
  const auth = useAuth()
  const [user, setUser] = useState<CurrentUser | null>(null)
  const [loading, setLoading] = useState(true)
  const accessToken = auth.user?.access_token

  useEffect(() => {
    let cancelled = false
    if (!accessToken) {
      setLoading(false)
      return
    }
    setLoading(true)
    fetch(`${API_BASE_URL}/auth/me`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    })
      .then((res) => (res.ok ? (res.json() as Promise<CurrentUser>) : Promise.reject(res)))
      .then((data) => {
        if (!cancelled) setUser(data)
      })
      .catch(() => {
        if (!cancelled) setUser(null)
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [accessToken])

  return { user, loading }
}
