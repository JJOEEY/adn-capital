#!/usr/bin/env bash
set -euo pipefail

APP_DIR="${APP_DIR:-/home/adncapital/app/adn-capital}"
STALE_SECONDS="${STALE_SECONDS:-259200}"
ALLOW_STALE_CRON="${ALLOW_STALE_CRON:-0}"
MOCK_MODE="${MOCK_MODE:-0}"

log() { printf '[smoke] %s\n' "$*"; }
pass() { printf '[smoke][PASS] %s\n' "$*"; }
warn() { printf '[smoke][WARN] %s\n' "$*"; }
fail() { printf '[smoke][FAIL] %s\n' "$*" >&2; exit 1; }

detect_compose() {
  if command -v docker-compose >/dev/null 2>&1; then
    echo "docker-compose"
    return
  fi
  if command -v docker >/dev/null 2>&1 && docker compose version >/dev/null 2>&1; then
    echo "docker compose"
    return
  fi
  fail "Neither docker-compose nor docker compose is available"
}

assert_http_not_5xx() {
  local url="$1"
  local code
  code="$(curl -sS -o /dev/null -w '%{http_code}' "${url}" || true)"
  [[ -n "${code}" ]] || fail "No HTTP status for ${url}"
  if [[ "${code}" =~ ^5[0-9][0-9]$ || "${code}" == "000" ]]; then
    fail "Endpoint returned ${code}: ${url}"
  fi
  pass "Endpoint healthy (${code}): ${url}"
}

cd "${APP_DIR}" || fail "Cannot cd to ${APP_DIR}"

log "App dir: ${APP_DIR}"
if [[ "${MOCK_MODE}" == "1" ]]; then
  warn "Running in MOCK_MODE=1 (runtime/container checks are skipped)"
else
  COMPOSE_BIN="$(detect_compose)"
  log "Compose binary: ${COMPOSE_BIN}"
fi

if [[ "${MOCK_MODE}" == "1" ]]; then
  [[ -f src/app/api/health/route.ts ]] || fail "Missing health route file"
  [[ -f src/app/api/hub/topics/route.ts ]] || fail "Missing hub topics route file"
  [[ -f src/app/api/hub/invalidate/route.ts ]] || fail "Missing hub invalidate route file"
  grep -q 'signal_scan_type1' docs/ops/SOURCE_OF_TRUTH.md || fail "Canonical cron contract missing in source-of-truth doc"
  pass "Mock smoke checks completed"
  exit 0
fi

HEALTH_RAW="$(curl -fsS http://127.0.0.1:3000/api/health || true)"
[[ -n "${HEALTH_RAW}" ]] || fail "/api/health did not return data"
grep -q '"status":"ok"' <<<"${HEALTH_RAW}" || fail "/api/health status is not ok"
pass "/api/health returns status ok"

WEB_ENV="$(${COMPOSE_BIN} exec -T web env)"
grep -q '^DATABASE_URL=' <<<"${WEB_ENV}" || fail "DATABASE_URL not found in web container env"
grep -q '^DIRECT_DATABASE_URL=' <<<"${WEB_ENV}" || fail "DIRECT_DATABASE_URL not found in web container env"
grep -q '@pgbouncer:5432' <<<"${WEB_ENV}" || fail "DATABASE_URL does not point to pgbouncer"
grep -q '@db:5432' <<<"${WEB_ENV}" || fail "DIRECT_DATABASE_URL does not point to db"
pass "Container DB env contract is valid"

USER_COUNT="$(${COMPOSE_BIN} exec -T db psql -U adnuser -d adncapital -t -A -c 'SELECT COUNT(*) FROM "User";' | tr -d '[:space:]')"
[[ "${USER_COUNT}" =~ ^[0-9]+$ ]] || fail "User count query failed"
if (( USER_COUNT <= 0 )); then
  fail "User count is 0"
fi
pass "User count > 0 (${USER_COUNT})"

assert_http_not_5xx "http://127.0.0.1:3000/"
assert_http_not_5xx "http://127.0.0.1:3000/dashboard"
assert_http_not_5xx "http://127.0.0.1:3000/terminal"
assert_http_not_5xx "http://127.0.0.1:3000/hdsd"

HUB_TOPICS_CODE="$(curl -sS -o /tmp/hub_topics_get.json -w '%{http_code}' http://127.0.0.1:3000/api/hub/topics || true)"
[[ "${HUB_TOPICS_CODE}" == "200" ]] || fail "GET /api/hub/topics returned ${HUB_TOPICS_CODE}"
pass "GET /api/hub/topics returned 200"

HUB_BATCH_CODE="$(curl -sS -o /tmp/hub_topics_post.json -w '%{http_code}' -X POST http://127.0.0.1:3000/api/hub/topics -H 'Content-Type: application/json' --data '{"topics":["vn:index:overview","news:morning:latest"]}' || true)"
[[ "${HUB_BATCH_CODE}" == "200" ]] || fail "POST /api/hub/topics returned ${HUB_BATCH_CODE}"
pass "POST /api/hub/topics returned 200"

CRON_AGES_RAW="$(${COMPOSE_BIN} exec -T db psql -U adnuser -d adncapital -t -A -F '|' -c "SELECT \"cronName\", FLOOR(EXTRACT(EPOCH FROM (NOW() - MAX(\"createdAt\"))))::int AS age_sec FROM \"CronLog\" WHERE \"cronName\" IN ('signal_scan_type1','market_stats_type2','morning_brief','close_brief_15h','eod_full_19h') GROUP BY \"cronName\";")"

for cron_name in signal_scan_type1 market_stats_type2 morning_brief close_brief_15h eod_full_19h; do
  age="$(awk -F'|' -v n="${cron_name}" '$1==n {print $2}' <<<"${CRON_AGES_RAW}" | head -n1 | tr -d '[:space:]')"
  if [[ -z "${age}" ]]; then
    if [[ "${ALLOW_STALE_CRON}" == "1" ]]; then
      warn "No CronLog row found for ${cron_name} (ignored by ALLOW_STALE_CRON=1)"
      continue
    fi
    fail "No CronLog row found for ${cron_name}"
  fi
  if [[ ! "${age}" =~ ^[0-9]+$ ]]; then
    fail "Invalid cron age for ${cron_name}: ${age}"
  fi
  if (( age > STALE_SECONDS )); then
    if [[ "${ALLOW_STALE_CRON}" == "1" ]]; then
      warn "Cron ${cron_name} stale (${age}s) ignored by ALLOW_STALE_CRON=1"
    else
      fail "Cron ${cron_name} stale (${age}s > ${STALE_SECONDS}s)"
    fi
  else
    pass "Cron ${cron_name} freshness OK (${age}s)"
  fi
done

pass "Postdeploy smoke checks completed"
