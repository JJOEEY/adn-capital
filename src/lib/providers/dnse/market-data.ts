import crypto from "crypto";
import type { MarketBoardResponse } from "@/lib/fiinquantClient";

type JsonRecord = Record<string, unknown>;

export interface DnseInstrument {
  symbol: string;
  marketId: string | null;
  securityGroupId: string | null;
  symbolType: string | null;
  shortName: string | null;
  name: string | null;
  indexName: string | null;
}

export interface DnseOhlcPayload {
  ticker: string;
  timeframe: string;
  source: "dnse";
  count: number;
  data: Array<{
    date: string;
    timestamp: number;
    open: number;
    high: number;
    low: number;
    close: number;
    volume: number;
  }>;
}

export interface DnseCoverageReport {
  provider: "dnse";
  checkedAt: string;
  requested: number;
  covered: number;
  coveragePct: number;
  thresholdPct: number;
  passed: boolean;
  missing: string[];
  durationMs: number;
}

const INDEX_SYMBOLS = new Set(["VNINDEX", "VN30", "HNXINDEX", "UPCOMINDEX", "HNX30", "UPINDEX"]);
const DEFAULT_BASE_URLS = [
  "https://openapi.dnse.com.vn",
  "https://api.dnse.com.vn/openapi",
  "https://api.dnse.com.vn",
];
const DEFAULT_WS_BASE_URL = "wss://ws-openapi.dnse.com.vn";
const CACHE_TTL_MS = 45_000;
const REALTIME_OHLC_TTL_MS = 20_000;
const cache = new Map<string, { expiresAt: number; value: unknown }>();
const realtimeOhlcCache = new Map<string, { expiresAt: number; value: DnseOhlcPayload }>();
let authBlockedUntilMs = 0;

function toRecord(value: unknown): JsonRecord | null {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value) ? (value as JsonRecord) : null;
}

function toArray(value: unknown): unknown[] {
  if (Array.isArray(value)) return value;
  const root = toRecord(value);
  if (!root) return [];
  if (Array.isArray(root.data)) return root.data;
  if (Array.isArray(root.items)) return root.items;
  if (Array.isArray(root.rows)) return root.rows;
  const nested = toRecord(root.data);
  if (Array.isArray(nested?.data)) return nested.data;
  if (Array.isArray(nested?.items)) return nested.items;
  if (Array.isArray(nested?.rows)) return nested.rows;
  if (Array.isArray(nested?.result)) return nested.result;
  if (Array.isArray(root.result)) return root.result;
  return [];
}

function readString(row: JsonRecord, keys: string[]): string | null {
  for (const key of keys) {
    const raw = row[key];
    if (typeof raw !== "string") continue;
    const value = raw.trim();
    if (value) return value;
  }
  return null;
}

function readNumber(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string") {
    const parsed = Number(value.replace(/,/g, "").trim());
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

function readBestNumber(row: JsonRecord, keys: string[]): number | null {
  for (const key of keys) {
    const value = readNumber(row[key]);
    if (value != null) return value;
  }
  return null;
}

function normalizeSymbol(symbol: string) {
  return symbol.trim().toUpperCase().replace(/[^A-Z0-9._-]/g, "");
}

function getBaseUrls() {
  const configured = [
    process.env.DNSE_MARKET_DATA_BASE_URL,
    process.env.DNSE_TRADING_BASE_URL,
    process.env.DNSE_OPENAPI_BASE_URL,
  ]
    .flatMap((value) => (value ?? "").split(","))
    .map((value) => value.trim().replace(/\/+$/, ""))
    .filter(Boolean);
  return Array.from(new Set([...configured, ...DEFAULT_BASE_URLS]));
}

function formatHttpDate(date: Date) {
  return date.toUTCString();
}

function sign(method: string, path: string, dateHeaderName: string, dateValue: string, nonce: string) {
  const apiKey = process.env.DNSE_API_KEY?.trim() ?? "";
  const apiSecret = process.env.DNSE_API_SECRET?.trim() ?? "";
  if (!apiKey || !apiSecret) return null;
  if (authBlockedUntilMs > Date.now()) return null;

  const headerKey = dateHeaderName.toLowerCase();
  const signatureString = `(request-target): ${method.toLowerCase()} ${path}\n${headerKey}: ${dateValue}\nnonce: ${nonce}`;
  const signature = crypto.createHmac("sha256", apiSecret).update(signatureString, "utf8").digest("base64");
  return `Signature keyId="${apiKey}",algorithm="hmac-sha256",headers="(request-target) ${headerKey}",signature="${encodeURIComponent(signature)}",nonce="${nonce}"`;
}

function buildQuery(query?: Record<string, string | number | null | undefined>) {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(query ?? {})) {
    if (value == null || value === "") continue;
    params.set(key, String(value));
  }
  const raw = params.toString();
  return raw ? `?${raw}` : "";
}

