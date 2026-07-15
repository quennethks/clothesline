import { useEffect } from 'react'
import { useNavigate } from 'react-router'
import { useAuth } from 'react-oidc-context'

// Route target for redirect_uri (VITE_OIDC_CLIENT_ID's registered callback).
// react-oidc-context detects the ?code=&state= on this URL and completes the
// exchange itself; this component just waits for that and then leaves the
// callback URL behind.
export function Callback() {
  const auth = useAuth()
  const navigate = useNavigate()

  useEffect(() => {
    if (auth.isAuthenticated) {
      navigate('/', { replace: true })
    }
  }, [auth.isAuthenticated, navigate])

  if (auth.error) {
    return (
      <main className="landing">
        <div className="landing-card">
          <p className="landing-alert" role="alert">
            Sign-in failed: {auth.error.message}
          </p>
        </div>
      </main>
    )
  }

  return (
    <main className="landing">
      <div className="app-loading" role="status">
        <span className="spinner-border" aria-hidden="true" />
        <span className="visually-hidden">Completing sign-in…</span>
      </div>
    </main>
  )
}
