/**
 * `PATCH /api/feedback/[id]` — move an item through triage.
 *
 * This is what makes the dashboard a tool rather than a report: the team can mark
 * feedback as in progress or resolved. PATCH rather than PUT because the request
 * carries one field, not a replacement resource.
 */
import { requireSession } from '@/server/http/session-cookie'
import { validationError } from '@/server/lib/errors'
import { json, withApi } from '@/server/lib/with-api'
import { updateFeedbackStatusSchema } from '@/server/schemas'
import { setFeedbackStatus } from '@/server/services/feedback'

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

export const PATCH = withApi<RouteContext<'/api/feedback/[id]'>>(
  'PATCH /api/feedback/[id]',
  async (request, context, { log }) => {
    await requireSession()

    const { id } = await context.params

    // Checked before it reaches Postgres: an invalid uuid literal raises a driver
    // error, which would surface as a 500 for what is really a bad request.
    if (!UUID_PATTERN.test(id)) {
      throw validationError([{ path: 'id', message: 'That is not a valid feedback id.' }])
    }

    const body: unknown = await request.json().catch(() => null)
    const { status } = updateFeedbackStatusSchema.parse(body ?? {})

    const updated = await setFeedbackStatus(id, status, log)

    return json({
      id: updated.id,
      status: updated.status,
      updatedAt: updated.updatedAt.toISOString(),
    })
  },
)
