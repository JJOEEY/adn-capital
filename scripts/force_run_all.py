#!/usr/bin/env python3
"""
force_run_all.py – Script ép chạy thủ công tất cả tác vụ nặng:
1. Tính toán lại TEI/Market Overview → CẬP NHẬT market_cache.json
2. Gửi Morning Brief lên Telegram
3. Gửi EOD Brief lên Telegram

Usage:
    python3 /home/adncapital/app/adn-capital/scripts/force_run_all.py [cache|morning|eod|all]
"""

import sys
import os
import json
import requests
from datetime import datetime

BRIDGE = "http://localhost:8000"
APP_DIR = "/home/adncapital/app/adn-capital"
CACHE_FILE = f"{APP_DIR}/market_cache.json"
TIMEOUT = 300

# Kiểm tra Telegram credentials
BOT_TOKEN = os.getenv("TELEGRAM_BOT_TOKEN", "")
CHAT_ID = os.getenv("TELEGRAM_CHAT_ID", "")

mode = sys.argv[1] if len(sys.argv) > 1 else "all"


def run_cache():
    print("\n╔══════════════════════════════════════╗")
    print("║  1. REFRESH MARKET CACHE (TEI/Score)  ║")
    print("╚══════════════════════════════════════╝")
    try:
        resp = requests.get(f"{BRIDGE}/api/v1/market-overview", timeout=TIMEOUT)
        resp.raise_for_status()
        data = resp.json()

        with open(CACHE_FILE, "w", encoding="utf-8") as f:
            json.dump({**data, "last_updated": datetime.now().isoformat()}, f, ensure_ascii=False, indent=2)

        score = data.get("score", 0)
        max_score = data.get("max_score", 14)
        level = data.get("level", 1)
        status = data.get("status_badge", "N/A")
        print(f"✅ Cache đã cập nhật!")
        print(f"   Score: {score}/{max_score} – Level {level} – {status}")
    except Exception as e:
        print(f"❌ Lỗi refresh cache: {e}")


def run_morning():
    print("\n╔════════════════════════════════╗")
    print("║  2. FORCE MORNING BRIEF (8h)    ║")
    print("╚════════════════════════════════╝")
    if not BOT_TOKEN or not CHAT_ID:
        print("❌ THIẾU TELEGRAM CREDENTIALS!")
        print("   Cần set: TELEGRAM_BOT_TOKEN và TELEGRAM_CHAT_ID trong .env của VPS")
        return
    try:
        resp = requests.post(
            f"{BRIDGE}/api/v1/internal/trigger-morning-brief",
            json={},
            timeout=TIMEOUT
        )
        if resp.ok:
            print("✅ Morning Brief đã được gửi lên Telegram!")
        else:
            # Fallback: gọi trực tiếp qua Python path
            print(f"Bridge trigger failed ({resp.status_code}), thử fallback...")
            _send_telegram_direct("🌅 *Morning Brief (Force Test)*\nHệ thống hoạt động bình thường. Đây là tin test từ force_run_all.py")
    except Exception as e:
        print(f"❌ Lỗi Morning Brief: {e}")
        _send_telegram_direct("🌅 *Morning Brief (Force Test)*\nHệ thống hoạt động bình thường. Đây là tin test từ force_run_all.py")


def run_eod():
    print("\n╔════════════════════════════════╗")
    print("║  3. FORCE EOD BRIEF (19h)       ║")
    print("╚════════════════════════════════╝")
    if not BOT_TOKEN or not CHAT_ID:
        print("❌ THIẾU TELEGRAM CREDENTIALS!")
        print("   Cần set: TELEGRAM_BOT_TOKEN và TELEGRAM_CHAT_ID trong .env của VPS")
        return
    try:
        resp = requests.post(
            f"{BRIDGE}/api/v1/internal/trigger-eod-brief",
            json={},
            timeout=TIMEOUT
        )
        if resp.ok:
            print("✅ EOD Brief đã được gửi lên Telegram!")
        else:
            print(f"Bridge trigger failed ({resp.status_code}), thử fallback...")
            _send_telegram_direct("🌙 *EOD Brief (Force Test)*\nKết thúc phiên hôm nay. Đây là tin test từ force_run_all.py")
    except Exception as e:
        print(f"❌ Lỗi EOD Brief: {e}")
        _send_telegram_direct("🌙 *EOD Brief (Force Test)*\nKết thúc phiên hôm nay. Đây là tin test từ force_run_all.py")


def _send_telegram_direct(text: str):
    """Gửi trực tiếp qua Telegram API."""
    url = f"https://api.telegram.org/bot{BOT_TOKEN}/sendMessage"
    resp = requests.post(url, json={
        "chat_id": CHAT_ID,
        "text": text,
        "parse_mode": "Markdown"
    }, timeout=30)
    if resp.ok:
        print(f"✅ Telegram gửi thành công (message_id: {resp.json().get('result', {}).get('message_id')})")
    else:
        print(f"❌ Telegram API lỗi: {resp.status_code} – {resp.text}")


# ─── Main ───────────────────────────────────────────────────────────────────
print(f"\n{'='*50}")
print(f"  ADN Capital – Force Run All ({mode.upper()})")
print(f"  {datetime.now().strftime('%d/%m/%Y %H:%M:%S')}")
print(f"{'='*50}")

if not BOT_TOKEN:
    print("\n⚠️  CẢNH BÁO: TELEGRAM_BOT_TOKEN chưa được set trong .env!")
    print("   Các lệnh bắn Telegram sẽ bị bỏ qua.")

if mode in ("cache", "all"):
    run_cache()

if mode in ("morning", "all"):
    run_morning()

if mode in ("eod", "all"):
    run_eod()

print(f"\n{'='*50}")
print("  Force Run hoàn tất!")
print(f"{'='*50}\n")
