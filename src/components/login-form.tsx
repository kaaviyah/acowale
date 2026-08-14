'use client'

/**
 * Admin sign-in form.
 *
 * Posts to `/api/auth/login`, which sets an HttpOnly cookie the browser sends
 * automatically from then on — nothing about the session is readable from here, by
 * design. On success it navigates with `router.replace` so the login page doesn't
 * sit in the back-button history of an authenticated session.
 */
import { useRouter } from 'next/navigation'
import { useState } from 'react'

export function LoginForm({ redirectTo }: { redirectTo: string }) {
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setSubmitting(true)
    setError(null)

    try {
      const response = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ email, password }),
      })

      if (response.ok) {
        router.replace(redirectTo)
        // The dashboard is a server component; refresh so it renders with the
        // session cookie now attached.
        router.refresh()
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
      setSubmitting(false)
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
