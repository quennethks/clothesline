import { useCallback, useEffect, useRef, useState } from 'react'
import { useRxDatabase } from 'rxdb/plugins/react'
import type { ClotheslineDatabase } from '../db'
import { Icon } from '../components/Icon'
import { capturePhotoForCategory, capturePhotoForLoad } from './capture'
import { screenBatch } from './guards'
import { isTouchDevice, useCamera, type UnavailableReason } from './useCamera'

// The capture surface (spec §3.1). A full-bleed overlay on mobile, a centered
// dialog on desktop, reusing the .photo-lightbox overlay pattern. Both entry
// points mount this with the same props — only the scope differs, and the scope
// (category vs. bundle) is what decides `multiple` (§5).

interface CameraSheetProps {
  loadId: string
  /** Present → category scope: N files → N photos, `multiple` enabled (§5). */
  categoryId?: string | null
  /** For the sheet's heading; the entry points already know the category name. */
  title?: string
  onClose: () => void
}

// Overlays layered on top of useCamera's status (requesting / live / unavailable).
// The two save paths are separate states because they fail differently (§3.1):
// a failed frame save falls back to Review with the frame still in hand, a
// failed file save falls back to the camera keeping its successes.
type Phase =
  | { kind: 'camera' }
  | { kind: 'review'; frame: Blob }
  | { kind: 'savingFrame'; frame: Blob }
  | { kind: 'savingFiles'; done: number; total: number }

interface ReasonCopy {
  title: string
  body: string
  /** Try again only where retrying can actually help (spec §3.1). */
  canRetry: boolean
}

function reasonCopy(reason: UnavailableReason | null): ReasonCopy {
  const fallback = 'You can still add a photo you already have.'
  switch (reason) {
    case 'denied':
      return { title: 'Camera access blocked', body: `Allow camera access, or add an existing photo. ${fallback}`, canRetry: true }
    case 'in-use':
      return { title: 'Camera in use', body: `Another app or tab is using the camera. ${fallback}`, canRetry: true }
    case 'not-found':
      return { title: 'No camera found', body: `We couldn't find a camera on this device. ${fallback}`, canRetry: false }
    case 'insecure':
      return { title: 'Camera needs HTTPS', body: `The camera only works over a secure (https://) connection. ${fallback}`, canRetry: false }
    case 'unsupported':
      return { title: 'Camera unavailable', body: `This browser can't open the camera here. ${fallback}`, canRetry: false }
    default:
      return { title: 'Camera unavailable', body: `We couldn't start the camera. ${fallback}`, canRetry: true }
  }
}

