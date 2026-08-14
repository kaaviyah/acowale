/**
 * Admin session tokens.
 *
 * A signed JWT in an HttpOnly cookie. The session is *stateless*: there is no
 * server-side session table, so "sign out everywhere" is impossible and a token
 * stays valid until it expires. For one admin account with an 8-hour TTL that is an
 * acceptable trade for having no session store to run; the upgrade path (a
 * `sessions` table, or a token version claim checked against the DB) is noted in
 * DECISIONS.md.
 *
 * `jose` rather than hand-rolled HMAC: the signing is the easy part, and the parts
 * that are easy to get subtly wrong — expiry handling, algorithm confusion,
 * constant-time comparison of the signature — are exactly what a maintained,
 * audited library gets right. Verification pins `HS256` explicitly, because
 * accepting whatever algorithm the token *claims* is the classic JWT bypass.
 */
import { jwtVerify, SignJWT } from 'jose'
import { getEnv } from './env'

export const SESSION_COOKIE_NAME = 'acowale_session'

const ISSUER = 'acowale-crm'
const AUDIENCE = 'acowale-crm-admin'
const ALGORITHM = 'HS256'

export interface SessionClaims {
  email: string
  expiresAt: Date
}

const signingKey = () => new TextEncoder().encode(getEnv().SESSION_SECRET)

export async function createSessionToken(
  email: string,
): Promise<{ token: string; expiresAt: Date }> {
  const expiresAt = new Date(Date.now() + getEnv().SESSION_TTL_HOURS * 3_600_000)

  const token = await new SignJWT({ email })
    .setProtectedHeader({ alg: ALGORITHM })
    .setSubject(email)
    .setIssuer(ISSUER)
    .setAudience(AUDIENCE)
    .setIssuedAt()
    .setExpirationTime(Math.floor(expiresAt.getTime() / 1_000))
    .sign(signingKey())

  return { token, expiresAt }
}

/** Returns `null` for anything that isn't a valid, unexpired, correctly-signed token. */
export async function verifySessionToken(token: string): Promise<SessionClaims | null> {
  try {
    const { payload } = await jwtVerify(token, signingKey(), {
      issuer: ISSUER,
      audience: AUDIENCE,
      algorithms: [ALGORITHM],
    })

    if (typeof payload.email !== 'string' || !payload.exp) return null

    return { email: payload.email, expiresAt: new Date(payload.exp * 1_000) }
  } catch {
    // Expired, tampered with, wrong audience, wrong algorithm — all the same
    // answer to the caller: not a session.
    return null
  }
}

/**
 * Cookie attributes.
 *
 * `httpOnly` keeps the token away from any script on the page, so an XSS bug can't
 * exfiltrate a session. `sameSite: 'lax'` means a cross-site POST or PATCH never
 * carries the cookie, which is what makes the admin mutations CSRF-safe without a
 * separate token. `secure` is off in development only, because a Secure cookie is
 * silently dropped over plain http on localhost.
 */
export function sessionCookieOptions(expiresAt?: Date) {
  return {
    httpOnly: true,
    secure: getEnv().NODE_ENV === 'production',
    sameSite: 'lax' as const,
    path: '/',
    ...(expiresAt ? { expires: expiresAt } : {}),
  }
}
