import type { DatabaseDataset, DatabaseProviderStatus, DatabaseResult } from "@/lib/database/contracts";
import { databaseError, databaseOk } from "@/lib/database/contracts";
import { collectDnseLightspeedMessages } from "@/lib/providers/dnse/lightspeed-ws";
import type {
  DnseBoard,
  DnseEodFieldMapItem,
  DnseEodMarketData,
  DnseIndexValue,
  DnseInstrument,
  DnseOhlcv,
  DnseRealtimeQuote,
  DnseWebsocketStatus,
} from "./types";

type JsonRecord = Record<string, unknown>;

const DNSE_SOURCE_URLS = [
  "https://developers.dnse.com.vn/docs/guide/market-data/connect",
  "https://developers.dnse.com.vn/docs/dnse/market-data",
] as const;

const DNSE_LIGHTSPEED_ENDPOINT = "wss://ws-openapi.dnse.com.vn/v1/stream";
const INDEX_SYMBOLS = new Set(["VNINDEX", "VN30", "VN30F1M", "HNXINDEX", "HNX30", "UPCOMINDEX"]);
const REQUIRED_EOD_INDICES = ["VNINDEX", "VN30", "HNX", "UPCOM"] as const;
const DEFAULT_EOD_SYMBOLS = ["HPG", "FPT", "DGC", "SSI", "VHM", "VIC", "VCB"] as const;

