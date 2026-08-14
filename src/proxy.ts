/**
 * Proxy (what Next.js called Middleware before 16).
 *
 * Scope is deliberately narrow: it redirects unauthenticated *navigation* to the
 * login page so nobody sees an admin shell flash before a 401. It is not the
 * authorization boundary — every admin route handler and page calls
 * `requireSession()` itself.
 *
 * That split is on purpose. An edge-adjacent check that runs before the app is the
 * wrong place to hold the only copy of an access rule: one change to `matcher` and
 * the enforcement silently disappears with no failing test. Here, the same change
 * would only cost a redirect.
 *
 * API routes are not matched at all — `/api/feedback` is public for POST and
 * admin-only for GET, and encoding "public unless the method is GET" in a path
 * matcher is exactly the sort of cleverness that later gets read wrong.
 */
import { NextResponse, type NextRequest } from 'next/server'
import { SESSION_COOKIE_NAME, verifySessionToken } from '@/server/lib/session'

export const config = {
  matcher: ['/admin/:path*'],
}

export async function proxy(request: NextRequest) {
  const token = request.cookies.get(SESSION_COOKIE_NAME)?.value
  const session = token ? await verifySessionToken(token) : null

  if (session) return NextResponse.next()

  const loginUrl = new URL('/login', request.url)
  // Come back to where they were headed after signing in. Read back safely in the
  // login page — an unvalidated `next` is an open-redirect.
  loginUrl.searchParams.set('next', `${request.nextUrl.pathname}${request.nextUrl.search}`)

  return NextResponse.redirect(loginUrl)
}
