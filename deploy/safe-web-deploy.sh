#!/usr/bin/env bash
set -euo pipefail

APP_DIR="${APP_DIR:-/home/adncapital/app/adn-capital}"
BRANCH="${BRANCH:-master}"
RUN_PRECHECK="${RUN_PRECHECK:-1}"
RUN_SMOKE="${RUN_SMOKE:-1}"
RUN_MIGRATIONS="${RUN_MIGRATIONS:-1}"
ALLOW_UNHEALTHY_BASELINE="${ALLOW_UNHEALTHY_BASELINE:-0}"
ALLOW_STALE_CRON="${ALLOW_STALE_CRON:-0}"
PREV_REF_FILE="${PREV_REF_FILE:-.deploy_prev_ref}"
PREV_IMAGE_FILE="${PREV_IMAGE_FILE:-.deploy_prev_image}"

if command -v docker-compose >/dev/null 2>&1; then
  COMPOSE_BIN="docker-compose"
else
  COMPOSE_BIN="docker compose"
fi

echo "[safe-deploy] app dir: ${APP_DIR}"
echo "[safe-deploy] compose: ${COMPOSE_BIN}"
echo "[safe-deploy] target branch: ${BRANCH}"

cd "${APP_DIR}"
PREV_REF="$(git rev-parse HEAD)"
echo "${PREV_REF}" > "${PREV_REF_FILE}"
echo "[safe-deploy] captured rollback ref: ${PREV_REF} -> ${PREV_REF_FILE}"
if ${COMPOSE_BIN} ps -q web >/dev/null 2>&1; then
  WEB_CID="$(${COMPOSE_BIN} ps -q web || true)"
  if [[ -n "${WEB_CID}" ]]; then
    PREV_IMAGE_ID="$(docker inspect -f '{{.Image}}' "${WEB_CID}" 2>/dev/null || true)"
    if [[ -n "${PREV_IMAGE_ID}" ]]; then
      echo "${PREV_IMAGE_ID}" > "${PREV_IMAGE_FILE}"
      echo "[safe-deploy] captured running web image id: ${PREV_IMAGE_ID} -> ${PREV_IMAGE_FILE}"
    fi
  fi
fi

git fetch origin "${BRANCH}"
git checkout "${BRANCH}"
git pull --ff-only origin "${BRANCH}"
[[ -f deploy/predeploy-check.sh ]] || { echo "[safe-deploy] missing deploy/predeploy-check.sh"; exit 1; }
[[ -f deploy/postdeploy-smoke.sh ]] || { echo "[safe-deploy] missing deploy/postdeploy-smoke.sh"; exit 1; }

# Ensure guide image storage exists and is writable before web container starts.
mkdir -p ./app_data/guides
chmod 775 ./app_data ./app_data/guides || true

if [[ "${RUN_PRECHECK}" == "1" ]]; then
  ALLOW_UNHEALTHY_BASELINE="${ALLOW_UNHEALTHY_BASELINE}" bash deploy/predeploy-check.sh
fi

# Guardrail: web-only deploy, never down the full stack.
${COMPOSE_BIN} build --no-cache web

if [[ "${RUN_MIGRATIONS}" == "1" ]]; then
  echo "[safe-deploy] running prisma migrate deploy (web-only)"
  ${COMPOSE_BIN} run --rm web npx prisma migrate deploy
fi

${COMPOSE_BIN} up -d web

if [[ "${RUN_SMOKE}" == "1" ]]; then
  ALLOW_STALE_CRON="${ALLOW_STALE_CRON}" bash deploy/postdeploy-smoke.sh
fi

echo "[safe-deploy] done"
