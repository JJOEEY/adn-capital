// Thu nến intraday 1 PHÚT THẬT từ DNSE WS kênh `ohlc.1m.json` (OHLCV đúng từng phút), lưu vào
// database-v2 để chart đọc nến hôm nay tươi (bridge chỉ có lịch sử trễ). KHÁC HẲN cách codex cũ
// (synth nến từ snapshot tick_extra tích lũy → high/low/volume sai). KHÔNG Redis, KHÔNG module codex.
// Toàn bộ gated sau cờ CHART_INTRADAY_DNSE_ENABLED (mặc định OFF) — gọi từ cron đã bọc try/catch.
import { prisma } from "@/lib/prisma";
import { collectDnseLightspeedMessages } from "@/lib/providers/dnse/lightspeed-ws";
import { listDatabaseToolLatest, upsertDatabaseToolLatest } from "@/lib/database/tool-latest";
import { normalizeDnseSymbol } from "@/lib/database/providers/dnse/eod-map";

const TOOL = "chart";
const DATASET_1M = "market.ohlcv.intraday.1m";
const ACTIVE_DATASET = "chart.active";
const SOURCE = "dnse_ws";
const ACTIVE_TTL_MS = Number(process.env.CHART_ACTIVE_TICKER_TTL_MS ?? 30 * 60_000);
const ACTIVE_LIMIT = Number(process.env.CHART_ACTIVE_TICKER_LIMIT ?? 120);
const BARS_TTL_MS = Number(process.env.CHART_INTRADAY_BARS_TTL_DAYS ?? 3) * 24 * 60 * 60_000;
const MAX_BARS = Number(process.env.CHART_INTRADAY_MAX_BARS ?? 420);

export type IntradayBar = { time: number; open: number; high: number; low: number; close: number; volume: number };
type ParsedBar = { ticker: string; tradingDate: string; minuteKey: string; bar: IntradayBar };
type JsonRecord = Record<string, unknown>;

export function isChartIntradayDnseEnabled() {
  return process.env.CHART_INTRADAY_DNSE_ENABLED === "true";
}

function asRecord(value: unknown): JsonRecord {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as JsonRecord) : {};
}

function num(record: JsonRecord, keys: string[]): number | null {
  for (const key of keys) {
    const value = record[key];
    if (typeof value === "number" && Number.isFinite(value)) return value;
    if (typeof value === "string" && value.trim()) {
      const parsed = Number(value);
      if (Number.isFinite(parsed)) return parsed;
    }
  }
  return null;
}

function str(record: JsonRecord, keys: string[]): string | null {
  for (const key of keys) {
    const value = record[key];
    if (typeof value === "string" && value.trim()) return value.trim();
  }
  return null;
}

function dateKeyInVietnam(date = new Date()) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Ho_Chi_Minh",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
}

// Quy về phút (VN tz): tradingDate YYYY-MM-DD, minuteKey HHMM, time = unix giây đầu phút.
function vnMinuteParts(date: Date) {
  const local = new Date(date.getTime() + 7 * 60 * 60 * 1000);
  const y = local.getUTCFullYear();
  const mo = String(local.getUTCMonth() + 1).padStart(2, "0");
  const d = String(local.getUTCDate()).padStart(2, "0");
  const hh = String(local.getUTCHours()).padStart(2, "0");
  const mm = String(local.getUTCMinutes()).padStart(2, "0");
  return {
    tradingDate: `${y}-${mo}-${d}`,
    minuteKey: `${hh}${mm}`,
    time: Math.floor(Date.parse(`${y}-${mo}-${d}T${hh}:${mm}:00+07:00`) / 1000),
  };
}

function readBarTime(record: JsonRecord) {
  const epoch = num(record, ["time", "t", "timestamp", "ts", "tradingTime"]);
  if (epoch != null && epoch > 0) {
    const ms = epoch > 1e12 ? epoch : epoch * 1000;
    const date = new Date(ms);
    if (!Number.isNaN(date.getTime())) return vnMinuteParts(date);
  }
  const text = str(record, ["time", "date", "datetime", "tradingTime"]);
  if (text) {
    const norm = text.includes("T") ? text : text.includes(" ") ? `${text.replace(" ", "T")}+07:00` : null;
    if (norm) {
      const date = new Date(norm);
      if (!Number.isNaN(date.getTime())) return vnMinuteParts(date);
    }
  }
  return null;
}

// Parse 1 message ohlc.1m.json → nến. Field reader linh hoạt (shape DNSE chưa chốt → xác minh sample
// live ở B2). Bắt buộc có đủ open/high/low/close → loại message không phải nến OHLC.
export function parseOhlcBarMessage(message: unknown): ParsedBar | null {
  const record = asRecord(message);
  const ticker = normalizeDnseSymbol(str(record, ["symbol", "Symbol", "s", "ticker", "code"]));
  if (!ticker) return null;
  const open = num(record, ["open", "o", "openPrice"]);
  const high = num(record, ["high", "h", "highestPrice"]);
  const low = num(record, ["low", "l", "lowestPrice"]);
  const close = num(record, ["close", "c", "closePrice", "matchPrice", "lastPrice", "price"]);
  if (open == null || high == null || low == null || close == null) return null;
  const volume = num(record, ["volume", "v", "totalVolume", "matchVolume", "totalVolumeTraded"]) ?? 0;
  const time = readBarTime(record);
  if (!time) return null;
  return { ticker, tradingDate: time.tradingDate, minuteKey: time.minuteKey, bar: { time: time.time, open, high, low, close, volume } };
}

