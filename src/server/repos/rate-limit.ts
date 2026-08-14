/**
 * Rate limit counters.
 *
 * One atomic statement per check: insert the window row, or increment it if it
 * already exists, and return the new value. Correct under concurrency because
 * Postgres serialises conflicting upserts on the primary key — two simultaneous
 * requests cannot both read "1" and both write "2".
 */
import { lt, sql } from 'drizzle-orm'
import type { Db } from '../db/client'
import { rateLimitHits } from '../db/schema'

/** Records a request against a bucket and returns the request count in that window. */
export async function recordHit(db: Db, bucketKey: string, windowStart: Date): Promise<number> {
  const [row] = await db
    .insert(rateLimitHits)
    .values({ bucketKey, windowStart, hits: 1 })
    .onConflictDoUpdate({
      target: [rateLimitHits.bucketKey, rateLimitHits.windowStart],
      set: { hits: sql`${rateLimitHits.hits} + 1` },
    })
    .returning({ hits: rateLimitHits.hits })

  return row?.hits ?? 1
}

/**
 * Deletes expired windows.
 *
 * Called opportunistically from the limiter rather than on a schedule: this table
 * is write-heavy and would otherwise grow forever, and a cron job for one DELETE
 * is more moving parts than the problem deserves.
 */
export async function pruneExpiredWindows(db: Db, olderThan: Date): Promise<void> {
  await db.delete(rateLimitHits).where(lt(rateLimitHits.windowStart, olderThan))
}
