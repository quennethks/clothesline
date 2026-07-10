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
      <div className={titleClassName ? `title ${titleClassName}` : 'title'}>{title}</div>
      {actions}
    </div>
  )
}
