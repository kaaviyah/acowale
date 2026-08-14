/**
 * The single HTTP boundary for every route handler.
 *
 * Route handlers should contain parsing and a service call — nothing else. This
 * wrapper owns the cross-cutting concerns so they can't be forgotten one
 * endpoint at a time:
 *
 *   • a request id (reused from `x-request-id` if a proxy already assigned one,
 *     so a trace survives across hops) echoed back on the response
 *   • one structured log line per request with method, status and duration
 *   • error translation: `AppError` → its own status, `ZodError` → 422 with the
 *     offending fields, anything else → an opaque 500 plus a logged stack trace
 *   • `Cache-Control: no-store` unless the handler explicitly opts in, so
 *     authenticated JSON is never cached by a CDN or a browser
 */
import type { Logger } from 'pino'
import { ZodError } from 'zod'
import { AppError, type ErrorCode, type FieldError } from './errors'
import { requestLogger } from './logger'

/** Per-request context handed to every wrapped handler. */
export interface ApiContext {
  requestId: string
  log: Logger
  route: string
}

interface ErrorBody {
  error: {
    code: ErrorCode
    message: string
    requestId: string
    details?: FieldError[]
  }
}

type Handler<TRouteContext> = (
  request: Request,
  routeContext: TRouteContext,
  api: ApiContext,
) => Promise<Response> | Response

/** JSON response helper. Defaults to 200 and adds no caching policy of its own. */
export function json<T>(
  data: T,
  init: { status?: number; headers?: Record<string, string> } = {},
): Response {
  return Response.json(data, { status: init.status ?? 200, headers: init.headers })
}

function toFieldErrors(error: ZodError): FieldError[] {
  return error.issues.map((issue) => ({
    path: issue.path.map(String).join('.') || '(body)',
    message: issue.message,
  }))
}

export function withApi<TRouteContext = unknown>(
  route: string,
  handler: Handler<TRouteContext>,
): (request: Request, routeContext: TRouteContext) => Promise<Response> {
  return async (request, routeContext) => {
    const requestId = request.headers.get('x-request-id') ?? crypto.randomUUID()
    const log = requestLogger(requestId, route)
    const startedAt = performance.now()

    const finish = (response: Response, level: 'info' | 'warn' | 'error', extra?: object) => {
      response.headers.set('x-request-id', requestId)
      // Opt-out default: only responses that deliberately set a policy get one.
      if (!response.headers.has('cache-control')) {
        response.headers.set('cache-control', 'no-store')
      }
      log[level](
        {
          method: request.method,
          status: response.status,
          durationMs: Math.round(performance.now() - startedAt),
          ...extra,
        },
        'request completed',
      )
      return response
    }

    const errorResponse = (
      status: number,
      body: ErrorBody,
      headers?: Record<string, string>,
    ): Response => Response.json(body, { status, headers })

    try {
      return finish(await handler(request, routeContext, { requestId, log, route }), 'info')
    } catch (error) {
      if (error instanceof ZodError) {
        const details = toFieldErrors(error)
        return finish(
          errorResponse(422, {
            error: {
              code: 'VALIDATION_ERROR',
              message: 'Some fields need attention.',
              requestId,
              details,
            },
          }),
          'warn',
          { errorCode: 'VALIDATION_ERROR', fields: details.map((d) => d.path) },
        )
      }

      if (error instanceof AppError) {
        return finish(
          errorResponse(
            error.status,
            {
              error: {
                code: error.code,
                message: error.message,
                requestId,
                details: error.details,
              },
            },
            error.retryAfterSeconds
              ? { 'retry-after': String(error.retryAfterSeconds) }
              : undefined,
          ),
          error.status >= 500 ? 'error' : 'warn',
          { errorCode: error.code, cause: error.cause instanceof Error ? error.cause.message : undefined },
        )
      }

      // Unknown failure: the client gets nothing useful, the logs get everything.
      log.error({ err: error }, 'unhandled error in route handler')
      return finish(
        errorResponse(500, {
          error: {
            code: 'INTERNAL_ERROR',
            message: 'Something went wrong on our side. Please try again.',
            requestId,
          },
        }),
        'error',
        { errorCode: 'INTERNAL_ERROR' },
      )
    }
  }
}
