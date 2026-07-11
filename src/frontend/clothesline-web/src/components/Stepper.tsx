import { useEffect, useRef, useState } from 'react'

// The `− [n] +` control used for send counts (Draft) and received counts (Closed).
// Read-only display of `value`; the buttons delegate to the domain helpers.
//
// The counter is the make-or-break interaction (spec §6.3 — itemize in under a
// minute), so a tap has to land and be felt: the targets are thumb-sized, `+`
// is the visually dominant one, and every change pulses the number and fires a
// haptic tick on devices that have one.
export function Stepper({
  value,
  onDecrement,
  onIncrement,
  decrementLabel,
  incrementLabel,
  valueTestId,
}: {
  value: number
  onDecrement: () => void
  onIncrement: () => void
  decrementLabel: string
  incrementLabel: string
  valueTestId?: string
}) {
  const [pulsing, setPulsing] = useState(false)
  const previousValue = useRef(value)

  useEffect(() => {
    if (value === previousValue.current) return
    previousValue.current = value
    setPulsing(true)
    const timeout = setTimeout(() => setPulsing(false), 200)
    return () => clearTimeout(timeout)
  }, [value])

  function tap(action: () => void) {
    // Unsupported on iOS Safari and a no-op on a device with no motor, which
    // is why the visual pulse above has to carry the feedback by itself.
    navigator.vibrate?.(10)
    action()
  }

  return (
    <div className="stepper">
      <button
        type="button"
        className="step-btn"
        aria-label={decrementLabel}
        onClick={() => tap(onDecrement)}
      >
        −
      </button>
      <span
        className={pulsing ? 'qty pulse' : 'qty'}
        data-testid={valueTestId}
        aria-live="polite"
      >
        {value}
      </span>
      <button
        type="button"
        className="step-btn primary"
        aria-label={incrementLabel}
        onClick={() => tap(onIncrement)}
      >
        +
      </button>
    </div>
  )
}
