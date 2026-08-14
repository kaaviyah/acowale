/**
 * Server startup hook (Next.js calls `register()` once per runtime).
 *
 * Used for one thing: validating configuration at boot. A deployment with a
 * missing `SESSION_SECRET` should fail immediately and visibly in the logs,
 * rather than looking healthy until the first person tries to sign in.
 */
export async function register(): Promise<void> {
  // `register` runs in every runtime; this app's server code is Node-only.
  if (process.env.NEXT_RUNTIME !== 'nodejs') return

  const { getEnv } = await import('@/server/lib/env')
  const { logger } = await import('@/server/lib/logger')

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
}
