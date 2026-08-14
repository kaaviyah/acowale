/**
 * A throwaway Postgres for integration tests.
 *
 * PGlite is the real Postgres engine compiled to WASM, so these tests run the
 * committed migrations, the real constraints, and the real SQL — including the
 * `pg_trgm` search index. Mocking the database would have tested the mock; a
 * container would have needed Docker in CI.
 */
import { drizzle } from 'drizzle-orm/pglite'
import { migrate } from 'drizzle-orm/pglite/migrator'
import { createPgliteClient, type Db } from '@/server/db/client'
import * as schema from '@/server/db/schema'
import { feedback, rateLimitHits } from '@/server/db/schema'
import { seedCategories } from '@/server/db/seed'

export interface TestDatabase {
  db: Db
  close: () => Promise<void>
}

export async function createTestDatabase(): Promise<TestDatabase> {
  const client = await createPgliteClient('memory://')
  const pgliteDb = drizzle(client, { schema })

  await migrate(pgliteDb, { migrationsFolder: './drizzle' })

  const db = pgliteDb as unknown as Db
  await seedCategories(db)

  /**
   * Hand this instance to the application's own accessor, so route handlers and
   * services under test talk to it without any injection plumbing in production
   * code. Mirrors the cache in `src/server/db/client.ts`.
   */
  ;(globalThis as { __acowaleDb?: Promise<Db> }).__acowaleDb = Promise.resolve(db)

  return { db, close: () => client.close() }
}

/** Clears everything a test writes, leaving the seeded reference data in place. */
export async function resetTestData(db: Db): Promise<void> {
  await db.delete(feedback)
  await db.delete(rateLimitHits)
}

export interface SeedFeedbackRow {
  category: string
  comment?: string
  rating?: number | null
  status?: 'new' | 'in_progress' | 'resolved'
  email?: string | null
  createdAt?: Date
}

/**
 * Inserts feedback with explicit categories and timestamps.
 *
 * Analytics assertions need known values at known times, which the public API
 * cannot produce — it always stamps `now()`.
 */
export async function seedFeedback(db: Db, rows: SeedFeedbackRow[]): Promise<void> {
  const categoryRows = await db
    .select({ id: schema.categories.id, slug: schema.categories.slug })
    .from(schema.categories)
  const idBySlug = new Map(categoryRows.map((row) => [row.slug, row.id]))

  await db.insert(feedback).values(
    rows.map((row) => {
      const categoryId = idBySlug.get(row.category)
      if (categoryId === undefined) throw new Error(`Unknown test category: ${row.category}`)

      return {
        categoryId,
        comment: row.comment ?? 'Seeded feedback for a test.',
        rating: row.rating ?? null,
        email: row.email ?? null,
        status: row.status ?? ('new' as const),
        ...(row.createdAt ? { createdAt: row.createdAt, updatedAt: row.createdAt } : {}),
      }
    }),
  )
}
