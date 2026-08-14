/**
 * `GET /api/auth/me` — lets the client ask "am I still signed in?" without parsing
 * a cookie it deliberately cannot read.
 */
import { requireSession } from '@/server/http/session-cookie'
import { json, withApi } from '@/server/lib/with-api'

export const GET = withApi('GET /api/auth/me', async () => {
  const session = await requireSession()

  return json({ email: session.email, expiresAt: session.expiresAt.toISOString() })
})
