/**
 * Request contracts.
 *
 * These schemas are the only place a request's shape is defined. The API parses
 * with them, the public form imports the same limits for its client-side hints,
 * and the tests assert against them — so "what is a valid submission?" has one
 * answer rather than three that drift.
 *
 * Validation messages are written for the person filling in the form, because
 * that is where they are displayed.
 */
import { z } from 'zod'
import { RANGE_KEYS } from '../lib/time'
import { feedbackStatusEnum } from '../db/schema'

export const COMMENT_MIN_LENGTH = 3
export const COMMENT_MAX_LENGTH = 2000
export const EMAIL_MAX_LENGTH = 320
export const SEARCH_MAX_LENGTH = 120
export const PAGE_SIZE_DEFAULT = 20
export const PAGE_SIZE_MAX = 100

/** Treat blank strings from an HTML form as "not provided". */
const blankToNull = (value: unknown) =>
  typeof value === 'string' && value.trim() === '' ? null : value

export const feedbackStatusSchema = z.enum(feedbackStatusEnum.enumValues)

export const createFeedbackSchema = z.object({
  categorySlug: z
    .string({ error: 'Please choose a category.' })
    .trim()
    .min(1, 'Please choose a category.')
    .max(40),

  comment: z
    .string({ error: 'Please tell us what you think.' })
    .trim()
    .min(COMMENT_MIN_LENGTH, `Please write at least ${COMMENT_MIN_LENGTH} characters.`)
    .max(COMMENT_MAX_LENGTH, `Please keep it under ${COMMENT_MAX_LENGTH} characters.`),

  /** Optional: a comment with no stars is still signal worth capturing. */
  rating: z
    .preprocess(blankToNull, z.coerce.number().int().min(1).max(5).nullable())
    .default(null),

  email: z
    .preprocess(
      blankToNull,
      z.email('That email address does not look right.').max(EMAIL_MAX_LENGTH).nullable(),
    )
    .default(null),

  /**
   * Anti-spam, both handled in `services/feedback.ts`:
   * `honeypot` is a field hidden from humans, and `elapsedMs` is how long the form
   * was open. Bots fill everything in and submit instantly.
   */
  honeypot: z.string().max(200).optional(),
  elapsedMs: z.coerce.number().int().nonnegative().max(86_400_000).optional(),
})

export type CreateFeedbackInput = z.infer<typeof createFeedbackSchema>

export const listFeedbackQuerySchema = z.object({
  q: z.string().trim().max(SEARCH_MAX_LENGTH).optional(),
  category: z.string().trim().max(40).optional(),
  status: feedbackStatusSchema.optional(),
  rating: z.coerce.number().int().min(1).max(5).optional(),
  from: z.coerce.date().optional(),
  to: z.coerce.date().optional(),
  page: z.coerce.number().int().min(1).max(10_000).default(1),
  // Capped: an unbounded page size is an accidental denial-of-service endpoint.
  pageSize: z.coerce.number().int().min(1).max(PAGE_SIZE_MAX).default(PAGE_SIZE_DEFAULT),
  sort: z.enum(['newest', 'oldest', 'rating_desc', 'rating_asc']).default('newest'),
})

export type ListFeedbackQuery = z.infer<typeof listFeedbackQuerySchema>

export const updateFeedbackStatusSchema = z.object({
  status: feedbackStatusSchema,
})

export const analyticsQuerySchema = z.object({
  range: z.enum(RANGE_KEYS).default('30d'),
})

export const loginSchema = z.object({
  email: z.email('Enter the email address you sign in with.'),
  // Not length-validated beyond a sane cap: the only thing that matters is
  // whether it verifies, and a minimum here would leak the real policy.
  password: z.string().min(1, 'Enter your password.').max(400),
})
