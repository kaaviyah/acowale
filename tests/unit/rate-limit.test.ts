import { afterEach, describe, expect, it } from 'vitest'
import { resetEnvCache } from '@/server/lib/env'
import {
  bucketKeyFor,
  clientIpFrom,
  RATE_LIMITS,
  retryAfterSeconds,
  windowStartFor,
} from '@/server/lib/rate-limit'

const minuteRule = { name: 'test:minute', limit: 5, windowSeconds: 60 }
const ORIGINAL_SALT = process.env.RATE_LIMIT_SALT

afterEach(() => {
  process.env.RATE_LIMIT_SALT = ORIGINAL_SALT
  resetEnvCache()
})

describe('fixed windows', () => {
  it('floors the clock to the start of the window', () => {
    expect(windowStartFor(minuteRule, new Date('2026-08-13T10:00:37.500Z')).toISOString()).toBe(
      '2026-08-13T10:00:00.000Z',
    )
    expect(windowStartFor(minuteRule, new Date('2026-08-13T10:00:59.999Z')).toISOString()).toBe(
      '2026-08-13T10:00:00.000Z',
    )
    expect(windowStartFor(minuteRule, new Date('2026-08-13T10:01:00.000Z')).toISOString()).toBe(
      '2026-08-13T10:01:00.000Z',
    )
  })

  it('groups an hour-long window by the hour', () => {
    const hourRule = { name: 'test:hour', limit: 30, windowSeconds: 3_600 }
    expect(windowStartFor(hourRule, new Date('2026-08-13T10:59:00Z')).toISOString()).toBe(
      '2026-08-13T10:00:00.000Z',
    )
  })

  it('reports how long until the window rolls over', () => {
    const now = new Date('2026-08-13T10:00:37Z')
    expect(retryAfterSeconds(minuteRule, windowStartFor(minuteRule, now), now)).toBe(23)
  })

  it('never advises a client to retry in zero seconds', () => {
    const now = new Date('2026-08-13T10:00:59.999Z')
    expect(retryAfterSeconds(minuteRule, windowStartFor(minuteRule, now), now)).toBeGreaterThan(0)
  })
})

describe('bucket keys', () => {
  it('is stable for the same caller and rule', () => {
    expect(bucketKeyFor(minuteRule, '203.0.113.7')).toBe(bucketKeyFor(minuteRule, '203.0.113.7'))
  })

  it('separates callers, and separates rules for one caller', () => {
    expect(bucketKeyFor(minuteRule, '203.0.113.7')).not.toBe(bucketKeyFor(minuteRule, '203.0.113.8'))
    expect(bucketKeyFor(minuteRule, '203.0.113.7')).not.toBe(
      bucketKeyFor({ ...minuteRule, name: 'test:hour' }, '203.0.113.7'),
    )
  })

  it('stores no recoverable IP address', () => {
    const key = bucketKeyFor(minuteRule, '203.0.113.7')

    expect(key).not.toContain('203.0.113.7')
    expect(key.endsWith(':test:minute')).toBe(true)
  })

  it('changes with the salt, so the hashes are not enumerable', () => {
    const before = bucketKeyFor(minuteRule, '203.0.113.7')

    process.env.RATE_LIMIT_SALT = 'a-different-salt-value-entirely'
    resetEnvCache()

    expect(bucketKeyFor(minuteRule, '203.0.113.7')).not.toBe(before)
  })
})

describe('client address', () => {
  const withHeaders = (headers: Record<string, string>) =>
    new Request('https://example.com/api/feedback', { headers })

  it('takes the first hop of x-forwarded-for — the client, not the proxy', () => {
    expect(
      clientIpFrom(withHeaders({ 'x-forwarded-for': '203.0.113.7, 70.41.3.18, 150.172.238.178' })),
    ).toBe('203.0.113.7')
  })

  it('falls back to x-real-ip, then to a constant', () => {
    expect(clientIpFrom(withHeaders({ 'x-real-ip': '203.0.113.9' }))).toBe('203.0.113.9')
    // Everything unattributable shares one bucket. Deliberate: better to limit an
    // unknown caller collectively than not at all.
    expect(clientIpFrom(withHeaders({}))).toBe('unknown')
  })
})

describe('configured limits', () => {
  it('layers a per-minute rule under an hourly one for submissions', () => {
    expect(RATE_LIMITS.submitFeedback.map((rule) => rule.windowSeconds)).toEqual([60, 3_600])
    // The hourly cap must be lower than 60× the per-minute cap, or it never binds.
    const [perMinute, perHour] = RATE_LIMITS.submitFeedback
    expect(perHour.limit).toBeLessThan(perMinute.limit * 60)
  })

  it('guards the password endpoint more tightly than the public form', () => {
    expect(RATE_LIMITS.login[0].limit).toBeLessThanOrEqual(10)
    expect(RATE_LIMITS.login[0].windowSeconds).toBeGreaterThanOrEqual(900)
  })
})
