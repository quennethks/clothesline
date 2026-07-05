import { Route, Routes } from 'react-router'
import { useAuth } from 'react-oidc-context'
import { SignIn } from './auth/SignIn'
import { Callback } from './auth/Callback'
import HealthStatus from './HealthStatus'

// Placeholder authenticated landing screen — replaced by the real Home /
// load-list screen in M3.
function AuthenticatedHome() {
  return (
    <main>
      <h1>Clothesline</h1>
      <HealthStatus />
    </main>
  )
}

function Home() {
  const auth = useAuth()
  if (auth.isLoading) return <p>Loading…</p>
  return auth.isAuthenticated ? <AuthenticatedHome /> : <SignIn />
}

function App() {
  return (
    <Routes>
      <Route path="/" element={<Home />} />
      <Route path="/auth/callback" element={<Callback />} />
    </Routes>
  )
}

export default App
