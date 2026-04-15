#!/usr/bin/env bash
set -euo pipefail

APP_DIR="${APP_DIR:-/home/adncapital/app/adn-capital}"
BRANCH="${BRANCH:-master}"

if command -v docker-compose >/dev/null 2>&1; then
  COMPOSE_BIN="docker-compose"
else
  COMPOSE_BIN="docker compose"
fi

echo "[safe-deploy] app dir: ${APP_DIR}"
echo "[safe-deploy] compose: ${COMPOSE_BIN}"

cd "${APP_DIR}"
git pull origin "${BRANCH}"

# Guardrail: web-only deploy, never down the full stack.
${COMPOSE_BIN} build --no-cache web
${COMPOSE_BIN} up -d web

echo "[safe-deploy] post-deploy checks..."
${COMPOSE_BIN} exec -T web env | grep -E '^DATABASE_URL=' | grep '@pgbouncer:5432'
${COMPOSE_BIN} exec -T web env | grep -E '^DIRECT_DATABASE_URL=' | grep '@db:5432'
${COMPOSE_BIN} exec -T db psql -U adnuser -d adncapital -c 'SELECT COUNT(*) FROM "User";'

echo "[safe-deploy] done"
