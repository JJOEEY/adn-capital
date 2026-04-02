#!/bin/bash
# ============================================
# ADN Capital - Deploy Update Script
# Chạy mỗi khi muốn cập nhật code mới
# ============================================
# CÁCH DÙNG: ssh root@<IP_VPS> 'bash /home/adncapital/app/adn-capital/deploy/update.sh'
# ============================================

set -e

APP_DIR="/home/adncapital/app/adn-capital"

echo "[1/4] Pulling latest code..."
cd $APP_DIR
sudo -u adncapital git pull origin master

echo "[2/4] Installing dependencies..."
sudo -u adncapital npm ci --production=false

echo "[3/4] Building..."
sudo -u adncapital npx prisma generate
sudo -u adncapital npx prisma db push
sudo -u adncapital npm run build

echo "[4/4] Restarting services..."
# Copy static files to standalone
cp -r public .next/standalone/ 2>/dev/null || true
cp -r .next/static .next/standalone/.next/ 2>/dev/null || true

systemctl restart adn-nextjs

echo "✅ Deploy hoàn tất! Kiểm tra: https://adncapital.com.vn"
