/**
 * Seeds the database.
 *
 *   pnpm db:seed           reference data only (safe against production)
 *   pnpm db:seed --demo    reference data + ~220 backdated demo submissions
 *
 * The `--demo` flag refuses to run against a database that already holds
 * feedback, so it can't quietly double up a demo dataset — or, worse, pad real
 * customer feedback with invented rows.
 */
import { count } from 'drizzle-orm'
import { getDb } from '../src/server/db/client'
import { feedback } from '../src/server/db/schema'
import { seedCategories, seedDemoFeedback } from '../src/server/db/seed'

async function main(): Promise<void> {
  const withDemo = process.argv.includes('--demo')
  const db = await getDb()

  const categoryCount = await seedCategories(db)
  console.log(`Categories seeded (${categoryCount} rows upserted).`)

  if (!withDemo) {
    console.log('Skipping demo feedback. Pass --demo to generate a sample dataset.')
    return
  }

  const [{ existing }] = await db.select({ existing: count() }).from(feedback)
  if (existing > 0) {
    console.log(`Refusing to add demo data: feedback table already has ${existing} rows.`)
    return
  }

  const inserted = await seedDemoFeedback(db)
  console.log(`Demo feedback created (${inserted} rows).`)
}

main()
  .then(() => process.exit(0))
  .catch((error: unknown) => {
    console.error('Seed failed:', error instanceof Error ? error.message : error)
    process.exit(1)
  })
