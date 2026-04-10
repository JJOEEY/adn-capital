#!/bin/bash
# ============================================
# ADN Capital - VPS Deploy Script
# Chạy lệnh này mỗi khi muốn cập nhật code mới
# CÁCH DÙNG: ./deploy.sh
# ============================================

set -e

echo "╔══════════════════════════════════════╗"
echo "║   ADN Capital — Deploy Update        ║"
echo "╚══════════════════════════════════════╝"

# --- 1. PULL CODE MỚI NHẤT ---
echo "[1/4] 📥 Pulling latest code from GitHub..."
git pull origin master

# --- 2. TẮT HỆ THỐNG CŨ ---
echo "[2/4] 🛑 Stopping old containers..."
docker compose down

# --- 3. BUILD LẠI & CHẠY ---
echo "[3/4] 🏗️  Building & starting new containers..."
docker compose up -d --build

# --- 4. DỌN DẸP ---
echo "[4/4] 🧹 Pruning unused Docker images..."
docker image prune -f

echo ""
echo "╔══════════════════════════════════════╗"
echo "║   ✅ Deploy hoàn tất!                ║"
echo "║   🌐 https://adncapital.com.vn       ║"
echo "╚══════════════════════════════════════╝"
echo ""
echo "Kiểm tra logs: docker compose logs web --tail=50"
