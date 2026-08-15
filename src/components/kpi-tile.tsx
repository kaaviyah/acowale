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
  good: 'text-status-good font-bold',
  bad: 'text-status-critical font-bold',
} as const

const ICON_MAP: Record<string, string> = {
  'Total feedback': '💬',
  'Average rating': '⭐',
  'Open': '🔄',
  'Resolved': '✅',
}

export function KpiTile({ label, value, hint, delta }: KpiTileProps) {
  const icon = ICON_MAP[label] || '📊'

  return (
    <div className="rounded-2xl border-2 border-series-1/40 bg-gradient-to-br from-series-1/12 via-series-1/6 to-transparent p-7 shadow-lg shadow-series-1/15 hover:shadow-xl hover:shadow-series-1/25 transition-all hover:border-series-1/60 hover:-translate-y-1">
      <div className="flex items-start justify-between">
        <div className="flex-1">
          <p className="text-sm font-bold text-ink-secondary uppercase tracking-wider">{label}</p>
          <p className="mt-4 text-5xl font-black tracking-tight bg-gradient-to-r from-series-1 to-series-1/60 bg-clip-text text-transparent">{value}</p>

          {hint && <p className="mt-3 text-sm font-medium text-ink-muted bg-black/5 px-3 py-1.5 rounded-lg inline-block">{hint}</p>}

          {delta && (
            <div className={`mt-4 p-3 rounded-lg bg-gradient-to-r ${delta.tone === 'good' ? 'from-status-good/10 to-status-good/5' : delta.tone === 'bad' ? 'from-status-critical/10 to-status-critical/5' : 'from-ink-muted/5 to-ink-muted/2'}`}>
              <p className={`text-sm ${TONE_CLASS[delta.tone]}`}>
                <span className="text-lg">→</span> <span className="font-black">{delta.text}</span>{' '}
                <span className="text-ink-muted font-normal">{delta.comparedWith}</span>
              </p>
            </div>
          )}
        </div>
        <div className="text-4xl ml-2">{icon}</div>
      </div>
    </div>
  )
}
