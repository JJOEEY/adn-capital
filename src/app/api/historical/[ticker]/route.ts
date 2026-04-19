/**
 * API proxy → Python FastAPI  GET /api/v1/historical/{ticker}
 * Returns OHLCV data for any ticker (VN30, VNM, FPT, etc.)
 * Cache 5 minutes.
 */

import { NextResponse } from "next/server";
import { getPythonBridgeUrl } from "@/lib/runtime-config";

const BACKEND = getPythonBridgeUrl();

const cache = new Map<string, { data: unknown; ts: number }>();
const TTL = 300_000; // 5 min

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ ticker: string }> },
) {
  const { ticker } = await params;
  const upper = ticker.toUpperCase().trim();
  const cacheKey = upper;

  const cached = cache.get(cacheKey);
  if (cached && Date.now() - cached.ts < TTL) {
    return NextResponse.json(cached.data);
  }

  try {
    const res = await fetch(
      `${BACKEND}/api/v1/historical/${encodeURIComponent(upper)}?days=300&timeframe=1d`,
      { cache: "no-store", signal: AbortSignal.timeout(30_000) },
    );

    if (!res.ok) {
      const text = await res.text();
      console.error(`[/api/historical/${upper}] Backend error:`, res.status, text);
      return NextResponse.json(
        { error: `Không lấy được dữ liệu ${upper}` },
        { status: 502 },
      );
    }

    const data = await res.json();
    cache.set(cacheKey, { data, ts: Date.now() });
    return NextResponse.json(data);
  } catch (err) {
    console.error(`[/api/historical/${upper}] Fetch error:`, err);
    return NextResponse.json(
      { error: "Backend không phản hồi" },
      { status: 502 },
    );
  }
}