async function dnseGet<T>(
  path: string,
  query?: Record<string, string | number | null | undefined>,
  options?: { timeoutMs?: number; cacheKey?: string },
): Promise<T | null> {
  const apiKey = process.env.DNSE_API_KEY?.trim() ?? "";
  const apiSecret = process.env.DNSE_API_SECRET?.trim() ?? "";
  if (!apiKey || !apiSecret) return null;

  const cacheKey = options?.cacheKey;
  if (cacheKey) {
    const cached = cache.get(cacheKey);
    if (cached && cached.expiresAt > Date.now()) return cached.value as T;
  }

  const pathWithQuery = `${path}${buildQuery(query)}`;
  const signaturePath = path.startsWith("/") ? path : `/${path}`;
  const dateHeaderCandidates = Array.from(
    new Set([process.env.DNSE_DATE_HEADER?.trim(), "Date", "X-Aux-Date"].filter(Boolean) as string[]),
  );

  for (const baseUrl of getBaseUrls()) {
    for (const dateHeaderName of dateHeaderCandidates) {
      const dateValue = formatHttpDate(new Date());
      const nonce = crypto.randomUUID().replace(/-/g, "");
      const signature = sign("GET", signaturePath, dateHeaderName, dateValue, nonce);
      if (!signature) return null;

      const headers: Record<string, string> = {
        Accept: "application/json",
        "x-api-key": apiKey,
        "X-API-Key": apiKey,
        "X-Signature": signature,
        [dateHeaderName]: dateValue,
      };
      if (dateHeaderName.toLowerCase() !== "date") headers.Date = dateValue;

      try {
        const res = await fetch(`${baseUrl}${pathWithQuery}`, {
          cache: "no-store",
          signal: AbortSignal.timeout(options?.timeoutMs ?? 12_000),
          headers,
        });
        const text = await res.text();
        if (!res.ok) {
          if (res.status === 401 || res.status === 403 || /OA-401|API key not found/i.test(text)) {
            authBlockedUntilMs = Date.now() + 5 * 60_000;
            return null;
          }
          continue;
        }
        if (!text.trim()) return {} as T;
        const parsed = JSON.parse(text) as T;
        if (cacheKey) cache.set(cacheKey, { expiresAt: Date.now() + CACHE_TTL_MS, value: parsed });
        return parsed;
      } catch {
        // Try the next host/header combination. Diagnostics are recorded by callers.
      }
    }
  }

  return null;
}

function normalizeInstrument(row: unknown): DnseInstrument | null {
  const record = toRecord(row);
  if (!record) return null;
  const symbol = readString(record, ["symbol", "ticker", "code"]);
  if (!symbol) return null;
  return {
    symbol: normalizeSymbol(symbol),
    marketId: readString(record, ["marketId", "market", "exchange"]),
    securityGroupId: readString(record, ["securityGroupId", "boardId", "board"]),
    symbolType: readString(record, ["symbolType", "type"]),
    shortName: readString(record, ["shortName", "short_name"]),
    name: readString(record, ["name", "fullName"]),
    indexName: readString(record, ["indexName", "index"]),
  };
}

