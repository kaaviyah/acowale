/**
 * Database client.
 *
 * The driver is chosen from the connection string's scheme:
 *
 *   `postgres://…`        → Neon's HTTP driver. One HTTP round trip per query and
 *                           no TCP handshake, which is what you want when the
 *                           caller is a serverless function that may be cold.
 *   `file:…` / `memory://` → PGlite: real Postgres compiled to WASM, running in
 *                           this process. `pnpm install && pnpm dev` works with
 *                           no cloud account and no Docker, and the integration
 *                           tests exercise the same SQL as production.
 *
 * Both are Postgres and both are driven through the same Drizzle query builder,
 * so application code never learns which one it is talking to.
 */
import { mkdirSync } from 'node:fs'
import { dirname } from 'node:path'
import { sql } from 'drizzle-orm'
import type { PgDatabase, PgQueryResultHKT } from 'drizzle-orm/pg-core'
import { getEnv } from '../lib/env'
import * as schema from './schema'

/**
 * The narrowest type both drivers satisfy. Drizzle types each driver's result
 * shape separately, so `PgQueryResultHKT` is the common ancestor that keeps the
 * schema-aware query builder intact.
 */
export type Db = PgDatabase<PgQueryResultHKT, typeof schema>

export const isPostgresUrl = (url: string) =>
  url.startsWith('postgres://') || url.startsWith('postgresql://')

/** PGlite takes a plain directory path, or `memory://` for an ephemeral database. */
export const toPgliteDataDir = (url: string) =>
  url === 'memory://' || url === ':memory:' ? 'memory://' : url.replace(/^file:/, '')

/**
 * PGlite creates its data directory but not the parents of it, so a fresh clone
 * pointed at `file:./.data/dev` would fail with ENOENT on first run. Creating the
 * parent here is what makes `pnpm install && pnpm dev` work with no setup step.
 */
export function ensurePgliteDataDir(dataDir: string): void {
  if (dataDir === 'memory://') return
  mkdirSync(dirname(dataDir), { recursive: true })
}

/**
 * Creates a PGlite instance loaded with the same extensions production uses.
 *
 * Shared by the app, `scripts/migrate.ts`, and the integration tests, so all
 * three execute byte-identical SQL — including the `pg_trgm` search index, which
 * would otherwise be a production-only code path that no test ever touches.
 *
 * Imported dynamically so PGlite (a dev/test dependency, and a WASM payload)
 * never reaches the production bundle.
 */
export async function createPgliteClient(url: string) {
  const [{ PGlite }, { pg_trgm }] = await Promise.all([
    import('@electric-sql/pglite'),
    import('@electric-sql/pglite/contrib/pg_trgm'),
  ])

  const dataDir = toPgliteDataDir(url)
  ensurePgliteDataDir(dataDir)

  return new PGlite(dataDir, { extensions: { pg_trgm } })
}

async function createDb(url: string): Promise<Db> {
  if (isPostgresUrl(url)) {
    const [{ neon }, { drizzle }] = await Promise.all([
      import('@neondatabase/serverless'),
      import('drizzle-orm/neon-http'),
    ])
    return drizzle(neon(url), { schema }) as unknown as Db
  }

  const [client, { drizzle }] = await Promise.all([
    createPgliteClient(url),
    import('drizzle-orm/pglite'),
  ])
  return drizzle(client, { schema }) as unknown as Db
}

/**
 * Cached on `globalThis` rather than in a module variable: Next.js re-evaluates
 * modules on hot reload, and a fresh PGlite instance (or Neon client) per reload
 * would leak handles and, for PGlite, lock the data directory.
 */
const globalForDb = globalThis as unknown as { __acowaleDb?: Promise<Db> }

/** The shared database handle. Awaiting is cheap after the first call. */
export function getDb(): Promise<Db> {
  globalForDb.__acowaleDb ??= createDb(getEnv().DATABASE_URL)
  return globalForDb.__acowaleDb
}

export interface DatabaseHealth {
  ok: boolean
  latencyMs: number
  error?: string
}

/**
 * Cheapest possible liveness probe for the database, used by `/api/health/ready`.
 *
 * The timeout bounds how long the health endpoint can hang — it does not cancel
 * the underlying query, which is an acceptable trade for a `SELECT 1`. Without
 * it, a network partition turns a health check into a 30-second stall, and
 * monitors interpret slow and dead identically.
 */
export async function checkDatabase(timeoutMs = 2_000): Promise<DatabaseHealth> {
  const startedAt = performance.now()

  try {
    const db = await getDb()
    await Promise.race([
      db.execute(sql`select 1`),
      new Promise((_, reject) =>
        setTimeout(() => reject(new Error(`database did not respond in ${timeoutMs}ms`)), timeoutMs),
      ),
    ])
    return { ok: true, latencyMs: Math.round(performance.now() - startedAt) }
  } catch (error) {
    return {
      ok: false,
      latencyMs: Math.round(performance.now() - startedAt),
      error: error instanceof Error ? error.message : 'unknown database error',
    }
  }
}
