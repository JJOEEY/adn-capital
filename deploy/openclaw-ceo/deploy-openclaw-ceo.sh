#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_DIR="$(cd "$SCRIPT_DIR/../.." && pwd)"
ENV_FILE="${OPENCLAW_ENV_FILE:-/home/adncapital/secrets/openclaw-ceo.env}"

if [ ! -f "$ENV_FILE" ]; then
  echo "Missing env file: $ENV_FILE" >&2
  exit 2
fi

set -a
# shellcheck disable=SC1090
. "$ENV_FILE"
set +a

cd "$REPO_DIR"

if [ -n "$(git status --short)" ]; then
  echo "Deploy refused: worktree is dirty. Commit/stash OpenClaw deploy changes first." >&2
  git status --short
  exit 3
fi

echo "Preflight Telegram bot..."
OPENCLAW_ENV_FILE="$ENV_FILE" node "$SCRIPT_DIR/preflight-getme.mjs"

command -v node >/dev/null || { echo "node is required" >&2; exit 4; }
command -v npm >/dev/null || { echo "npm is required" >&2; exit 4; }

if ! command -v pm2 >/dev/null; then
  echo "Installing pm2 globally..."
  npm install -g pm2
fi

if ! command -v 9router >/dev/null; then
  echo "Installing 9router globally..."
  npm install -g 9router
fi

if ! command -v openclaw >/dev/null; then
  echo "Installing openclaw globally..."
  npm install -g openclaw
fi

npm --prefix "$REPO_DIR/vendor/openclaw-setup" install --omit=dev

pm2_start_or_restart() {
  local name="$1"
  local command="$2"
  shift 2
  if pm2 describe "$name" >/dev/null 2>&1; then
    pm2 delete "$name" >/dev/null
  fi
  pm2 start "$command" --name "$name" -- "$@"
}

NINE_ROUTER_PORT="${NINE_ROUTER_PORT:-20128}"
OPENCLAW_SETUP_PORT="${OPENCLAW_SETUP_PORT:-51789}"
OPENCLAW_PROJECT_DIR="${OPENCLAW_PROJECT_DIR:-/home/adncapital/openclaw-ceo-agent}"
OPENCLAW_CEO_COMMAND="${OPENCLAW_CEO_COMMAND:-node /opt/openclaw-ceo/release/openclaw.mjs --profile adn-ceo gateway run --bind lan --port 18790 --verbose}"

case "$OPENCLAW_CEO_COMMAND" in
  *" doctor "*|*" doctor")
    echo "Deploy refused: OPENCLAW_CEO_COMMAND must be a persistent gateway runner, not a doctor check." >&2
    exit 5
    ;;
esac

mkdir -p "$OPENCLAW_PROJECT_DIR"

echo "Starting adn-9router..."
pm2_start_or_restart adn-9router "$(command -v 9router)" -n 0.0.0.0 -p "$NINE_ROUTER_PORT"

echo "Starting adn-openclaw-setup..."
pm2_start_or_restart adn-openclaw-setup npm --prefix "$REPO_DIR/vendor/openclaw-setup" start -- --no-open --host=0.0.0.0 --port="$OPENCLAW_SETUP_PORT" --project-dir="$OPENCLAW_PROJECT_DIR"

echo "Starting adn-openclaw-ceo..."
pm2_start_or_restart adn-openclaw-ceo bash -lc "$OPENCLAW_CEO_COMMAND"

pm2 save

echo "Smoke..."
bash "$SCRIPT_DIR/smoke-openclaw-ceo.sh"

echo "Deploy done."
