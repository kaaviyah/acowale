'use client'

import { useState } from 'react'

/**
 * Sign out. A POST, so no link or prefetch can end someone's session for them.
 *
 * Navigates with `window.location`, not the client router, for the same reason
 * signing in does — and here the stakes are higher. Next's router cache holds
 * rendered dashboard payloads, keyed by URL with no notion of identity; a
 * client-side navigation would leave them in memory for the back button to find.
 * A full page load discards them along with the rest of the JavaScript heap, which
 * is what you want on a shared machine.
 */
export function SignOutButton() {
  const [busy, setBusy] = useState(false)

  async function signOut() {
    setBusy(true)
    try {
      await fetch('/api/auth/logout', { method: 'POST' })
      window.location.replace('/login')
    } catch {
      // The cookie may not have been cleared; leave the person signed in rather
      // than pretending otherwise.
      setBusy(false)
    }
  }

  return (
    <button
      type="button"
      onClick={() => void signOut()}
      disabled={busy}
      className="rounded-xl border-2 border-status-critical/40 bg-gradient-to-r from-status-critical/15 to-status-critical/5 px-4 py-2.5 text-sm font-bold text-status-critical transition-all hover:border-status-critical/60 hover:from-status-critical/25 hover:to-status-critical/10 disabled:opacity-60"
    >
      {busy ? 'Signing out…' : 'Sign out'}
    </button>
  )
}
