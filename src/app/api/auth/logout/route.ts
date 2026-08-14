/**
 * `POST /api/auth/logout`
 *
 * POST, not GET: a link or a prefetch must never be able to sign someone out.
 * Because the session is a stateless JWT, this clears the cookie rather than
 * revoking the token — see `server/lib/session.ts` for that trade-off.
 */
import { clearSessionCookie } from '@/server/http/session-cookie'
import { withApi } from '@/server/lib/with-api'

export const POST = withApi('POST /api/auth/logout', async (_request, _context, { log }) => {
  await clearSessionCookie()
  log.info('admin signed out')

  return new Response(null, { status: 204 })
})