// Upsert idempotent (mỗi nến 1 row, key=TICKER:HHMM) — KHÔNG read-modify-write nên không race như codex.
export async function upsertIntradayBars(bars: ParsedBar[]): Promise<number> {
  let persisted = 0;
  for (let i = 0; i < bars.length; i += 25) {
    const chunk = bars.slice(i, i + 25);
    await Promise.all(
      chunk.map((item) =>
        upsertDatabaseToolLatest({
          tool: TOOL,
          dataset: DATASET_1M,
          key: `${item.ticker}:${item.minuteKey}`,
          tradingDate: item.tradingDate,
          source: SOURCE,
          payload: { ticker: item.ticker, ...item.bar },
          ttlMs: BARS_TTL_MS,
        }).then(() => {
          persisted += 1;
        }),
      ),
    );
  }
  return persisted;
}

// Đọc nến 1m của 1 mã trong ngày (chỉ source=dnse_ws → bỏ data rác cũ của codex source=database_v2).
export async function listIntradayBars(ticker: string, tradingDate = dateKeyInVietnam()): Promise<IntradayBar[]> {
  const normalized = normalizeDnseSymbol(ticker);
  if (!normalized) return [];
  const rows = await prisma.databaseToolLatest.findMany({
    where: { tool: TOOL, dataset: DATASET_1M, source: SOURCE, tradingDate, key: { startsWith: `${normalized}:` } },
    orderBy: { key: "asc" },
    take: MAX_BARS,
  });
  return rows
    .map((row) => {
      const payload = asRecord(row.payload);
      const time = num(payload, ["time"]);
      const open = num(payload, ["open"]);
      const high = num(payload, ["high"]);
      const low = num(payload, ["low"]);
      const close = num(payload, ["close"]);
      if (time == null || open == null || high == null || low == null || close == null) return null;
      return { time, open, high, low, close, volume: num(payload, ["volume"]) ?? 0 };
    })
    .filter((bar): bar is IntradayBar => bar != null)
    .sort((a, b) => a.time - b.time);
}

// Mã đang được xem chart (để collector chỉ thu intraday cho mã active → bound volume). DB-based, không Redis.
export async function registerChartActiveTicker(ticker: string): Promise<void> {
  const normalized = normalizeDnseSymbol(ticker);
  if (!normalized) return;
  await upsertDatabaseToolLatest({
    tool: TOOL,
    dataset: ACTIVE_DATASET,
    key: normalized,
    source: "chart",
    payload: { ticker: normalized },
    ttlMs: ACTIVE_TTL_MS,
  });
}

export async function listChartActiveTickers(): Promise<string[]> {
  const rows = await listDatabaseToolLatest<{ ticker?: string }>({
    tool: TOOL,
    dataset: ACTIVE_DATASET,
    limit: ACTIVE_LIMIT,
    maxAgeMs: ACTIVE_TTL_MS,
  });
  const out: string[] = [];
  for (const row of rows) {
    const ticker = normalizeDnseSymbol(row.payload?.ticker ?? row.key);
    if (ticker && !out.includes(ticker)) out.push(ticker);
  }
  return out.slice(0, ACTIVE_LIMIT);
}

// Mở 1 phiên WS RIÊNG cho ohlc.1m.json (không trộn với phiên tick_extra → không bao giờ làm bẩn
// radar.realtime.tick mà AIDEN phụ thuộc), parse + upsert. Caller (cron) đã bọc try/catch + cờ.
export async function collectDatabaseChartIntraday(options?: {
  tickers?: string[];
  timeoutMs?: number;
  maxMessages?: number;
}): Promise<{ collected: number; bars: number; symbols: number }> {
  const requested = options?.tickers?.length ? options.tickers : await listChartActiveTickers();
  const tickers = Array.from(new Set(requested.map(normalizeDnseSymbol).filter(Boolean))).slice(0, ACTIVE_LIMIT);
  if (!tickers.length) return { collected: 0, bars: 0, symbols: 0 };

  const ws = await collectDnseLightspeedMessages({
    subscriptions: [{ name: "ohlc.1m.json", symbols: tickers }],
    timeoutMs: options?.timeoutMs ?? Number(process.env.CHART_INTRADAY_WS_TIMEOUT_MS ?? 30_000),
    maxMessages: options?.maxMessages ?? Number(process.env.CHART_INTRADAY_WS_MAX_MESSAGES ?? 4000),
  });

  const allowed = new Set(tickers);
  const byKey = new Map<string, ParsedBar>();
  for (const message of ws.messages) {
    const parsed = parseOhlcBarMessage(message);
    if (!parsed || !allowed.has(parsed.ticker)) continue;
    byKey.set(`${parsed.ticker}:${parsed.tradingDate}:${parsed.minuteKey}`, parsed);
  }
  const bars = await upsertIntradayBars(Array.from(byKey.values()));
  return { collected: ws.messages.length, bars, symbols: tickers.length };
}