export async function fetchDnseInstruments(options?: {
  symbols?: string[];
  limit?: number;
  page?: number;
}): Promise<DnseInstrument[]> {
  const symbols = Array.from(new Set((options?.symbols ?? []).map(normalizeSymbol).filter(Boolean)));
  const payload = await dnseGet<unknown>(
    "/instruments",
    {
      symbol: symbols.length > 0 ? symbols.join(",") : undefined,
      limit: options?.limit ?? (symbols.length > 0 ? Math.max(symbols.length, 20) : 500),
      page: options?.page ?? 1,
    },
    { cacheKey: `instruments:${symbols.join(",")}:${options?.limit ?? ""}:${options?.page ?? 1}` },
  );
  return toArray(payload).map(normalizeInstrument).filter((item): item is DnseInstrument => Boolean(item));
}

function timeframeToResolution(timeframe: string) {
  const normalized = timeframe.trim().toLowerCase();
  if (normalized === "1d" || normalized === "d") return "1D";
  if (normalized === "1w" || normalized === "w") return "1W";
  if (normalized.endsWith("m")) return normalized.replace("m", "");
  return normalized.toUpperCase();
}

function resolutionToTimeframe(resolution: string) {
  const normalized = resolution.trim().toUpperCase();
  if (normalized === "1D") return "1d";
  if (normalized === "1W") return "1w";
  if (/^\d+$/.test(normalized)) return `${normalized}m`;
  return normalized.toLowerCase();
}

function readArray(root: JsonRecord, keys: string[]) {
  for (const key of keys) {
    const value = root[key];
    if (Array.isArray(value)) return value;
  }
  return [];
}

function tsToDate(timestamp: number) {
  const ms = timestamp > 10_000_000_000 ? timestamp : timestamp * 1000;
  return new Date(ms).toISOString().slice(0, 10);
}

function tsToIso(timestamp: number) {
  const ms = timestamp > 10_000_000_000 ? timestamp : timestamp * 1000;
  return new Date(ms).toISOString();
}

function normalizeDnsePrice(value: unknown, marketType: string) {
  const numberValue = readNumber(value);
  if (numberValue == null || numberValue <= 0 || !Number.isFinite(numberValue)) return null;
  if (marketType === "STOCK" && numberValue < 1000) return Math.round((numberValue * 1000) / 10) * 10;
  return Math.round(numberValue * 100) / 100;
}

function normalizeOhlc(symbol: string, timeframe: string, payload: unknown, marketType = "STOCK"): DnseOhlcPayload | null {
  const root = toRecord(payload);
  if (!root) return null;
  const dataRoot = toRecord(root.data) ?? root;
  const times = readArray(dataRoot, ["t", "time", "timestamp"]);
  const opens = readArray(dataRoot, ["o", "open"]);
  const highs = readArray(dataRoot, ["h", "high"]);
  const lows = readArray(dataRoot, ["l", "low"]);
  const closes = readArray(dataRoot, ["c", "close"]);
  const volumes = readArray(dataRoot, ["v", "volume"]);

  const rows = times
    .map((rawTime, index) => {
      const timestamp = readNumber(rawTime);
      const open = normalizeDnsePrice(opens[index], marketType);
      const high = normalizeDnsePrice(highs[index], marketType);
      const low = normalizeDnsePrice(lows[index], marketType);
      const close = normalizeDnsePrice(closes[index], marketType);
      const volume = readNumber(volumes[index]) ?? 0;
      if (timestamp == null || open == null || high == null || low == null || close == null) return null;
      if ([open, high, low, close].some((value) => value <= 0 || !Number.isFinite(value))) return null;
      return {
        date: tsToDate(timestamp),
        timestamp,
        open,
        high,
        low,
        close,
        volume,
      };
    })
    .filter((row): row is DnseOhlcPayload["data"][number] => Boolean(row));

  if (rows.length === 0) return null;
  return {
    ticker: normalizeSymbol(symbol),
    timeframe,
    source: "dnse",
    count: rows.length,
    data: rows,
  };
}

