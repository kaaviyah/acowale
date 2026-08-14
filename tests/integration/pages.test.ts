/**
 * Page-level smoke tests.
 *
 * These invoke the server components as functions, which exercises everything they
 * do before returning markup: session checks, query-parameter parsing, the SQL, and
 * the arithmetic in between. They deliberately don't render the resulting tree —
 * that needs a browser, and the payoff here is the data path, which is where the
 * failures actually happen.
 *
 * The one exception is `redirect()`, which works by throwing: asserting that a page
 * rejects with Next.js's redirect signal is how "unauthenticated visitors are sent to
 * the login page" gets tested without a server.
 */
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { createTestDatabase, resetTestData, seedFeedback, type TestDatabase } from '../helpers/db'
import { cookieJar, signInAsAdmin } from '../helpers/cookies'

vi.mock('next/headers', async () => {
  const { cookiesStub } = await import('../helpers/cookies')
  return { cookies: async () => cookiesStub() }
})

const DashboardPage = (await import('@/app/admin/page')).default
const AdminLayout = (await import('@/app/admin/layout')).default
const FeedbackPage = (await import('@/app/page')).default
const LoginPage = (await import('@/app/login/page')).default

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

/** Next.js signals a redirect by throwing; this is how the framework reports it. */
const isRedirect = (error: unknown) =>
  error instanceof Error && error.message.includes('NEXT_REDIRECT')

describe('public feedback page', () => {
  it('renders with the seeded categories', async () => {
    await expect(FeedbackPage()).resolves.toBeTruthy()
  })
})

describe('login page', () => {
  it('renders for a visitor with no session', async () => {
    await expect(
      LoginPage({ params: Promise.resolve({}), searchParams: Promise.resolve({}) }),
    ).resolves.toBeTruthy()
  })

  it('sends an already-signed-in admin to the dashboard', async () => {
    await signInAsAdmin()

    await expect(
      LoginPage({ params: Promise.resolve({}), searchParams: Promise.resolve({}) }),
    ).rejects.toSatisfy(isRedirect)
  })
})

describe('admin shell', () => {
  it('redirects an unauthenticated request, even though the proxy already did', async () => {
    await expect(
      AdminLayout({ params: Promise.resolve({}), children: null }),
    ).rejects.toSatisfy(isRedirect)
  })

  it('renders for a signed-in admin', async () => {
    await signInAsAdmin()

    await expect(
      AdminLayout({ params: Promise.resolve({}), children: null }),
    ).resolves.toBeTruthy()
  })
})

describe('dashboard', () => {
  const render = (searchParams: Record<string, string> = {}) =>
    DashboardPage({ params: Promise.resolve({}), searchParams: Promise.resolve(searchParams) })

  beforeEach(async () => {
    await signInAsAdmin()
    await seedFeedback(database.db, [
      { category: 'product', rating: 5, status: 'resolved' },
      { category: 'billing', rating: 2, status: 'new' },
      { category: 'billing', rating: 1, status: 'in_progress' },
    ])
  })

  it('renders with no query parameters at all', async () => {
    await expect(render()).resolves.toBeTruthy()
  })

  it('renders for every supported period', async () => {
    for (const range of ['7d', '30d', '90d', 'all']) {
      await expect(render({ range })).resolves.toBeTruthy()
    }
  })

  it('renders with filters and a page number applied', async () => {
    await expect(
      render({ range: '90d', category: 'billing', status: 'new', q: 'seeded', page: '1' }),
    ).resolves.toBeTruthy()
  })

  it('falls back to defaults instead of erroring on a hand-edited URL', async () => {
    // The API answers a bad parameter with 422; a browser should still get a page.
    await expect(render({ range: 'not-a-range', page: '-4', status: 'archived' })).resolves.toBeTruthy()
  })

  it('renders when there is no feedback at all', async () => {
    await resetTestData(database.db)
    await expect(render()).resolves.toBeTruthy()
  })
})
