#!/bin/bash
# ════════════════════════════════════════════
# ADN Capital - Full Deploy & Restart
# Chạy trên VPS: bash /home/adncapital/app/adn-capital/deploy/full-deploy.sh
# ════════════════════════════════════════════
set -e

APP_DIR="/home/adncapital/app/adn-capital"

echo "╔══════════════════════════════════════╗"
echo "║   ADN Capital - Full Deploy          ║"
echo "╚══════════════════════════════════════╝"
echo ""

echo "[1/8] Pulling latest code..."
cd $APP_DIR
sudo -u adncapital git pull origin master

echo "[2/8] Installing dependencies..."
sudo -u adncapital npm ci --production=false

echo "[3/8] Prisma generate + migrate..."
sudo -u adncapital npx prisma generate
sudo -u adncapital npx prisma db push

echo "[4/8] Seeding knowledge base..."
sudo -u adncapital npx tsx scripts/seed-knowledge.ts 2>/dev/null || echo "⚠️  Skipped (tsx not found, install: npm i -g tsx)"

echo "[5/8] Building Next.js..."
sudo -u adncapital npm run build

echo "[6/8] Copying static files to standalone..."
cp -r public .next/standalone/ 2>/dev/null || true
cp -r .next/static .next/standalone/.next/ 2>/dev/null || true

echo "[7/8] Setting up cron jobs..."
bash deploy/setup-cron.sh

echo "[8/8] Restarting services..."
systemctl restart adn-nextjs
systemctl restart adn-python 2>/dev/null || echo "⚠️  Python backend chưa setup (optional)"

echo ""
echo "════════════════════════════════════════"
echo "  ✅ DEPLOY HOÀN TẤT!"
echo "════════════════════════════════════════"
echo ""
echo "  Kiểm tra:"
echo "  • Next.js:  systemctl status adn-nextjs"
echo "  • Python:   systemctl status adn-python"
echo "  • Cron:     crontab -l -u adncapital"
echo "  • Logs:     journalctl -u adn-nextjs -f"
echo ""
echo "  Test cron:"
CRON_KEY=$(grep CRON_SECRET .env 2>/dev/null | cut -d= -f2 || echo "adn-cron-dev-key")
echo "  curl -s -H 'x-cron-secret: $CRON_KEY' http://localhost:3000/api/notifications | head -c 200"
echo ""
echo "  Test signal scan:"
echo "  curl -s -H 'x-cron-secret: $CRON_KEY' http://localhost:3000/api/cron?type=signal_scan_5m | python3 -m json.tool"
echo ""
