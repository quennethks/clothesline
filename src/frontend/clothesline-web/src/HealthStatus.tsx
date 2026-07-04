import { useEffect, useState } from 'react'

type HealthState = 'checking' | 'ok' | 'unreachable'

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? ''

function HealthStatus() {
  const [state, setState] = useState<HealthState>('checking')

  useEffect(() => {
    let cancelled = false

    async function checkHealth() {
      try {
        const response = await fetch(`${API_BASE_URL}/health`)
        if (!cancelled) setState(response.ok ? 'ok' : 'unreachable')
      } catch {
        if (!cancelled) setState('unreachable')
      }
    }

    checkHealth()
    const interval = setInterval(checkHealth, 5000)
    return () => {
      cancelled = true
      clearInterval(interval)
    }
  }, [])

  const label =
    state === 'checking' ? 'Checking API…' : state === 'ok' ? 'API: ok' : 'API: unreachable'

  return (
    <div data-testid="health-status" data-state={state}>
      {label}
    </div>
  )
}

export default HealthStatus
