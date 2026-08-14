/**
 * The public feedback page.
 *
 * A server component that loads the category list through the service layer
 * directly, rather than fetching its own `/api/categories` endpoint over HTTP. A
 * server calling itself adds a network hop and, on serverless, a second cold start,
 * to reach code it could have called in-process. The HTTP endpoint still exists,
 * documented and tested, for the client and for anything else that needs it.
 */
import type { Metadata } from 'next'
import Link from 'next/link'
import { FeedbackForm } from '@/components/feedback-form'
import { listCategories } from '@/server/services/categories'

export const metadata: Metadata = {
  title: 'Share your feedback',
  description: 'Tell the Acowale team what is working and what is not.',
}

/** Reads from the database on every request, so a new category appears immediately. */
export const dynamic = 'force-dynamic'

export default async function FeedbackPage() {
  const categories = await listCategories()

  return (
    <main className="mx-auto w-full max-w-2xl flex-1 px-4 py-10 sm:py-16">
      <header className="mb-8">
        <p className="text-sm font-medium uppercase tracking-wide text-series-1">Acowale</p>
        <h1 className="mt-2 text-3xl font-semibold tracking-tight text-ink sm:text-4xl">
          We value your feedback
        </h1>
        <p className="mt-3 text-lg text-ink-secondary">
          Help us improve by sharing your experience. It takes less than a minute, and a real person
          reads every submission.
        </p>
      </header>

      {categories.length > 0 ? (
        <FeedbackForm categories={categories} />
      ) : (
        /*
         * Reference data is missing — the form would be unusable, so say so plainly
         * rather than rendering an empty dropdown that fails on submit.
         */
        <div className="rounded-xl border border-hairline bg-surface p-6 text-ink-secondary">
          <h2 className="font-medium text-ink">The form is not available right now</h2>
          <p className="mt-2">
            No feedback categories have been configured yet. If you are running this locally, seed
            them with <code className="font-mono text-sm">pnpm db:seed</code>.
          </p>
        </div>
      )}

      <footer className="mt-10 flex items-center justify-between border-t border-hairline pt-6 text-sm text-ink-muted">
        <span>Acowale CRM · Machine test build</span>
        <Link href="/admin" className="underline underline-offset-2 hover:text-ink">
          Team sign in
        </Link>
      </footer>
    </main>
  )
}
