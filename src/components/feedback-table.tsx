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
      <div className="rounded-xl border border-hairline bg-surface p-10 text-center">
        <p className="font-medium text-ink">Nothing matches these filters</p>
        <p className="mt-1 text-sm text-ink-secondary">
          Try a wider period, or clear the search term.
        </p>
      </div>
    )
  }

  const firstOnPage = (page - 1) * pageSize + 1
  const lastOnPage = Math.min(page * pageSize, total)

  return (
    <div className="overflow-hidden rounded-xl border border-hairline bg-surface">
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <caption className="sr-only">
            Feedback submissions, {firstOnPage} to {lastOnPage} of {total}
          </caption>
          <thead className="border-b border-hairline bg-page text-left text-ink-secondary">
            <tr>
              <th scope="col" className="px-4 py-3 font-medium">
                Feedback
              </th>
              <th scope="col" className="px-4 py-3 font-medium">
                Category
              </th>
              <th scope="col" className="px-4 py-3 font-medium">
                Rating
              </th>
              <th scope="col" className="px-4 py-3 font-medium">
                Received
              </th>
              <th scope="col" className="px-4 py-3 font-medium">
                Status
              </th>
              <th scope="col" className="px-4 py-3 text-right font-medium">
                Change
              </th>
            </tr>
          </thead>
          <tbody>
            {items.map((item) => (
              <tr key={item.id} className="border-b border-hairline last:border-b-0 align-top">
                <td className="max-w-md px-4 py-3">
                  <p className="text-ink">{item.comment}</p>
                  {item.email && (
                    <p className="mt-1 text-xs text-ink-muted">
                      {/* Contactable submissions are the actionable ones. */}
                      <a href={`mailto:${item.email}`} className="underline underline-offset-2">
                        {item.email}
                      </a>
                    </p>
                  )}
                </td>
                <td className="whitespace-nowrap px-4 py-3 text-ink-secondary">
                  {item.categoryLabel}
                </td>
                <td className="whitespace-nowrap px-4 py-3 tabular-nums text-ink-secondary">
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
                <td className="whitespace-nowrap px-4 py-3 tabular-nums text-ink-secondary">
                  <time dateTime={item.createdAt}>{formatDateTime(item.createdAt)}</time>
                </td>
                <td className="whitespace-nowrap px-4 py-3">
                  <StatusBadge status={item.status} />
                </td>
                <td className="px-4 py-3 text-right">
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
        className="flex items-center justify-between gap-4 border-t border-hairline px-4 py-3 text-sm"
      >
        <p className="text-ink-secondary tabular-nums">
          {formatCount(firstOnPage)}–{formatCount(lastOnPage)} of {formatCount(total)}
        </p>
        <div className="flex gap-2">
          {page > 1 ? (
            <Link
              href={pageHref(page - 1)}
              className="rounded-lg border border-hairline px-3 py-1.5 text-ink hover:bg-page"
            >
              Previous
            </Link>
          ) : (
            <span className="rounded-lg border border-hairline px-3 py-1.5 text-ink-muted">
              Previous
            </span>
          )}
          {hasMore ? (
            <Link
              href={pageHref(page + 1)}
              className="rounded-lg border border-hairline px-3 py-1.5 text-ink hover:bg-page"
            >
              Next
            </Link>
          ) : (
            <span className="rounded-lg border border-hairline px-3 py-1.5 text-ink-muted">
              Next
            </span>
          )}
        </div>
      </nav>
    </div>
  )
}
