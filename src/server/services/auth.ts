/**
 * Authentication.
 *
 * One admin account, configured through the environment: `ADMIN_EMAIL` and an
 * `ADMIN_PASSWORD_HASH` produced by `pnpm hash-password`. No user table, because
 * there is exactly one user — adding one would be modelling a requirement that
 * doesn't exist yet. The migration path is a `users` table with the same hash
 * column; nothing else in the flow changes.
 */
import type { Logger } from 'pino'
import { getEnv } from '../lib/env'
import { unauthorized } from '../lib/errors'
import { verifyPassword } from '../lib/password'
import { createSessionToken } from '../lib/session'
import type { z } from 'zod'
import type { loginSchema } from '../schemas'

export interface AuthenticatedSession {
  email: string
  token: string
  expiresAt: Date
}

export async function authenticate(
  input: z.infer<typeof loginSchema>,
  log: Logger,
): Promise<AuthenticatedSession> {
  const env = getEnv()

  const emailMatches = input.email.trim().toLowerCase() === env.ADMIN_EMAIL.toLowerCase()

  /**
   * The hash is verified even when the email is wrong.
   *
   * Skipping it would make a wrong-email attempt return in a millisecond and a
   * wrong-password attempt take ~80ms, which tells an attacker which email is the
   * real one. Doing the expensive work unconditionally removes that oracle.
   */
  const passwordMatches = await verifyPassword(input.password, env.ADMIN_PASSWORD_HASH)

  if (!emailMatches || !passwordMatches) {
    // One message for both failures, for the same reason.
    log.warn({ emailMatches }, 'failed sign-in attempt')
    throw unauthorized('That email or password is not correct.')
  }

  const { token, expiresAt } = await createSessionToken(env.ADMIN_EMAIL)
  log.info({ expiresAt }, 'admin signed in')

  return { email: env.ADMIN_EMAIL, token, expiresAt }
}
