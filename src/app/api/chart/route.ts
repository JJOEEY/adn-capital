import { NextRequest, NextResponse } from "next/server";

const FIINQUANT_BRIDGE = "http://localhost:8000";

const DCHART_BASE = "https://dchart-api.vndirect.com.vn/dchart/history";
const DCHART_HEADERS: HeadersInit = {
  "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
  Accept: "*/*",
  Referer: "https://dchart.vndirect.com.vn/",
  Origin: "https://dchart.vndirect.com.vn",
};

/**
 * Lấy nến OHLCV từ FiinQuant Bridge (ưu tiên) → fallback VNDirect dchart.
 */
export async function GET(req: NextRequest) {
  const symbol = req.nextUrl.searchParams.get("symbol")?.toUpperCase();
  if (!symbol || !/^[A-Z0-9]{2,10}$/.test(symbol)) {
    return NextResponse.json({ error: "Invalid symbol" }, { status: 400 });
  }

  // ── 1. Thử FiinQuant Bridge trước ──────────────────────────────────────
  try {
    const bridgeUrl = `${FIINQUANT_BRIDGE}/api/v1/historical/${symbol}?days=365&timeframe=1d`;
    console.log(`[Chart] FiinQuant Bridge: ${bridgeUrl}`);

    const res = await fetch(bridgeUrl, {
      signal: AbortSignal.timeout(10000),
      cache: "no-store",
    });

    if (res.ok) {
      const json = await res.json();
      if (json.data?.length) {
        const candles = json.data.map((d: Record<string, unknown>) => {
          // timestamp có thể là ISO string hoặc unix
          let time: number;
          if (typeof d.timestamp === "string") {
            time = Math.floor(new Date(d.timestamp as string).getTime() / 1000);
          } else {
            time = d.timestamp as number;
          }
          return {
            time,
            open: d.open ?? 0,
            high: d.high ?? 0,
            low: d.low ?? 0,
            close: d.close ?? 0,
            volume: d.volume ?? 0,
          };
        });
        console.log(`[Chart] ${symbol}: FiinQuant OK – ${candles.length} nến`);
        return NextResponse.json({ symbol, candles, source: "fiinquant" });
      }
    }
    console.warn(`[Chart] ${symbol}: FiinQuant trả lỗi ${res.status}, fallback VNDirect`);
  } catch (err) {
    console.warn(`[Chart] ${symbol}: FiinQuant Bridge không phản hồi, fallback VNDirect`, err);
  }

  // ── 2. Fallback VNDirect dchart ────────────────────────────────────────
  try {
    const now = Math.floor(Date.now() / 1000);
    const from = now - 365 * 86400;
    const url = `${DCHART_BASE}?resolution=D&symbol=${symbol}&from=${from}&to=${now}`;

    const res = await fetch(url, {
      headers: DCHART_HEADERS,
      signal: AbortSignal.timeout(8000),
      cache: "no-store",
    });

    if (!res.ok) return NextResponse.json({ error: "Upstream error" }, { status: 502 });
    const json = await res.json();
    if (json.s !== "ok" || !json.c?.length) {
      return NextResponse.json({ error: "No data" }, { status: 404 });
    }

    const SCALE = 1000;
    const candles = json.t.map((t: number, i: number) => ({
      time: t,
      open: +(json.o[i] * SCALE).toFixed(0),
      high: +(json.h[i] * SCALE).toFixed(0),
      low: +(json.l[i] * SCALE).toFixed(0),
      close: +(json.c[i] * SCALE).toFixed(0),
      volume: json.v?.[i] ?? 0,
    }));

    console.log(`[Chart] ${symbol}: VNDirect fallback OK – ${candles.length} nến`);
    return NextResponse.json({ symbol, candles, source: "vndirect" });
  } catch {
    return NextResponse.json(
      { error: "Hệ thống Dữ liệu đang bảo trì, vui lòng thử lại sau" },
      { status: 503 }
    );
  }
}
