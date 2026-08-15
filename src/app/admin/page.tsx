/**
 * The dashboard.
 *
 * A server component that calls the service layer directly and renders in one pass:
 * no loading spinners, no client-side data fetching, and a URL that fully describes
 * what is on screen. The analytics summary and the submissions page are fetched
 * concurrently, so the slower of the two sets the latency rather than their sum.
 *
 * Query parameters are parsed forgivingly here — an unrecognised value falls back to
 * its default instead of erroring. The API is strict (a bad parameter is a 422,
 * because a program should be told it is wrong); a hand-edited URL in a browser
 * should still show a dashboard.
 */
import type { Metadata } from 'next'
import { CategoryBars } from '@/components/category-bars'
import { FeedbackTable } from '@/components/feedback-table'
import { ListFilters, PeriodPicker, type DashboardFilters } from '@/components/filters'
import { KpiTile } from '@/components/kpi-tile'
import { TrendChart } from '@/components/trend-chart'
import { formatCount, formatDelta, RANGE_LABELS } from '@/lib/format'
import { RANGE_KEYS, type RangeKey } from '@/server/lib/time'
import { listFeedbackQuerySchema } from '@/server/schemas'
import { getAnalyticsSummary } from '@/server/services/analytics'
import { listCategories } from '@/server/services/categories'
import { getFeedbackList } from '@/server/services/feedback'

export const metadata: Metadata = { title: 'Overview' }

/** Always live: a cached dashboard is a misleading dashboard. */
export const dynamic = 'force-dynamic'

const first = (value: string | string[] | undefined): string | undefined =>
  Array.isArray(value) ? value[0] : value

export default async function DashboardPage(props: PageProps<'/admin'>) {
  const params = await props.searchParams

  const rangeParam = first(params.range)
  const range: RangeKey = RANGE_KEYS.includes(rangeParam as RangeKey)
    ? (rangeParam as RangeKey)
    : '30d'

  const filters: DashboardFilters = {
    range,
    q: first(params.q) || undefined,
    category: first(params.category) || undefined,
    status: first(params.status) || undefined,
  }

  // Forgiving parse: fall back to defaults rather than failing the page.
  const listQuery = listFeedbackQuerySchema.safeParse({
    q: filters.q,
    category: filters.category,
    status: filters.status,
    page: first(params.page) ?? 1,
  })

  const [summary, list, categories] = await Promise.all([
    getAnalyticsSummary(range),
    getFeedbackList(listQuery.success ? listQuery.data : listFeedbackQuerySchema.parse({})),
    listCategories(),
  ])

  const openCount = summary.totals.byStatus.new + summary.totals.byStatus.inProgress
  const resolvedShare =
    summary.totals.count > 0
      ? Math.round((summary.totals.byStatus.resolved / summary.totals.count) * 100)
      : 0

  /** Preserves every active filter when paging. */
  const pageHref = (page: number) => {
    const query = new URLSearchParams({ range })
    if (filters.q) query.set('q', filters.q)
    if (filters.category) query.set('category', filters.category)
    if (filters.status) query.set('status', filters.status)
    if (page > 1) query.set('page', String(page))
    return `/admin?${query.toString()}`
  }

  const periodLabel = RANGE_LABELS[range].toLowerCase()

  return (
    <main className="mx-auto w-full max-w-7xl flex-1 px-4 py-6">
      <div className="mb-5 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-ink">Overview</h1>
          <p className="mt-1 text-sm text-ink-secondary">
            Customer feedback for the {periodLabel}, by {summary.timeZone.replace('_', ' ')} days.
          </p>
        </div>
        <PeriodPicker filters={filters} />
      </div>

      <section
        aria-label="Headline numbers"
        className="mb-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4"
      >
        <KpiTile
          label="Total feedback"
          value={formatCount(summary.totals.count)}
          delta={{
            text: formatDelta(summary.deltas.countPct),
            tone: 'neutral',
            comparedWith: `vs ${formatCount(summary.deltas.previousCount)} in the previous period`,
          }}
        />
        <KpiTile
          label="Average rating"
          value={summary.totals.avgRating === null ? '—' : `${summary.totals.avgRating} / 5`}
          hint={`${formatCount(summary.totals.ratedCount)} of ${formatCount(
            summary.totals.count,
          )} left a rating`}
          delta={
            summary.deltas.avgRatingDelta === null
              ? undefined
              : {
                  text: `${summary.deltas.avgRatingDelta > 0 ? '+' : ''}${
                    summary.deltas.avgRatingDelta
                  }`,
                  tone: summary.deltas.avgRatingDelta >= 0 ? 'good' : 'bad',
                  comparedWith: 'stars vs previous period',
                }
          }
        />
        <KpiTile
          label="Open"
          value={formatCount(openCount)}
          hint={`${formatCount(summary.totals.byStatus.new)} new · ${formatCount(
            summary.totals.byStatus.inProgress,
          )} in progress`}
        />
        <KpiTile
          label="Resolved"
          value={formatCount(summary.totals.byStatus.resolved)}
          hint={`${resolvedShare}% of this period's feedback`}
        />
      </section>

      <div className="mb-6 grid gap-3 lg:grid-cols-5">
        <section
          aria-labelledby="trend-heading"
          className="rounded-xl border border-series-1/25 bg-surface p-4 lg:col-span-3"
        >
          <h2 id="trend-heading" className="text-sm font-bold text-ink">
            Submissions per day
          </h2>
          <p className="mt-0.5 mb-3 text-xs text-ink-secondary">
            {RANGE_LABELS[range]}, in {summary.timeZone.replace('_', ' ')} time
          </p>
          <TrendChart points={summary.trend} />
        </section>

        <section
          aria-labelledby="category-heading"
          className="rounded-xl border border-series-1/25 bg-surface p-4 lg:col-span-2"
        >
          <h2 id="category-heading" className="text-sm font-bold text-ink">
            Where feedback comes from
          </h2>
          <p className="mt-0.5 mb-3 text-xs text-ink-secondary">
            Bars are scaled to the busiest category.
          </p>
          <CategoryBars rows={summary.byCategory} total={summary.totals.count} />
        </section>
      </div>

      <section aria-labelledby="submissions-heading">
        <div className="mb-3 flex flex-wrap items-end justify-between gap-3">
          <div>
            <h2 id="submissions-heading" className="text-sm font-bold text-ink">
              Recent submissions
            </h2>
            <p className="mt-0.5 max-w-prose text-xs text-ink-secondary">
              {/* Say plainly that this list is scoped differently from the charts. */}
              Every submission, newest first. These filters apply to this list only — the charts
              above always describe the whole period.
            </p>
          </div>
          <ListFilters categories={categories} filters={filters} />
        </div>

        <FeedbackTable
          items={list.items.map((item) => ({
            ...item,
            createdAt: item.createdAt.toISOString(),
            updatedAt: item.updatedAt.toISOString(),
          }))}
          page={list.page}
          pageSize={list.pageSize}
          total={list.total}
          hasMore={list.hasMore}
          pageHref={pageHref}
        />
      </section>
    </main>
  )
}
