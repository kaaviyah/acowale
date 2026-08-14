/**
 * Liveness probe.
 *
 * Dependency-free on purpose, and that includes configuration: it answers "is this
 * process serving HTTP?" and nothing else.
 *
 * It used to read validated configuration for the version string, which meant a
 * deployment with one bad environment variable returned 500 here too — the one
 * endpoint whose job is to tell you what is happening died with everything else,
 * leaving the platform's log viewer as the only diagnosis. Now a misconfigured
 * deployment answers 200 here and reports the problem from `/api/health/ready`,
 * while every real request still fails closed.
 */
import { appVersion } from '@/server/lib/env'
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
  return json({
    status: 'ok',
    service: 'acowale-crm',
    version: appVersion(),
    instanceUptimeSeconds: Math.round((Date.now() - instanceStartedAt) / 1000),
    timestamp: new Date().toISOString(),
  })
})
