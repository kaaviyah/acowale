/**
 * Typed, validated environment configuration.
 *
 * Parsed once through a Zod schema so a misconfigured deployment fails with a
 * readable message instead of surfacing as `undefined` inside a SQL string at
 * 2am. `src/instrumentation.ts` calls `assertEnv()` when the server boots, so
 * the failure happens at startup rather than on a user's first request.
 *
 * Parsing is lazy (not at import time) for one practical reason: `next build`
 * imports server modules while prerendering, and CI shouldn't need production
 * secrets just to typecheck and build.
 */
import { z } from 'zod'

/**
 * Placeholders shipped in `.env.example`. Convenient locally, dangerous in
 * production — a known session secret means anyone can forge an admin cookie.
 */
const PLACEHOLDER_VALUES = new Set([
  'dev-session-secret-at-least-32-characters-long',
  'dev-rate-limit-salt-change-me',
])

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),

  /**
   * `postgres://…` → Neon HTTP driver. `file:…` / `memory://` → PGlite.
   * Resolved in `src/server/db/client.ts`.
   */
  DATABASE_URL: z
    .string()
    .min(1, 'DATABASE_URL is required (postgres://…, file:./.data/dev, or memory://)'),

  /** Direct (non-pooled) connection, used only by migrations. */
  DATABASE_URL_UNPOOLED: z.string().min(1).optional(),

  SESSION_SECRET: z.string().min(32, 'SESSION_SECRET must be at least 32 characters'),
  SESSION_TTL_HOURS: z.coerce.number().int().positive().max(720).default(8),

  ADMIN_EMAIL: z.email('ADMIN_EMAIL must be a valid email address'),
  /** `scrypt:N:r:p:salt:hash` — produced by `pnpm hash-password`. */
  ADMIN_PASSWORD_HASH: z
    .string()
    .startsWith('scrypt:', 'ADMIN_PASSWORD_HASH must be generated with `pnpm hash-password`'),

  RATE_LIMIT_SALT: z.string().min(16, 'RATE_LIMIT_SALT must be at least 16 characters'),

  // `silent` exists for test runs: assertions should fail on behaviour, not be
  // buried under a few hundred log lines.
  LOG_LEVEL: z.enum(['silent', 'trace', 'debug', 'info', 'warn', 'error', 'fatal']).default('info'),
  APP_VERSION: z.string().optional(),
})

export type Env = z.infer<typeof envSchema> & { readonly version: string }

let cached: Env | undefined

/**
 * The running build, read without validating anything.
 *
 * Safe to call when configuration is broken, which is exactly when you want to know
 * which build is live. `/api/health` depends on this and nothing else.
 */
export function appVersion(): string {
  return process.env.APP_VERSION ?? process.env.VERCEL_GIT_COMMIT_SHA?.slice(0, 7) ?? 'dev'
}

/**
 * Returns the validated environment, parsing it on first use.
 *
 * @throws {Error} with every failing variable listed, not just the first one —
 * fixing configuration one error per deploy is miserable.
 */
export function getEnv(): Env {
  if (cached) return cached

  const parsed = envSchema.safeParse(process.env)

  if (!parsed.success) {
    const problems = parsed.error.issues
      .map((issue) => `  • ${issue.path.join('.') || '(root)'}: ${issue.message}`)
      .join('\n')
    throw new Error(
      `Invalid environment configuration:\n${problems}\n\n` +
        'Copy .env.example to .env.local and fill in the values.',
    )
  }

  const env = parsed.data

  if (env.NODE_ENV === 'production') {
    const leaked = [env.SESSION_SECRET, env.RATE_LIMIT_SALT].filter((value) =>
      PLACEHOLDER_VALUES.has(value),
    )
    if (leaked.length > 0) {
      throw new Error(
        'Refusing to start: .env.example placeholder secrets are set in production. ' +
          'Generate real values (`openssl rand -base64 48`) and update the deployment.',
      )
    }
  }

  cached = {
    ...env,
    // Vercel injects the commit SHA; a short SHA is the most useful "which build
    // is live?" answer a health check can give.
    version: appVersion(),
  }

  return cached
}

/**
 * Validates configuration, returning the failure rather than throwing.
 *
 * Used by the readiness probe, so a misconfigured deployment can *report* that it is
 * misconfigured instead of returning an opaque 500 from every route.
 */
export function checkConfiguration(): { ok: boolean; error?: string } {
  try {
    getEnv()
    return { ok: true }
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : 'invalid configuration' }
  }
}

/** Fails the boot if configuration is invalid. Called from instrumentation. */
export function assertEnv(): void {
  getEnv()
}

/** Test-only escape hatch: forces the next `getEnv()` to re-read `process.env`. */
export function resetEnvCache(): void {
  cached = undefined
}
