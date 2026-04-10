import { NextResponse } from "next/server";
import fs from "fs";
import path from "path";

/**
 * API trả về Composite Score và Market Status từ cache.
 * Giúp Dashboard load ngay lập tức mà không cần chờ Python bridge.
 */

const CACHE_FILE = path.join(process.cwd(), "market_cache.json");

export async function GET() {
  try {
    if (fs.existsSync(CACHE_FILE)) {
      const data = fs.readFileSync(CACHE_FILE, "utf-8");
      return NextResponse.json(JSON.parse(data));
    }
  } catch (err) {
    console.error("[/api/market-status] Cache read error:", err);
  }

  // Fallback nếu chưa có cache
  return NextResponse.json({
    score: 0,
    max_score: 14,
    level: 1,
    status_badge: "⏳ Đang tải...",
    market_breadth: "Đang cập nhật...",
    action_message: "Hệ thống đang tính toán dữ liệu vĩ mô, vui lòng chờ trong giây lát...",
    last_updated: new Date().toISOString()
  });
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    fs.writeFileSync(CACHE_FILE, JSON.stringify({
      ...body,
      last_updated: new Date().toISOString()
    }, null, 2));
    return NextResponse.json({ success: true });
  } catch (err) {
    return NextResponse.json({ error: "Failed to save cache" }, { status: 500 });
  }
}
