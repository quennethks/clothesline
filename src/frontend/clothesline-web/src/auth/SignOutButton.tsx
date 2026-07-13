import { useState } from 'react'
import { useAuth } from 'react-oidc-context'
import { ConfirmModal } from '../components/ConfirmModal'
import { Icon } from '../components/Icon'

export function SignOutButton() {
  const auth = useAuth()
  const [confirming, setConfirming] = useState(false)

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

  return (
    <>
      <button
        type="button"
        className="iconbtn"
        aria-label="Sign out"
        title="Sign out"
        onClick={() => setConfirming(true)}
      >
        <Icon name="box-arrow-right" />
      </button>

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
    </>
  )
}
