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
    <main className="mx-auto w-full max-w-2xl flex-1 px-4 py-12 sm:py-20">
      <header className="mb-12 text-center">
        <div className="inline-block px-4 py-2 rounded-full bg-gradient-to-r from-series-1/20 to-series-1/10 border border-series-1/30 mb-4">
          <p className="text-xs font-black uppercase tracking-widest text-series-1">💬 Acowale Feedback</p>
        </div>
        <h1 className="mt-4 text-6xl font-black tracking-tight text-ink whitespace-nowrap">
          We <span className="bg-gradient-to-r from-series-1 to-series-1/60 bg-clip-text text-transparent">value</span> your feedback
        </h1>
        <p className="mt-6 text-xl text-ink-secondary leading-relaxed max-w-lg mx-auto">
          Help us improve by sharing your experience. It takes less than a minute, and a real person reads every single submission. 👀
        </p>
      </header>

      {categories.length > 0 ? (
        <FeedbackForm categories={categories} />
      ) : (
        <div className="rounded-2xl border-2 border-series-1/20 bg-gradient-to-br from-series-1/10 to-series-1/5 p-10 text-center shadow-lg shadow-series-1/10">
          <h2 className="font-black text-lg text-ink">⚙️ The form is not available right now</h2>
          <p className="mt-3 text-ink-secondary">
            No feedback categories have been configured yet. If you are running this locally, seed them with{' '}
            <code className="font-bold text-series-1 bg-black/10 px-3 py-1 rounded-lg inline-block mt-2">pnpm db:seed</code>.
          </p>
        </div>
      )}

      <footer className="mt-16 flex flex-col items-center justify-center border-t-2 border-series-1/10 pt-10 text-sm text-ink-muted gap-4">
        <span className="font-bold">🚀 Acowale CRM · Machine test build</span>
        <Link href="/admin" className="text-series-1 underline underline-offset-2 hover:text-series-1/70 font-bold transition-colors text-base">
          👨‍💼 Team sign in
        </Link>
      </footer>
    </main>
  )
}
