#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
MARK_BEGIN="# ADN OPENCLAW CEO CRON BEGIN"
MARK_END="# ADN OPENCLAW CEO CRON END"

tmp="$(mktemp)"
crontab -l 2>/dev/null | sed "/$MARK_BEGIN/,/$MARK_END/d" > "$tmp" || true
cat >> "$tmp" <<EOF
$MARK_BEGIN
*/5 * * * * bash $SCRIPT_DIR/healthcheck-openclaw-ceo.sh >> /var/log/adn-openclaw-health.log 2>&1
17 3 * * * bash $SCRIPT_DIR/cleanup-openclaw-ceo.sh >> /var/log/adn-openclaw-cleanup.log 2>&1
$MARK_END
EOF
crontab "$tmp"
rm -f "$tmp"
echo "OpenClaw healthcheck/cleanup cron installed."
