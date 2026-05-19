import type { Prisma } from "@prisma/client";
import type { DatabaseProviderStatus, DatabaseResult } from "@/lib/database/contracts";
import { databaseError, databaseOk } from "@/lib/database/contracts";
import { getDatabaseEodMarketDataset } from "@/lib/database/eod";
import { getDatabaseNewsDataset } from "@/lib/database/providers/news";
import type { DatabaseNewsItem } from "@/lib/database/providers/news";
import { prisma } from "@/lib/prisma";
import type {
  DatabaseAidenContext,
  DatabaseAidenHealth,
  DatabaseAidenMarketContext,
  DatabaseAidenTickerContext,
} from "./types";

type JsonRecord = Record<string, unknown>;

const REQUIRED_INDICES = ["VNINDEX", "VN30", "HNXINDEX", "UPCOMINDEX"];
const DEFAULT_SAMPLE_TICKERS = ["HPG", "FPT", "DGC"];

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

function asNumber(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string") {
    const cleaned = value.replace(/[^\d.,-]/g, "").replace(/,/g, "").trim();
    if (!cleaned) return null;
    const parsed = Number(cleaned);
    if (Number.isFinite(parsed)) return parsed;
  }
  return null;
}

function firstNumber(record: JsonRecord, keys: string[]) {
  for (const key of keys) {
    const value = asNumber(record[key]);
    if (value != null) return value;
  }
  return null;
}

function normalizeTicker(value: string) {
  return value.trim().toUpperCase().replace(/[^A-Z0-9._-]/g, "");
}

function rowPayload(row: { payload: Prisma.JsonValue } | null) {
  return asRecord(row?.payload);
}

function rowUpdatedAt(row: { receivedAt?: Date; updatedAt?: Date; providerTime?: Date | null } | null) {
  return (row?.providerTime ?? row?.updatedAt ?? row?.receivedAt)?.toISOString() ?? null;
}

