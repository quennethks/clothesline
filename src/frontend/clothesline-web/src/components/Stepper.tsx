// The `− [n] +` control used for send counts (Draft) and received counts (Closed).
// Read-only display of `value`; the buttons delegate to the domain helpers.
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
  return (
    <div className="stepper">
      <button type="button" className="step-btn" aria-label={decrementLabel} onClick={onDecrement}>
        −
      </button>
      <span className="qty d-inline-flex align-items-center justify-content-center" data-testid={valueTestId}>
        {value}
      </span>
      <button type="button" className="step-btn" aria-label={incrementLabel} onClick={onIncrement}>
        +
      </button>
    </div>
  )
}
