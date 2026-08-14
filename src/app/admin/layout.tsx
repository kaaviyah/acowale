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

  return (
    <div className="flex min-h-full flex-1 flex-col">
      <header className="border-b border-hairline bg-surface">
        <div className="mx-auto flex w-full max-w-7xl flex-wrap items-center justify-between gap-3 px-4 py-3">
          <div className="flex items-baseline gap-3">
            <Link href="/admin" className="font-semibold tracking-tight text-ink">
              Acowale CRM
            </Link>
            <span className="text-sm text-ink-muted">Admin console</span>
          </div>

          <div className="flex items-center gap-4">
            <Link
              href="/"
              className="text-sm text-ink-secondary underline underline-offset-2 hover:text-ink"
            >
              Public form
            </Link>
            <span className="hidden text-sm text-ink-secondary sm:inline">{session.email}</span>
            <SignOutButton />
          </div>
        </div>
      </header>

      {children}
    </div>
  )
}
