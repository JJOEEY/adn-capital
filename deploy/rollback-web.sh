#!/usr/bin/env bash
set -euo pipefail

APP_DIR="${APP_DIR:-/home/adncapital/app/adn-capital}"
TARGET_REF="${1:-}"
RUN_SMOKE="${RUN_SMOKE:-1}"
PREV_REF_FILE="${PREV_REF_FILE:-.deploy_prev_ref}"
RETURN_TO_BRANCH="${RETURN_TO_BRANCH:-1}"

log() { printf '[rollback] %s\n' "$*"; }
pass() { printf '[rollback][PASS] %s\n' "$*"; }
fail() { printf '[rollback][FAIL] %s\n' "$*" >&2; exit 1; }

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

COMPOSE_BIN="$(detect_compose)"
cd "${APP_DIR}" || fail "Cannot cd to ${APP_DIR}"

CURRENT_REF="$(git rev-parse --short HEAD)"
CURRENT_BRANCH="$(git symbolic-ref --short -q HEAD || true)"
[[ -n "${CURRENT_BRANCH}" ]] || CURRENT_BRANCH=""

if [[ -z "${TARGET_REF}" && -f "${PREV_REF_FILE}" ]]; then
  TARGET_REF="$(cat "${PREV_REF_FILE}" | tr -d '[:space:]')"
fi
[[ -n "${TARGET_REF}" ]] || fail "Usage: bash deploy/rollback-web.sh <git-ref> (or provide ${PREV_REF_FILE})"

log "Current branch/ref: ${CURRENT_BRANCH} (${CURRENT_REF})"
log "Rollback target ref: ${TARGET_REF}"

git fetch --all --tags
git rev-parse --verify "${TARGET_REF}^{commit}" >/dev/null 2>&1 || fail "Invalid rollback ref: ${TARGET_REF}"

git checkout --detach "${TARGET_REF}"
pass "Checked out rollback ref ${TARGET_REF}"

${COMPOSE_BIN} build --no-cache web
${COMPOSE_BIN} up -d web
pass "Rebuilt and restarted web service at rollback ref"

if [[ "${RUN_SMOKE}" == "1" ]]; then
  bash deploy/postdeploy-smoke.sh
fi

if [[ "${RETURN_TO_BRANCH}" == "1" && -n "${CURRENT_BRANCH}" ]]; then
  git checkout "${CURRENT_BRANCH}" >/dev/null 2>&1 || true
  pass "Checked out original branch: ${CURRENT_BRANCH}"
fi

pass "Rollback completed without touching db service"
