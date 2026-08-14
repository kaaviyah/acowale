/**
 * Analytics query.
 *
 * The whole dashboard summary is one SQL statement. On a serverless connection
 * every round trip pays setup cost, so four tidy queries (totals, previous period,
 * per-category, daily trend) would cost four of them; CTEs make it one.
 *
 * Two details matter more than the shape:
 *
 *   • per-category counts are a LEFT JOIN *from* `categories`, so a category with
 *     no feedback in the window renders as 0 instead of disappearing — a category
 *     nobody is complaining about is a finding, not an absence.
 *   • the trend is a LEFT JOIN against `generate_series`, so quiet days render as 0
 *     instead of being skipped, which would otherwise draw a straight line between
 *     two distant points and hide the gap.
 */
import { sql } from 'drizzle-orm'
import type { Db } from '../db/client'
import { REPORTING_TIME_ZONE, type Period } from '../lib/time'

export interface AnalyticsPayload {
  total: number
  ratedCount: number
  avgRating: number | null
  statusNew: number
  statusInProgress: number
  statusResolved: number
  previousTotal: number
  previousAvgRating: number | null
  byCategory: { slug: string; label: string; count: number }[]
  trend: { date: string; count: number }[]
}

export async function fetchAnalyticsPayload(db: Db, period: Period): Promise<AnalyticsPayload> {
  const from = period.from.toISOString()
  const to = period.to.toISOString()
  const previousFrom = period.previousFrom.toISOString()
  const timeZone = REPORTING_TIME_ZONE

  /**
   * Timestamps are bound as ISO strings with explicit `::timestamptz` casts rather
   * than as `Date` objects, so both drivers (Neon over HTTP, PGlite in-process)
   * serialise them identically.
   */
  const query = sql`
    WITH current_window AS (
      SELECT
        count(*)::int                                              AS total,
        count(rating)::int                                         AS rated_count,
        round(avg(rating)::numeric, 2)::float8                     AS avg_rating,
        count(*) FILTER (WHERE status = 'new')::int                AS status_new,
        count(*) FILTER (WHERE status = 'in_progress')::int        AS status_in_progress,
        count(*) FILTER (WHERE status = 'resolved')::int           AS status_resolved
      FROM feedback
      WHERE created_at >= ${from}::timestamptz
        AND created_at <  ${to}::timestamptz
    ),
    previous_window AS (
      SELECT
        count(*)::int                                              AS total,
        round(avg(rating)::numeric, 2)::float8                     AS avg_rating
      FROM feedback
      WHERE created_at >= ${previousFrom}::timestamptz
        AND created_at <  ${from}::timestamptz
    ),
    by_category AS (
      SELECT
        c.slug,
        c.label,
        c.sort_order,
        count(f.id)::int AS count
      FROM categories c
      LEFT JOIN feedback f
        ON f.category_id = c.id
       AND f.created_at >= ${from}::timestamptz
       AND f.created_at <  ${to}::timestamptz
      WHERE c.is_active
      GROUP BY c.slug, c.label, c.sort_order
    ),
    days AS (
      SELECT generate_series(
        date_trunc('day', ${from}::timestamptz AT TIME ZONE ${timeZone}),
        date_trunc('day', ${to}::timestamptz   AT TIME ZONE ${timeZone}),
        interval '1 day'
      ) AS day
    ),
    trend AS (
      SELECT d.day, count(f.id)::int AS count
      FROM days d
      LEFT JOIN feedback f
        ON date_trunc('day', f.created_at AT TIME ZONE ${timeZone}) = d.day
       AND f.created_at >= ${from}::timestamptz
       AND f.created_at <  ${to}::timestamptz
      GROUP BY d.day
    )
    SELECT json_build_object(
      'total',            (SELECT total FROM current_window),
      'ratedCount',       (SELECT rated_count FROM current_window),
      'avgRating',        (SELECT avg_rating FROM current_window),
      'statusNew',        (SELECT status_new FROM current_window),
      'statusInProgress', (SELECT status_in_progress FROM current_window),
      'statusResolved',   (SELECT status_resolved FROM current_window),
      'previousTotal',    (SELECT total FROM previous_window),
      'previousAvgRating',(SELECT avg_rating FROM previous_window),
      'byCategory', COALESCE((
        SELECT json_agg(
          json_build_object('slug', slug, 'label', label, 'count', count)
          ORDER BY count DESC, sort_order ASC
        ) FROM by_category
      ), '[]'::json),
      'trend', COALESCE((
        SELECT json_agg(
          json_build_object('date', to_char(day, 'YYYY-MM-DD'), 'count', count)
          ORDER BY day ASC
        ) FROM trend
      ), '[]'::json)
    ) AS payload
  `

  const result = await db.execute(query)
  const rows = (result as { rows: { payload: AnalyticsPayload }[] }).rows

  return rows[0].payload
}
