/**
 * Configuration doctor.
 *
 *   pnpm check-env
 *
 * Validates the environment the same way the application does, and reports what is
 * wrong in a form you can act on. Written after a deployment returned 500 on every
 * route with no clue why: the app was refusing to boot on invalid configuration,
 * which is correct, but the only way to see the reason was the hosting platform's
 * log viewer.
 *
 * Paste the values you gave your host into a shell and run this, and you get the
 * same verdict in a second:
 *
 *   DATABASE_URL='postgres://…' SESSION_SECRET='…' … pnpm check-env
 *
 * Secret values are never printed — only their length and shape, which is all you
 * need to spot the common mistakes.
 */
import { getEnv, resetEnvCache } from '../src/server/lib/env'

const REQUIRED = [
  'DATABASE_URL',
  'SESSION_SECRET',
  'ADMIN_EMAIL',
  'ADMIN_PASSWORD_HASH',
  'RATE_LIMIT_SALT',
] as const

const OPTIONAL = [
  'DATABASE_URL_UNPOOLED',
  'SESSION_TTL_HOURS',
  'LOG_LEVEL',
  'APP_VERSION',
  'NODE_ENV',
] as const

/** Enough to identify a value, never enough to use it. */
function describe(name: string, raw: string | undefined): string {
  if (raw === undefined) return 'not set'

  const shape: string[] = [`${raw.length} chars`]

  // The mistakes that actually happen when pasting into a hosting dashboard.
  if (/^["']|["']$/.test(raw)) shape.push('⚠ wrapped in quotes — remove them')
  if (raw !== raw.trim()) shape.push('⚠ leading/trailing whitespace')
  if (raw.startsWith(`${name}=`)) shape.push('⚠ includes the variable name — paste only the value')

  if (name === 'DATABASE_URL' || name === 'DATABASE_URL_UNPOOLED') {
    const scheme = raw.split(':')[0]
    shape.push(`scheme ${scheme}`)
    if (raw.startsWith('postgres')) {
      shape.push(raw.includes('-pooler') ? 'pooled endpoint' : 'direct endpoint')
      if (!raw.includes('sslmode=require')) shape.push('⚠ no sslmode=require')
    }
  }

  if (name === 'ADMIN_PASSWORD_HASH') {
    shape.push(raw.startsWith('scrypt:') ? 'starts with scrypt:' : '⚠ does not start with scrypt:')
    if (raw.includes('$')) {
      shape.push('⚠ contains $ — an env-file parser has mangled this; regenerate it')
    }
  }

  if (name === 'ADMIN_EMAIL') shape.push(raw)

  return shape.join(', ')
}

function main(): void {
  resetEnvCache()

  console.log('\nEnvironment check\n')

  console.log('Required:')
  for (const name of REQUIRED) {
    const raw = process.env[name]
    const mark = raw === undefined ? '✗' : '·'
    console.log(`  ${mark} ${name.padEnd(22)} ${describe(name, raw)}`)
  }

  console.log('\nOptional:')
  for (const name of OPTIONAL) {
    const raw = process.env[name]
    console.log(`  · ${name.padEnd(22)} ${describe(name, raw)}`)
  }

  console.log()

  try {
    const env = getEnv()
    console.log('✓ Configuration is valid.\n')
    console.log(`  database driver   ${env.DATABASE_URL.startsWith('postgres') ? 'Neon (HTTP)' : 'PGlite (in-process)'}`)
    console.log(`  environment       ${env.NODE_ENV}`)
    console.log(`  version           ${env.version}`)
    console.log(`  session lifetime  ${env.SESSION_TTL_HOURS}h`)
    console.log(`  log level         ${env.LOG_LEVEL}\n`)
  } catch (error) {
    console.error('✗ Configuration is invalid — the application would refuse to serve.\n')
    console.error(error instanceof Error ? error.message : error)
    console.error()
    process.exit(1)
  }
}

main()
