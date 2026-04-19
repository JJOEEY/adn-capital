import { NextRequest, NextResponse } from "next/server";
import { getPythonBridgeUrl } from "@/lib/runtime-config";

const FIINQUANT_BRIDGE = getPythonBridgeUrl();

const DCHART_BASE = "https://dchart-api.vndirect.com.vn/dchart/history";
const DCHART_HEADERS: HeadersInit = {
  "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
  Accept: "*/*",
  Referer: "https://dchart.vndirect.com.vn/",
  Origin: "https://dchart.vndirect.com.vn",
};

type Candle = {
  time: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
};

type ChartPayload = {
  symbol: string;
  candles: Candle[];
  source: "vndirect" | "fiinquant";
  cached?: boolean;
};

type CacheEntry = {
  expiresAt: number;
  payload: ChartPayload;
};

const chartCache = new Map<string, CacheEntry>();
const inFlightRequests = new Map<string, Promise<ChartPayload>>();
const CHART_CACHE_TTL_MS = 5 * 60 * 1000;

function getCache(symbol: string): ChartPayload | null {
  const key = symbol.toUpperCase();
  const cached = chartCache.get(key);
  if (!cached) return null;
  if (cached.expiresAt < Date.now()) {
    chartCache.delete(key);
    return null;
  }
  return { ...cached.payload, cached: true };
}

function setCache(payload: ChartPayload): void {
  chartCache.set(payload.symbol.toUpperCase(), {
    expiresAt: Date.now() + CHART_CACHE_TTL_MS,
    payload,
  });
}

async function fetchFromVnDirect(symbol: string): Promise<Candle[] | null> {
  const now = Math.floor(Date.now() / 1000);
  const from = now - 365 * 86400;
  const url = `${DCHART_BASE}?resolution=D&symbol=${symbol}&from=${from}&to=${now}`;

  const res = await fetch(url, {
    headers: DCHART_HEADERS,
    signal: AbortSignal.timeout(8000),
    cache: "no-store",
  });
  if (!res.ok) return null;

  const json = await res.json();
  if (json.s !== "ok" || !json.c?.length) return null;

  const SCALE = 1000;
  return json.t
    .map((t: number, i: number) => ({
      time: t,
      open: +(json.o[i] * SCALE).toFixed(0),
      high: +(json.h[i] * SCALE).toFixed(0),
      low: +(json.l[i] * SCALE).toFixed(0),
      close: +(json.c[i] * SCALE).toFixed(0),
      volume: json.v?.[i] ?? 0,
    }))
    .sort((a: Candle, b: Candle) => a.time - b.time)
    .filter((c: Candle, i: number, arr: Candle[]) => i === 0 || c.time !== arr[i - 1].time);
}

async function fetchFromFiinQuant(symbol: string): Promise<Candle[] | null> {
  const bridgeUrl = `${FIINQUANT_BRIDGE}/api/v1/historical/${symbol}?days=365&timeframe=1d`;

  const res = await fetch(bridgeUrl, {
    signal: AbortSignal.timeout(10000),
    cache: "no-store",
  });
  if (!res.ok) return null;

  const json = await res.json();
  if (!json.data?.length) return null;

  return json.data
    .map((d: Record<string, unknown>) => {
      let time: number;
      if (typeof d.date === "string") {
        const dateOnly = (d.date as string).split(" ")[0];
        time = Math.floor(new Date(`${dateOnly}T00:00:00Z`).getTime() / 1000);
      } else if (typeof d.timestamp === "string") {
        const dateOnly = (d.timestamp as string).split(" ")[0];
        time = Math.floor(new Date(`${dateOnly}T00:00:00Z`).getTime() / 1000);
      } else if (typeof d.timestamp === "number") {
        time = d.timestamp as number;
      } else {
        return null;
      }

      return {
        time,
        open: Number(d.open ?? 0),
        high: Number(d.high ?? 0),
        low: Number(d.low ?? 0),
        close: Number(d.close ?? 0),
        volume: Number(d.volume ?? 0),
      };
    })
    .filter((value: Candle | null): value is Candle => value !== null)
    .sort((a: Candle, b: Candle) => a.time - b.time)
    .filter((c: Candle, i: number, arr: Candle[]) => i === 0 || c.time !== arr[i - 1].time);
}

async function loadChartData(symbol: string): Promise<ChartPayload> {
  try {
    const vnCandles = await fetchFromVnDirect(symbol);
    if (vnCandles?.length) {
      const payload: ChartPayload = { symbol, candles: vnCandles, source: "vndirect" };
      setCache(payload);
      return payload;
    }
  } catch (error) {
    console.warn(`[Chart] ${symbol}: VNDirect error`, error);
  }

  const fiinCandles = await fetchFromFiinQuant(symbol);
  if (fiinCandles?.length) {
    const payload: ChartPayload = { symbol, candles: fiinCandles, source: "fiinquant" };
    setCache(payload);
    return payload;
  }

  throw new Error("CHART_DATA_UNAVAILABLE");
}

export async function GET(req: NextRequest) {
  const symbol = req.nextUrl.searchParams.get("symbol")?.toUpperCase();
  if (!symbol || !/^[A-Z0-9]{2,10}$/.test(symbol)) {
    return NextResponse.json({ error: "Invalid symbol" }, { status: 400 });
  }

  const cached = getCache(symbol);
  if (cached) return NextResponse.json(cached);

  const inflight = inFlightRequests.get(symbol);
  if (inflight) {
    try {
      const payload = await inflight;
      return NextResponse.json({ ...payload, cached: true });
    } catch {
      // Continue to normal flow
    }
  }

  const requestPromise = loadChartData(symbol);
  inFlightRequests.set(symbol, requestPromise);

  try {
    const payload = await requestPromise;
    return NextResponse.json(payload);
  } catch {
    return NextResponse.json(
      { error: "Hệ thống dữ liệu đang bảo trì, vui lòng thử lại sau." },
      { status: 503 }
    );
  } finally {
    inFlightRequests.delete(symbol);
  }
}
