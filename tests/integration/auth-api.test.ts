/**
 * Authentication endpoint tests.
 *
 * The unit tests cover hashing and token verification in isolation; these cover the
 * flow a person actually goes through — sign in, be recognised, sign out, be
 * forgotten — plus the two failure modes that matter: wrong credentials, and someone
 * trying every password they can think of.
 */
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { SESSION_COOKIE_NAME } from '@/server/lib/session'
import { createTestDatabase, resetTestData, type TestDatabase } from '../helpers/db'
import { cookieJar, cookiesStub } from '../helpers/cookies'

vi.mock('next/headers', async () => {
  const { cookiesStub: stub } = await import('../helpers/cookies')
  return { cookies: async () => stub() }
})

const { POST: login } = await import('@/app/api/auth/login/route')
const { POST: logout } = await import('@/app/api/auth/logout/route')
const { GET: me } = await import('@/app/api/auth/me/route')

const CORRECT = { email: 'admin@acowale.test', password: 'test-password-123' }

let database: TestDatabase
let addressCounter = 0
const nextAddress = () => `198.51.100.${(addressCounter += 1)}`

const attemptLogin = (body: unknown, address = nextAddress()) =>
  login(
    new Request('http://localhost/api/auth/login', {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-forwarded-for': address },
      body: JSON.stringify(body),
    }),
    {},
  )

beforeAll(async () => {
  database = await createTestDatabase()
})

afterAll(async () => {
  await database.close()
})

beforeEach(async () => {
  // Rate limit counters live in the database, so they reset with the data.
  await resetTestData(database.db)
  cookieJar.clear()
})

describe('POST /api/auth/login', () => {
  it('signs in with correct credentials and sets a session cookie', async () => {
    const response = await attemptLogin(CORRECT)
    expect(response.status).toBe(200)

    const body = await response.json()
    expect(body.email).toBe(CORRECT.email)
    expect(body.expiresAt).toBeTruthy()

    // The token is only ever in the cookie — never in the response body, so no
    // script on the page can read it.
    expect(JSON.stringify(body)).not.toContain('eyJ')
    expect(cookiesStub().get(SESSION_COOKIE_NAME)?.value).toMatch(/^eyJ/)
  })

  it('refuses a wrong password', async () => {
    const response = await attemptLogin({ ...CORRECT, password: 'not-the-password' })

    expect(response.status).toBe(401)
    expect(cookiesStub().get(SESSION_COOKIE_NAME)).toBeUndefined()
  })

  it('refuses an unknown email with the same message as a wrong password', async () => {
    // Different messages would tell an attacker which email is the real one.
    const wrongEmail = await attemptLogin({ email: 'someone@else.test', password: CORRECT.password })
    const wrongPassword = await attemptLogin({ ...CORRECT, password: 'nope' })

    expect(wrongEmail.status).toBe(401)
    expect((await wrongEmail.json()).error.message).toBe(
      (await wrongPassword.json()).error.message,
    )
  })

  it('validates the request before checking anything', async () => {
    expect((await attemptLogin({ email: 'not-an-email', password: 'x' })).status).toBe(422)
    expect((await attemptLogin({})).status).toBe(422)
  })

  it('rate limits repeated attempts from one address', async () => {
    const address = nextAddress()

    for (let attempt = 1; attempt <= 10; attempt += 1) {
      expect((await attemptLogin({ ...CORRECT, password: `guess-${attempt}` }, address)).status).toBe(
        401,
      )
    }

    const blocked = await attemptLogin({ ...CORRECT, password: 'guess-11' }, address)
    expect(blocked.status).toBe(429)
    expect(Number(blocked.headers.get('retry-after'))).toBeGreaterThan(0)
  })

  it('rate limits by address, so one attacker cannot lock everyone out', async () => {
    const attacker = nextAddress()
    for (let attempt = 1; attempt <= 11; attempt += 1) {
      await attemptLogin({ ...CORRECT, password: 'wrong' }, attacker)
    }

    // A genuine admin on a different connection still gets in.
    expect((await attemptLogin(CORRECT, nextAddress())).status).toBe(200)
  })
})

describe('session lifecycle', () => {
  it('recognises the session, then forgets it after signing out', async () => {
    await attemptLogin(CORRECT)

    const before = await me(new Request('http://localhost/api/auth/me'), {})
    expect(before.status).toBe(200)
    expect((await before.json()).email).toBe(CORRECT.email)

    const signedOut = await logout(
      new Request('http://localhost/api/auth/logout', { method: 'POST' }),
      {},
    )
    expect(signedOut.status).toBe(204)

    const after = await me(new Request('http://localhost/api/auth/me'), {})
    expect(after.status).toBe(401)
  })

  it('rejects a tampered cookie', async () => {
    await attemptLogin(CORRECT)
    const token = cookiesStub().get(SESSION_COOKIE_NAME)!.value
    cookieJar.set(SESSION_COOKIE_NAME, `${token.slice(0, -2)}xx`)

    expect((await me(new Request('http://localhost/api/auth/me'), {})).status).toBe(401)
  })
})
