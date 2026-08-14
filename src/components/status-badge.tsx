/**
 * Status badge.
 *
 * The word is the label; the coloured dot only reinforces it. Status colour never
 * carries the meaning alone — on a light surface the "in progress" amber sits below
 * 3:1 against the background, and a reader with a colour-vision deficiency would
 * otherwise be guessing.
 */
import type { FeedbackStatus } from '@/server/db/schema'
import { STATUS_LABELS } from '@/lib/format'

const DOT_CLASS: Record<FeedbackStatus, string> = {
  new: 'bg-ink-muted',
  in_progress: 'bg-status-warning',
  resolved: 'bg-status-good',
}

export function StatusBadge({ status }: { status: FeedbackStatus }) {
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full border border-hairline px-2.5 py-1 text-xs font-medium text-ink">
      <span aria-hidden="true" className={`h-2 w-2 rounded-full ${DOT_CLASS[status]}`} />
      {STATUS_LABELS[status]}
    </span>
  )
}
