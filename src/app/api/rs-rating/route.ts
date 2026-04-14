import { NextResponse } from "next/server";

/**
 * RS Rating API — Proxy → Python FastAPI /api/v1/rs-rating
 * Dữ liệu tính từ FiinQuantX (200 mã), xếp hạng percentile CANSLIM.
 * Cache 15 phút.
 */

const BACKEND = process.env.FIINQUANT_URL ?? process.env.PYTHON_BRIDGE_URL ?? "http://localhost:8000";

let cache: { data: unknown; ts: number } | null = null;
const CACHE_TTL = 15 * 60 * 1000; // 15 phút

export async function GET() {
  /* Cache hit */
  if (cache && Date.now() - cache.ts < CACHE_TTL) {
    return NextResponse.json(cache.data);
  }

  try {
    const res = await fetch(`${BACKEND}/api/v1/rs-rating`, {
      cache: "no-store",
      signal: AbortSignal.timeout(60_000),
    });

    if (!res.ok) {
      const text = await res.text();
      console.error("[/api/rs-rating] Backend error:", res.status, text);
      return NextResponse.json(
        { error: "Không lấy được dữ liệu RS Rating" },
        { status: 502 },
      );
    }

    const json = await res.json();
    const rawStocks: {
      ticker: string;
      sector: string;
      close: number;
      prev_close?: number;
      rs_rating: number;
    }[] = json.data ?? [];

    /* Map sang format frontend cần */
    const stocks = rawStocks.map((s) => {
      const change = s.prev_close ? +(s.close - s.prev_close).toFixed(2) : 0;
      const changePercent =
        s.prev_close && s.prev_close > 0
          ? +((change / s.prev_close) * 100).toFixed(2)
          : 0;

      return {
        symbol: s.ticker,
        name: s.ticker,
        sector: s.sector,
        price: s.close,
        change,
        changePercent,
        volume: 0,
        rsScore: 0,
        rsRating: s.rs_rating,
      };
    });

    const response = {
      stocks,
      cached: false,
      updatedAt: json.updated_at ?? new Date().toISOString(),
    };

    cache = { data: response, ts: Date.now() };
    return NextResponse.json(response);
  } catch (err) {
    console.error("[/api/rs-rating] Fetch error:", err);
    return NextResponse.json(
      { error: "Backend không phản hồi" },
      { status: 502 },
    );
  }
}
