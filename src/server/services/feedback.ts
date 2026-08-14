/**
 * Feedback use cases.
 *
 * Services hold the rules and know nothing about HTTP: no `Request`, no `Response`,
 * no status codes. They throw domain errors and let the route handler translate.
 * That is what makes them testable directly and portable if the API ever moves out
 * of Next.js.
 */
import type { Logger } from 'pino'
import { getDb } from '../db/client'
import type { FeedbackStatus } from '../db/schema'
import { notFound, validationError } from '../lib/errors'
import { findActiveCategoryIdBySlug } from '../repos/categories'
import {
  insertFeedback,
  listFeedback,
  updateFeedbackStatus,
  type FeedbackRecord,
} from '../repos/feedback'
import type { CreateFeedbackInput, ListFeedbackQuery } from '../schemas'

/**
 * Minimum plausible time to fill in the form, in milliseconds.
 *
 * Only applied when the client reports it, so API clients and `curl` are
 * unaffected — a hidden timing check that blocks documented API use is a bug, not
 * a defence.
 */
const MIN_FILL_MS = 1_200

export interface SubmitFeedbackResult {
  id: string
  createdAt: Date
}

/**
 * Records a public submission.
 *
 * Suspected bots receive a normal-looking success response and nothing is written.
 * Returning an error would tell a bot exactly which signal caught it, and a spammer
 * who knows the honeypot's name simply stops filling it in. A human who somehow
 * trips this loses their submission, which is why both signals are deliberately
 * conservative: an invisible field that was typed into, or a form completed
 * implausibly fast.
 */
export async function submitFeedback(
  input: CreateFeedbackInput,
  log: Logger,
): Promise<SubmitFeedbackResult> {
  const trippedHoneypot = Boolean(input.honeypot && input.honeypot.length > 0)
  const submittedTooFast = input.elapsedMs !== undefined && input.elapsedMs < MIN_FILL_MS

  if (trippedHoneypot || submittedTooFast) {
    log.warn(
      { trippedHoneypot, submittedTooFast, elapsedMs: input.elapsedMs },
      'discarded suspected bot submission',
    )
    return { id: crypto.randomUUID(), createdAt: new Date() }
  }

  const db = await getDb()
  const categoryId = await findActiveCategoryIdBySlug(db, input.categorySlug)

  if (categoryId === undefined) {
    // A 422 on the field rather than a 404 on the request: from the submitter's
    // point of view the category is a form value, not a resource.
    throw validationError([
      { path: 'categorySlug', message: 'Please choose a category from the list.' },
    ])
  }

  const created = await insertFeedback(db, {
    categoryId,
    comment: input.comment,
    rating: input.rating,
    email: input.email,
  })

  log.info(
    { feedbackId: created.id, categorySlug: input.categorySlug, rating: input.rating },
    'feedback submitted',
  )

  return created
}

export interface FeedbackListResult {
  items: FeedbackRecord[]
  page: number
  pageSize: number
  total: number
  hasMore: boolean
}

export async function getFeedbackList(query: ListFeedbackQuery): Promise<FeedbackListResult> {
  const db = await getDb()
  const { items, total } = await listFeedback(db, query)

  return {
    items,
    page: query.page,
    pageSize: query.pageSize,
    total,
    hasMore: query.page * query.pageSize < total,
  }
}

export async function setFeedbackStatus(
  id: string,
  status: FeedbackStatus,
  log: Logger,
): Promise<{ id: string; status: FeedbackStatus; updatedAt: Date }> {
  const db = await getDb()
  const updated = await updateFeedbackStatus(db, id, status)

  if (!updated) throw notFound('That feedback item no longer exists.')

  log.info({ feedbackId: id, status }, 'feedback status changed')
  return updated
}
