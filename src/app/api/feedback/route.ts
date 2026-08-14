/**
 * `/api/feedback`
 *
 *   POST — public submission. Rate limited, validated, honeypot-checked.
 *   GET  — admin list with search, filters, sort and pagination.
 *
 * Both handlers are deliberately thin: parse the request, call a service, shape a
 * response. Validation lives in the schemas, rules live in the service, and every
 * error path is handled by `withApi`.
 */
import { requireSession } from '@/server/http/session-cookie'
import { clientIpFrom, enforceRateLimits, RATE_LIMITS } from '@/server/lib/rate-limit'
import { json, withApi } from '@/server/lib/with-api'
import { createFeedbackSchema, listFeedbackQuerySchema } from '@/server/schemas'
import { getFeedbackList, submitFeedback } from '@/server/services/feedback'

export const POST = withApi('POST /api/feedback', async (request, _context, { log }) => {
  // Rate limit before doing any work, so a flood costs one upsert rather than a
  // JSON parse, a validation pass and an insert.
  await enforceRateLimits(RATE_LIMITS.submitFeedback, clientIpFrom(request))

  // A malformed body is a 422 with a field error, not an unhandled 500.
  const body: unknown = await request.json().catch(() => null)
  const input = createFeedbackSchema.parse(body ?? {})

  const created = await submitFeedback(input, log)

  return json(
    { id: created.id, createdAt: created.createdAt.toISOString() },
    { status: 201, headers: { location: `/api/feedback/${created.id}` } },
  )
})

export const GET = withApi('GET /api/feedback', async (request) => {
  await requireSession()

  const query = listFeedbackQuerySchema.parse(
    Object.fromEntries(new URL(request.url).searchParams),
  )
  const result = await getFeedbackList(query)

  return json({
    ...result,
    items: result.items.map((item) => ({
      ...item,
      createdAt: item.createdAt.toISOString(),
      updatedAt: item.updatedAt.toISOString(),
    })),
  })
})
