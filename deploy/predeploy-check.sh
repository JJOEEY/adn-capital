#!/usr/bin/env bash
set -euo pipefail

APP_DIR="${APP_DIR:-/home/adncapital/app/adn-capital}"
BRANCH="${BRANCH:-master}"
MIN_DISK_MB="${MIN_DISK_MB:-2048}"
ALLOW_UNHEALTHY_BASELINE="${ALLOW_UNHEALTHY_BASELINE:-0}"
MOCK_MODE="${MOCK_MODE:-0}"

log() { printf '[precheck] %s\n' "$*"; }
pass() { printf '[precheck][PASS] %s\n' "$*"; }
warn() { printf '[precheck][WARN] %s\n' "$*"; }
fail() { printf '[precheck][FAIL] %s\n' "$*" >&2; exit 1; }

require_cmd() {
  command -v "$1" >/dev/null 2>&1 || fail "Missing required command: $1"
}

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

require_cmd git
require_cmd grep
require_cmd awk
require_cmd sed
require_cmd curl
if [[ "${MOCK_MODE}" != "1" ]]; then
  require_cmd docker
fi

COMPOSE_BIN=""
if [[ "${MOCK_MODE}" != "1" ]]; then
  COMPOSE_BIN="$(detect_compose)"
fi

log "App dir: ${APP_DIR}"
log "Branch target: ${BRANCH}"
if [[ "${MOCK_MODE}" == "1" ]]; then
  log "Compose binary: MOCK_MODE=1 (runtime checks skipped)"
else
  log "Compose binary: ${COMPOSE_BIN}"
fi

cd "${APP_DIR}" || fail "Cannot cd to ${APP_DIR}"

[[ -f docker-compose.yml ]] || fail "docker-compose.yml is missing"
ENV_FILE=".env"
if [[ ! -f "${ENV_FILE}" ]]; then
  if [[ "${MOCK_MODE}" == "1" && -f .env.example ]]; then
    ENV_FILE=".env.example"
    warn ".env is missing, using .env.example in MOCK_MODE"
  else
    fail ".env is missing"
  fi
fi
[[ -f prisma/schema.prisma ]] || fail "prisma/schema.prisma is missing"

CURRENT_BRANCH="$(git rev-parse --abbrev-ref HEAD)"
CURRENT_COMMIT="$(git rev-parse --short HEAD)"
pass "Current branch: ${CURRENT_BRANCH} (${CURRENT_COMMIT})"

if [[ "${CURRENT_BRANCH}" != "${BRANCH}" ]]; then
  warn "Current branch (${CURRENT_BRANCH}) differs from target (${BRANCH})"
fi

ENV_CONTRACT_FILE="${ENV_FILE}"
if [[ "${MOCK_MODE}" == "1" ]] && ! grep -Eq '^PYTHON_BRIDGE_URL=' "${ENV_CONTRACT_FILE}" && [[ -f .env.example ]]; then
  ENV_CONTRACT_FILE=".env.example"
  warn "Using .env.example for env contract checks in MOCK_MODE"
fi

if ! grep -Eq '^PYTHON_BRIDGE_URL="?http://fiinquant:8000"?$|^PYTHON_BRIDGE_URL="?https?://.+"?$' "${ENV_CONTRACT_FILE}"; then
  fail "PYTHON_BRIDGE_URL is missing or invalid in ${ENV_CONTRACT_FILE}"
fi
pass "PYTHON_BRIDGE_URL is present"

DB_URL_LINE="$(grep -E '^DATABASE_URL=' "${ENV_CONTRACT_FILE}" || true)"
DIRECT_DB_URL_LINE="$(grep -E '^DIRECT_DATABASE_URL=' "${ENV_CONTRACT_FILE}" || true)"
[[ -n "${DB_URL_LINE}" ]] || fail "DATABASE_URL is missing in .env"
[[ -n "${DIRECT_DB_URL_LINE}" ]] || fail "DIRECT_DATABASE_URL is missing in .env"
grep -q '@pgbouncer:5432' <<<"${DB_URL_LINE}" || fail "DATABASE_URL must point to @pgbouncer:5432"
grep -q '@db:5432' <<<"${DIRECT_DB_URL_LINE}" || fail "DIRECT_DATABASE_URL must point to @db:5432"
pass "DB URL contract is valid"

