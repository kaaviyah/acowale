# Teach Us Something

## Give every pull request its own copy of the database

The least reviewable part of any pull request is the migration. A reviewer reads
`ALTER TABLE feedback ADD COLUMN sentiment text`, thinks "fine", and approves. What they
cannot see from the diff is that the table has 40 million rows, that the migration takes a
lock for eleven minutes, and that the backfill in the same file will time out. You find that
out on `main`, at the moment it matters most.

Preview deployments solved this for application code and left the database behind. Every PR
gets its own URL, and they all point at the same staging database with fourteen rows in it —
so the one part of the change that can cause an outage is the one part nobody tested against
realistic data.

**Copy-on-write database branching closes that gap.** Neon, PlanetScale and Supabase all do
it; Postgres-native equivalents exist too. A branch is not a copy — it shares storage pages
with its parent and only diverges as you write. Branching a 200 GB database takes about a
second and costs almost nothing, because until you touch a page there is nothing to store.

The workflow is three CI steps:

```yaml
# on: pull_request
- run: neon branches create --name pr-${{ github.event.number }} --parent main
- run: pnpm db:migrate            # against the branch, with real data shapes
- run: pnpm test:integration      # preview deploy points here too
# on: pull_request closed → neon branches delete pr-${{ github.event.number }}
```

What that buys you, in rough order of how much pain it saves:

- **Destructive migrations fail in CI.** Dropping a column that a running query still selects
  breaks the branch, not production.
- **Migration duration becomes a reviewable number.** "This took 11 minutes on production-sized
  data" is a comment on the PR, not a discovery during a deploy.
- **Backfills get rehearsed** against real distributions — the nulls, the emoji, the 200 KB
  comment somebody pasted a stack trace into.
- **Reverting is instant.** Delete the branch. No cleanup script, no half-migrated staging
  database that three people are now debugging.
- **Reviewers can click through the PR's preview** with data that looks like production, so
  product feedback arrives before merge instead of after.

Two caveats worth stating up front. Branches inherit production data, so either restrict who
can open them or branch from an anonymised parent that a scheduled job maintains — a preview
URL with real customer emails behind it is a data-protection incident waiting for a bored
attacker. And branches leak: without the delete-on-close step you will find sixty of them in
a month, and they do eventually cost money.

I did not do this here — one table and no production data made it hard to justify. But the
first time a schema change scares you, this is the thing that makes it boring.

*(Recipe applies to Neon; PlanetScale calls them branches with deploy requests, Supabase calls
them preview branches.)*
