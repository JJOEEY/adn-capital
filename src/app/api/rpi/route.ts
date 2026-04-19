/**
 * API proxy → Python FastAPI  GET /api/v1/rpi
 * Trả về chỉ báo Điểm Đảo Chiều (RPI) cho VN30.
 * Cache 5 phút.
 */

import { NextResponse } from "next/server";
import { getPythonBridgeUrl } from "@/lib/runtime-config";

export const revalidate = 300;

let cache: { data: unknown; ts: number } | null = null;
const TTL = 300_000; // 5 phút

const BACKEND = getPythonBridgeUrl();

export async function GET() {
  if (cache && Date.now() - cache.ts < TTL) {
    return NextResponse.json(cache.data);
  }

  try {
    const res = await fetch(`${BACKEND}/api/v1/rpi`, {
      cache: "no-store",
      signal: AbortSignal.timeout(30_000),
    });

    if (!res.ok) {
      const text = await res.text();
      console.error("[/api/rpi] Backend error:", res.status, text);
      return NextResponse.json(
        { error: "Không lấy được dữ liệu RPI" },
        { status: 502 },
      );
    }

    const data = await res.json();
    cache = { data, ts: Date.now() };
    return NextResponse.json(data);
  } catch (err) {
    console.error("[/api/rpi] Fetch error:", err);
    return NextResponse.json(
      { error: "Backend không phản hồi" },
      { status: 502 },
    );
  }
}
