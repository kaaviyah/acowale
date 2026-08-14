/**
 * Generates an `ADMIN_PASSWORD_HASH` for `.env.local` / the Vercel dashboard.
 *
 *   pnpm hash-password 'the-password'
 *
 * The plaintext password is never written to disk or committed — only the scrypt
 * hash below goes into configuration.
 */
import { hashPassword } from '../src/server/lib/password'

const MIN_LENGTH = 10

async function main(): Promise<void> {
  const password = process.argv[2]

  if (!password) {
    console.error("Usage: pnpm hash-password '<password>'")
    process.exit(1)
  }

  if (password.length < MIN_LENGTH) {
    console.error(`Refusing to hash: use at least ${MIN_LENGTH} characters.`)
    process.exit(1)
  }

  const hash = await hashPassword(password)

  console.log('\nAdd this to .env.local (and to your hosting provider’s env vars):\n')
  console.log(`ADMIN_PASSWORD_HASH="${hash}"\n`)
}

main().catch((error: unknown) => {
  console.error('Failed to hash password:', error instanceof Error ? error.message : error)
  process.exit(1)
})
