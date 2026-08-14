'use client'

/**
 * Error boundary for the whole app.
 *
 * Shows a human explanation, offers the one action that usually works (retry), and
 * surfaces Next.js's error digest. That digest is the link between what the person is
 * looking at and the stack trace in the server logs — without it, "it broke" is
 * unanswerable.
 */
import Link from 'next/link'
import { useEffect } from 'react'

export default function AppError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    // The server has already logged this with a stack; this is the client's copy.
    console.error('Unhandled application error', error)
  }, [error])

  return (
    <main className="mx-auto flex w-full max-w-lg flex-1 flex-col justify-center px-4 py-16">
      <div className="rounded-xl border border-hairline bg-surface p-6 sm:p-8">
        <h1 className="text-xl font-semibold text-ink">Something went wrong</h1>
        <p className="mt-2 text-ink-secondary">
          The page could not be loaded. This has been logged, and trying again often works.
        </p>

        {error.digest && (
          <p className="mt-4 text-sm text-ink-muted">
            Reference: <code className="font-mono">{error.digest}</code>
          </p>
        )}

        <div className="mt-6 flex gap-3">
          <button
            type="button"
            onClick={reset}
            className="rounded-lg bg-series-1 px-4 py-2 font-medium text-white"
          >
            Try again
          </button>
          <Link
            href="/"
            className="rounded-lg border border-hairline px-4 py-2 font-medium text-ink hover:bg-page"
          >
            Back to the form
          </Link>
        </div>
      </div>
    </main>
  )
}
