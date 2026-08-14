/**
 * Test environment.
 *
 * Set before any module reads `process.env`, because `getEnv()` memoises on first
 * use. `DATABASE_URL=memory://` gives every run a throwaway in-process Postgres —
 * the same engine and the same migrations as production, with nothing to clean up.
 */
process.env.DATABASE_URL = 'memory://'
process.env.SESSION_SECRET = 'test-session-secret-at-least-32-characters-long'
process.env.SESSION_TTL_HOURS = '8'
process.env.ADMIN_EMAIL = 'admin@acowale.test'
/** Hash of `test-password-123`, generated with `pnpm hash-password`. */
process.env.ADMIN_PASSWORD_HASH =
  'scrypt:16384:8:1:VmuMOvp+DbrwRYdAzlBaOg==:D7L8zMztIzle0GwvrjYKs86kz12UCnUWm/c6BUrroWM='
process.env.RATE_LIMIT_SALT = 'test-rate-limit-salt-value'
process.env.LOG_LEVEL = 'silent'
process.env.APP_VERSION = 'test'

export const TEST_ADMIN_EMAIL = 'admin@acowale.test'
export const TEST_ADMIN_PASSWORD = 'test-password-123'
