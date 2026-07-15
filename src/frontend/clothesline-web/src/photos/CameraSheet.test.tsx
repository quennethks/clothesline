import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { createRef } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { Camera } from './useCamera'
import { CameraSheet } from './CameraSheet'

// The component under test with its whole camera surface mocked — useCamera is
// unit-tested on its own (useCamera.test.ts); here we prove the §3.1 state
// machine, the desktop/touch control split, and that closing stops the stream.

let camera: Camera
let touch = false

vi.mock('./useCamera', async (importOriginal) => ({
  ...(await importOriginal<typeof import('./useCamera')>()),
  useCamera: () => camera,
  isTouchDevice: () => touch,
}))

const capturePhotoForCategory = vi.fn<() => Promise<string>>()
const capturePhotoForLoad = vi.fn<() => Promise<string>>()
vi.mock('./capture', () => ({
  capturePhotoForCategory: (...a: unknown[]) => capturePhotoForCategory(...(a as [])),
  capturePhotoForLoad: (...a: unknown[]) => capturePhotoForLoad(...(a as [])),
}))

const screenBatch = vi.fn()
vi.mock('./guards', () => ({ screenBatch: (...a: unknown[]) => screenBatch(...(a as [])) }))

vi.mock('rxdb/plugins/react', () => ({ useRxDatabase: () => ({}) }))

function makeCamera(overrides: Partial<Camera> = {}): Camera {
  return {
    status: 'live',
    reason: null,
    videoRef: createRef<HTMLVideoElement>(),
    devices: [
      { deviceId: 'a', kind: 'videoinput', label: 'Cam A', groupId: '', toJSON: () => ({}) },
      { deviceId: 'b', kind: 'videoinput', label: 'Cam B', groupId: '', toJSON: () => ({}) },
    ],
    deviceId: 'a',
    facingMode: 'environment',
    canSwitch: true,
    grabFrame: vi.fn().mockResolvedValue(new Blob(['frame'], { type: 'image/jpeg' })),
    flipFacing: vi.fn(),
    selectDevice: vi.fn(),
    retry: vi.fn(),
    stop: vi.fn(),
    ...overrides,
  }
}

beforeEach(() => {
  touch = false
  camera = makeCamera()
  capturePhotoForCategory.mockReset().mockResolvedValue('photo-1')
  capturePhotoForLoad.mockReset().mockResolvedValue('photo-1')
  screenBatch.mockReset()
})

afterEach(() => vi.restoreAllMocks())

/** The shutter is disabled until the video reports a frame. */
function readyVideo() {
  fireEvent.canPlay(document.querySelector('video')!)
}

describe('CameraSheet — Live', () => {
  it('renders the shutter (enabled once a frame arrives), Library, and the switch', () => {
    render(<CameraSheet loadId="L1" categoryId="C1" title="Shirts" onClose={vi.fn()} />)

    expect(screen.getByRole('button', { name: 'Take photo' })).toBeDisabled()
    readyVideo()
    expect(screen.getByRole('button', { name: 'Take photo' })).toBeEnabled()
    expect(screen.getByRole('button', { name: /Library/ })).toBeInTheDocument()
  })

  it('on desktop shows the device <select> and no "Use device camera"', () => {
    render(<CameraSheet loadId="L1" categoryId="C1" title="Shirts" onClose={vi.fn()} />)
    expect(screen.getByRole('combobox', { name: 'Choose camera' })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /Use device camera/ })).not.toBeInTheDocument()
  })

  it('on touch shows the facing-flip and "Use device camera"', () => {
    touch = true
    render(<CameraSheet loadId="L1" categoryId="C1" title="Shirts" onClose={vi.fn()} />)
    expect(screen.getByRole('button', { name: 'Switch camera' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Use device camera/ })).toBeInTheDocument()
    expect(screen.queryByRole('combobox')).not.toBeInTheDocument()
  })
})

describe('CameraSheet — shutter → review → use/retake', () => {
  it('Use photo writes the frame, stops the stream, and closes', async () => {
    const onClose = vi.fn()
    render(<CameraSheet loadId="L1" categoryId="C1" title="Shirts" onClose={onClose} />)
    readyVideo()

    fireEvent.click(screen.getByRole('button', { name: 'Take photo' }))
    const use = await screen.findByRole('button', { name: 'Use photo' })
    fireEvent.click(use)

    await waitFor(() => expect(capturePhotoForCategory).toHaveBeenCalledTimes(1))
    expect(camera.stop).toHaveBeenCalled()
    expect(onClose).toHaveBeenCalled()
  })

  it('Retake returns to Live and writes nothing', async () => {
    render(<CameraSheet loadId="L1" categoryId="C1" title="Shirts" onClose={vi.fn()} />)
    readyVideo()

    fireEvent.click(screen.getByRole('button', { name: 'Take photo' }))
    fireEvent.click(await screen.findByRole('button', { name: 'Retake' }))

    expect(await screen.findByRole('button', { name: 'Take photo' })).toBeInTheDocument()
    expect(capturePhotoForCategory).not.toHaveBeenCalled()
  })

  it('a failed frame save keeps the frame and returns to Review (Use photo retries)', async () => {
    capturePhotoForCategory.mockRejectedValueOnce(new Error('write failed'))
    render(<CameraSheet loadId="L1" categoryId="C1" title="Shirts" onClose={vi.fn()} />)
    readyVideo()

    fireEvent.click(screen.getByRole('button', { name: 'Take photo' }))
    fireEvent.click(await screen.findByRole('button', { name: 'Use photo' }))

    // Back in Review, with an alert — the frame was retained, not lost.
    expect(await screen.findByRole('alert')).toHaveTextContent("couldn't be saved")
    expect(screen.getByRole('button', { name: 'Use photo' })).toBeInTheDocument()
  })
})

