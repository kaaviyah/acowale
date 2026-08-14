'use client'

/**
 * Triage control.
 *
 * The one place the dashboard writes: it calls `PATCH /api/feedback/[id]` — the
 * documented API, not a private server action — and then asks Next.js to re-render
 * the server components so every number on the page (including the status counts in
 * the tiles above) agrees with the change.
 *
 * The select is optimistic: it shows the new value immediately and rolls back if the
 * request fails, because a control that silently ignores a click is worse than one
 * that admits the failure.
 */
import { useRouter } from 'next/navigation'
import { useState, useTransition } from 'react'
import type { FeedbackStatus } from '@/server/db/schema'
import { STATUS_LABELS } from '@/lib/format'

const STATUSES: FeedbackStatus[] = ['new', 'in_progress', 'resolved']

export function StatusControl({
  id,
  status,
  summary,
}: {
  id: string
  status: FeedbackStatus
  /** Used only for the accessible label, so the control isn't just "Status". */
  summary: string
}) {
  const router = useRouter()
  const [value, setValue] = useState(status)
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [isPending, startTransition] = useTransition()

  async function handleChange(next: FeedbackStatus) {
    const previous = value
    setValue(next)
    setError(null)
    setSaving(true)

    try {
      const response = await fetch(`/api/feedback/${id}`, {
        method: 'PATCH',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ status: next }),
      })

      if (!response.ok) {
        setValue(previous)
        const body = await response.json().catch(() => null)
        setError(
          response.status === 401
            ? 'Your session expired. Sign in again.'
            : (body?.error?.message ?? 'Could not save that change.'),
        )
        return
      }

      startTransition(() => router.refresh())
    } catch {
      setValue(previous)
      setError('Could not reach the server.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="flex flex-col items-end gap-1">
      <label className="sr-only" htmlFor={`status-${id}`}>
        Status for “{summary}”
      </label>
      <select
        id={`status-${id}`}
        value={value}
        disabled={saving || isPending}
        onChange={(event) => void handleChange(event.target.value as FeedbackStatus)}
        className="rounded-lg border border-hairline bg-surface px-2 py-1 text-xs text-ink disabled:opacity-60"
      >
        {STATUSES.map((option) => (
          <option key={option} value={option}>
            {STATUS_LABELS[option]}
          </option>
        ))}
      </select>
      {error && (
        <span role="alert" className="text-xs text-status-critical">
          {error}
        </span>
      )}
    </div>
  )
}
