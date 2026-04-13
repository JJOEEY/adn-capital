#!/bin/bash
# ============================================
# DEPLOY SCRIPT - ADN AI BOT
# Local: D:\BOT\adn-ai-bot
# VPS Bridge: Docker container adn-fiinquant
# VPS Frontend: Systemd adn-nextjs.service
# ============================================
# Dùng: bash deploy.sh [bridge|frontend|all]
# Mặc định: all

set -e

TARGET=${1:-all}
VPS_USER="adncapital"
VPS_HOST="14.225.204.117"   # ← đổi thành IP VPS của bạn
APP_DIR="/home/adncapital/app/fiinquant-bridge"

echo "🚀 Bắt đầu deploy: $TARGET"

# ─────────────────────────────────────────
# DEPLOY BRIDGE (Python + Docker)
# ─────────────────────────────────────────
deploy_bridge() {
  echo ""
  echo "▶ [1/3] Copy main.py vào container..."
  ssh $VPS_USER@$VPS_HOST "docker cp $APP_DIR/main.py adn-fiinquant:/app/main.py"

  echo "▶ [2/3] Restart uvicorn bên trong container..."
  ssh $VPS_USER@$VPS_HOST "docker exec adn-fiinquant pkill -f uvicorn || true"
  ssh $VPS_USER@$VPS_HOST "docker exec -d adn-fiinquant uvicorn main:app --host 0.0.0.0 --port 8000"

  echo "▶ [3/3] Kiểm tra container còn chạy không..."
  ssh $VPS_USER@$VPS_HOST "docker ps | grep adn-fiinquant"
  echo "✅ Bridge deploy xong!"
}

# ─────────────────────────────────────────
# DEPLOY FRONTEND (Next.js + Systemd)
# ─────────────────────────────────────────
deploy_frontend() {
  echo ""
  echo "▶ [1/4] Pull code mới nhất..."
  ssh $VPS_USER@$VPS_HOST "cd /home/adncapital/app/adn-capital && git pull"

  echo "▶ [2/4] Build Docker image mới..."
  ssh $VPS_USER@$VPS_HOST "cd /home/adncapital/app/adn-capital && docker build -t adn-capital-web ."

  echo "▶ [3/4] Restart Docker container (adn-web)..."
  ssh $VPS_USER@$VPS_HOST "docker stop adn-web || true && docker rm adn-web || true"
  ssh $VPS_USER@$VPS_HOST "docker run -d --name adn-web --network adn-capital_adn-net --env-file /home/adncapital/app/adn-capital/.env -p 3000:3000 adn-capital-web"

  echo "▶ [4/4] Kiểm tra trạng thái..."
  ssh $VPS_USER@$VPS_HOST "docker ps | grep adn-web"
  echo "✅ Frontend deploy & kết nối DB thành công!"
}

# ─────────────────────────────────────────
# CHẠY
# ─────────────────────────────────────────
case $TARGET in
  bridge)
    deploy_bridge
    ;;
  frontend)
    deploy_frontend
    ;;
  all)
    deploy_bridge
    deploy_frontend
    ;;
  *)
    echo "❌ Lệnh không hợp lệ. Dùng: bash deploy.sh [bridge|frontend|all]"
    exit 1
    ;;
esac

echo ""
echo "🎉 Deploy hoàn tất!"
