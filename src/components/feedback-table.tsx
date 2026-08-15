/**
 * Recent feedback.
 *
 * A table, because past a handful of rows with several attributes each, a table is
 * the honest form — and it doubles as the accessible twin of the charts above.
 */
import Link from 'next/link'
import { formatCount, formatDateTime } from '@/lib/format'
import { StatusBadge } from './status-badge'
import { StatusControl } from './status-control'
import type { FeedbackRecord } from '@/server/repos/feedback'

interface FeedbackTableProps {
  items: (Omit<FeedbackRecord, 'createdAt' | 'updatedAt'> & {
    createdAt: string
    updatedAt: string
  })[]
  page: number
  pageSize: number
  total: number
  hasMore: boolean
  /** Builds a link to another page, preserving the active filters. */
  pageHref: (page: number) => string
}

export function FeedbackTable({
  items,
  page,
  pageSize,
  total,
  hasMore,
  pageHref,
}: FeedbackTableProps) {
  if (items.length === 0) {
    return (
      <div className="rounded-xl border border-series-1/25 bg-surface p-8 text-center">
        <p className="text-sm font-bold text-ink">Nothing matches these filters</p>
        <p className="mt-1 text-xs text-ink-secondary">
          Try a wider period, or clear the search term.
        </p>
      </div>
    )
  }

  const firstOnPage = (page - 1) * pageSize + 1
  const lastOnPage = Math.min(page * pageSize, total)

  return (
    <div className="overflow-hidden rounded-xl border border-series-1/25 bg-surface">
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <caption className="sr-only">
            Feedback submissions, {firstOnPage} to {lastOnPage} of {total}
          </caption>
          <thead className="border-b border-series-1/25 bg-series-1/8 text-left text-ink-secondary">
            <tr>
              <th scope="col" className="px-3 py-2.5 text-xs font-bold tracking-wide uppercase">
                Feedback
              </th>
              <th scope="col" className="px-3 py-2.5 text-xs font-bold tracking-wide uppercase">
                Category
              </th>
              <th scope="col" className="px-3 py-2.5 text-xs font-bold tracking-wide uppercase">
                Rating
              </th>
              <th scope="col" className="px-3 py-2.5 text-xs font-bold tracking-wide uppercase">
                Received
              </th>
              <th scope="col" className="px-3 py-2.5 text-xs font-bold tracking-wide uppercase">
                Status
              </th>
              <th
                scope="col"
                className="px-3 py-2.5 text-right text-xs font-bold tracking-wide uppercase"
              >
                Change
              </th>
            </tr>
          </thead>
          <tbody>
            {items.map((item) => (
              <tr
                key={item.id}
                className="border-b border-series-1/10 align-top transition-colors last:border-b-0 hover:bg-series-1/5"
              >
                <td className="max-w-md px-3 py-2.5">
                  <p className="text-ink">{item.comment}</p>
                  {item.email && (
                    <p className="mt-0.5 text-xs">
                      {/* Contactable submissions are the actionable ones. */}
                      <a
                        href={`mailto:${item.email}`}
                        className="text-series-1 underline underline-offset-2"
                      >
                        {item.email}
                      </a>
                    </p>
                  )}
                </td>
                <td className="px-3 py-2.5 whitespace-nowrap">
                  <span className="rounded-full border border-series-1/20 bg-series-1/10 px-2 py-0.5 text-xs font-medium text-ink-secondary">
                    {item.categoryLabel}
                  </span>
                </td>
                <td className="px-3 py-2.5 whitespace-nowrap tabular-nums text-ink-secondary">
                  {item.rating === null ? (
                    <span className="text-ink-muted">—</span>
                  ) : (
                    <>
                      <span aria-hidden="true" className="text-status-warning">
                        ★
                      </span>{' '}
                      {item.rating}
                      <span className="sr-only"> out of 5</span>
                    </>
                  )}
                </td>
                <td className="px-3 py-2.5 whitespace-nowrap tabular-nums text-ink-secondary">
                  <time dateTime={item.createdAt}>{formatDateTime(item.createdAt)}</time>
                </td>
                <td className="px-3 py-2.5 whitespace-nowrap">
                  <StatusBadge status={item.status} />
                </td>
                <td className="px-3 py-2.5 text-right">
                  <StatusControl
                    id={item.id}
                    status={item.status}
                    summary={item.comment.slice(0, 60)}
                  />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <nav
        aria-label="Pagination"
        className="flex items-center justify-between gap-4 border-t border-series-1/25 bg-series-1/5 px-3 py-2.5 text-xs"
      >
        <p className="tabular-nums text-ink-secondary">
          {formatCount(firstOnPage)}–{formatCount(lastOnPage)} of {formatCount(total)}
        </p>
        <div className="flex gap-2">
          {page > 1 ? (
            <Link
              href={pageHref(page - 1)}
              scroll={false}
              className="rounded-lg border border-series-1/30 bg-series-1/10 px-3 py-1.5 font-semibold text-series-1 transition-colors hover:border-series-1/50 hover:bg-series-1/20"
            >
              Previous
            </Link>
          ) : (
            <span className="rounded-lg border border-hairline px-3 py-1.5 font-semibold text-ink-muted">
              Previous
            </span>
          )}
          {hasMore ? (
            <Link
              href={pageHref(page + 1)}
              scroll={false}
              className="rounded-lg border border-series-1/30 bg-series-1/10 px-3 py-1.5 font-semibold text-series-1 transition-colors hover:border-series-1/50 hover:bg-series-1/20"
            >
              Next
            </Link>
          ) : (
            <span className="rounded-lg border border-hairline px-3 py-1.5 font-semibold text-ink-muted">
              Next
            </span>
          )}
        </div>
      </nav>
    </div>
  )
}
