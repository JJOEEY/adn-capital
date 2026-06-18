import { NextRequest, NextResponse } from "next/server";
import type { Prisma } from "@prisma/client";
import {
  alignMarketPriceToAnchor,
  applyMarketPriceScale,
  getMarketPayloadRows,
  marketPriceScaleFromPayload,
} from "@/lib/market-price-normalization";
import { prisma } from "@/lib/prisma";
import { getPythonBridgeUrl } from "@/lib/runtime-config";

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
  source: "database_v2";
  cached?: boolean;
  realtime?: boolean;
};

type CacheEntry = {
  expiresAt: number;
  payload: ChartPayload;
};

const chartCache = new Map<string, CacheEntry>();
const inFlightRequests = new Map<string, Promise<ChartPayload>>();
const CHART_CACHE_TTL_MS = 5 * 60 * 1000;
const INTRADAY_CACHE_TTL_MS = 5_000;
const DAILY_CHANNEL = "ohlcv.1D";
const LEGACY_DNSE_DAILY_CHANNEL = "ohlc_closed.1D.json";
const MIN_DAILY_BARS = Math.max(30, Number(process.env.ADN_STOCK_CHART_MIN_DAILY_BARS ?? 180));
const BOOTSTRAP_DAYS = Math.max(MIN_DAILY_BARS + 40, Number(process.env.ADN_STOCK_CHART_BOOTSTRAP_DAYS ?? 1825));
const LATEST_TICK_STALE_MS = Math.max(30_000, Number(process.env.ADN_STOCK_CHART_LATEST_STALE_MS ?? 90_000));
// Khung intraday (1m–4h) lấy on-demand từ bridge historical (mỗi khung 1 lần gọi, cache 5s qua
// INTRADAY_CACHE_TTL_MS). Số ngày lịch sử theo khung — khung lớn lấy nhiều ngày hơn.
const INTRADAY_BRIDGE_DAYS: Record<string, number> = { "1m": 5, "5m": 10, "15m": 20, "30m": 30, "1h": 60, "4h": 180 };

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

function positiveNumber(value: number | null | undefined): number | null {
  return value != null && Number.isFinite(value) && value > 0 ? value : null;
}

function toInputJson(value: unknown): Prisma.InputJsonValue {
  return JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue;
}

function vnDateKey(date = new Date()) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Ho_Chi_Minh",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
}

function subtractTradingDays(dateKey: string, days: number) {
  const date = new Date(`${dateKey}T00:00:00+07:00`);
  let remaining = days;
  while (remaining > 0) {
    date.setDate(date.getDate() - 1);
    const weekday = date.getDay();
    if (weekday !== 0 && weekday !== 6) remaining -= 1;
  }
  return vnDateKey(date);
}

function isVnMarketClosed() {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "Asia/Ho_Chi_Minh",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).formatToParts(new Date());
  const rawHour = Number(parts.find((part) => part.type === "hour")?.value ?? 0);
  const hour = rawHour === 24 ? 0 : rawHour;
  const minute = Number(parts.find((part) => part.type === "minute")?.value ?? 0);
  return hour * 60 + minute >= 15 * 60 + 5;
}

function candleDateKey(candle: Candle) {
  return vnDateKey(new Date(candle.time * 1000));
}

function unixTimeForDateKey(dateKey: string) {
  return Math.floor(Date.parse(`${dateKey}T00:00:00+07:00`) / 1000);
}

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : {};
}

function readTickUpdatedAt(payload: Record<string, unknown>, fallback: Date) {
  const raw = payload.updatedAt ?? payload.providerTime;
  if (typeof raw === "string" && raw.trim()) {
    const parsed = Date.parse(raw);
    if (Number.isFinite(parsed)) return parsed;
  }
  return fallback.getTime();
}

function normalizeRowPayload(row: {
  source: string;
  channel: string;
  tradingDate: string;
  providerTime: Date | null;
  payload: Prisma.JsonValue;
  updatedAt: Date;
}): (Candle & { source: string; tradingDate: string; isFinal: boolean; updatedAt: number }) | null {
  const payload = row.payload && typeof row.payload === "object" ? (row.payload as Record<string, unknown>) : {};
  const time = readUnixTime(payload.time ?? payload.timestamp ?? payload.date ?? row.tradingDate);
  const scale = marketPriceScaleFromPayload(payload);
  const open = applyMarketPriceScale(readNumber(payload, ["open", "openPrice", "o"]), scale);
  const high = applyMarketPriceScale(readNumber(payload, ["high", "highestPrice", "h"]), scale);
  const low = applyMarketPriceScale(readNumber(payload, ["low", "lowestPrice", "l"]), scale);
  const close = applyMarketPriceScale(readNumber(payload, ["close", "matchPrice", "c", "price"]), scale);
  const volume = readNumber(payload, ["volume", "v", "totalVolumeTraded"]) ?? 0;
  const cleanOpen = positiveNumber(open);
  const cleanHigh = positiveNumber(high);
  const cleanLow = positiveNumber(low);
  const cleanClose = positiveNumber(close);
  if (time == null || cleanOpen == null || cleanHigh == null || cleanLow == null || cleanClose == null) return null;
  const explicitFinal = typeof payload.isFinal === "boolean" ? payload.isFinal : null;
  const today = vnDateKey();
  const isToday = row.tradingDate === today;
  const isFinal = explicitFinal ?? (row.source === "fiinquant" || !isToday || isVnMarketClosed());
  return {
    time,
    open: cleanOpen,
    high: cleanHigh,
    low: cleanLow,
    close: cleanClose,
    volume,
    source: row.source,
    tradingDate: row.tradingDate,
    isFinal,
    updatedAt: row.updatedAt.getTime(),
  };
}

