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
      <div className="rounded-2xl border-2 border-series-1/20 bg-gradient-to-br from-series-1/10 to-series-1/5 p-12 text-center shadow-lg shadow-series-1/10">
        <p className="text-2xl font-bold text-ink">📭 Nothing matches these filters</p>
        <p className="mt-2 text-sm text-ink-secondary">
          Try a wider period, or clear the search term.
        </p>
      </div>
    )
  }

  const firstOnPage = (page - 1) * pageSize + 1
  const lastOnPage = Math.min(page * pageSize, total)

  return (
    <div className="overflow-hidden rounded-2xl border-2 border-series-1/30 bg-gradient-to-b from-surface to-series-1/5 shadow-xl shadow-series-1/15">
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <caption className="sr-only">
            Feedback submissions, {firstOnPage} to {lastOnPage} of {total}
          </caption>
          <thead className="border-b-2 border-series-1/30 bg-gradient-to-r from-series-1/15 via-series-1/10 to-series-1/5 text-left text-ink">
            <tr>
              <th scope="col" className="px-5 py-4 font-black text-sm uppercase tracking-wider">
                💭 Feedback
              </th>
              <th scope="col" className="px-5 py-4 font-black text-sm uppercase tracking-wider">
                📌 Category
              </th>
              <th scope="col" className="px-5 py-4 font-black text-sm uppercase tracking-wider">
                ⭐ Rating
              </th>
              <th scope="col" className="px-5 py-4 font-black text-sm uppercase tracking-wider">
                📅 Received
              </th>
              <th scope="col" className="px-5 py-4 font-black text-sm uppercase tracking-wider">
                🏷️ Status
              </th>
              <th scope="col" className="px-5 py-4 text-right font-black text-sm uppercase tracking-wider">
                ⚙️ Action
              </th>
            </tr>
          </thead>
          <tbody>
            {items.map((item) => (
              <tr
                key={item.id}
                className="border-b border-series-1/10 hover:bg-gradient-to-r hover:from-series-1/8 hover:to-series-1/3 transition-all hover:shadow-md last:border-b-0 align-top"
              >
                <td className="max-w-md px-5 py-4">
                  <p className="text-ink font-bold line-clamp-2">{item.comment}</p>
                  {item.email && (
                    <p className="mt-2 text-xs font-semibold">
                      <a href={`mailto:${item.email}`} className="text-series-1 underline underline-offset-2 hover:text-series-1/70">
                        📧 {item.email}
                      </a>
                    </p>
                  )}
                </td>
                <td className="whitespace-nowrap px-5 py-4 text-ink font-bold">
                  <span className="inline-block px-3 py-1 rounded-full bg-series-1/10 border border-series-1/20">
                    {item.categoryLabel}
                  </span>
                </td>
                <td className="whitespace-nowrap px-5 py-4 tabular-nums">
                  {item.rating === null ? (
                    <span className="text-ink-muted font-bold">—</span>
                  ) : (
                    <span className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-status-warning/15 border border-status-warning/30">
                      <span aria-hidden="true" className="text-lg">⭐</span>
                      <span className="font-bold text-status-warning">{item.rating}/5</span>
                    </span>
                  )}
                </td>
                <td className="whitespace-nowrap px-5 py-4 tabular-nums font-medium text-ink-secondary">
                  <time dateTime={item.createdAt} className="font-bold">{formatDateTime(item.createdAt)}</time>
                </td>
                <td className="whitespace-nowrap px-5 py-4">
                  <StatusBadge status={item.status} />
                </td>
                <td className="px-5 py-4 text-right">
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
        className="flex items-center justify-between gap-4 border-t-2 border-series-1/20 bg-gradient-to-r from-series-1/10 to-series-1/5 px-5 py-4 text-sm"
      >
        <p className="text-ink-secondary tabular-nums font-bold">
          Showing {formatCount(firstOnPage)}–{formatCount(lastOnPage)} of {formatCount(total)}
        </p>
        <div className="flex gap-2">
          {page > 1 ? (
            <Link
              href={pageHref(page - 1)}
              scroll={false}
              className="rounded-lg border-2 border-series-1/40 bg-gradient-to-r from-series-1/15 to-series-1/5 px-4 py-2 text-series-1 font-bold hover:border-series-1/60 hover:bg-series-1/20 transition-all hover:shadow-md"
            >
              ← Previous
            </Link>
          ) : (
            <span className="rounded-lg border-2 border-series-1/20 px-4 py-2 text-ink-muted font-bold bg-ink-muted/5">
              ← Previous
            </span>
          )}
          {hasMore ? (
            <Link
              href={pageHref(page + 1)}
              scroll={false}
              className="rounded-lg border-2 border-series-1/40 bg-gradient-to-r from-series-1/15 to-series-1/5 px-4 py-2 text-series-1 font-bold hover:border-series-1/60 hover:bg-series-1/20 transition-all hover:shadow-md"
            >
              Next →
            </Link>
          ) : (
            <span className="rounded-lg border-2 border-series-1/20 px-4 py-2 text-ink-muted font-bold bg-ink-muted/5">
              Next →
            </span>
          )}
        </div>
      </nav>
    </div>
  )
}
