'use client'

/**
 * Submission trend.
 *
 * One series, so no legend — the card's heading names what is plotted. Marks follow
 * the house spec: a 2px line, a 10% wash beneath it, solid hairline gridlines
 * (dashed grids read as "projection" when they mean nothing), and a single end-dot
 * with a 2px surface ring carrying the latest value as a direct label.
 *
 * The `<details>` table underneath is the accessibility twin: every value stays
 * reachable without hovering, which a tooltip alone cannot promise.
 */
import {
  Area,
  AreaChart,
  CartesianGrid,
  ReferenceDot,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { formatShortDay } from '@/lib/format'

export interface TrendPoint {
  date: string
  count: number
}

interface TrendChartProps {
  points: TrendPoint[]
}

function ChartTooltip({
  active,
  payload,
}: {
  active?: boolean
  payload?: { payload: TrendPoint }[]
}) {
  if (!active || !payload?.length) return null
  const point = payload[0].payload

  return (
    <div className="rounded-lg border border-hairline bg-surface px-3 py-2 shadow-sm">
      {/* Value leads, label follows: the reader already knows which day they're on. */}
      <p className="text-sm font-semibold text-ink">
        {point.count} {point.count === 1 ? 'submission' : 'submissions'}
      </p>
      <p className="text-xs text-ink-secondary">{formatShortDay(point.date)}</p>
    </div>
  )
}

export function TrendChart({ points }: TrendChartProps) {
  const latest = points.at(-1)
  const busiest = points.reduce(
    (best, point) => (point.count > best.count ? point : best),
    points[0] ?? { date: '', count: 0 },
  )

  if (points.length === 0) {
    return <p className="py-8 text-center text-sm text-ink-secondary">Nothing to plot yet.</p>
  }

  return (
    <div>
      {/* Height includes the x-axis band, so the labels are never cropped. */}
      <div className="h-64 w-full">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={points} margin={{ top: 16, right: 20, bottom: 4, left: -8 }}>
            <defs>
              <linearGradient id="trend-wash" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="var(--series-1)" stopOpacity={0.16} />
                <stop offset="100%" stopColor="var(--series-1)" stopOpacity={0.01} />
              </linearGradient>
            </defs>

            <CartesianGrid stroke="var(--grid)" strokeWidth={1} vertical={false} />

            <XAxis
              dataKey="date"
              tickFormatter={formatShortDay}
              tick={{ fill: 'var(--ink-secondary)', fontSize: 12 }}
              tickLine={false}
              axisLine={{ stroke: 'var(--baseline)' }}
              minTickGap={28}
            />
            <YAxis
              allowDecimals={false}
              width={44}
              tick={{ fill: 'var(--ink-secondary)', fontSize: 12 }}
              tickLine={false}
              axisLine={false}
            />

            <Tooltip
              content={<ChartTooltip />}
              // The crosshair finds the day, so nobody has to hit a 2px line.
              cursor={{ stroke: 'var(--baseline)', strokeWidth: 1 }}
            />

            <Area
              type="monotone"
              dataKey="count"
              stroke="var(--series-1)"
              strokeWidth={2}
              strokeLinejoin="round"
              strokeLinecap="round"
              fill="url(#trend-wash)"
              dot={false}
              activeDot={{
                r: 4.5,
                fill: 'var(--series-1)',
                stroke: 'var(--surface-1)',
                strokeWidth: 2,
              }}
            />

            {latest && (
              <ReferenceDot
                x={latest.date}
                y={latest.count}
                r={4.5}
                fill="var(--series-1)"
                stroke="var(--surface-1)"
                strokeWidth={2}
                label={{
                  value: String(latest.count),
                  position: 'top',
                  fill: 'var(--ink-secondary)',
                  fontSize: 12,
                }}
              />
            )}
          </AreaChart>
        </ResponsiveContainer>
      </div>

      <p className="mt-2 text-xs text-ink-muted">
        Busiest day: {formatShortDay(busiest.date)} ({busiest.count})
      </p>

      <details className="mt-3 group">
        <summary className="cursor-pointer text-sm text-ink-secondary underline underline-offset-2 hover:text-ink">
          Show the numbers
        </summary>
        <div className="mt-3 max-h-56 overflow-y-auto rounded-lg border border-hairline">
          <table className="w-full text-sm">
            <caption className="sr-only">Submissions per day</caption>
            <thead className="sticky top-0 bg-page text-left text-ink-secondary">
              <tr>
                <th scope="col" className="px-3 py-2 font-medium">
                  Day
                </th>
                <th scope="col" className="px-3 py-2 text-right font-medium">
                  Submissions
                </th>
              </tr>
            </thead>
            <tbody>
              {points.map((point) => (
                <tr key={point.date} className="border-t border-hairline">
                  <td className="px-3 py-1.5 text-ink">{formatShortDay(point.date)}</td>
                  <td className="px-3 py-1.5 text-right tabular-nums text-ink">{point.count}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </details>
    </div>
  )
}
