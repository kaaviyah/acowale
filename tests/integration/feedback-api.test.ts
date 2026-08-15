/**
 * Route-handler integration tests.
 *
 * These invoke the exported handlers directly with real `Request` objects against a
 * real Postgres, so they cover the whole stack below HTTP: validation, rate
 * limiting, the service rules, the SQL, and the error translation in `withApi`.
 * What they don't cover is the routing table itself — that's what the smoke script
 * against the deployed URL is for.
 */
import { and, eq } from 'drizzle-orm'
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { categories, feedback } from '@/server/db/schema'
import { createTestDatabase, resetTestData, seedFeedback, type TestDatabase } from '../helpers/db'
import { cookieJar, signInAsAdmin } from '../helpers/cookies'

vi.mock('next/headers', async () => {
  const { cookiesStub } = await import('../helpers/cookies')
  return { cookies: async () => cookiesStub() }
})

const { POST: submitFeedback, GET: listFeedback } = await import('@/app/api/feedback/route')
const { PATCH: patchFeedback } = await import('@/app/api/feedback/[id]/route')

let database: TestDatabase

beforeAll(async () => {
  database = await createTestDatabase()
})

afterAll(async () => {
  await database.close()
})

beforeEach(async () => {
  await resetTestData(database.db)
  cookieJar.clear()
})

// A no-op unless a test pinned the clock, and it still runs when one fails.
afterEach(() => {
  vi.useRealTimers()
})

/** Each test gets its own address so rate-limit counters never leak between them. */
let addressCounter = 0
const nextAddress = () => `203.0.113.${(addressCounter += 1)}`

function post(body: unknown, address = nextAddress()): Promise<Response> {
  return submitFeedback(
    new Request('http://localhost/api/feedback', {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-forwarded-for': address },
      body: typeof body === 'string' ? body : JSON.stringify(body),
    }),
    {},
  )
}

const get = (query = ''): Promise<Response> =>
  listFeedback(new Request(`http://localhost/api/feedback${query}`), {})

const validSubmission = {
  categorySlug: 'feature_request',
  comment: 'Please add a dark mode — I work late and the dashboard is blinding.',
  rating: 4,
  email: 'night.owl@example.com',
}