function getWsBaseUrl() {
  return (process.env.DNSE_MARKET_WS_BASE_URL?.trim() || DEFAULT_WS_BASE_URL).replace(/\/+$/, "");
}

function isVnTradingWindow() {
  if (process.env.DNSE_MARKET_WS_ALWAYS_TRY === "true") return true;
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "Asia/Ho_Chi_Minh",
    weekday: "short",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).formatToParts(new Date());
  const weekday = parts.find((part) => part.type === "weekday")?.value ?? "";
  const hour = Number(parts.find((part) => part.type === "hour")?.value ?? "0");
  const minute = Number(parts.find((part) => part.type === "minute")?.value ?? "0");
  if (["Sat", "Sun"].includes(weekday)) return false;
  const minutes = hour * 60 + minute;
  return minutes >= 8 * 60 + 45 && minutes <= 15 * 60 + 5;
}

function createWsAuthMessage() {
  const apiKey = process.env.DNSE_API_KEY?.trim() ?? "";
  const apiSecret = process.env.DNSE_API_SECRET?.trim() ?? "";
  if (!apiKey || !apiSecret) return null;
  const timestamp = Math.floor(Date.now() / 1000);
  const nonce = String(Date.now() * 1000);
  const message = `${apiKey}:${timestamp}:${nonce}`;
  const signature = crypto.createHmac("sha256", apiSecret).update(message, "utf8").digest("hex");
  return { action: "auth", api_key: apiKey, signature, timestamp, nonce };
}

async function decodeWsData(data: unknown): Promise<JsonRecord | null> {
  try {
    if (typeof data === "string") return toRecord(JSON.parse(data));
    if (data instanceof ArrayBuffer) return toRecord(JSON.parse(Buffer.from(data).toString("utf8")));
    if (ArrayBuffer.isView(data)) return toRecord(JSON.parse(Buffer.from(data.buffer).toString("utf8")));
    if (typeof Blob !== "undefined" && data instanceof Blob) return toRecord(JSON.parse(await data.text()));
  } catch {
    return null;
  }
  return null;
}

function waitForOpen(ws: WebSocket, timeoutMs: number) {
  return new Promise<boolean>((resolve) => {
    const timer = setTimeout(() => resolve(false), timeoutMs);
    ws.addEventListener("open", () => {
      clearTimeout(timer);
      resolve(true);
    }, { once: true });
    ws.addEventListener("error", () => {
      clearTimeout(timer);
      resolve(false);
    }, { once: true });
  });
}

function cacheRealtimeOhlc(payload: DnseOhlcPayload) {
  realtimeOhlcCache.set(`${payload.ticker}:${payload.timeframe}`, {
    expiresAt: Date.now() + REALTIME_OHLC_TTL_MS,
    value: payload,
  });
}

function getCachedRealtimeOhlc(symbol: string, timeframe: string) {
  const cached = realtimeOhlcCache.get(`${normalizeSymbol(symbol)}:${timeframe}`);
  if (!cached || cached.expiresAt <= Date.now()) return null;
  return cached.value;
}

function normalizeWsOhlcMessage(row: JsonRecord, fallbackResolution: string): DnseOhlcPayload | null {
  const symbol = readString(row, ["symbol", "Symbol", "s"]);
  if (!symbol) return null;
  const normalized = normalizeSymbol(symbol);
  const marketType = (readString(row, ["type", "Type"]) ?? (INDEX_SYMBOLS.has(normalized) ? "INDEX" : "STOCK")).toUpperCase();
  const timestamp = readBestNumber(row, ["time", "timestamp", "t"]);
  const open = normalizeDnsePrice(row.open ?? row.o, marketType);
  const high = normalizeDnsePrice(row.high ?? row.h, marketType);
  const low = normalizeDnsePrice(row.low ?? row.l, marketType);
  const close = normalizeDnsePrice(row.close ?? row.c, marketType);
  if (timestamp == null || open == null || high == null || low == null || close == null) return null;
  const volume = readBestNumber(row, ["volume", "v"]) ?? 0;
  const resolution = readString(row, ["resolution", "Resolution"]) ?? fallbackResolution;
  const timeframe = resolutionToTimeframe(resolution);
  return {
    ticker: normalized,
    timeframe,
    source: "dnse",
    count: 1,
    data: [{
      date: tsToIso(timestamp),
      timestamp,
      open,
      high,
      low,
      close,
      volume,
    }],
  };
}

