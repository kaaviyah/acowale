/**
 * Next.js adapters for the session cookie.
 *
 * Everything under `src/server/lib`, `services` and `repos` is framework-free; this
 * directory is the deliberate exception, holding the few helpers that need
 * `next/headers`. Keeping them here means the boundary is visible in the file tree
 * rather than discovered later by whoever tries to lift the API out.
 */
import { cookies } from 'next/headers'
import { unauthorized } from '../lib/errors'
import {
  SESSION_COOKIE_NAME,
  sessionCookieOptions,
  verifySessionToken,
  type SessionClaims,
} from '../lib/session'

/** The current session, or `null` when there isn't a valid one. */
export async function readSession(): Promise<SessionClaims | null> {
  const token = (await cookies()).get(SESSION_COOKIE_NAME)?.value
  return token ? verifySessionToken(token) : null
}

/**
 * The current session, or a 401.
 *
 * Called by every admin route handler. `proxy.ts` already rejects unauthenticated
 * requests before they reach here, but this check is what actually enforces it: a
 * route that trusts the proxy alone is one config change away from being public.
 */
export async function requireSession(): Promise<SessionClaims> {
  const session = await readSession()
  if (!session) throw unauthorized()
  return session
}

export async function setSessionCookie(token: string, expiresAt: Date): Promise<void> {
  ;(await cookies()).set(SESSION_COOKIE_NAME, token, sessionCookieOptions(expiresAt))
}

export async function clearSessionCookie(): Promise<void> {
  // Overwritten with an immediately-expiring empty value rather than deleted, so
  // the attributes (path, secure) match and the browser reliably drops it.
  ;(await cookies()).set(SESSION_COOKIE_NAME, '', {
    ...sessionCookieOptions(),
    maxAge: 0,
  })
}
