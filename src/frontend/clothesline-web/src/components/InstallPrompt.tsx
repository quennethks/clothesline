import { useEffect, useState } from 'react'
import { Icon } from './Icon'

// Clothesline is meant to live on the home screen — that's what makes it open
// offline at the laundry counter. Chromium fires `beforeinstallprompt` when the
// PWA is installable; we stash the event and surface our own affordance rather
// than relying on the browser's easily-missed address-bar icon.
//
// (Safari/iOS never fires it — installing there is Share → Add to Home Screen,
// which no API can trigger, so nothing renders and nothing is lost.)

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>
}

const DISMISSED_KEY = 'clothesline.install-dismissed'

export function InstallPrompt() {
  const [deferred, setDeferred] = useState<BeforeInstallPromptEvent | null>(null)
  const [dismissed, setDismissed] = useState(
    () => localStorage.getItem(DISMISSED_KEY) === 'true',
  )

  useEffect(() => {
    function onBeforeInstallPrompt(event: Event) {
      // Suppress the browser's own mini-infobar so ours is the only prompt.
      event.preventDefault()
      setDeferred(event as BeforeInstallPromptEvent)
    }
    function onInstalled() {
      setDeferred(null)
    }
    window.addEventListener('beforeinstallprompt', onBeforeInstallPrompt)
    window.addEventListener('appinstalled', onInstalled)
    return () => {
      window.removeEventListener('beforeinstallprompt', onBeforeInstallPrompt)
      window.removeEventListener('appinstalled', onInstalled)
    }
  }, [])

  if (!deferred || dismissed) return null

  async function install() {
    if (!deferred) return
    await deferred.prompt()
    await deferred.userChoice
    // The event is single-use, accepted or not.
    setDeferred(null)
  }

  function dismiss() {
    localStorage.setItem(DISMISSED_KEY, 'true')
    setDismissed(true)
  }

  return (
    <div className="install-prompt">
      <span className="install-icon">
        <Icon name="bag" />
      </span>
      <div className="install-copy">
        <div className="install-title">Install Clothesline</div>
        <div className="install-body">Add it to your home screen so it opens offline.</div>
      </div>
      <button type="button" className="btn btn-sm btn-aqua" onClick={install}>
        Install
      </button>
      <button type="button" className="mini" aria-label="Dismiss install prompt" onClick={dismiss}>
        ✕
      </button>
    </div>
  )
}
