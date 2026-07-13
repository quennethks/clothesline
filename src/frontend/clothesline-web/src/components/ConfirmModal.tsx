import { Icon, type IconName } from './Icon'

// Bootstrap-styled confirm dialog driven entirely by React state — we render
// the backdrop/visibility ourselves rather than pulling in Bootstrap's
// imperative JS bundle.
export function ConfirmModal({
  open,
  title,
  body,
  confirmLabel = 'Delete',
  icon = 'trash3',
  tone = 'danger',
  onConfirm,
  onCancel,
}: {
  open: boolean
  title: string
  body: string
  confirmLabel?: string
  icon?: IconName
  tone?: 'danger' | 'primary'
  onConfirm: () => void
  onCancel: () => void
}) {
  if (!open) return null

  const accent = tone === 'danger' ? 'var(--danger)' : 'var(--aqua-600)'
  const confirmClass = tone === 'danger' ? 'btn btn-danger' : 'btn btn-aqua'

  return (
    <>
      <div className="modal-backdrop fade show" onClick={onCancel} />
      <div
        className="modal fade show d-block"
        role="dialog"
        aria-modal="true"
        aria-label={title}
        tabIndex={-1}
      >
        <div className="modal-dialog modal-dialog-centered">
          <div className="modal-content" style={{ borderRadius: '16px' }}>
            <div className="modal-body text-center p-4">
              <div className="mb-2" style={{ fontSize: '2rem', color: accent }}>
                <Icon name={icon} />
              </div>
              <h6 className="fw-bold">{title}</h6>
              <p className="text-muted small mb-4">{body}</p>
              <div className="d-flex gap-2">
                <button
                  type="button"
                  className="btn btn-outline-secondary flex-fill"
                  onClick={onCancel}
                >
                  Cancel
                </button>
                <button type="button" className={`${confirmClass} flex-fill`} onClick={onConfirm}>
                  {confirmLabel}
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  )
}
