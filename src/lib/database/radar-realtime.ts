import type { Prisma } from "@prisma/client";
import type { DatabaseProviderStatus, DatabaseResult } from "@/lib/database/contracts";
import { databaseOk } from "@/lib/database/contracts";
import { getRealtimeCache, setRealtimeCache } from "@/lib/database/realtime-cache";
import { getDatabaseToolLatest, listDatabaseToolLatest, upsertDatabaseToolLatest } from "@/lib/database/tool-latest";
import { prisma } from "@/lib/prisma";
import { collectDnseLightspeedMessages } from "@/lib/providers/dnse/lightspeed-ws";
import { RADAR_SCAN_BUDGET } from "@/lib/signals/radar-scan-config";
import { DNSE_DEFAULT_EOD_SYMBOLS, normalizeDnseSymbol } from "./providers/dnse/eod-map";

type JsonRecord = Record<string, unknown>;

export type DatabaseRadarTick = {
  ticker: string;
  price: number | null;
  reference: number | null;
  change: number | null;
  changePct: number | null;
  volume: number | null;
  value: number | null;
  high: number | null;
  low: number | null;
  sourceChannel: string;
  providerTime: string | null;
  updatedAt: string;
};

export type DatabaseRadarRealtimeState = {
  dataset: "radar.realtime";
  mode: "dnse-websocket-hotlist";
  tradingDate: string;
  tickers: string[];
  latest: DatabaseRadarTick[];
  coverage: {
    requested: number;
    covered: number;
    coveragePct: number;
  };
  websocket: {
    opened: boolean;
    authenticated: boolean;
    receivedMessages: number;
    errors: string[];
  };
  updatedAt: string;
};

let collectInFlight: Promise<DatabaseResult<DatabaseRadarRealtimeState>> | null = null;

function dateKeyInVietnam(date = new Date()) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Ho_Chi_Minh",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
}

function asRecord(value: unknown): JsonRecord {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as JsonRecord) : {};
}

function toNumber(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string") {
    const cleaned = value.replace(/[^\d.,-]/g, "").replace(/,/g, "").trim();
    if (!cleaned) return null;
    const parsed = Number(cleaned);
    if (Number.isFinite(parsed)) return parsed;
  }
  return null;
}

function readString(record: JsonRecord, keys: string[]) {
  for (const key of keys) {
    const value = record[key];
    if (typeof value === "string" && value.trim()) return value.trim();
    if (typeof value === "number" && Number.isFinite(value)) return String(value);
  }
  return null;
}

function readNumber(record: JsonRecord, keys: string[]) {
  for (const key of keys) {
    const value = toNumber(record[key]);
    if (value != null) return value;
  }
  return null;
}

