import { render, screen, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import HealthStatus from './HealthStatus'

describe('HealthStatus', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('shows ok when the health endpoint responds successfully', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({ ok: true } as Response),
    )

    render(<HealthStatus />)

    await waitFor(() => expect(screen.getByTestId('health-status')).toHaveTextContent('API: ok'))
  })

  it('shows unreachable when the health endpoint fails', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('network error')))

    render(<HealthStatus />)

    await waitFor(() =>
      expect(screen.getByTestId('health-status')).toHaveTextContent('API: unreachable'),
    )
  })
})
