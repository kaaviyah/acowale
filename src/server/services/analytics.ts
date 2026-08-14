/**
 * Analytics use case.
 *
 * Turns the raw aggregate row into the shape the dashboard renders, and owns the
 * arithmetic the UI should not be doing: shares, period-over-period deltas, and the
 * distinction between "zero" and "no data to compare against".
 */
import { getDb } from '../db/client'
import { fetchAnalyticsPayload } from '../repos/analytics'
import { percentageChange, REPORTING_TIME_ZONE, resolvePeriod, type RangeKey } from '../lib/time'

export interface CategoryShare {
  slug: string
  label: string
  count: number
  /** Fraction of total submissions in the window, 0–1. */
  share: number
}

export interface AnalyticsSummary {
  range: RangeKey
  generatedAt: string
  /** Named so the client formats dates in the same zone the buckets were cut in. */
  timeZone: string
  period: { from: string; to: string; days: number }
  totals: {
    count: number
    ratedCount: number
    avgRating: number | null
    byStatus: { new: number; inProgress: number; resolved: number }
  }
  deltas: {
    /** Percentage change vs the previous window, or `null` with no baseline. */
    countPct: number | null
    previousCount: number
    /** Absolute change in average rating, e.g. +0.2 stars. */
    avgRatingDelta: number | null
  }
  byCategory: CategoryShare[]
  trend: { date: string; count: number }[]
}

export async function getAnalyticsSummary(range: RangeKey): Promise<AnalyticsSummary> {
  const period = resolvePeriod(range)
  const db = await getDb()
  const payload = await fetchAnalyticsPayload(db, period)

  const avgRatingDelta =
    payload.avgRating !== null && payload.previousAvgRating !== null
      ? Math.round((payload.avgRating - payload.previousAvgRating) * 100) / 100
      : null

  return {
    range,
    generatedAt: new Date().toISOString(),
    timeZone: REPORTING_TIME_ZONE,
    period: {
      from: period.from.toISOString(),
      to: period.to.toISOString(),
      days: period.days,
    },
    totals: {
      count: payload.total,
      ratedCount: payload.ratedCount,
      avgRating: payload.avgRating,
      byStatus: {
        new: payload.statusNew,
        inProgress: payload.statusInProgress,
        resolved: payload.statusResolved,
      },
    },
    deltas: {
      countPct: percentageChange(payload.total, payload.previousTotal),
      previousCount: payload.previousTotal,
      avgRatingDelta,
    },
    byCategory: payload.byCategory.map((category) => ({
      ...category,
      // Guarded: an empty window would otherwise divide by zero and emit NaN,
      // which serialises to `null` and breaks the chart silently.
      share: payload.total > 0 ? category.count / payload.total : 0,
    })),
    trend: payload.trend,
  }
}
