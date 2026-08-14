# Engineering Decision Log

Acowale CRM machine test · Kaaviyah Prakasam

---

## 1. Why this technology stack?

**Next.js 16 (App Router) + TypeScript + Postgres + Drizzle, on Vercel.**

The brief is one product with two faces — a public form and an admin console — sharing one
data model. That is the shape a single full-stack app fits best: one deploy, one URL, one
language, one set of types from the database row to the React prop.

I considered a separated Fastify API plus a Vite SPA, which gives a crisper "here is the
backend" story. I rejected it on delivery risk rather than architecture: two deploys, and
the free hosting tiers for a long-running Node process sleep after ~15 minutes, so the
reviewer clicking the live URL would have met a 30–50 second cold start. A submission that
has to be woken up is a worse submission.

What I did instead of accepting the monolith's usual downside is keep the API layer honest:
route handlers under `src/app/api` are thin HTTP adapters over `src/server`, and nothing in
`server/services`, `server/repos`, `server/lib` or `server/schemas` imports from `next`. If
this needed to become a standalone service, the move is re-exporting those services behind a
different HTTP layer — not a rewrite.

Specific choices inside the stack:

- **Drizzle over Prisma.** It is a typed SQL builder, not an abstraction over SQL. I can read
  the query it generates, migrations are plain `.sql` files in git that I reviewed before
  applying, and there is no query-engine binary inflating a serverless cold start. Since the
  interesting part of this product *is* a SQL aggregation, I wanted to be closer to the SQL,
  not further from it.
- **Zod for every request contract**, shared by the API and the form, so the character
  counter, the 422 message and the database `CHECK` constraint cannot drift apart.
- **pino for logs**, because structured JSON is the difference between grepping and guessing.
- **No UI kit.** Tailwind plus about a dozen purpose-built components. A component library
  would have been faster to a generic-looking dashboard and slower to this one, and it would
  have added a large dependency I would then have to defend.
- **System font stack, no web font.** Partly forced (my build environment could not reach
  `fonts.googleapis.com`), kept on merit: it removes a third-party dependency from the build
  and ~40 KB from first paint.

---

## 2. Why this database?

**Postgres, on Neon.**

The analytics requirement is literally `GROUP BY category` and `GROUP BY day` over one table,
with a period-over-period comparison. That is a relational query, and writing it in SQL took
one statement; in a document store it would have been an aggregation pipeline doing the same
work with less help from the engine.

Postgres specifically, because this application leans on four things a generic "SQL database"
would not all give me:

- `FILTER (WHERE …)` for per-status counts in the same pass as the total
- `generate_series` LEFT JOINed against the data, so quiet days render as `0` instead of
  vanishing and drawing a straight line across the gap
- `pg_trgm`, which turns the dashboard's `ILIKE '%term%'` search from a guaranteed sequential
  scan into an index lookup
- `INSERT … ON CONFLICT DO UPDATE … RETURNING`, which is the entire rate limiter

Neon for hosting because it is serverless Postgres with a real free tier, an HTTP driver that
suits functions that may be cold (no TCP handshake per query), and database branching — which
is the basis of the workflow idea in [TEACH_US.md](TEACH_US.md).

