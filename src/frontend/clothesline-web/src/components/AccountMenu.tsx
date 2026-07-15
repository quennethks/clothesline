import { useEffect, useRef, useState } from 'react'
import { useAuth } from 'react-oidc-context'
import { useCurrentUser } from '../auth/useCurrentUser'
import { SyncStatusBadge } from '../sync/SyncStatusBadge'
import { ConfirmModal } from './ConfirmModal'
import { Icon } from './Icon'

// The account/overflow menu in the Home app bar (the ⋮). Consolidates the
// things that used to be scattered across the chrome — who's signed in, sign
// out, and the sync indicator — into one panel, so the sync badge no longer
// rides along the bottom of every screen. This is the only place sync status
// is surfaced.
//
// Presentation is responsive (see .account-* in theme.css): a full-screen sheet
// on a phone, an anchored dropdown panel on desktop. It closes on Escape,
// outside-click, or choosing an item; opening the sign-out confirm closes it
// first so the dialog isn't stacked behind the sheet.
export function AccountMenu() {
  const auth = useAuth()
  const { user } = useCurrentUser()
  const [open, setOpen] = useState(false)
  const [confirming, setConfirming] = useState(false)
  const rootRef = useRef<HTMLDivElement>(null)

  // Closes on Escape or outside-click. The outside-click is a document listener
  // (like the load-card overflow menu) attached after the opening click so that
  // click doesn't immediately re-close it — the panel lives inside the app bar's
  // stacking context, so a click-catching scrim can't be layered above it, hence
  // JS rather than a backdrop. On mobile the sheet is full-screen, dismissed by
  // its own close button or Escape.
  useEffect(() => {
    if (!open) return
    function onKey(event: KeyboardEvent) {
      if (event.key === 'Escape') setOpen(false)
    }
    function onClick(event: MouseEvent) {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false)
    }
    document.addEventListener('keydown', onKey)
    document.addEventListener('click', onClick)
    return () => {
      document.removeEventListener('keydown', onKey)
      document.removeEventListener('click', onClick)
    }
  }, [open])

  async function handleSignOut() {
    setConfirming(false)
    try {
      await auth.signoutRedirect()
    } catch {
      // Zitadel's end-session endpoint is unreachable (offline, most likely).
      // Drop the local tokens anyway so the device stops acting signed-in;
      // the IdP-side session outlives it and is cleaned up on next sign-in.
      await auth.removeUser()
    }
  }

  const email = user?.email ?? ''

  return (
    <div className="account" ref={rootRef}>
      <button
        type="button"
        className="iconbtn"
        aria-label="Account menu"
        aria-haspopup="menu"
        aria-expanded={open}
        title="Account"
        onClick={() => setOpen((o) => !o)}
      >
        <Icon name="three-dots-vertical" />
      </button>

      {open && (
        <div className="account-panel" role="menu" aria-label="Account">
          <div className="account-head">
            <span className="account-avatar" aria-hidden="true">
              <Icon name="person-circle" />
            </span>
            <div className="account-id">
              <div className="account-label">Signed in</div>
              <div className="account-email" title={email}>
                {email || '—'}
              </div>
            </div>
            <button
              type="button"
              className="account-close"
              aria-label="Close menu"
              onClick={() => setOpen(false)}
            >
              <Icon name="x-lg" />
            </button>
          </div>

          <button
            type="button"
            role="menuitem"
            className="account-item danger"
            onClick={() => {
              // Close first so the confirm dialog isn't stacked behind the sheet.
              setOpen(false)
              setConfirming(true)
            }}
          >
            <Icon name="box-arrow-right" />
            Sign out
          </button>

          <div className="account-foot">
            <SyncStatusBadge />
          </div>
        </div>
      )}

      <ConfirmModal
        open={confirming}
        icon="box-arrow-right"
        tone="primary"
        title="Sign out?"
        body="Your loads stay saved on this device. You'll need a new emailed code to sign back in."
        confirmLabel="Sign out"
        onConfirm={handleSignOut}
        onCancel={() => setConfirming(false)}
      />
    </div>
  )
}
