import { useCallback, useEffect, useRef, useState } from 'react'

// The whole getUserMedia surface (spec §3.3, §4, §6), kept out of the UI so it
// can be driven by a mocked navigator.mediaDevices. It deliberately exposes the
// <video> element and a grabFrame() rather than a single shutter callback:
// Phase 2's Scan Mode drives the same canvas grab from a detection loop, and a
// hook whose only output was "here is the photo the user took" would have to be
// torn up to get there (spec §9).

export type UnavailableReason = 'denied' | 'not-found' | 'in-use' | 'insecure' | 'unsupported' | 'unknown'

export type CameraStatus = 'requesting' | 'live' | 'unavailable'

/** Which camera the *in-app preview* opens with — not whether it is used (spec §3.2). */
export const DEVICE_STORAGE_KEY = 'clothesline.camera.device-id'

export interface CameraOptions {
  /** A parameter, not a baked-in assumption: inference wants a far smaller
   *  frame off this same stream than compress.ts does (spec §9). */
  width?: number
  height?: number
}

export interface Camera {
  status: CameraStatus
  /** Only meaningful while `status === 'unavailable'`. */
  reason: UnavailableReason | null
  videoRef: React.RefObject<HTMLVideoElement | null>
  devices: MediaDeviceInfo[]
  deviceId: string | null
  facingMode: 'environment' | 'user'
  /** False when there is nothing to switch *to* — the control is then hidden. */
  canSwitch: boolean
  grabFrame: () => Promise<Blob>
  flipFacing: () => void
  selectDevice: (deviceId: string) => void
  retry: () => void
  stop: () => void
}

/** The form factor, which is what picks the switch control's rendering (spec §3.3). */
export function isTouchDevice(): boolean {
  return window.matchMedia?.('(pointer: coarse)').matches === true
}

function stopStream(stream: MediaStream): void {
  for (const track of stream.getTracks()) track.stop()
}

function reasonFor(error: unknown): UnavailableReason {
  switch ((error as DOMException | null)?.name) {
    case 'NotAllowedError':
    case 'SecurityError':
      return 'denied'
    case 'NotFoundError':
      return 'not-found'
    case 'NotReadableError':
    case 'TrackStartError':
      return 'in-use'
    case 'NotSupportedError':
      return 'unsupported'
    default:
      return 'unknown'
  }
}

/** A remembered deviceId that no longer resolves — the camera was unplugged. */
function isMissingDevice(error: unknown): boolean {
  const name = (error as DOMException | null)?.name
  return name === 'NotFoundError' || name === 'OverconstrainedError'
}

function readStoredDeviceId(): string | null {
  return localStorage.getItem(DEVICE_STORAGE_KEY)
}

export function useCamera(options: CameraOptions = {}): Camera {
  const { width = 1920, height = 1080 } = options

  const videoRef = useRef<HTMLVideoElement>(null)
  const streamRef = useRef<MediaStream | null>(null)

  const [status, setStatus] = useState<CameraStatus>('requesting')
  const [reason, setReason] = useState<UnavailableReason | null>(null)
  const [devices, setDevices] = useState<MediaDeviceInfo[]>([])
  const [facingMode, setFacingMode] = useState<'environment' | 'user'>('environment')
  // Desktop's choice persists; touch's does not — a load photo is a photo *of
  // the clothes*, so the sheet always opens rear-facing (spec §3.3).
  const [deviceId, setDeviceId] = useState<string | null>(() =>
    isTouchDevice() ? null : readStoredDeviceId(),
  )
  const [attempt, setAttempt] = useState(0)
  // iOS Safari revokes the camera on backgrounding regardless of what we do, and
  // holding the dead track gives a permanently black preview (spec §6).
  const [visible, setVisible] = useState(true)

  useEffect(() => {
    function onVisibilityChange() {
      setVisible(document.visibilityState !== 'hidden')
    }
    document.addEventListener('visibilitychange', onVisibilityChange)
    return () => document.removeEventListener('visibilitychange', onVisibilityChange)
  }, [])

  // Re-runs on every switch, retry and backgrounding — and its cleanup is what
  // stops the old stream *before* the next one is requested, which some devices
  // require and which is the difference between the camera light going out and
  // not (spec §6).
  useEffect(() => {
    if (!visible) return

    let cancelled = false

    async function acquire() {
      setStatus('requesting')
      setReason(null)

      const mediaDevices = navigator.mediaDevices
      if (!mediaDevices?.getUserMedia) {
        // getUserMedia is simply absent outside a secure context, so an insecure
        // origin is indistinguishable from an old browser except by asking.
        setStatus('unavailable')
        setReason(window.isSecureContext ? 'unsupported' : 'insecure')
        return
      }

      try {
        const stream = await mediaDevices.getUserMedia({
          // `ideal`, never `exact`: a device that cannot do 1080p should still
          // get a stream rather than an OverconstrainedError (spec §4).
          video: deviceId
            ? { deviceId: { exact: deviceId }, width: { ideal: width }, height: { ideal: height } }
            : { facingMode, width: { ideal: width }, height: { ideal: height } },
        })

        if (cancelled) {
          stopStream(stream)
          return
        }

        streamRef.current = stream
        if (videoRef.current) videoRef.current.srcObject = stream
        setStatus('live')

        // Device *labels* are empty until a camera permission has been granted,
        // so enumeration only ever runs after a grant — never before (spec §3.3).
        const all = await mediaDevices.enumerateDevices()
        if (cancelled) return
        setDevices(all.filter((device) => device.kind === 'videoinput'))
      } catch (error) {
        if (cancelled) return

        if (deviceId && isMissingDevice(error)) {
          localStorage.removeItem(DEVICE_STORAGE_KEY)
          setDeviceId(null)
          return
        }

        setStatus('unavailable')
        setReason(reasonFor(error))
      }
    }

    void acquire()

    return () => {
      cancelled = true
      if (streamRef.current) {
        stopStream(streamRef.current)
        streamRef.current = null
      }
    }
  }, [deviceId, facingMode, attempt, visible, width, height])

  const grabFrame = useCallback(async (): Promise<Blob> => {
    const video = videoRef.current
    if (!video?.videoWidth) throw new Error('the camera has no frame yet')

    // Drawn at the video's intrinsic size. No ImageCapture.takePhoto(): it is
    // Chromium-only, and its one advantage is discarded by the 1600px resize in
    // compress.ts anyway (spec §4).
    const canvas = document.createElement('canvas')
    canvas.width = video.videoWidth
    canvas.height = video.videoHeight
    const context = canvas.getContext('2d')
    if (!context) throw new Error('could not get a 2d canvas context')
    context.drawImage(video, 0, 0)

    const blob = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob(resolve, 'image/jpeg', 0.92),
    )
    if (!blob) throw new Error('frame capture failed')
    return blob
  }, [])

  const flipFacing = useCallback(() => {
    setDeviceId(null)
    setFacingMode((current) => (current === 'environment' ? 'user' : 'environment'))
  }, [])

  const selectDevice = useCallback((next: string) => {
    localStorage.setItem(DEVICE_STORAGE_KEY, next)
    setDeviceId(next)
  }, [])

  const retry = useCallback(() => setAttempt((current) => current + 1), [])

  const stop = useCallback(() => {
    if (!streamRef.current) return
    stopStream(streamRef.current)
    streamRef.current = null
    if (videoRef.current) videoRef.current.srcObject = null
  }, [])

  return {
    status,
    reason,
    videoRef,
    devices,
    deviceId,
    facingMode,
    canSwitch: devices.length > 1,
    grabFrame,
    flipFacing,
    selectDevice,
    retry,
    stop,
  }
}
