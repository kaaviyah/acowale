/**
 * Feedback queries.
 */
import { and, eq, gte, ilike, lt, sql, type SQL } from 'drizzle-orm'
import type { Db } from '../db/client'
import { categories, feedback, type FeedbackStatus } from '../db/schema'
import type { ListFeedbackQuery } from '../schemas'

export interface FeedbackRecord {
  id: string
  comment: string
  rating: number | null
  email: string | null
  status: FeedbackStatus
  categorySlug: string
  categoryLabel: string
  createdAt: Date
  updatedAt: Date
}

export interface FeedbackPage {
  items: FeedbackRecord[]
  total: number
}

export interface InsertFeedbackInput {
  categoryId: number
  comment: string
  rating: number | null
  email: string | null
}

export async function insertFeedback(
  db: Db,
  input: InsertFeedbackInput,
): Promise<{ id: string; createdAt: Date }> {
  const [row] = await db
    .insert(feedback)
    .values(input)
    .returning({ id: feedback.id, createdAt: feedback.createdAt })

  return row
}

/**
 * Escapes LIKE wildcards in user input.
 *
 * Without this, searching for `50%` matches every row (`%` is "anything") and
 * searching for `a_b` matches `axb` — the search silently returns wrong results
 * rather than failing, which is the worst kind of bug. Backslash is Postgres's
 * default LIKE escape character, so no `ESCAPE` clause is needed.
 */
export function escapeLikePattern(term: string): string {
  return term.replace(/[\\%_]/g, (character) => `\\${character}`)
}

function buildFilters(query: ListFeedbackQuery): SQL[] {
  const filters: SQL[] = []

  if (query.q) {
    // Indexed by idx_feedback_comment_trgm (GIN + pg_trgm).
    filters.push(ilike(feedback.comment, `%${escapeLikePattern(query.q)}%`))
  }
  if (query.category) filters.push(eq(categories.slug, query.category))
  if (query.status) filters.push(eq(feedback.status, query.status))
  if (query.rating) filters.push(eq(feedback.rating, query.rating))
  if (query.from) filters.push(gte(feedback.createdAt, query.from))
  if (query.to) filters.push(lt(feedback.createdAt, query.to))

  return filters
}

/** `NULLS LAST` on rating sorts: unrated feedback shouldn't lead a "worst first" view. */
function buildOrderBy(sort: ListFeedbackQuery['sort']): SQL {
  switch (sort) {
    case 'oldest':
      return sql`${feedback.createdAt} ASC`
    case 'rating_desc':
      return sql`${feedback.rating} DESC NULLS LAST, ${feedback.createdAt} DESC`
    case 'rating_asc':
      return sql`${feedback.rating} ASC NULLS LAST, ${feedback.createdAt} DESC`
    case 'newest':
    default:
      return sql`${feedback.createdAt} DESC`
  }
}

/**
 * One page of feedback, plus the total number of matches.
 *
 * The total comes from `count(*) OVER ()` in the same statement rather than a
 * second `SELECT count(*)`: on a serverless connection each round trip costs more
 * than the window function does. An empty page yields no rows to carry the count,
 * which is exactly when the total is 0 anyway.
 *
 * Pagination is offset-based. That is the right trade at this size and the wrong
 * one at a million rows, where `OFFSET 20000` still walks 20,000 rows — see
 * DECISIONS.md for the keyset alternative.
 */
export async function listFeedback(db: Db, query: ListFeedbackQuery): Promise<FeedbackPage> {
  const filters = buildFilters(query)

  const rows = await db
    .select({
      id: feedback.id,
      comment: feedback.comment,
      rating: feedback.rating,
      email: feedback.email,
      status: feedback.status,
      categorySlug: categories.slug,
      categoryLabel: categories.label,
      createdAt: feedback.createdAt,
      updatedAt: feedback.updatedAt,
      total: sql<number>`count(*) over ()`.mapWith(Number),
    })
    .from(feedback)
    .innerJoin(categories, eq(categories.id, feedback.categoryId))
    .where(filters.length > 0 ? and(...filters) : undefined)
    .orderBy(buildOrderBy(query.sort))
    .limit(query.pageSize)
    .offset((query.page - 1) * query.pageSize)

  return {
    items: rows.map(({ total: _total, ...item }) => item),
    total: rows[0]?.total ?? 0,
  }
}

/** Returns `undefined` when the id doesn't exist, so the caller can 404. */
export async function updateFeedbackStatus(
  db: Db,
  id: string,
  status: FeedbackStatus,
): Promise<{ id: string; status: FeedbackStatus; updatedAt: Date } | undefined> {
  const [row] = await db
    .update(feedback)
    .set({ status, updatedAt: new Date() })
    .where(eq(feedback.id, id))
    .returning({ id: feedback.id, status: feedback.status, updatedAt: feedback.updatedAt })

  return row
}
