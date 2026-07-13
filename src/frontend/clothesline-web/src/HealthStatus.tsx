import { useEffect, useState } from 'react'
import { getConfig } from './runtimeConfig'

type HealthState = 'checking' | 'ok' | 'unreachable'


function HealthStatus() {
  const [state, setState] = useState<HealthState>('checking')

  useEffect(() => {
    let cancelled = false

    async function checkHealth() {
      try {
        const response = await fetch(`${getConfig().apiBaseUrl}/health`)
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
