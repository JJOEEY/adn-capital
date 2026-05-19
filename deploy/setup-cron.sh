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
# ADN Capital canonical scheduler (VPS local time: Asia/Ho_Chi_Minh)
# Generated: $(date -u +"%Y-%m-%dT%H:%M:%SZ")
CRON_TZ=Asia/Ho_Chi_Minh

# Type 3 - Morning brief (08:00 VN)
${CRON_MORNING_SCHEDULE:-0 8 * * *} ${CURL_CMD} "${APP_URL}/api/cron?type=${CRON_MORNING:-morning_brief}" >> ${LOG_DIR}/morning_brief.log 2>&1

# Type 1 - Signal scan (10:00, 10:30, 14:00, 14:25 VN)
${CRON_SIGNAL_TYPE1_SCHEDULE:-*/5 9-14 * * 1-5} ${CURL_CMD} "${APP_URL}/api/cron?type=${CRON_SIGNAL_TYPE1:-signal_scan_type1}" >> ${LOG_DIR}/signal_type1.log 2>&1

# Type 2 - Market stats (10:00, 11:30, 14:00, 14:45 VN)
${CRON_MARKET_1000_SCHEDULE:-0 10 * * *} ${CURL_CMD} "${APP_URL}/api/cron?type=${CRON_MARKET_TYPE2:-market_stats_type2}" >> ${LOG_DIR}/market_type2.log 2>&1
${CRON_MARKET_1130_SCHEDULE:-30 11 * * *} ${CURL_CMD} "${APP_URL}/api/cron?type=${CRON_MARKET_TYPE2:-market_stats_type2}" >> ${LOG_DIR}/market_type2.log 2>&1
${CRON_MARKET_1400_SCHEDULE:-0 14 * * *} ${CURL_CMD} "${APP_URL}/api/cron?type=${CRON_MARKET_TYPE2:-market_stats_type2}" >> ${LOG_DIR}/market_type2.log 2>&1
${CRON_MARKET_1445_SCHEDULE:-45 14 * * *} ${CURL_CMD} "${APP_URL}/api/cron?type=${CRON_MARKET_TYPE2:-market_stats_type2}" >> ${LOG_DIR}/market_type2.log 2>&1

# Type 3 - Close brief 15:00 VN
${CRON_CLOSE_15H_SCHEDULE:-0 15 * * *} ${CURL_CMD} "${APP_URL}/api/cron?type=${CRON_CLOSE_15H:-close_brief_15h}" >> ${LOG_DIR}/close_brief_15h.log 2>&1

# ADN Rank - price/RS refresh 15:00 VN, Mon-Fri
${CRON_ADN_RANK_15H_SCHEDULE:-0 15 * * 1-5} ${CURL_CMD} "${APP_URL}/api/cron?type=${CRON_ADN_RANK_15H:-adn_rank_15h}" >> ${LOG_DIR}/adn_rank_15h.log 2>&1

# ADN Smartflow - precompute heavy Pulse data, Mon-Fri
${CRON_SMARTFLOW_INTRADAY_SCHEDULE:-*/15 9-14 * * 1-5} ${CURL_CMD} "${APP_URL}/api/cron?type=${CRON_SMARTFLOW_PRECOMPUTE:-pulse_smartflow_precompute}" >> ${LOG_DIR}/pulse_smartflow_precompute.log 2>&1
${CRON_SMARTFLOW_1510_SCHEDULE:-10 15 * * 1-5} ${CURL_CMD} "${APP_URL}/api/cron?type=${CRON_SMARTFLOW_PRECOMPUTE:-pulse_smartflow_precompute}" >> ${LOG_DIR}/pulse_smartflow_precompute.log 2>&1
${CRON_SMARTFLOW_1910_SCHEDULE:-10 19 * * 1-5} ${CURL_CMD} "${APP_URL}/api/cron?type=${CRON_SMARTFLOW_PRECOMPUTE:-pulse_smartflow_precompute}" >> ${LOG_DIR}/pulse_smartflow_precompute.log 2>&1

# Type 3 - Full EOD retry window 19:00-20:00 VN, Mon-Fri
${CRON_EOD_19H_SCHEDULE:-0,5,10,15,20,30,45 19 * * 1-5} ${CURL_CMD} "${APP_URL}/api/cron?type=${CRON_EOD_19H:-eod_full_19h}" >> ${LOG_DIR}/eod_full_19h.log 2>&1
${CRON_EOD_20H_SCHEDULE:-0 20 * * 1-5} ${CURL_CMD} "${APP_URL}/api/cron?type=${CRON_EOD_19H:-eod_full_19h}" >> ${LOG_DIR}/eod_full_19h.log 2>&1

