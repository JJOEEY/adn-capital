import type { Prisma } from "@prisma/client";
import type { DatabaseProviderStatus, DatabaseResult } from "@/lib/database/contracts";
import { databaseError, databaseOk } from "@/lib/database/contracts";
import { getCachedDatabaseEodMarketDataset, getDatabaseEodMarketDataset } from "@/lib/database/eod";
import { getDatabaseNewsDataset } from "@/lib/database/providers/news";
import type { DatabaseNewsItem } from "@/lib/database/providers/news";
import { prisma } from "@/lib/prisma";
import { fetchFAData, type FAData } from "@/lib/stockData";
import { getPythonBridgeUrl } from "@/lib/runtime-config";
import type {
  DatabaseAidenContext,
  DatabaseAidenDataSources,
  DatabaseAidenFundamentalContext,
  DatabaseAidenHealth,
  DatabaseAidenMarketContext,
  DatabaseAidenMetric,
  DatabaseAidenMissingFieldGroups,
  DatabaseAidenTechnicalContext,
  DatabaseAidenTickerContext,
} from "./types";

type JsonRecord = Record<string, unknown>;
type DatasetPayloadRow = {
  dataset: string;
  payload: Prisma.JsonValue;
  tradingDate: string | null;
  providerTime: Date | null;
  receivedAt: Date | null;
  updatedAt: Date;
  source: string | null;
};

const REQUIRED_INDICES = ["VNINDEX", "VN30", "HNXINDEX", "UPCOMINDEX"];
const DEFAULT_SAMPLE_TICKERS = ["HPG", "FPT", "DGC"];

export const AIDEN_STOCK_ALLOWED_DATASETS = new Set([
  "market.instruments",
  "reference.securities",
  "market.realtime",
  "market.board",
  "market.ohlcv",
  "technical.indicators",
  "technical.levels",
  "fundamental.valuation",
  "fundamental.financials",
  "fundamental.profile",
]);

const FINANCIAL_DATASETS = ["fundamental.financials"];
const VALUATION_DATASETS = ["fundamental.valuation"];
const PROFILE_DATASETS = ["fundamental.profile", "market.instruments"];
const TECHNICAL_DATASETS = ["technical.indicators", "technical.levels"];

function dateKeyInVietnam(date = new Date()) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Ho_Chi_Minh",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
}

function previousTradingDateKey(date = new Date()) {
  const value = new Date(date);
  do {
    value.setDate(value.getDate() - 1);
    const weekday = value.toLocaleString("en-US", { timeZone: "Asia/Ho_Chi_Minh", weekday: "short" });
    if (weekday !== "Sat" && weekday !== "Sun") break;
  } while (true);
  return dateKeyInVietnam(value);
}

function asRecord(value: unknown): JsonRecord {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as JsonRecord) : {};
}

function dateIso(value: Date | string | null | undefined) {
  if (!value) return null;
  if (value instanceof Date) return value.toISOString();
  const parsed = new Date(value);
  return Number.isFinite(parsed.getTime()) ? parsed.toISOString() : null;
}

function normalizeTicker(value: string) {
  return value.trim().toUpperCase().replace(/[^A-Z0-9._-]/g, "");
}

function normalizeNumberString(input: string) {
  const raw = input.trim();
  if (!raw || /^n\/?a$/i.test(raw) || raw === "-") return "";
  const cleaned = raw.replace(/%/g, "").replace(/[^\d.,-]/g, "");
  if (!cleaned) return "";
  const hasComma = cleaned.includes(",");
  const hasDot = cleaned.includes(".");
  if (hasComma && hasDot) {
    const lastComma = cleaned.lastIndexOf(",");
    const lastDot = cleaned.lastIndexOf(".");
    if (lastComma > lastDot) return cleaned.replace(/\./g, "").replace(",", ".");
    return cleaned.replace(/,/g, "");
  }
  if (hasComma) {
    const parts = cleaned.split(",");
    const decimals = parts[parts.length - 1] ?? "";
    if (parts.length === 2 && decimals.length > 0 && decimals.length <= 2) return cleaned.replace(",", ".");
    return cleaned.replace(/,/g, "");
  }
  return cleaned;
}

