import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router'
import 'bootstrap/dist/css/bootstrap.min.css'
import './index.css'
import './theme.css'
import App from './App.tsx'
import { AuthProvider } from './auth/AuthProvider'
import { loadRuntimeConfig } from './runtimeConfig'

// The OIDC issuer and client_id are served by the API at runtime rather than
// compiled into this bundle (see runtimeConfig.ts), so they must be resolved
// before AuthProvider mounts — it configures the OIDC client from them once, at
// render. Offline this falls back to the cached copy, so the app still opens.
await loadRuntimeConfig()

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <BrowserRouter>
      <AuthProvider>
        <App />
      </AuthProvider>
    </BrowserRouter>
  </StrictMode>,
)
