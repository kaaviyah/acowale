/**
 * Structured logging.
 *
 * One JSON object per line to stdout, which is what Vercel (and every other log
 * collector) ingests. Every API log line carries `requestId`, `route`, `status`
 * and `durationMs` so a report of "the form was broken around 3pm" can be
 * answered by filtering rather than guessing.
 *
 * Feedback text and emails are redacted. Logs are replicated, retained and
 * widely readable; they should not quietly become a second copy of user data.
 */
import pino from 'pino'
import { appVersion, getEnv } from './env'

let root: pino.Logger | undefined

function createLogger(): pino.Logger {
  /**
   * Logging has to work when configuration does not — a broken deployment is
   * precisely when you need the logs, and a logger that throws because
   * `LOG_LEVEL` is unreadable takes the diagnosis down with the app.
   */
  let level = 'info'
  let base: Record<string, unknown> = { service: 'acowale-crm', version: appVersion() }

  try {
    const env = getEnv()
    level = env.LOG_LEVEL
    base = { service: 'acowale-crm', version: env.version, env: env.NODE_ENV }
  } catch {
    base = { ...base, configuration: 'invalid' }
  }

  return pino({
    level,
    base,
    // Pino emits numeric levels by default; log viewers are searched by humans.
    formatters: { level: (label) => ({ level: label }) },
    timestamp: pino.stdTimeFunctions.isoTime,
    redact: {
      paths: [
        'comment',
        'email',
        '*.comment',
        '*.email',
        'body.comment',
        'body.email',
        'headers.cookie',
        'headers.authorization',
      ],
      censor: '[redacted]',
    },
  })
}

/** The process-wide logger, created on first use (needs validated env). */
export function logger(): pino.Logger {
  root ??= createLogger()
  return root
}

/** A logger that stamps every line with the current request's id. */
export function requestLogger(requestId: string, route: string): pino.Logger {
  return logger().child({ requestId, route })
}
