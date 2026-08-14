/**
 * Analytics integration tests.
 *
 * The point of these is arithmetic, not plumbing: a dashboard that renders
 * beautifully and counts wrong is worse than no dashboard, and every assertion here
 * is a number a reader would otherwise have to trust.
 */
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { createTestDatabase, resetTestData, seedFeedback, type TestDatabase } from '../helpers/db'
import { cookieJar, signInAsAdmin } from '../helpers/cookies'

vi.mock('next/headers', async () => {
  const { cookiesStub } = await import('../helpers/cookies')
  return { cookies: async () => cookiesStub() }
})

const { GET: getSummary } = await import('@/app/api/analytics/summary/route')

let database: TestDatabase

const DAY = 86_400_000
const daysAgo = (days: number, hour = 12) => {
  const date = new Date(Date.now() - days * DAY)
  date.setUTCHours(hour, 0, 0, 0)
  return date
}

const summary = (query = '') =>
  getSummary(new Request(`http://localhost/api/analytics/summary${query}`), {})

beforeAll(async () => {
  database = await createTestDatabase()
})

afterAll(async () => {
  await database.close()
})

beforeEach(async () => {
  await resetTestData(database.db)
  cookieJar.clear()
  await signInAsAdmin()

  await seedFeedback(database.db, [
    // Inside the last 30 days.
    { category: 'product', rating: 5, status: 'resolved', createdAt: daysAgo(1) },
    { category: 'product', rating: 4, status: 'in_progress', createdAt: daysAgo(2) },
    { category: 'billing', rating: 2, status: 'new', createdAt: daysAgo(3) },
    { category: 'support', rating: null, status: 'new', createdAt: daysAgo(4) },
    // Inside the previous 30-day window, for the delta.
    { category: 'product', rating: 3, status: 'resolved', createdAt: daysAgo(40) },
    { category: 'ui_ux', rating: 1, status: 'resolved', createdAt: daysAgo(45) },
    // Outside both windows.
    { category: 'other', rating: 5, status: 'resolved', createdAt: daysAgo(200) },
  ])
})

describe('GET /api/analytics/summary', () => {
  it('refuses an unauthenticated request', async () => {
    cookieJar.clear()
    expect((await summary()).status).toBe(401)
  })

  it('counts only the requested window', async () => {
    const body = await (await summary('?range=30d')).json()

    expect(body.range).toBe('30d')
    expect(body.totals.count).toBe(4)
    expect(body.totals.byStatus).toEqual({ new: 2, inProgress: 1, resolved: 1 })
  })

  it('averages only the rated submissions', async () => {
    // (5 + 4 + 2) / 3 = 3.67 — the unrated support ticket must not count as a zero.
    const body = await (await summary('?range=30d')).json()

    expect(body.totals.ratedCount).toBe(3)
    expect(body.totals.avgRating).toBeCloseTo(3.67, 2)
  })

  it('compares against the previous window of equal length', async () => {
    const body = await (await summary('?range=30d')).json()

    expect(body.deltas.previousCount).toBe(2)
    // 4 vs 2 = +100%
    expect(body.deltas.countPct).toBe(100)
    // Average rating went 2.0 → 3.67, so +1.67 stars.
    expect(body.deltas.avgRatingDelta).toBeCloseTo(1.67, 2)
  })

  it('includes categories with no feedback, so a quiet category is visible', async () => {
    const body = await (await summary('?range=30d')).json()
    const counts = Object.fromEntries(
      body.byCategory.map((row: { slug: string; count: number }) => [row.slug, row.count]),
    )

    // All six seeded categories are present, not just the three with submissions.
    expect(Object.keys(counts)).toHaveLength(6)
    expect(counts.product).toBe(2)
    expect(counts.billing).toBe(1)
    expect(counts.feature_request).toBe(0)
  })

  it('orders categories by volume and reports shares that sum to one', async () => {
    const body = await (await summary('?range=30d')).json()

    expect(body.byCategory[0].slug).toBe('product')
    const shareTotal = body.byCategory.reduce(
      (total: number, row: { share: number }) => total + row.share,
      0,
    )
    expect(shareTotal).toBeCloseTo(1, 6)
  })

  it('fills quiet days with zero instead of skipping them', async () => {
    const body = await (await summary('?range=30d')).json()

    // 30 whole days plus today.
    expect(body.trend).toHaveLength(31)
    expect(body.trend.filter((point: { count: number }) => point.count === 0).length).toBeGreaterThan(
      20,
    )
    expect(body.trend.every((point: { date: string }) => /^\d{4}-\d{2}-\d{2}$/.test(point.date))).toBe(
      true,
    )
  })

  it('keeps the chart and the headline number consistent', async () => {
    // If these ever disagree, the dashboard is lying to somebody.
    const body = await (await summary('?range=30d')).json()
    const trendTotal = body.trend.reduce(
      (total: number, point: { count: number }) => total + point.count,
      0,
    )

    expect(trendTotal).toBe(body.totals.count)
  })

  it('returns days in ascending order', async () => {
    const dates = (await (await summary('?range=30d')).json()).trend.map(
      (point: { date: string }) => point.date,
    )

    expect([...dates].sort()).toEqual(dates)
  })

  it('widens with the range', async () => {
    const week = await (await summary('?range=7d')).json()
    expect(week.totals.count).toBe(4)
    expect(week.trend).toHaveLength(8)

    const quarter = await (await summary('?range=90d')).json()
    expect(quarter.totals.count).toBe(6)
    expect(quarter.trend).toHaveLength(91)
  })

  it('handles an empty window without dividing by zero', async () => {
    await resetTestData(database.db)
    const body = await (await summary('?range=30d')).json()

    expect(body.totals.count).toBe(0)
    expect(body.totals.avgRating).toBeNull()
    // No baseline to compare against is null, not 0% and not infinity.
    expect(body.deltas.countPct).toBeNull()
    expect(body.byCategory.every((row: { share: number }) => row.share === 0)).toBe(true)
    expect(body.trend).toHaveLength(31)
  })

  it('names the timezone its day buckets were cut in', async () => {
    // Without this the client can't format dates to match the axis it's labelling.
    const body = await (await summary()).json()

    expect(body.timeZone).toBe('Asia/Kolkata')
    expect(body.period.days).toBe(30)
  })

  it('rejects an unknown range', async () => {
    expect((await summary('?range=5y')).status).toBe(422)
  })
})