describe('POST /api/feedback', () => {
  it('accepts a valid submission and persists it', async () => {
    const response = await post(validSubmission)
    expect(response.status).toBe(201)

    const body = await response.json()
    expect(body.id).toMatch(/^[0-9a-f-]{36}$/)
    expect(response.headers.get('location')).toBe(`/api/feedback/${body.id}`)

    const [stored] = await database.db.select().from(feedback).where(eq(feedback.id, body.id))
    expect(stored.comment).toBe(validSubmission.comment)
    expect(stored.rating).toBe(4)
    expect(stored.email).toBe(validSubmission.email)
    // Every submission starts untriaged.
    expect(stored.status).toBe('new')
  })

  it('accepts a comment with no rating and no email', async () => {
    const response = await post({ categorySlug: 'other', comment: 'Just wanted to say thanks.' })
    expect(response.status).toBe(201)

    const [stored] = await database.db.select().from(feedback)
    expect(stored.rating).toBeNull()
    expect(stored.email).toBeNull()
  })

  it('echoes a request id and forbids caching', async () => {
    const response = await post(validSubmission)

    expect(response.headers.get('x-request-id')).toMatch(/^[0-9a-f-]{36}$/)
    expect(response.headers.get('cache-control')).toBe('no-store')
  })

  it('reuses an upstream request id, so a trace survives across hops', async () => {
    const response = await submitFeedback(
      new Request('http://localhost/api/feedback', {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'x-forwarded-for': nextAddress(),
          'x-request-id': 'trace-me-123',
        },
        body: JSON.stringify(validSubmission),
      }),
      {},
    )

    expect(response.headers.get('x-request-id')).toBe('trace-me-123')
  })

  it('returns 422 with the offending fields, not a 500', async () => {
    const response = await post({ categorySlug: '', comment: 'no' })
    expect(response.status).toBe(422)

    const body = await response.json()
    expect(body.error.code).toBe('VALIDATION_ERROR')
    expect(body.error.requestId).toBeTruthy()
    expect(body.error.details.map((detail: { path: string }) => detail.path)).toEqual(
      expect.arrayContaining(['categorySlug', 'comment']),
    )
  })

  it('treats a malformed JSON body as a validation error', async () => {
    const response = await post('{"categorySlug": "product",')
    expect(response.status).toBe(422)
  })

  it('rejects an unknown category on the field', async () => {
    const response = await post({ ...validSubmission, categorySlug: 'nonexistent' })
    expect(response.status).toBe(422)

    const body = await response.json()
    expect(body.error.details[0].path).toBe('categorySlug')
  })

  it('rejects a retired category while keeping its history', async () => {
    await database.db
      .update(categories)
      .set({ isActive: false })
      .where(eq(categories.slug, 'billing'))

    const response = await post({ ...validSubmission, categorySlug: 'billing' })
    expect(response.status).toBe(422)

    await database.db.update(categories).set({ isActive: true }).where(eq(categories.slug, 'billing'))
  })

  it('discards a submission that filled in the hidden field, without saying so', async () => {
    const response = await post({ ...validSubmission, honeypot: 'http://spam.example' })

    // Looks like success to the bot; nothing is written.
    expect(response.status).toBe(201)
    expect(await database.db.select().from(feedback)).toHaveLength(0)
  })

  it('discards a submission completed implausibly fast', async () => {
    const response = await post({ ...validSubmission, elapsedMs: 200 })

    expect(response.status).toBe(201)
    expect(await database.db.select().from(feedback)).toHaveLength(0)
  })

  it('accepts a submission with no timing information at all (curl, API clients)', async () => {
    const response = await post(validSubmission)

    expect(response.status).toBe(201)
    expect(await database.db.select().from(feedback)).toHaveLength(1)
  })

  /**
   * The clock is pinned mid-window for the burst.
   *
   * `enforceRateLimits` floors the wall clock to an epoch-aligned window, so six
   * requests that straddle a minute boundary are counted against two separate
   * counters and the sixth is legitimately accepted — the documented fixed-window
   * trade-off, not a defect. On the real clock this test fails whenever the burst
   * happens to cross a boundary, which is rare enough to look like a fluke and
   * frequent enough to train everyone to re-run CI.
   */
  it('rate limits after five submissions from one address', async () => {
    // Only `Date` is faked: PGlite's own timers and promises must keep running.
    vi.useFakeTimers({ toFake: ['Date'] })
    vi.setSystemTime(new Date(Math.floor(Date.now() / 60_000) * 60_000 + 30_000))

    const address = nextAddress()

    for (let attempt = 1; attempt <= 5; attempt += 1) {
      expect((await post(validSubmission, address)).status).toBe(201)
    }

    const blocked = await post(validSubmission, address)
    expect(blocked.status).toBe(429)
    expect(Number(blocked.headers.get('retry-after'))).toBeGreaterThan(0)
    expect((await blocked.json()).error.code).toBe('RATE_LIMITED')

    // A different caller is unaffected.
    expect((await post(validSubmission, nextAddress())).status).toBe(201)
    // The blocked attempt was not written.
    expect(await database.db.select().from(feedback)).toHaveLength(6)
  })
})

describe('database constraints', () => {
  it('rejects an out-of-range rating even when the API is bypassed', async () => {
    // The schema validates, but the database is the layer nothing can go around —
    // a future script or service gets the same guarantee.
    const [category] = await database.db
      .select({ id: categories.id })
      .from(categories)
      .where(eq(categories.slug, 'product'))

    await expect(
      database.db
        .insert(feedback)
        .values({ categoryId: category.id, comment: 'Nine stars.', rating: 9 }),
    ).rejects.toThrow()
  })

  it('refuses to orphan feedback by deleting a category in use', async () => {
    await seedFeedback(database.db, [{ category: 'support' }])

    await expect(
      database.db.delete(categories).where(eq(categories.slug, 'support')),
    ).rejects.toThrow()
  })
})