function sourcePriority(source: string) {
  if (source === "dnse") return 3;
  if (source === "fiinquant") return 2;
  return 1;
}

function pickBetterDailyRow(
  current: ReturnType<typeof normalizeRowPayload> | undefined,
  next: NonNullable<ReturnType<typeof normalizeRowPayload>>,
) {
  if (!current) return next;
  if (Number(next.isFinal) !== Number(current.isFinal)) return next.isFinal ? next : current;
  const sourceDiff = sourcePriority(next.source) - sourcePriority(current.source);
  if (sourceDiff !== 0) return sourceDiff > 0 ? next : current;
  return next.updatedAt >= current.updatedAt ? next : current;
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
      const cleanOpen = positiveNumber(open);
      const cleanHigh = positiveNumber(high);
      const cleanLow = positiveNumber(low);
      const cleanClose = positiveNumber(close);
      if (time == null || cleanOpen == null || cleanHigh == null || cleanLow == null || cleanClose == null) return null;
      return { time, open: cleanOpen, high: cleanHigh, low: cleanLow, close: cleanClose, volume };
    })
    .filter((value): value is Candle => value !== null)
    .sort((a, b) => a.time - b.time)
    .filter((c, i, arr) => i === 0 || c.time !== arr[i - 1].time);
}

async function readDailyCandlesFromDatabase(symbol: string) {
  const rows = await prisma.databaseMarketLatest.findMany({
    where: {
      dataset: "market.ohlcv",
      symbol,
      channel: { in: [DAILY_CHANNEL, LEGACY_DNSE_DAILY_CHANNEL] },
    },
    orderBy: [{ tradingDate: "asc" }, { updatedAt: "desc" }],
    take: 2500,
  });
  const byDate = new Map<string, NonNullable<ReturnType<typeof normalizeRowPayload>>>();
  for (const row of rows) {
    const candle = normalizeRowPayload(row);
    if (!candle) continue;
    byDate.set(row.tradingDate, pickBetterDailyRow(byDate.get(row.tradingDate), candle));
  }
  return Array.from(byDate.values())
    .sort((a, b) => a.time - b.time)
    .map(({ source: _source, tradingDate: _tradingDate, isFinal: _isFinal, updatedAt: _updatedAt, ...candle }) => candle);
}

async function getDailyCoverage(symbol: string) {
  const [count, latest] = await Promise.all([
    prisma.databaseMarketLatest.count({
      where: {
        dataset: "market.ohlcv",
        symbol,
        channel: { in: [DAILY_CHANNEL, LEGACY_DNSE_DAILY_CHANNEL] },
      },
    }),
    prisma.databaseMarketLatest.findFirst({
      where: {
        dataset: "market.ohlcv",
        symbol,
        channel: { in: [DAILY_CHANNEL, LEGACY_DNSE_DAILY_CHANNEL] },
      },
      orderBy: { tradingDate: "desc" },
      select: { tradingDate: true },
    }),
  ]);
  return { count, latestTradingDate: latest?.tradingDate ?? null };
}

function hasFreshEnoughDailyData(coverage: Awaited<ReturnType<typeof getDailyCoverage>>) {
  if (coverage.count < MIN_DAILY_BARS || !coverage.latestTradingDate) return false;
  return coverage.latestTradingDate >= subtractTradingDays(vnDateKey(), 2);
}

async function fetchFiinquantHistorical(symbol: string) {
  const backend = getPythonBridgeUrl();
  const res = await fetch(
    `${backend}/api/v1/historical/${encodeURIComponent(symbol)}?days=${BOOTSTRAP_DAYS}&timeframe=1d&adjusted=true`,
    { cache: "no-store", signal: AbortSignal.timeout(45_000) },
  );
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`fiinquant historical ${symbol} HTTP ${res.status}: ${text.slice(0, 200)}`);
  }
  const payload = await res.json();
  const candles = normalizeCandles(payload);
  if (candles.length < Math.min(MIN_DAILY_BARS, 60)) {
    throw new Error(`fiinquant historical ${symbol} returned insufficient candles: ${candles.length}`);
  }
  return candles;
}

