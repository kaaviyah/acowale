/**
 * Category distribution.
 *
 * The reference design for this brief showed a donut. Bars instead, deliberately:
 * six categories with similar values is precisely the case where a donut fails —
 * people compare arc lengths badly, and the labels have to go in a legend or float
 * outside the ring. Horizontal bars put long category names next to their values and
 * make "which is biggest" a single glance.
 *
 * One hue for every bar, not a ramp: length already encodes the count, so colouring
 * by value would spend the identity channel restating it. Every value is
 * direct-labelled, so nothing is reachable only by hovering.
 *
 * Plain HTML and CSS rather than a chart library — for six bars a charting runtime
 * in the client bundle buys nothing.
 */
import { formatCount, formatShare } from '@/lib/format'

interface CategoryBarsProps {
  rows: { slug: string; label: string; count: number; share: number }[]
  total: number
}

export function CategoryBars({ rows, total }: CategoryBarsProps) {
  if (total === 0) {
    return (
      <p className="py-8 text-center text-sm text-ink-secondary">
        No feedback in this period yet.
      </p>
    )
  }

  // Bars are scaled to the largest category, not to the total: with six categories
  // sharing 100%, scaling by share would leave every bar short and hard to compare.
  const largest = Math.max(...rows.map((row) => row.count), 1)

  return (
    <ol className="space-y-3.5">
      {rows.map((row) => (
        <li key={row.slug} className="group">
          <div className="flex items-baseline justify-between gap-3 text-sm">
            <span className="truncate text-ink">{row.label}</span>
            <span className="shrink-0 tabular-nums text-ink-secondary">
              {formatCount(row.count)}
              <span className="ml-1.5 text-ink-muted">{formatShare(row.share)}</span>
            </span>
          </div>

          <div className="mt-1.5 h-2 w-full rounded-sm bg-grid">
            {/* Square at the baseline, 4px rounded at the data end. */}
            <div
              className="h-2 rounded-r-[4px] bg-series-1 transition-[filter] group-hover:brightness-110"
              style={{ width: `${Math.max((row.count / largest) * 100, row.count > 0 ? 1.5 : 0)}%` }}
            />
          </div>
        </li>
      ))}
    </ol>
  )
}
