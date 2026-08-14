/**
 * Sign-in page.
 *
 * `proxy.ts` sends unauthenticated visitors here with a `next` parameter so they
 * land where they were going. That parameter is attacker-controllable, so it is
 * validated here before being used as a redirect target — an unchecked `next` is a
 * textbook open redirect, which is how phishing links end up looking like they come
 * from your own domain.
 */
import type { Metadata } from 'next'
import Link from 'next/link'
import { redirect } from 'next/navigation'
import { LoginForm } from '@/components/login-form'
import { readSession } from '@/server/http/session-cookie'

export const metadata: Metadata = { title: 'Sign in' }

/** Only same-origin, path-only destinations are allowed. */
function safeRedirect(candidate: string | undefined): string {
  if (!candidate) return '/admin'
  // Rejects `https://evil.example`, `//evil.example` (protocol-relative), and
  // anything that isn't rooted at this origin.
  if (!candidate.startsWith('/') || candidate.startsWith('//')) return '/admin'
  return candidate
}

export default async function LoginPage(props: PageProps<'/login'>) {
  const session = await readSession()
  if (session) redirect('/admin')

  const params = await props.searchParams
  const next = typeof params.next === 'string' ? params.next : undefined

  return (
    <main className="mx-auto flex w-full max-w-sm flex-1 flex-col justify-center px-4 py-16">
      <div className="rounded-xl border border-hairline bg-surface p-6 sm:p-8">
        <p className="text-sm font-medium uppercase tracking-wide text-series-1">Acowale</p>
        <h1 className="mt-2 text-2xl font-semibold tracking-tight text-ink">Admin console</h1>
        <p className="mt-2 mb-6 text-sm text-ink-secondary">
          Sign in to review feedback and analyse trends.
        </p>

        <LoginForm redirectTo={safeRedirect(next)} />
      </div>

      <Link
        href="/"
        className="mt-6 text-center text-sm text-ink-muted underline underline-offset-2 hover:text-ink"
      >
        Back to the feedback form
      </Link>
    </main>
  )
}
