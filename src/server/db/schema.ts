/**
 * Database schema — the single source of truth for both the TypeScript types and
 * the generated SQL migrations in `drizzle/`.
 *
 * Three tables: `categories` (lookup), `feedback` (the product), and
 * `rate_limit_hits` (infrastructure). Constraints are declared here rather than
 * enforced only in application code, because the database is the one layer no
 * client, script, or future service can bypass.
 */
import { sql } from 'drizzle-orm'
import {
  boolean,
  check,
  index,
  integer,
  pgEnum,
  pgTable,
  primaryKey,
  smallint,
  smallserial,
  text,
  timestamp,
  uuid,
} from 'drizzle-orm/pg-core'

/**
 * Triage state for a piece of feedback. A Postgres enum rather than free text:
 * the set is small, changes rarely, and a typo should be a write failure.
 */
export const feedbackStatusEnum = pgEnum('feedback_status', ['new', 'in_progress', 'resolved'])

/**
 * Feedback categories, as data rather than a hardcoded union.
 *
 * The product team will want to add "Onboarding" or retire "Billing" without a
 * code deploy, and the admin console needs labels and ordering it can control.
 */
export const categories = pgTable('categories', {
  id: smallserial('id').primaryKey(),
  /** Stable, API-facing key (`feature_request`). Numeric ids never leave the server. */
  slug: text('slug').notNull().unique(),
  /** Human label shown in the form and dashboard (`Feature Request`). */
  label: text('label').notNull(),
  /** Product-controlled ordering in the form's select. */
  sortOrder: smallint('sort_order').notNull().default(0),
  /** Retire a category without orphaning the feedback filed under it. */
  isActive: boolean('is_active').notNull().default(true),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
})

export const feedback = pgTable(
  'feedback',
  {
    /**
     * A UUID rather than a serial: ids appear in admin URLs, and a sequential id
     * on a public form leaks total submission volume to anyone who submits twice.
     */
    id: uuid('id').primaryKey().defaultRandom(),
    categoryId: smallint('category_id')
      .notNull()
      .references(() => categories.id, { onDelete: 'restrict' }),
    /** Optional: a comment with no star rating is still useful signal. */
    rating: smallint('rating'),
    comment: text('comment').notNull(),
    /** Optional. Collected only to make following up possible. */
    email: text('email'),
    status: feedbackStatusEnum('status').notNull().default('new'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    // Every index below backs a query the dashboard actually issues.
    index('idx_feedback_created_at').on(t.createdAt.desc()),
    index('idx_feedback_category_created').on(t.categoryId, t.createdAt.desc()),
    index('idx_feedback_status_created').on(t.status, t.createdAt.desc()),
    /**
     * Makes the dashboard's `comment ILIKE '%term%'` search an index lookup
     * instead of a full scan. Requires the pg_trgm extension, enabled in
     * `drizzle/0001_enable_pg_trgm.sql`.
     */
    index('idx_feedback_comment_trgm').using('gin', sql`${t.comment} gin_trgm_ops`),
    check('feedback_rating_range', sql`${t.rating} IS NULL OR ${t.rating} BETWEEN 1 AND 5`),
    check('feedback_comment_length', sql`char_length(${t.comment}) BETWEEN 3 AND 2000`),
    check(
      'feedback_email_length',
      sql`${t.email} IS NULL OR char_length(${t.email}) BETWEEN 3 AND 320`,
    ),
  ],
)

/**
 * Fixed-window rate limit counters.
 *
 * Deliberately in Postgres rather than Redis: serverless instances share no
 * memory, so an in-process counter silently under-counts, and one atomic
 * `INSERT … ON CONFLICT DO UPDATE` in the database we already run beats adding a
 * second datastore for one integer. The trade-off (a write per public request on
 * the primary) is documented in DECISIONS.md.
 */
export const rateLimitHits = pgTable(
  'rate_limit_hits',
  {
    /** `sha256(ip + RATE_LIMIT_SALT):route` — never a raw IP address. */
    bucketKey: text('bucket_key').notNull(),
    /** Start of the fixed window this row counts. */
    windowStart: timestamp('window_start', { withTimezone: true }).notNull(),
    hits: integer('hits').notNull().default(0),
  },
  (t) => [
    primaryKey({ columns: [t.bucketKey, t.windowStart] }),
    // Supports pruning expired windows.
    index('idx_rate_limit_window_start').on(t.windowStart),
  ],
)

export type Category = typeof categories.$inferSelect
export type Feedback = typeof feedback.$inferSelect
export type NewFeedback = typeof feedback.$inferInsert
export type FeedbackStatus = (typeof feedbackStatusEnum.enumValues)[number]