export function CameraSheet({ loadId, categoryId, title, onClose }: CameraSheetProps) {
  const db = useRxDatabase<ClotheslineDatabase>()
  const camera = useCamera()
  const touch = isTouchDevice()

  const [phase, setPhase] = useState<Phase>({ kind: 'camera' })
  const [videoReady, setVideoReady] = useState(false)
  // The partial-failure report (role="alert") — kept across the return to the
  // camera so the user sees *why* some photos didn't land (§5.3).
  const [report, setReport] = useState<string | null>(null)
  // A whole-batch refusal (too many files, or the pending pile is full, §5.2).
  const [refusal, setRefusal] = useState<string | null>(null)

  const pickerRef = useRef<HTMLInputElement>(null)
  const osCameraRef = useRef<HTMLInputElement>(null)
  const sheetRef = useRef<HTMLDivElement>(null)
  const cancelRef = useRef(false)
  const mountedRef = useRef(true)

  useEffect(() => {
    mountedRef.current = true
    return () => {
      mountedRef.current = false
    }
  }, [])

  // The shutter is disabled until the video reports a frame; reset whenever the
  // stream is (re)acquired so a switch doesn't leave a stale-enabled shutter.
  useEffect(() => {
    if (camera.status !== 'live') setVideoReady(false)
  }, [camera.status])

  const handleClose = useCallback(() => {
    cancelRef.current = true
    camera.stop()
    onClose()
  }, [camera, onClose])

  // Focus trap + Escape, plus focus return to the opening button (spec §3.1).
  // handleClose is read through a ref so the trap installs once and does not
  // re-run (and re-capture the opener) every time handleClose changes identity.
  const closeRef = useRef(handleClose)
  closeRef.current = handleClose

  useEffect(() => {
    const opener = document.activeElement as HTMLElement | null
    const node = sheetRef.current
    node?.focus()

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        event.preventDefault()
        closeRef.current()
        return
      }
      if (event.key !== 'Tab' || !node) return
      const focusable = Array.from(
        node.querySelectorAll<HTMLElement>(
          'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])',
        ),
      ).filter((el) => !el.hasAttribute('disabled') && el.offsetParent !== null)
      if (focusable.length === 0) return

      const first = focusable[0]
      const last = focusable[focusable.length - 1]
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault()
        last.focus()
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault()
        first.focus()
      }
    }

    node?.addEventListener('keydown', onKeyDown)
    return () => {
      node?.removeEventListener('keydown', onKeyDown)
      opener?.focus?.()
    }
  }, [])

  // The frozen frame shown in Review — an object URL held only for the life of
  // that phase, revoked as soon as we leave it.
  const [reviewUrl, setReviewUrl] = useState<string | null>(null)
  useEffect(() => {
    const frame = phase.kind === 'review' ? phase.frame : null
    if (!frame) {
      setReviewUrl(null)
      return
    }
    const url = URL.createObjectURL(frame)
    setReviewUrl(url)
    return () => URL.revokeObjectURL(url)
  }, [phase])

  const writeOne = useCallback(
    (file: Blob) =>
      categoryId ? capturePhotoForCategory(db, categoryId, file) : capturePhotoForLoad(db, loadId, file),
    [db, categoryId, loadId],
  )

  async function handleShutter() {
    setReport(null)
    setRefusal(null)
    try {
      const frame = await camera.grabFrame()
      setPhase({ kind: 'review', frame })
    } catch {
      setReport("The photo couldn't be captured. Try again.")
    }
  }

  async function handleUsePhoto(frame: Blob) {
    setPhase({ kind: 'savingFrame', frame })
    try {
      await writeOne(frame)
      handleClose()
    } catch {
      // The frame is still in hand — return to Review so Use photo can retry.
      if (!mountedRef.current) return
      setReport("That photo couldn't be saved. Try again.")
      setPhase({ kind: 'review', frame })
    }
  }

  async function handleFiles(files: File[]) {
    setReport(null)
    setRefusal(null)
    if (files.length === 0) return

    const screened = await screenBatch(files)
    if (screened.refusal) {
      // The whole batch is refused; nothing is written and we stay put (§5.2).
      setRefusal(screened.refusal)
      return
    }

    cancelRef.current = false
    let failures = screened.rejected.length
    const { accepted } = screened
    setPhase({ kind: 'savingFiles', done: 0, total: accepted.length })

    for (let i = 0; i < accepted.length; i++) {
      if (cancelRef.current) break
      try {
        await writeOne(accepted[i])
      } catch {
        failures++
      }
      if (!mountedRef.current) return
      setPhase({ kind: 'savingFiles', done: i + 1, total: accepted.length })
    }

    if (!mountedRef.current) return
    // Partial failure does not roll back: the successes keep their photos, and
    // we return to the camera with a report rather than closing (§5.3). A clean
    // full success just closes.
    if (failures > 0) {
      setReport(`${failures} of ${files.length} ${files.length === 1 ? 'photo' : 'photos'} couldn't be added.`)
      setPhase({ kind: 'camera' })
    } else {
      handleClose()
    }
  }

  function onInputChange(event: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(event.target.files ?? [])
    // Cleared so re-picking the same file still fires a change event.
    event.target.value = ''
    void handleFiles(files)
  }

  const copy = reasonCopy(camera.reason)
  const heading = title ?? 'Add photo'
  const showViewfinder = camera.status !== 'unavailable' && phase.kind !== 'review'

  return (
    <div
      className="camera-sheet"
      role="dialog"
      aria-modal="true"
      aria-label={heading}
      tabIndex={-1}
      ref={sheetRef}
    >
      <div className="camera-stage">
        {showViewfinder && (
          <video
            ref={camera.videoRef}
            className="camera-video"
            autoPlay
            muted
            playsInline
            onCanPlay={() => setVideoReady(true)}
          />
        )}
        {phase.kind === 'review' && reviewUrl && (
          <img className="camera-video" src={reviewUrl} alt="Captured photo, awaiting confirmation" />
        )}

        {/* top bar: title, close, and the switch control (flip on touch, a
            device <select> on desktop), shown only when there is a live camera */}
        <div className="camera-top">
          <button
            type="button"
            className="iconbtn ghost"
            aria-label="Close camera"
            onClick={handleClose}
          >
            <Icon name="x-lg" />
          </button>
          <span className="camera-title">{heading}</span>
          {camera.status === 'live' && phase.kind === 'camera' && camera.canSwitch && (
            touch ? (
              <button
                type="button"
                className="iconbtn ghost"
                aria-label="Switch camera"
                onClick={camera.flipFacing}
              >
                <Icon name="arrow-repeat" />
              </button>
            ) : (
              <select
                className="camera-devsel"
                aria-label="Choose camera"
                value={camera.deviceId ?? ''}
                onChange={(event) => camera.selectDevice(event.target.value)}
              >
                {camera.devices.map((device, index) => (
                  <option key={device.deviceId} value={device.deviceId}>
                    {device.label || `Camera ${index + 1}`}
                  </option>
                ))}
              </select>
            )
          )}
        </div>

        {/* requesting */}
        {camera.status === 'requesting' && (
          <div className="camera-center" role="status">
            <p>Starting camera…</p>
          </div>
        )}

        {/* unavailable — a first-class state, never a dead end (§3.1) */}
        {camera.status === 'unavailable' && phase.kind === 'camera' && (
          <div className="camera-center">
            <div className="camera-center-icon" aria-hidden="true">
              <Icon name="camera-video-off" />
            </div>
            <h3>{copy.title}</h3>
            <p>{copy.body}</p>
          </div>
        )}

        {/* progress — announced to assistive tech (§3.1) */}
        {(phase.kind === 'savingFiles' || phase.kind === 'savingFrame') && (
          <div className="camera-center">
            <div className="camera-progress-text" role="status" aria-live="polite">
              {phase.kind === 'savingFrame'
                ? 'Saving photo…'
                : `Adding ${Math.min(phase.done + 1, phase.total)} of ${phase.total}…`}
            </div>
            {phase.kind === 'savingFiles' && (
              <>
                <div className="camera-progress-bar" aria-hidden="true">
                  <span style={{ width: `${phase.total ? (phase.done / phase.total) * 100 : 0}%` }} />
                </div>
                <p className="camera-progress-sub">Photos already added are kept if you cancel.</p>
              </>
            )}
          </div>
        )}

        {/* refusal / partial-failure messages */}
        {refusal && (
          <div className="camera-toast warn" role="alert">
            <Icon name="exclamation-triangle-fill" />
            <span>{refusal}</span>
          </div>
        )}
        {report && (
          <div className="camera-toast err" role="alert">
            <Icon name="exclamation-triangle-fill" />
            <span>{report}</span>
          </div>
        )}

        {/* bottom controls, per state */}
        <div className="camera-bottom">
          {/* live */}
          {camera.status === 'live' && phase.kind === 'camera' && (
            <>
              <div className="camera-controls">
                <button
                  type="button"
                  className="camera-chip"
                  onClick={() => pickerRef.current?.click()}
                >
                  <Icon name="images" />
                  Library
                </button>
                <button
                  type="button"
                  className="camera-shutter"
                  aria-label="Take photo"
                  disabled={!videoReady}
                  onClick={handleShutter}
                />
                <div className="camera-side" />
              </div>
              {touch && (
                <button
                  type="button"
                  className="camera-oscam"
                  onClick={() => osCameraRef.current?.click()}
                >
                  <Icon name="camera" />
                  Use device camera
                </button>
              )}
            </>
          )}

          {/* review */}
          {phase.kind === 'review' && (
            <div className="camera-review">
              <button
                type="button"
                className="btn camera-btn-ghost"
                onClick={() => setPhase({ kind: 'camera' })}
              >
                Retake
              </button>
              <button
                type="button"
                className="btn camera-btn-primary"
                onClick={() => handleUsePhoto(phase.frame)}
              >
                Use photo
              </button>
            </div>
          )}

          {/* unavailable */}
          {camera.status === 'unavailable' && phase.kind === 'camera' && (
            <>
              <button
                type="button"
                className="camera-picker"
                onClick={() => pickerRef.current?.click()}
              >
                <Icon name="images" />
                Choose existing photo
              </button>
              {touch && (
                <button
                  type="button"
                  className="camera-oscam"
                  onClick={() => osCameraRef.current?.click()}
                >
                  <Icon name="camera" />
                  Use device camera
                </button>
              )}
              {copy.canRetry && (
                <button type="button" className="camera-oscam" onClick={camera.retry}>
                  Try again
                </button>
              )}
            </>
          )}

          {/* saving a batch — a Cancel that keeps what already landed (§5.3) */}
          {phase.kind === 'savingFiles' && (
            <button
              type="button"
              className="btn camera-btn-ghost w-100"
              onClick={() => {
                cancelRef.current = true
              }}
            >
              Cancel
            </button>
          )}
        </div>
      </div>

      {/* The library/file picker: no `capture` attribute (that is what makes it
          the picker, not the camera, on mobile); `multiple` only in category
          scope (§5). Keeps the photo-input testid so photos.spec.ts's one
          helper still finds it. */}
      <input
        ref={pickerRef}
        type="file"
        accept="image/*"
        multiple={!!categoryId}
        className="visually-hidden"
        aria-label="Choose photo files"
        data-testid="photo-input"
        onChange={onInputChange}
      />
      {/* The OS-camera escape hatch — capture="environment" is a no-op on
          desktop, so it is only rendered on touch (§3.2). */}
      {touch && (
        <input
          ref={osCameraRef}
          type="file"
          accept="image/*"
          capture="environment"
          className="visually-hidden"
          aria-label="Use device camera"
          onChange={onInputChange}
        />
      )}
    </div>
  )
}
