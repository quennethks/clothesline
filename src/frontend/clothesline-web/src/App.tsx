import { Route, Routes, useParams } from 'react-router'
import { useAuth } from 'react-oidc-context'
import { Callback } from './auth/Callback'
import { SignIn } from './auth/SignIn'
import { InstallPrompt } from './components/InstallPrompt'
import { ToastProvider } from './components/Toast'
import { DbProvider } from './db/DbProvider'
import { Closed } from './routes/Closed'
import { Gallery } from './routes/Gallery'
import { Home } from './routes/Home'
import { LoadDetail } from './routes/LoadDetail'
import { Receive } from './routes/Receive'
import { SyncProvider } from './sync/SyncProvider'

function ReceiveRoute() {
  const { id } = useParams<{ id: string }>()
  if (!id) return <p>Load not found</p>
  return <Receive loadId={id} />
}

// /loads/:id/checkoff always renders Closed regardless of status — it's the
// post-receive (mismatch/skip) per-category check, reached via explicit
// navigation from Receive.tsx rather than a persisted sub-status (spec's
// state machine only has draft|sent|closed).
function CheckoffRoute() {
  const { id } = useParams<{ id: string }>()
  if (!id) return <p>Load not found</p>
  return <Closed loadId={id} />
}

function AuthenticatedApp() {
  return (
    <DbProvider>
      <ToastProvider>
        {/* SyncProvider runs replication + the photo upload queue and publishes
            status via context; the badge that shows it now lives only in the
            account menu (Home), so the engine sits high here, always mounted. */}
        <SyncProvider>
          <div className="stage">
            <div className="app">
              <Routes>
                <Route path="/" element={<Home />} />
                <Route path="/loads/:id" element={<LoadDetail />} />
                <Route path="/loads/:id/receive" element={<ReceiveRoute />} />
                <Route path="/loads/:id/checkoff" element={<CheckoffRoute />} />
                <Route path="/loads/:id/gallery" element={<Gallery />} />
              </Routes>
              <InstallPrompt />
            </div>
          </div>
        </SyncProvider>
      </ToastProvider>
    </DbProvider>
  )
}

function AppLoading() {
  return (
    <div className="app-loading" role="status">
      <span className="spinner-border" aria-hidden="true" />
      <span className="visually-hidden">Loading</span>
    </div>
  )
}

function App() {
  const auth = useAuth()

  if (auth.isLoading) return <AppLoading />


  return (
    <Routes>
      <Route path="/auth/callback" element={<Callback />} />
      <Route path="/*" element={auth.isAuthenticated ? <AuthenticatedApp /> : <SignIn />} />
    </Routes>
  )
}

export default App
