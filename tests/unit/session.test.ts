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

  it('rejects a tampered token', async () => {
    const { token } = await createSessionToken('admin@acowale.test')
    // Flip the last character of the signature.
    const tampered = token.slice(0, -1) + (token.at(-1) === 'A' ? 'B' : 'A')

    await expect(verifySessionToken(tampered)).resolves.toBeNull()
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
