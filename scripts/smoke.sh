#!/usr/bin/env bash
#
# Contract smoke test.
#
# Checks the API's observable behaviour over real HTTP — the one thing the Vitest
# suite cannot cover, because those tests call the route handlers directly and never
# exercise routing, the proxy, headers set by the platform, or the deployed
# configuration.
#
#   pnpm smoke                                  # against http://localhost:3000
#   BASE_URL=https://your-app.vercel.app pnpm smoke
#
# Set ADMIN_EMAIL and ADMIN_PASSWORD to also verify the authenticated endpoints:
#   BASE_URL=… ADMIN_EMAIL=… ADMIN_PASSWORD=… pnpm smoke
#
# Note: this submits one real piece of feedback, tagged so it is identifiable in the
# dashboard. Run it against production knowingly.

set -euo pipefail

BASE_URL="${BASE_URL:-http://localhost:3000}"
COOKIE_JAR="$(mktemp)"
BODY_FILE="$(mktemp)"
trap 'rm -f "$COOKIE_JAR" "$BODY_FILE"' EXIT

passed=0
failed=0

# Colours only when attached to a terminal, so CI logs stay readable.
if [ -t 1 ]; then
  GREEN=$'\033[0;32m'; RED=$'\033[0;31m'; DIM=$'\033[2m'; RESET=$'\033[0m'
else
  GREEN=''; RED=''; DIM=''; RESET=''
fi

# request METHOD PATH [DATA] → prints status code, body lands in $BODY_FILE
request() {
  local method="$1" path="$2" data="${3:-}"
  local args=(-sS -o "$BODY_FILE" -w '%{http_code}' -X "$method"
              -b "$COOKIE_JAR" -c "$COOKIE_JAR" "${BASE_URL}${path}")
  if [ -n "$data" ]; then
    args+=(-H 'content-type: application/json' -d "$data")
  fi
  curl "${args[@]}"
}

check() {
  local label="$1" expected="$2" actual="$3"
  if [ "$actual" = "$expected" ]; then
    printf '  %s✓%s %s %s(%s)%s\n' "$GREEN" "$RESET" "$label" "$DIM" "$actual" "$RESET"
    passed=$((passed + 1))
  else
    printf '  %s✗%s %s — expected %s, got %s\n' "$RED" "$RESET" "$label" "$expected" "$actual"
    printf '    %s%s%s\n' "$DIM" "$(head -c 300 "$BODY_FILE")" "$RESET"
    failed=$((failed + 1))
  fi
}

# contains LABEL NEEDLE — asserts the last response body contains NEEDLE
contains() {
  local label="$1" needle="$2"
  if grep -q "$needle" "$BODY_FILE"; then
    printf '  %s✓%s %s\n' "$GREEN" "$RESET" "$label"
    passed=$((passed + 1))
  else
    printf '  %s✗%s %s — %s not found in response\n' "$RED" "$RESET" "$label" "$needle"
    printf '    %s%s%s\n' "$DIM" "$(head -c 300 "$BODY_FILE")" "$RESET"
    failed=$((failed + 1))
  fi
}

printf '\nSmoke testing %s\n\n' "$BASE_URL"

printf 'Health\n'
check 'liveness responds' 200 "$(request GET /api/health)"
contains 'reports a version' '"version"'
check 'readiness responds' 200 "$(request GET /api/health/ready)"
contains 'database is reachable' '"ok":true'

printf '\nPublic endpoints\n'
check 'categories are listed' 200 "$(request GET /api/categories)"
contains 'includes a category slug' '"slug"'

check 'a valid submission is accepted' 201 \
  "$(request POST /api/feedback \
    '{"categorySlug":"other","comment":"Smoke test submission from scripts/smoke.sh — safe to resolve.","rating":5}')"
contains 'returns the new id' '"id"'

check 'an empty submission is rejected' 422 "$(request POST /api/feedback '{}')"
contains 'names the offending fields' '"details"'
check 'malformed JSON is rejected' 422 "$(request POST /api/feedback '{"broken":')"
check 'an unknown category is rejected' 422 \
  "$(request POST /api/feedback '{"categorySlug":"nope","comment":"Unknown category test."}')"

printf '\nAuthorisation\n'
check 'feedback list requires a session' 401 "$(request GET /api/feedback)"
check 'analytics requires a session' 401 "$(request GET /api/analytics/summary)"
check 'wrong credentials are refused' 401 \
  "$(request POST /api/auth/login '{"email":"nobody@example.com","password":"definitely-wrong"}')"

if [ -n "${ADMIN_EMAIL:-}" ] && [ -n "${ADMIN_PASSWORD:-}" ]; then
  printf '\nAuthenticated flow\n'
  login_payload=$(printf '{"email":"%s","password":"%s"}' "$ADMIN_EMAIL" "$ADMIN_PASSWORD")
  check 'sign in succeeds' 200 "$(request POST /api/auth/login "$login_payload")"

  check 'feedback list is readable' 200 "$(request GET '/api/feedback?pageSize=5')"
  contains 'returns a total' '"total"'
  check 'search is accepted' 200 "$(request GET '/api/feedback?q=smoke')"
  check 'analytics is readable' 200 "$(request GET '/api/analytics/summary?range=30d')"
  contains 'includes a trend series' '"trend"'
  contains 'includes per-category counts' '"byCategory"'
  check 'an invalid range is rejected' 422 "$(request GET '/api/analytics/summary?range=5y')"

  check 'sign out succeeds' 204 "$(request POST /api/auth/logout)"
  check 'the session is gone' 401 "$(request GET /api/feedback)"
else
  printf '\n%sSkipping authenticated checks — set ADMIN_EMAIL and ADMIN_PASSWORD to include them.%s\n' \
    "$DIM" "$RESET"
fi

printf '\n%d passed, %d failed\n\n' "$passed" "$failed"
[ "$failed" -eq 0 ]