async function fetchFiinquantIntraday(symbol: string, timeframe: string): Promise<Candle[]> {
  const backend = getPythonBridgeUrl();
  const days = INTRADAY_BRIDGE_DAYS[timeframe] ?? 10;
  const res = await fetch(
    `${backend}/api/v1/historical/${encodeURIComponent(symbol)}?days=${days}&timeframe=${encodeURIComponent(timeframe)}&adjusted=true`,
    { cache: "no-store", signal: AbortSignal.timeout(30_000) },
  );
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`fiinquant intraday ${symbol} ${timeframe} HTTP ${res.status}: ${text.slice(0, 200)}`);
  }
  // normalizeCandles xử lý sẵn: parse datetime "YYYY-MM-DD HH:MM" + chuẩn hoá thang giá (VND→hiển thị).
  return normalizeCandles(await res.json());
}

async function bootstrapDailyCandles(symbol: string) {
  const candles = await fetchFiinquantHistorical(symbol);
  for (let index = 0; index < candles.length; index += 50) {
    const chunk = candles.slice(index, index + 50);
    await Promise.all(chunk.map((candle) => {
      const tradingDate = candleDateKey(candle);
      return prisma.databaseMarketLatest.upsert({
        where: {
          source_channel_symbol_tradingDate: {
            source: "fiinquant",
            channel: DAILY_CHANNEL,
            symbol,
            tradingDate,
          },
        },
        create: {
          source: "fiinquant",
          dataset: "market.ohlcv",
          channel: DAILY_CHANNEL,
          symbol,
          tradingDate,
          providerTime: new Date(candle.time * 1000),
          payload: toInputJson({ ...candle, date: tradingDate, isFinal: true }),
        },
        update: {
          dataset: "market.ohlcv",
          providerTime: new Date(candle.time * 1000),
          payload: toInputJson({ ...candle, date: tradingDate, isFinal: true }),
        },
      });
    }));
  }
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

// Detect corporate-action adjustments (dividends/splits): the cached daily candles
// can keep a pre-ex-date price while the bridge already returns the adjusted value.
// Date-based freshness can't see this (the date still looks current), so compare the
// latest cached close against the bridge's current adjusted close.
async function fetchBridgeLatestCandle(symbol: string): Promise<Candle | null> {
  try {
    const backend = getPythonBridgeUrl();
    const res = await fetch(
      `${backend}/api/v1/historical/${encodeURIComponent(symbol)}?days=10&timeframe=1d&adjusted=true`,
      { cache: "no-store", signal: AbortSignal.timeout(15_000) },
    );
    if (!res.ok) return null;
    return normalizeCandles(await res.json()).at(-1) ?? null;
  } catch {
    return null;
  }
}

async function readLatestStoredCandle(symbol: string) {
  const row = await prisma.databaseMarketLatest.findFirst({
    where: { dataset: "market.ohlcv", symbol, channel: { in: [DAILY_CHANNEL, LEGACY_DNSE_DAILY_CHANNEL] } },
    orderBy: { tradingDate: "desc" },
  });
  return row ? normalizeRowPayload(row) : null;
}

async function dailyCacheIsStale(symbol: string): Promise<boolean> {
  const [stored, bridge] = await Promise.all([
    readLatestStoredCandle(symbol),
    fetchBridgeLatestCandle(symbol),
  ]);
  if (!stored || !bridge || bridge.close <= 0) return false;
  // Bridge has a newer session, or the same session's close diverged (>1%) → re-fetch.
  if (bridge.time > stored.time) return true;
  return Math.abs(stored.close - bridge.close) / bridge.close > 0.01;
}

async function loadChartData(symbol: string, timeframe: string, force: boolean): Promise<ChartPayload> {
  if (isIntradayTimeframe(timeframe)) {
    const candles = await fetchFiinquantIntraday(symbol, timeframe);
    if (!candles.length) {
      throw new Error("CHART_INTRADAY_UNAVAILABLE");
    }
    const payload: ChartPayload = { symbol, timeframe, candles, source: "database_v2" };
    setCache(payload);
    return payload;
  }
  let needBootstrap = force || !hasFreshEnoughDailyData(await getDailyCoverage(symbol));
  if (!needBootstrap) {
    needBootstrap = await dailyCacheIsStale(symbol);
  }
  if (needBootstrap) {
    await bootstrapDailyCandles(symbol);
  }
  const candles = aggregateCandles(await readDailyCandlesFromDatabase(symbol), timeframe);
  if (!candles.length) {
    throw new Error("CHART_DATABASE_V2_UNAVAILABLE");
  }

  const payload: ChartPayload = { symbol, timeframe, candles, source: "database_v2" };
  setCache(payload);
  return payload;
}

async function readLatestRadarTick(symbol: string) {
  const row = await prisma.databaseToolLatest.findFirst({
    where: {
      tool: "radar",
      dataset: "radar.realtime.tick",
      key: symbol,
    },
    orderBy: { updatedAt: "desc" },
  });
  if (row) {
    return { payload: asRecord(row.payload), updatedAt: row.updatedAt };
  }

  const state = await prisma.databaseToolLatest.findFirst({
    where: {
      tool: "radar",
      dataset: "radar.realtime",
      key: "latest",
    },
    orderBy: { updatedAt: "desc" },
  });
  const latest = Array.isArray(asRecord(state?.payload).latest) ? asRecord(state?.payload).latest as unknown[] : [];
  const tick = latest.map(asRecord).find((item) => String(item.ticker ?? "").toUpperCase() === symbol);
  return tick && state ? { payload: tick, updatedAt: state.updatedAt } : null;
}

function mergeTickIntoDailyCandle(symbol: string, dailyCandles: Candle[], tickPayload: Record<string, unknown>, tickUpdatedAt: Date): Candle | null {
  void symbol;
  void tickUpdatedAt;
  const today = vnDateKey();
  const base = dailyCandles.find((candle) => candleDateKey(candle) === today) ?? null;
  const previous = [...dailyCandles].reverse().find((candle) => candleDateKey(candle) < today) ?? dailyCandles.at(-1) ?? null;
  const anchor = positiveNumber(base?.close) ?? positiveNumber(previous?.close);
  const price = alignMarketPriceToAnchor(readNumber(tickPayload, ["price", "matchPrice", "lastPrice", "close"]), anchor);
  if (price == null || price <= 0) return null;
  const todayTime = unixTimeForDateKey(today);
  const reference = alignMarketPriceToAnchor(readNumber(tickPayload, ["reference", "refPrice", "previousClose"]), anchor) ?? positiveNumber(previous?.close) ?? price;
  const open = positiveNumber(base?.open) ?? reference ?? price;
  const highTick = alignMarketPriceToAnchor(readNumber(tickPayload, ["high", "highestPrice"]), price);
  const lowTick = alignMarketPriceToAnchor(readNumber(tickPayload, ["low", "lowestPrice"]), price);
  const volume = readNumber(tickPayload, ["volume", "totalVolumeTraded"]) ?? base?.volume ?? 0;
  const high = Math.max(positiveNumber(base?.high) ?? open, highTick ?? price, price, open);
  const low = Math.min(positiveNumber(base?.low) ?? open, lowTick ?? price, price, open);
  return {
    time: base?.time ?? todayTime,
    open,
    high,
    low,
    close: price,
    volume,
  };
}

async function loadLatestChartCandle(symbol: string, timeframe: string): Promise<ChartPayload | null> {
  if (isIntradayTimeframe(timeframe)) return null;

  const tick = await readLatestRadarTick(symbol);
  if (!tick) return null;
  const tickUpdatedAt = readTickUpdatedAt(tick.payload, tick.updatedAt);
  if (Date.now() - tickUpdatedAt > LATEST_TICK_STALE_MS) return null;

  const dailyCandles = await readDailyCandlesFromDatabase(symbol);
  const latestDaily = mergeTickIntoDailyCandle(symbol, dailyCandles, tick.payload, tick.updatedAt);
  if (!latestDaily) return null;
  if (timeframe === "1D") {
    return { symbol, timeframe, candles: [latestDaily], source: "database_v2", realtime: true };
  }

  const today = candleDateKey(latestDaily);
  const mergedDaily = dailyCandles.filter((candle) => candleDateKey(candle) !== today).concat(latestDaily);
  const candles = aggregateCandles(mergedDaily, timeframe);
  const latest = candles.at(-1);
  return latest ? { symbol, timeframe, candles: [latest], source: "database_v2", realtime: true } : null;
}

export async function GET(req: NextRequest) {
  const symbol = req.nextUrl.searchParams.get("symbol")?.toUpperCase();
  if (!symbol || !/^[A-Z0-9]{2,10}$/.test(symbol)) {
    return NextResponse.json({ error: "Invalid symbol" }, { status: 400 });
  }
  const timeframe = normalizeTimeframe(req.nextUrl.searchParams.get("timeframe"));
  const force = req.nextUrl.searchParams.get("force") === "1";
  const latestOnly = req.nextUrl.searchParams.get("latest") === "1";

  if (latestOnly) {
    const payload = await loadLatestChartCandle(symbol, timeframe);
    return payload ? NextResponse.json(payload) : new NextResponse(null, { status: 204 });
  }

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
