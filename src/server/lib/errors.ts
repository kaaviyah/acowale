/**
 * Application error types.
 *
 * The rule this file exists to enforce: a client learns what it needs to fix a
 * request and nothing more. Anything unexpected becomes a generic 500 to the
 * caller and a full stack trace in the logs — stack traces in HTTP responses
 * are a gift to anyone probing the app.
 */

export type ErrorCode =
  | 'VALIDATION_ERROR'
  | 'UNAUTHORIZED'
  | 'NOT_FOUND'
  | 'RATE_LIMITED'
  | 'SERVICE_UNAVAILABLE'
  | 'INTERNAL_ERROR'

export interface FieldError {
  path: string
  message: string
}

/** An error whose message and status code are safe to show a client. */
export class AppError extends Error {
  readonly code: ErrorCode
  readonly status: number
  readonly details?: FieldError[]
  /** Populated for 429s so the response can carry a `Retry-After` header. */
  readonly retryAfterSeconds?: number

  constructor(
    code: ErrorCode,
    status: number,
    message: string,
    options: { details?: FieldError[]; retryAfterSeconds?: number; cause?: unknown } = {},
  ) {
    super(message, { cause: options.cause })
    this.name = 'AppError'
    this.code = code
    this.status = status
    this.details = options.details
    this.retryAfterSeconds = options.retryAfterSeconds
  }
}

export const validationError = (details: FieldError[], message = 'Some fields need attention.') =>
  new AppError('VALIDATION_ERROR', 422, message, { details })

export const unauthorized = (message = 'Sign in to continue.') =>
  new AppError('UNAUTHORIZED', 401, message)

export const notFound = (message = 'Not found.') => new AppError('NOT_FOUND', 404, message)

export const rateLimited = (retryAfterSeconds: number) =>
  new AppError('RATE_LIMITED', 429, 'Too many requests. Please try again shortly.', {
    retryAfterSeconds,
  })

export const serviceUnavailable = (message = 'Service temporarily unavailable.', cause?: unknown) =>
  new AppError('SERVICE_UNAVAILABLE', 503, message, { cause })
