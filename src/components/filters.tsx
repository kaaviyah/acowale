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
 * Both navigate rather than submit: every control writes the full filter state into
 * the URL, so the view stays a shareable link with a working back button. Each one
 * carries the other's parameters through, so neither wipes the other.
 *
 * Navigation passes `scroll: false` throughout. These controls sit halfway down a
 * long page, and the default scroll-to-top would throw the reader back to the header
 * every time they narrowed the list.
 */
'use client'

import { useEffect, useRef, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { RANGE_LABELS, STATUS_LABELS } from '@/lib/format'
import { RANGE_KEYS } from '@/server/lib/time'
import { SEARCH_MAX_LENGTH } from '@/server/schemas/limits'
import type { CategoryOption } from '@/server/repos/categories'
import { CustomSelect } from './custom-select'

export interface DashboardFilters {
  range: string
  q?: string
  category?: string
  status?: string
}

export function PeriodPicker({ filters }: { filters: DashboardFilters }) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()

  const handlePeriodChange = (range: string) => {
    const params = new URLSearchParams({ range })
    // Carry the list filters through, so changing the period doesn't clear them.
    if (filters.q) params.set('q', filters.q)
    if (filters.category) params.set('category', filters.category)
    if (filters.status) params.set('status', filters.status)

    startTransition(() => {
      router.push(`/admin?${params.toString()}`, { scroll: false })
    })
  }

  return (
    <div className="w-full sm:w-56">
      <label className="mb-2 block text-xs font-bold tracking-wider text-ink-secondary uppercase">
        Period
      </label>
      <CustomSelect
        label="Period"
        value={filters.range}
        onChange={handlePeriodChange}
        disabled={isPending}
        className="border-series-1/50 from-series-1/20 to-series-1/10 font-bold text-series-1"
        options={RANGE_KEYS.map((key) => ({ value: key, label: RANGE_LABELS[key] }))}
      />
    </div>
  )
}

export function ListFilters({
  categories,
  filters,
}: {
  categories: CategoryOption[]
  filters: DashboardFilters
}) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const hasFilters = Boolean(filters.q || filters.category || filters.status)

  /**
   * Navigates with one filter replaced and the rest carried through. Built from
   * `filters` rather than `FormData`, because the selects are custom listboxes
   * rather than form fields — reading the form would silently drop them.
   *
   * Paging is deliberately not preserved: after narrowing the list, page 7 of the
   * old result set is meaningless, so every change lands back on page 1.
   */
  function apply(changes: Partial<DashboardFilters>) {
    const next = { ...filters, ...changes }
    const params = new URLSearchParams({ range: next.range })
    if (next.q) params.set('q', next.q)
    if (next.category) params.set('category', next.category)
    if (next.status) params.set('status', next.status)

    startTransition(() => {
      router.push(`/admin?${params.toString()}`, { scroll: false })
    })
  }

  // Search runs on a timer: navigating per keystroke would fire a query for every
  // prefix of the word being typed and let a slow one land after a fast one.
  const searchTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => () => {
    if (searchTimer.current) clearTimeout(searchTimer.current)
  }, [])

  function handleSearchChange(event: React.ChangeEvent<HTMLInputElement>) {
    const q = event.target.value
    if (searchTimer.current) clearTimeout(searchTimer.current)
    searchTimer.current = setTimeout(() => apply({ q }), 350)
  }

  return (
    <div className="flex w-full flex-wrap items-end gap-3">
      <div className="min-w-48 flex-1">
        <label
          id="category-label"
          className="mb-2 block text-xs font-bold tracking-wider text-ink-secondary uppercase"
        >
          Category
        </label>
        <CustomSelect
          label="Category"
          value={filters.category ?? ''}
          onChange={(category) => apply({ category })}
          disabled={isPending}
          options={[
            { value: '', label: 'All categories' },
            ...categories.map((category) => ({ value: category.slug, label: category.label })),
          ]}
        />
      </div>

      <div className="min-w-48 flex-1">
        <label className="mb-2 block text-xs font-bold tracking-wider text-ink-secondary uppercase">
          Status
        </label>
        <CustomSelect
          label="Status"
          value={filters.status ?? ''}
          onChange={(status) => apply({ status })}
          disabled={isPending}
          options={[
            { value: '', label: 'Any status' },
            ...Object.entries(STATUS_LABELS).map(([value, label]) => ({ value, label })),
          ]}
        />
      </div>

      <div className="min-w-48 flex-1">
        <label
          htmlFor="q"
          className="mb-2 block text-xs font-bold tracking-wider text-ink-secondary uppercase"
        >
          Search comments
        </label>
        <input
          id="q"
          name="q"
          type="search"
          defaultValue={filters.q ?? ''}
          maxLength={SEARCH_MAX_LENGTH}
          onChange={handleSearchChange}
          placeholder="dark mode, invoice, timeout…"
          className="w-full rounded-xl border-2 border-series-1/40 bg-gradient-to-br from-series-1/10 to-series-1/5 px-4 py-3 text-base font-medium text-ink transition-all placeholder:text-ink-muted hover:border-series-1/60 focus:border-series-1 focus:outline-none"
        />
      </div>

      {hasFilters && (
        <button
          type="button"
          onClick={() => apply({ q: undefined, category: undefined, status: undefined })}
          disabled={isPending}
          className="rounded-xl border-2 border-status-critical/40 bg-gradient-to-r from-status-critical/20 to-status-critical/10 px-6 py-3 text-sm font-black text-status-critical transition-all hover:border-status-critical/60 hover:from-status-critical/30 hover:to-status-critical/20 disabled:opacity-50"
        >
          Clear
        </button>
      )}
    </div>
  )
}