**The decision I am most pleased with:** the driver is selected from the connection string's
scheme, so `DATABASE_URL=file:./.data/dev` runs [PGlite](https://pglite.dev) — Postgres
compiled to WebAssembly, in-process. Three things fall out of that. A reviewer can clone this
and run `pnpm dev` with no cloud account and no Docker. The integration tests run the
committed migrations and the real SQL, including the trigram index, so there is no
production-only query path. And I never wrote a database mock, which means I never tested a
mock.

---

## 3. Why is the application structured this way?

Dependencies point one way: **`app → services → repos → database`.**

- **`app/api/**/route.ts`** owns HTTP and nothing else: parse the request, call a service,
  shape a response. Every handler is wrapped by `withApi`, which owns the concerns that are
  easy to forget one endpoint at a time — request id, one structured log line, error
  translation, and `Cache-Control: no-store` unless a handler opts out. That default matters:
  it means authenticated JSON cannot be cached by a CDN because somebody forgot a header.
- **`server/services`** owns the rules and throws domain errors. It has no idea what a status
  code is. This is what makes the rules testable directly.
- **`server/repos`** is the only layer with SQL in it. When a query is slow, there is one
  place to look.
- **`server/lib`** is the infrastructure the other layers borrow: env, logger, errors, rate
  limiter, sessions, password hashing.
- **`server/http`** exists to make one boundary visible. Two helpers genuinely need
  `next/headers`, so they live in their own directory rather than quietly coupling the service
  layer to the framework.

Two structural decisions I expect to be asked about:

**Server components call services directly rather than fetching their own API.** A server
process making an HTTP request to itself pays a network hop and, on serverless, potentially a
second cold start, to reach a function it could have called in-process. So the dashboard
renders from the service layer, while client interactions (changing a status) go through the
REST API. Same logic, two transports, chosen per call site. The REST read endpoints still
exist, are documented, and are covered by tests — they are the product's API surface, not
scaffolding for the UI.

**`proxy.ts` is not the authorization boundary.** It redirects unauthenticated navigation so
nobody sees an admin shell flash before a 401, but every admin route handler and the admin
layout call `requireSession()` themselves. Next.js's own docs warn against using middleware as
a full authorization solution, and the failure mode is what convinced me: if the only check
lives in a path `matcher`, then one edit to that string silently publishes customer feedback,
and no test fails. With the check in the handlers, the same edit costs a redirect.

---

## 4. What trade-offs did I make because of time?

- **The list filters do not scope the charts.** The period selector scopes the whole
  dashboard; category, status and search scope the submissions list only. Threading those
  filters through the analytics query is maybe twenty more lines of SQL, but it raises real
  design questions (does the category distribution still show all categories when you have
  filtered to one?) that I did not want to answer badly at speed. Instead of hiding the seam,
  the card header states it: *"These filters apply to this list only."*
- **Offset pagination**, not keyset. Correct here, wrong at a million rows.
- **No Content-Security-Policy.** Doing it properly with Next.js needs per-request nonces
  threaded through `proxy.ts`, and a half-configured CSP is worse than none — it breaks the
  app while guaranteeing nothing. The cheap headers (`nosniff`, `X-Frame-Options`,
  `Referrer-Policy`, HSTS) are in `next.config.ts`.
- **Stateless sessions**, so signing out clears the cookie but cannot revoke the token before
  it expires. Acceptable for one admin with an 8-hour TTL; a `sessions` table is the fix.
- **No browser-level end-to-end test.** My build environment could not open a listening
  socket, so Playwright was not available to me. I compensated by testing route handlers and
  page components directly, and by writing `scripts/smoke.sh` to check the real deployment
  over HTTP. What remains untested by machine is "does it look right", which I checked by eye.
- **One admin account, configured by environment variable.** A `users` table would be
  modelling a requirement that does not exist yet.
- **`all` means 12 months**, not all time, so the trend query stays bounded.

---

## 5. What would I do with one more week?

In this order, because this is the order the value arrives in:

1. **Unify filtering.** One filter row that scopes everything, with the analytics query taking
   the same filters. It is the only place the current UI has to explain itself.
2. **Pre-aggregate analytics** into a daily rollup table, and cache the summary response for
   30 seconds. This is also the fix for the first thing that breaks under load (§10).
3. **A browser test** for the two paths that matter — submit a form, sign in and resolve an
   item — running in CI against a preview deployment.
4. **Sentry**, so an unhandled 500 pages someone instead of waiting to be noticed in a log.
   Right now observability means "the logs are good if you go and read them".
5. **Keyset pagination**, a `sessions` table, and a strict CSP with nonces.
6. **Feedback → action.** The product gap, not a technical one: the dashboard shows trends but
   nothing happens because of them. A weekly digest to the product team, and a "this went out
   in the changelog" state after `resolved`, would close the loop with the person who
   submitted.

---

## 6. The hardest technical problem

Not the SQL — an env-file parser.

`ADMIN_PASSWORD_HASH` was arriving as the literal string `"scrypt"`, so every sign-in failed
with a correct password and no error anywhere. The value in `.env.local` was obviously right;
`getEnv()` was obviously reading it; the validation error said the format was wrong.

The cause is that the conventional scrypt hash format is `$`-delimited
(`scrypt$16384$8$1$salt$hash`), and Node's `--env-file` parser performs `$VAR` expansion
inside double-quoted values. `$16384` and `$8` are undefined variables, so they expanded to
nothing and the string was truncated at the first `$`. It looked like an application bug and
was a quoting bug two layers below.

Two things made it worth the time. First, the fix is not "remember to use single quotes" —
that is a landmine for whoever deploys next. Base64 never produces a colon, so the format now
uses `:`, which survives env files, shells and CI secret editors alike; a regression test
asserts the hash contains no `$`, and the runbook lists the symptom. Second, it made an
environment precedence rule concrete: **Node's `--env-file` never overrides a variable that is
already set in the environment**, which is exactly the behaviour you want in production (the
platform's variables beat a committed file) and exactly what will confuse you locally when a
stale value is exported in your shell.

Honourable mention: getting the trend chart and the headline total to agree. My first version
joined `generate_series` against feedback on the day only, without the window bound, so a
submission just outside the period could still land in the first bucket and the chart would
sum to more than the number printed above it. There is now a test asserting those two numbers
are equal, because a dashboard that disagrees with itself is worse than one that is missing a
chart.

---

## 7. Which AI tools did I use?

Claude Code (Opus), driven from the terminal, for the whole build — planning, implementation,
tests and documentation. No other AI tools.

I used it in two distinct modes, and the distinction is the point:

- **As an architect, before any code.** The first session was plan-only: proposed file
  structure, schema, API surface, build order, and a written list of the risks it expected to
  hit. I reviewed and pushed on that plan before a single file was created.
- **As a fast pair, with me as the reviewer.** Every non-trivial piece was checked against
  something real — the generated SQL, the actual test output, the framework's own bundled
  documentation — rather than accepted because it read well.

The habit I would keep: making it read `node_modules/next/dist/docs/` instead of relying on
its own memory of Next.js. That is how the build correctly uses `proxy.ts` rather than
`middleware.ts`, awaits `cookies()` and `params`, and uses the generated `RouteContext` types
— all Next.js 16 changes that a model's training data will happily get wrong with total
confidence.

---

## 8. One instance where AI helped

The analytics summary. I described what the dashboard needed — totals, a comparison against
the previous period, per-category counts, a daily series — and asked for it as a single
statement rather than four queries, because on a serverless connection every round trip pays
setup cost.

It produced a CTE query in a couple of minutes that would have taken me an hour to get right,
including two details I would have reached only after seeing the chart look wrong: the
per-category count is a `LEFT JOIN` *from* `categories` (so a category nobody complained about
shows `0` rather than disappearing), and the daily series is a `LEFT JOIN` against
`generate_series` (so a quiet Sunday is a zero, not a missing point).

What made it useful rather than risky is that I could read the output. I checked the `FILTER`
clauses against the status counts by hand, verified the previous-period window was the same
length as the current one, and then wrote tests that pin the arithmetic — that the shares sum
to 1, that an unrated submission is excluded from the average instead of counting as zero, and
that the trend sums to the total. The speed came from the model; the confidence came from the
tests.

---

## 9. One instance where I disagreed with AI

A test failed on a timestamp assertion: after a `PATCH`, `updatedAt` was not greater than
`createdAt`, because PGlite inserted and updated the row inside the same millisecond. The
model's proposed fix was to relax the comparison to `>=`.

I disagreed, and the reason generalises: with `>=`, the assertion passes whether or not the
code touches `updatedAt` at all. It would have looked green while testing nothing — the worst
possible outcome for a test, because it also removes the pressure to ever look again. The
failure was in my fixture, not in my expectation.

The fix was to backdate the seeded row, so `createdAt` is genuinely in the past and
`updatedAt > createdAt` proves what it claims. Same green tick, actual meaning behind it.

I saw the same pattern three times more and pushed back the same way. A first draft of
`findActiveCategoryIdBySlug` ran a second query that checked whether *any* category was
active rather than the one it had just found — plausible-looking code that would have accepted
submissions against retired categories, which no test I had yet written would have caught. The
first trend query was missing its window bound, so the chart could out-sum its own headline
number. And a generated test tampered with a JWT by flipping the **last** character of the
signature — but a 32-byte HMAC is 43 base64url characters, so that final character carries
only 4 significant bits and several values decode to identical bytes. The test failed roughly
one run in three, on a token that genuinely had not changed. The tempting move there is to
re-run until it is green; the correct one is to tamper with the first character, which always
maps onto a real byte, and to add the test that was actually missing — a token with rewritten
claims and an untouched signature, which is the attack that matters.

The pattern across all four: the generated code was confident, syntactically perfect, and
wrong in a direction that does not announce itself. Being the person who checks the claim
rather than the syntax is where the value is now.

---

## 10. What would break first with 100,000 users?

**The analytics query, before anything else.**

Every dashboard load runs one statement that scans every row in the selected window. At
100,000 users submitting even occasionally — call it 100k rows a day — a 30-day view aggregates
~3 million rows, from scratch, on every page load and every filter change, on a shared Neon
compute. Postgres will do it, in seconds rather than milliseconds, and the dashboard becomes
the thing nobody opens. The indexes do not save it: this is aggregation, not lookup.

The fix is not a faster query, it is not doing the work per request: a `feedback_daily` rollup
table keyed on `(day, category_id)`, maintained incrementally, so a 30-day view reads ~180
rows instead of 3 million. Plus a 30-second cache on the summary response, because the numbers
do not need to be sub-minute fresh to be useful.

In order after that:

1. **The rate-limit table becomes the hottest write path.** Every public submission does two
   upserts, and the periodic `DELETE` of expired windows generates dead tuples and vacuum
   pressure on a table read on every request. This is the trade I knowingly made (§ below);
   at that volume it is where Redis earns its keep, or an `UNLOGGED` partitioned table if
   staying single-datastore matters more.
2. **`OFFSET` pagination.** `OFFSET 20000` still walks 20,000 rows. Keyset pagination on
   `(created_at, id)` fixes it and also fixes the correctness bug nobody notices — rows
   shifting between pages as new feedback arrives.
3. **Text search.** `pg_trgm` holds well into the millions, then wants a `tsvector` column with
   `websearch_to_tsquery` for ranked multi-word search.
4. **Log volume and cost**, in that order. One line per request is fine; one line per request
   at that scale is a bill. Sampling for 2xx, keep everything for 4xx/5xx.

Two things that would *not* break first, and are worth naming because they are the usual
guesses: connection exhaustion is avoided by the HTTP driver (no persistent connection per
function), and the write path itself is a single-row insert — Postgres will take that volume
without noticing.

I would confirm all of this rather than assume it: `EXPLAIN (ANALYZE, BUFFERS)` on the
analytics statement against a seeded few-million-row table, then a load test on
`POST /api/feedback`, before changing anything.

---

## 11. One thing I would improve, change or challenge in this assignment

**The brief names the artefact but not the decision it serves.** *"Our team can analyse trends
through a dashboard"* leaves the most design-relevant question open: who reads this, and what
do they do differently afterwards? A support lead clearing a queue and a product manager
choosing next quarter's roadmap want almost nothing in common — the first wants an inbox with
assignment and SLAs, the second wants themes over time and almost no per-item detail. I built
towards the second and added enough of the first (a triage status) to make the page a tool
rather than a report, and I flagged the assumption rather than quietly picking. One sentence
in the brief — *"the product team reviews this weekly to decide what to build next"* — would
make submissions genuinely comparable, and would let a candidate demonstrate product judgment
against a target instead of inventing one.

A smaller, related point: the reference screenshot says "do not replicate", but it is doing
more specification than the prose is. It anchors everyone to a KPI row, a donut, and a recent
list — I departed from the donut deliberately (six categories with similar values is exactly
where arc comparison fails, so bars with direct labels), but the image makes that a deviation
rather than a decision. Describing the reader and their decision, and dropping the picture,
would tell you more about how candidates think.

And to be fair about scope: production readiness plus six bonus items plus deployment plus
three documents is comfortably more than 6–10 hours if each is done properly. I would either
state which bonus items you actually weigh, or say explicitly that choosing what to cut — and
defending the cut — is part of the test. I read it as the latter, and §4 is my answer.
