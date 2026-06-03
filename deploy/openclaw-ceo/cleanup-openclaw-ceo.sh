#!/usr/bin/env bash
set -euo pipefail

ENV_FILE="${OPENCLAW_ENV_FILE:-/home/adncapital/secrets/openclaw-ceo.env}"
if [ -f "$ENV_FILE" ]; then
  set -a
  # shellcheck disable=SC1090
  . "$ENV_FILE"
  set +a
fi

OPENCLAW_PROJECT_DIR="${OPENCLAW_PROJECT_DIR:-/opt/openclaw-ceo}"

find "$OPENCLAW_PROJECT_DIR/logs" -type f -mtime +14 -delete 2>/dev/null || true
find "$OPENCLAW_PROJECT_DIR/workspace" -type f -path "*/tmp/*" -mtime +3 -delete 2>/dev/null || true
find "$OPENCLAW_PROJECT_DIR/workspace" -type f -path "*/cache/*" -mtime +7 -delete 2>/dev/null || true
find "$OPENCLAW_PROJECT_DIR/setup-state" -type f -path "*/tmp/*" -mtime +3 -delete 2>/dev/null || true
find "$OPENCLAW_PROJECT_DIR/setup-state" -type f -path "*/cache/*" -mtime +7 -delete 2>/dev/null || true

if command -v docker >/dev/null; then
  docker image prune -f --filter "until=24h" >/dev/null || true
fi

echo "OpenClaw cleanup finished."
