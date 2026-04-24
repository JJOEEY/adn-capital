#!/usr/bin/env bash
set -euo pipefail

# Usage:
#   CRON_SECRET=... ADN_URL=http://localhost:3000 bash deploy/setup-cron.sh

APP_URL="${ADN_URL:-http://localhost:3000}"
CRON_SECRET="${CRON_SECRET:-}"
LOG_DIR="${LOG_DIR:-/home/adncapital/logs/cron}"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

if [[ -f "${SCRIPT_DIR}/cron-contracts.env" ]]; then
  # shellcheck disable=SC1091
  source "${SCRIPT_DIR}/cron-contracts.env"
fi

[[ -n "${CRON_SECRET}" ]] || {
  echo "[setup-cron][FAIL] CRON_SECRET is required" >&2
  exit 1
}

mkdir -p "${LOG_DIR}"

CURL_CMD="curl -fsS -H 'x-cron-secret: ${CRON_SECRET}'"
CRON_FILE="/tmp/adn-crontab"

cat > "${CRON_FILE}" <<EOF
# ADN Capital canonical scheduler (UTC time, VN=UTC+7)
# Generated: $(date -u +"%Y-%m-%dT%H:%M:%SZ")

# Type 3 - Morning brief (08:00 VN)
${CRON_MORNING_SCHEDULE:-0 1 * * 1-5} ${CURL_CMD} "${APP_URL}/api/cron?type=${CRON_MORNING:-morning_brief}" >> ${LOG_DIR}/morning_brief.log 2>&1

# Type 1 - Signal scan (10:00, 10:30, 14:00, 14:25 VN)
${CRON_SIGNAL_1000_SCHEDULE:-0 3 * * 1-5} ${CURL_CMD} "${APP_URL}/api/cron?type=${CRON_SIGNAL_TYPE1:-signal_scan_type1}" >> ${LOG_DIR}/signal_type1.log 2>&1
${CRON_SIGNAL_1030_SCHEDULE:-30 3 * * 1-5} ${CURL_CMD} "${APP_URL}/api/cron?type=${CRON_SIGNAL_TYPE1:-signal_scan_type1}" >> ${LOG_DIR}/signal_type1.log 2>&1
${CRON_SIGNAL_1400_SCHEDULE:-0 7 * * 1-5} ${CURL_CMD} "${APP_URL}/api/cron?type=${CRON_SIGNAL_TYPE1:-signal_scan_type1}" >> ${LOG_DIR}/signal_type1.log 2>&1
${CRON_SIGNAL_1425_SCHEDULE:-25 7 * * 1-5} ${CURL_CMD} "${APP_URL}/api/cron?type=${CRON_SIGNAL_TYPE1:-signal_scan_type1}" >> ${LOG_DIR}/signal_type1.log 2>&1

# Type 2 - Market stats (10:00, 11:30, 14:00, 14:45 VN)
${CRON_MARKET_1000_SCHEDULE:-0 3 * * 1-5} ${CURL_CMD} "${APP_URL}/api/cron?type=${CRON_MARKET_TYPE2:-market_stats_type2}" >> ${LOG_DIR}/market_type2.log 2>&1
${CRON_MARKET_1130_SCHEDULE:-30 4 * * 1-5} ${CURL_CMD} "${APP_URL}/api/cron?type=${CRON_MARKET_TYPE2:-market_stats_type2}" >> ${LOG_DIR}/market_type2.log 2>&1
${CRON_MARKET_1400_SCHEDULE:-0 7 * * 1-5} ${CURL_CMD} "${APP_URL}/api/cron?type=${CRON_MARKET_TYPE2:-market_stats_type2}" >> ${LOG_DIR}/market_type2.log 2>&1
${CRON_MARKET_1445_SCHEDULE:-45 7 * * 1-5} ${CURL_CMD} "${APP_URL}/api/cron?type=${CRON_MARKET_TYPE2:-market_stats_type2}" >> ${LOG_DIR}/market_type2.log 2>&1

# Type 3 - Close brief 15:00 VN
${CRON_CLOSE_15H_SCHEDULE:-0 8 * * 1-5} ${CURL_CMD} "${APP_URL}/api/cron?type=${CRON_CLOSE_15H:-close_brief_15h}" >> ${LOG_DIR}/close_brief_15h.log 2>&1

# Type 3 - Full EOD 19:00 VN
${CRON_EOD_19H_SCHEDULE:-0 12 * * 1-5} ${CURL_CMD} "${APP_URL}/api/cron?type=${CRON_EOD_19H:-eod_full_19h}" >> ${LOG_DIR}/eod_full_19h.log 2>&1

# Additional workers (non-canonical event jobs)
*/5 2-8 * * 1-5 ${CURL_CMD} "${APP_URL}/api/cron/signal-lifecycle" >> ${LOG_DIR}/signal_lifecycle.log 2>&1
0 10 * * 5 ${CURL_CMD} "${APP_URL}/api/cron/ai-weekly-review" >> ${LOG_DIR}/weekly_review.log 2>&1

# Log cleanup
0 0 * * 0 find ${LOG_DIR} -name "*.log" -mtime +30 -delete
EOF

crontab "${CRON_FILE}"

echo "[setup-cron] Installed crontab from ${CRON_FILE}"
echo "[setup-cron] Canonical cron types: signal_scan_type1, market_stats_type2, morning_brief, close_brief_15h, eod_full_19h"
echo "[setup-cron] Verify with: crontab -l"
