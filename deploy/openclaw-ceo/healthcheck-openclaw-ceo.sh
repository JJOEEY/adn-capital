#!/usr/bin/env bash
set -euo pipefail

ENV_FILE="${OPENCLAW_ENV_FILE:-/home/adncapital/secrets/openclaw-ceo.env}"
if [ -f "$ENV_FILE" ]; then
  set -a
  # shellcheck disable=SC1090
  . "$ENV_FILE"
  set +a
fi

STATE_DIR="${OPENCLAW_STATE_DIR:-/var/tmp/adn-openclaw-ceo}"
mkdir -p "$STATE_DIR"
LAST_RESTART_FILE="$STATE_DIR/last_restart_at"

curl_check() {
  local name="$1"
  local url="$2"
  if ! curl -fsS --max-time 8 "$url" >/dev/null; then
    echo "WARN $name health failed: $url"
  fi
}

curl_check "web" "${ADN_WEB_HEALTH_URL:-http://127.0.0.1:3000/api/health}"

free_gb="$(df -BG / | awk 'NR==2 {gsub("G","",$4); print $4}')"
min_free="${OPENCLAW_MIN_FREE_DISK_GB:-5}"
if [ "${free_gb:-0}" -lt "$min_free" ]; then
  echo "WARN low disk: ${free_gb}GB free"
fi

if ! command -v docker >/dev/null; then
  echo "WARN docker not found"
  exit 0
fi

check_container() {
  local name="$1"
  if ! docker inspect "$name" >/dev/null 2>&1; then
    echo "WARN missing container: $name"
    return 1
  fi
  local running
  running="$(docker inspect -f '{{.State.Running}}' "$name" 2>/dev/null || echo false)"
  if [ "$running" != "true" ]; then
    echo "WARN container not running: $name"
    return 1
  fi
  local health
  health="$(docker inspect -f '{{if .State.Health}}{{.State.Health.Status}}{{else}}none{{end}}' "$name" 2>/dev/null || echo unknown)"
  if [ "$health" != "healthy" ] && [ "$health" != "none" ]; then
    echo "WARN container health $name: $health"
  fi
}

check_container adn-9router || true
check_container adn-openclaw-ceo || true
check_container adn-openclaw-setup || true

memory_bytes="$(docker stats --no-stream --format '{{.MemUsage}}' adn-openclaw-ceo 2>/dev/null | awk '{print $1}')"
case "$memory_bytes" in
  *GiB) memory_mb="$(awk "BEGIN {printf \"%d\", ${memory_bytes%GiB} * 1024}")" ;;
  *MiB) memory_mb="${memory_bytes%MiB}" ;;
  *KiB) memory_mb="1" ;;
  *B|"") memory_mb="0" ;;
  *) memory_mb="0" ;;
esac
memory_mb="${memory_mb%.*}"
restart_mb="${OPENCLAW_RAM_RESTART_MB:-900}"
stop_mb="${OPENCLAW_RAM_STOP_MB:-1200}"
cooldown="${OPENCLAW_RESTART_COOLDOWN_SEC:-600}"
now="$(date +%s)"
last_restart="0"
[ -f "$LAST_RESTART_FILE" ] && last_restart="$(cat "$LAST_RESTART_FILE" 2>/dev/null || echo 0)"

if [ "$memory_mb" -ge "$stop_mb" ]; then
  echo "OpenClaw memory ${memory_mb}MB >= ${stop_mb}MB, stopping to protect web."
  docker stop adn-openclaw-ceo || true
  exit 0
fi

if [ "$memory_mb" -ge "$restart_mb" ]; then
  if [ $((now - last_restart)) -ge "$cooldown" ]; then
    echo "$now" > "$LAST_RESTART_FILE"
    echo "OpenClaw memory ${memory_mb}MB >= ${restart_mb}MB, restarting."
    docker restart adn-openclaw-ceo || true
  else
    echo "OpenClaw memory high (${memory_mb}MB), restart cooldown active."
  fi
fi
