/**
 * API proxy → Python FastAPI  GET /api/v1/market-overview
 * Trả về điểm sức mạnh VN-INDEX + thanh khoản + xu hướng.
 * Cache 24h để tránh gọi backend liên tục.
 * Sau khi fetch thành công, tự động lưu vào market_cache.json để /api/market-status đọc.
 */

import { NextResponse } from "next/server";
import fs from "fs";
import path from "path";

const CACHE_FILE = path.join(process.cwd(), "market_cache.json");
const BACKEND = process.env.FIINQUANT_URL ?? process.env.PYTHON_BRIDGE_URL ?? "http://localhost:8000";
const TTL = 86_400_000; // 24h

let cache: { data: any; ts: number } | null = null;
let isRefreshing = false;

// Khởi tạo in-memory cache từ file nếu có
function loadCacheFromFile() {
  if (cache) return;
  try {
    if (fs.existsSync(CACHE_FILE)) {
      const raw = fs.readFileSync(CACHE_FILE, "utf-8");
      const data = JSON.parse(raw);
      cache = { data, ts: Date.now() - 1000 };
      console.log("[/api/market-overview] Loaded cache from file");
    }
  } catch {}
}

function saveCacheToFile(data: any) {
  try {
    fs.writeFileSync(CACHE_FILE, JSON.stringify({
      ...data,
      last_updated: new Date().toISOString()
    }, null, 2));
  } catch (err) {
    console.error("[/api/market-overview] Failed to save cache file:", err);
  }
}

export async function GET() {
  try {
    if (fs.existsSync(CACHE_FILE)) {
      const raw = fs.readFileSync(CACHE_FILE, "utf-8");
      const data = JSON.parse(raw);
      return NextResponse.json(data);
    }
  } catch (err) {
    console.error("[/api/market-overview] Cache read error:", err);
  }

  // Fallback nếu chưa có cache (Tuyệt đối không gọi live bridge)
  return NextResponse.json({
    score: 0,
    max_score: 14,
    level: 1,
    status_badge: "⏳ Đang cập nhật...",
    market_breadth: "Đang tính toán...",
    action_message: "Hệ thống đang cập nhật dữ liệu vĩ mô, vui lòng quay lại sau.",
    last_updated: new Date().toISOString()
  });
}

