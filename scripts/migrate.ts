/**
 * Applies pending migrations from `drizzle/` to whichever database
 * `DATABASE_URL` points at.
 *
 * This exists instead of `drizzle-kit migrate` because the project supports two
 * drivers (Neon over HTTP in production, PGlite locally and in tests) and each
 * has its own migrator. One command, `pnpm db:migrate`, works everywhere —
 * including in CI, where the same script runs against production before deploy.
 *
 * Migrations are idempotent: Drizzle records applied migrations in
 * `drizzle.__drizzle_migrations` and skips them on re-run.
 */
import { createPgliteClient, isPostgresUrl, toPgliteDataDir } from '../src/server/db/client'

const MIGRATIONS_FOLDER = './drizzle'

async function main(): Promise<void> {
  // Prefer the direct connection: Neon's pooled endpoint can't hold the
  // session-level lock migrations rely on.
  const url = process.env.DATABASE_URL_UNPOOLED ?? process.env.DATABASE_URL

  if (!url) {
    throw new Error('DATABASE_URL is not set. Copy .env.example to .env.local first.')
  }

  const target = isPostgresUrl(url) ? 'postgres' : `pglite (${toPgliteDataDir(url)})`
  console.log(`Applying migrations from ${MIGRATIONS_FOLDER} to ${target}…`)

  if (isPostgresUrl(url)) {
    const [{ neon }, { drizzle }, { migrate }] = await Promise.all([
      import('@neondatabase/serverless'),
      import('drizzle-orm/neon-http'),
      import('drizzle-orm/neon-http/migrator'),
    ])
    await migrate(drizzle(neon(url)), { migrationsFolder: MIGRATIONS_FOLDER })
  } else {
    const [{ drizzle }, { migrate }] = await Promise.all([
      import('drizzle-orm/pglite'),
      import('drizzle-orm/pglite/migrator'),
    ])
    const client = await createPgliteClient(url)
    await migrate(drizzle(client), { migrationsFolder: MIGRATIONS_FOLDER })
    await client.close()
  }

  console.log('Migrations applied.')
}

main().catch((error: unknown) => {
  console.error('Migration failed:', error instanceof Error ? error.message : error)
  process.exit(1)
})
