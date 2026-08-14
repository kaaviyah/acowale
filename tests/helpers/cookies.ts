/**
 * A cookie jar standing in for `next/headers`.
 *
 * Route handlers read and write cookies through `cookies()`, which only exists
 * inside a Next.js request. Test files mock the module and point it here, which
 * makes the authenticated and unauthenticated paths of every admin endpoint
 * testable without a running server.
 */
import { SESSION_COOKIE_NAME, createSessionToken } from '@/server/lib/session'

const jar = new Map<string, string>()

export const cookieJar = {
  clear: () => jar.clear(),
  set: (name: string, value: string) => jar.set(name, value),
}

/** The object a test's `vi.mock('next/headers')` factory should return from `cookies()`. */
export const cookiesStub = () => ({
  get: (name: string) => {
    const value = jar.get(name)
    return value === undefined ? undefined : { name, value }
  },
  set: (name: string, value: string) => {
    jar.set(name, value)
  },
  delete: (name: string) => {
    jar.delete(name)
  },
})

/** Puts a genuine signed session token in the jar — not a fake, the real thing. */
export async function signInAsAdmin(email = 'admin@acowale.test'): Promise<void> {
  const { token } = await createSessionToken(email)
  jar.set(SESSION_COOKIE_NAME, token)
}
