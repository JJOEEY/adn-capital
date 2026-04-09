#!/bin/bash
# Deploy Next.js app to VPS
# Usage: ./vps-deploy.sh
# Requires: SSH key ~/.ssh/id_ed25519 authorized on VPS

set -e

VPS="root@14.225.204.117"
APP_DIR="/home/adncapital/app/adn-capital"

echo "=== Pushing to GitHub ==="
git push origin master

echo "=== Deploying to VPS ==="
ssh "$VPS" "
  set -e
  cd $APP_DIR
  echo '[1/4] Pulling...'
  git pull origin master
  echo '[2/4] Installing deps...'
  npm ci --production=false --silent
  echo '[3/4] Building...'
  npx prisma generate --silent
  npx prisma db push --skip-generate
  npm run build
  echo '[3.5/4] Copying static...'
  cp -r public .next/standalone/ 2>/dev/null || true
  cp -r .next/static .next/standalone/.next/ 2>/dev/null || true
  echo '[4/4] Restarting...'
  systemctl restart adn-nextjs
  sleep 2
  systemctl is-active adn-nextjs && echo '✅ Service OK' || echo '❌ Service FAILED'
"
echo "=== Deploy hoàn tất! https://adncapital.com.vn ==="
