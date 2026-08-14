'use client'

/**
 * Admin sign-in form.
 *
 * Posts to `/api/auth/login`, which sets an HttpOnly cookie the browser sends
 * automatically from then on — nothing about the session is readable from here, by
 * design.
 */
import { useState } from 'react'

export function LoginForm({ redirectTo }: { redirectTo: string }) {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setSubmitting(true)
    setError(null)

    // Tracks whether we're leaving the page, so the button isn't re-enabled for a
    // frame while the browser navigates.
    let leaving = false

    try {
      const response = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ email, password }),
      })

      if (response.ok) {
        leaving = true
        /**
         * A full navigation, deliberately — not `router.replace`.
         *
         * Next's client router cache is keyed by URL and knows nothing about who is
         * asking. Arriving here from `/admin` means the cache already holds that
         * route's response from *before* sign-in, which was the proxy's redirect
         * back to this page. A client-side navigation replays it and bounces the
         * person straight back to the login form; only a manual refresh escapes.
         *
         * Signing in changes the identity behind every subsequent request, so every
         * cached payload is stale by definition. Crossing an identity boundary is
         * exactly when a full page load is the right tool.
         */
        window.location.replace(redirectTo)
        return
      }

      if (response.status === 429) {
        const retryAfter = Number(response.headers.get('retry-after') ?? 900)
        setError(`Too many attempts. Try again in about ${Math.ceil(retryAfter / 60)} minutes.`)
        return
      }

      const body = await response.json().catch(() => null)
      setError(body?.error?.message ?? 'Sign in failed. Please try again.')
    } catch {
      setError('We could not reach the server. Please check your connection.')
    } finally {
      if (!leaving) setSubmitting(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} noValidate className="space-y-5">
      {error && (
        <div
          role="alert"
          className="rounded-lg border border-status-critical/40 bg-status-critical/10 p-3 text-sm text-ink"
        >
          {error}
        </div>
      )}

      <div>
        <label htmlFor="email" className="block text-sm font-medium text-ink">
          Email
        </label>
        <input
          id="email"
          name="email"
          type="email"
          autoComplete="username"
          required
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          className="mt-2 w-full rounded-lg border border-baseline bg-surface px-3 py-2.5 text-ink"
        />
      </div>

      <div>
        <label htmlFor="password" className="block text-sm font-medium text-ink">
          Password
        </label>
        <input
          id="password"
          name="password"
          type="password"
          autoComplete="current-password"
          required
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          className="mt-2 w-full rounded-lg border border-baseline bg-surface px-3 py-2.5 text-ink"
        />
      </div>

      <button
        type="submit"
        disabled={submitting}
        className="w-full rounded-lg bg-series-1 px-4 py-2.5 font-medium text-white disabled:opacity-60"
      >
        {submitting ? 'Signing in…' : 'Sign in'}
      </button>
    </form>
  )
}
