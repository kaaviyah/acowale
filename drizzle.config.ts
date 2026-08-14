import { defineConfig } from 'drizzle-kit'

/**
 * drizzle-kit configuration.
 *
 * Only `generate` (schema → versioned SQL in `drizzle/`) and `studio` are run
 * through drizzle-kit. Applying migrations is `scripts/migrate.ts`, so that one
 * command works against both Neon and PGlite — see that file for why.
 */
export default defineConfig({
  schema: './src/server/db/schema.ts',
  out: './drizzle',
  dialect: 'postgresql',
  // Migrations must run against a direct connection: Neon's pooled endpoint
  // multiplexes sessions, and migrations need one session to hold their lock.
  dbCredentials: {
    url: process.env.DATABASE_URL_UNPOOLED ?? process.env.DATABASE_URL ?? '',
  },
  strict: true,
  verbose: true,
})
