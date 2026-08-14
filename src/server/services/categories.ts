/**
 * Category use case.
 *
 * Thin by design — it exists so the route handler depends on a service rather than
 * reaching into a repository, which keeps the one-way dependency rule intact even
 * where today's rule is "return the list".
 */
import { getDb } from '../db/client'
import { listActiveCategories, type CategoryOption } from '../repos/categories'

export async function listCategories(): Promise<CategoryOption[]> {
  const db = await getDb()
  return listActiveCategories(db)
}
