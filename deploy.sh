#!/bin/bash
set -e

cd /home/adncapital/app/adn-capital

echo "=== Pulling latest code ==="
git pull

echo "=== Installing dependencies ==="
npm ci --production=false

echo "=== Building ==="
npx prisma generate
npm run build

echo "=== Copying assets to standalone ==="
cp -r public .next/standalone/
cp -r .next/static .next/standalone/.next/
cp -r node_modules/.prisma .next/standalone/node_modules/
cp -r node_modules/@prisma .next/standalone/node_modules/
cp .env .next/standalone/.env

echo "=== Setting up DB symlink ==="
mkdir -p .next/standalone/prisma
ln -sf /home/adncapital/app/adn-capital/prisma/prod.db .next/standalone/prisma/prod.db
cp prisma/schema.prisma .next/standalone/prisma/schema.prisma

echo "=== Restarting service ==="
systemctl restart adn-nextjs

echo "=== Done! ==="
systemctl status adn-nextjs --no-pager -l | head -15
