# Acowale CRM — Machine Test by Kaaviyah Prakasam

A lightweight customer feedback platform: a public form anyone can submit through, and an
admin console for reading the trends in what comes back.

| | |
|---|---|
| **Live application** | `PENDING_DEPLOYMENT` — see [Deployment](#deployment) |
| **Admin console** | `PENDING_DEPLOYMENT/admin` |
| **Demo credentials** | shared in the submission email, not committed here |
| **Health check** | `PENDING_DEPLOYMENT/api/health` |
| **Stack** | Next.js 16 · TypeScript · Postgres (Neon) · Drizzle · Vercel |

---

## Run it locally

```bash
pnpm install
cp .env.example .env.local
pnpm db:migrate          # creates a local Postgres in ./.data — no Docker, no account
pnpm db:seed --demo      # categories + ~200 backdated submissions so the charts have shape
pnpm dev
```

Then open <http://localhost:3000>. The admin console is at `/admin`, and `.env.example`
ships with working development credentials (`admin@acowale.test` / `acowale-dev`).

There is no step where you sign up for anything. `DATABASE_URL=file:./.data/dev` runs
[PGlite](https://pglite.dev) — the real Postgres engine compiled to WebAssembly, running in
the Node process. Point `DATABASE_URL` at a `postgres://` URL and the same code talks to
Neon instead; the driver is chosen from the scheme in
[`src/server/db/client.ts`](src/server/db/client.ts).

```bash
pnpm test            # 109 tests: unit, plus integration against a real Postgres
pnpm typecheck
pnpm lint
pnpm smoke           # curl the API over HTTP (BASE_URL=… to point it at production)
pnpm hash-password 'a-new-password'
```

---

## What it does

**Public form** (`/`) — pick a category, optionally rate 1–5, write a comment, optionally
leave an email. Validation errors appear on the field that caused them. A honeypot field
and a fill-time check discard bot submissions without telling the bot why.

**Admin console** (`/admin`) — sign in, then:

- four headline numbers with period-over-period deltas
- submissions per day, with quiet days drawn as zero rather than skipped
- where feedback is coming from, by category, including categories nobody used
- the submission list: search, filter by category and status, page through it, and move
  items through triage (New → In progress → Resolved)

The period selector scopes the whole page. The category, status and search controls scope
the list only — the card header says so, so the numbers never appear to disagree.

---

## How it is put together

```
Browser
   │
   ├── page.tsx / admin/page.tsx ───────┐  server components call services directly:
   │                                    │  an in-process function call, not an HTTP
   │                                    │  request the server makes to itself
   ├── fetch() from client components    │
   │        │                            │
   │        ▼                            │
   │   app/api/**/route.ts ──────────────┤  thin HTTP adapters: parse, call, respond
   │        │                            │
   │        ▼                            ▼
   │   server/services/** ──────────────────  business rules. No Request, no Response,
   │        │                                 no status codes. Throws domain errors.
   │        ▼
   │   server/repos/** ─────────────────────  the only files that touch the database
   │        │
   │        ▼
   └── Postgres (Neon in production, PGlite locally and in tests)
```

Dependencies point one way: `app → services → repos`. Nothing under `server/services`,
`server/repos`, `server/lib` or `server/schemas` imports from `next`, which is what makes
the business logic testable without a server and liftable into a standalone service if the
API ever needs to move. The two files that legitimately need Next.js APIs live in
[`src/server/http/`](src/server/http/), so that boundary is visible in the file tree rather
than discovered later.

```
src/
├── app/
│   ├── page.tsx                 public feedback form
│   ├── login/                   admin sign-in
│   ├── admin/                   dashboard (layout enforces the session)
│   └── api/                     route handlers
├── components/                  form, charts, table, filters
├── lib/format.ts                presentation formatting, shared server + client
├── server/
│   ├── db/                      schema, driver selection, seed data
│   ├── schemas/                 Zod request contracts (+ limits.ts, dependency-free)
│   ├── repos/                   SQL
│   ├── services/                rules
│   ├── http/                    the deliberate Next.js-aware layer
│   └── lib/                     env, logger, errors, withApi, rate limit, session
├── proxy.ts                     redirects unauthenticated navigation (Next 16 renamed
│                                middleware → proxy)
└── instrumentation.ts           validates configuration at boot
drizzle/                         generated SQL migrations, committed
tests/                           unit + integration + page smoke tests
scripts/                         migrate, seed, hash-password, smoke
```

---

## API

Every error, from every endpoint, has the same shape — so a client needs one error path:

```jsonc
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Some fields need attention.",
    "requestId": "6f1c…",             // also returned as the x-request-id header
    "details": [{ "path": "comment", "message": "Please write at least 3 characters." }]
  }
}
```

| Method | Path | Auth | Purpose |
|---|---|---|---|
| `POST` | `/api/feedback` | public | Submit feedback. Rate limited: 5/min and 30/hour per IP |
| `GET` | `/api/categories` | public | Category list for the form. CDN-cached for 5 minutes |
| `GET` | `/api/feedback` | admin | List: `q`, `category`, `status`, `rating`, `from`, `to`, `page`, `pageSize`, `sort` |
| `PATCH` | `/api/feedback/:id` | admin | Change triage status |
| `GET` | `/api/analytics/summary` | admin | Dashboard payload: `range=7d\|30d\|90d\|all` |
| `POST` | `/api/auth/login` | public | Sign in. Rate limited: 10 per 15 minutes per IP |
| `POST` | `/api/auth/logout` | admin | Clear the session cookie |
| `GET` | `/api/auth/me` | admin | Current session |
| `GET` | `/api/health` | public | Liveness — no dependencies, 200 whenever the process serves |
| `GET` | `/api/health/ready` | public | Readiness — checks Postgres, **503** when it is unreachable |

Liveness and readiness are separate on purpose. A single health check that fails because
the database is down tells an orchestrator to replace a perfectly healthy instance, which
turns a database blip into an application outage.

```bash
# Submit
curl -sX POST "$BASE_URL/api/feedback" -H 'content-type: application/json' \
  -d '{"categorySlug":"feature_request","comment":"Please add a dark mode.","rating":4}'
# → 201 {"id":"…","createdAt":"…"}

# Rejected, with the reason attached to the field
curl -sX POST "$BASE_URL/api/feedback" -H 'content-type: application/json' -d '{}'
# → 422 {"error":{"code":"VALIDATION_ERROR","details":[…]}}

# Admin: sign in, keep the cookie, read the numbers
curl -sc jar -X POST "$BASE_URL/api/auth/login" -H 'content-type: application/json' \
  -d '{"email":"…","password":"…"}'
curl -sb jar "$BASE_URL/api/analytics/summary?range=30d"
```

---

## Data model

Three tables ([`src/server/db/schema.ts`](src/server/db/schema.ts)).

**`categories`** — a lookup table, not a hardcoded enum, so the product team can add
"Onboarding" or retire "Billing" without a deploy. `slug` is the API-facing key; numeric ids
never leave the server. Retiring a category blocks new submissions against it and leaves its
history intact.

**`feedback`** — `uuid` primary key, because a sequential id on a public form tells anyone
who submits twice how much feedback you receive in total. `rating` is nullable (a comment
with no stars is still signal), `comment` is required, `email` is optional. `status` is a
Postgres enum: `new` → `in_progress` → `resolved`.

No IP address or user-agent column. Rate limiting needs a request identity, not a permanent
record of one, so the durable table holds neither.

**`rate_limit_hits`** — `(bucket_key, window_start)` primary key, where `bucket_key` is
`sha256(ip + RATE_LIMIT_SALT)`. The table stores no recoverable addresses, and the salt is
what stops someone holding the table from hashing all four billion IPv4 addresses to check
whether a given one submitted.

Indexes exist per query the dashboard actually issues, including a GIN trigram index that
makes `comment ILIKE '%term%'` an index lookup instead of a full scan — without `pg_trgm`, a
leading-wildcard search is a guaranteed sequential scan.

---

## Production readiness

**Configuration.** Every variable is parsed through a Zod schema on first use and asserted
at boot from [`src/instrumentation.ts`](src/instrumentation.ts), so a missing
`SESSION_SECRET` is a startup failure with a readable message rather than a mystery at the
first sign-in. In production the app refuses to start if the `.env.example` placeholder
secrets are still in place.

| Variable | Required | Notes |
|---|---|---|
| `DATABASE_URL` | yes | `postgres://…` (Neon **pooled**) or `file:./.data/dev` |
| `DATABASE_URL_UNPOOLED` | migrations | Neon **direct** connection — a pooler can't hold the migration lock |
| `SESSION_SECRET` | yes | ≥ 32 chars. `openssl rand -base64 48`. Rotating it signs everyone out |
| `SESSION_TTL_HOURS` | no | Default 8 |
| `ADMIN_EMAIL` | yes | The single admin account |
| `ADMIN_PASSWORD_HASH` | yes | From `pnpm hash-password`. The plaintext is never stored |
| `RATE_LIMIT_SALT` | yes | ≥ 16 chars |
| `LOG_LEVEL` | no | Default `info`; `silent` in tests |
| `APP_VERSION` | no | Falls back to `VERCEL_GIT_COMMIT_SHA`, surfaced by `/api/health` |

**Errors.** [`withApi`](src/server/lib/with-api.ts) wraps every handler: a `ZodError`
becomes a 422 naming the offending fields, an `AppError` becomes its own status, and anything
unexpected becomes an opaque 500 with the stack trace in the logs and a request id in the
response. Stack traces never reach a client.

**Logging.** One JSON line per request to stdout, carrying `requestId`, `route`, `status`
and `durationMs`. `requestId` is reused from an inbound `x-request-id` when present, so a
trace survives across hops. Comment text and email addresses are redacted — logs are
replicated and widely readable, and shouldn't quietly become a second copy of user data.

**Validation.** One Zod schema per operation, shared by the API and the form, with `CHECK`
constraints in the database as the backstop. There is a test asserting the database rejects a
rating of 9 even when the API is bypassed entirely.

**Rate limiting.** A fixed-window counter in Postgres, one atomic
`INSERT … ON CONFLICT DO UPDATE`. An in-memory counter would be worse than useless here:
serverless instances share no memory, so it would under-count silently in production while
looking correct in development.

**Auth.** One admin, an scrypt hash in configuration, and a signed JWT in an
`HttpOnly; Secure; SameSite=Lax` cookie. `SameSite=Lax` means a cross-site `POST` or `PATCH`
never carries the cookie, which is what makes the admin mutations CSRF-safe without a
separate token. Verification pins `HS256`, because accepting whatever algorithm a token
claims is the classic JWT bypass — there's a test for that too.

**Tests.** 109 of them. The integration tests run the committed migrations into PGlite and
call the route handlers directly, so they cover validation, rate limiting, real SQL and error
translation without a server. Two of the more useful assertions: the trend chart's values sum
to the headline total, and searching for `100%` doesn't match every row.

---

## Deployment

Vercel for the app, Neon for Postgres, deployed from `main`.

1. **Neon** — create a project, then copy both connection strings. The **pooled** one is
   `DATABASE_URL`; the **direct** one is `DATABASE_URL_UNPOOLED`. Pick the region nearest the
   users (Singapore or Mumbai for an India-based team) — this is the one setting that cannot
   be changed later without recreating the project.
2. **Vercel** — import the repository, framework preset Next.js, and set every variable from
   the table above. Generate the secrets fresh:
   ```bash
   openssl rand -base64 48                 # SESSION_SECRET
   openssl rand -base64 24                 # RATE_LIMIT_SALT
   pnpm hash-password 'your-admin-password'
   ```
   Then set **Settings → Functions → Region** to match the database. The default is US East,
   and every request in this app makes at least one database round trip: with the function in
   Virginia and Postgres in Singapore, each of those costs ~200ms before Postgres does any
   work. Co-locating them is the single biggest latency win available here, and it is a
   dropdown.
3. **GitHub** — add `DATABASE_URL_UNPOOLED` as a repository secret so
   [`migrate.yml`](.github/workflows/migrate.yml) can apply migrations and seed the
   categories.
4. **Verify** — `BASE_URL=https://… ADMIN_EMAIL=… ADMIN_PASSWORD=… pnpm smoke`.

Migrations run as a deploy step, not a build step: a build can be retried, cancelled, or run
twice concurrently, and none of those are things you want happening to a schema change.

**Known gap, stated plainly:** Vercel's git integration starts building on push at the same
time the migration workflow runs, so the two race. Every migration here is additive, so the
race is harmless today. The stricter arrangement is to turn off automatic production deploys
and have the migration job call a Vercel deploy hook once it succeeds.

---

## Runbook

| Symptom | First thing to check |
|---|---|
| Site returns 500s | `/api/health` — if it's 200, the process is fine and it's a route or the database |
| Form submits fail, pages load | `/api/health/ready` — a 503 with `checks.database.ok: false` is Neon, not the app |
| "Something went wrong" on screen | The user's reference id — grep the logs for that `requestId` or `digest` |
| Sign-in fails for everyone | `ADMIN_PASSWORD_HASH` mangled in transit; it must start `scrypt:` and contain no `$` |
| App won't boot after a deploy | The startup log line names the failing variable |
| Legitimate users hit 429 | Several people behind one NAT share an IP; raise the limits in `RATE_LIMITS` |
| Dashboard numbers look stale | Nothing is cached — check the period filter, not the cache |

Logs are structured, so triage is filtering rather than reading:
`{"level":"warn","route":"POST /api/feedback","status":429,"requestId":"…"}`.

---

## How I got here

**Planned before typing.** The first output of this project was a plan: file structure,
schema, API surface, build order, and the risks I expected to hit. Two of the three risks I
wrote down did materialise (below), which paid for the half hour on its own.

**Deployed the skeleton early, on purpose.** Deployment is where the surprises live, so a
health-check endpoint went live before there was any feature code to blame for a broken
build.

**Read the framework's own docs instead of trusting recall.** Next.js 16 ships its
documentation inside the package and warns that its APIs have moved. They had:
`middleware.ts` is now `proxy.ts` and runs only on Node, `cookies()` and `params` are async,
and route contexts have generated types. Guessing from memory would have cost more than
reading did.

**Three things I hit, and where they led.**

1. *Node's `--env-file` silently truncated the admin password hash.* The conventional scrypt
   format is `$`-delimited, and Node's env-file parser expands `$VAR` inside double-quoted
   values, so `ADMIN_PASSWORD_HASH` arrived as the string `"scrypt"` and every login failed
   with no visible cause. Rather than fight the parser or ban quotes, the hash format now
   uses `:` — base64 never produces one, so it survives env files, shells and CI secret
   editors alike. There is a regression test asserting the hash contains no `$`.
2. *`pg_trgm` in the test database.* The plan flagged that PGlite might not support the
   trigram extension, which would have made the search index a production-only code path no
   test could reach. It ships as a loadable contrib module, so local, test and production now
   run byte-identical SQL.
3. *This build environment could not open a listening socket or reach
   `fonts.googleapis.com`.* Both pushed the solution somewhere better: verification runs by
   invoking route handlers and page components directly (fast, no server, and it covers error
   paths a browser click-through would miss), and the UI uses the system font stack — no
   build-time dependency on a third party, and no font download before first paint.

**What I would do next**, in order: unify the list filters into the analytics query so one
filter row scopes everything; keyset pagination to replace `OFFSET`; a `sessions` table so
signing out can revoke; a strict CSP with nonces; and Sentry, so a 500 pages someone instead
of waiting to be noticed.

Full reasoning, trade-offs, and what breaks at 100,000 users: **[DECISIONS.md](DECISIONS.md)**.
One idea I think is worth stealing: **[TEACH_US.md](TEACH_US.md)**.
