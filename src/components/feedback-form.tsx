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
import { CustomSelect } from './custom-select'
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
      <div className="rounded-2xl border-2 border-status-good/40 bg-gradient-to-br from-status-good/15 via-status-good/8 to-transparent p-6 text-center shadow-2xl shadow-status-good/20">
        <div
          aria-hidden="true"
          className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-gradient-to-br from-status-good/30 to-status-good/10 text-3xl shadow-xl shadow-status-good/30 animate-bounce"
        >
          ✓
        </div>
        <h2
          ref={successHeading}
          tabIndex={-1}
          className="mt-4 text-2xl font-bold text-ink outline-none"
        >
          Thank you! 🎉
        </h2>
        <p className="mt-2 text-base text-ink-secondary">
          Your feedback is super valuable to us. Every submission is read by the team, and if you left an email, we may follow up.
        </p>
        <button
          type="button"
          onClick={resetForm}
          className="mt-5 rounded-xl border-2 border-series-1/50 bg-gradient-to-r from-series-1/20 to-series-1/10 px-5 py-2.5 font-bold text-series-1 hover:from-series-1/30 hover:to-series-1/20 hover:shadow-lg transition-all transform hover:scale-105"
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
      className="space-y-4 rounded-2xl border-2 border-series-1/30 bg-gradient-to-br from-surface via-surface to-series-1/5 p-5 sm:p-6 shadow-2xl shadow-series-1/20"
    >
      {formError && (
        <div
          role="alert"
          className="rounded-xl border-2 border-status-critical/40 bg-gradient-to-r from-status-critical/15 to-status-critical/5 p-3 text-sm text-ink animate-pulse"
        >
          <p className="font-bold">⚠️ {formError}</p>
          {reference && (
            <p className="mt-1.5 text-ink-secondary">
              Reference: <code className="font-mono bg-black/10 px-1.5 py-0.5 rounded">{reference}</code>
            </p>
          )}
        </div>
      )}

      <div>
        <label htmlFor="categorySlug" className="block text-sm font-bold text-ink mb-1.5">
          📌 What is this about?
        </label>
        <CustomSelect
          id="categorySlug"
          label="What is this about?"
          value={categorySlug}
          onChange={setCategorySlug}
          disabled={submitting}
          placeholder="Choose a category…"
          invalid={Boolean(fieldErrors.categorySlug)}
          describedBy={fieldErrors.categorySlug ? 'categorySlug-error' : undefined}
          className="rounded-xl border-2 border-series-1/40 bg-gradient-to-br from-series-1/8 to-series-1/3 px-3 py-2.5 font-medium hover:border-series-1/60 focus-visible:border-series-1"
          options={categories.map((category) => ({
            value: category.slug,
            label: category.label,
          }))}
        />
        {fieldErrors.categorySlug && (
          <p id="categorySlug-error" className="mt-1.5 text-sm font-semibold text-status-critical animate-pulse">
            ⚠️ {fieldErrors.categorySlug}
          </p>
        )}
      </div>

      <div className="bg-gradient-to-r from-status-warning/10 to-series-1/10 rounded-xl p-3.5 border border-status-warning/20">
        <StarRating value={rating} onChange={setRating} disabled={submitting} />
      </div>

      <div>
        <div className="flex items-baseline justify-between gap-4 mb-1.5">
          <label htmlFor="comment" className="block text-sm font-bold text-ink">
            💭 Tell us more
          </label>
          <span
            className={`text-xs font-bold tabular-nums px-2 py-0.5 rounded-full ${
              remaining < 0 ? 'bg-status-critical/20 text-status-critical' : 'bg-series-1/10 text-series-1'
            }`}
          >
            {comment.length} / {COMMENT_MAX_LENGTH}
          </span>
        </div>
        <textarea
          id="comment"
          name="comment"
          rows={4}
          value={comment}
          onChange={(event) => setComment(event.target.value)}
          placeholder="What worked, what didn't, what you wish existed…"
          aria-invalid={Boolean(fieldErrors.comment)}
          aria-describedby={fieldErrors.comment ? 'comment-error' : undefined}
          className="w-full resize-y rounded-xl border-2 border-series-1/40 bg-gradient-to-br from-series-1/8 to-series-1/3 px-3 py-2.5 text-ink placeholder:text-ink-muted transition-all hover:border-series-1/60 focus:border-series-1 focus:ring-2 focus:ring-series-1/30 focus:outline-none"
        />
        {fieldErrors.comment && (
          <p id="comment-error" className="mt-1.5 text-sm font-semibold text-status-critical animate-pulse">
            ⚠️ {fieldErrors.comment}
          </p>
        )}
      </div>

      <div>
        <label htmlFor="email" className="block text-sm font-bold text-ink mb-1.5">
          📧 Your email <span className="font-normal text-ink-secondary text-xs">(optional)</span>
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
          className="w-full rounded-xl border-2 border-series-1/40 bg-gradient-to-br from-series-1/8 to-series-1/3 px-3 py-2.5 text-ink placeholder:text-ink-muted transition-all hover:border-series-1/60 focus:border-series-1 focus:ring-2 focus:ring-series-1/30 focus:outline-none"
        />
        {fieldErrors.email ? (
          <p id="email-error" className="mt-1.5 text-sm font-semibold text-status-critical animate-pulse">
            ⚠️ {fieldErrors.email}
          </p>
        ) : (
          <p id="email-hint" className="mt-1.5 text-xs text-ink-secondary">
            🔒 Only used if we need to follow up. Leave blank to stay anonymous.
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

      <div className="flex flex-wrap items-center gap-3 border-t-2 border-series-1/20 pt-4">
        <button
          type="submit"
          disabled={submitting}
          className="rounded-xl bg-gradient-to-r from-series-1 via-series-1/90 to-series-1/70 px-6 py-2.5 font-bold text-white shadow-xl shadow-series-1/40 hover:shadow-2xl hover:shadow-series-1/50 disabled:opacity-50 transition-all hover:scale-105 transform"
        >
          {submitting ? '⏳ Sending…' : '🚀 Send Feedback'}
        </button>
        <p className="text-xs text-ink-secondary font-medium">
          💨 Goes straight to the product team. No account needed.
        </p>
      </div>
    </form>
  )
}
