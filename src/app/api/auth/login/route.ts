/**
 * `POST /api/auth/login`
 *
 * Rate limited harder than anything else in the app: ten attempts per quarter hour
 * per address. That is generous for a person who has forgotten which password they
 * used and useless for a script working through a word list.
 */
import { clientIpFrom, enforceRateLimits, RATE_LIMITS } from '@/server/lib/rate-limit'
import { json, withApi } from '@/server/lib/with-api'
import { setSessionCookie } from '@/server/http/session-cookie'
import { loginSchema } from '@/server/schemas'
import { authenticate } from '@/server/services/auth'

export const POST = withApi('POST /api/auth/login', async (request, _context, { log }) => {
  await enforceRateLimits(RATE_LIMITS.login, clientIpFrom(request))

  const body: unknown = await request.json().catch(() => null)
  const input = loginSchema.parse(body ?? {})

  const session = await authenticate(input, log)
  await setSessionCookie(session.token, session.expiresAt)

  // The token itself is never in the response body — only the cookie carries it,
  // so no script on the page can read it.
  return json({ email: session.email, expiresAt: session.expiresAt.toISOString() })
})
