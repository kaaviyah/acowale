'use client'

/**
 * The public feedback form.
 *
 * Submits JSON to `POST /api/feedback` — the same endpoint documented in the README
 * and exercised by the tests, rather than a server action, so the form is a client
 * of the public API like anything else would be.
 *
 * Error handling mirrors the API's error envelope: 422 details are mapped back onto
 * the fields that caused them, 429 gets a "try again in a moment" message with the
 * server's own retry window, and anything else shows a generic message plus the
 * request id, which is the one thing that makes a support conversation useful.
 */
import { useEffect, useRef, useState } from 'react'
import { StarRating } from './star-rating'
import { COMMENT_MAX_LENGTH } from '@/server/schemas/limits'

interface Category {
  slug: string
  label: string
}

interface FeedbackFormProps {
  categories: Category[]
}

type FieldErrors = Partial<Record<'categorySlug' | 'comment' | 'email' | 'rating', string>>

interface ApiError {
  error: {
    code: string
    message: string
    requestId: string
    details?: { path: string; message: string }[]
  }
}

export function FeedbackForm({ categories }: FeedbackFormProps) {
  const [categorySlug, setCategorySlug] = useState('')
  const [comment, setComment] = useState('')
  const [email, setEmail] = useState('')
  const [rating, setRating] = useState<number | null>(null)
  const [honeypot, setHoneypot] = useState('')

  const [submitting, setSubmitting] = useState(false)
  const [submitted, setSubmitted] = useState(false)
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({})
  const [formError, setFormError] = useState<string | null>(null)
  const [reference, setReference] = useState<string | null>(null)

  /**
   * When the form became fillable — paired with the honeypot as a bot signal.
   * Stamped in an effect rather than during render: reading the clock while
   * rendering is impure, and a re-render would silently reset the timer.
   */
  const openedAt = useRef<number | null>(null)
  const successHeading = useRef<HTMLHeadingElement>(null)

  useEffect(() => {
    openedAt.current = Date.now()
  }, [])

  // Move focus to the confirmation so a screen reader announces the outcome
  // instead of leaving the user wondering whether anything happened.
  useEffect(() => {
    if (submitted) successHeading.current?.focus()
  }, [submitted])

  const remaining = COMMENT_MAX_LENGTH - comment.length

  function resetForm() {
    setCategorySlug('')
    setComment('')
    setEmail('')
    setRating(null)
    setHoneypot('')
    setFieldErrors({})
    setFormError(null)
    setReference(null)
    setSubmitted(false)
    openedAt.current = Date.now()
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setSubmitting(true)
    setFieldErrors({})
    setFormError(null)
    setReference(null)

    try {
      const response = await fetch('/api/feedback', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          categorySlug,
          comment,
          rating,
          email,
          honeypot,
          // Omitted if the mount effect hasn't run: no timing signal is better
          // than a false one that discards a real submission.
          elapsedMs: openedAt.current === null ? undefined : Date.now() - openedAt.current,
        }),
      })

      if (response.ok) {
        setSubmitted(true)
        return
      }

      const body = (await response.json().catch(() => null)) as ApiError | null
      setReference(body?.error.requestId ?? null)

      if (response.status === 422 && body?.error.details) {
        const mapped: FieldErrors = {}
        for (const detail of body.error.details) {
          const field = detail.path.split('.')[0] as keyof FieldErrors
          mapped[field] ??= detail.message
        }
        setFieldErrors(mapped)
        // A field error that isn't tied to a rendered field would otherwise vanish.
        if (Object.keys(mapped).length === 0) setFormError(body.error.message)
        return
      }

      if (response.status === 429) {
        const retryAfter = Number(response.headers.get('retry-after') ?? 60)
        setFormError(
          `That's a lot of feedback in a short time. Please try again in ${retryAfter} second${
            retryAfter === 1 ? '' : 's'
          }.`,
        )
        return
      }

      setFormError(body?.error.message ?? 'Something went wrong. Please try again.')
    } catch {
      // Offline, DNS failure, request blocked — never a stack trace on screen.
      setFormError('We could not reach the server. Please check your connection and try again.')
    } finally {
      setSubmitting(false)
    }
  }

  if (submitted) {
    return (
      <div className="rounded-xl border border-hairline bg-surface p-8 text-center">
        <div
          aria-hidden="true"
          className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-status-good/15 text-2xl text-status-good"
        >
          ✓
        </div>
        <h2
          ref={successHeading}
          tabIndex={-1}
          className="mt-4 text-xl font-semibold text-ink outline-none"
        >
          Thank you — that&rsquo;s been passed on.
        </h2>
        <p className="mt-2 text-ink-secondary">
          Every submission is read by the team. If you left an email address, we may follow up.
        </p>
        <button
          type="button"
          onClick={resetForm}
          className="mt-6 rounded-lg border border-hairline px-4 py-2 font-medium text-ink hover:bg-page"
        >
          Send more feedback
        </button>
      </div>
    )
  }

  return (
    <form
      onSubmit={handleSubmit}
      noValidate
      className="space-y-6 rounded-xl border border-hairline bg-surface p-6 sm:p-8"
    >
      {formError && (
        <div
          role="alert"
          className="rounded-lg border border-status-critical/40 bg-status-critical/10 p-3 text-sm text-ink"
        >
          <p className="font-medium">{formError}</p>
          {reference && (
            <p className="mt-1 text-ink-secondary">
              Reference: <code className="font-mono">{reference}</code>
            </p>
          )}
        </div>
      )}

      <div>
        <label htmlFor="categorySlug" className="block text-sm font-medium text-ink">
          What is this about?
        </label>
        <select
          id="categorySlug"
          name="categorySlug"
          value={categorySlug}
          onChange={(event) => setCategorySlug(event.target.value)}
          aria-invalid={Boolean(fieldErrors.categorySlug)}
          aria-describedby={fieldErrors.categorySlug ? 'categorySlug-error' : undefined}
          className="mt-2 w-full rounded-lg border border-baseline bg-surface px-3 py-2.5 text-ink"
        >
          <option value="">Choose a category…</option>
          {categories.map((category) => (
            <option key={category.slug} value={category.slug}>
              {category.label}
            </option>
          ))}
        </select>
        {fieldErrors.categorySlug && (
          <p id="categorySlug-error" className="mt-1.5 text-sm text-status-critical">
            {fieldErrors.categorySlug}
          </p>
        )}
      </div>

      <StarRating value={rating} onChange={setRating} disabled={submitting} />

      <div>
        <div className="flex items-baseline justify-between gap-4">
          <label htmlFor="comment" className="block text-sm font-medium text-ink">
            Tell us more
          </label>
          <span
            className={`text-xs tabular-nums ${
              remaining < 0 ? 'text-status-critical' : 'text-ink-muted'
            }`}
          >
            {comment.length} / {COMMENT_MAX_LENGTH}
          </span>
        </div>
        <textarea
          id="comment"
          name="comment"
          rows={5}
          value={comment}
          onChange={(event) => setComment(event.target.value)}
          placeholder="What worked, what didn't, what you wish existed…"
          aria-invalid={Boolean(fieldErrors.comment)}
          aria-describedby={fieldErrors.comment ? 'comment-error' : undefined}
          className="mt-2 w-full resize-y rounded-lg border border-baseline bg-surface px-3 py-2.5 text-ink placeholder:text-ink-muted"
        />
        {fieldErrors.comment && (
          <p id="comment-error" className="mt-1.5 text-sm text-status-critical">
            {fieldErrors.comment}
          </p>
        )}
      </div>

      <div>
        <label htmlFor="email" className="block text-sm font-medium text-ink">
          Your email <span className="font-normal text-ink-secondary">(optional)</span>
        </label>
        <input
          id="email"
          name="email"
          type="email"
          autoComplete="email"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          placeholder="you@example.com"
          aria-invalid={Boolean(fieldErrors.email)}
          aria-describedby={fieldErrors.email ? 'email-error' : 'email-hint'}
          className="mt-2 w-full rounded-lg border border-baseline bg-surface px-3 py-2.5 text-ink placeholder:text-ink-muted"
        />
        {fieldErrors.email ? (
          <p id="email-error" className="mt-1.5 text-sm text-status-critical">
            {fieldErrors.email}
          </p>
        ) : (
          <p id="email-hint" className="mt-1.5 text-sm text-ink-secondary">
            Only used if we need to follow up. Leave it blank to stay anonymous.
          </p>
        )}
      </div>

      {/*
        Honeypot. Hidden from people (off-screen, aria-hidden, not tabbable) and
        irresistible to the bots that fill in every field they find. A submission
        that touches this is discarded server-side.
      */}
      <div aria-hidden="true" className="absolute left-[-9999px] h-0 w-0 overflow-hidden">
        <label htmlFor="honeypot">Leave this field empty</label>
        <input
          id="honeypot"
          name="honeypot"
          type="text"
          tabIndex={-1}
          autoComplete="off"
          value={honeypot}
          onChange={(event) => setHoneypot(event.target.value)}
        />
      </div>

      <div className="flex flex-wrap items-center gap-4 border-t border-hairline pt-5">
        <button
          type="submit"
          disabled={submitting}
          className="rounded-lg bg-series-1 px-5 py-2.5 font-medium text-white disabled:opacity-60"
        >
          {submitting ? 'Sending…' : 'Send feedback'}
        </button>
        <p className="text-sm text-ink-secondary">
          {/* Say what happens to the data, in the place where it is given. */}
          Goes straight to the product team. No account needed.
        </p>
      </div>
    </form>
  )
}