export async function fetchDnseRealtimeOhlc(
  symbols: string[],
  options?: { timeframe?: string; timeoutMs?: number },
): Promise<Record<string, DnseOhlcPayload>> {
  const normalized = Array.from(new Set(symbols.map(normalizeSymbol).filter(Boolean))).slice(0, 50);
  const timeframe = options?.timeframe ?? "5m";
  const resolution = timeframeToResolution(timeframe);
  const result: Record<string, DnseOhlcPayload> = {};
  const missing = normalized.filter((symbol) => {
    const cached = getCachedRealtimeOhlc(symbol, resolutionToTimeframe(resolution));
    if (cached) result[symbol] = cached;
    return !cached;
  });
  if (missing.length === 0) return result;
  if (!isVnTradingWindow()) return result;
  const auth = createWsAuthMessage();
  if (!auth) return result;

  const timeoutMs = Math.max(800, Math.min(options?.timeoutMs ?? 2_500, 6_000));
  const ws = new WebSocket(`${getWsBaseUrl()}/v1/stream?encoding=json`);
  const queue: JsonRecord[] = [];
  let waiter: ((value: JsonRecord | null) => void) | null = null;

  const pushMessage = (message: JsonRecord | null) => {
    if (!message) return;
    const action = readString(message, ["action", "a"]);
    if (action === "ping") {
      try {
        ws.send(JSON.stringify({ action: "pong" }));
      } catch {
        // The one-shot connection may already be closing.
      }
    }
    if (waiter) {
      const resolve = waiter;
      waiter = null;
      resolve(message);
      return;
    }
    queue.push(message);
  };

  ws.addEventListener("message", (event) => {
    void decodeWsData(event.data).then(pushMessage);
  });

  const nextMessage = (deadline: number) =>
    new Promise<JsonRecord | null>((resolve) => {
      const queued = queue.shift();
      if (queued) {
        resolve(queued);
        return;
      }
      const timer = setTimeout(() => {
        waiter = null;
        resolve(null);
      }, Math.max(1, deadline - Date.now()));
      waiter = (message) => {
        clearTimeout(timer);
        resolve(message);
      };
    });

  const deadline = Date.now() + timeoutMs;
  try {
    if (!(await waitForOpen(ws, Math.min(timeoutMs, 2_000)))) return result;
    await nextMessage(deadline);
    ws.send(JSON.stringify(auth));
    let authenticated = false;
    while (Date.now() < deadline && !authenticated) {
      const message = await nextMessage(deadline);
      const action = readString(message ?? {}, ["action", "a"]);
      if (action === "auth_success") authenticated = true;
      if (action === "auth_error" || action === "error") return result;
    }
    if (!authenticated) return result;

    ws.send(JSON.stringify({
      action: "subscribe",
      channels: [{ name: `ohlc.${resolution}.json`, symbols: missing }],
    }));

    const wanted = new Set(missing);
    while (Date.now() < deadline && wanted.size > 0) {
      const message = await nextMessage(deadline);
      if (!message || readString(message, ["T"]) !== "b") continue;
      const payload = normalizeWsOhlcMessage(message, resolution);
      if (!payload || !wanted.has(payload.ticker)) continue;
      cacheRealtimeOhlc(payload);
      result[payload.ticker] = payload;
      wanted.delete(payload.ticker);
    }
  } finally {
    try {
      ws.close();
    } catch {
      // Ignore close errors for one-shot market snapshots.
    }
  }
  return result;
}

