/**
 * Stat tile.
 *
 * The right form for a single headline number: a one-bar bar chart says less and
 * costs more. The delta is signed and names the period it compares against, because
 * "+12%" on its own is not a fact.
 *
 * Delta colour is only applied where a direction genuinely means better or worse.
 * More feedback arriving is not self-evidently good news, so the count tile shows
 * its change in neutral ink; average rating going up is unambiguous, so that one is
 * coloured.
 */
interface KpiTileProps {
  label: string
  value: string
  /** Small caption under the value, e.g. how many submissions carried a rating. */
  hint?: string
  delta?: {
    text: string
    /** `neutral` when up isn't necessarily good. */
    tone: 'neutral' | 'good' | 'bad'
    /** What the change is measured against. */
    comparedWith: string
  }
}

const TONE_CLASS = {
  neutral: 'text-ink-secondary',
  good: 'text-status-good',
  bad: 'text-status-critical',
} as const

const ICON_MAP: Record<string, string> = {
  'Total feedback': '💬',
  'Average rating': '⭐',
  Open: '🔄',
  Resolved: '✅',
}

export function KpiTile({ label, value, hint, delta }: KpiTileProps) {
  const icon = ICON_MAP[label] ?? '📊'

  return (
    <div className="rounded-xl border border-series-1/25 bg-gradient-to-br from-series-1/8 to-transparent p-4 transition-colors hover:border-series-1/45">
      <div className="flex items-start justify-between gap-2">
        <p className="text-xs font-bold tracking-wide text-ink-secondary uppercase">{label}</p>
        {/* Decoration, so it sits quieter than the number it labels. */}
        <span aria-hidden="true" className="text-sm opacity-60">
          {icon}
        </span>
      </div>

      {/* Proportional figures: tabular digits make a large number look loose. */}
      <p className="mt-1.5 text-2xl font-bold tracking-tight text-ink">{value}</p>

      {hint && <p className="mt-1 text-xs text-ink-muted">{hint}</p>}

      {delta && (
        <p className={`mt-2 text-xs ${TONE_CLASS[delta.tone]}`}>
          <span className="font-semibold">{delta.text}</span>{' '}
          <span className="text-ink-muted">{delta.comparedWith}</span>
        </p>
      )}
    </div>
  )
}
