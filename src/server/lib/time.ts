/**
 * Time handling for reporting.
 *
 * Everything is stored in UTC (`timestamptz`), but a dashboard is read by people
 * in one place. Bucketing by UTC days would mean "today" ends at 5:30am for a team
 * in Bengaluru, so day boundaries for the trend chart are computed in the
 * reporting timezone instead. Timestamps themselves are always sent to the client
 * as ISO-8601 and formatted there.
 */

/**
 * The timezone the dashboard's day boundaries are drawn in. A constant rather
 * than an env var: it is a product decision about whose working day the numbers
 * describe, and it should change through code review, not a dashboard toggle.
 */

export const REPORTING_TIME_ZONE = 'Asia/Kolkata'

export const RANGE_KEYS = ['7d', '30d', '90d', 'all'] as const
export type RangeKey = (typeof RANGE_KEYS)[number]

/** How far back each range reaches. `all` is capped so the trend stays finite. */
const RANGE_DAYS: Record<RangeKey, number> = {
  '7d': 7,
  '30d': 30,
  '90d': 90,
  all: 365,
}

export interface Period {
  /** Inclusive start of the window. */
  from: Date
  /** Exclusive end of the window. */
  to: Date
  /** Start of the immediately preceding window of equal length, for deltas. */
  previousFrom: Date
  days: number
}

/**
 * Resolves a range key into two comparable windows.
 *
 * The previous window is exactly the same length and sits immediately before the
 * current one, so "+12% vs previous 30 days" compares like with like — the most
 * common way period-over-period numbers go wrong is comparing a partial week
 * against a full one.
 */
export function resolvePeriod(range: RangeKey, now = new Date()): Period {
  const days = RANGE_DAYS[range]
  const to = now
  const from = new Date(to.getTime() - days * 86_400_000)
  const previousFrom = new Date(from.getTime() - days * 86_400_000)

  return { from, to, previousFrom, days }
}

/** Percentage change, or `null` when there is no baseline to compare against. */
export function percentageChange(current: number, previous: number): number | null {
  if (previous === 0) return null
  return Math.round(((current - previous) / previous) * 1000) / 10
}
