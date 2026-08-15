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

const BAR_COLORS = [
  'from-blue-500 to-blue-400',
  'from-purple-500 to-purple-400',
  'from-pink-500 to-pink-400',
  'from-orange-500 to-orange-400',
  'from-green-500 to-green-400',
  'from-indigo-500 to-indigo-400',
]

export function CategoryBars({ rows, total }: CategoryBarsProps) {
  if (total === 0) {
    return (
      <p className="py-8 text-center text-sm text-ink-secondary">
        📊 No feedback in this period yet.
      </p>
    )
  }

  // Bars are scaled to the largest category, not to the total: with six categories
  // sharing 100%, scaling by share would leave every bar short and hard to compare.
  const largest = Math.max(...rows.map((row) => row.count), 1)

  return (
    <ol className="space-y-4">
      {rows.map((row, index) => (
        <li key={row.slug} className="group">
          <div className="flex items-baseline justify-between gap-3 text-sm mb-2">
            <span className="truncate text-ink font-bold">{row.label}</span>
            <div className="shrink-0 tabular-nums text-right">
              <span className="font-black text-lg text-series-1">{formatCount(row.count)}</span>
              <span className="ml-2 text-ink-muted font-bold">{formatShare(row.share)}</span>
            </div>
          </div>

          <div className="h-4 w-full rounded-full bg-gradient-to-r from-ink-muted/20 to-ink-muted/5 overflow-hidden shadow-inner">
            <div
              className={`h-4 rounded-full bg-gradient-to-r ${
                BAR_COLORS[index % BAR_COLORS.length]
              } transition-all duration-500 group-hover:shadow-lg group-hover:shadow-blue-500/40 transform group-hover:scale-y-125`}
              style={{ width: `${Math.max((row.count / largest) * 100, row.count > 0 ? 2 : 0)}%` }}
            />
          </div>
        </li>
      ))}
    </ol>
  )
}
