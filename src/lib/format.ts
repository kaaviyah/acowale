/**
 * Presentation formatting, shared by server and client components.
 *
 * Dates are formatted in the reporting timezone rather than the viewer's, so that
 * every timestamp in the table refers to the same working day the charts are
 * bucketed by. A team in one office comparing notes should never have to ask whose
 * "yesterday" a row means.
 */
import { REPORTING_TIME_ZONE } from '@/server/lib/time'

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

/**
 * `2026-08-14` → `14 Aug`.
 *
 * Parsed by hand rather than through `new Date()`: the trend's dates are already
 * calendar days in the reporting timezone, and re-interpreting them as instants is
 * how a chart ends up one day out.
 */
export function formatShortDay(isoDate: string): string {
  const [, month, day] = isoDate.split('-')
  return `${Number(day)} ${MONTHS[Number(month) - 1]}`
}

const dateTimeFormat = new Intl.DateTimeFormat('en-GB', {
  timeZone: REPORTING_TIME_ZONE,
  day: 'numeric',
  month: 'short',
  hour: '2-digit',
  minute: '2-digit',
  hour12: false,
})

export const formatDateTime = (value: string | Date): string =>
  dateTimeFormat.format(typeof value === 'string' ? new Date(value) : value)

/** `1284` → `1,284`. Large counts are easier to size up with separators. */
export const formatCount = (value: number): string => value.toLocaleString('en-GB')

/** A signed percentage, or an em dash when there is no baseline to compare with. */
export function formatDelta(value: number | null): string {
  if (value === null) return '—'
  const sign = value > 0 ? '+' : ''
  return `${sign}${value}%`
}

export const formatShare = (share: number): string => `${Math.round(share * 100)}%`

export const STATUS_LABELS = {
  new: 'New',
  in_progress: 'In progress',
  resolved: 'Resolved',
} as const

export const RANGE_LABELS = {
  '7d': 'Last 7 days',
  '30d': 'Last 30 days',
  '90d': 'Last 90 days',
  all: 'Last 12 months',
} as const
