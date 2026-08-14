import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { resetEnvCache } from '@/server/lib/env'
import { createTestDatabase, type TestDatabase } from '../helpers/db'

const { GET: liveness } = await import('@/app/api/health/route')
const { GET: readiness } = await import('@/app/api/health/ready/route')
const { GET: listCategories } = await import('@/app/api/categories/route')

let database: TestDatabase

beforeAll(async () => {
  database = await createTestDatabase()
})

afterAll(async () => {
  await database.close()
})

describe('GET /api/health', () => {
  it('reports the process as alive, with the build it is running', async () => {
    const response = await liveness(new Request('http://localhost/api/health'), {})
    expect(response.status).toBe(200)

    const body = await response.json()
    expect(body.status).toBe('ok')
    expect(body.version).toBe('test')
    expect(body.instanceUptimeSeconds).toBeGreaterThanOrEqual(0)
  })

  it('is never cached', async () => {
    const response = await liveness(new Request('http://localhost/api/health'), {})
    expect(response.headers.get('cache-control')).toBe('no-store')
  })

  it('still answers when configuration is invalid', async () => {
    // The point of a dependency-free liveness probe: a deployment with one bad
    // variable must still be able to say "the process is up". Anything else leaves
    // 500s everywhere and no way to ask what is wrong.
    const original = process.env.SESSION_SECRET
    process.env.SESSION_SECRET = 'too-short'
    resetEnvCache()

    try {
      const response = await liveness(new Request('http://localhost/api/health'), {})
      expect(response.status).toBe(200)
      expect((await response.json()).status).toBe('ok')
    } finally {
      process.env.SESSION_SECRET = original
      resetEnvCache()
    }
  })
})

describe('GET /api/health/ready', () => {
  it('reports the database as reachable, with its latency', async () => {
    const response = await readiness(new Request('http://localhost/api/health/ready'), {})
    expect(response.status).toBe(200)

    const body = await response.json()
    expect(body.status).toBe('ready')
    expect(body.checks.configuration.ok).toBe(true)
    expect(body.checks.database.ok).toBe(true)
    expect(body.checks.database.latencyMs).toBeGreaterThanOrEqual(0)
  })

  it('reports a 503 when configuration is invalid, without naming the variable', async () => {
    const original = process.env.RATE_LIMIT_SALT
    process.env.RATE_LIMIT_SALT = 'short'
    resetEnvCache()

    try {
      const response = await readiness(new Request('http://localhost/api/health/ready'), {})
      expect(response.status).toBe(503)

      const body = await response.json()
      expect(body.status).toBe('misconfigured')
      expect(body.checks.configuration.ok).toBe(false)
      // The reason goes to the log, not to a public endpoint.
      expect(JSON.stringify(body)).not.toContain('RATE_LIMIT_SALT')
    } finally {
      process.env.RATE_LIMIT_SALT = original
      resetEnvCache()
    }
  })
})

describe('GET /api/categories', () => {
  it('returns the seeded categories in the product-defined order', async () => {
    const response = await listCategories(new Request('http://localhost/api/categories'), {})
    expect(response.status).toBe(200)

    const { categories } = await response.json()
    expect(categories.map((category: { slug: string }) => category.slug)).toEqual([
      'product',
      'feature_request',
      'ui_ux',
      'support',
      'billing',
      'other',
    ])
  })

  it('is public and CDN-cacheable, unlike every admin endpoint', async () => {
    const response = await listCategories(new Request('http://localhost/api/categories'), {})

    expect(response.headers.get('cache-control')).toContain('s-maxage=300')
  })
})
