#!/usr/bin/env python3
"""
Pre-fetch script: Lấy Composite Score từ Python bridge và lưu vào market_cache.json.
Chạy tự động sau khi bridge tính xong, hoặc chạy thủ công.

Usage:
  python3 /home/adncapital/app/adn-capital/scripts/prefetch_cache.py
  
Cron: mỗi ngày 15h30
  30 15 * * 1-5 python3 /home/adncapital/app/adn-capital/scripts/prefetch_cache.py
"""

import json
import requests
import os
import sys
from datetime import datetime

BRIDGE_URL = "http://localhost:8000/api/v1/market-overview"
CACHE_FILE = "/home/adncapital/app/adn-capital/market_cache.json"

print(f"[{datetime.now().strftime('%Y-%m-%d %H:%M:%S')}] Fetching market overview...")

try:
    resp = requests.get(BRIDGE_URL, timeout=150)
    resp.raise_for_status()
    data = resp.json()
    
    # Lưu cache
    with open(CACHE_FILE, "w", encoding="utf-8") as f:
        json.dump({
            **data,
            "last_updated": datetime.now().isoformat()
        }, f, ensure_ascii=False, indent=2)
    
    print(f"✅ Cache saved! Score: {data.get('score')}/{data.get('max_score')} Level {data.get('level')}")
    print(f"   Status: {data.get('status_badge')}")
    print(f"   Saved to: {CACHE_FILE}")

except requests.exceptions.Timeout:
    print("❌ Timeout: Bridge took >150s")
    sys.exit(1)
except Exception as e:
    print(f"❌ Error: {e}")
    sys.exit(1)
