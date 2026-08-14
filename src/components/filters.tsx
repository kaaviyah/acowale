/**
 * Dashboard controls.
 *
 * Split into two, deliberately, because they scope different things and a single row
 * that silently did both would make the numbers disagree:
 *
 *   `PeriodPicker` sits above everything and scopes the whole page — tiles, charts
 *   and list all describe the same window.
 *
 *   `ListFilters` sits in the submissions card and scopes only the list below it,
 *   which is a working queue rather than a chart. The card header says so.
 *
 * Both are plain GET forms: submitting changes the URL, the server re-renders, and
 * the resulting view is a shareable link with a working back button. Each form
 * carries the other's state in hidden fields so neither wipes the other.
 */
import Link from 'next/link'
import { RANGE_LABELS, STATUS_LABELS } from '@/lib/format'
import { RANGE_KEYS } from '@/server/lib/time'
import { SEARCH_MAX_LENGTH } from '@/server/schemas/limits'
import type { CategoryOption } from '@/server/repos/categories'

export interface DashboardFilters {
  range: string
  q?: string
  category?: string
  status?: string
}

const FIELD_CLASS = 'rounded-lg border border-baseline bg-surface px-3 py-2 text-sm text-ink'

/** Keeps the list filters alive when the period form is submitted, and vice versa. */
function HiddenFields({ values }: { values: Record<string, string | undefined> }) {
  return (
    <>
      {Object.entries(values)
        .filter(([, value]) => Boolean(value))
        .map(([name, value]) => (
          <input key={name} type="hidden" name={name} value={value} />
        ))}
    </>
  )
}

export function PeriodPicker({ filters }: { filters: DashboardFilters }) {
  return (
    <form method="get" action="/admin" className="flex flex-wrap items-end gap-3">
      <HiddenFields
        values={{ q: filters.q, category: filters.category, status: filters.status }}
      />

      <div>
        <label htmlFor="range" className="block text-xs font-medium text-ink-secondary">
          Period
        </label>
        <select
          id="range"
          name="range"
          defaultValue={filters.range}
          className={`mt-1 ${FIELD_CLASS}`}
        >
          {RANGE_KEYS.map((key) => (
            <option key={key} value={key}>
              {RANGE_LABELS[key]}
            </option>
          ))}
        </select>
      </div>

      <button
        type="submit"
        className="rounded-lg border border-hairline px-4 py-2 text-sm font-medium text-ink hover:bg-page"
      >
        Update
      </button>
    </form>
  )
}

export function ListFilters({
  categories,
  filters,
}: {
  categories: CategoryOption[]
  filters: DashboardFilters
}) {
  const hasFilters = Boolean(filters.q || filters.category || filters.status)

  return (
    <form method="get" action="/admin" className="flex flex-wrap items-end gap-3">
      {/* The period is set above; carry it through so this form doesn't reset it. */}
      <HiddenFields values={{ range: filters.range }} />

      <div>
        <label htmlFor="category" className="block text-xs font-medium text-ink-secondary">
          Category
        </label>
        <select
          id="category"
          name="category"
          defaultValue={filters.category ?? ''}
          className={`mt-1 ${FIELD_CLASS}`}
        >
          <option value="">All categories</option>
          {categories.map((category) => (
            <option key={category.slug} value={category.slug}>
              {category.label}
            </option>
          ))}
        </select>
      </div>

      <div>
        <label htmlFor="status" className="block text-xs font-medium text-ink-secondary">
          Status
        </label>
        <select
          id="status"
          name="status"
          defaultValue={filters.status ?? ''}
          className={`mt-1 ${FIELD_CLASS}`}
        >
          <option value="">Any status</option>
          {Object.entries(STATUS_LABELS).map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </select>
      </div>

      <div className="min-w-52 flex-1">
        <label htmlFor="q" className="block text-xs font-medium text-ink-secondary">
          Search comments
        </label>
        <input
          id="q"
          name="q"
          type="search"
          defaultValue={filters.q ?? ''}
          maxLength={SEARCH_MAX_LENGTH}
          placeholder="dark mode, invoice, timeout…"
          className={`mt-1 w-full ${FIELD_CLASS} placeholder:text-ink-muted`}
        />
      </div>

      <div className="flex items-center gap-2">
        <button
          type="submit"
          className="rounded-lg bg-series-1 px-4 py-2 text-sm font-medium text-white"
        >
          Filter
        </button>
        {hasFilters && (
          <Link
            href={`/admin?range=${filters.range}`}
            className="px-2 py-2 text-sm text-ink-secondary underline underline-offset-2 hover:text-ink"
          >
            Clear
          </Link>
        )}
      </div>
    </form>
  )
}
