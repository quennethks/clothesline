import type { ReactNode } from 'react'
import { Icon } from './Icon'

// The sticky aqua top bar every screen shares (prototype `.appbar`).
// `onBack` renders the left arrow; `actions` fills the right-hand icon slot.
export function AppBar({
  title,
  onBack,
  actions,
  titleClassName,
}: {
  title: string
  onBack?: () => void
  actions?: ReactNode
  titleClassName?: string
}) {
  return (
    <div className="appbar">
      {onBack && (
        <button type="button" className="iconbtn" aria-label="Back" onClick={onBack}>
          <Icon name="arrow-left" />
        </button>
      )}
      {/* An h1, not a div: it is the screen's heading, and screen readers (and
          the e2e suite) navigate by it. */}
      <h1 className={titleClassName ? `title ${titleClassName}` : 'title'}>{title}</h1>
      {actions}
    </div>
  )
}