function buildTickerMarket(
  latestRow: { payload: Prisma.JsonValue; tradingDate: string; providerTime: Date | null; updatedAt: Date; receivedAt: Date } | null,
  ohlcvRow: { payload: Prisma.JsonValue; tradingDate?: string; providerTime: Date | null; updatedAt?: Date; receivedAt: Date } | null,
) {
  const latest = rowPayload(latestRow);
  const ohlcv = rowPayload(ohlcvRow);
  const latestPrice = firstNumber(latest, ["price", "matchPrice", "lastPrice", "close", "c"]);
  const payload = latestPrice != null ? latest : ohlcv;
  const price = firstNumber(payload, ["price", "matchPrice", "lastPrice", "close", "c"]);
  const reference = firstNumber(payload, ["reference", "refPrice", "basicPrice", "priorClosePrice", "previousClose"]);
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

function buildDailyOhlcv(row: { payload: Prisma.JsonValue; providerTime: Date | null; updatedAt?: Date; receivedAt: Date } | null) {
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
  const fallback = params.eod.data.fallback?.fiinquant;
  return {
    tradingDate: params.tradingDate,
    previousTradingDate: params.previousTradingDate,
    indices: params.eod.data.indices ?? [],
    breadth: params.eod.data.breadth ?? null,
    liquidity: params.eod.data.liquidity ?? null,
    foreignFlow: params.eod.data.foreignFlow ?? null,
    investorFlow: fallback
      ? {
          propTradingTopBuy: fallback.propTradingTopBuy,
          propTradingTopSell: fallback.propTradingTopSell,
          individualTopBuy: fallback.individualTopBuy,
          individualTopSell: fallback.individualTopSell,
        }
      : null,
  };
}

export async function getDatabaseAidenTickerContext(options: {
  ticker: string;
  windowHours?: number;
  tradingDate?: string;
}): Promise<DatabaseResult<DatabaseAidenTickerContext>> {
  const startedAt = Date.now();
  const ticker = normalizeTicker(options.ticker);
  const windowHours = options.windowHours ?? 72;
  if (!ticker) {
    return databaseError("aiden.stock_context", "database", {
      provider: "database",
      ok: false,
      endpoint: "postgres:DatabaseMarketLatest+DatabaseNewsItem",
      latencyMs: Date.now() - startedAt,
      code: "database_v2_aiden_ticker_invalid",
      retryable: false,
    }, ["ticker"]);
  }

  const since = new Date(Date.now() - windowHours * 60 * 60 * 1000);
  const [latestRow, ohlcvRow, eventRows, newsRows] = await Promise.all([
    prisma.databaseMarketLatest.findFirst({
      where: {
        source: "dnse",
        symbol: ticker,
        ...(options.tradingDate ? { tradingDate: options.tradingDate } : {}),
      },
      orderBy: { updatedAt: "desc" },
    }),
    prisma.databaseMarketLatest.findFirst({
      where: {
        source: "dnse",
        symbol: ticker,
        channel: "ohlc_closed.1D.json",
        ...(options.tradingDate ? { tradingDate: options.tradingDate } : {}),
      },
      orderBy: { updatedAt: "desc" },
    }),
    prisma.databaseMarketEvent.findMany({
      where: {
        source: "dnse",
        dataset: "market.eod",
        symbol: ticker,
        ...(options.tradingDate ? { tradingDate: options.tradingDate } : {}),
      },
      orderBy: { receivedAt: "desc" },
      take: 30,
    }),
    prisma.databaseNewsItem.findMany({
      where: {
        fetchedAt: { gte: since },
        OR: [
          { title: { contains: ticker } },
          { summary: { contains: ticker } },
        ],
      },
      orderBy: [{ publishedAt: "desc" }, { fetchedAt: "desc" }],
      take: 8,
    }),
  ]);

  const ohlcvEventRow = eventRows.find((row) => {
    const payload = rowPayload(row);
    return payload.T === "te" || payload.matchPrice != null || payload.openPrice != null;
  }) ?? null;
  const effectiveOhlcvRow = ohlcvRow ?? ohlcvEventRow;
  const market = buildTickerMarket(latestRow, effectiveOhlcvRow);
  const dailyOhlcv = buildDailyOhlcv(effectiveOhlcvRow);
  const missingFields = [
    market.price == null ? "aiden.stock.price" : null,
    market.changePct == null ? "aiden.stock.changePct" : null,
    !dailyOhlcv ? "aiden.stock.ohlcv" : null,
  ].filter((item): item is string => Boolean(item));

  const data: DatabaseAidenTickerContext = {
    ticker,
    market,
    dailyOhlcv,
    relatedNews: newsRows.map(newsItem),
    missingFields,
  };

  const providerStatus: DatabaseProviderStatus = {
    provider: "database",
    ok: missingFields.length === 0,
    endpoint: "postgres:DatabaseMarketLatest+DatabaseNewsItem",
    latencyMs: Date.now() - startedAt,
    code: missingFields.length ? "database_v2_aiden_stock_partial" : undefined,
    retryable: missingFields.length > 0,
  };
  return databaseOk("aiden.stock_context", "database", data, providerStatus, missingFields);
}

export async function getDatabaseAidenContext(options?: {
  tickers?: string[];
  tradingDate?: string;
  previousTradingDate?: string;
  windowHours?: number;
  useFiinquantFallback?: boolean;
}): Promise<DatabaseResult<DatabaseAidenContext>> {
  const startedAt = Date.now();
  const tradingDate = options?.tradingDate ?? dateKeyInVietnam();
  const previousTradingDate = options?.previousTradingDate ?? previousTradingDateKey();
  try {
    const tickers = Array.from(new Set((options?.tickers ?? []).map(normalizeTicker).filter(Boolean))).slice(0, 4);
    const [eod, latestNews, marketNews, macroNews, globalNews, tickerResults] = await Promise.all([
      getDatabaseEodMarketDataset({
        tradingDate: previousTradingDate,
        useFiinquantFallback: options?.useFiinquantFallback ?? true,
      }),
      getDatabaseNewsDataset({ category: "latest", limit: 12, windowHours: options?.windowHours ?? 36 }),
      getDatabaseNewsDataset({ category: "market", limit: 12, windowHours: options?.windowHours ?? 36 }),
      getDatabaseNewsDataset({ category: "macro", limit: 8, windowHours: options?.windowHours ?? 36 }),
      getDatabaseNewsDataset({ category: "global", limit: 8, windowHours: options?.windowHours ?? 36 }),
      Promise.all(tickers.map((ticker) => getDatabaseAidenTickerContext({
        ticker,
        tradingDate: options?.tradingDate,
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
      ...macroNews.missingFields.map((field) => `aiden.news:${field}`),
      ...globalNews.missingFields.map((field) => `aiden.news:${field}`),
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
      endpoint: "postgres:DatabaseMarketLatest+DatabaseNewsItem+fiinquant:eod",
      latencyMs: Date.now() - startedAt,
      code: missingFields.length ? "database_v2_aiden_partial" : undefined,
      retryable: missingFields.length > 0,
    };
    return databaseOk("aiden.context", "database", data, providerStatus, missingFields);
  } catch (error) {
    return databaseError("aiden.context", "database", {
      provider: "database",
      ok: false,
      endpoint: "postgres:DatabaseMarketLatest+DatabaseNewsItem+fiinquant:eod",
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
}): Promise<DatabaseAidenHealth> {
  const sampleTickers = (options?.sampleTickers?.length ? options.sampleTickers : DEFAULT_SAMPLE_TICKERS)
    .map(normalizeTicker)
    .filter(Boolean)
    .slice(0, 6);
  const context = await getDatabaseAidenContext({
    tickers: sampleTickers,
    useFiinquantFallback: options?.useFiinquantFallback,
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