function readProviderTime(record: JsonRecord) {
  const raw = readNumber(record, ["transactTime", "timestamp", "time", "t"]);
  if (raw == null || raw <= 0) return null;
  const ms = raw > 10_000_000_000 ? raw : raw * 1000;
  const date = new Date(ms);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

function channelFromMessage(message: JsonRecord) {
  return readString(message, ["channel", "ch", "topic", "stream"]) ?? "tick_extra.G1.json";
}

function symbolFromMessage(message: JsonRecord) {
  return normalizeDnseSymbol(readString(message, ["symbol", "Symbol", "s", "ticker", "code"]));
}

function tickFromMessage(message: JsonRecord): DatabaseRadarTick | null {
  const ticker = symbolFromMessage(message);
  if (!ticker) return null;
  const price = readNumber(message, ["matchPrice", "lastPrice", "price", "close", "c"]);
  const reference = readNumber(message, ["reference", "refPrice", "basicPrice", "priorClosePrice", "previousClose"]);
  const change = readNumber(message, ["changedValue", "change", "priceChange"]);
  const changePct = readNumber(message, ["changedRatio", "changePct", "percentChange"]);
  const volume = readNumber(message, ["totalVolumeTraded", "matchVolume", "volume", "v"]);
  const value = readNumber(message, ["grossTradeAmount", "tradingValue", "matchValue", "value"]);
  const computedChange = change ?? (price != null && reference != null ? price - reference : null);
  return {
    ticker,
    price,
    reference,
    change: computedChange,
    changePct: changePct ?? (price != null && reference ? Number((((price - reference) / reference) * 100).toFixed(2)) : null),
    volume,
    value,
    high: readNumber(message, ["highestPrice", "high", "h"]),
    low: readNumber(message, ["lowestPrice", "low", "l"]),
    sourceChannel: channelFromMessage(message),
    providerTime: readProviderTime(message),
    updatedAt: new Date().toISOString(),
  };
}

async function loadRadarHotlist(limit: number) {
  const rows = await prisma.signal.findMany({
    where: { status: { in: ["RADAR", "ACTIVE", "HOLD_TO_DIE"] } },
    orderBy: [{ updatedAt: "desc" }, { createdAt: "desc" }],
    take: limit,
    select: { ticker: true },
  });
  const tickers = [
    ...rows.map((row) => row.ticker),
    ...DNSE_DEFAULT_EOD_SYMBOLS,
  ].map(normalizeDnseSymbol).filter(Boolean);
  return Array.from(new Set(tickers)).slice(0, limit);
}

function cacheRadarState(state: DatabaseRadarRealtimeState) {
  setRealtimeCache("database.radar.realtime", "latest", state, 90_000);
  for (const tick of state.latest) {
    setRealtimeCache("database.radar.tick", tick.ticker, tick, 90_000);
  }
}

async function persistRadarState(state: DatabaseRadarRealtimeState) {
  await upsertDatabaseToolLatest({
    tool: "radar",
    dataset: "radar.realtime",
    key: "latest",
    tradingDate: state.tradingDate,
    payload: state,
    missingFields: state.coverage.covered ? [] : ["radar.realtime.ticks"],
    providerStatus: state.websocket,
  });
  await Promise.all(
    state.latest.map((tick) =>
      upsertDatabaseToolLatest({
        tool: "radar",
        dataset: "radar.realtime.tick",
        key: tick.ticker,
        tradingDate: state.tradingDate,
        payload: tick,
        missingFields: tick.price == null ? ["tick.price"] : [],
        providerStatus: { provider: "dnse", ok: tick.price != null, endpoint: "wss:lightspeed" },
      }),
    ),
  );
}

async function collectRadarRealtimeInternal(options?: {
  timeoutMs?: number;
  maxMessages?: number;
  tickers?: string[];
}): Promise<DatabaseResult<DatabaseRadarRealtimeState>> {
  const startedAt = Date.now();
  const tradingDate = dateKeyInVietnam();
  const tickers = options?.tickers?.length
    ? Array.from(new Set(options.tickers.map(normalizeDnseSymbol).filter(Boolean))).slice(0, RADAR_SCAN_BUDGET.hotScanMaxTickers)
    : await loadRadarHotlist(RADAR_SCAN_BUDGET.hotScanMaxTickers);
  const ws = await collectDnseLightspeedMessages({
    subscriptions: [{ name: "tick_extra.G1.json", symbols: tickers }],
    timeoutMs: options?.timeoutMs ?? 50_000,
    maxMessages: options?.maxMessages ?? 2_000,
  });
  const latestByTicker = new Map<string, DatabaseRadarTick>();
  for (const raw of ws.messages) {
    const tick = tickFromMessage(asRecord(raw));
    if (!tick || !tickers.includes(tick.ticker)) continue;
    latestByTicker.set(tick.ticker, tick);
  }
  const latest = Array.from(latestByTicker.values()).sort((a, b) => a.ticker.localeCompare(b.ticker));
  const state: DatabaseRadarRealtimeState = {
    dataset: "radar.realtime",
    mode: "dnse-websocket-hotlist",
    tradingDate,
    tickers,
    latest,
    coverage: {
      requested: tickers.length,
      covered: latest.length,
      coveragePct: tickers.length ? Number(((latest.length / tickers.length) * 100).toFixed(2)) : 0,
    },
    websocket: {
      opened: ws.opened,
      authenticated: ws.authenticated,
      receivedMessages: ws.messages.length,
      errors: ws.errors,
    },
    updatedAt: new Date().toISOString(),
  };
  cacheRadarState(state);
  await persistRadarState(state);
  const missingFields = [
    !ws.opened ? "websocket.open" : null,
    !ws.authenticated ? "websocket.auth" : null,
    latest.length === 0 ? "radar.realtime.ticks" : null,
  ].filter((item): item is string => Boolean(item));
  const providerStatus: DatabaseProviderStatus = {
    provider: "dnse",
    ok: missingFields.length === 0,
    endpoint: "wss://ws-openapi.dnse.com.vn/v1/stream",
    latencyMs: Date.now() - startedAt,
    code: missingFields.length ? "database_v2_radar_realtime_partial" : undefined,
    message: ws.errors[0],
    retryable: missingFields.length > 0,
  };
  return databaseOk("radar.realtime", "dnse", state, providerStatus, missingFields);
}

export async function collectDatabaseRadarRealtime(options?: {
  timeoutMs?: number;
  maxMessages?: number;
  tickers?: string[];
}): Promise<DatabaseResult<DatabaseRadarRealtimeState>> {
  if (collectInFlight) return collectInFlight;
  collectInFlight = collectRadarRealtimeInternal(options).finally(() => {
    collectInFlight = null;
  });
  return collectInFlight;
}

export async function getDatabaseRadarRealtime(): Promise<DatabaseResult<DatabaseRadarRealtimeState>> {
  const startedAt = Date.now();
  const cached = getRealtimeCache<DatabaseRadarRealtimeState>("database.radar.realtime", "latest");
  const record = cached
    ? { payload: cached.value, updatedAt: cached.updatedAt, source: "cache" }
    : await getDatabaseToolLatest<DatabaseRadarRealtimeState>({
        tool: "radar",
        dataset: "radar.realtime",
        key: "latest",
        maxAgeMs: 24 * 60 * 60_000,
        ignoreExpires: true,
      }).then((row) => row ? { payload: row.payload, updatedAt: row.updatedAt, source: "postgres" } : null);
  const data = record?.payload ?? null;
  const missingFields = data?.latest.length ? [] : ["radar.realtime.latest"];
  return databaseOk("radar.realtime", "database", data as DatabaseRadarRealtimeState, {
    provider: "database",
    ok: missingFields.length === 0,
    endpoint: record?.source === "cache" ? "memory:realtime-cache" : "postgres:DatabaseToolLatest",
    latencyMs: Date.now() - startedAt,
    code: missingFields.length ? "database_v2_radar_realtime_empty" : undefined,
    retryable: missingFields.length > 0,
  }, missingFields);
}

export async function getDatabaseRealtimeHealth() {
  const latest = await getDatabaseToolLatest<DatabaseRadarRealtimeState>({
    tool: "radar",
    dataset: "radar.realtime",
    key: "latest",
    maxAgeMs: 24 * 60 * 60_000,
    ignoreExpires: true,
  });
  const ticks = await listDatabaseToolLatest<DatabaseRadarTick>({
    tool: "radar",
    dataset: "radar.realtime.tick",
    limit: 500,
    maxAgeMs: 24 * 60 * 60_000,
    ignoreExpires: true,
  });
  const staleCutoffMs = Math.max(30_000, Number(process.env.DATABASE_REALTIME_HEALTH_STALE_MS ?? 90_000));
  const now = Date.now();
  const staleTicks = ticks.filter((row) => now - Date.parse(row.updatedAt) > staleCutoffMs);
  const freshTicks = ticks.length - staleTicks.length;
  const missingFields = [
    !latest ? "radar.realtime.latest" : null,
    ticks.length === 0 ? "radar.realtime.ticks" : null,
    ticks.length > 0 && freshTicks === 0 ? "radar.realtime.fresh_ticks" : null,
  ].filter((item): item is string => Boolean(item));
  const status = missingFields.length === 0
    ? "ok"
    : latest || ticks.length
      ? "degraded"
      : "blocked";
  return {
    ok: missingFields.length === 0,
    status,
    checkedAt: new Date().toISOString(),
    radar: {
      latestUpdatedAt: latest?.updatedAt ?? null,
      tickRows: ticks.length,
      freshTickRows: freshTicks,
      staleTickCount: staleTicks.length,
      coverage: latest?.payload.coverage ?? null,
    },
    missingFields,
  };
}
