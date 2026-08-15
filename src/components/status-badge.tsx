/**
 * Status badge.
 *
 * The word is the label; the coloured dot only reinforces it. Status colour never
 * carries the meaning alone — on a light surface the "in progress" amber sits below
 * 3:1 against the background, and a reader with a colour-vision deficiency would
 * otherwise be guessing.
 *
 * The three hues run blue → amber → green in the order work moves through them, so
 * the column reads as a progression rather than three unrelated colours. "New" is
 * deliberately not grey: grey reads as disabled or archived, and a new submission is
 * the one thing here that most wants attention.
 */
import type { FeedbackStatus } from '@/server/db/schema'
import { STATUS_LABELS } from '@/lib/format'

const DOT_CLASS: Record<FeedbackStatus, string> = {
  new: 'bg-series-1',
  in_progress: 'bg-status-warning',
  resolved: 'bg-status-good',
}

const BADGE_CLASS: Record<FeedbackStatus, string> = {
  new: 'bg-series-1/15 border-series-1/45 text-series-1',
  in_progress: 'bg-status-warning/20 border-status-warning/50 text-status-warning',
  resolved: 'bg-status-good/20 border-status-good/50 text-status-good',
}

export function StatusBadge({ status }: { status: FeedbackStatus }) {
  return (
    <span
      className={`inline-flex items-center gap-2.5 rounded-full border-2 px-4 py-2.5 text-sm font-bold whitespace-nowrap ${BADGE_CLASS[status]}`}
    >
      <span
        aria-hidden="true"
        className={`h-2.5 w-2.5 shrink-0 rounded-full ${DOT_CLASS[status]} shadow-md`}
      />
      {STATUS_LABELS[status]}
    </span>
  )
}

