/**
 * Readiness probe: can this instance actually serve traffic?
 *
 * Two checks, because there are two ways to be deployed and useless:
 *
 *   `configuration` — the environment failed validation, so every route that needs
 *   a secret or a connection string will fail. This is what turns "500 everywhere,
 *   no idea why" into one line telling you where to look.
 *
 *   `database` — Postgres is unreachable. Its latency is also the fastest way to
 *   tell "the app is broken" from "Postgres is slow today".
 *
 * Returns 503 if either fails, so uptime monitors and load balancers route around
 * it, while `/api/health` keeps confirming the process itself is alive.
 *
 * The *reason* a configuration check failed is logged, never returned: the message
 * names variables, and "SESSION_SECRET must be at least 32 characters" is not
 * something a public endpoint should volunteer.
 */
import { checkDatabase } from '@/server/db/client'
import { appVersion, checkConfiguration } from '@/server/lib/env'
import { json, withApi } from '@/server/lib/with-api'

export const dynamic = 'force-dynamic'

export const GET = withApi('GET /api/health/ready', async (_request, _context, { log }) => {
  const configuration = checkConfiguration()

  if (!configuration.ok) {
    log.fatal(
      { reason: configuration.error },
      'configuration is invalid — the deployment cannot serve requests',
    )

    return json(
      {
        status: 'misconfigured',
        version: appVersion(),
        checks: {
          configuration: { ok: false },
          // Not attempted: without a validated connection string there is nothing
          // to attempt.
          database: { ok: false, skipped: true },
        },
        hint: 'Run `pnpm check-env` with the deployed values, or read the startup log.',
        timestamp: new Date().toISOString(),
      },
      { status: 503 },
    )
  }

  const database = await checkDatabase()

  if (!database.ok) {
    // Warn, not fatal: an unreachable database is usually transient, and paging on
    // every blip trains people to ignore the alert.
    log.warn({ database }, 'readiness check failed')
  }

  return json(
    {
      status: database.ok ? 'ready' : 'degraded',
      version: appVersion(),
      checks: { configuration: { ok: true }, database },
      timestamp: new Date().toISOString(),
    },
    { status: database.ok ? 200 : 503 },
  )
})