export function parseAidenNumber(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string") {
    const normalized = normalizeNumberString(value);
    if (!normalized) return null;
    const parsed = Number(normalized);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

function hasExplicitPercent(value: unknown) {
  return typeof value === "string" && value.includes("%");
}

function isMeaningfulNumber(value: unknown, metric: string) {
  const parsed = parseAidenNumber(value);
  if (parsed == null) return false;
  if ((metric === "pe" || metric === "pb") && parsed === 0) return false;
  return true;
}

function makeMetric(value: unknown, metric: string): DatabaseAidenMetric | null {
  if (!isMeaningfulNumber(value, metric)) return null;
  let parsed = parseAidenNumber(value);
  if (parsed == null) return null;
  if ((metric === "roe" || metric === "roa") && !hasExplicitPercent(value) && Math.abs(parsed) <= 1) {
    parsed *= 100;
  }
  const suffix = metric === "roe" || metric === "roa" ? "%" : "";
  return {
    value: parsed,
    display: `${new Intl.NumberFormat("vi-VN", { maximumFractionDigits: 2 }).format(parsed)}${suffix}`,
  };
}

function firstRaw(record: JsonRecord, keys: string[]) {
  for (const key of keys) {
    const value = record[key];
    if (value != null && value !== "") return value;
  }
  return null;
}

function firstNumber(record: JsonRecord, keys: string[]) {
  for (const key of keys) {
    const value = parseAidenNumber(record[key]);
    if (value != null) return value;
  }
  return null;
}

function rowPayload(row: { payload: Prisma.JsonValue } | null) {
  return asRecord(row?.payload);
}

function payloadRecordList(payload: Prisma.JsonValue): JsonRecord[] {
  if (Array.isArray(payload)) {
    return payload.map(asRecord).filter((item) => Object.keys(item).length > 0);
  }

  const direct = asRecord(payload);
  if (!Object.keys(direct).length) return [];

  const nestedKeys = ["data", "items", "rows", "records", "result", "results", "financials", "valuations"];
  for (const key of nestedKeys) {
    const value = direct[key];
    if (Array.isArray(value) && value.length) {
      const records = value.map(asRecord).filter((item) => Object.keys(item).length > 0);
      if (records.length) return records;
    }
  }

  return [direct];
}

function expandDatasetPayloadRows(rows: DatasetPayloadRow[]): DatasetPayloadRow[] {
  return rows.flatMap((row) => {
    const records = payloadRecordList(row.payload);
    if (!records.length) return [row];
    return records.map((record) => ({ ...row, payload: record as Prisma.JsonObject }));
  });
}

function rowUpdatedAt(row: { receivedAt?: Date | null; updatedAt?: Date; providerTime?: Date | null } | null) {
  return dateIso(row?.providerTime ?? row?.updatedAt ?? row?.receivedAt ?? null);
}

function sourceLabel(dataset: string) {
  return `database_v2:${dataset}`;
}

function addSource(sources: string[], dataset: string) {
  const label = sourceLabel(dataset);
  if (!sources.includes(label)) sources.push(label);
}

export function assertAidenStockDatasetAllowed(dataset: string) {
  if (AIDEN_STOCK_ALLOWED_DATASETS.has(dataset)) return { ok: true as const };
  const message = `Legacy dataset blocked for ADN Stock AIDEN: ${dataset}`;
  if (process.env.NODE_ENV !== "production") throw new Error(message);
  console.warn(`[AIDEN_STOCK] ${message}`);
  return { ok: false as const, blocked: true as const, reason: message, dataset };
}

function buildEmptySources(): DatabaseAidenDataSources {
  return {
    quote: [],
    ohlcv: [],
    technical: [],
    fundamental: [],
    profile: [],
    reference: [],
    blockedLegacy: [],
  };
}

function buildEmptyMissingGroups(): DatabaseAidenMissingFieldGroups {
  return {
    quote: [],
    ohlcv: [],
    technical: [],
    fundamental: [],
    profile: [],
  };
}

function buildTickerMarket(
  latestRow: { payload: Prisma.JsonValue; tradingDate: string; providerTime: Date | null; updatedAt: Date; receivedAt: Date } | null,
  ohlcvRow: { payload: Prisma.JsonValue; tradingDate?: string | null; providerTime: Date | null; updatedAt?: Date; receivedAt: Date | null } | null,
  previousOhlcvRow?: { payload: Prisma.JsonValue } | null,
) {
  const latest = rowPayload(latestRow);
  const ohlcv = rowPayload(ohlcvRow);
  const previousOhlcv = rowPayload(previousOhlcvRow ?? null);
  const latestPrice = firstNumber(latest, ["price", "matchPrice", "lastPrice", "close", "c"]);
  const payload = latestPrice != null ? latest : ohlcv;
  const price = firstNumber(payload, ["price", "matchPrice", "lastPrice", "close", "c"]);
  const reference = firstNumber(payload, ["reference", "refPrice", "basicPrice", "priorClosePrice", "previousClose"]) ??
    firstNumber(previousOhlcv, ["close", "matchPrice", "c"]) ??
    firstNumber(payload, ["open", "openPrice", "o"]);
  const change = firstNumber(payload, ["changedValue", "change", "priceChange"]);
  const changePct = firstNumber(payload, ["changedRatio", "changePct", "percentChange"]);

  return {
    price,
    reference,
    change: change ?? (price != null && reference != null ? price - reference : null),
    changePct: changePct ?? (price != null && reference ? Number((((price - reference) / reference) * 100).toFixed(2)) : null),
    volume: firstNumber(payload, ["totalVolumeTraded", "volume", "v", "matchVolume"]),
    value: firstNumber(payload, ["grossTradeAmount", "tradingValue", "value", "matchValue"]),
    updatedAt: rowUpdatedAt(latestRow ?? ohlcvRow),
    tradingDate: latestRow?.tradingDate ?? ohlcvRow?.tradingDate ?? null,
  };
}

function buildDailyOhlcv(row: { payload: Prisma.JsonValue; providerTime: Date | null; updatedAt?: Date; receivedAt: Date | null } | null) {
  if (!row) return null;
  const payload = rowPayload(row);
  return {
    open: firstNumber(payload, ["open", "openPrice", "o"]),
    high: firstNumber(payload, ["high", "highestPrice", "h"]),
    low: firstNumber(payload, ["low", "lowestPrice", "l"]),
    close: firstNumber(payload, ["close", "matchPrice", "c"]),
    volume: firstNumber(payload, ["volume", "v", "totalVolumeTraded"]),
    value: firstNumber(payload, ["value", "tradingValue", "grossTradeAmount"]),
    updatedAt: rowUpdatedAt(row),
  };
}

function newsItem(row: {
  id: string;
  source: string;
  category: string;
  title: string;
  url: string;
  summary: string | null;
  publishedAt: Date | null;
  fetchedAt: Date;
  hash: string;
}): DatabaseNewsItem {
  return {
    id: row.id,
    source: row.source as DatabaseNewsItem["source"],
    category: row.category as DatabaseNewsItem["category"],
    title: row.title,
    url: row.url,
    summary: row.summary,
    publishedAt: row.publishedAt?.toISOString() ?? null,
    fetchedAt: row.fetchedAt.toISOString(),
    hash: row.hash,
  };
}

function buildMarketContext(params: {
  tradingDate: string;
  previousTradingDate: string;
  eod: Awaited<ReturnType<typeof getDatabaseEodMarketDataset>>;
}): DatabaseAidenMarketContext | null {
  if (!params.eod.data) return null;
  const fiinquant = params.eod.data.enrichment?.fiinquant ?? params.eod.data.fallback?.fiinquant;
  return {
    tradingDate: params.tradingDate,
    previousTradingDate: params.previousTradingDate,
    indices: params.eod.data.indices ?? [],
    breadth: params.eod.data.breadth ?? null,
    liquidity: params.eod.data.liquidity ?? null,
    foreignFlow: params.eod.data.foreignFlow ?? null,
    investorFlow: fiinquant
      ? {
          propTradingTopBuy: fiinquant.propTradingTopBuy,
          propTradingTopSell: fiinquant.propTradingTopSell,
          individualTopBuy: fiinquant.individualTopBuy,
          individualTopSell: fiinquant.individualTopSell,
        }
      : null,
  };
}

function parsePeriodEnd(value: unknown) {
  if (value instanceof Date && Number.isFinite(value.getTime())) return value.getTime();
  if (typeof value === "string") {
    const date = new Date(value);
    if (Number.isFinite(date.getTime())) return date.getTime();
    const match = value.trim().match(/^(\d{4})\s*-?\s*Q([1-4])$/i);
    if (match) {
      const year = Number(match[1]);
      const quarter = Number(match[2]);
      const month = quarter * 3;
      return Date.UTC(year, month, 0);
    }
  }
  return null;
}

function periodRank(record: JsonRecord, row: DatasetPayloadRow) {
  const periodEnd = parsePeriodEnd(firstRaw(record, ["periodEnd", "period_end", "endDate", "fiscalPeriodEnd"]));
  const reportDate = parsePeriodEnd(firstRaw(record, ["reportDate", "report_date", "publishedDate", "date"]));
  const reportPeriod = parsePeriodEnd(firstRaw(record, ["reportPeriod", "period", "quarter", "fiscalPeriod"]));
  const updatedAt = row.updatedAt.getTime();
  return { periodEnd, reportDate, reportPeriod, updatedAt };
}

function compareFinancialRows(a: { record: JsonRecord; row: DatasetPayloadRow }, b: { record: JsonRecord; row: DatasetPayloadRow }) {
  const ar = periodRank(a.record, a.row);
  const br = periodRank(b.record, b.row);
  return (
    (br.periodEnd ?? -Infinity) - (ar.periodEnd ?? -Infinity) ||
    (br.reportDate ?? -Infinity) - (ar.reportDate ?? -Infinity) ||
    (br.reportPeriod ?? -Infinity) - (ar.reportPeriod ?? -Infinity) ||
    br.updatedAt - ar.updatedAt
  );
}

function hasUsableFinancial(record: JsonRecord) {
  const metricKeys = [
    ["eps", "EPS", "earningsPerShare", "earningPerShare"],
    ["bvps", "BVPS", "bookValuePerShare", "book_value_per_share"],
    ["roe", "ROE"],
    ["roa", "ROA"],
    ["revenue", "netRevenue", "profit", "netProfit", "assets", "equity", "liabilities"],
  ];
  return metricKeys.some((keys) => keys.some((key) => isMeaningfulNumber(record[key], key.toLowerCase())));
}

function pickLatestUsableFinancial(rows: DatasetPayloadRow[]) {
  return rows
    .map((row) => ({ row, record: rowPayload(row) }))
    .filter(({ record }) => hasUsableFinancial(record))
    .sort(compareFinancialRows)[0] ?? null;
}

function pickLatestValuation(rows: DatasetPayloadRow[]) {
  return rows
    .map((row) => ({ row, record: rowPayload(row) }))
    .filter(({ record }) =>
      isMeaningfulNumber(firstRaw(record, ["pe", "PE", "priceToEarnings", "price_earning_ratio"]), "pe") ||
      isMeaningfulNumber(firstRaw(record, ["pb", "PB", "priceToBook", "price_to_book_ratio"]), "pb"))
    .sort((a, b) => b.row.updatedAt.getTime() - a.row.updatedAt.getTime())[0] ?? null;
}

function buildTechnical(rows: DatasetPayloadRow[]): DatabaseAidenTechnicalContext | null {
  const merged = rows.reduce<JsonRecord>((acc, row) => ({ ...acc, ...rowPayload(row) }), {});
  const updatedAt = rows.map((row) => rowUpdatedAt(row)).find(Boolean) ?? null;
  const technical: DatabaseAidenTechnicalContext = {
    ma20: firstNumber(merged, ["ma20", "MA20", "sma20", "ema20"]),
    ma50: firstNumber(merged, ["ma50", "MA50", "sma50", "ema50"]),
    ma200: firstNumber(merged, ["ma200", "MA200", "sma200", "ema200"]),
    rsi: firstNumber(merged, ["rsi", "RSI", "rsi14"]),
    macdHistogram: firstNumber(merged, ["macdHistogram", "macd_histogram", "macdHist", "MACDHistogram"]),
    volumeMa20: firstNumber(merged, ["volumeMa20", "volume_ma20", "avgVolume20", "volMa20"]),
    support: firstNumber(merged, ["support", "nearestSupport", "support1"]),
    resistance: firstNumber(merged, ["resistance", "nearestResistance", "resistance1"]),
    updatedAt,
  };
  return Object.values(technical).some((value) => value != null) ? technical : null;
}

function buildFundamental(params: {
  financialRows: DatasetPayloadRow[];
  valuationRows: DatasetPayloadRow[];
  profileRows: DatasetPayloadRow[];
}): DatabaseAidenFundamentalContext {
  const financial = pickLatestUsableFinancial(params.financialRows);
  const valuation = pickLatestValuation(params.valuationRows);
  const profile = params.profileRows[0] ? rowPayload(params.profileRows[0]) : {};

  return {
    financialPeriod: financial
      ? {
          reportPeriod: String(firstRaw(financial.record, ["reportPeriod", "period", "quarter", "fiscalPeriod"]) ?? "") || null,
          periodEnd: dateIso(firstRaw(financial.record, ["periodEnd", "period_end", "endDate", "fiscalPeriodEnd"]) as string | null),
          reportDate: dateIso(firstRaw(financial.record, ["reportDate", "report_date", "publishedDate", "date"]) as string | null),
          updatedAt: dateIso(financial.row.updatedAt),
          eps: makeMetric(firstRaw(financial.record, ["eps", "EPS", "earningsPerShare", "earningPerShare"]), "eps"),
          bvps: makeMetric(firstRaw(financial.record, ["bvps", "BVPS", "bookValuePerShare", "book_value_per_share"]), "bvps"),
          roe: makeMetric(firstRaw(financial.record, ["roe", "ROE"]), "roe"),
          roa: makeMetric(firstRaw(financial.record, ["roa", "ROA"]), "roa"),
        }
      : null,
    valuation: valuation
      ? {
          valuationDate: dateIso(firstRaw(valuation.record, ["valuationDate", "date", "tradingDate", "asOfDate"]) as string | null) ??
            valuation.row.tradingDate,
          updatedAt: dateIso(valuation.row.updatedAt),
          pe: makeMetric(firstRaw(valuation.record, ["pe", "PE", "priceToEarnings", "price_earning_ratio"]), "pe"),
          pb: makeMetric(firstRaw(valuation.record, ["pb", "PB", "priceToBook", "price_to_book_ratio"]), "pb"),
        }
      : null,
    profile: params.profileRows.length
      ? {
          companyName: String(firstRaw(profile, ["companyName", "name", "organName", "shortName"]) ?? "") || null,
          industry: String(firstRaw(profile, ["industry", "industryName", "sector"]) ?? "") || null,
          exchange: String(firstRaw(profile, ["exchange", "market", "floor"]) ?? "") || null,
          updatedAt: dateIso(params.profileRows[0]?.updatedAt),
        }
      : null,
  };
}

// Database-v2 does not yet populate per-ticker fundamental datasets, so AIDEN
// stock FA reads empty. When the DB has no FA for a ticker, fall back to the
// FiinQuant bridge (P/E, P/B, EPS, ROE... are scale-independent ratios — safe).
const AIDEN_FA_BRIDGE_FALLBACK = process.env.AIDEN_STOCK_BRIDGE_FA_FALLBACK !== "false";

function bridgeFundamentalToContext(fa: FAData): {
  financialPeriod: DatabaseAidenFundamentalContext["financialPeriod"];
  valuation: DatabaseAidenFundamentalContext["valuation"];
} {
  const updatedAt = new Date().toISOString();
  const financialPeriod =
    fa.eps != null || fa.bookValuePerShare != null || fa.roe != null || fa.roa != null
      ? {
          reportPeriod: fa.reportDate ?? null,
          periodEnd: null,
          reportDate: null,
          updatedAt,
          eps: makeMetric(fa.eps, "eps"),
          bvps: makeMetric(fa.bookValuePerShare ?? null, "bvps"),
          roe: makeMetric(fa.roe, "roe"),
          roa: makeMetric(fa.roa, "roa"),
        }
      : null;
  const valuation =
    fa.pe != null || fa.pb != null
      ? { valuationDate: fa.reportDate ?? null, updatedAt, pe: makeMetric(fa.pe, "pe"), pb: makeMetric(fa.pb, "pb") }
      : null;
  return { financialPeriod, valuation };
}

type BridgeTaSummary = {
  price: number | null;
  prevClose: number | null;
  change: number | null;
  changePct: number | null;
  volume: number | null;
  value: number | null;
  dataDate: string | null;
  lastCandle: DatabaseAidenTickerContext["dailyOhlcv"];
  technical: DatabaseAidenTechnicalContext | null;
};

// Pull pre-computed price/indicators/levels/candles straight from the bridge
// ta-summary endpoint. All values are VND (same scale as database-v2), so they
// can be merged into the ticker context without any price-scale normalization.
async function fetchBridgeTaSummary(ticker: string): Promise<BridgeTaSummary | null> {
  try {
    const res = await fetch(`${getPythonBridgeUrl()}/api/v1/ta-summary/${ticker.toUpperCase()}`, {
      cache: "no-store",
      signal: AbortSignal.timeout(20_000),
      headers: { "Content-Type": "application/json", "x-api-key": process.env.FIINQUANT_API_KEY ?? "" },
    });
    if (!res.ok) return null;
    const json = asRecord(await res.json());
    const price = asRecord(json.price);
    const ind = asRecord(json.indicators);
    const lv = asRecord(json.levels);
    const vol = asRecord(json.volume);
    const candles = Array.isArray(json.recentCandles) ? json.recentCandles : [];
    const last = candles.length ? asRecord(candles[candles.length - 1]) : {};
    const dataDate = typeof json.dataDate === "string" ? json.dataDate : null;
    const technical: DatabaseAidenTechnicalContext = {
      ma20: firstNumber(ind, ["ema20", "sma20", "ma20"]),
      ma50: firstNumber(ind, ["ema50", "sma50", "ma50"]),
      ma200: firstNumber(ind, ["ema200", "sma200", "ma200"]),
      rsi: firstNumber(ind, ["rsi14", "rsi"]),
      macdHistogram: firstNumber(ind, ["macdHistogram", "macd_histogram"]),
      volumeMa20: firstNumber(vol, ["avg20", "avgVolume20"]),
      support: firstNumber(lv, ["support"]),
      resistance: firstNumber(lv, ["resistance"]),
      updatedAt: dataDate,
    };
    const hasCandle = Object.keys(last).length > 0;
    return {
      price: firstNumber(price, ["current", "price", "close"]),
      prevClose: firstNumber(price, ["prevClose", "reference", "refPrice"]),
      change: firstNumber(price, ["change", "changedValue"]),
      changePct: firstNumber(price, ["changePct", "changedRatio"]),
      volume: firstNumber(vol, ["last"]) ?? firstNumber(last, ["volume"]),
      value: firstNumber(last, ["value"]),
      dataDate,
      lastCandle: hasCandle
        ? {
            open: firstNumber(last, ["open"]),
            high: firstNumber(last, ["high"]),
            low: firstNumber(last, ["low"]),
            close: firstNumber(last, ["close"]),
            volume: firstNumber(last, ["volume"]),
            value: firstNumber(last, ["value"]),
            updatedAt: typeof last.date === "string" ? last.date : dataDate,
          }
        : null,
      technical: Object.values(technical).some((value) => value != null) ? technical : null,
    };
  } catch {
    return null;
  }
}

async function readToolRows(datasets: string[], key: string): Promise<DatasetPayloadRow[]> {
  datasets.forEach(assertAidenStockDatasetAllowed);
  const rows = await prisma.databaseToolLatest.findMany({
    where: {
      key,
      dataset: { in: datasets },
    },
    orderBy: [{ tradingDate: "desc" }, { updatedAt: "desc" }],
    take: 80,
  });
  return expandDatasetPayloadRows(rows.map((row) => ({
    dataset: row.dataset,
    payload: row.payload,
    tradingDate: row.tradingDate,
    providerTime: null,
    receivedAt: row.computedAt,
    updatedAt: row.updatedAt,
    source: row.source,
  })));
}

async function readMarketRows(datasets: string[], symbol: string): Promise<DatasetPayloadRow[]> {
  datasets.forEach(assertAidenStockDatasetAllowed);
  const rows = await prisma.databaseMarketLatest.findMany({
    where: {
      symbol,
      dataset: { in: datasets },
    },
    orderBy: [{ tradingDate: "desc" }, { updatedAt: "desc" }],
    take: 80,
  });
  return expandDatasetPayloadRows(rows.map((row) => ({
    dataset: row.dataset,
    payload: row.payload,
    tradingDate: row.tradingDate,
    providerTime: row.providerTime,
    receivedAt: row.receivedAt,
    updatedAt: row.updatedAt,
    source: row.source,
  })));
}

export async function getDatabaseAidenTickerContext(options: {
  ticker: string;
  windowHours?: number;
  tradingDate?: string;
}): Promise<DatabaseResult<DatabaseAidenTickerContext>> {
  const startedAt = Date.now();
  const ticker = normalizeTicker(options.ticker);
  if (!ticker) {
    return databaseError("aiden.stock_context", "database", {
      provider: "database",
      ok: false,
      endpoint: "postgres:DatabaseMarketLatest+DatabaseToolLatest",
      latencyMs: Date.now() - startedAt,
      code: "database_v2_aiden_ticker_invalid",
      retryable: false,
    }, ["ticker"]);
  }

  try {
    const [
      latestRow,
      ohlcvRow,
      technicalToolRows,
      technicalMarketRows,
      financialToolRows,
      financialMarketRows,
      valuationToolRows,
      valuationMarketRows,
      profileToolRows,
      profileMarketRows,
    ] = await Promise.all([
      prisma.databaseMarketLatest.findFirst({
        where: {
          symbol: ticker,
          dataset: { in: ["market.realtime", "market.board"] },
          ...(options.tradingDate ? { tradingDate: options.tradingDate } : {}),
        },
        orderBy: { updatedAt: "desc" },
      }),
      prisma.databaseMarketLatest.findFirst({
        where: {
          symbol: ticker,
          dataset: "market.ohlcv",
          ...(options.tradingDate ? { tradingDate: options.tradingDate } : {}),
        },
        orderBy: [{ tradingDate: "desc" }, { updatedAt: "desc" }],
      }),
      readToolRows(TECHNICAL_DATASETS, ticker),
      readMarketRows(TECHNICAL_DATASETS, ticker),
      readToolRows(FINANCIAL_DATASETS, ticker),
      readMarketRows(FINANCIAL_DATASETS, ticker),
      readToolRows(VALUATION_DATASETS, ticker),
      readMarketRows(VALUATION_DATASETS, ticker),
      readToolRows(PROFILE_DATASETS, ticker),
      readMarketRows(PROFILE_DATASETS, ticker),
    ]);

    const effectiveOhlcvRow = ohlcvRow;
    let market = buildTickerMarket(latestRow, effectiveOhlcvRow);
    let dailyOhlcv = buildDailyOhlcv(effectiveOhlcvRow);
    const technicalRows = [...technicalToolRows, ...technicalMarketRows];
    const financialRows = [...financialToolRows, ...financialMarketRows];
    const valuationRows = [...valuationToolRows, ...valuationMarketRows];
    const profileRows = [...profileToolRows, ...profileMarketRows];
    let technical = buildTechnical(technicalRows);
    const fundamental = buildFundamental({ financialRows, valuationRows, profileRows });

    const dataSources = buildEmptySources();
    if (latestRow) addSource(dataSources.quote, latestRow.dataset || "market.realtime");
    if (dailyOhlcv) addSource(dataSources.ohlcv, "market.ohlcv");
    for (const row of technicalRows) addSource(dataSources.technical, row.dataset);
    for (const row of financialRows) addSource(dataSources.fundamental, row.dataset);
    for (const row of valuationRows) addSource(dataSources.fundamental, row.dataset);
    for (const row of profileRows) addSource(dataSources.profile, row.dataset);

    // Bridge fallback (DB-first): database-v2 does not populate per-ticker
    // fundamental/technical/quote datasets, so fill them from the FiinQuant bridge
    // when the DB is empty. ta-summary candles + indicators are VND (DB scale).
    const needFa = !fundamental.financialPeriod && !fundamental.valuation;
    const needTa = market.price == null || !dailyOhlcv || !technical;
    if (AIDEN_FA_BRIDGE_FALLBACK && (needFa || needTa)) {
      const [fa, ta] = await Promise.all([
        needFa ? fetchFAData(ticker).catch(() => null) : Promise.resolve(null),
        needTa ? fetchBridgeTaSummary(ticker).catch(() => null) : Promise.resolve(null),
      ]);
      if (fa) {
        const bridged = bridgeFundamentalToContext(fa);
        if (bridged.financialPeriod) fundamental.financialPeriod = bridged.financialPeriod;
        if (bridged.valuation) fundamental.valuation = bridged.valuation;
        if (bridged.financialPeriod || bridged.valuation) addSource(dataSources.fundamental, "bridge:fundamental");
      }
      if (ta) {
        if (market.price == null && ta.price != null) {
          market = {
            ...market,
            price: ta.price,
            reference: market.reference ?? ta.prevClose,
            change: market.change ?? ta.change ?? (ta.prevClose != null ? ta.price - ta.prevClose : null),
            changePct: market.changePct ?? ta.changePct,
            volume: market.volume ?? ta.volume,
            value: market.value ?? ta.value,
            updatedAt: market.updatedAt ?? ta.dataDate,
          };
          addSource(dataSources.quote, "bridge:ta-summary");
        }
        if (!dailyOhlcv && ta.lastCandle) {
          dailyOhlcv = ta.lastCandle;
          addSource(dataSources.ohlcv, "bridge:ta-summary");
        }
        if (!technical && ta.technical) {
          technical = ta.technical;
          addSource(dataSources.technical, "bridge:ta-summary");
        }
      }
    }

    const missingFieldGroups = buildEmptyMissingGroups();
    if (market.price == null) missingFieldGroups.quote.push("price");
    if (market.changePct == null) missingFieldGroups.quote.push("changePct");
    if (!dailyOhlcv) missingFieldGroups.ohlcv.push("dailyOhlcv");
    if (!technical) missingFieldGroups.technical.push("technicalIndicators");
    if (!fundamental.financialPeriod) missingFieldGroups.fundamental.push("financialPeriod");
    if (!fundamental.valuation) missingFieldGroups.fundamental.push("valuation");
    if (!fundamental.profile) missingFieldGroups.profile.push("profile");

    const missingFields = [
      ...missingFieldGroups.quote.map((field) => `aiden.stock.quote.${field}`),
      ...missingFieldGroups.ohlcv.map((field) => `aiden.stock.ohlcv.${field}`),
      ...missingFieldGroups.technical.map((field) => `aiden.stock.technical.${field}`),
      ...missingFieldGroups.fundamental.map((field) => `aiden.stock.fundamental.${field}`),
      ...missingFieldGroups.profile.map((field) => `aiden.stock.profile.${field}`),
    ];

    const data: DatabaseAidenTickerContext = {
      ticker,
      market,
      dailyOhlcv,
      technical,
      fundamental,
      relatedNews: [],
      missingFields,
      missingFieldGroups,
      dataSources,
      dataFreshness: {
        quoteAsOf: market.updatedAt,
        ohlcvLatestDate: effectiveOhlcvRow?.tradingDate ?? null,
        technicalAsOf: technical?.updatedAt ?? null,
        financialReportPeriod: fundamental.financialPeriod?.reportPeriod ?? null,
        financialPeriodEnd: fundamental.financialPeriod?.periodEnd ?? null,
        valuationDate: fundamental.valuation?.valuationDate ?? null,
        contextFetchedAt: new Date().toISOString(),
      },
    };

    console.info(
      `[AIDEN_STOCK_CONTEXT_SOURCES] ticker=${ticker} sources=${[
        ...dataSources.quote,
        ...dataSources.ohlcv,
        ...dataSources.technical,
        ...dataSources.fundamental,
        ...dataSources.profile,
      ].join(",") || "none"}`,
    );

    const providerStatus: DatabaseProviderStatus = {
      provider: "database",
      ok: missingFields.length === 0,
      endpoint: "postgres:DatabaseMarketLatest+DatabaseToolLatest",
      latencyMs: Date.now() - startedAt,
      code: missingFields.length ? "database_v2_aiden_stock_partial" : undefined,
      retryable: missingFields.length > 0,
    };
    return databaseOk("aiden.stock_context", "database", data, providerStatus, missingFields);
  } catch (error) {
    return databaseError("aiden.stock_context", "database", {
      provider: "database",
      ok: false,
      endpoint: "postgres:DatabaseMarketLatest+DatabaseToolLatest",
      latencyMs: Date.now() - startedAt,
      code: "database_v2_aiden_stock_unavailable",
      message: error instanceof Error ? error.message.slice(0, 180) : String(error).slice(0, 180),
      retryable: true,
    }, ["aiden.stock_context"]);
  }
}

export async function getDatabaseAidenContext(options?: {
  tickers?: string[];
  tradingDate?: string;
  previousTradingDate?: string;
  windowHours?: number;
  useFiinquantFallback?: boolean;
  useFiinquantEnrichment?: boolean;
}): Promise<DatabaseResult<DatabaseAidenContext>> {
  const startedAt = Date.now();
  const tradingDate = options?.tradingDate ?? dateKeyInVietnam();
  const previousTradingDate = options?.previousTradingDate ?? previousTradingDateKey();
  try {
    const tickers = Array.from(new Set((options?.tickers ?? []).map(normalizeTicker).filter(Boolean))).slice(0, 4);
    const eodPromise = getCachedDatabaseEodMarketDataset({ tradingDate: previousTradingDate })
      .then((cached) => cached ?? getDatabaseEodMarketDataset({
        tradingDate: previousTradingDate,
        useFiinquantEnrichment: options?.useFiinquantEnrichment ?? options?.useFiinquantFallback ?? true,
      }));
    const [eod, latestNews, marketNews, macroNews, globalNews, tickerResults] = await Promise.all([
      eodPromise,
      getDatabaseNewsDataset({ category: "latest", limit: 12, windowHours: options?.windowHours ?? 36 }),
      getDatabaseNewsDataset({ category: "market", limit: 12, windowHours: options?.windowHours ?? 36 }),
      getDatabaseNewsDataset({ category: "macro", limit: 8, windowHours: options?.windowHours ?? 36 }),
      getDatabaseNewsDataset({ category: "global", limit: 8, windowHours: options?.windowHours ?? 36 }),
      Promise.all(tickers.map((ticker) => getDatabaseAidenTickerContext({
        ticker,
        tradingDate: previousTradingDate,
        windowHours: options?.windowHours,
      }))),
    ]);

    const market = buildMarketContext({ tradingDate, previousTradingDate, eod });
    const availableIndices = new Set((market?.indices ?? []).filter((item) => item.value != null).map((item) => item.ticker));
    const missingFields = [
      ...(!market ? ["aiden.market"] : []),
      ...REQUIRED_INDICES.filter((ticker) => !availableIndices.has(ticker)).map((ticker) => `aiden.market.index:${ticker}`),
      ...(!(latestNews.data?.length) ? ["aiden.news.latest"] : []),
      ...(!(marketNews.data?.length) ? ["aiden.news.market"] : []),
      ...(!(macroNews.data?.length || globalNews.data?.length) ? ["aiden.news.macro_or_global"] : []),
      ...eod.missingFields.map((field) => `aiden.eod:${field}`),
      ...latestNews.missingFields.map((field) => `aiden.news:${field}`),
      ...marketNews.missingFields.map((field) => `aiden.news:${field}`),
      ...(!(macroNews.data?.length || globalNews.data?.length)
        ? [...macroNews.missingFields, ...globalNews.missingFields].map((field) => `aiden.news:${field}`)
        : []),
      ...tickerResults.flatMap((item) => item.missingFields.map((field) => `${item.data?.ticker ?? "ticker"}:${field}`)),
    ];

    const data: DatabaseAidenContext = {
      generatedAt: new Date().toISOString(),
      format: "database-v2-aiden-context",
      market,
      news: {
        latest: latestNews.data ?? [],
        market: marketNews.data ?? [],
        macro: macroNews.data ?? [],
        global: globalNews.data ?? [],
      },
      tickers: tickerResults.map((item) => item.data).filter((item): item is DatabaseAidenTickerContext => Boolean(item)),
      missingFields,
    };

    const providerStatus: DatabaseProviderStatus = {
      provider: "database",
      ok: missingFields.length === 0,
      endpoint: "postgres:DatabaseMarketLatest+DatabaseToolLatest+DatabaseNewsItem+fiinquant:eod",
      latencyMs: Date.now() - startedAt,
      code: missingFields.length ? "database_v2_aiden_partial" : undefined,
      retryable: missingFields.length > 0,
    };
    return databaseOk("aiden.context", "database", data, providerStatus, missingFields);
  } catch (error) {
    return databaseError("aiden.context", "database", {
      provider: "database",
      ok: false,
      endpoint: "postgres:DatabaseMarketLatest+DatabaseToolLatest+DatabaseNewsItem+fiinquant:eod",
      latencyMs: Date.now() - startedAt,
      code: "database_v2_aiden_unavailable",
      message: error instanceof Error ? error.message.slice(0, 180) : String(error).slice(0, 180),
      retryable: true,
    }, ["aiden.context"]);
  }
}

export async function getDatabaseAidenHealth(options?: {
  sampleTickers?: string[];
  useFiinquantFallback?: boolean;
  useFiinquantEnrichment?: boolean;
}): Promise<DatabaseAidenHealth> {
  const sampleTickers = (options?.sampleTickers?.length ? options.sampleTickers : DEFAULT_SAMPLE_TICKERS)
    .map(normalizeTicker)
    .filter(Boolean)
    .slice(0, 6);
  const context = await getDatabaseAidenContext({
    tickers: sampleTickers,
    useFiinquantEnrichment: options?.useFiinquantEnrichment ?? options?.useFiinquantFallback,
  });
  const data = context.data;
  const availableIndices = (data?.market?.indices ?? [])
    .filter((item) => item.value != null)
    .map((item) => item.ticker);
  const tickerChecks = sampleTickers.map((ticker) => {
    const item = data?.tickers.find((row) => row.ticker === ticker);
    return {
      ticker,
      ok: Boolean(item && item.market.price != null && item.dailyOhlcv),
      hasPrice: Boolean(item?.market.price != null),
      hasOhlcv: Boolean(item?.dailyOhlcv),
      newsCount: item?.relatedNews.length ?? 0,
      missingFields: item?.missingFields ?? ["aiden.stock.context"],
    };
  });
  const news = data?.news;
  const checks = {
    market: {
      ok: REQUIRED_INDICES.every((ticker) => availableIndices.includes(ticker)),
      requiredIndices: REQUIRED_INDICES,
      availableIndices,
    },
    news: {
      ok: Boolean(news && news.latest.length && news.market.length && (news.macro.length || news.global.length)),
      latestCount: news?.latest.length ?? 0,
      marketCount: news?.market.length ?? 0,
      macroCount: news?.macro.length ?? 0,
      globalCount: news?.global.length ?? 0,
    },
    tickers: tickerChecks,
  };
  const missingFields = [
    ...context.missingFields,
    ...(!checks.market.ok ? ["aiden.health.market"] : []),
    ...(!checks.news.ok ? ["aiden.health.news"] : []),
    ...tickerChecks.flatMap((item) => item.ok ? [] : item.missingFields.map((field) => `${item.ticker}:${field}`)),
  ];
  const ok = missingFields.length === 0;
  return {
    ok,
    status: ok ? "ok" : data ? "degraded" : "blocked",
    checkedAt: new Date().toISOString(),
    sampleTickers,
    missingFields,
    checks,
  };
}
