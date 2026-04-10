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

def export_sqlite():
    """Export tất cả data từ SQLite sang JSON (chạy trên máy nhà)"""
    import sqlite3
    
    db_path = "prisma/prod.db"
    if not os.path.exists(db_path):
        print(f"❌ Không tìm thấy {db_path}")
        sys.exit(1)
    
    conn = sqlite3.connect(db_path)
    conn.row_factory = sqlite3.Row
    cursor = conn.cursor()
    
    # Lấy danh sách tất cả bảng
    cursor.execute("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' AND name NOT LIKE '_prisma_%'")
    tables = [row[0] for row in cursor.fetchall()]
    
    export = {}
    for table in tables:
        cursor.execute(f"SELECT * FROM \"{table}\"")
        rows = cursor.fetchall()
        export[table] = [dict(row) for row in rows]
        print(f"  ✓ {table}: {len(rows)} rows")
    
    conn.close()
    
    with open("sqlite_export.json", "w", encoding="utf-8") as f:
        json.dump(export, f, ensure_ascii=False, indent=2, default=str)
    
    print(f"\n✅ Exported {sum(len(v) for v in export.values())} rows to sqlite_export.json")

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
    
    # Parse PostgreSQL URL
    # postgresql://user:pass@host:port/dbname
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
        values = [[row.get(col) for col in columns] for row in rows]
        
        # Convert Boolean strings (SQLite lưu 0/1 thay vì True/False)
        for i, row in enumerate(values):
            for j, val in enumerate(row):
                if val == 0:
                    # Check if column is Boolean type
                    if columns[j] in ["dnseVerified", "isActive", "enableAIReview"]:
                        values[i][j] = False
                elif val == 1:
                    if columns[j] in ["dnseVerified", "isActive", "enableAIReview"]:
                        values[i][j] = True
        
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
