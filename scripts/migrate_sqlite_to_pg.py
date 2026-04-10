#!/usr/bin/env python3
"""
Script migrate data từ SQLite (prisma/prod.db) → PostgreSQL trên VPS.

Cách dùng:
  1. Máy tính nhà: export SQLite ra JSON
     python3 scripts/migrate_sqlite_to_pg.py export

  2. Copy file sqlite_export.json lên VPS:
     scp sqlite_export.json root@14.225.204.117:/home/adncapital/app/adn-capital/

  3. Trên VPS: import vào PostgreSQL
     python3 scripts/migrate_sqlite_to_pg.py import
"""

import json
import sys
import os

def find_sqlite_db():
    """Tự động tìm file SQLite: ưu tiên đọc từ .env, sau đó scan prisma/"""
    import glob, re

    # 1. Đọc DATABASE_URL từ .env (ưu tiên cao nhất)
    for env_file in [".env", ".env.local", ".env.development"]:
        if os.path.exists(env_file):
            with open(env_file, "r", encoding="utf-8") as f:
                for line in f:
                    line = line.strip()
                    if line.startswith("DATABASE_URL"):
                        # Lấy phần sau dấu =, bỏ quotes và khoảng trắng
                        val = line.split("=", 1)[1].strip().strip('"').strip("'")
                        # SQLite URL: "file:./prisma/dev.db" hoặc "file:prisma/dev.db"
                        if val.startswith("file:"):
                            path = val[5:].lstrip("/")
                            if os.path.exists(path):
                                return path
                            # Thử relative từ project root
                            if path.startswith("./"):
                                path = path[2:]
                            if os.path.exists(path):
                                return path

    # 2. Fallback: tìm tất cả *.db trong prisma/ và thư mục hiện tại
    candidates = glob.glob("prisma/*.db") + glob.glob("*.db")
    if candidates:
        # Ưu tiên dev.db, rồi prod.db, rồi cái đầu tiên tìm được
        for priority in ["dev.db", "prod.db"]:
            for c in candidates:
                if os.path.basename(c) == priority:
                    return c
        return candidates[0]

    return None

def export_sqlite():
    """Export tất cả data từ SQLite sang JSON (chạy trên máy nhà)"""
    import sqlite3

    db_path = find_sqlite_db()
    if not db_path:
        print("❌ Không tìm thấy file SQLite!")
        print("   Thử các cách sau:")
        print("   • Kiểm tra DATABASE_URL trong .env có dạng: file:./prisma/dev.db")
        print("   • Đảm bảo bạn đang chạy script từ thư mục gốc dự án (D:\\BOT\\adn-ai-bot)")
        sys.exit(1)

    print(f"📂 Tìm thấy SQLite database: {db_path}")
    conn = sqlite3.connect(db_path)
    conn.row_factory = sqlite3.Row
    cursor = conn.cursor()

    # Lấy danh sách tất cả bảng (bỏ qua bảng system của SQLite và Prisma)
    cursor.execute("""
        SELECT name FROM sqlite_master
        WHERE type='table'
          AND name NOT LIKE 'sqlite_%'
          AND name NOT LIKE '_prisma_%'
        ORDER BY name
    """)
    tables = [row[0] for row in cursor.fetchall()]

    print(f"   Tìm thấy {len(tables)} bảng: {', '.join(tables)}\n")

    export = {}
    for table in tables:
        cursor.execute(f'SELECT * FROM "{table}"')
        rows = cursor.fetchall()
        export[table] = [dict(row) for row in rows]
        print(f"  ✓ {table}: {len(rows)} rows")

    conn.close()

    with open("sqlite_export.json", "w", encoding="utf-8") as f:
        json.dump(export, f, ensure_ascii=False, indent=2, default=str)

    total = sum(len(v) for v in export.values())
    print(f"\n✅ Exported {total} rows → sqlite_export.json")
    print("   Tiếp theo chạy: scp sqlite_export.json root@14.225.204.117:/home/adncapital/app/adn-capital/")


def convert_value(col, val):
    """Convert SQLite values sang dạng tương thích PostgreSQL."""
    from datetime import datetime, timezone
    if val is None:
        return None
    # Boolean columns (SQLite lưu 0/1)
    bool_cols = {"dnseVerified", "isActive", "enableAIReview"}
    if col in bool_cols:
        return bool(val)
    # Timestamp columns (SQLite lưu milliseconds hoặc ISO string)
    ts_cols = {"createdAt", "updatedAt", "expires", "vipUntil", "dnseAppliedAt",
               "expiresAt", "paidAt", "closedAt", "publishedAt", "tradeDate"}
    if col in ts_cols and val is not None:
        if isinstance(val, (int, float)):
            # Milliseconds since epoch
            try:
                return datetime.fromtimestamp(val / 1000, tz=timezone.utc).isoformat()
            except Exception:
                return None
        # Đã là string ISO → trả nguyên
        return val
    return val

def import_to_pg():
    """Import data từ JSON vào PostgreSQL (chạy trên VPS)"""
    import psycopg2
    from psycopg2.extras import execute_values

    db_url = os.environ.get("DATABASE_URL")
    if not db_url:
        print("❌ DATABASE_URL không được set")
        sys.exit(1)

    if not os.path.exists("sqlite_export.json"):
        print("❌ Không tìm thấy sqlite_export.json")
        sys.exit(1)

    with open("sqlite_export.json", "r", encoding="utf-8") as f:
        data = json.load(f)

    conn = psycopg2.connect(db_url)
    cursor = conn.cursor()

    # Import theo thứ tự (tránh foreign key constraint)
    TABLE_ORDER = [
        "User", "Account", "Session", "VerificationToken",
        "PaymentOrder", "Chat", "Signal", "TradingJournal",
        "CourseRegistration", "MarginConsultation", "Notification",
        "MarketReport", "CronLog", "ChatKnowledge", "PropTrading",
        "PushSubscription", "AvatarUpload", "Changelog",
        "Category", "Article", "AiInsightCache", "SystemSetting"
    ]

    for table in TABLE_ORDER:
        rows = data.get(table, [])
        if not rows:
            print(f"  - {table}: 0 rows (bỏ qua)")
            continue

        columns = list(rows[0].keys())
        values = [
            [convert_value(col, row.get(col)) for col in columns]
            for row in rows
        ]

        try:
            col_str = ", ".join([f'"{c}"' for c in columns])
            execute_values(
                cursor,
                f'INSERT INTO "{table}" ({col_str}) VALUES %s ON CONFLICT DO NOTHING',
                values
            )
            conn.commit()
            print(f"  ✓ {table}: {len(rows)} rows imported")
        except Exception as e:
            conn.rollback()
            print(f"  ❌ {table}: {e}")

    cursor.close()
    conn.close()
    print("\n✅ Import hoàn tất!")


if __name__ == "__main__":
    mode = sys.argv[1] if len(sys.argv) > 1 else "help"
    
    if mode == "export":
        print("📤 Exporting SQLite data...")
        export_sqlite()
    elif mode == "import":
        print("📥 Importing to PostgreSQL...")
        import_to_pg()
    else:
        print(__doc__)