if [[ "${MOCK_MODE}" == "1" ]]; then
  for svc in web db pgbouncer fiinquant; do
    grep -q "^  ${svc}:" docker-compose.yml || fail "Missing compose service declaration: ${svc}"
  done
  pass "Compose service declarations found (MOCK_MODE)"
else
  SERVICES="$(${COMPOSE_BIN} config --services 2>/dev/null || true)"
  [[ -n "${SERVICES}" ]] || fail "Cannot list docker compose services"
  for svc in web db pgbouncer fiinquant; do
    grep -qx "${svc}" <<<"${SERVICES}" || fail "Missing compose service: ${svc}"
  done
  pass "Compose services are present: web/db/pgbouncer/fiinquant"

  ${COMPOSE_BIN} config -q >/dev/null || fail "docker compose config is invalid"
  pass "Compose config validation passed"
fi

[[ -f Dockerfile ]] || fail "Dockerfile is missing"
[[ -f package.json ]] || fail "package.json is missing"
[[ -d prisma/migrations ]] || warn "prisma/migrations is missing (no migration history folder)"
pass "Build prerequisites found"

if [[ "${MOCK_MODE}" == "1" ]]; then
  if [[ -d ./app_data/guides && -w ./app_data/guides ]]; then
    pass "Guide storage exists and is writable"
  else
    warn "Guide storage check skipped in MOCK_MODE (app_data/guides missing or not writable)"
  fi
else
  [[ -d ./app_data ]] || fail "./app_data is missing"
  [[ -d ./app_data/guides ]] || fail "./app_data/guides is missing"
  [[ -w ./app_data/guides ]] || fail "./app_data/guides is not writable"
  pass "Guide storage exists and is writable"
fi

AVAIL_KB="$(df -Pk "${APP_DIR}" | awk 'NR==2 {print $4}')"
[[ -n "${AVAIL_KB}" ]] || fail "Cannot read disk availability"
AVAIL_MB="$((AVAIL_KB / 1024))"
if (( AVAIL_MB < MIN_DISK_MB )); then
  fail "Insufficient disk space: ${AVAIL_MB}MB available, requires >= ${MIN_DISK_MB}MB"
fi
pass "Disk space OK: ${AVAIL_MB}MB"

if [[ "${MOCK_MODE}" == "1" ]]; then
  warn "Skipping runtime /api/health baseline check in MOCK_MODE"
else
  if curl -fsS "http://127.0.0.1:3000/api/health" >/dev/null; then
    pass "Baseline /api/health is reachable"
  else
    if [[ "${ALLOW_UNHEALTHY_BASELINE}" == "1" ]]; then
      warn "Baseline /api/health is not reachable (ignored by ALLOW_UNHEALTHY_BASELINE=1)"
    else
      fail "Baseline /api/health is not reachable"
    fi
  fi
fi

if [[ "${MOCK_MODE}" == "1" ]]; then
  warn "Skipping prisma migrate status against live DB in MOCK_MODE"
else
  MIGRATION_STATUS_RAW="$(${COMPOSE_BIN} exec -T web npx prisma migrate status --schema prisma/schema.prisma 2>&1 || true)"
  if grep -qi "Database schema is up to date" <<<"${MIGRATION_STATUS_RAW}"; then
    pass "Prisma migration status: up to date"
  elif grep -qi "following migration" <<<"${MIGRATION_STATUS_RAW}"; then
    warn "Prisma migrate status indicates pending migration(s). Run prisma migrate deploy during deploy."
  else
    warn "Could not conclusively verify prisma migrate status via running web container"
  fi
fi

pass "Predeploy checks completed"