export async function fetchDnseOhlc(
  symbol: string,
  options?: { timeframe?: string; days?: number; timeoutMs?: number; preferRealtime?: boolean },
): Promise<DnseOhlcPayload | null> {
  const normalized = normalizeSymbol(symbol);
  if (!normalized) return null;
  const timeframe = options?.timeframe ?? "1d";
  const shouldUseRealtime = options?.preferRealtime !== false && (options?.days ?? 5) <= 5;
  if (shouldUseRealtime) {
    const realtime = await fetchDnseRealtimeOhlc([normalized], {
      timeframe,
      timeoutMs: Math.min(options?.timeoutMs ?? 2_500, 2_500),
    }).catch((): Record<string, DnseOhlcPayload> => ({}));
    if (realtime[normalized]?.data.length) return realtime[normalized];
  }

  const to = Math.floor(Date.now() / 1000);
  const from = to - (options?.days ?? (timeframe === "1d" ? 260 : 5)) * 86400;
  const marketType = INDEX_SYMBOLS.has(normalized) ? "INDEX" : "STOCK";
  const payload = await dnseGet<unknown>(
    "/price/ohlc",
    {
      type: marketType,
      symbol: normalized,
      resolution: timeframeToResolution(timeframe),
      from,
      to,
    },
    { timeoutMs: options?.timeoutMs ?? 12_000, cacheKey: `ohlc:${normalized}:${timeframe}:${options?.days ?? ""}` },
  );
  return normalizeOhlc(normalized, timeframe, payload, marketType);
}

function latestRow(rows: unknown[]): JsonRecord | null {
  for (let index = rows.length - 1; index >= 0; index -= 1) {
    const row = toRecord(rows[index]);
    if (row) return row;
  }
  return null;
}

export async function fetchDnseLatestTrade(symbol: string): Promise<JsonRecord | null> {
  const normalized = normalizeSymbol(symbol);
  if (!normalized) return null;
  const payload = await dnseGet<unknown>(`/price/${encodeURIComponent(normalized)}/trades/latest`, undefined, {
    timeoutMs: 8_000,
    cacheKey: `latest:${normalized}`,
  });
  const root = toRecord(payload);
  if (!root) return null;
  return latestRow(toArray(root.trades ?? root.data ?? payload)) ?? root;
}

export async function fetchDnseClosePrice(symbol: string): Promise<JsonRecord | null> {
  const normalized = normalizeSymbol(symbol);
  if (!normalized) return null;
  const payload = await dnseGet<unknown>(`/price/${encodeURIComponent(normalized)}/close`, undefined, {
    timeoutMs: 8_000,
    cacheKey: `close:${normalized}`,
  });
  const root = toRecord(payload);
  if (!root) return null;
  return latestRow(toArray(root.prices ?? root.data ?? payload)) ?? root;
}

export async function fetchDnseWorkingDates(): Promise<string[]> {
  const payload = await dnseGet<unknown>("/market/working-dates", undefined, {
    timeoutMs: 8_000,
    cacheKey: "working-dates",
  });
  const rows = toArray(toRecord(payload)?.workingDates ?? payload);
  return rows
    .map((item) => {
      if (typeof item === "string") return item.slice(0, 10);
      const row = toRecord(item);
      return readString(row ?? {}, ["date", "workingDate", "tradingDate"])?.slice(0, 10) ?? null;
    })
    .filter((item): item is string => Boolean(item));
}

async function mapLimit<T, R>(items: T[], limit: number, task: (item: T) => Promise<R>): Promise<R[]> {
  const results: R[] = [];
  let cursor = 0;
  const workers = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (cursor < items.length) {
      const index = cursor;
      cursor += 1;
      results[index] = await task(items[index]);
    }
  });
  await Promise.all(workers);
  return results;
}

