#!/bin/bash
# ============================================
# ADN Capital - Cron Setup cho VPS
# Cài đặt crontab cho tất cả automated jobs
# ============================================
# CÁCH DÙNG: bash /home/adncapital/app/adn-capital/deploy/setup-cron.sh
# ============================================

set -e

# Config
APP_URL="${ADN_URL:-http://localhost:3000}"
CRON_SECRET="${CRON_SECRET:-adn-cron-dev-key}"
LOG_DIR="/home/adncapital/logs/cron"

# Tạo thư mục log
mkdir -p $LOG_DIR

echo "╔══════════════════════════════════════╗"
echo "║   ADN Capital - Cron Setup VPS       ║"
echo "╠══════════════════════════════════════╣"
echo "║ App URL: $APP_URL"
echo "║ Log Dir: $LOG_DIR"
echo "╚══════════════════════════════════════╝"
echo ""

# Helper function: tạo cron call
CURL_CMD="curl -s -o /dev/null -w '%{http_code}' -H 'x-cron-secret: $CRON_SECRET'"

# Tạo crontab entries
# ═══════════════════════════════════════
# Schedule Giờ VN (UTC+7) → Giờ UTC
# ═══════════════════════════════════════
# 08:00 VN = 01:00 UTC — Morning Brief
# 15:00 VN = 08:00 UTC — EOD Brief
# 19:00 VN = 12:00 UTC — Prop Trading (T2-T6)
# 10:00 VN = 03:00 UTC — Intraday update
# 11:30 VN = 04:30 UTC — Intraday update
# 14:00 VN = 07:00 UTC — Intraday update
# 14:45 VN = 07:45 UTC — Intraday update
# Mỗi 5 phút (9-15h VN = 2-8h UTC) — Signal scan

CRON_FILE="/tmp/adn-crontab"

cat > $CRON_FILE << EOF
# ═══════════════════════════════════════════════
# ADN Capital Automated Cron Jobs
# Generated: $(date)
# ═══════════════════════════════════════════════

# Morning Brief — 8:00 sáng VN (01:00 UTC)
0 1 * * * $CURL_CMD "$APP_URL/api/cron/morning-report" >> $LOG_DIR/morning.log 2>&1

# EOD Brief — 15:00 VN (08:00 UTC)
0 8 * * 1-5 $CURL_CMD "$APP_URL/api/cron/afternoon-review" >> $LOG_DIR/eod.log 2>&1

# Prop Trading (Tự Doanh) — 19:00 VN (12:00 UTC), T2-T6
0 12 * * 1-5 $CURL_CMD "$APP_URL/api/cron?type=prop_trading" >> $LOG_DIR/prop.log 2>&1

# Intraday 10:00 VN (03:00 UTC)
0 3 * * 1-5 $CURL_CMD "$APP_URL/api/cron?type=intraday" >> $LOG_DIR/intraday.log 2>&1

# Intraday 11:30 VN (04:30 UTC)
30 4 * * 1-5 $CURL_CMD "$APP_URL/api/cron?type=intraday" >> $LOG_DIR/intraday.log 2>&1

# Intraday 14:00 VN (07:00 UTC)
0 7 * * 1-5 $CURL_CMD "$APP_URL/api/cron?type=intraday" >> $LOG_DIR/intraday.log 2>&1

# Intraday 14:45 VN (07:45 UTC)
45 7 * * 1-5 $CURL_CMD "$APP_URL/api/cron?type=intraday" >> $LOG_DIR/intraday.log 2>&1

# Signal Scan — mỗi 5 phút (9-15h VN = 2-8h UTC), T2-T6
*/5 2-8 * * 1-5 $CURL_CMD "$APP_URL/api/cron?type=signal_scan_5m" >> $LOG_DIR/signal.log 2>&1

# Legacy Signal Scan (backup)
*/5 2-8 * * 1-5 $CURL_CMD "$APP_URL/api/cron/scan-signals" >> $LOG_DIR/signal-legacy.log 2>&1

# Log rotation — weekly
0 0 * * 0 find $LOG_DIR -name "*.log" -mtime +30 -delete

EOF

echo "📋 Crontab entries:"
cat $CRON_FILE
echo ""

# Install crontab cho user adncapital
crontab -u adncapital $CRON_FILE 2>/dev/null || crontab $CRON_FILE

echo "✅ Crontab đã được cài đặt!"
echo ""
echo "📊 Kiểm tra: crontab -l"
echo "📂 Logs tại: $LOG_DIR"
echo ""
echo "⚠️  Nhớ kiểm tra:"
echo "  1. CRON_SECRET trong .env khớp với script"
echo "  2. Python backend (FiinQuant) đang chạy: curl $APP_URL/api/market"
echo "  3. Prisma migration: npx prisma db push"
