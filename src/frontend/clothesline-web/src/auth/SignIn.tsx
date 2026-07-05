import { useAuth } from 'react-oidc-context'

// Email-only start (PRD §4.1): this screen has no email field of its own —
// it redirects straight to Zitadel Login V2, which collects the email and
// handles the passwordless OTP exchange.
export function SignIn() {
  const auth = useAuth()

  if (auth.isLoading) {
    return <p>Loading…</p>
  }

  return (
    <main>
      <h1>Clothesline</h1>
      {auth.error && <p role="alert">Sign-in error: {auth.error.message}</p>}
      <button type="button" onClick={() => auth.signinRedirect()}>
        Sign in with email
      </button>
    </main>
  )
}
