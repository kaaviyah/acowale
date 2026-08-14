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
  good: 'text-success-text',
  bad: 'text-status-critical',
} as const

export function KpiTile({ label, value, hint, delta }: KpiTileProps) {
  return (
    <div className="rounded-xl border border-hairline bg-surface p-5">
      <p className="text-sm text-ink-secondary">{label}</p>

      {/* Proportional figures: tabular digits make a large number look loose. */}
      <p className="mt-2 text-3xl font-semibold tracking-tight text-ink">{value}</p>

      {hint && <p className="mt-1 text-xs text-ink-muted">{hint}</p>}

      {delta && (
        <p className={`mt-3 text-sm ${TONE_CLASS[delta.tone]}`}>
          <span className="font-medium">{delta.text}</span>{' '}
          <span className="text-ink-muted">{delta.comparedWith}</span>
        </p>
      )}
    </div>
  )
}
