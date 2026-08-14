/**
 * Category queries.
 *
 * Repositories are the only layer that touches the database. Services call them,
 * route handlers never do — which is what keeps SQL out of HTTP code and makes the
 * services testable against a real Postgres without a server.
 */
import { and, asc, eq } from 'drizzle-orm'
import type { Db } from '../db/client'
import { categories } from '../db/schema'

export interface CategoryOption {
  slug: string
  label: string
}

/** Active categories in the order the product team chose. */
export function listActiveCategories(db: Db): Promise<CategoryOption[]> {
  return db
    .select({ slug: categories.slug, label: categories.label })
    .from(categories)
    .where(eq(categories.isActive, true))
    .orderBy(asc(categories.sortOrder), asc(categories.label))
}

/**
 * Resolves a public slug to an internal id.
 *
 * Returns `undefined` for unknown *or* retired categories: once a category is
 * deactivated, new submissions against it are rejected while its history stays
 * intact.
 */
export async function findActiveCategoryIdBySlug(
  db: Db,
  slug: string,
): Promise<number | undefined> {
  const [row] = await db
    .select({ id: categories.id })
    .from(categories)
    .where(and(eq(categories.slug, slug), eq(categories.isActive, true)))
    .limit(1)

  return row?.id
}