describe('CameraSheet — Unavailable is a first-class state', () => {
  it('offers the picker, names the reason, and offers Try again for a denial', () => {
    camera = makeCamera({ status: 'unavailable', reason: 'denied' })
    render(<CameraSheet loadId="L1" categoryId="C1" title="Shirts" onClose={vi.fn()} />)

    expect(screen.getByRole('button', { name: /Choose existing photo/ })).toBeInTheDocument()
    expect(screen.getByText('Camera access blocked')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Try again' })).toBeInTheDocument()
  })

  it('omits Try again for a missing camera (retrying cannot help)', () => {
    camera = makeCamera({ status: 'unavailable', reason: 'not-found' })
    render(<CameraSheet loadId="L1" categoryId="C1" title="Shirts" onClose={vi.fn()} />)
    expect(screen.queryByRole('button', { name: 'Try again' })).not.toBeInTheDocument()
  })
})

describe('CameraSheet — files (§5)', () => {
  it('reports a partial failure and keeps the successes, staying open', async () => {
    // 3 selected: 1 rejected pre-decode, 2 accepted and written.
    screenBatch.mockResolvedValue({
      refusal: null,
      accepted: [new File(['a'], 'a.jpg', { type: 'image/jpeg' }), new File(['b'], 'b.jpg', { type: 'image/jpeg' })],
      rejected: [{ file: new File(['z'], 'z.zip'), reason: 'not an image' }],
    })
    const onClose = vi.fn()
    render(<CameraSheet loadId="L1" categoryId="C1" title="Shirts" onClose={onClose} />)

    fireEvent.change(screen.getByTestId('photo-input'), {
      target: { files: [new File([''], 'a'), new File([''], 'b'), new File([''], 'z')] },
    })

    expect(await screen.findByRole('alert')).toHaveTextContent('1 of 3 photos')
    expect(capturePhotoForCategory).toHaveBeenCalledTimes(2)
    expect(onClose).not.toHaveBeenCalled() // successes kept, sheet stays open
  })

  it('closes cleanly when every file lands', async () => {
    screenBatch.mockResolvedValue({
      refusal: null,
      accepted: [new File(['a'], 'a.jpg', { type: 'image/jpeg' })],
      rejected: [],
    })
    const onClose = vi.fn()
    render(<CameraSheet loadId="L1" categoryId="C1" title="Shirts" onClose={onClose} />)

    fireEvent.change(screen.getByTestId('photo-input'), {
      target: { files: [new File([''], 'a')] },
    })
    await waitFor(() => expect(onClose).toHaveBeenCalled())
  })

  it('refuses the whole batch without writing anything', async () => {
    screenBatch.mockResolvedValue({ refusal: 'too many', accepted: [], rejected: [] })
    render(<CameraSheet loadId="L1" categoryId="C1" title="Shirts" onClose={vi.fn()} />)

    fireEvent.change(screen.getByTestId('photo-input'), {
      target: { files: [new File([''], 'a')] },
    })
    expect(await screen.findByRole('alert')).toHaveTextContent('too many')
    expect(capturePhotoForCategory).not.toHaveBeenCalled()
  })

  it('bundle scope omits `multiple`; category scope sets it', () => {
    const { rerender } = render(<CameraSheet loadId="L1" title="Photos" onClose={vi.fn()} />)
    expect(screen.getByTestId('photo-input')).not.toHaveAttribute('multiple')

    rerender(<CameraSheet loadId="L1" categoryId="C1" title="Shirts" onClose={vi.fn()} />)
    expect(screen.getByTestId('photo-input')).toHaveAttribute('multiple')
  })
})

describe('CameraSheet — modal behaviour (§3.1)', () => {
  it('is a labelled modal dialog', () => {
    render(<CameraSheet loadId="L1" categoryId="C1" title="Shirts" onClose={vi.fn()} />)
    const dialog = screen.getByRole('dialog')
    expect(dialog).toHaveAttribute('aria-modal', 'true')
    expect(dialog).toHaveAttribute('aria-label', 'Shirts')
  })

  it('Escape closes and stops the stream (the camera light goes off)', () => {
    const onClose = vi.fn()
    render(<CameraSheet loadId="L1" categoryId="C1" title="Shirts" onClose={onClose} />)

    fireEvent.keyDown(screen.getByRole('dialog'), { key: 'Escape' })
    expect(camera.stop).toHaveBeenCalled()
    expect(onClose).toHaveBeenCalled()
  })

  it('the close button stops the stream and closes', () => {
    const onClose = vi.fn()
    render(<CameraSheet loadId="L1" categoryId="C1" title="Shirts" onClose={onClose} />)

    fireEvent.click(screen.getByRole('button', { name: 'Close camera' }))
    expect(camera.stop).toHaveBeenCalled()
    expect(onClose).toHaveBeenCalled()
  })

  it('returns focus to the opening button on unmount', () => {
    const opener = document.createElement('button')
    document.body.appendChild(opener)
    opener.focus()
    expect(document.activeElement).toBe(opener)

    const { unmount } = render(
      <CameraSheet loadId="L1" categoryId="C1" title="Shirts" onClose={vi.fn()} />,
    )
    // trap moved focus into the dialog
    expect(within(screen.getByRole('dialog')).getAllByRole('button').length).toBeGreaterThan(0)

    unmount()
    expect(document.activeElement).toBe(opener)
    opener.remove()
  })
})
