/**
 * `GET /api/categories` — the option list the public form renders.
 *
 * Public and cacheable: it changes when the product team adds a category, which is
 * rarely. `s-maxage=300` lets Vercel's CDN serve it, and `stale-while-revalidate`
 * means the refresh after five minutes happens in the background rather than in
 * front of a user waiting to submit feedback.
 */
import { listCategories } from '@/server/services/categories'
import { json, withApi } from '@/server/lib/with-api'

export const GET = withApi('GET /api/categories', async () => {
  const categories = await listCategories()

  return json(
    { categories },
    { headers: { 'cache-control': 'public, s-maxage=300, stale-while-revalidate=600' } },
  )
})
