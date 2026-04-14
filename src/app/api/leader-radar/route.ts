/**
 * API proxy → Python FastAPI  GET /api/v1/leader-radar
 * Trả về trạng thái Cầu Dao Tổng + Leaders + Circuit Breaker.
 * Cache 5 phút.
 */

import { NextResponse } from "next/server";

export const revalidate = 300;

let cache: { data: unknown; ts: number } | null = null;
const TTL = 300_000; // 5 phút

const BACKEND = process.env.FIINQUANT_URL ?? process.env.PYTHON_BRIDGE_URL ?? "http://localhost:8000";

export async function GET() {
  if (cache && Date.now() - cache.ts < TTL) {
    return NextResponse.json(cache.data);
  }

  try {
    const res = await fetch(`${BACKEND}/api/v1/leader-radar`, {
      cache: "no-store",
      signal: AbortSignal.timeout(30_000),
    });

    if (!res.ok) {
      const text = await res.text();
      console.error("[/api/leader-radar] Backend error:", res.status, text);
      return NextResponse.json(
        { error: "Không lấy được dữ liệu Leader Radar" },
        { status: 502 },
      );
    }

    const data = await res.json();
    cache = { data, ts: Date.now() };
    return NextResponse.json(data);
  } catch (err) {
    console.error("[/api/leader-radar] Fetch error:", err);
    return NextResponse.json(
      { error: "Backend không phản hồi" },
      { status: 502 },
    );
  }
}
