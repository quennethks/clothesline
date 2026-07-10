import { useAuth } from 'react-oidc-context'
import { Icon, type IconName } from '../components/Icon'

const FEATURES: { icon: IconName; title: string; body: string }[] = [
  {
    icon: 'bag',
    title: 'Count what goes out',
    body: 'Itemize every load before it leaves your door.',
  },
  {
    icon: 'check-circle',
    title: 'Check what comes back',
    body: 'Reconcile the return count against what you sent.',
  },
  {
    icon: 'cloud-check',
    title: 'Works without signal',
    body: 'Count at the shop counter offline. It syncs when you reconnect.',
  },
]

// Email-only start (PRD §4.1): this screen has no email field of its own —
// it redirects straight to Zitadel Login V2, which collects the email and
// handles the passwordless OTP exchange.
export function SignIn() {
  const auth = useAuth()
  const redirecting = auth.activeNavigator === 'signinRedirect'

  return (
    <main className="landing">
      <div className="landing-card">
        <span className="brand-mark">
          <Icon name="bag" />
        </span>
        <h1 className="wordmark">Clothesline</h1>
        <p className="landing-tagline">
          Know exactly what you sent. Know exactly what came back.
        </p>

        {auth.error && (
          <div className="landing-alert" role="alert">
            Sign-in failed: {auth.error.message}
          </div>
        )}

        <button
          type="button"
          className="btn-signin"
          onClick={() => auth.signinRedirect()}
          disabled={redirecting}
        >
          <Icon name="envelope" />
          {redirecting ? 'Opening sign-in…' : 'Continue with email'}
        </button>

        {/* <p className="landing-foot">
          <Icon name="lock" />
          No password — we email you a one-time code.
        </p> */}

        <ul className="feature-list">
          {FEATURES.map((feature) => (
            <li key={feature.title}>
              <span className="feature-icon">
                <Icon name={feature.icon} />
              </span>
              <div>
                <div className="feature-title">{feature.title}</div>
                <div className="feature-body">{feature.body}</div>
              </div>
            </li>
          ))}
        </ul>
      </div>
    </main>
  )
}
