#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ENV_FILE="${OPENCLAW_ENV_FILE:-/home/adncapital/secrets/openclaw-ceo.env}"

if [ -f "$ENV_FILE" ]; then
  set -a
  # shellcheck disable=SC1090
  . "$ENV_FILE"
  set +a
fi

OPENCLAW_ENV_FILE="$ENV_FILE" node "$SCRIPT_DIR/preflight-getme.mjs"

require_pm2() {
  local name="$1"
  if ! pm2 describe "$name" >/dev/null 2>&1; then
    echo "Missing PM2 process: $name" >&2
    exit 10
  fi
}

require_pm2 adn-9router
require_pm2 adn-openclaw-setup
require_pm2 adn-openclaw-ceo

curl_quiet() {
  local url="$1"
  curl -fsS --max-time 8 "$url" >/dev/null
}

curl_quiet "${NINE_ROUTER_HEALTH_URL:-http://127.0.0.1:20128/}" || echo "Warning: 9Router HTTP smoke failed"
curl_quiet "${OPENCLAW_SETUP_HEALTH_URL:-http://127.0.0.1:51789/}" || echo "Warning: OpenClaw setup dashboard smoke failed"
curl_quiet "${OPENCLAW_HEALTH_URL:-http://127.0.0.1:18789/health}" || echo "Warning: OpenClaw gateway health smoke failed"

if [ -n "${TELEGRAM_SMOKE_CHAT_ID:-}" ] && [ -n "${TELEGRAM_BOT_TOKEN:-}" ]; then
  curl -fsS --max-time 10 \
    "https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage" \
    -d "chat_id=${TELEGRAM_SMOKE_CHAT_ID}" \
    -d "text=OpenClaw @adnn8n_bot smoke ok" >/dev/null
fi

echo "OpenClaw CEO smoke finished."