const EOD_FIELD_MAP: DnseEodFieldMapItem[] = [
  {
    field: "date",
    source: "computed_from_dnse_ws",
    dnseChannels: ["market_index.*.json", "ohlc_closed.1D.json"],
    dnseFields: ["transactTime", "time", "timestamp"],
    fallbackSource: "adn",
    note: "Ngày EOD lấy theo timestamp DNSE; nếu chưa có message thì dùng lịch giao dịch ADN.",
  },
  {
    field: "vnindex/value/change/change_pct",
    source: "dnse_ws",
    dnseChannels: ["market_index.VNINDEX.json"],
    dnseFields: ["valueIndexes", "changedValue", "changedRatio", "priorValueIndexes"],
    fallbackSource: null,
    note: "Điểm số và biến động chỉ số chính.",
  },
  {
    field: "sub_indices",
    source: "dnse_ws",
    dnseChannels: ["market_index.VN30.json", "market_index.HNX.json", "market_index.UPCOM.json"],
    dnseFields: ["valueIndexes", "changedValue", "changedRatio"],
    fallbackSource: null,
    note: "VN30, HNX, UPCOM cho phần chỉ số phụ.",
  },
  {
    field: "breadth",
    source: "dnse_ws",
    dnseChannels: ["market_index.*.json"],
    dnseFields: [
      "fluctuationUpIssueCount",
      "fluctuationDownIssueCount",
      "fluctuationSteadinessIssueCount",
      "fluctuationUpperLimitIssueCount",
      "fluctuationLowerLimitIssueCount",
    ],
    fallbackSource: null,
    note: "Độ rộng tăng/giảm/đứng giá/trần/sàn lấy từ thống kê chỉ số.",
  },
  {
    field: "liquidity/total_liquidity/matched_liquidity/liquidity_by_exchange",
    source: "dnse_ws",
    dnseChannels: ["market_index.VNINDEX.json", "market_index.HNX.json", "market_index.UPCOM.json"],
    dnseFields: ["contauctAccTrdVal", "contauctAccTrdVol", "grossTradeAmount", "totalVolumeTraded"],
    fallbackSource: null,
    note: "GTGD khớp lệnh và volume theo sàn/chỉ số.",
  },
  {
    field: "negotiated_liquidity",
    source: "dnse_ws",
    dnseChannels: ["market_index.*.json"],
    dnseFields: ["blkTrdAccTrdVal", "blkTrdAccTrdVol"],
    fallbackSource: null,
    note: "GTGD thỏa thuận nếu DNSE đẩy field block trade trong market index.",
  },
  {
    field: "ohlcv_1d",
    source: "dnse_ws",
    dnseChannels: ["ohlc_closed.1D.json"],
    dnseFields: ["open", "high", "low", "close", "volume", "value"],
    fallbackSource: null,
    note: "Nến ngày từng mã/chỉ số, cần collector chạy trong phiên để giữ bản cuối ngày.",
  },
  {
    field: "foreign_flow/foreign_top_buy/foreign_top_sell",
    source: "computed_from_dnse_ws",
    dnseChannels: ["foreign.G1.json"],
    dnseFields: ["totalBuyTradedAmount", "totalSellTradedAmount", "buyTradedAmount", "sellTradedAmount"],
    fallbackSource: null,
    note: "Khối ngoại tính net = buy - sell; top mua/bán cần subscribe đủ universe.",
  },
  {
    field: "prop_trading_top_buy/prop_trading_top_sell/notable_trades.proprietary",
    source: "fiinquant_fallback",
    dnseChannels: [],
    dnseFields: [],
    fallbackSource: "fiinquant",
    note: "Chưa thấy kênh tự doanh trong DNSE LightSpeed SDK hiện tại.",
  },
  {
    field: "individual_top_buy/individual_top_sell/notable_trades.retail",
    source: "fiinquant_fallback",
    dnseChannels: [],
    dnseFields: [],
    fallbackSource: "fiinquant",
    note: "Chưa thấy kênh cá nhân/retail trong DNSE LightSpeed SDK hiện tại.",
  },
  {
    field: "sector_gainers/sector_losers",
    source: "computed_from_dnse_ws",
    dnseChannels: ["tick_extra.G1.json", "ohlc_closed.1D.json"],
    dnseFields: ["symbol", "matchPrice", "changedRatio", "close", "volume"],
    fallbackSource: "adn",
    note: "DNSE cấp giá; ADN cần mapping ngành riêng để gom sector.",
  },
  {
    field: "buy_signals/sell_signals/top_breakout/top_new_high",
    source: "adn_computed",
    dnseChannels: ["tick_extra.G1.json", "ohlc_closed.1D.json"],
    dnseFields: ["symbol", "matchPrice", "highestPrice", "lowestPrice", "totalVolumeTraded"],
    fallbackSource: "adn",
    note: "Không phải dữ liệu provider; ADN scanner tự tính từ giá/volume.",
  },
  {
    field: "session_summary/liquidity_detail/foreign_flow/notable_trades/outlook",
    source: "computed_from_dnse_ws",
    dnseChannels: ["market_index.*.json", "foreign.G1.json"],
    dnseFields: ["fieldMap-derived"],
    fallbackSource: "adn",
    note: "Câu chữ EOD được dựng từ dữ liệu đã map, không lấy trực tiếp từ DNSE.",
  },
];

function toRecord(value: unknown): JsonRecord | null {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as JsonRecord) : null;
}

