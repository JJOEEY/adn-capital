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

export async function GET() {
  // Trả cache nếu còn tươi
  if (cache && Date.now() - cache.ts < TTL) {
    return NextResponse.json(cache.data);
  }

  try {
    const res = await fetch(`${BACKEND}/api/v1/market-overview`, {
      cache: "no-store",
      signal: AbortSignal.timeout(30_000),
    });

    if (!res.ok) {
      const text = await res.text();
      console.error("[/api/market-overview] Backend error:", res.status, text);
      return NextResponse.json(
        { error: "Không lấy được dữ liệu từ backend" },
        { status: 502 },
      );
    }

    const data = await res.json();
    cache = { data, ts: Date.now() };
    return NextResponse.json(data);
  } catch (err) {
    console.error("[/api/market-overview] Fetch error:", err);
    return NextResponse.json(
      { error: "Backend không phản hồi" },
      { status: 502 },
    );
  }
}
