import { NextRequest, NextResponse } from "next/server";
import { getTopicEnvelope } from "@/lib/datahub/core";
import {
  applyMarketPriceScale,
  getMarketPayloadRows,
  marketPriceScaleFromPayload,
} from "@/lib/market-price-normalization";

const VALID_TIMEFRAMES = new Set(["1m", "5m", "15m", "30m", "1h", "4h", "1D", "1W", "1M"]);

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
const INTRADAY_CACHE_TTL_MS = 5_000;

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

function isIntradayTimeframe(timeframe: string) {
  return ["1m", "5m", "15m", "30m", "1h", "4h"].includes(timeframe);
}

function setCache(payload: ChartPayload): void {
  chartCache.set(`${payload.symbol.toUpperCase()}:${payload.timeframe.toUpperCase()}`, {
    expiresAt: Date.now() + (isIntradayTimeframe(payload.timeframe) ? INTRADAY_CACHE_TTL_MS : CHART_CACHE_TTL_MS),
    payload,
  });
}

function normalizeTimeframe(value: string | null): string {
  const raw = value?.trim() || "1D";
  const upper = raw.toUpperCase();
  const lower = raw.toLowerCase();
  const normalized =
    lower === "1d" || upper === "D"
      ? "1D"
      : lower === "1w" || upper === "W"
        ? "1W"
        : raw === "1M" || upper === "M"
          ? "1M"
          : lower === "1m" || lower === "5m" || lower === "15m" || lower === "30m" || lower === "1h" || lower === "4h"
            ? lower
            : raw;
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

function aggregateIntradayCandles(candles: Candle[], minutes: number): Candle[] {
  const buckets = new Map<string, Candle>();
  const offsetSeconds = 7 * 60 * 60;
  for (const candle of candles) {
    const local = new Date((candle.time + offsetSeconds) * 1000);
    const dateKey = `${local.getUTCFullYear()}-${String(local.getUTCMonth() + 1).padStart(2, "0")}-${String(local.getUTCDate()).padStart(2, "0")}`;
    const minuteOfDay = local.getUTCHours() * 60 + local.getUTCMinutes();
    const bucketMinute = Math.floor(minuteOfDay / minutes) * minutes;
    const key = `${dateKey}-${bucketMinute}`;
    const existing = buckets.get(key);
    if (!existing) {
      buckets.set(key, { ...candle });
      continue;
    }
    existing.high = Math.max(existing.high, candle.high);
    existing.low = Math.min(existing.low, candle.low);
    existing.close = candle.close;
    existing.volume += candle.volume;
    existing.time = candle.time;
  }
  return Array.from(buckets.values()).sort((a, b) => a.time - b.time);
}

function aggregateCandles(candles: Candle[], timeframe: string): Candle[] {
  if (timeframe === "1h") return aggregateIntradayCandles(candles, 60);
  if (timeframe === "4h") return aggregateIntradayCandles(candles, 240);
  if (timeframe !== "1W" && timeframe !== "1M") return candles;
  const buckets = new Map<string, Candle>();
  for (const candle of candles) {
    const date = new Date(candle.time * 1000);
    const key =
      timeframe === "1M"
        ? `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}`
        : `${date.getUTCFullYear()}-${String(getIsoWeek(date)).padStart(2, "0")}`;
    const existing = buckets.get(key);
    if (!existing) {
      buckets.set(key, { ...candle });
      continue;
    }
    existing.high = Math.max(existing.high, candle.high);
    existing.low = Math.min(existing.low, candle.low);
    existing.close = candle.close;
    existing.volume += candle.volume;
    existing.time = candle.time;
  }
  return Array.from(buckets.values()).sort((a, b) => a.time - b.time);
}

function getIsoWeek(date: Date) {
  const target = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
  const day = target.getUTCDay() || 7;
  target.setUTCDate(target.getUTCDate() + 4 - day);
  const yearStart = new Date(Date.UTC(target.getUTCFullYear(), 0, 1));
  return Math.ceil((((target.getTime() - yearStart.getTime()) / 86400000) + 1) / 7);
}

async function loadCandlesFromTopic(symbol: string, timeframe: string, force: boolean): Promise<Candle[]> {
  const sourceTimeframe = timeframe === "1h" || timeframe === "4h" ? "30m" : timeframe;
  const topic =
    sourceTimeframe === "1D" || sourceTimeframe === "1W" || sourceTimeframe === "1M"
      ? `vn:historical:${symbol}:1d`
      : `vn:realtime:${symbol}:${sourceTimeframe}`;
  const envelope = await getTopicEnvelope(topic, { force });
  const candles = normalizeCandles(envelope.value);
  if (candles.length > 0) return candles;
  throw new Error(envelope.error?.message ?? "CHART_DATA_UNAVAILABLE");
}

async function loadChartData(symbol: string, timeframe: string, force: boolean): Promise<ChartPayload> {
  let candles = await loadCandlesFromTopic(symbol, timeframe, force);

  if (timeframe !== "1D" && timeframe !== "1W" && timeframe !== "1M" && candles.length < 20) {
    candles = await loadCandlesFromTopic(symbol, "1D", force);
  }
  candles = aggregateCandles(candles, timeframe);

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