export async function fetchDnseMarketBoard(tickers: string[]): Promise<MarketBoardResponse | null> {
  const symbols = Array.from(new Set(tickers.map(normalizeSymbol).filter(Boolean))).slice(0, 50);
  if (symbols.length === 0) return { prices: {} };
  const realtime = await fetchDnseRealtimeOhlc(symbols, { timeframe: "5m", timeoutMs: 2_000 })
    .catch((): Record<string, DnseOhlcPayload> => ({}));
  const instruments = await fetchDnseInstruments({ symbols, limit: symbols.length });
  const instrumentMap = new Map(instruments.map((item) => [item.symbol, item]));

  const rows = await mapLimit(symbols, 8, async (ticker) => {
    const realtimeRow = realtime[ticker]?.data?.[0];
    const [latest, close] = await Promise.all([
      fetchDnseLatestTrade(ticker).catch(() => null),
      fetchDnseClosePrice(ticker).catch(() => null),
    ]);
    const latestRow = latest ?? {};
    const closeRow = close ?? {};
    const marketType = INDEX_SYMBOLS.has(ticker) ? "INDEX" : "STOCK";
    const price =
      realtimeRow?.close ??
      normalizeDnsePrice(readBestNumber(latestRow, ["price", "matchPrice", "lastPrice", "close"]), marketType) ??
      normalizeDnsePrice(readBestNumber(closeRow, ["price", "close", "closePrice"]), marketType) ??
      null;
    if (price == null || price <= 0) return null;
    const reference = normalizeDnsePrice(readBestNumber(closeRow, ["reference", "refPrice", "basicPrice", "previousClose"]), marketType);
    const volume = realtimeRow?.volume ?? readBestNumber(latestRow, ["volume", "matchVolume", "totalVolume"]) ?? 0;
    const change = reference != null && reference > 0 ? price - reference : readBestNumber(latestRow, ["change"]);
    const changePct = reference != null && reference > 0 ? (Number(change ?? 0) / reference) * 100 : readBestNumber(latestRow, ["changePct", "percentChange"]);
    return {
      ticker,
      exchange: instrumentMap.get(ticker)?.marketId ?? undefined,
      close: price,
      open: realtimeRow?.open,
      high: realtimeRow?.high,
      low: realtimeRow?.low,
      reference: reference ?? undefined,
      change: change ?? undefined,
      changePct: changePct ?? undefined,
      volume,
      source: realtimeRow ? "dnse-ws" : "dnse",
      updatedAt: realtimeRow?.date,
    };
  });

  const prices: MarketBoardResponse["prices"] = {};
  for (const row of rows) {
    if (!row) continue;
    prices[row.ticker] = row;
  }
  return Object.keys(prices).length > 0 ? { prices } : null;
}

export async function runDnseMarketDataCoverageCheck(options?: {
  tickers?: string[];
  thresholdPct?: number;
  concurrency?: number;
  limit?: number;
}): Promise<DnseCoverageReport> {
  const startedAt = Date.now();
  const thresholdPct = options?.thresholdPct ?? 95;
  const explicitTickers = Array.from(new Set((options?.tickers ?? []).map(normalizeSymbol).filter(Boolean)));
  const symbols =
    explicitTickers.length > 0
      ? explicitTickers.slice(0, options?.limit ?? explicitTickers.length)
      : (await fetchDnseInstruments({ limit: options?.limit ?? 500 })).map((item) => item.symbol);

  const results = await mapLimit(symbols, options?.concurrency ?? 8, async (ticker) => {
    const ohlc = await fetchDnseOhlc(ticker, { timeframe: "1d", days: 30, timeoutMs: 10_000 }).catch(() => null);
    return { ticker, ok: Boolean(ohlc?.data.length) };
  });

  const missing = results.filter((item) => !item.ok).map((item) => item.ticker);
  const covered = symbols.length - missing.length;
  const coveragePct = symbols.length > 0 ? Number(((covered / symbols.length) * 100).toFixed(2)) : 0;
  return {
    provider: "dnse",
    checkedAt: new Date().toISOString(),
    requested: symbols.length,
    covered,
    coveragePct,
    thresholdPct,
    passed: coveragePct >= thresholdPct,
    missing,
    durationMs: Date.now() - startedAt,
  };
}