describe('GET /api/feedback', () => {
  beforeEach(async () => {
    await seedFeedback(database.db, [
      {
        category: 'billing',
        comment: 'Invoices are missing our GST number.',
        rating: 2,
        status: 'new',
        createdAt: new Date('2026-08-10T09:00:00Z'),
      },
      {
        category: 'product',
        comment: 'Exports time out past 90 days of data.',
        rating: 3,
        status: 'in_progress',
        createdAt: new Date('2026-08-11T09:00:00Z'),
      },
      {
        category: 'product',
        comment: 'Reports are 100% faster than last month.',
        rating: 5,
        status: 'resolved',
        createdAt: new Date('2026-08-12T09:00:00Z'),
      },
    ])
  })

  it('refuses an unauthenticated request', async () => {
    const response = await get()

    expect(response.status).toBe(401)
    expect((await response.json()).error.code).toBe('UNAUTHORIZED')
  })

  it('returns a page of feedback for a signed-in admin, newest first', async () => {
    await signInAsAdmin()
    const body = await (await get()).json()

    expect(body.total).toBe(3)
    expect(body.page).toBe(1)
    expect(body.hasMore).toBe(false)
    expect(body.items[0].comment).toContain('100% faster')
    expect(body.items[0].categoryLabel).toBe('Product')
  })

  it('paginates, reporting the full total on every page', async () => {
    await signInAsAdmin()

    const first = await (await get('?pageSize=2')).json()
    expect(first.items).toHaveLength(2)
    expect(first.total).toBe(3)
    expect(first.hasMore).toBe(true)

    const second = await (await get('?pageSize=2&page=2')).json()
    expect(second.items).toHaveLength(1)
    expect(second.hasMore).toBe(false)
  })

  it('filters by category and by status', async () => {
    await signInAsAdmin()

    expect((await (await get('?category=product')).json()).total).toBe(2)
    expect((await (await get('?status=resolved')).json()).total).toBe(1)
    expect((await (await get('?category=product&status=new')).json()).total).toBe(0)
  })

  it('filters by date range', async () => {
    await signInAsAdmin()
    const body = await (await get('?from=2026-08-11&to=2026-08-12')).json()

    expect(body.total).toBe(1)
    expect(body.items[0].comment).toContain('Exports time out')
  })

  it('searches the comment text', async () => {
    await signInAsAdmin()
    const body = await (await get('?q=exports')).json()

    expect(body.total).toBe(1)
    expect(body.items[0].comment).toContain('Exports')
  })

  it('treats % in a search term as a literal, not a wildcard', async () => {
    // Unescaped, `%` in LIKE means "anything", so this would match all three rows
    // and the search would silently be wrong rather than broken.
    await signInAsAdmin()
    const body = await (await get('?q=100%25')).json()

    expect(body.total).toBe(1)
    expect(body.items[0].comment).toContain('100% faster')
  })

  it('sorts oldest first and by rating on request', async () => {
    await signInAsAdmin()

    expect((await (await get('?sort=oldest')).json()).items[0].comment).toContain('GST')
    expect((await (await get('?sort=rating_desc')).json()).items[0].rating).toBe(5)
    expect((await (await get('?sort=rating_asc')).json()).items[0].rating).toBe(2)
  })

  it('rejects a page size beyond the cap', async () => {
    await signInAsAdmin()
    expect((await get('?pageSize=5000')).status).toBe(422)
  })
})

describe('PATCH /api/feedback/[id]', () => {
  const patch = (id: string, body: unknown) =>
    patchFeedback(
      new Request(`http://localhost/api/feedback/${id}`, {
        method: 'PATCH',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(body),
      }),
      { params: Promise.resolve({ id }) },
    )

  it('refuses an unauthenticated request', async () => {
    await seedFeedback(database.db, [{ category: 'support' }])
    const [row] = await database.db.select().from(feedback)

    expect((await patch(row.id, { status: 'resolved' })).status).toBe(401)
  })

  it('moves an item through triage and stamps the change', async () => {
    await signInAsAdmin()
    // Backdated so "was it re-stamped?" is answerable — an insert and an update in
    // the same millisecond would make any comparison meaningless.
    await seedFeedback(database.db, [
      { category: 'support', createdAt: new Date('2026-08-01T09:00:00Z') },
    ])
    const [row] = await database.db.select().from(feedback)

    const response = await patch(row.id, { status: 'resolved' })
    expect(response.status).toBe(200)

    const [updated] = await database.db
      .select()
      .from(feedback)
      .where(and(eq(feedback.id, row.id), eq(feedback.status, 'resolved')))
    expect(updated).toBeDefined()
    expect(updated.updatedAt.getTime()).toBeGreaterThan(updated.createdAt.getTime())
  })

  it('rejects an unknown status', async () => {
    await signInAsAdmin()
    await seedFeedback(database.db, [{ category: 'support' }])
    const [row] = await database.db.select().from(feedback)

    expect((await patch(row.id, { status: 'archived' })).status).toBe(422)
  })

  it('returns 404 for an id that does not exist', async () => {
    await signInAsAdmin()
    const response = await patch('3f2504e0-4f89-41d3-9a0c-0305e82c3301', { status: 'resolved' })

    expect(response.status).toBe(404)
  })

  it('returns 422, not 500, for an id that is not a uuid', async () => {
    // Postgres raises a type error on an invalid uuid literal; unguarded, a bad
    // request would surface as a server error.
    await signInAsAdmin()
    expect((await patch('not-a-uuid', { status: 'resolved' })).status).toBe(422)
  })
})