# ADN ART - daily refresh 19:05 VN, Mon-Fri
${CRON_ART_1905_SCHEDULE:-5 19 * * 1-5} ${CURL_CMD} "${APP_URL}/api/cron?type=${CRON_ART_1905:-art_daily_1905}" >> ${LOG_DIR}/art_daily_1905.log 2>&1

# News crawler (07:00-22:30 VN, every 30 minutes)
${CRON_NEWS_CRAWLER_SCHEDULE:-*/30 7-22 * * *} ${CURL_CMD} "${APP_URL}/api/cron?type=${CRON_NEWS_CRAWLER:-news_crawler}" >> ${LOG_DIR}/news_crawler.log 2>&1

# Database v2 shadow jobs - do not publish over v1
${CRON_DATABASE_NEWS_COLLECT_SCHEDULE:-*/30 7-22 * * *} ${CURL_CMD} "${APP_URL}/api/cron?type=${CRON_DATABASE_NEWS_COLLECT:-database_news_collect}&sync=1" >> ${LOG_DIR}/database_v2_news_collect.log 2>&1
${CRON_DATABASE_DNSE_MARKET_COLLECT_SCHEDULE:-*/5 9-15 * * 1-5} ${CURL_CMD} "${APP_URL}/api/cron?type=${CRON_DATABASE_DNSE_MARKET_COLLECT:-database_dnse_market_collect}&sync=1" >> ${LOG_DIR}/database_v2_dnse_market_collect.log 2>&1
${CRON_DATABASE_MORNING_READINESS_SCHEDULE:-55 7 * * 1-5} ${CURL_CMD} "${APP_URL}/api/cron?type=${CRON_DATABASE_MORNING_READINESS:-database_morning_readiness}&sync=1" >> ${LOG_DIR}/database_v2_morning_readiness.log 2>&1
${CRON_DATABASE_MORNING_BRIEF_SCHEDULE:-0 8 * * 1-5} ${CURL_CMD} "${APP_URL}/api/cron?type=${CRON_DATABASE_MORNING_BRIEF:-database_morning_brief}&sync=1" >> ${LOG_DIR}/database_v2_morning_brief.log 2>&1
${CRON_DATABASE_EOD_COLLECT_1510_SCHEDULE:-10 15 * * 1-5} ${CURL_CMD} "${APP_URL}/api/cron?type=${CRON_DATABASE_EOD_COLLECT:-database_eod_collect}&sync=1" >> ${LOG_DIR}/database_v2_eod_collect.log 2>&1
${CRON_DATABASE_EOD_COLLECT_19H_SCHEDULE:-0,5,10,20,30,45 19 * * 1-5} ${CURL_CMD} "${APP_URL}/api/cron?type=${CRON_DATABASE_EOD_COLLECT:-database_eod_collect}&sync=1" >> ${LOG_DIR}/database_v2_eod_collect.log 2>&1
${CRON_DATABASE_EOD_READINESS_SCHEDULE:-0 20 * * 1-5} ${CURL_CMD} "${APP_URL}/api/cron?type=${CRON_DATABASE_EOD_READINESS:-database_eod_readiness}&sync=1" >> ${LOG_DIR}/database_v2_eod_readiness.log 2>&1
${CRON_DATABASE_RADAR_REALTIME_COLLECT_SCHEDULE:-* 9-14 * * 1-5} ${CURL_CMD} "${APP_URL}/api/cron?type=${CRON_DATABASE_RADAR_REALTIME_COLLECT:-database_radar_realtime_collect}&sync=1" >> ${LOG_DIR}/database_v2_radar_realtime_collect.log 2>&1
${CRON_DATABASE_REALTIME_HEALTH_SCHEDULE:-*/5 9-14 * * 1-5} ${CURL_CMD} "${APP_URL}/api/cron?type=${CRON_DATABASE_REALTIME_HEALTH:-database_realtime_health}&sync=1" >> ${LOG_DIR}/database_v2_realtime_health.log 2>&1
${CRON_DATABASE_ADN_RADAR_COLLECT_SCHEDULE:-5,35 10 * * 1-5} ${CURL_CMD} "${APP_URL}/api/cron?type=${CRON_DATABASE_ADN_RADAR_COLLECT:-database_adn_radar_collect}&sync=1" >> ${LOG_DIR}/database_v2_adn_radar_collect.log 2>&1
${CRON_DATABASE_ADN_RADAR_COLLECT_PM_SCHEDULE:-5,30 14 * * 1-5} ${CURL_CMD} "${APP_URL}/api/cron?type=${CRON_DATABASE_ADN_RADAR_COLLECT:-database_adn_radar_collect}&sync=1" >> ${LOG_DIR}/database_v2_adn_radar_collect.log 2>&1
${CRON_DATABASE_ADN_RADAR_READINESS_SCHEDULE:-40 10,14 * * 1-5} ${CURL_CMD} "${APP_URL}/api/cron?type=${CRON_DATABASE_ADN_RADAR_READINESS:-database_adn_radar_readiness}&sync=1" >> ${LOG_DIR}/database_v2_adn_radar_readiness.log 2>&1
${CRON_DATABASE_ADN_ART_COLLECT_SCHEDULE:-*/5 9-14 * * 1-5} ${CURL_CMD} "${APP_URL}/api/cron?type=${CRON_DATABASE_ADN_ART_COLLECT:-database_adn_art_collect}&sync=1" >> ${LOG_DIR}/database_v2_adn_art_collect.log 2>&1
${CRON_DATABASE_ADN_ART_READINESS_SCHEDULE:-0 10,14 * * 1-5} ${CURL_CMD} "${APP_URL}/api/cron?type=${CRON_DATABASE_ADN_ART_READINESS:-database_adn_art_readiness}&sync=1" >> ${LOG_DIR}/database_v2_adn_art_readiness.log 2>&1
${CRON_DATABASE_ADNCORE_COLLECT_SCHEDULE:-5,20 15 * * 1-5} ${CURL_CMD} "${APP_URL}/api/cron?type=${CRON_DATABASE_ADNCORE_COLLECT:-database_adncore_collect}&sync=1" >> ${LOG_DIR}/database_v2_adncore_collect.log 2>&1
${CRON_DATABASE_ADNCORE_READINESS_SCHEDULE:-30 15 * * 1-5} ${CURL_CMD} "${APP_URL}/api/cron?type=${CRON_DATABASE_ADNCORE_READINESS:-database_adncore_readiness}&sync=1" >> ${LOG_DIR}/database_v2_adncore_readiness.log 2>&1
${CRON_DATABASE_ADN_RANK_COLLECT_SCHEDULE:-0 15 * * 1-5} ${CURL_CMD} "${APP_URL}/api/cron?type=${CRON_DATABASE_ADN_RANK_COLLECT:-database_adn_rank_collect}&sync=1" >> ${LOG_DIR}/database_v2_adn_rank_collect.log 2>&1
${CRON_DATABASE_ADN_RANK_READINESS_SCHEDULE:-10 15 * * 1-5} ${CURL_CMD} "${APP_URL}/api/cron?type=${CRON_DATABASE_ADN_RANK_READINESS:-database_adn_rank_readiness}&sync=1" >> ${LOG_DIR}/database_v2_adn_rank_readiness.log 2>&1
${CRON_DATABASE_AIDEN_CONTEXT_COLLECT_SCHEDULE:-*/15 8-15 * * 1-5} ${CURL_CMD} "${APP_URL}/api/cron?type=${CRON_DATABASE_AIDEN_CONTEXT_COLLECT:-database_aiden_context_collect}&sync=1" >> ${LOG_DIR}/database_v2_aiden_context_collect.log 2>&1

