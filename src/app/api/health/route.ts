/**
 * Liveness probe.
 *
 * Deliberately dependency-free: it answers "is this process serving HTTP?" and
 * nothing else. If a liveness check fails because the *database* is unreachable,
 * an orchestrator will restart or replace a perfectly healthy instance and make
 * the outage worse. Dependency checks live in `/api/health/ready`.
 */
import { getEnv } from '@/server/lib/env'
import { json, withApi } from '@/server/lib/with-api'

/** A cached health check is worse than no health check. */
export const dynamic = 'force-dynamic'

/**
 * Module scope is evaluated once per server instance, so this reports how long
 * *this* instance has been alive — which on serverless doubles as a cold-start
 * signal.
 */
const instanceStartedAt = Date.now()

export const GET = withApi('GET /api/health', async () => {
  const env = getEnv()

  return json({
    status: 'ok',
    service: 'acowale-crm',
    version: env.version,
    environment: env.NODE_ENV,
    instanceUptimeSeconds: Math.round((Date.now() - instanceStartedAt) / 1000),
    timestamp: new Date().toISOString(),
  })
})
