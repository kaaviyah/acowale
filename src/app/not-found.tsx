import Link from 'next/link'

export default function NotFound() {
  return (
    <main className="mx-auto flex w-full max-w-lg flex-1 flex-col justify-center px-4 py-16">
      <div className="rounded-xl border border-hairline bg-surface p-6 sm:p-8">
        <p className="text-sm font-medium uppercase tracking-wide text-ink-muted">404</p>
        <h1 className="mt-2 text-xl font-semibold text-ink">That page does not exist</h1>
        <p className="mt-2 text-ink-secondary">
          The link may be out of date, or the page may have moved.
        </p>
        <Link
          href="/"
          className="mt-6 inline-block rounded-lg bg-series-1 px-4 py-2 font-medium text-white"
        >
          Go to the feedback form
        </Link>
      </div>
    </main>
  )
}
