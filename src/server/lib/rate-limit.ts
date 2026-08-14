/**
 * Fixed-window rate limiting, backed by the application's own Postgres.
 *
 * Why not an in-memory counter: serverless instances share no memory, so a
 * per-process `Map` under-counts by however many instances happen to be warm — it
 * looks like it works in development and quietly does nothing in production.
 *
 * Why not Redis: this needs one integer per caller per window. Postgres does that
 * atomically with `INSERT … ON CONFLICT DO UPDATE`, and a second datastore is a
 * second thing to provision, secure, pay for and explain. The cost is a write per
 * public request on the primary, which is the right trade at this traffic level and
 * the wrong one at scale — see DECISIONS.md.
 *
 * Fixed windows (not sliding) allow a burst across a boundary: up to 2× the limit
 * over two adjacent windows. Accepted deliberately — the mitigation for the
 * pathological case is the hourly rule layered on top of the per-minute one.
 */
import { createHash } from 'node:crypto'
import { getDb } from '../db/client'
import { pruneExpiredWindows, recordHit } from '../repos/rate-limit'
import { getEnv } from './env'
import { rateLimited } from './errors'

export interface RateLimitRule {
  /** Appears in the bucket key, so rules never share a counter. */
  name: string
  limit: number
  windowSeconds: number
}

export const RATE_LIMITS = {
  /** Two layers: stops a hammering script, and still bounds a patient one. */
  submitFeedback: [
    { name: 'feedback:minute', limit: 5, windowSeconds: 60 },
    { name: 'feedback:hour', limit: 30, windowSeconds: 3_600 },
  ] satisfies RateLimitRule[],

  /** Tighter, because this one guards a password. */
  login: [{ name: 'login:15min', limit: 10, windowSeconds: 900 }] satisfies RateLimitRule[],
} as const

/** Windows older than this are eligible for deletion. */
const PRUNE_AFTER_SECONDS = 7_200
/** Roughly one request in fifty pays for cleanup. */
const PRUNE_PROBABILITY = 0.02

/**
 * Best-effort client address.
 *
 * `x-forwarded-for` is a chain — the *first* entry is the original client and the
 * rest are proxies, so taking the last one would rate-limit Vercel's edge network
 * instead of the caller. The header is trustworthy here only because the platform
 * terminates TLS and rewrites it; behind an untrusted proxy it is caller-controlled
 * and must not be used for anything that matters.
 */
export function clientIpFrom(request: Request): string {
  const forwarded = request.headers.get('x-forwarded-for')
  const first = forwarded?.split(',')[0]?.trim()
  if (first) return first

  return request.headers.get('x-real-ip')?.trim() ?? 'unknown'
}

/**
 * `sha256(identity + salt):rule` — the table stores hashes, never addresses.
 *
 * The salt is what makes the hashes non-enumerable: without it, anyone with the
 * table could confirm whether a given IP submitted feedback by hashing all four
 * billion IPv4 addresses.
 */
export function bucketKeyFor(rule: RateLimitRule, identity: string): string {
  const digest = createHash('sha256')
    .update(`${identity}${getEnv().RATE_LIMIT_SALT}`)
    .digest('base64url')

  return `${digest}:${rule.name}`
}

/** Floors the clock to the start of the current window. */
export function windowStartFor(rule: RateLimitRule, now: Date): Date {
  const windowMs = rule.windowSeconds * 1_000
  return new Date(Math.floor(now.getTime() / windowMs) * windowMs)
}

/** Seconds until the current window rolls over — the `Retry-After` value. */
export function retryAfterSeconds(rule: RateLimitRule, windowStart: Date, now: Date): number {
  const endsAt = windowStart.getTime() + rule.windowSeconds * 1_000
  return Math.max(1, Math.ceil((endsAt - now.getTime()) / 1_000))
}

/**
 * Applies every rule to one caller.
 *
 * @throws {AppError} 429 with `Retry-After` when any rule is exceeded.
 */
export async function enforceRateLimits(
  rules: readonly RateLimitRule[],
  identity: string,
  now = new Date(),
): Promise<void> {
  const db = await getDb()

  // Concurrent, so N rules cost one round trip of latency rather than N.
  const outcomes = await Promise.all(
    rules.map(async (rule) => {
      const windowStart = windowStartFor(rule, now)
      const hits = await recordHit(db, bucketKeyFor(rule, identity), windowStart)
      return { rule, windowStart, hits }
    }),
  )

  if (Math.random() < PRUNE_PROBABILITY) {
    // Never let housekeeping fail a user's request.
    void pruneExpiredWindows(db, new Date(now.getTime() - PRUNE_AFTER_SECONDS * 1_000)).catch(
      () => undefined,
    )
  }

  const exceeded = outcomes.find((outcome) => outcome.hits > outcome.rule.limit)
  if (exceeded) {
    throw rateLimited(retryAfterSeconds(exceeded.rule, exceeded.windowStart, now))
  }
}
