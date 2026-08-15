/**
 * Admin shell.
 *
 * The session check here is deliberate duplication: `proxy.ts` already redirects
 * unauthenticated navigation, but a layout that trusts the proxy alone is one
 * `matcher` edit away from serving customer feedback to the internet. This is the
 * check that actually holds.
 */
import Link from 'next/link'
import { redirect } from 'next/navigation'
import { SignOutButton } from '@/components/sign-out-button'
import { readSession } from '@/server/http/session-cookie'

export default async function AdminLayout({ children }: LayoutProps<'/admin'>) {
  const session = await readSession()
  if (!session) redirect('/login?next=/admin')

  // First letter of the address, as a stand-in avatar — no upload, no gravatar hop.
  const initial = session.email.charAt(0).toUpperCase()

  return (
    <div className="flex min-h-full flex-1 flex-col">
      <header className="sticky top-0 z-40 border-b border-series-1/20 bg-surface/85 backdrop-blur-md">
        <div className="mx-auto flex w-full max-w-7xl flex-wrap items-center justify-between gap-3 px-4 py-2.5">
          <Link href="/admin" className="group flex items-center gap-2">
            <span
              aria-hidden="true"
              className="flex h-7 w-7 items-center justify-center rounded-lg bg-gradient-to-br from-series-1 to-series-1/70 text-xs font-bold text-white"
            >
              A
            </span>
            <span className="text-sm font-bold tracking-tight text-ink">Acowale CRM</span>
          </Link>

          <div className="flex items-center gap-2">
            <Link
              href="/"
              className="rounded-lg border border-series-1/30 bg-series-1/8 px-3 py-1.5 text-xs font-semibold text-series-1 transition-colors hover:border-series-1/50 hover:bg-series-1/15"
            >
              Public form
            </Link>

            <div className="hidden items-center gap-2 rounded-lg border border-hairline px-2.5 py-1.5 sm:flex">
              <span
                aria-hidden="true"
                className="flex h-5 w-5 items-center justify-center rounded-full bg-series-1/15 text-[10px] font-bold text-series-1"
              >
                {initial}
              </span>
              <span className="text-xs font-medium text-ink-secondary">{session.email}</span>
            </div>

            <SignOutButton />
          </div>
        </div>
      </header>

      {children}
    </div>
  )
}
