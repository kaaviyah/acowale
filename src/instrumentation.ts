/**
 * Server startup hook (Next.js calls `register()` once per runtime).
 *
 * Validates configuration at boot and logs the result. It deliberately does **not**
 * rethrow: crashing here takes down `/api/health` and `/api/health/ready` along with
 * everything else, which leaves a misconfigured deployment returning opaque 500s and
 * no way to ask it what is wrong from outside.
 *
 * Nothing is served insecurely as a result — every route that needs configuration
 * calls `getEnv()` and fails closed. The difference is only that the failure is now
 * legible: one fatal log line naming the variables, and a readiness endpoint that
 * reports it.
 */
export async function register(): Promise<void> {
  // `register` runs in every runtime; this app's server code is Node-only.
  if (process.env.NEXT_RUNTIME !== 'nodejs') return

  const { getEnv } = await import('@/server/lib/env')
  const { logger } = await import('@/server/lib/logger')

  try {
    const env = getEnv()
    logger().info(
      {
        version: env.version,
        environment: env.NODE_ENV,
        database: env.DATABASE_URL.startsWith('postgres') ? 'postgres' : 'pglite',
        logLevel: env.LOG_LEVEL,
      },
      'acowale-crm server starting',
    )
  } catch (error) {
    logger().fatal(
      { reason: error instanceof Error ? error.message : error },
      'acowale-crm cannot serve requests: configuration is invalid',
    )
  }
}
