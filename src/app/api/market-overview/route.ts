/**
 * API proxy → Python FastAPI  GET /api/v1/market-overview
 * Trả về điểm sức mạnh VN-INDEX + thanh khoản + xu hướng.
 * Cache 60s để tránh gọi backend liên tục.
 */

import { NextResponse } from "next/server";

export const revalidate = 300; // 5 phút Next.js cache

let cache: { data: unknown; ts: number } | null = null;
const TTL = 86_400_000; // 24h (End of day)

const BACKEND = process.env.FIINQUANT_URL ?? "http://localhost:8000";

// Biến global để theo dõi trạng thái refresh ngầm
let isRefreshing = false;

export async function GET() {
  const now = Date.now();

  // 1. Trả cache ngay nếu còn tươi (TTL 24h)
  if (cache && now - cache.ts < TTL) {
    return NextResponse.json(cache.data);
  }

  // 2. Nếu cache hết hạn nhưng đang có data cũ và đang refresh ngầm -> trả data cũ
  if (cache && isRefreshing) {
    return NextResponse.json(cache.data);
  }

  // 3. Nếu không có cache hoặc cache quá cũ -> Fetch mới
  try {
    isRefreshing = true;
    const res = await fetch(`${BACKEND}/api/v1/market-overview`, {
      cache: "no-store",
      signal: AbortSignal.timeout(120_000), // Tăng lên 120s vì bridge scan rất lâu
    });

    if (!res.ok) {
      const text = await res.text();
      console.error("[/api/market-overview] Backend error:", res.status, text);
      
      // Fallback: nếu lỗi nhưng có cache cũ (dù hết hạn) -> trả cache cũ
      if (cache) {
        isRefreshing = false;
        return NextResponse.json(cache.data);
      }

      return NextResponse.json(
        { error: "Không lấy được dữ liệu từ backend" },
        { status: 502 },
      );
    }

    const data = await res.json();
    cache = { data, ts: Date.now() };
    isRefreshing = false;
    return NextResponse.json(data);
  } catch (err) {
    console.error("[/api/market-overview] Fetch error:", err);
    isRefreshing = false;

    // Fallback: trả cache cũ nếu có
    if (cache) {
      return NextResponse.json(cache.data);
    }

    return NextResponse.json(
      { error: "Backend không phản hồi" },
      { status: 502 },
    );
  }
}
