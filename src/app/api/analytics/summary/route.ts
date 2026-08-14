/**
 * `GET /api/analytics/summary` — everything the dashboard's charts need, in one
 * response backed by one SQL statement.
 *
 * Admin-only. `withApi` sets `Cache-Control: no-store` by default, which matters
 * here: this payload describes customer feedback and must never be cached by a CDN
 * or a shared browser.
 */
import { requireSession } from '@/server/http/session-cookie'
import { json, withApi } from '@/server/lib/with-api'
import { analyticsQuerySchema } from '@/server/schemas'
import { getAnalyticsSummary } from '@/server/services/analytics'

export const GET = withApi('GET /api/analytics/summary', async (request) => {
  await requireSession()

  const { range } = analyticsQuerySchema.parse(
    Object.fromEntries(new URL(request.url).searchParams),
  )

  return json(await getAnalyticsSummary(range))
})
