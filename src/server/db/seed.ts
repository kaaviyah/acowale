/**
 * Seed data.
 *
 * Two separate concerns, deliberately:
 *
 *   `seedCategories` is **reference data** the application needs to function at
 *   all — the public form has nothing to offer without it. It is idempotent, safe
 *   to run against production, and runs on every deploy.
 *
 *   `seedDemoFeedback` is **demo data**, and only ever runs when asked. A
 *   dashboard with four rows in it can't show whether the trend chart or the
 *   category distribution actually work.
 */
import { sql } from 'drizzle-orm'
import type { Db } from './client'
import { categories, feedback } from './schema'

export const CATEGORY_SEED = [
  { slug: 'product', label: 'Product', sortOrder: 10 },
  { slug: 'feature_request', label: 'Feature Request', sortOrder: 20 },
  { slug: 'ui_ux', label: 'UI / UX', sortOrder: 30 },
  { slug: 'support', label: 'Support', sortOrder: 40 },
  { slug: 'billing', label: 'Billing', sortOrder: 50 },
  { slug: 'other', label: 'Other', sortOrder: 60 },
] as const

/**
 * Inserts the categories, updating labels and ordering if they already exist.
 *
 * `onConflictDoUpdate` on `slug` rather than delete-and-reinsert: the ids are
 * referenced by every existing feedback row, so recreating them would either fail
 * the foreign key or silently re-point history at the wrong category.
 */
export async function seedCategories(db: Db): Promise<number> {
  const rows = await db
    .insert(categories)
    .values(CATEGORY_SEED.map((category) => ({ ...category })))
    .onConflictDoUpdate({
      target: categories.slug,
      set: {
        label: sql`excluded.label`,
        sortOrder: sql`excluded.sort_order`,
        isActive: true,
      },
    })
    .returning({ id: categories.id })

  return rows.length
}

/**
 * Deterministic PRNG (mulberry32).
 *
 * `Math.random()` would make every run produce a different dashboard, so
 * "does the trend look right?" would be unanswerable and screenshots in the
 * README would never match what a reviewer sees.
 */
function createRandom(seed: number): () => number {
  let state = seed
  return () => {
    state |= 0
    state = (state + 0x6d2b79f5) | 0
    let t = Math.imul(state ^ (state >>> 15), 1 | state)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

/** Comments written per category so the search and filters have real text to work on. */
const DEMO_COMMENTS: Record<string, string[]> = {
  product: [
    'The dashboard is genuinely fast now — loading a month of data used to take ages.',
    'Exports keep timing out when I select more than 90 days of data.',
    'Bulk actions saved my team about an hour a day. Please keep going in this direction.',
    'We moved our whole ops team over last week and nobody has asked for the old tool back.',
    'Reports are useful but I cannot schedule them, so I still do it manually every Monday.',
  ],
  feature_request: [
    'Please add a dark mode. I work late and the dashboard is blinding.',
    'We need role-based permissions before we can roll this out to the wider team.',
    'A webhook when an order is approved would let us drop our polling script.',
    'Can we get a mobile app? I approve orders from airports more often than from my desk.',
    'CSV import would save us from retyping supplier data every month.',
  ],
  ui_ux: [
    'The category dropdown is hard to use on a phone — the options are tiny.',
    'Love the new layout, but the save button scrolls off screen on my laptop.',
    'Too many clicks to get from the dashboard to a single order.',
    'The empty states are lovely. Small thing, but it made the product feel finished.',
    'Colour contrast on the secondary buttons is too low to read in sunlight.',
  ],
  support: [
    'Support replied in under an hour on a Sunday. Genuinely impressed.',
    'I had to explain my problem three times to three different people.',
    'The help docs are out of date — the screenshots do not match the current UI.',
    'Chat support solved my issue but the transcript never arrived by email.',
  ],
  billing: [
    'I was charged twice this month and the invoice does not explain why.',
    'Please support UPI. Card payments from our finance team keep getting declined.',
    'Invoices do not include our GST number, so our accountant rejects them.',
    'Upgrading mid-cycle produced a proration I still cannot make sense of.',
  ],
  other: [
    'Just wanted to say thank you — this replaced three spreadsheets for us.',
    'Is there a roadmap published anywhere? Would help us plan our own quarter.',
    'Found a typo on the pricing page: "recieve" should be "receive".',
  ],
}

/**
 * Ratings are correlated with category on purpose: billing complaints score low,
 * praise for the product scores high. Uniform random ratings would give every
 * category the same average and make the dashboard look broken-but-plausible.
 */
const RATING_WEIGHTS: Record<string, number[]> = {
  product: [4, 4, 5, 5, 5, 3],
  feature_request: [3, 4, 4, 5, 3],
  ui_ux: [3, 3, 4, 4, 5],
  support: [2, 3, 4, 5, 5],
  billing: [1, 2, 2, 3, 4],
  other: [3, 4, 5, 5],
}

export interface DemoSeedOptions {
  /** Roughly how many rows to create. */
  count?: number
  /** How far back to spread submissions. */
  days?: number
  seed?: number
}

/**
 * Generates backdated feedback spread over the recent past.
 *
 * Volume grows towards the present and dips at weekends, because a flat
 * distribution makes the trend chart look like a bug.
 */
export async function seedDemoFeedback(db: Db, options: DemoSeedOptions = {}): Promise<number> {
  const { count = 220, days = 90, seed = 20260813 } = options
  const random = createRandom(seed)

  const categoryRows = await db
    .select({ id: categories.id, slug: categories.slug })
    .from(categories)
  if (categoryRows.length === 0) {
    throw new Error('Seed categories before generating demo feedback.')
  }

  const now = Date.now()
  const dayMs = 86_400_000
  const rows: (typeof feedback.$inferInsert)[] = []

  for (let index = 0; index < count; index += 1) {
    // Bias towards recent days: squaring a uniform sample clusters near 0.
    const daysAgo = Math.floor(random() ** 2 * days)
    const createdAt = new Date(now - daysAgo * dayMs - Math.floor(random() * dayMs))

    // Weekends are quieter for a B2B product.
    const isWeekend = createdAt.getDay() === 0 || createdAt.getDay() === 6
    if (isWeekend && random() < 0.6) continue

    const category = categoryRows[Math.floor(random() * categoryRows.length)]
    const comments = DEMO_COMMENTS[category.slug] ?? DEMO_COMMENTS.other
    const ratings = RATING_WEIGHTS[category.slug] ?? RATING_WEIGHTS.other

    rows.push({
      categoryId: category.id,
      comment: comments[Math.floor(random() * comments.length)],
      // A fifth of submissions skip the star rating, as they do in the real form.
      rating: random() < 0.2 ? null : ratings[Math.floor(random() * ratings.length)],
      // Most people don't leave an email.
      email: random() < 0.25 ? `customer${index}@example.com` : null,
      // Older items are more likely to have been worked: triage catches up over time.
      status: daysAgo > 30 && random() < 0.75 ? 'resolved' : random() < 0.2 ? 'in_progress' : 'new',
      createdAt,
      updatedAt: createdAt,
    })
  }

  // One multi-row insert rather than 200 round trips — over Neon's HTTP driver
  // each statement is its own request.
  const inserted = await db.insert(feedback).values(rows).returning({ id: feedback.id })
  return inserted.length
}