# Additional workers (non-canonical event jobs)
*/5 9-15 * * 1-5 ${CURL_CMD} "${APP_URL}/api/cron/signal-lifecycle" >> ${LOG_DIR}/signal_lifecycle.log 2>&1
30 11 * * 1-5 ${CURL_CMD} "${APP_URL}/api/cron/radar-paper?slot=1130" >> ${LOG_DIR}/radar_paper.log 2>&1
0 15 * * 1-5 ${CURL_CMD} "${APP_URL}/api/cron/radar-paper?slot=1500" >> ${LOG_DIR}/radar_paper.log 2>&1
0 17 * * 5 ${CURL_CMD} "${APP_URL}/api/cron/ai-weekly-review" >> ${LOG_DIR}/weekly_review.log 2>&1

# Log cleanup
0 0 * * 0 find ${LOG_DIR} -name "*.log" -mtime +30 -delete
EOF

crontab "${CRON_FILE}"

echo "[setup-cron] Installed crontab from ${CRON_FILE}"
echo "[setup-cron] Canonical cron types: signal_scan_type1, market_stats_type2, morning_brief, close_brief_15h, eod_full_19h, news_crawler, adn_rank_15h, pulse_smartflow_precompute, art_daily_1905, database_news_collect, database_dnse_market_collect, database_morning_readiness, database_morning_brief, database_eod_collect, database_eod_readiness, database_radar_realtime_collect, database_realtime_health, database_adn_radar_collect, database_adn_radar_readiness, database_adn_art_collect, database_adn_art_readiness, database_adncore_collect, database_adncore_readiness, database_adn_rank_collect, database_adn_rank_readiness, database_aiden_context_collect"
echo "[setup-cron] Verify with: crontab -l"
