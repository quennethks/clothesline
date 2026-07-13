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
import { SyncStatusIndicator } from './sync/SyncStatusIndicator'

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
        <div className="stage">
          <div className="app shadow-sm">
            <Routes>
              <Route path="/" element={<Home />} />
              <Route path="/loads/:id" element={<LoadDetail />} />
              <Route path="/loads/:id/receive" element={<ReceiveRoute />} />
              <Route path="/loads/:id/checkoff" element={<CheckoffRoute />} />
              <Route path="/loads/:id/gallery" element={<Gallery />} />
            </Routes>
            <SyncStatusIndicator />
            <InstallPrompt />
          </div>
        </div>
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