function toNumber(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string") {
    const cleaned = value.replace(/[^\d.,-]/g, "").replace(/,/g, "");
    if (!cleaned) return null;
    const parsed = Number(cleaned);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

function readString(record: JsonRecord | null, keys: string[]): string | null {
  if (!record) return null;
  for (const key of keys) {
    const value = record[key];
    if (typeof value === "string" && value.trim()) return value.trim();
    if (typeof value === "number" && Number.isFinite(value)) return String(value);
  }
  return null;
}

function readNumber(record: JsonRecord | null, keys: string[]): number | null {
  if (!record) return null;
  for (const key of keys) {
    const parsed = toNumber(record[key]);
    if (parsed != null) return parsed;
  }
  return null;
}

function normalizeSymbol(value: string | null | undefined) {
  const normalized = (value ?? "").trim().toUpperCase().replace(/[^A-Z0-9._-]/g, "").slice(0, 16);
  const compact = normalized.replace(/[^A-Z0-9]/g, "");
  if (compact === "HNX") return "HNXINDEX";
  if (compact === "HNX30" || compact === "HNX30INDEX") return "HNX30";
  if (compact === "UPCOM" || compact === "UPINDEX") return "UPCOMINDEX";
  if (compact === "VN30INDEX") return "VN30";
  if (compact === "VN30F1M" || compact.startsWith("VN30F")) return "VN30F1M";
  return normalized;
}

function normalizeIndexSymbol(value: string) {
  const normalized = normalizeSymbol(value).replace(/[^A-Z0-9]/g, "");
  if (normalized === "HNX") return "HNXINDEX";
  if (normalized === "HNX30" || normalized === "HNX30INDEX") return "HNX30";
  if (normalized === "UPCOM" || normalized === "UPINDEX") return "UPCOMINDEX";
  if (normalized === "VN30INDEX") return "VN30";
  if (normalized === "VN30F1M" || normalized.startsWith("VN30F")) return "VN30F1M";
  return normalized;
}

function toDnseWireSymbol(symbol: string) {
  const normalized = normalizeIndexSymbol(symbol);
  if (normalized === "HNXINDEX") return "HNX";
  if (normalized === "UPCOMINDEX") return "UPCOM";
  return normalized;
}

function marketTypeFor(symbol: string): "STOCK" | "INDEX" {
  return INDEX_SYMBOLS.has(normalizeIndexSymbol(symbol)) ? "INDEX" : "STOCK";
}

function normalizePrice(value: unknown, marketType: "STOCK" | "INDEX") {
  const numberValue = toNumber(value);
  if (numberValue == null || numberValue <= 0) return null;
  if (marketType === "STOCK" && numberValue < 1000) return Math.round((numberValue * 1000) / 10) * 10;
  return Math.round(numberValue * 100) / 100;
}

function timeframeToResolution(timeframe: string) {
  const normalized = timeframe.trim().toLowerCase();
  if (normalized === "1d" || normalized === "d") return "1D";
  if (normalized === "1w" || normalized === "w") return "1W";
  if (normalized.endsWith("m")) return normalized.replace("m", "");
  return normalized.toUpperCase();
}

function tsToIso(timestamp: number) {
  const ms = timestamp > 10_000_000_000 ? timestamp : timestamp * 1000;
  return new Date(ms).toISOString();
}

function websocketOnlyUnavailable<T>(
  dataset: DatabaseDataset,
  missingFields: string[],
  message = "Database v2 DNSE is LightSpeed websocket-only. This dataset is not available from the current websocket adapter yet.",
): DatabaseResult<T> {
  return databaseError(dataset, "dnse", {
    provider: "dnse",
    ok: false,
    endpoint: DNSE_LIGHTSPEED_ENDPOINT,
    httpStatus: null,
    code: "dnse_ws_dataset_not_available",
    message,
    retryable: false,
  }, missingFields);
}

function websocketChannels(symbols: string[], timeframe = "5m") {
  const wireSymbols = symbols.map(toDnseWireSymbol);
  return [
    { name: "tick.G1.json", symbols: wireSymbols },
    { name: `ohlc.${timeframeToResolution(timeframe)}.json`, symbols: wireSymbols },
  ];
}

function eodChannels(symbols: string[]) {
  const normalized = Array.from(new Set(symbols.map(normalizeSymbol).filter(Boolean))).slice(0, 100);
  return [
    ...REQUIRED_EOD_INDICES.map((index) => ({ name: `market_index.${index}.json`, symbols: [] })),
    { name: "foreign.G1.json", symbols: normalized },
    { name: "ohlc_closed.1D.json", symbols: [...normalized, "VN30"] },
    { name: "tick_extra.G1.json", symbols: normalized },
  ];
}

function websocketStatusFromResult(
  symbols: string[],
  channels: Array<{ name: string; symbols: string[] }>,
  result: Awaited<ReturnType<typeof collectDnseLightspeedMessages>>,
): DnseWebsocketStatus {
  return {
    opened: result.opened,
    authenticated: result.authenticated,
    subscribedChannels: channels.map((channel) => channel.name),
    symbols,
    messageCount: result.messages.length,
    sampleTypes: Array.from(new Set(result.messages.map((message) => String(message.T ?? message.t ?? message.action ?? "unknown")))),
    errors: result.errors,
  };
}

function messageKeys(messages: JsonRecord[]) {
  return Array.from(new Set(messages.flatMap((message) => Object.keys(message)))).sort();
}

function hasAnyField(messages: JsonRecord[], fields: string[]) {
  return messages.some((message) => fields.some((field) => message[field] != null));
}

function messageTypes(messages: JsonRecord[]) {
  return Array.from(new Set(messages.map((message) => String(message.T ?? message.t ?? message.action ?? message.channel ?? "unknown"))));
}

function websocketProviderStatus(
  result: Awaited<ReturnType<typeof collectDnseLightspeedMessages>>,
  startedAt: number,
  endpoint = DNSE_LIGHTSPEED_ENDPOINT,
): DatabaseProviderStatus {
  if (!result.opened) {
    return {
      provider: "dnse",
      ok: false,
      endpoint,
      httpStatus: null,
      code: "dnse_ws_connect_failed",
      message: result.errors[0] ?? "DNSE LightSpeed websocket did not open.",
      latencyMs: Date.now() - startedAt,
      retryable: true,
    };
  }
  if (!result.authenticated) {
    return {
      provider: "dnse",
      ok: false,
      endpoint,
      httpStatus: null,
      code: "dnse_ws_auth_failed",
      message: result.errors[0] ?? "DNSE LightSpeed websocket authentication failed.",
      latencyMs: Date.now() - startedAt,
      retryable: false,
    };
  }
  return {
    provider: "dnse",
    ok: true,
    endpoint,
    httpStatus: null,
    latencyMs: Date.now() - startedAt,
  };
}

function quoteFromWsMessage(message: JsonRecord): DnseRealtimeQuote | null {
  const ticker = normalizeSymbol(readString(message, ["symbol", "Symbol", "s"]));
  if (!ticker) return null;
  const marketType = marketTypeFor(ticker);
  const price =
    normalizePrice(readNumber(message, ["price", "matchPrice", "lastPrice", "close", "c"]), marketType) ??
    normalizePrice(readNumber(message, ["bestBidPrice", "bidPrice", "bid"]), marketType) ??
    normalizePrice(readNumber(message, ["bestAskPrice", "askPrice", "ask"]), marketType);
  if (price == null || price <= 0) return null;
  const reference = normalizePrice(readNumber(message, ["reference", "refPrice", "basicPrice", "previousClose"]), marketType);
  const rawChange = readNumber(message, ["change", "priceChange"]);
  const change = rawChange ?? (reference != null ? price - reference : null);
  const timestamp = readNumber(message, ["time", "timestamp", "t"]);
  return {
    ticker,
    price,
    reference,
    change,
    changePct: reference != null && reference > 0 && change != null
      ? (change / reference) * 100
      : readNumber(message, ["changePct", "percentChange"]),
    volume: readNumber(message, ["volume", "matchVolume", "totalVolume", "v"]) ?? null,
    sourceChannel: "dnse-ws",
    updatedAt: timestamp != null ? tsToIso(timestamp) : new Date().toISOString(),
  };
}

export async function getDnseWebsocketStatusDataset(
  symbols: string[],
  options?: { timeframe?: string; timeoutMs?: number; maxMessages?: number },
): Promise<DatabaseResult<DnseWebsocketStatus>> {
  const normalized = Array.from(new Set(symbols.map(normalizeSymbol).filter(Boolean))).slice(0, 50);
  if (!normalized.length) {
    return databaseError("market.websocket", "dnse", {
      provider: "dnse",
      ok: false,
      code: "invalid_symbol",
      message: "At least one symbol is required.",
      retryable: false,
    }, ["symbols"]);
  }
  const startedAt = Date.now();
  const channels = websocketChannels(normalized, options?.timeframe ?? "5m");
  const result = await collectDnseLightspeedMessages({
    subscriptions: channels,
    timeoutMs: options?.timeoutMs ?? 6_000,
    maxMessages: options?.maxMessages ?? 8,
  });
  const status = websocketProviderStatus(result, startedAt);
  const data = websocketStatusFromResult(normalized, channels, result);
  if (!result.authenticated) return databaseError("market.websocket", "dnse", status, result.opened ? ["websocket.auth"] : ["websocket.open"]);
  return databaseOk("market.websocket", "dnse", data, status, data.messageCount > 0 ? [] : ["websocket.market_messages"]);
}

export async function getDnseInstrumentsDataset(options?: {
  symbols?: string[];
  marketId?: string;
  securityGroupId?: string;
  indexName?: string;
  limit?: number;
  page?: number;
}): Promise<DatabaseResult<DnseInstrument[]>> {
  const symbols = Array.from(new Set((options?.symbols ?? []).map(normalizeSymbol).filter(Boolean)));
  const missing = symbols.length ? symbols.map((ticker) => `instrument:${ticker}:websocket-adapter-missing`) : ["instruments:websocket-adapter-missing"];
  return websocketOnlyUnavailable<DnseInstrument[]>("market.instruments", missing);
}

export async function getDnseOhlcvDataset(
  symbol: string,
  options?: { timeframe?: string; days?: number; timeoutMs?: number },
): Promise<DatabaseResult<DnseOhlcv>> {
  void options;
  const normalized = normalizeSymbol(symbol);
  if (!normalized) {
    return databaseError("market.ohlcv", "dnse", {
      provider: "dnse",
      ok: false,
      code: "invalid_symbol",
      message: "Symbol is required.",
      retryable: false,
    }, ["symbol"]);
  }
  return websocketOnlyUnavailable<DnseOhlcv>("market.ohlcv", [`ohlcv:${normalized}:websocket-adapter-missing`]);
}

export async function getDnseRealtimeDataset(symbols: string[]): Promise<DatabaseResult<DnseRealtimeQuote[]>> {
  const normalized = Array.from(new Set(symbols.map(normalizeSymbol).filter(Boolean))).slice(0, 50);
  if (!normalized.length) {
    return databaseError("market.realtime", "dnse", {
      provider: "dnse",
      ok: false,
      code: "invalid_symbol",
      message: "At least one symbol is required.",
      retryable: false,
    }, ["symbols"]);
  }

  const startedAt = Date.now();
  const channels = websocketChannels(normalized, "5m");
  const result = await collectDnseLightspeedMessages({
    subscriptions: channels,
    timeoutMs: Number(process.env.DNSE_DATABASE_WS_TIMEOUT_MS ?? 6_000),
    maxMessages: 32,
  });
  const providerStatus = websocketProviderStatus(result, startedAt);
  if (!result.authenticated) {
    return databaseError("market.realtime", "dnse", providerStatus, result.opened ? ["websocket.auth"] : ["websocket.open"]);
  }

  const quoteMap = new Map<string, DnseRealtimeQuote>();
  for (const message of result.messages) {
    const quote = quoteFromWsMessage(message);
    if (quote) quoteMap.set(quote.ticker, quote);
  }
  const quotes = normalized.map((ticker) => quoteMap.get(ticker) ?? {
    ticker,
    price: null,
    reference: null,
    change: null,
    changePct: null,
    volume: null,
    sourceChannel: "dnse-ws" as const,
    updatedAt: null,
  });
  const missing = normalized.filter((ticker) => !quoteMap.has(ticker)).map((ticker) => `realtime:${ticker}`);
  const status: DatabaseProviderStatus = {
    ...providerStatus,
    ok: missing.length === 0,
    code: missing.length ? "dnse_ws_no_market_messages" : undefined,
    message: missing.length ? "DNSE LightSpeed websocket authenticated, but no live market messages were received for some symbols." : undefined,
    retryable: missing.length > 0,
  };
  return quoteMap.size > 0
    ? databaseOk("market.realtime", "dnse", quotes, status, missing)
    : databaseError("market.realtime", "dnse", status, missing.length ? missing : ["realtime"]);
}

export async function getDnseBoardDataset(symbols: string[]): Promise<DatabaseResult<DnseBoard>> {
  const realtime = await getDnseRealtimeDataset(symbols);
  if (!realtime.ok && !realtime.data?.length) {
    return databaseError("market.board", "dnse", realtime.providerStatus, realtime.missingFields);
  }
  const prices: DnseBoard["prices"] = {};
  for (const quote of realtime.data ?? []) {
    if (quote.price != null && quote.price > 0) prices[quote.ticker] = quote;
  }
  return databaseOk("market.board", "dnse", { prices }, {
    ...realtime.providerStatus,
    ok: Object.keys(prices).length === symbols.length,
  }, realtime.missingFields);
}

export async function getDnseIndicesDataset(): Promise<DatabaseResult<DnseIndexValue[]>> {
  return websocketOnlyUnavailable<DnseIndexValue[]>("market.indices", [
    "index:VNINDEX:websocket-adapter-missing",
    "index:VN30:websocket-adapter-missing",
    "index:VN30F1M:websocket-adapter-missing",
    "index:HNXINDEX:websocket-adapter-missing",
    "index:HNX30:websocket-adapter-missing",
    "index:UPCOMINDEX:websocket-adapter-missing",
  ]);
}

export async function getDnseEodMarketDataset(options?: {
  symbols?: string[];
  timeoutMs?: number;
  maxMessages?: number;
}): Promise<DatabaseResult<DnseEodMarketData>> {
  const symbols = Array.from(new Set((options?.symbols?.length ? options.symbols : [...DEFAULT_EOD_SYMBOLS]).map(normalizeSymbol).filter(Boolean)));
  const channels = eodChannels(symbols);
  const startedAt = Date.now();
  const result = await collectDnseLightspeedMessages({
    subscriptions: channels,
    timeoutMs: options?.timeoutMs ?? 6_000,
    maxMessages: options?.maxMessages ?? 48,
  });
  const providerStatus = websocketProviderStatus(result, startedAt);
  if (!result.authenticated) {
    return databaseError("market.eod", "dnse", providerStatus, result.opened ? ["websocket.auth"] : ["websocket.open"]);
  }

  const activeChannels = Array.from(new Set(result.messages.map((message) => readString(message, ["channel"]) ?? "").filter(Boolean)));
  const presentFields = messageKeys(result.messages);
  const unsupported = EOD_FIELD_MAP.filter((item) => item.source === "fiinquant_fallback").map((item) => item.field);
  const unavailableNow = EOD_FIELD_MAP
    .filter((item) => item.source !== "fiinquant_fallback" && item.dnseFields.length > 0 && !hasAnyField(result.messages, item.dnseFields))
    .map((item) => item.field);
  const missingFields = [...unavailableNow.map((field) => `${field}:no-live-ws-message`), ...unsupported.map((field) => `${field}:requires-fiinquant-fallback`)];

  const data: DnseEodMarketData = {
    mode: "lightspeed-websocket",
    channels,
    fieldMap: EOD_FIELD_MAP,
    runtimeCoverage: {
      messages: result.messages.length,
      activeChannels,
      observedMessageTypes: messageTypes(result.messages),
      presentFields,
      missingFields,
    },
  };
  const status: DatabaseProviderStatus = {
    ...providerStatus,
    ok: missingFields.length === 0,
    code: missingFields.length ? "dnse_eod_partial_coverage" : undefined,
    message: missingFields.length
      ? "DNSE LightSpeed EOD map is defined, but some fields need live-session collection or FiinQuant fallback."
      : undefined,
    retryable: unavailableNow.length > 0,
  };
  return databaseOk("market.eod", "dnse", data, status, missingFields);
}

export const dnseMarketDocs = DNSE_SOURCE_URLS;
