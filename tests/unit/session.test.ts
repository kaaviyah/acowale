import { SignJWT } from 'jose'
import { afterEach, describe, expect, it } from 'vitest'
import { resetEnvCache } from '@/server/lib/env'
import { createSessionToken, sessionCookieOptions, verifySessionToken } from '@/server/lib/session'

const ORIGINAL_SECRET = process.env.SESSION_SECRET

afterEach(() => {
  process.env.SESSION_SECRET = ORIGINAL_SECRET
  resetEnvCache()
})

describe('session tokens', () => {
  it('round-trips the signed-in email', async () => {
    const { token, expiresAt } = await createSessionToken('admin@acowale.test')
    const claims = await verifySessionToken(token)

    expect(claims?.email).toBe('admin@acowale.test')
    expect(claims?.expiresAt.getTime()).toBe(Math.floor(expiresAt.getTime() / 1000) * 1000)
  })

  it('rejects a token with a tampered signature', async () => {
    const { token } = await createSessionToken('admin@acowale.test')
    const [header, payload, signature] = token.split('.')

    /**
     * Tampering with the *first* character of the signature, not the last.
     *
     * A 32-byte HMAC is 43 base64url characters, so the final character carries
     * only 4 significant bits and several different values decode to the same
     * bytes. Flipping it is not reliably a change at all — an earlier version of
     * this test did exactly that and failed intermittently, because roughly a third
     * of the time the "tampered" token was byte-identical to the original and
     * verification correctly succeeded. The first character always maps onto the
     * first byte.
     */
    const tampered = (signature[0] === 'A' ? 'B' : 'A') + signature.slice(1)

    await expect(verifySessionToken(`${header}.${payload}.${tampered}`)).resolves.toBeNull()
  })

  it('rejects a token whose claims were rewritten', async () => {
    // The attack that actually matters: keep a valid signature, swap the identity.
    const { token } = await createSessionToken('admin@acowale.test')
    const [header, , signature] = token.split('.')

    const forged = Buffer.from(
      JSON.stringify({
        email: 'attacker@example.com',
        iss: 'acowale-crm',
        aud: 'acowale-crm-admin',
        exp: Math.floor(Date.now() / 1000) + 3600,
      }),
    ).toString('base64url')

    await expect(verifySessionToken(`${header}.${forged}.${signature}`)).resolves.toBeNull()
  })

  it('rejects an expired token', async () => {
    const expired = await new SignJWT({ email: 'admin@acowale.test' })
      .setProtectedHeader({ alg: 'HS256' })
      .setIssuer('acowale-crm')
      .setAudience('acowale-crm-admin')
      .setIssuedAt(Math.floor(Date.now() / 1000) - 7200)
      .setExpirationTime(Math.floor(Date.now() / 1000) - 3600)
      .sign(new TextEncoder().encode(process.env.SESSION_SECRET))

    await expect(verifySessionToken(expired)).resolves.toBeNull()
  })

  it('rejects a token signed with a different secret', async () => {
    const { token } = await createSessionToken('admin@acowale.test')

    process.env.SESSION_SECRET = 'a-completely-different-secret-32-chars-long'
    resetEnvCache()

    await expect(verifySessionToken(token)).resolves.toBeNull()
  })

  it('rejects an unsigned (alg: none) token', async () => {
    // The classic JWT bypass: claim no algorithm and hope the verifier agrees.
    const header = Buffer.from(JSON.stringify({ alg: 'none', typ: 'JWT' })).toString('base64url')
    const payload = Buffer.from(
      JSON.stringify({
        email: 'admin@acowale.test',
        iss: 'acowale-crm',
        aud: 'acowale-crm-admin',
        exp: Math.floor(Date.now() / 1000) + 3600,
      }),
    ).toString('base64url')

    await expect(verifySessionToken(`${header}.${payload}.`)).resolves.toBeNull()
  })

  it('rejects nonsense', async () => {
    for (const value of ['', 'not.a.token', 'a.b.c']) {
      await expect(verifySessionToken(value)).resolves.toBeNull()
    }
  })
})

describe('session cookie attributes', () => {
  it('is HttpOnly and SameSite=Lax, which is what makes admin mutations CSRF-safe', () => {
    const options = sessionCookieOptions(new Date('2026-08-14T00:00:00Z'))

    expect(options.httpOnly).toBe(true)
    expect(options.sameSite).toBe('lax')
    expect(options.path).toBe('/')
  })

  it('is not Secure outside production, because localhost is http', () => {
    // A Secure cookie over plain http is silently dropped, which would make local
    // development look like a broken login.
    expect(sessionCookieOptions().secure).toBe(false)
  })
})
