import { NextRequest, NextResponse } from "next/server";
import { getTopicEnvelope } from "@/lib/datahub/core";
import {
  applyMarketPriceScale,
  getMarketPayloadRows,
  marketPriceScaleFromPayload,
} from "@/lib/market-price-normalization";

const VALID_TIMEFRAMES = new Set(["1m", "5m", "15m", "30m", "1D"]);

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
  timeframe: string;
  source: "datahub";
  cached?: boolean;
};

type CacheEntry = {
  expiresAt: number;
  payload: ChartPayload;
};

const chartCache = new Map<string, CacheEntry>();
const inFlightRequests = new Map<string, Promise<ChartPayload>>();
const CHART_CACHE_TTL_MS = 5 * 60 * 1000;

function getCache(cacheKey: string): ChartPayload | null {
  const key = cacheKey.toUpperCase();
  const cached = chartCache.get(key);
  if (!cached) return null;
  if (cached.expiresAt < Date.now()) {
    chartCache.delete(key);
    return null;
  }
  return { ...cached.payload, cached: true };
}

function setCache(payload: ChartPayload): void {
  chartCache.set(`${payload.symbol.toUpperCase()}:${payload.timeframe.toUpperCase()}`, {
    expiresAt: Date.now() + CHART_CACHE_TTL_MS,
    payload,
  });
}

function normalizeTimeframe(value: string | null): string {
  const raw = value?.trim() || "1D";
  const normalized = raw.toLowerCase() === "1d" || raw.toUpperCase() === "D" ? "1D" : raw;
  return VALID_TIMEFRAMES.has(normalized) ? normalized : "1D";
}

function readUnixTime(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value > 10_000_000_000 ? Math.floor(value / 1000) : Math.floor(value);
  }
  if (typeof value !== "string" || !value.trim()) return null;
  const text = value.trim();
  const normalized = text.includes("T")
    ? text
    : text.includes(" ")
      ? `${text.replace(" ", "T")}+07:00`
      : `${text}T00:00:00+07:00`;
  const timestamp = Date.parse(normalized);
  return Number.isFinite(timestamp) ? Math.floor(timestamp / 1000) : null;
}

function readNumber(row: Record<string, unknown>, keys: string[]): number | null {
  for (const key of keys) {
    const value = Number(row[key]);
    if (Number.isFinite(value)) return value;
  }
  return null;
}

function normalizeCandles(payload: unknown): Candle[] {
  if (!payload || typeof payload !== "object") return [];
  const rows = getMarketPayloadRows(payload);
  const scale = marketPriceScaleFromPayload(payload);

  return rows
    .map((row) => {
      const item = row as Record<string, unknown>;
      const time = readUnixTime(item.time ?? item.timestamp ?? item.date);
      const open = applyMarketPriceScale(readNumber(item, ["open", "o"]), scale);
      const high = applyMarketPriceScale(readNumber(item, ["high", "h"]), scale);
      const low = applyMarketPriceScale(readNumber(item, ["low", "l"]), scale);
      const close = applyMarketPriceScale(readNumber(item, ["close", "c", "price"]), scale);
      const volume = readNumber(item, ["volume", "v"]) ?? 0;
      if (time == null || open == null || high == null || low == null || close == null) return null;
      return { time, open, high, low, close, volume };
    })
    .filter((value): value is Candle => value !== null)
    .sort((a, b) => a.time - b.time)
    .filter((c, i, arr) => i === 0 || c.time !== arr[i - 1].time);
}

async function loadCandlesFromTopic(symbol: string, timeframe: string, force: boolean): Promise<Candle[]> {
  const topic =
    timeframe === "1D"
      ? `vn:historical:${symbol}:1d`
      : `vn:realtime:${symbol}:${timeframe}`;
  const envelope = await getTopicEnvelope(topic, { force });
  const candles = normalizeCandles(envelope.value);
  if (candles.length > 0) return candles;
  throw new Error(envelope.error?.message ?? "CHART_DATA_UNAVAILABLE");
}

async function loadChartData(symbol: string, timeframe: string, force: boolean): Promise<ChartPayload> {
  let candles = await loadCandlesFromTopic(symbol, timeframe, force);

  if (timeframe !== "1D" && candles.length < 20) {
    candles = await loadCandlesFromTopic(symbol, "1D", force);
  }

  const payload: ChartPayload = { symbol, timeframe, candles, source: "datahub" };
  setCache(payload);
  return payload;
}

export async function GET(req: NextRequest) {
  const symbol = req.nextUrl.searchParams.get("symbol")?.toUpperCase();
  if (!symbol || !/^[A-Z0-9]{2,10}$/.test(symbol)) {
    return NextResponse.json({ error: "Invalid symbol" }, { status: 400 });
  }
  const timeframe = normalizeTimeframe(req.nextUrl.searchParams.get("timeframe"));
  const force = req.nextUrl.searchParams.get("force") === "1";

  const cached = force ? null : getCache(`${symbol}:${timeframe}`);
  if (cached) return NextResponse.json(cached);

  const requestKey = `${symbol}:${timeframe.toUpperCase()}`;
  const inflight = inFlightRequests.get(requestKey);
  if (inflight) {
    try {
      const payload = await inflight;
      return NextResponse.json({ ...payload, cached: true });
    } catch {
      // Continue to normal flow
    }
  }

  const requestPromise = loadChartData(symbol, timeframe, force);
  inFlightRequests.set(requestKey, requestPromise);

  try {
    const payload = await requestPromise;
    return NextResponse.json(payload);
  } catch {
    return NextResponse.json(
      { error: "Hệ thống dữ liệu đang bảo trì, vui lòng thử lại sau." },
      { status: 503 }
    );
  } finally {
    inFlightRequests.delete(requestKey);
  }
}
