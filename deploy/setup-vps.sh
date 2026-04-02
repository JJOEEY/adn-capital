#!/bin/bash
# ============================================
# ADN Capital - VPS Setup Script (Ubuntu 22.04+)
# Domain: adncapital.com.vn
# ============================================
# CÁCH DÙNG:
# 1. Mua VPS Ubuntu 22.04 (DigitalOcean/Vultr/AWS Lightsail)
#    - Tối thiểu: 2 vCPU, 2GB RAM, 50GB SSD (~$12/tháng)
# 2. SSH vào VPS: ssh root@<IP_VPS>
# 3. Upload file này lên VPS và chạy:
#    chmod +x setup-vps.sh && ./setup-vps.sh
# ============================================

set -e

echo "========================================"
echo "  ADN Capital - VPS Setup"
echo "========================================"

# --- 1. CÀI ĐẶT DEPENDENCIES ---
echo "[1/7] Cài đặt Node.js 20, Python 3.11, Nginx, Certbot..."
apt update && apt upgrade -y

# Node.js 20
curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
apt install -y nodejs

# Python 3.11 + pip
apt install -y python3.11 python3.11-venv python3-pip

# Nginx + Certbot (SSL)
apt install -y nginx certbot python3-certbot-nginx

# Git
apt install -y git

echo "Node: $(node -v), npm: $(npm -v), Python: $(python3.11 --version)"

# --- 2. TẠO USER APP ---
echo "[2/7] Tạo user 'adncapital'..."
id -u adncapital &>/dev/null || useradd -m -s /bin/bash adncapital
mkdir -p /home/adncapital/app
chown -R adncapital:adncapital /home/adncapital

# --- 3. CLONE REPO ---
echo "[3/7] Clone repo..."
cd /home/adncapital/app
if [ -d "adn-capital" ]; then
  cd adn-capital && git pull
else
  sudo -u adncapital git clone https://github.com/JJOEEY/adn-capital.git
  cd adn-capital
fi

# --- 4. SETUP NEXT.JS ---
echo "[4/7] Setup Next.js..."
sudo -u adncapital npm ci --production=false

# Tạo file .env (SỬA CÁC GIÁ TRỊ THỰC TẾ)
if [ ! -f .env ]; then
cat > .env << 'ENVEOF'
DATABASE_URL="file:./prisma/prod.db"
NEXTAUTH_SECRET=THAY_BANG_SECRET_THUC_TE_CUA_BAN
NEXTAUTH_URL=https://adncapital.com.vn
AUTH_SECRET=THAY_BANG_SECRET_THUC_TE_CUA_BAN

GEMINI_API_KEY=THAY_BANG_API_KEY_CUA_BAN
GOOGLE_CLIENT_ID=THAY_BANG_GOOGLE_CLIENT_ID
GOOGLE_CLIENT_SECRET=THAY_BANG_GOOGLE_CLIENT_SECRET

CRON_SECRET=THAY_BANG_CRON_SECRET
ADMIN_EMAILS=admin@adncapital.com.vn

PAYOS_CLIENT_ID=THAY_BANG_PAYOS_CLIENT_ID
PAYOS_API_KEY=THAY_BANG_PAYOS_API_KEY
PAYOS_CHECKSUM_KEY=THAY_BANG_PAYOS_CHECKSUM_KEY
ENVEOF
echo "⚠️  SỬA FILE .env VỚI GIÁ TRỊ THỰC TẾ: nano /home/adncapital/app/adn-capital/.env"
fi

# Build
sudo -u adncapital npx prisma generate
sudo -u adncapital npx prisma db push
sudo -u adncapital npm run build

# --- 5. SETUP PYTHON BACKEND ---
echo "[5/7] Setup Python backend..."
cd /home/adncapital/app
if [ -d "fiinquant-bridge" ]; then
  cd fiinquant-bridge
else
  echo "⚠️  Upload thư mục fiinquant-bridge lên /home/adncapital/app/fiinquant-bridge"
  mkdir -p fiinquant-bridge
  cd fiinquant-bridge
fi

if [ ! -d "venv" ]; then
  python3.11 -m venv venv
fi
source venv/bin/activate
pip install fastapi uvicorn httpx google-generativeai python-dotenv 2>/dev/null || true
deactivate

# --- 6. SYSTEMD SERVICES ---
echo "[6/7] Tạo systemd services..."

# Next.js service
cat > /etc/systemd/system/adn-nextjs.service << 'EOF'
[Unit]
Description=ADN Capital Next.js
After=network.target

[Service]
Type=simple
User=adncapital
WorkingDirectory=/home/adncapital/app/adn-capital
ExecStart=/usr/bin/node .next/standalone/server.js
Restart=always
RestartSec=5
Environment=NODE_ENV=production
Environment=PORT=3000
Environment=HOSTNAME=0.0.0.0

[Install]
WantedBy=multi-user.target
EOF

# Python backend service
cat > /etc/systemd/system/adn-python.service << 'EOF'
[Unit]
Description=ADN Capital Python Backend (FastAPI)
After=network.target

[Service]
Type=simple
User=adncapital
WorkingDirectory=/home/adncapital/app/fiinquant-bridge
ExecStart=/home/adncapital/app/fiinquant-bridge/venv/bin/uvicorn main:app --host 127.0.0.1 --port 8000
Restart=always
RestartSec=5
EnvironmentFile=/home/adncapital/app/fiinquant-bridge/.env

[Install]
WantedBy=multi-user.target
EOF

systemctl daemon-reload
systemctl enable adn-nextjs adn-python
systemctl start adn-python
systemctl start adn-nextjs

# --- 7. NGINX + SSL ---
echo "[7/7] Cấu hình Nginx + SSL..."

cat > /etc/nginx/sites-available/adncapital << 'NGINX'
server {
    listen 80;
    server_name adncapital.com.vn www.adncapital.com.vn;

    # Next.js frontend
    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }

    # Python API backend (internal proxy)
    location /api/v1/ {
        proxy_pass http://127.0.0.1:8000/api/v1/;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_read_timeout 120s;
    }
}
NGINX

ln -sf /etc/nginx/sites-available/adncapital /etc/nginx/sites-enabled/
rm -f /etc/nginx/sites-enabled/default
nginx -t && systemctl reload nginx

echo ""
echo "========================================"
echo "  SETUP HOÀN TẤT!"
echo "========================================"
echo ""
echo "BƯỚC TIẾP THEO:"
echo "1. Sửa file .env: nano /home/adncapital/app/adn-capital/.env"
echo "2. Upload fiinquant-bridge: scp -r fiinquant-bridge/ root@<IP>:/home/adncapital/app/"
echo "3. Trỏ domain adncapital.com.vn -> IP VPS (xem hướng dẫn bên dưới)"
echo "4. Cài SSL: certbot --nginx -d adncapital.com.vn -d www.adncapital.com.vn"
echo "5. Restart services: systemctl restart adn-nextjs adn-python"
echo ""
echo "QUẢN LÝ:"
echo "  Xem logs Next.js:  journalctl -u adn-nextjs -f"
echo "  Xem logs Python:   journalctl -u adn-python -f"
echo "  Restart Next.js:   systemctl restart adn-nextjs"
echo "  Restart Python:    systemctl restart adn-python"
echo ""
