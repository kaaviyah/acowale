'use client'

import { useRouter } from 'next/navigation'
import { useState } from 'react'

/** Sign out. A POST, so no link or prefetch can end someone's session for them. */
export function SignOutButton() {
  const router = useRouter()
  const [busy, setBusy] = useState(false)

  async function signOut() {
    setBusy(true)
    try {
      await fetch('/api/auth/logout', { method: 'POST' })
      router.replace('/login')
      router.refresh()
    } finally {
      setBusy(false)
    }
  }

  return (
    <button
      type="button"
      onClick={() => void signOut()}
      disabled={busy}
      className="rounded-lg border border-hairline px-3 py-1.5 text-sm text-ink hover:bg-page disabled:opacity-60"
    >
      {busy ? 'Signing out…' : 'Sign out'}
    </button>
  )
}
