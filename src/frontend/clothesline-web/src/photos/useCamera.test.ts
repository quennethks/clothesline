import { act, renderHook, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { DEVICE_STORAGE_KEY, useCamera } from './useCamera'

// The entire getUserMedia surface driven off a mocked navigator.mediaDevices —
// no browser, no camera. These are the failure modes that are otherwise only
// reachable by physically denying a permission or unplugging a webcam (spec §8).

interface FakeStream {
  stream: MediaStream
  track: { stop: ReturnType<typeof vi.fn> }
}

function makeStream(): FakeStream {
  const track = { stop: vi.fn(), kind: 'video' }
  const stream = { getTracks: () => [track] } as unknown as MediaStream
  return { stream, track }
}

const getUserMedia = vi.fn()
const enumerateDevices = vi.fn()

const VIDEO_INPUTS: MediaDeviceInfo[] = [
  { deviceId: 'cam-a', kind: 'videoinput', label: 'Cam A', groupId: '', toJSON: () => ({}) },
  { deviceId: 'cam-b', kind: 'videoinput', label: 'Cam B', groupId: '', toJSON: () => ({}) },
]

/** matchMedia is absent in jsdom; drive the touch/desktop branch explicitly. */
function setPointer(coarse: boolean) {
  vi.stubGlobal('matchMedia', (query: string) => ({
    matches: query.includes('coarse') ? coarse : false,
    media: query,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
  }))
}

function domException(name: string): DOMException {
  return Object.assign(new Error(name), { name }) as unknown as DOMException
}

beforeEach(() => {
  localStorage.clear()
  getUserMedia.mockReset()
  enumerateDevices.mockReset()
  enumerateDevices.mockResolvedValue(VIDEO_INPUTS)
  setPointer(false) // desktop by default
  vi.stubGlobal('navigator', {
    mediaDevices: { getUserMedia, enumerateDevices },
  } as unknown as Navigator)
  vi.stubGlobal('isSecureContext', true)
})

afterEach(() => {
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})

describe('useCamera — acquisition', () => {
  it('goes Live and only then enumerates devices (labels are empty before a grant)', async () => {
    getUserMedia.mockResolvedValue(makeStream().stream)

    const { result } = renderHook(() => useCamera())
    expect(result.current.status).toBe('requesting')

    await waitFor(() => expect(result.current.status).toBe('live'))
    expect(getUserMedia).toHaveBeenCalledTimes(1)
    expect(enumerateDevices).toHaveBeenCalledTimes(1)
    expect(result.current.devices).toHaveLength(2)
    expect(result.current.canSwitch).toBe(true)
  })

  it('requests environment facing at 1080p ideal, never exact', async () => {
    getUserMedia.mockResolvedValue(makeStream().stream)
    renderHook(() => useCamera())

    await waitFor(() => expect(getUserMedia).toHaveBeenCalled())
    expect(getUserMedia).toHaveBeenCalledWith({
      video: { facingMode: 'environment', width: { ideal: 1920 }, height: { ideal: 1080 } },
    })
  })
})

describe('useCamera — Unavailable reasons', () => {
  it.each([
    ['NotAllowedError', 'denied'],
    ['NotFoundError', 'not-found'],
    ['NotReadableError', 'in-use'],
  ])('maps %s to reason %s and does not enumerate', async (errorName, reason) => {
    getUserMedia.mockRejectedValue(domException(errorName))

    const { result } = renderHook(() => useCamera())
    await waitFor(() => expect(result.current.status).toBe('unavailable'))

    expect(result.current.reason).toBe(reason)
    expect(enumerateDevices).not.toHaveBeenCalled()
  })

  it('maps an absent mediaDevices to unsupported in a secure context', async () => {
    vi.stubGlobal('navigator', {} as unknown as Navigator)

    const { result } = renderHook(() => useCamera())
    await waitFor(() => expect(result.current.status).toBe('unavailable'))
    expect(result.current.reason).toBe('unsupported')
  })

  it('maps an absent mediaDevices to insecure outside a secure context', async () => {
    vi.stubGlobal('navigator', {} as unknown as Navigator)
    vi.stubGlobal('isSecureContext', false)

    const { result } = renderHook(() => useCamera())
    await waitFor(() => expect(result.current.status).toBe('unavailable'))
    expect(result.current.reason).toBe('insecure')
  })

  it('recovers to Live when Try again is pressed', async () => {
    getUserMedia.mockRejectedValueOnce(domException('NotReadableError'))
    getUserMedia.mockResolvedValue(makeStream().stream)

    const { result } = renderHook(() => useCamera())
    await waitFor(() => expect(result.current.status).toBe('unavailable'))

    act(() => result.current.retry())
    await waitFor(() => expect(result.current.status).toBe('live'))
  })
})

describe('useCamera — teardown (the camera light going out, spec §6)', () => {
  it('stops the tracks on unmount', async () => {
    const { stream, track } = makeStream()
    getUserMedia.mockResolvedValue(stream)

    const { result, unmount } = renderHook(() => useCamera())
    await waitFor(() => expect(result.current.status).toBe('live'))

    unmount()
    expect(track.stop).toHaveBeenCalled()
  })

  it('stops the tracks when stop() is called (cancel / confirm / Escape)', async () => {
    const { stream, track } = makeStream()
    getUserMedia.mockResolvedValue(stream)

    const { result } = renderHook(() => useCamera())
    await waitFor(() => expect(result.current.status).toBe('live'))

    act(() => result.current.stop())
    expect(track.stop).toHaveBeenCalled()
  })

  it('stops the old stream before requesting the new one on a device switch', async () => {
    const first = makeStream()
    const second = makeStream()
    getUserMedia.mockResolvedValueOnce(first.stream).mockResolvedValueOnce(second.stream)

    const { result } = renderHook(() => useCamera())
    await waitFor(() => expect(result.current.status).toBe('live'))

    act(() => result.current.selectDevice('cam-b'))
    await waitFor(() => expect(getUserMedia).toHaveBeenCalledTimes(2))

    // The old stream is torn down before the second acquire — some devices
    // refuse to open a second camera while the first is still live.
    expect(first.track.stop).toHaveBeenCalled()
    expect(getUserMedia).toHaveBeenLastCalledWith({
      video: { deviceId: { exact: 'cam-b' }, width: { ideal: 1920 }, height: { ideal: 1080 } },
    })
  })

  it('stops the stream when the tab is backgrounded', async () => {
    const { stream, track } = makeStream()
    getUserMedia.mockResolvedValue(stream)

    const { result } = renderHook(() => useCamera())
    await waitFor(() => expect(result.current.status).toBe('live'))

    act(() => {
      vi.spyOn(document, 'visibilityState', 'get').mockReturnValue('hidden')
      document.dispatchEvent(new Event('visibilitychange'))
    })
    expect(track.stop).toHaveBeenCalled()
  })
})

describe('useCamera — device selection (spec §3.3)', () => {
  it('opens with a remembered desktop deviceId and re-picks it', async () => {
    localStorage.setItem(DEVICE_STORAGE_KEY, 'cam-b')
    getUserMedia.mockResolvedValue(makeStream().stream)

    renderHook(() => useCamera())
    await waitFor(() => expect(getUserMedia).toHaveBeenCalled())
    expect(getUserMedia).toHaveBeenCalledWith({
      video: { deviceId: { exact: 'cam-b' }, width: { ideal: 1920 }, height: { ideal: 1080 } },
    })
  })

  it('falls back to the default when a stored deviceId no longer resolves', async () => {
    localStorage.setItem(DEVICE_STORAGE_KEY, 'gone')
    getUserMedia.mockRejectedValueOnce(domException('OverconstrainedError'))
    getUserMedia.mockResolvedValue(makeStream().stream)

    const { result } = renderHook(() => useCamera())
    await waitFor(() => expect(result.current.status).toBe('live'))

    // The stale id is cleared and the second acquire uses facingMode instead.
    expect(localStorage.getItem(DEVICE_STORAGE_KEY)).toBeNull()
    expect(getUserMedia).toHaveBeenLastCalledWith({
      video: { facingMode: 'environment', width: { ideal: 1920 }, height: { ideal: 1080 } },
    })
  })

  it('does not persist a facing preference on touch — always opens rear', async () => {
    setPointer(true)
    localStorage.setItem(DEVICE_STORAGE_KEY, 'cam-b')
    getUserMedia.mockResolvedValue(makeStream().stream)

    renderHook(() => useCamera())
    await waitFor(() => expect(getUserMedia).toHaveBeenCalled())
    // Touch ignores the stored id and opens by facingMode: environment.
    expect(getUserMedia).toHaveBeenCalledWith({
      video: { facingMode: 'environment', width: { ideal: 1920 }, height: { ideal: 1080 } },
    })
  })
})
