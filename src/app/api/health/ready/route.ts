/**
 * Readiness probe: can this instance actually serve traffic?
 *
 * Returns 503 when a dependency is down so that uptime monitors and load
 * balancers can route around it, while `/api/health` keeps reporting that the
 * process itself is alive. The database latency in the payload is the fastest
 * way to tell "the app is broken" from "Postgres is slow today".
 */
import { checkDatabase } from '@/server/db/client'
import { getEnv } from '@/server/lib/env'
import { json, withApi } from '@/server/lib/with-api'

export const dynamic = 'force-dynamic'

export const GET = withApi('GET /api/health/ready', async (_request, _context, { log }) => {
  const database = await checkDatabase()

  if (!database.ok) {
    // Warn, not error: an unreachable database is expected to be transient, and
    // paging on every blip trains people to ignore the alert.
    log.warn({ database }, 'readiness check failed')
  }

  return json(
    {
      status: database.ok ? 'ready' : 'degraded',
      version: getEnv().version,
      checks: { database },
      timestamp: new Date().toISOString(),
    },
    { status: database.ok ? 200 : 503 },
  )
})
