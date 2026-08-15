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
      <header className="sticky top-0 z-40 border-b-2 border-series-1/20 bg-surface/85 backdrop-blur-md">
        <div className="mx-auto flex w-full max-w-7xl flex-wrap items-center justify-between gap-3 px-4 py-4">
          <div className="flex items-center gap-3">
            <Link href="/admin" className="group flex items-center gap-3">
              <span
                aria-hidden="true"
                className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-series-1 to-series-1/70 text-lg font-black text-white shadow-lg shadow-series-1/30 transition-transform group-hover:scale-105"
              >
                A
              </span>
              <span className="text-lg font-black tracking-tight text-ink">Acowale CRM</span>
            </Link>
          </div>

          <div className="flex items-center gap-3">
            <Link
              href="/"
              className="rounded-xl border-2 border-series-1/30 bg-gradient-to-r from-series-1/10 to-series-1/5 px-4 py-2.5 text-sm font-bold text-series-1 transition-all hover:border-series-1/50 hover:from-series-1/20 hover:to-series-1/10"
            >
              Public form
            </Link>

            <div className="hidden items-center gap-2.5 rounded-xl border-2 border-hairline bg-page/60 px-3 py-2 sm:flex">
              <span
                aria-hidden="true"
                className="flex h-7 w-7 items-center justify-center rounded-full bg-gradient-to-br from-series-1/25 to-series-1/10 text-xs font-black text-series-1"
              >
                {initial}
              </span>
              <span className="text-sm font-bold text-ink-secondary">{session.email}</span>
            </div>

            <SignOutButton />
          </div>
        </div>
      </header>

      {children}
    </div>
  )
}
