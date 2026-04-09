#!/bin/bash
# Deploy Python scanner to VPS
# Usage: ./deploy-scanner.sh

VPS="root@14.225.204.117"
SCANNER_DIR="/home/adncapital/app/fiinquant-bridge"

echo "=== Copying scanner.py to VPS ==="
scp d:/BOT/fiinquant-bridge/scanner.py "$VPS:$SCANNER_DIR/scanner.py"

echo "=== Restarting scanner service ==="
ssh "$VPS" "
  systemctl restart fiinquant-scanner 2>/dev/null || \
  pkill -f scanner.py 2>/dev/null || true
  echo 'Scanner updated'
"
echo "=== Scanner deploy done ==="
