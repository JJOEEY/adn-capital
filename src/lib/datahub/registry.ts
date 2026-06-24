import { NextRequest } from "next/server";
import {
  fetchIndexContribution,
  fetchIndexValuation,
  fetchInvestorTrading,
  fetchMarketBoard,
  fetchMarketDepth,
  fetchRealtimeTradingData,
} from "@/lib/fiinquantClient";
import { getMarketSnapshot } from "@/lib/marketDataFetcher";
import { prisma } from "@/lib/prisma";
import { getPythonBridgeUrl } from "@/lib/runtime-config";
import { fetchVnstockInvestorFlow, fetchVnstockIndexImpact } from "@/lib/vnstockClient";
import { fetchFAData, fetchTAData, type FAData, type TAData } from "@/lib/stockData";
import { resolveMarketTicker } from "@/lib/ticker-resolver";
import {
  fetchDnseInstruments,
  fetchDnseMarketBoard,
  fetchDnseOhlc,
} from "@/lib/providers/dnse/market-data";
import { listDnseOrderHistory } from "@/lib/brokers/dnse/order-history";
import { decryptDnseToken } from "@/lib/brokers/dnse/crypto";
import { getDnseTradingClient } from "@/lib/providers/dnse/trading-client";
import type { SignalScanArtifact } from "@/lib/signals/scan-artifact";
import { RADAR_SCAN_BUDGET, SIGNAL_SCAN_SLOTS } from "@/lib/signals/radar-scan-config";
import { loadReportedSignalSummary } from "@/lib/signals/report-history";
import { normalizeSignalPrice } from "@/lib/signals/price-units";
import {
  getDatabaseRadarRealtime,
  getDatabaseToolLatest,
  isDatabaseV2RadarRealtimeEnabled,
  isDatabaseV2ReplaceV1Enabled,
  listDatabaseToolLatest,
} from "@/lib/database";
import { upsertDatabaseToolLatest } from "@/lib/database/tool-latest";
import { classifyTickerSector } from "@/lib/market/sector-classification";
import {
  applyMarketPriceScale,
  chooseMarketDisplayPrice,
  getMarketPayloadRows,
  latestClosePriceFromPayload,
  latestTurnoverPriceFromPayload,
  marketPriceScaleFromPayload,
  normalizeMarketBoardRow,
  normalizeHistoricalPricePayload,
} from "@/lib/market-price-normalization";
import { buildStockPriceSnapshot, type StockPriceSnapshot } from "@/lib/market-price-snapshot";
import { isIndexTicker } from "@/lib/vn-reference-indices";
import { resolveTopicFamily, resolveTopicStaleWindowMs } from "./policy";
import { TopicContext, TopicDefinition } from "./types";

type JsonRecord = Record<string, unknown>;
type PersistedSignalScanArtifact = SignalScanArtifact & {
  cronLogId: string;
  persistedAt: Date;
};

const PRECOMPUTED_TOPIC_MAX_AGE_MS = 4 * 24 * 60 * 60 * 1000;

function safeParseJson(value: string | null) {
  if (!value) return null;
  try {
    return JSON.parse(value);
  } catch {
    return null;
  }
}

async function loadMarketOverview() {
  const mod = await import("@/app/api/market/route");
  const res = await mod.GET();
  if (!res.ok) throw new Error(`market overview HTTP ${res.status}`);
  return res.json();
}

async function loadCompositeCache() {
  const mod = await import("@/app/api/market-status/route");
  const res = await mod.GET();
  if (!res.ok) throw new Error(`market-status HTTP ${res.status}`);
  return res.json();
}

async function loadCompositeLive() {
  const mod = await import("@/app/api/market-overview/route");
  const res = await mod.GET(new NextRequest("http://localhost/api/market-overview"));
  if (!res.ok) throw new Error(`market-overview HTTP ${res.status}`);
  return res.json();
}

async function loadRadarWatchlistActive() {
  return {
    kind: "radar_watchlist_active",
    version: "v1",
    policy: "hot_plus_wide_confirm",
    slots: SIGNAL_SCAN_SLOTS,
    budget: RADAR_SCAN_BUDGET,
    updatedAt: new Date().toISOString(),
  };
}

async function loadRadarPrefilterLatest() {
  const latestScan = await loadLatestSignalScanArtifact();
  return {
    kind: "radar_prefilter_latest",
    version: "v1",
    latestScan,
    updatedAt: new Date().toISOString(),
  };
}

async function loadIndexValuation(ticker: string) {
  if (ticker.toUpperCase() !== "VNINDEX") throw new Error(`Unsupported index valuation ticker: ${ticker}`);
  const valuation = await fetchIndexValuation(ticker).catch(() => null);
  if (valuation && (valuation.pe != null || valuation.pb != null)) {
    return {
      ticker: "VNINDEX",
      pe: valuation.pe ?? null,
      pb: valuation.pb ?? null,
      valuationScore: valuation.valuation_score ?? null,
      peScore: valuation.pe_score ?? null,
      pbScore: valuation.pb_score ?? null,
      timestamp: valuation.timestamp ?? new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
  }
  // FiinQuant rỗng (hết hạn 27/6) → vnstock SentimentInsights pe/pb.
  const vn = await fetchVnstockIndexImpact().catch(() => null);
  if (vn?.valuation && (vn.valuation.pe != null || vn.valuation.pb != null)) {
    return {
      ticker: "VNINDEX",
      pe: vn.valuation.pe ?? null,
      pb: vn.valuation.pb ?? null,
      valuationScore: null,
      peScore: null,
      pbScore: null,
      timestamp: vn.retrievedAt ?? new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
  }
  throw new Error(`index valuation unavailable: ${ticker}`);
}

async function loadNews(type: "morning" | "eod" | "close") {
  const mod = await import("@/app/api/market-news/route");
  const newsType = type === "close" ? "eod" : type;
  const req = new NextRequest(`http://localhost/api/market-news?type=${newsType}&stored=1`);
  const res = await mod.GET(req);
  if (!res.ok) throw new Error(`market-news ${newsType} HTTP ${res.status}`);
  const payload = await res.json();
  if (type !== "close") return payload;
  return {
    ...payload,
    reportType: "close_brief_15h",
    source: "live_market_snapshot_fallback",
  };
}

function parseVnDayRange(dateKey: string) {
  const [yearRaw, monthRaw, dayRaw] = dateKey.split("-");
  const year = Number(yearRaw);
  const month = Number(monthRaw);
  const day = Number(dayRaw);
  if (
    !Number.isInteger(year) ||
    !Number.isInteger(month) ||
    !Number.isInteger(day) ||
    month < 1 ||
    month > 12 ||
    day < 1 ||
    day > 31
  ) {
    throw new Error("Invalid date key");
  }
  const start = new Date(Date.UTC(year, month - 1, day, 0, 0, 0) - 7 * 60 * 60 * 1000);
  const end = new Date(start.getTime() + 24 * 60 * 60 * 1000);
  return { start, end };
}

async function loadBriefByTypeAndDate(type: "morning_brief" | "close_brief_15h" | "eod_full_19h", dateKey: string) {
  const { start, end } = parseVnDayRange(dateKey);
  const report = await prisma.marketReport.findFirst({
    where: {
      type,
      createdAt: {
        gte: start,
        lt: end,
      },
    },
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      type: true,
      title: true,
      content: true,
      rawData: true,
      metadata: true,
      createdAt: true,
    },
  });

  if (!report) return null;

  return {
    ...report,
    rawData: safeParseJson(report.rawData),
    metadata: safeParseJson(report.metadata),
  };
}

function readPositiveNumber(value: unknown) {
  const numberValue = Number(value);
  return Number.isFinite(numberValue) && numberValue > 0 ? numberValue : null;
}

function hasCompleteBriefMarketFields(value: unknown): boolean {
  if (!value || typeof value !== "object") return false;
  const record = value as JsonRecord;
  const rawData = record.rawData && typeof record.rawData === "object" ? (record.rawData as JsonRecord) : null;
  const metadata = record.metadata && typeof record.metadata === "object" ? (record.metadata as JsonRecord) : null;
  const snapshot =
    rawData?.snapshot && typeof rawData.snapshot === "object"
      ? (rawData.snapshot as JsonRecord)
      : record.snapshot && typeof record.snapshot === "object"
        ? (record.snapshot as JsonRecord)
        : null;
  const liquidityByExchange =
    record.liquidity_by_exchange ??
    record.liquidityByExchange ??
    metadata?.liquidityByExchange ??
    snapshot?.liquidityByExchange;
  const liquidityRecord =
    liquidityByExchange && typeof liquidityByExchange === "object" ? (liquidityByExchange as JsonRecord) : null;
  const hasExchangeLiquidity =
    readPositiveNumber(liquidityRecord?.HOSE) != null &&
    readPositiveNumber(liquidityRecord?.HNX) != null &&
    readPositiveNumber(liquidityRecord?.UPCOM) != null;

  const breadth = record.breadth ?? metadata?.breadth ?? snapshot?.breadth;
  const breadthRecord = breadth && typeof breadth === "object" ? (breadth as JsonRecord) : null;
  const breadthTotal =
    readPositiveNumber(breadthRecord?.total) ??
    readPositiveNumber(
      Number(breadthRecord?.up ?? 0) + Number(breadthRecord?.down ?? 0) + Number(breadthRecord?.unchanged ?? 0),
    );

  return hasExchangeLiquidity && breadthTotal != null;
}

async function loadLatestCloseBrief() {
  const row = await prisma.marketReport.findFirst({
    where: { type: "close_brief_15h" },
    orderBy: { createdAt: "desc" },
    select: { id: true, type: true, title: true, content: true, rawData: true, metadata: true, createdAt: true },
  });
  const parsed = row
    ? { ...row, rawData: safeParseJson(row.rawData), metadata: safeParseJson(row.metadata) }
    : null;
  if (hasCompleteBriefMarketFields(parsed)) return parsed;
  return loadNews("close");
}

async function loadSignalMapLatest() {
  const mod = await import("@/app/api/signals/route");
  const req = new NextRequest("http://localhost/api/signals?days=90");
  const res = await mod.GET(req);
  if (!res.ok) throw new Error(`signals HTTP ${res.status}`);
  return res.json();
}

async function loadRsRatingList(force = false) {
  const mod = await import("@/app/api/rs-rating/route");
  const url = new URL("http://localhost/api/rs-rating");
  if (force) url.searchParams.set("force", "1");
  const res = await mod.GET(new NextRequest(url.toString()));
  if (!res.ok) throw new Error(`rs-rating HTTP ${res.status}`);
  return res.json();
}

type PrecomputedTopicArtifact = {
  artifactType: "datahub_topic";
  topic: string;
  value: unknown;
  computedAt: string;
};

function extractPrecomputedTopicValue(
  row: { resultData: string | null; createdAt: Date },
  topic: string,
  maxAgeMs = PRECOMPUTED_TOPIC_MAX_AGE_MS,
) {
  const ageMs = Date.now() - row.createdAt.getTime();
  if (!Number.isFinite(ageMs) || ageMs > maxAgeMs) return null;
  const parsed = safeParseJson(row.resultData);
  if (!parsed || typeof parsed !== "object") return null;
  const record = parsed as Partial<PrecomputedTopicArtifact>;
  if (record.artifactType !== "datahub_topic" || record.topic !== topic) return null;
  return record.value ?? null;
}

async function loadLatestPrecomputedTopicValue(cronName: string, topic: string) {
  const rows = await prisma.cronLog.findMany({
    where: { cronName, status: "success" },
    orderBy: { createdAt: "desc" },
    take: 20,
    select: { resultData: true, createdAt: true },
  });
  for (const row of rows) {
    const value = extractPrecomputedTopicValue(row, topic);
    if (value != null) return value;
  }
  return null;
}

async function loadRsRatingTopic(force = false) {
  if (!force) {
    const cached = await loadLatestPrecomputedTopicValue("adn_rank_15h", "research:rs-rating:list");
    if (cached) return cached;
  }
  return loadRsRatingList(force);
}

function tickerFromTopic(topicKey: string, prefix: string): string {
  const ticker = topicKey.slice(prefix.length).trim().toUpperCase();
  return ticker.replace(/[^A-Z0-9]/g, "");
}

async function assertValidTicker(ticker: string) {
  const resolved = await resolveMarketTicker(ticker);
  if (!resolved.valid) {
    throw new Error(`Invalid ticker: ${ticker}`);
  }
  return resolved;
}

const REALTIME_TIMEFRAMES = new Set(["1m", "5m", "15m", "30m"]);

function normalizeBoardTickers(raw: string) {
  return Array.from(
    new Set(
      raw
        .split(",")
        .map((ticker) => ticker.trim().toUpperCase().replace(/[^A-Z0-9._-]/g, ""))
        .filter(Boolean),
    ),
  ).slice(0, 50);
}

async function loadMarketBoardForTickers(rawTickers: string) {
  const candidates = normalizeBoardTickers(rawTickers);
  const resolved = await Promise.all(
    candidates.map(async (ticker) => {
      const result = await resolveMarketTicker(ticker);
      return result.valid ? result.ticker : null;
    }),
  );
  const tickers = Array.from(new Set(resolved.filter((ticker): ticker is string => Boolean(ticker))));
  // DNSE realtime trước. Chỉ gọi FiinQuant (batch-price, timeout 30s, hay treo) khi DNSE THIẾU mã —
  // tránh Promise.all chờ FiinQuant timeout 30s dù DNSE đã xong → đây là gốc trễ ~30s của giá ADN Stock.
  const dnseBoard = await fetchDnseMarketBoard(tickers).catch(() => null);
  const dnseHasAll = tickers.length > 0 && tickers.every((ticker) => dnseBoard?.prices?.[ticker]);
  const bridgeBoard = dnseHasAll ? null : await fetchMarketBoard(tickers).catch(() => null);
  const priceEntries: Array<[string, JsonRecord]> = [];
  for (const ticker of tickers) {
    const dnseRow = dnseBoard?.prices?.[ticker] as JsonRecord | undefined;
    const bridgeRow = bridgeBoard?.prices?.[ticker] as JsonRecord | undefined;
    if (!dnseRow && !bridgeRow) continue;
    const merged = {
      ...(bridgeRow ?? {}),
      ...(dnseRow ?? {}),
      reference: dnseRow?.reference ?? dnseRow?.refPrice ?? bridgeRow?.reference ?? bridgeRow?.refPrice,
      ceiling: dnseRow?.ceiling ?? bridgeRow?.ceiling,
      floor: dnseRow?.floor ?? bridgeRow?.floor,
      source: dnseRow ? "DNSE realtime" : bridgeRow?.source,
    };
    priceEntries.push([ticker, normalizeMarketBoardRow(merged)]);
  }
  const prices = Object.fromEntries(priceEntries);
  return {
    tickers,
    prices,
    source: dnseBoard ? "DNSE realtime + FiinQuant fallback" : "FiinQuant fallback",
    updatedAt: new Date().toISOString(),
  };
}

async function loadSignalList(status: "RADAR" | "ACTIVE") {
  const reportedToday = status === "RADAR" ? await loadReportedSignalSummary() : null;
  const reportedIdentities =
    reportedToday?.rows.map((row) => ({
      ticker: row.ticker.toUpperCase().trim(),
      type: row.signalType.toUpperCase().trim(),
    })) ?? [];
  const where =
    status === "RADAR" && reportedIdentities.length > 0
      ? {
          OR: [
            { status: "RADAR" },
            ...reportedIdentities.map((identity) => ({
              ticker: identity.ticker,
              type: identity.type,
              status: { in: ["RADAR", "ACTIVE", "HOLD_TO_DIE"] },
            })),
          ],
        }
      : { status };

  const rows = await prisma.signal.findMany({
    where,
    orderBy: [{ updatedAt: "desc" }, { createdAt: "desc" }],
    take: 120,
    select: {
      id: true,
      ticker: true,
      type: true,
      status: true,
      tier: true,
      entryPrice: true,
      currentPrice: true,
      currentPnl: true,
      target: true,
      stoploss: true,
      navAllocation: true,
      winRate: true,
      sharpeRatio: true,
      rrRatio: true,
      updatedAt: true,
      createdAt: true,
    },
  });

  const normalizedRows = rows.map((row) => ({
    ...row,
    entryPrice: normalizeSignalPrice(row.entryPrice),
    currentPrice: normalizeSignalPrice(row.currentPrice),
    target: normalizeSignalPrice(row.target),
    stoploss: normalizeSignalPrice(row.stoploss),
  }));
  if (status !== "RADAR" || !isDatabaseV2ReplaceV1Enabled() || !isDatabaseV2RadarRealtimeEnabled()) {
    return normalizedRows;
  }
  const realtime = await getDatabaseRadarRealtime().catch(() => null);
  const ticks = new Map((realtime?.data?.latest ?? []).map((tick) => [tick.ticker, tick]));
  return normalizedRows.map((row) => {
    const tick = ticks.get(row.ticker);
    if (!tick) return row;
    return {
      ...row,
      currentPrice: tick.price ?? row.currentPrice,
      currentPnl:
        tick.price != null && row.entryPrice
          ? Number((((tick.price - row.entryPrice) / row.entryPrice) * 100).toFixed(2))
          : row.currentPnl,
      realtime: {
        price: tick.price,
        changePct: tick.changePct,
        volume: tick.volume,
        updatedAt: tick.updatedAt,
      },
    };
  });
}

async function loadDatabaseV2ToolPayload<T>(tool: string, dataset: string, maxAgeMs?: number): Promise<T | null> {
  if (!isDatabaseV2ReplaceV1Enabled()) return null;
  const row = await getDatabaseToolLatest<T>({ tool, dataset, key: "latest", maxAgeMs }).catch(() => null);
  return row?.payload ?? null;
}

async function loadDatabaseV2MorningBriefTopic() {
  if (!isDatabaseV2ReplaceV1Enabled()) return loadNews("morning");
  const cached = await loadDatabaseV2ToolPayload("brief", "brief.morning", 24 * 60 * 60_000);
  if (cached) return cached;
  return loadNews("morning");
}

async function loadDatabaseV2EodBriefTopic() {
  return loadNews("eod");
}

async function loadDatabaseV2PulseTopic(force = false) {
  const cached = !force ? await loadDatabaseV2ToolPayload("pulse", "pulse.smartflow", 30 * 60_000) : null;
  return cached ?? loadPulseSmartflowTopic(force);
}

async function loadDatabaseV2RankTopic(force = false) {
  // ADN Rank hiện ĐẦY ĐỦ universe (~500 mã): ưu tiên list từ route /api/rs-rating (route tự cache 15').
  // Cache database_v2 trước đây bị thu hẹp còn ~157 mã (cổng thanh khoản) → ẩn nhiều mã hợp lệ
  // (AGR, EVS, DRC, LHG, nhiều mã CK...). Giờ cache chỉ là FALLBACK khi route lỗi.
  try {
    const full = await loadRsRatingList(force);
    const stocks = (full as { stocks?: unknown[] } | null)?.stocks;
    if (Array.isArray(stocks) && stocks.length > 0) return full;
  } catch {
    // route lỗi → fallback cache bên dưới
  }
  const cached = await loadDatabaseV2ToolPayload("rank", "rank.rs", 24 * 60 * 60_000).catch(() => null);
  return cached ?? loadRsRatingTopic(force);
}

async function loadPortfolioSignalsForUser(userId: string) {
  const [user, activeSignals] = await Promise.all([
    prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, dnseId: true, dnseVerified: true },
    }),
    loadSignalList("ACTIVE"),
  ]);

  const navAllocatedPct = activeSignals.reduce((sum, row) => sum + (row.navAllocation ?? 0), 0);
  return {
    connected: Boolean(user?.dnseId && user?.dnseVerified),
    dnse: user?.dnseId
      ? {
          id: user.dnseId,
          verified: Boolean(user.dnseVerified),
        }
      : null,
    summary: {
      activeCount: activeSignals.length,
      navAllocatedPct: Number(navAllocatedPct.toFixed(2)),
    },
    positions: activeSignals,
  };
}

async function loadPortfolioOverviewForUser(userId: string) {
  const portfolio = await loadPortfolioSignalsForUser(userId);
  const navAllocatedPct = portfolio.summary.navAllocatedPct;
  return {
    connected: portfolio.connected,
    summary: {
      activeCount: portfolio.summary.activeCount,
      navAllocatedPct,
      navRemainingPct: Number(Math.max(0, 100 - navAllocatedPct).toFixed(2)),
      maxActiveNavPct: 90,
    },
  };
}

async function loadPortfolioHoldingForUser(userId: string, ticker: string) {
  const portfolio = await loadPortfolioSignalsForUser(userId);
  const target = ticker.toUpperCase();
  const holding = portfolio.positions.find((item) => item.ticker === target) ?? null;
  return {
    ticker: target,
    connected: portfolio.connected,
    holding,
  };
}

async function loadWatchlistForUser(userId: string) {
  const [portfolio, radar, chats, savedItems] = await Promise.all([
    loadPortfolioSignalsForUser(userId),
    loadSignalList("RADAR"),
    prisma.chat.findMany({
      where: { userId },
      orderBy: { createdAt: "desc" },
      take: 50,
      select: { message: true },
    }),
    prisma.userWatchlistItem.findMany({
      where: { userId },
      orderBy: { updatedAt: "desc" },
      select: { ticker: true },
    }),
  ]);

  const tickers = new Set<string>();
  for (const row of savedItems) tickers.add(row.ticker);
  for (const row of portfolio.positions) tickers.add(row.ticker);
  for (const row of radar) tickers.add(row.ticker);
  for (const row of chats) {
    const matches = row.message.toUpperCase().match(/\b[A-Z]{3,4}\b/g) ?? [];
    for (const m of matches) tickers.add(m);
  }

  return {
    userId,
    count: tickers.size,
    items: Array.from(tickers).sort(),
  };
}

async function loadSeasonalityForTicker(ticker: string) {
  let row: {
    ticker: string;
    winRate: number | null;
    sharpeRatio: number | null;
    rrRatio: string | null;
    updatedAt: Date;
    createdAt: Date;
  } | null = null;
  try {
    row = await prisma.signal.findFirst({
      where: { ticker },
      orderBy: { updatedAt: "desc" },
      select: {
        ticker: true,
        winRate: true,
        sharpeRatio: true,
        rrRatio: true,
        updatedAt: true,
        createdAt: true,
      },
    });
  } catch (error) {
    console.warn("[DataHub research] optional seasonality Signal unavailable:", error);
  }
  if (!row) return null;
  return {
    ticker: row.ticker,
    winRate: row.winRate,
    sharpeRatio: row.sharpeRatio,
    rrRatio: row.rrRatio,
    updatedAt: row.updatedAt,
    createdAt: row.createdAt,
  };
}

async function loadSignalForTicker(ticker: string) {
  return prisma.signal.findFirst({
    where: { ticker },
    orderBy: { updatedAt: "desc" },
    select: {
      id: true,
      ticker: true,
      type: true,
      status: true,
      entryPrice: true,
      target: true,
      stoploss: true,
      currentPrice: true,
      currentPnl: true,
      aiReasoning: true,
      winRate: true,
      sharpeRatio: true,
      rrRatio: true,
      updatedAt: true,
    },
  });
}

async function loadTickerNews(ticker: string) {
  try {
    const backend = getPythonBridgeUrl();
    const res = await fetch(`${backend}/api/v1/news/${encodeURIComponent(ticker)}?limit=6`, {
      cache: "no-store",
      signal: AbortSignal.timeout(20_000),
    });
    if (!res.ok) return [];
    const payload = (await res.json()) as { items?: JsonRecord[]; news?: JsonRecord[] };
    return Array.isArray(payload.items) ? payload.items : Array.isArray(payload.news) ? payload.news : [];
  } catch (error) {
    console.warn("[DataHub research] optional ticker news unavailable:", error);
    return [];
  }
}

async function loadOptionalTickerArt(ticker: string) {
  try {
    const readArtNumber = (value: unknown) => {
      const numberValue = Number(value);
      return Number.isFinite(numberValue) ? numberValue : null;
    };
    const backend = getPythonBridgeUrl();
    const res = await fetch(`${backend}/api/v1/rpi/${encodeURIComponent(ticker)}?days=120`, {
      cache: "no-store",
      signal: AbortSignal.timeout(12_000),
    });
    if (!res.ok) return null;
    const payload = await res.json() as JsonRecord;
    const score = readArtNumber(payload.rpi_current) ?? readArtNumber(payload.tei) ?? readArtNumber(payload.rpi);
    const ma7 = readArtNumber(payload.rpi_ma7) ?? readArtNumber(payload.ma7);
    if (score == null) return null;
    return {
      score,
      ma7,
      status: payload.status ?? payload.classification ?? null,
      updatedAt: payload.updatedAt ?? payload.date ?? null,
    };
  } catch (error) {
    console.warn("[DataHub research] optional ADN ART unavailable:", error);
    return null;
  }
}

async function loadLeaderRadar() {
  const backend = getPythonBridgeUrl();
  const res = await fetch(`${backend}/api/v1/leader-radar`, {
    cache: "no-store",
    signal: AbortSignal.timeout(30_000),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`leader-radar HTTP ${res.status}: ${text}`);
  }
  return res.json();
}

async function loadBridgeHistoricalTicker(
  ticker: string,
  timeframe: string,
  days: number,
  timeout = 45_000,
) {
  const backend = getPythonBridgeUrl();
  const symbol = ticker.toUpperCase().trim();
  const res = await fetch(
    `${backend}/api/v1/historical/${encodeURIComponent(symbol)}?days=${days}&timeframe=${encodeURIComponent(timeframe)}&adjusted=false`,
    {
      cache: "no-store",
      signal: AbortSignal.timeout(timeout),
    },
  );
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`historical ${symbol} ${timeframe} HTTP ${res.status}: ${text}`);
  }
  const payload = await res.json();
  return normalizeHistoricalPricePayload(payload);
}

async function loadHistoricalTicker(ticker: string) {
  const historyDays = Number(process.env.ADN_STOCK_DAILY_HISTORY_DAYS ?? 1825);
  const dnsePayload = await fetchDnseOhlc(ticker, { timeframe: "1d", days: historyDays, timeoutMs: 12_000 }).catch(() => null);
  if (hasCandleRows(dnsePayload)) return dropPremarketCurrentDailyRow(dnsePayload);

  const attempts = [
    { days: historyDays, timeout: 45_000 },
    { days: 780, timeout: 45_000 },
    { days: 520, timeout: 45_000 },
    { days: 180, timeout: 35_000 },
    { days: 90, timeout: 25_000 },
  ];
  let lastError: unknown = null;

  for (const attempt of attempts) {
    try {
      const payload = await loadBridgeHistoricalTicker(ticker, "1d", attempt.days, attempt.timeout);
      if (hasCandleRows(payload)) return dropPremarketCurrentDailyRow(payload);
    } catch (error) {
      lastError = error;
      console.warn(`[DataHub market] historical ${ticker} ${attempt.days}d unavailable:`, error);
    }
  }

  throw lastError instanceof Error ? lastError : new Error(`historical ${ticker} unavailable`);
}

function currentVnDateKey() {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Ho_Chi_Minh",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date());
  const get = (type: string) => parts.find((part) => part.type === type)?.value ?? "";
  return `${get("year")}-${get("month")}-${get("day")}`;
}

function isCurrentVnTradingWeekday() {
  const weekday = new Intl.DateTimeFormat("en-US", {
    timeZone: "Asia/Ho_Chi_Minh",
    weekday: "short",
  }).format(new Date());
  return !["Sat", "Sun"].includes(weekday);
}

function currentVnMarketBoardDateKey() {
  if (!isCurrentVnTradingWeekday()) return null;
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "Asia/Ho_Chi_Minh",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).formatToParts(new Date());
  const rawHour = Number(parts.find((part) => part.type === "hour")?.value ?? 0);
  const hour = rawHour === 24 ? 0 : rawHour;
  const minute = Number(parts.find((part) => part.type === "minute")?.value ?? 0);
  return hour * 60 + minute >= 9 * 60 + 15 ? currentVnDateKey() : null;
}

function dropPremarketCurrentDailyRow<T>(payload: T): T {
  if (currentVnMarketBoardDateKey() != null) return payload;
  const rows = getMarketPayloadRows(payload);
  if (rows.length === 0) return payload;
  const last = rows[rows.length - 1] ?? {};
  const lastDate = normalizeChartDateKey(String(last.date ?? last.timestamp ?? last.time ?? ""));
  if (lastDate !== currentVnDateKey()) return payload;
  const nextRows = rows.slice(0, -1);

  if (payload && typeof payload === "object") {
    const record = payload as JsonRecord;
    if (Array.isArray(record.data)) return { ...record, data: nextRows } as T;
    if (Array.isArray(record.candles)) return { ...record, candles: nextRows } as T;
    if (Array.isArray(record.items)) return { ...record, items: nextRows } as T;
  }
  return nextRows as T;
}

function mergeMarketBoardCloseIntoHistorical(payload: unknown, boardRow: unknown) {
  const row = boardRow && typeof boardRow === "object" ? normalizeMarketBoardRow(boardRow as JsonRecord) : null;
  const close = readPositiveNumber(row?.close);
  if (close == null || !hasCandleRows(payload)) return payload;

  const rows = getMarketPayloadRows(payload);
  const last = rows[rows.length - 1] ?? {};
  const lastDate = normalizeChartDateKey(String(last.date ?? last.timestamp ?? last.time ?? ""));
  const date = currentVnMarketBoardDateKey() ?? lastDate;
  if (!date) return payload;
  const liveRow = {
    ...last,
    date,
    timestamp: Math.floor(Date.parse(`${date}T07:00:00.000Z`) / 1000),
    open: readPositiveNumber(row?.open) ?? readPositiveNumber(last.open ?? last.o) ?? close,
    high: Math.max(readPositiveNumber(row?.high) ?? close, close),
    low: Math.min(readPositiveNumber(row?.low) ?? close, close),
    close,
    volume: readPositiveNumber(row?.volume) ?? readPositiveNumber(last.volume ?? last.v) ?? 0,
  };
  const nextRows = lastDate === date ? [...rows.slice(0, -1), liveRow] : [...rows, liveRow];

  if (payload && typeof payload === "object") {
    const record = payload as JsonRecord;
    if (Array.isArray(record.data)) return { ...record, data: nextRows };
    if (Array.isArray(record.candles)) return { ...record, candles: nextRows };
    if (Array.isArray(record.items)) return { ...record, items: nextRows };
  }
  return nextRows;
}

function intradayHistoryDays(timeframe: string) {
  if (timeframe === "1m") return 5;
  if (timeframe === "5m") return 30;
  if (timeframe === "15m" || timeframe === "30m") return 90;
  return 5;
}

async function loadHistoricalTickerWithMarketClose(ticker: string) {
  const [historical, board] = await Promise.all([
    loadHistoricalTicker(ticker),
    loadMarketBoardForTickers(ticker).catch(() => null),
  ]);
  return mergeMarketBoardCloseIntoHistorical(historical, board?.prices?.[ticker.toUpperCase()]);
}

async function loadVNIndexChart30d() {
  const [payload, snapshot, marketOverview] = await Promise.all([
    loadBridgeHistoricalTicker("VNINDEX", "1d", 75, 4_000).catch(() => null),
    getMarketSnapshot().catch(() => null),
    loadMarketOverview().catch(() => null),
  ]);
  const fallbackRows = Array.isArray((marketOverview as { chartData?: unknown } | null)?.chartData)
    ? ((marketOverview as { chartData: unknown[] }).chartData as JsonRecord[])
    : [];
  const sourceRows = payload && hasCandleRows(payload) ? getMarketPayloadRows(payload) : fallbackRows;
  const data = sourceRows
    .map((row) => {
      const close = readPositiveNumber(row.close ?? row.c ?? row.price);
      const rawDate = String(row.date ?? row.timestamp ?? row.time ?? "").trim();
      const date = rawDate.split("T")[0].split(" ")[0];
      return close != null && date ? { date, close } : null;
    })
    .filter((row): row is { date: string; close: number } => Boolean(row))
    .slice(-30);

  // Điểm live của chart ưu tiên giá DNSE-primary từ /api/market (marketOverview.vnindex) → snapshot.
  const overviewLive = readPositiveNumber((marketOverview as { vnindex?: { value?: number } } | null)?.vnindex?.value);
  const withLivePoint = mergeLiveVNIndexChartPoint(data, snapshot, overviewLive ?? null);

  if (withLivePoint.length === 0) {
    throw new Error("VNINDEX chart 30d unavailable");
  }

  return {
    data: withLivePoint,
    count: withLivePoint.length,
    updatedAt: new Date().toISOString(),
    liveUpdatedAt: snapshot?.timestamp ?? null,
  };
}

function normalizeChartDateKey(value: string) {
  const raw = value.split("T")[0].split(" ")[0].trim();
  const ddmmyyyy = raw.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if (ddmmyyyy) return `${ddmmyyyy[3]}-${ddmmyyyy[2]}-${ddmmyyyy[1]}`;
  return raw;
}

function mergeLiveVNIndexChartPoint(
  data: Array<{ date: string; close: number }>,
  snapshot: Awaited<ReturnType<typeof getMarketSnapshot>> | null,
  overrideClose: number | null = null,
) {
  const liveIndex = snapshot?.indices?.find((item) => item.ticker === "VNINDEX");
  const liveClose = readPositiveNumber(overrideClose) ?? readPositiveNumber(liveIndex?.value);
  const liveDate = snapshot?.requestDateVN;
  if (liveClose == null || !liveDate) return data;

  const last = data[data.length - 1];
  const lastDate = last ? normalizeChartDateKey(last.date) : null;
  if (lastDate === liveDate) {
    return [...data.slice(0, -1), { ...last, close: liveClose }];
  }

  return [...data.slice(-29), { date: liveDate, close: liveClose }];
}

function hasCandleRows(payload: unknown) {
  return getMarketPayloadRows(payload).length > 0;
}

async function loadRealtimeTicker(ticker: string, timeframe: string) {
  const days = intradayHistoryDays(timeframe);
  const dnseRealtime = await fetchDnseOhlc(ticker, { timeframe, days, timeoutMs: 8_000 }).catch(() => null);
  if (hasCandleRows(dnseRealtime)) return dnseRealtime;

  const historicalIntraday = await loadBridgeHistoricalTicker(ticker, timeframe, days, 8_000).catch(() => null);
  if (hasCandleRows(historicalIntraday)) return historicalIntraday;

  const realtime = await fetchRealtimeTradingData(ticker, timeframe, 1_500).catch(() => null);
  const normalizedRealtime = normalizeHistoricalPricePayload(realtime);
  if (hasCandleRows(normalizedRealtime)) return normalizedRealtime;

  return normalizedRealtime;
}

// Chỉ số (VNINDEX/VN30/...) KHÔNG dùng logic scale giá cổ phiếu (nghìn↔VND, anchor) — sẽ ra số rác.
// Lấy thẳng giá trị chỉ số từ market snapshot (cùng nguồn dashboard dùng đúng).
async function loadIndexPriceSnapshot(ticker: string): Promise<StockPriceSnapshot> {
  const snapshot = await getMarketSnapshot().catch(() => null);
  const idx = snapshot?.indices?.find((item) => item.ticker === ticker) ?? null;
  const value = idx?.value != null && Number.isFinite(idx.value) ? idx.value : null;
  const change = idx?.change != null && Number.isFinite(idx.change) ? idx.change : null;
  const changePct = idx?.changePct != null && Number.isFinite(idx.changePct) ? idx.changePct : null;
  const previousClose = value != null && change != null ? Number((value - change).toFixed(2)) : null;
  return {
    ticker,
    price: value,
    close: value,
    previousClose,
    change,
    changePct,
    latestVolume: idx?.volume != null && Number.isFinite(idx.volume) ? idx.volume : null,
    volumeMa20: null,
    historicalScale: 1,
    priceDate: snapshot?.requestDateVN ?? null,
    realtimeAt: snapshot?.timestamp ?? null,
  };
}

async function loadPriceSnapshotForTicker(ticker: string) {
  const upper = ticker.toUpperCase();
  if (isIndexTicker(upper)) return loadIndexPriceSnapshot(upper);

  const [historical, realtime, ta, board] = await Promise.all([
    loadHistoricalTicker(ticker).catch(() => null),
    loadRealtimeTicker(ticker, "5m").catch(() => null),
    fetchTAData(ticker).catch(() => null),
    loadMarketBoardForTickers(ticker).catch(() => null),
  ]);

  return buildStockPriceSnapshot({
    ticker,
    historical,
    realtime,
    ta,
    marketBoard: board?.prices?.[upper],
  });
}

function scalePriceField(value: number | null | undefined, scale: number) {
  return applyMarketPriceScale(value, scale);
}

function normalizeTAWithHistorical(
  ta: TAData | null,
  historical: unknown,
  anchorOverride?: number | null,
): TAData | null {
  if (!ta) return ta;
  const turnoverPrice = latestTurnoverPriceFromPayload(historical);
  const latestClosePrice = latestClosePriceFromPayload(historical);
  const anchorPrice = anchorOverride ?? chooseMarketDisplayPrice(latestClosePrice, turnoverPrice);
  const payloadScale = marketPriceScaleFromPayload(historical);
  const anchorScale = anchorPrice != null && ta.currentPrice > 0
    ? anchorPrice / ta.currentPrice
    : 1;
  const scale = Math.abs(anchorScale - 1) >= 0.08
    ? anchorScale
    : payloadScale !== 1
      ? payloadScale
      : 1;
  const scaledCurrent = scalePriceField(ta.currentPrice, scale);
  const currentPrice = chooseMarketDisplayPrice(scaledCurrent, anchorPrice);
  if (scale === 1 && currentPrice === ta.currentPrice) return ta;

  const refPrice = scalePriceField(ta.refPrice, scale) ?? ta.refPrice;
  const change = currentPrice != null && refPrice != null ? currentPrice - refPrice : scalePriceField(ta.change, scale) ?? ta.change;
  const changePct = currentPrice != null && refPrice != null && refPrice > 0
    ? Number(((change / refPrice) * 100).toFixed(2))
    : ta.changePct;

  return {
    ...ta,
    currentPrice: currentPrice ?? ta.currentPrice,
    ceiling: scalePriceField(ta.ceiling, scale) ?? ta.ceiling,
    floor: scalePriceField(ta.floor, scale) ?? ta.floor,
    refPrice,
    change,
    changePct,
    sma20: scalePriceField(ta.sma20, scale),
    sma50: scalePriceField(ta.sma50, scale),
    sma200: scalePriceField(ta.sma200, scale),
    ema10: scalePriceField(ta.ema10, scale) ?? ta.ema10,
    ema20: scalePriceField(ta.ema20, scale) ?? ta.ema20,
    ema30: scalePriceField(ta.ema30, scale) ?? ta.ema30,
    ema50: scalePriceField(ta.ema50, scale) ?? ta.ema50,
    ema200: scalePriceField(ta.ema200, scale),
    prevClose: scalePriceField(ta.prevClose, scale) ?? ta.prevClose,
    prevEma10: scalePriceField(ta.prevEma10, scale) ?? ta.prevEma10,
    prevEma20: scalePriceField(ta.prevEma20, scale) ?? ta.prevEma20,
    high52w: scalePriceField(ta.high52w, scale) ?? ta.high52w,
    low52w: scalePriceField(ta.low52w, scale) ?? ta.low52w,
    macd: ta.macd
      ? {
          macd: scalePriceField(ta.macd.macd, scale) ?? ta.macd.macd,
          signal: scalePriceField(ta.macd.signal, scale) ?? ta.macd.signal,
          histogram: scalePriceField(ta.macd.histogram, scale) ?? ta.macd.histogram,
          histogramPrev: scalePriceField(ta.macd.histogramPrev, scale) ?? ta.macd.histogramPrev,
        }
      : ta.macd,
    bollinger: ta.bollinger
      ? {
          upper: scalePriceField(ta.bollinger.upper, scale) ?? ta.bollinger.upper,
          middle: scalePriceField(ta.bollinger.middle, scale) ?? ta.bollinger.middle,
          lower: scalePriceField(ta.bollinger.lower, scale) ?? ta.bollinger.lower,
        }
      : ta.bollinger,
  };
}

function applyPriceSnapshotToTA(ta: TAData | null, snapshot: StockPriceSnapshot): TAData | null {
  if (!ta) return ta;
  const currentPrice = snapshot.price ?? ta.currentPrice;
  const refPrice = snapshot.previousClose ?? ta.refPrice;
  const change = currentPrice != null && refPrice != null ? currentPrice - refPrice : ta.change;
  const changePct = currentPrice != null && refPrice != null && refPrice > 0
    ? Number(((change / refPrice) * 100).toFixed(2))
    : ta.changePct;

  return {
    ...ta,
    currentPrice,
    refPrice,
    prevClose: snapshot.previousClose ?? ta.prevClose,
    change,
    changePct,
  };
}

async function loadAiCachesForTicker(ticker: string) {
  const [insight, ta, fa, tamly, chat] = await Promise.all([
    prisma.aiInsightCache.findMany({
      where: { ticker },
      orderBy: { updatedAt: "desc" },
      take: 4,
      select: { tabType: true, content: true, updatedAt: true },
    }).catch((error) => {
      console.warn("[DataHub research] optional AiInsightCache unavailable:", error);
      return [];
    }),
    prisma.aiTaCache.findFirst({
      where: { ticker },
      orderBy: { createdAt: "desc" },
      select: { analysis: true, createdAt: true },
    }).catch((error) => {
      console.warn("[DataHub research] optional AiTaCache unavailable:", error);
      return null;
    }),
    prisma.aiFaCache.findFirst({
      where: { ticker },
      orderBy: { createdAt: "desc" },
      select: { analysis: true, createdAt: true, quarter: true },
    }).catch((error) => {
      console.warn("[DataHub research] optional AiFaCache unavailable:", error);
      return null;
    }),
    prisma.aiTamlyCache.findFirst({
      where: { ticker },
      orderBy: { createdAt: "desc" },
      select: { analysis: true, createdAt: true, date: true },
    }).catch((error) => {
      console.warn("[DataHub research] optional AiTamlyCache unavailable:", error);
      return null;
    }),
    prisma.chat.findMany({
      where: {
        role: "assistant",
        message: { contains: ticker },
      },
      orderBy: { createdAt: "desc" },
      take: 8,
      select: { message: true, createdAt: true },
    }).catch((error) => {
      console.warn("[DataHub research] optional Chat history unavailable:", error);
      return [];
    }),
  ]);

  return {
    insight,
    ta,
    fa,
    tamly,
    chat,
  };
}

function parseMetricNumber(raw: string) {
  const cleaned = raw
    .replace(/[^\d,.-]/g, "")
    .replace(/^-+$/, "")
    .trim();
  if (!cleaned) return null;

  const lastComma = cleaned.lastIndexOf(",");
  const lastDot = cleaned.lastIndexOf(".");
  let normalized = cleaned;

  if (lastComma >= 0 && lastDot >= 0) {
    const decimalSeparator = lastComma > lastDot ? "," : ".";
    normalized =
      decimalSeparator === ","
        ? cleaned.replace(/\./g, "").replace(",", ".")
        : cleaned.replace(/,/g, "");
  } else if (lastComma >= 0) {
    const digitsAfter = cleaned.length - lastComma - 1;
    normalized = digitsAfter <= 2 ? cleaned.replace(",", ".") : cleaned.replace(/,/g, "");
  } else if (lastDot >= 0) {
    const digitsAfter = cleaned.length - lastDot - 1;
    normalized = digitsAfter === 3 ? cleaned.replace(/\./g, "") : cleaned;
  }

  const value = Number(normalized);
  return Number.isFinite(value) ? value : null;
}

function extractMetric(text: string, labels: string[]) {
  for (const label of labels) {
    const escaped = label.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const patterns = [
      new RegExp(`${escaped}\\s*(?:\\([^)]*\\))?\\s*(?:[:=]|la|dat|o muc|quanh)?\\s*\\(?\\s*(-?\\d[\\d.,]*)`, "i"),
      new RegExp(`${escaped}[^\\d\\n]{0,32}(-?\\d[\\d.,]*)`, "i"),
    ];
    for (const pattern of patterns) {
      const match = text.match(pattern);
      if (match?.[1]) {
        const value = parseMetricNumber(match[1]);
        if (value != null) return value;
      }
    }
  }
  return null;
}

function normalizeValuationRatio(value: number | null, kind: "pe" | "pb") {
  if (value == null || !Number.isFinite(value)) return null;
  if (kind === "pe" && Math.abs(value) > 1000) return Number((value / 1000).toFixed(3));
  if (kind === "pb" && Math.abs(value) > 100) return Number((value / 1000).toFixed(3));
  return value;
}

function extractReportPeriod(text: string) {
  const quarter = text.match(/\bQ([1-4])\s*[/-]\s*(20\d{2})\b/i);
  if (quarter) return `Q${quarter[1]}/${quarter[2]}`;
  const vnQuarter = text.match(/\bqu[yý]\s*([1-4])\s*[/-]?\s*(20\d{2})\b/i);
  if (vnQuarter) return `Q${vnQuarter[1]}/${vnQuarter[2]}`;
  return null;
}

function extractRecentFAFromText(ticker: string, text: string, ta: TAData | null): FAData | null {
  const pe = normalizeValuationRatio(extractMetric(text, ["P/E", "PE", "PER"]), "pe");
  const pb = normalizeValuationRatio(extractMetric(text, ["P/B", "PB", "PBR"]), "pb");
  const eps = extractMetric(text, ["EPS", "Earning per share"]);
  const bookValuePerShare = extractMetric(text, ["BVPS", "Book value per share", "Book value", "Gia tri so sach"]);
  const roe = extractMetric(text, ["ROE"]);
  const roa = extractMetric(text, ["ROA"]);
  const revenueGrowthYoY = extractMetric(text, ["Doanh thu YoY", "Revenue YoY", "Revenue growth"]);
  const profitGrowthYoY = extractMetric(text, ["Loi nhuan YoY", "Lợi nhuận YoY", "Profit YoY", "Profit growth"]);
  const computedPe = pe ?? (ta?.currentPrice && eps && eps > 0 ? Number((ta.currentPrice / eps).toFixed(2)) : null);
  const computedPb = pb ?? (ta?.currentPrice && bookValuePerShare && bookValuePerShare > 0 ? Number((ta.currentPrice / bookValuePerShare).toFixed(2)) : null);

  if (computedPe == null && computedPb == null && eps == null && bookValuePerShare == null && roe == null && roa == null) return null;

  return {
    ticker,
    pe: computedPe,
    pb: computedPb,
    eps,
    bookValuePerShare,
    roe,
    roa,
    revenueLastQ: null,
    profitLastQ: null,
    revenueGrowthYoY,
    profitGrowthYoY,
    reportDate: extractReportPeriod(text),
    valuationBasis: pe != null || pb != null ? "latest_period" : "computed_from_latest_price",
    source: "recent-analysis-cache",
  };
}

function buildRecentFAText(aiCaches: Awaited<ReturnType<typeof loadAiCachesForTicker>>) {
  const parts: string[] = [];
  if (aiCaches.fa?.analysis) parts.push(aiCaches.fa.analysis);
  for (const item of aiCaches.insight ?? []) {
    if (["PTCB", "FA", "OVERVIEW"].includes(String(item.tabType ?? "").toUpperCase()) && item.content) {
      parts.push(item.content);
    }
  }
  for (const item of aiCaches.chat ?? []) {
    if (item.message) parts.push(item.message);
  }
  return parts.join("\n\n");
}

function hydrateFAFromRecentAnalysis(
  ticker: string,
  fa: FAData | null,
  aiCaches: Awaited<ReturnType<typeof loadAiCachesForTicker>>,
  ta: TAData | null,
) {
  const cachedFA = extractRecentFAFromText(ticker, buildRecentFAText(aiCaches), ta);
  if (!cachedFA) return fa;

  return {
    ...cachedFA,
    ...fa,
    pe: fa?.pe ?? cachedFA.pe,
    pb: fa?.pb ?? cachedFA.pb,
    eps: fa?.eps ?? cachedFA.eps,
    bookValuePerShare: fa?.bookValuePerShare ?? cachedFA.bookValuePerShare,
    roe: fa?.roe ?? cachedFA.roe,
    roa: fa?.roa ?? cachedFA.roa,
    revenueLastQ: fa?.revenueLastQ ?? cachedFA.revenueLastQ,
    profitLastQ: fa?.profitLastQ ?? cachedFA.profitLastQ,
    revenueGrowthYoY: fa?.revenueGrowthYoY ?? cachedFA.revenueGrowthYoY,
    profitGrowthYoY: fa?.profitGrowthYoY ?? cachedFA.profitGrowthYoY,
    reportDate: fa?.reportDate ?? cachedFA.reportDate,
    valuationBasis: fa?.valuationBasis ?? cachedFA.valuationBasis,
    source: fa?.source ?? cachedFA.source,
  };
}

async function loadHydratedFAData(ticker: string) {
  const [ta, fa, aiCaches] = await Promise.all([
    fetchTAData(ticker),
    fetchFAData(ticker),
    loadAiCachesForTicker(ticker),
  ]);
  return hydrateFAFromRecentAnalysis(ticker, fa, aiCaches, ta);
}

async function loadOptionalWorkbenchSignal(ticker: string) {
  try {
    return await prisma.signal.findFirst({
      where: { ticker, status: { in: ["RADAR", "ACTIVE"] } },
      orderBy: { updatedAt: "desc" },
      select: {
        id: true,
        ticker: true,
        type: true,
        status: true,
        entryPrice: true,
        target: true,
        stoploss: true,
        currentPrice: true,
        currentPnl: true,
        aiReasoning: true,
        winRate: true,
        sharpeRatio: true,
        rrRatio: true,
        updatedAt: true,
      },
    });
  } catch (error) {
    console.warn("[DataHub research] optional Signal unavailable:", error);
    return null;
  }
}

async function loadResearchWorkbench(topicKey: string) {
  const ticker = tickerFromTopic(topicKey, "research:workbench:");
  if (!ticker) throw new Error("Invalid ticker");
  const resolved = await assertValidTicker(ticker);
  const normalizedTicker = resolved.ticker;

  const [taRaw, faRaw, seasonality, investor, marketSnapshot, activeSignal, news, aiCaches, art, historical, board] = await Promise.all([
    fetchTAData(normalizedTicker),
    fetchFAData(normalizedTicker),
    loadSeasonalityForTicker(normalizedTicker),
    loadRealtimeTicker(normalizedTicker, "5m"),
    getMarketSnapshot(),
    loadOptionalWorkbenchSignal(normalizedTicker),
    loadTickerNews(normalizedTicker),
    loadAiCachesForTicker(normalizedTicker),
    loadOptionalTickerArt(normalizedTicker),
    loadHistoricalTicker(normalizedTicker).catch((error) => {
      console.warn("[DataHub research] optional historical normalization unavailable:", error);
      return null;
    }),
    loadMarketBoardForTickers(normalizedTicker).catch(() => null),
  ]);
  const priceSnapshot = buildStockPriceSnapshot({
    ticker: normalizedTicker,
    historical,
    realtime: investor,
    ta: taRaw,
    marketBoard: board?.prices?.[normalizedTicker],
  });
  const recentClose = priceSnapshot.price ?? latestClosePriceFromPayload(historical);
  const ta = applyPriceSnapshotToTA(normalizeTAWithHistorical(taRaw, historical, recentClose), priceSnapshot);
  const fa = hydrateFAFromRecentAnalysis(normalizedTicker, faRaw, aiCaches, ta);

  return {
    ticker: normalizedTicker,
    market: {
      vnindex: marketSnapshot.indices.find((item) => item.ticker === "VNINDEX") ?? null,
      vn30: marketSnapshot.indices.find((item) => item.ticker === "VN30") ?? null,
      liquidity: marketSnapshot.liquidity,
      breadth: marketSnapshot.breadth,
      investorTrading: marketSnapshot.investorTrading,
    },
    adnCore: marketSnapshot.marketOverview,
    art,
    priceSnapshot,
    ta,
    fa,
    seasonality,
    investor,
    news,
    signal: activeSignal,
    aiCaches,
    summary: {
      hasTA: Boolean(ta),
      hasFA: Boolean(fa),
      hasInvestorFlow: Boolean(investor?.summary || (investor?.data?.length ?? 0) > 0),
      hasNews: Array.isArray(news) && news.length > 0,
      hasSignal: Boolean(activeSignal),
    },
  };
}

const CHAT_TICKER_EXCLUSIONS = new Set([
  "ADN",
  "AI",
  "AIDEN",
  "API",
  "BAN",
  "BUY",
  "CHART",
  "CO",
  "DANG",
  "FA",
  "GIU",
  "HOLD",
  "MA",
  "MODE",
  "MUA",
  "NEWS",
  "PTCB",
  "PTKT",
  "SAFE",
  "SELL",
  "TA",
  "TAMLY",
  "VE",
  "VIP",
  "XEM",
]);

function stripStockContextFromQuestion(message: string) {
  return message
    .split(/\n\nMã cổ phiếu đang xem:/i)[0]
    .split(/\n\nMa co phieu dang xem:/i)[0]
    .trim();
}

function extractChatTickerCandidates(message: string) {
  const widget = message.match(/^\[WIDGET(?::MOCK)?:([A-Z0-9._-]{2,12})/);
  if (widget?.[1]) return [widget[1]];

  const commandMatch = message.match(/\/(?:ta|fa|news|tamly|ptkt|ptcb)\s+([A-Z0-9._-]{2,12})/i);
  const explicitTickerMatch = message.match(/(?:\bmã\b|\bma\b|\bticker\b|\bcổ phiếu\b|\bco phieu\b)\s+([A-Z0-9._-]{2,12})/i);
  const matches = [
    commandMatch?.[1],
    explicitTickerMatch?.[1],
    ...(message.match(/\b[A-Z0-9._-]{2,12}\b/g) ?? []),
  ].filter((item): item is string => Boolean(item));
  return Array.from(
    new Set(
      matches
        .map((item) => item.toUpperCase())
        .map((item) => item.replace(/[^A-Z0-9._-]/g, ""))
        .filter((item) => item.length >= 2 && item.length <= 12 && !CHAT_TICKER_EXCLUSIONS.has(item)),
    ),
  ).slice(0, 4);
}

async function loadRecentResearchTickers() {
  const rows = await prisma.chat.findMany({
    where: {
      OR: [
        { role: "user" },
        { message: { startsWith: "[WIDGET" } },
      ],
    },
    orderBy: { createdAt: "desc" },
    take: 300,
    select: { message: true, role: true, createdAt: true },
  });

  const resolutionCache = new Map<string, Awaited<ReturnType<typeof resolveMarketTicker>>>();
  const items = new Map<
    string,
    {
      ticker: string;
      lastAskedAt: Date;
      lastQuestion: string | null;
      askCount: number;
    }
  >();

  for (const row of rows) {
    const candidates = extractChatTickerCandidates(row.message);
    if (candidates.length === 0) continue;
    const question = row.role === "user" ? stripStockContextFromQuestion(row.message).slice(0, 180) : null;

    for (const candidate of candidates) {
      let resolved = resolutionCache.get(candidate);
      if (!resolved) {
        resolved = await resolveMarketTicker(candidate);
        resolutionCache.set(candidate, resolved);
      }
      if (!resolved.valid) continue;

      const existing = items.get(resolved.ticker);
      if (existing) {
        existing.askCount += 1;
        if (!existing.lastQuestion && question) existing.lastQuestion = question;
        continue;
      }

      items.set(resolved.ticker, {
        ticker: resolved.ticker,
        lastAskedAt: row.createdAt,
        lastQuestion: question,
        askCount: 1,
      });
    }
  }

  const recent = Array.from(items.values())
    .sort((a, b) => b.lastAskedAt.getTime() - a.lastAskedAt.getTime())
    .slice(0, 12);

  const withPrices = await Promise.all(
    recent.map(async (item) => {
      try {
        const ta = await fetchTAData(item.ticker);
        return {
          ...item,
          lastAskedAt: item.lastAskedAt.toISOString(),
          currentPrice: ta?.currentPrice ?? null,
          changePct: ta?.changePct ?? null,
          source: ta?.source ?? null,
        };
      } catch {
        return {
          ...item,
          lastAskedAt: item.lastAskedAt.toISOString(),
          currentPrice: null,
          changePct: null,
          source: null,
        };
      }
    }),
  );

  return {
    count: withPrices.length,
    items: withPrices,
    generatedAt: new Date().toISOString(),
    source: "db:chat+datahub:ta",
  };
}

type BrokerTopicChannel =
  | "accounts"
  | "positions"
  | "orders"
  | "balance"
  | "holdings"
  | "loan-packages"
  | "ppse"
  | "order-history";

type BrokerTopicExtraParams = {
  symbol?: string;
  fromDate?: string;
  toDate?: string;
};

type ResolvedDnseBrokerState = {
  userId: string;
  connectionId: string | null;
  portfolioConnectionId: string | null;
  allowedConnectionIds: string[];
  connected: boolean;
  currentUser: {
    dnseId: string | null;
    dnseVerified: boolean;
  } | null;
  connection: {
    accountId: string;
    subAccountId: string | null;
    status: string;
    accessTokenEnc: string | null;
    accessTokenExpiresAt: Date | null;
  } | null;
};

function normalizeBrokerConnectionId(value: string | null | undefined) {
  return (value ?? "").trim().toUpperCase().replace(/[^A-Z0-9]/g, "");
}

async function resolveDnseBrokerState(userId: string): Promise<ResolvedDnseBrokerState> {
  const [currentUser, connection] = await Promise.all([
    prisma.user.findUnique({
      where: { id: userId },
      select: { dnseId: true, dnseVerified: true },
    }),
    prisma.dnseConnection.findUnique({
      where: { userId },
      select: {
        accountId: true,
        subAccountId: true,
        status: true,
        accessTokenEnc: true,
        accessTokenExpiresAt: true,
      },
    }),
  ]);

  const activeConnectionAccountNo =
    connection?.status === "ACTIVE" ? connection.accountId.trim() : "";
  const activeConnectionSubAccountNo =
    connection?.status === "ACTIVE" ? connection.subAccountId?.trim() ?? "" : "";
  const fallbackUserAccountNo = currentUser?.dnseId?.trim() || "";
  const connectionId = activeConnectionAccountNo || fallbackUserAccountNo || activeConnectionSubAccountNo || null;
  const portfolioConnectionId =
    activeConnectionSubAccountNo || activeConnectionAccountNo || fallbackUserAccountNo || null;
  const allowedConnectionIds = Array.from(
    new Set(
      [activeConnectionAccountNo, activeConnectionSubAccountNo, fallbackUserAccountNo]
        .map((value) => value.trim())
        .filter(Boolean),
    ),
  );

  return {
    userId,
    connectionId,
    portfolioConnectionId,
    allowedConnectionIds,
    connected: Boolean(currentUser?.dnseId && currentUser?.dnseVerified),
    currentUser,
    connection: connection
      ? {
          accountId: connection.accountId.trim(),
          subAccountId: connection.subAccountId?.trim() || null,
          status: connection.status,
          accessTokenEnc: connection.accessTokenEnc ?? null,
          accessTokenExpiresAt: connection.accessTokenExpiresAt ?? null,
        }
      : null,
  };
}

async function loadBrokerTopicWithResolvedState(
  state: ResolvedDnseBrokerState,
  channel: BrokerTopicChannel,
  context: TopicContext,
  extraParams?: BrokerTopicExtraParams,
) {
  const connectionId = state.connectionId;
  const portfolioConnectionId = state.portfolioConnectionId ?? state.connectionId;
  if (!connectionId || !portfolioConnectionId) {
    throw new Error("Broker connection not found for current user");
  }

  const activeSignals = await loadSignalList("ACTIVE");
  const signalPositions = activeSignals.map((row) => ({
    ticker: row.ticker,
    entryPrice: row.entryPrice,
    currentPrice: row.currentPrice ?? row.entryPrice,
    pnlPercent: row.currentPnl ?? 0,
    target: row.target,
    stoploss: row.stoploss,
    navAllocation: row.navAllocation,
    type: row.type,
    tier: row.tier,
    updatedAt: row.updatedAt,
  }));

  const connected = state.connected;
  const hasApiKey = Boolean(process.env.DNSE_API_KEY?.trim());
  const cookieSessionToken = context.dnseSessionToken?.trim() || null;
  const hasValidCookieSession =
    Boolean(cookieSessionToken) &&
    Boolean(context.dnseSessionExpiresAt) &&
    !Number.isNaN(new Date(context.dnseSessionExpiresAt as string).getTime()) &&
    new Date(context.dnseSessionExpiresAt as string).getTime() > Date.now();

  const hasValidStoredDnseSession =
    Boolean(state.connection?.accessTokenEnc) &&
    (!state.connection?.accessTokenExpiresAt ||
      state.connection.accessTokenExpiresAt.getTime() > Date.now());
  const storedSessionToken =
    hasValidStoredDnseSession && state.connection?.accessTokenEnc
      ? decryptDnseToken(state.connection.accessTokenEnc)
      : null;
  const effectiveSessionToken = cookieSessionToken || storedSessionToken;
  const hasValidDnseSession = Boolean(
      (hasValidCookieSession && cookieSessionToken) ||
      (hasValidStoredDnseSession && storedSessionToken),
  );

  const isAccountListingChannel = channel === "accounts";
  const canLoadAccountsFromSession = isAccountListingChannel && connected && hasValidDnseSession;
  const canLoadPortfolioFromSession = connected && hasValidDnseSession;
  const canLoadPortfolioFromOpenApi = connected && hasApiKey;
  const canLoadLivePortfolio = canLoadPortfolioFromSession || canLoadPortfolioFromOpenApi;

  if (canLoadLivePortfolio || canLoadAccountsFromSession) {
    try {
      const client =
        canLoadPortfolioFromSession || (isAccountListingChannel && canLoadAccountsFromSession)
          ? getDnseTradingClient({
              userJwtToken: effectiveSessionToken,
              isolated: true,
            })
          : getDnseTradingClient({ isolated: true });

      if (channel === "accounts") {
        return {
          connected: true,
          connectionId,
          portfolioConnectionId,
          source: canLoadAccountsFromSession ? "dnse_user_session" : "dnse_openapi",
          accounts: await client.getAccounts(),
        };
      }

      if (channel === "positions") {
        const livePositions = await client.getPositions(portfolioConnectionId);
        return {
          connected: true,
          connectionId,
          portfolioConnectionId,
          source: canLoadPortfolioFromSession ? "dnse_user_session" : "dnse_openapi",
          positions: livePositions.map((row) => ({
            ticker: row.symbol,
            entryPrice: row.avgPrice,
            currentPrice: row.lastPrice ?? row.avgPrice,
            pnlPercent: row.totalPLPct ?? 0,
            target: null,
            stoploss: null,
            navAllocation: null,
            type: null,
            tier: null,
            quantity: row.quantity,
            marketValue: row.marketValue,
          })),
        };
      }

      if (channel === "orders") {
        return {
          connected: true,
          connectionId,
          portfolioConnectionId,
          source: canLoadPortfolioFromSession ? "dnse_user_session" : "dnse_openapi",
          orders: await client.getOrders(portfolioConnectionId),
        };
      }

      if (channel === "order-history") {
        return {
          connected: true,
          connectionId,
          portfolioConnectionId,
          source: canLoadPortfolioFromSession ? "dnse_user_session" : "dnse_openapi",
          orderHistory: await client.getOrders(portfolioConnectionId),
        };
      }

      if (channel === "balance") {
        const liveBalance = await client.getBalance(portfolioConnectionId);
        const navAllocatedPct = signalPositions.reduce(
          (sum, row) => sum + (row.navAllocation ?? 0),
          0,
        );
        return {
          connected: true,
          connectionId,
          portfolioConnectionId,
          source: canLoadPortfolioFromSession ? "dnse_user_session" : "dnse_openapi",
          navAllocatedPct: Number(navAllocatedPct.toFixed(2)),
          navRemainingPct: Number(Math.max(0, 100 - navAllocatedPct).toFixed(2)),
          maxActiveNavPct: 90,
          totalNav: liveBalance.totalNav ?? null,
          buyingPower: liveBalance.buyingPower ?? null,
          cash: liveBalance.cash ?? null,
          debt: liveBalance.debt ?? null,
        };
      }

      if (channel === "loan-packages") {
        return {
          connected: true,
          connectionId,
          portfolioConnectionId,
          source: canLoadPortfolioFromSession ? "dnse_user_session" : "dnse_openapi",
          loanPackages: await client.getLoanPackages(portfolioConnectionId),
        };
      }

      if (channel === "ppse") {
        if (!extraParams?.symbol) {
          return {
            connected: true,
            connectionId,
            source: canLoadPortfolioFromSession ? "dnse_user_session" : "dnse_openapi",
            ppse: null,
          };
        }
        return {
          connected: true,
          connectionId,
          portfolioConnectionId,
          source: canLoadPortfolioFromSession ? "dnse_user_session" : "dnse_openapi",
          ppse: await client.getPPSE(portfolioConnectionId, extraParams.symbol),
        };
      }

      const liveHoldings = await client.getPositions(portfolioConnectionId);
      return {
        connected: true,
        connectionId,
        portfolioConnectionId,
        source: canLoadPortfolioFromSession ? "dnse_user_session" : "dnse_openapi",
        holdings: liveHoldings.map((row) => ({
          ticker: row.symbol,
          entryPrice: row.avgPrice,
          currentPrice: row.lastPrice ?? row.avgPrice,
          pnlPercent: row.totalPLPct ?? 0,
          target: null,
          stoploss: null,
          navAllocation: null,
          type: null,
          tier: null,
          quantity: row.quantity,
          marketValue: row.marketValue,
        })),
      };
    } catch (error) {
      const fallbackReason =
        error instanceof Error ? error.message : "dnse_api_key_fetch_failed";
      if (channel === "orders") {
        const orders = await listDnseOrderHistory({
          userId: state.userId,
          connectionId,
          limit: 80,
        });
        return {
          connected,
          connectionId,
          source: "dnse-execution-audit-fallback",
          reason: fallbackReason,
          orders,
        };
      }
      if (channel === "order-history") {
        const orderHistory = await listDnseOrderHistory({
          userId: state.userId,
          connectionId,
          limit: 80,
        });
        return {
          connected,
          connectionId,
          source: "dnse-execution-audit-fallback",
          reason: fallbackReason,
          orderHistory,
        };
      }
      if (channel === "balance") {
        const navAllocatedPct = signalPositions.reduce(
          (sum, row) => sum + (row.navAllocation ?? 0),
          0,
        );
        return {
          connected,
          connectionId,
          source: "internal-estimate-fallback",
          reason: fallbackReason,
          navAllocatedPct: Number(navAllocatedPct.toFixed(2)),
          navRemainingPct: Number(Math.max(0, 100 - navAllocatedPct).toFixed(2)),
          maxActiveNavPct: 90,
        };
      }
      if (channel === "accounts") {
        return {
          connected,
          connectionId,
          source: "internal-connection-fallback",
          reason: fallbackReason,
          accounts: [
            {
              accountNo: connectionId,
              accountName: null,
              custodyCode: null,
              accountType: "SPOT",
              status: "ACTIVE",
            },
          ],
        };
      }
      if (channel === "loan-packages") {
        return {
          connected,
          connectionId,
          source: "internal-fallback",
          reason: fallbackReason,
          loanPackages: [],
        };
      }
      if (channel === "ppse") {
        return {
          connected,
          connectionId,
          source: "internal-fallback",
          reason: fallbackReason,
          ppse: null,
        };
      }
      return {
        connected,
        connectionId,
        source: "internal-merged-fallback",
        reason: fallbackReason,
        [channel === "positions" ? "positions" : "holdings"]: signalPositions,
      };
    }
  }

  if (channel === "positions") {
    return {
      connected,
      connectionId,
      source: "internal-merged",
      positions: signalPositions,
    };
  }

  if (channel === "orders") {
    const orders = await listDnseOrderHistory({
      userId: state.userId,
      connectionId,
      limit: 80,
    });
    return {
      connected,
      connectionId,
      source: "dnse-execution-audit",
      orders,
    };
  }

  if (channel === "order-history") {
    const orderHistory = await listDnseOrderHistory({
      userId: state.userId,
      connectionId,
      limit: 80,
    });
    return {
      connected,
      connectionId,
      source: "dnse-execution-audit",
      orderHistory,
    };
  }

  if (channel === "balance") {
    const navAllocatedPct = signalPositions.reduce((sum, row) => sum + (row.navAllocation ?? 0), 0);
    return {
      connected,
      connectionId,
      source: "internal-estimate",
      navAllocatedPct: Number(navAllocatedPct.toFixed(2)),
      navRemainingPct: Number(Math.max(0, 100 - navAllocatedPct).toFixed(2)),
      maxActiveNavPct: 90,
    };
  }

  if (channel === "accounts") {
    return {
      connected,
      connectionId,
      source: "internal-connection",
      accounts: [
        {
          accountNo: connectionId,
          accountName: null,
          custodyCode: null,
          accountType: "SPOT",
          status: "ACTIVE",
        },
      ],
    };
  }

  if (channel === "loan-packages") {
    return {
      connected,
      connectionId,
      source: "internal-fallback",
      loanPackages: [],
    };
  }

  if (channel === "ppse") {
    return {
      connected,
      connectionId,
      source: "internal-fallback",
      ppse: null,
    };
  }

  return {
    connected,
    connectionId,
    source: "internal-merged",
    holdings: signalPositions,
  };
}

async function loadBrokerTopic(
  connectionId: string,
  channel: BrokerTopicChannel,
  context: TopicContext,
  extraParams?: BrokerTopicExtraParams,
) {
  if (!context.userId) {
    throw new Error("Unauthorized private broker topic");
  }

  const state = await resolveDnseBrokerState(context.userId);
  const normalizedRequested = normalizeBrokerConnectionId(connectionId);
  const normalizedAllowed = state.allowedConnectionIds
    .map((value) => normalizeBrokerConnectionId(value))
    .filter(Boolean);

  if (!normalizedRequested || !normalizedAllowed.length || !normalizedAllowed.includes(normalizedRequested)) {
    console.warn("[DataHub DNSE] broker topic ownership mismatch", {
      userId: context.userId,
      requestedConnectionId: connectionId,
      allowedConnectionId: state.connectionId,
      allowedConnectionIds: state.allowedConnectionIds,
      normalizedRequested,
      normalizedAllowed,
      channel,
    });
    throw new Error("Broker connection not found for current user");
  }

  return loadBrokerTopicWithResolvedState(state, channel, context, extraParams);
}

async function loadCurrentUserBrokerTopic(
  channel: BrokerTopicChannel,
  context: TopicContext,
  extraParams?: BrokerTopicExtraParams,
) {
  if (!context.userId) {
    throw new Error("Unauthorized private broker topic");
  }
  const state = await resolveDnseBrokerState(context.userId);
  return loadBrokerTopicWithResolvedState(state, channel, context, extraParams);
}

async function loadBrokerTopicForUserAccount(
  targetUserId: string,
  accountId: string,
  channel: BrokerTopicChannel,
  context: TopicContext,
  extraParams?: BrokerTopicExtraParams,
) {
  if (!context.userId) {
    throw new Error("Unauthorized private broker topic");
  }
  if (context.userId !== targetUserId) {
    throw new Error("Forbidden private broker topic");
  }
  const state = await resolveDnseBrokerState(context.userId);
  const normalizedRequested = normalizeBrokerConnectionId(accountId);
  const normalizedAllowed = state.allowedConnectionIds
    .map((value) => normalizeBrokerConnectionId(value))
    .filter(Boolean);

  if (!normalizedRequested || !normalizedAllowed.length || !normalizedAllowed.includes(normalizedRequested)) {
    console.warn("[DataHub DNSE] user-account topic ownership mismatch", {
      userId: context.userId,
      targetUserId,
      requestedAccountId: accountId,
      allowedConnectionId: state.connectionId,
      allowedConnectionIds: state.allowedConnectionIds,
      normalizedRequested,
      normalizedAllowed,
      channel,
    });
    throw new Error("Broker connection not found for current user");
  }

  return loadBrokerTopicWithResolvedState(state, channel, context, extraParams);
}

async function resolveCurrentBrokerConnectionId(userId: string): Promise<string> {
  const state = await resolveDnseBrokerState(userId);
  if ((!state.portfolioConnectionId && !state.connectionId) || !state.currentUser?.dnseVerified) {
    throw new Error("DNSE connection is not verified for current user");
  }
  return state.portfolioConnectionId ?? state.connectionId!;
}

function normalizeSignalScanSlot(slotRaw: string): string {
  const slot = slotRaw.trim();
  if (/^\d{4}$/.test(slot)) return `${slot.slice(0, 2)}:${slot.slice(2)}`;
  return slot;
}

function extractSignalScanArtifact(row: {
  id: string;
  resultData: string | null;
  createdAt: Date;
}): PersistedSignalScanArtifact | null {
  const parsed = safeParseJson(row.resultData);
  if (!parsed || typeof parsed !== "object") return null;
  const record = parsed as JsonRecord;
  const artifact = record.scanArtifact && typeof record.scanArtifact === "object" ? (record.scanArtifact as JsonRecord) : record;
  if (typeof artifact.batchId !== "string") return null;
  if (artifact.kind !== "signal_scan" || artifact.version !== "v1") return null;
  if (typeof artifact.tradingDate !== "string" || typeof artifact.slot !== "string") return null;

  return {
    ...(artifact as unknown as SignalScanArtifact),
    cronLogId: row.id,
    persistedAt: row.createdAt,
  };
}

async function loadLatestSignalScanArtifact() {
  const rows = await prisma.cronLog.findMany({
    where: {
      cronName: "signal_scan_type1",
      status: "success",
    },
    orderBy: { createdAt: "desc" },
    take: 50,
    select: { id: true, resultData: true, createdAt: true },
  });

  for (const row of rows) {
    const artifact = extractSignalScanArtifact(row);
    if (artifact) return artifact;
  }
  return null;
}

async function loadSignalScanArtifactByDateSlot(dateKey: string, slotRaw: string) {
  const slot = normalizeSignalScanSlot(slotRaw);
  const { start, end } = parseVnDayRange(dateKey);
  const rows = await prisma.cronLog.findMany({
    where: {
      cronName: "signal_scan_type1",
      status: "success",
      createdAt: {
        gte: start,
        lt: end,
      },
    },
    orderBy: { createdAt: "desc" },
    take: 100,
    select: { id: true, resultData: true, createdAt: true },
  });

  for (const row of rows) {
    const artifact = extractSignalScanArtifact(row);
    if (!artifact) continue;
    if (artifact.tradingDate === dateKey && artifact.slot === slot) return artifact;
  }
  return null;
}

type SmartflowFlowRow = {
  ticker: string;
  netBuyValue: number;
  netBuyVolume: number | null;
};

type SmartflowMa200Leader = {
  ticker: string;
  currentPrice: number;
  ma200: number;
  distanceToMa200Pct: number;
};

type SmartflowIndexImpactRow = {
  ticker: string;
  impact: number;
  contributionPoints: number;
  changePct: number;
  contributionType?: "actual" | "estimated";
  contributionAsOf?: string | null;
  contributionAsOfSource?: string | null;
  sourceType?: string | null;
  price?: number | null;
  realtimePatched?: boolean;
  realtimeUpdatedAt?: string | null;
  updatedAt?: string | null;
};

type PulseStockRow = {
  ticker: string;
  name: string;
  sector: string;
  exchange: string;
  price: number;
  reference: number | null;
  ceiling: number | null;
  floor: number | null;
  changePct: number;
  volume: number;
  valueBillion: number;
  marketCapBillion: number | null;
  state: "ceiling" | "up" | "unchanged" | "down" | "floor";
  rsRating: number | null;
  // %-kỳ tính từ RS-rating bridge (close history sâu ~252 phiên) — đủ cho 1M/3M mà tick (20 phiên) không có.
  pct1w: number | null;
  pct1m: number | null;
  pct3m: number | null;
};

type PulseTopMoverTimeframe = "5m" | "15m" | "30m" | "1h" | "1D" | "1W" | "1M" | "3M";

type SmartflowInvestorFlowPoint = {
  date: string;
  netValue: number;
  netVolume: number | null;
};

const DEFAULT_SMARTFLOW_UNIVERSE = [
  "VCB", "BID", "CTG", "TCB", "MBB", "VPB", "ACB", "STB", "HDB", "VIB",
  "FPT", "MWG", "VNM", "MSN", "HPG", "HSG", "SSI", "VND", "VCI", "HCM",
  "VIC", "VHM", "VRE", "GAS", "BSR", "PVD", "PVS", "PLX", "GMD", "DGC",
  "KBC", "BCM", "REE", "FRT", "DGW", "PNJ", "SAB", "VJC", "HVN", "LPB",
];

const PULSE_TOP_MOVER_TIMEFRAMES: PulseTopMoverTimeframe[] = ["5m", "15m", "30m", "1h", "1D", "1W", "1M", "3M"];
// Số phiên giao dịch lùi lại để tính % theo kỳ (1D dùng changePct realtime, không qua bảng này).
const PULSE_MOVER_PERIOD_DAYS: Partial<Record<PulseTopMoverTimeframe, number>> = { "1W": 5, "1M": 22, "3M": 66 };

function formatPulseTopMoverTimeframe(timeframe: PulseTopMoverTimeframe): string {
  if (timeframe === "1D") return "Hôm nay";
  if (timeframe === "1W") return "Tuần";
  if (timeframe === "1M") return "Tháng";
  if (timeframe === "3M") return "3 tháng";
  if (timeframe.endsWith("m")) return `${timeframe.slice(0, -1)} phút`;
  if (timeframe.endsWith("h")) return `${timeframe.slice(0, -1)} giờ`;
  return timeframe;
}

function smartflowNumber(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value !== "string") return null;
  const normalized = value.replace(/[^\d,.-]/g, "").replace(/\./g, "").replace(",", ".").trim();
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : null;
}

function smartflowToArray(value: unknown): unknown[] {
  if (Array.isArray(value)) return value;
  if (!value || typeof value !== "object") return [];
  const record = value as JsonRecord;
  if (Array.isArray(record.data)) return record.data;
  if (Array.isArray(record.items)) return record.items;
  if (Array.isArray(record.rows)) return record.rows;
  const nested = record.data && typeof record.data === "object" ? (record.data as JsonRecord) : null;
  if (Array.isArray(nested?.data)) return nested.data;
  if (Array.isArray(nested?.items)) return nested.items;
  if (Array.isArray(nested?.rows)) return nested.rows;
  return [];
}

function normalizeMoneyToBillion(value: number | null) {
  if (value == null || !Number.isFinite(value)) return null;
  return value / 1_000_000_000;
}

function getSmartflowDate(daysAgo: number) {
  const date = new Date();
  date.setDate(date.getDate() - daysAgo);
  return date.toISOString().slice(0, 10);
}

function readSmartflowTicker(row: JsonRecord) {
  return String(row.ticker ?? row.symbol ?? row.code ?? row.stockCode ?? row.stock_code ?? "")
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, "");
}

function readFirstSmartflowNumber(row: JsonRecord, keys: string[]) {
  for (const key of keys) {
    const value = smartflowNumber(row[key]);
    if (value != null && Number.isFinite(value)) return value;
  }
  return null;
}

function rankRowsFromPayload(payload: unknown): JsonRecord[] {
  if (!payload || typeof payload !== "object") return [];
  const record = payload as JsonRecord;
  const candidates = [record.stocks, record.data, record.items, record.rows];
  for (const candidate of candidates) {
    if (Array.isArray(candidate)) {
      return candidate.filter((item): item is JsonRecord => Boolean(item) && typeof item === "object" && !Array.isArray(item));
    }
  }
  return [];
}

function estimateTradeValueBillion(price: number | null, volume: number | null) {
  if (price == null || volume == null || price <= 0 || volume <= 0) return 0;
  const priceVnd = price < 1000 ? price * 1000 : price;
  return (priceVnd * volume) / 1_000_000_000;
}

function normalizeTradeValueBillion(value: number | null, price: number, volume: number) {
  if (value != null && Number.isFinite(value) && value > 0) {
    if (value > 1_000_000_000) return value / 1_000_000_000;
    if (value > 1_000_000) return value / 1_000;
    return value;
  }
  return estimateTradeValueBillion(price, volume);
}

function normalizeMarketCapBillion(value: number | null) {
  if (value == null || !Number.isFinite(value) || value <= 0) return null;
  if (value > 1_000_000_000) return value / 1_000_000_000;
  if (value > 1_000_000) return value / 1_000;
  return value;
}

function normalizeExchange(value: unknown) {
  const raw = String(value ?? "").toUpperCase();
  if (raw.includes("HOSE") || raw.includes("HSX")) return "HOSE";
  if (raw.includes("HNX")) return "HNX";
  if (raw.includes("UPCOM")) return "UPCOM";
  return "ALL";
}

function classifyPriceState(
  price: number,
  reference: number | null,
  ceiling: number | null,
  floor: number | null,
  changePct: number,
): PulseStockRow["state"] {
  if (ceiling != null && ceiling > 0 && Math.abs(price - ceiling) / ceiling < 0.001) return "ceiling";
  if (floor != null && floor > 0 && Math.abs(price - floor) / floor < 0.001) return "floor";
  if (reference != null && reference > 0 && Math.abs(price - reference) / reference < 0.001) return "unchanged";
  if (changePct > 0) return "up";
  if (changePct < 0) return "down";
  return "unchanged";
}

function readSmartflowInstitutionalNet(row: JsonRecord) {
  const direct =
    smartflowNumber(row.institutionalNet) ??
    smartflowNumber(row.institutional_net) ??
    smartflowNumber(row.organizationNet) ??
    smartflowNumber(row.organization_net);
  if (direct != null) return normalizeMoneyToBillion(direct);

  const foreignNet =
    smartflowNumber(row.foreignNet) ??
    smartflowNumber(row.foreign_net) ??
    smartflowNumber(row.foreignTotalNetValue) ??
    smartflowNumber(row.foreignNetValue) ??
    smartflowNumber(row.netForeignValue);
  const proprietaryNet =
    smartflowNumber(row.proprietaryNet) ??
    smartflowNumber(row.proprietary_net) ??
    smartflowNumber(row.selfTradingNet) ??
    smartflowNumber(row.self_trading_net) ??
    smartflowNumber(row.proprietaryTotalNetValue);

  const buy =
    smartflowNumber(row.foreignBuyValueMatched) ??
    smartflowNumber(row.foreignBuyValueTotal) ??
    smartflowNumber(row.proprietaryTotalMatchBuyTradeValue) ??
    null;
  const sell =
    smartflowNumber(row.foreignSellValueMatched) ??
    smartflowNumber(row.foreignSellValueTotal) ??
    smartflowNumber(row.proprietaryTotalMatchSellTradeValue) ??
    null;

  if (foreignNet != null || proprietaryNet != null) {
    return normalizeMoneyToBillion((foreignNet ?? 0) + (proprietaryNet ?? 0));
  }
  const foreignBuy =
    smartflowNumber(row.foreignBuyValueMatched) ??
    smartflowNumber(row.foreignBuyValueTotal) ??
    smartflowNumber(row.foreignBuyValue) ??
    0;
  const foreignSell =
    smartflowNumber(row.foreignSellValueMatched) ??
    smartflowNumber(row.foreignSellValueTotal) ??
    smartflowNumber(row.foreignSellValue) ??
    0;
  const proprietaryBuy =
    smartflowNumber(row.proprietaryTotalBuyTradeValue) ??
    smartflowNumber(row.proprietaryTotalMatchBuyTradeValue) ??
    smartflowNumber(row.selfTradingBuyValue) ??
    0;
  const proprietarySell =
    smartflowNumber(row.proprietaryTotalSellTradeValue) ??
    smartflowNumber(row.proprietaryTotalMatchSellTradeValue) ??
    smartflowNumber(row.selfTradingSellValue) ??
    0;
  if (
    foreignBuy !== 0 ||
    foreignSell !== 0 ||
    proprietaryBuy !== 0 ||
    proprietarySell !== 0 ||
    buy != null ||
    sell != null
  ) {
    return normalizeMoneyToBillion(foreignBuy - foreignSell + proprietaryBuy - proprietarySell);
  }
  return null;
}

function readSmartflowForeignNet(row: JsonRecord) {
  const direct =
    smartflowNumber(row.foreignNet) ??
    smartflowNumber(row.foreign_net) ??
    smartflowNumber(row.foreignTotalNetValue) ??
    smartflowNumber(row.foreignNetValue) ??
    smartflowNumber(row.netForeignValue);
  if (direct != null) return normalizeMoneyToBillion(direct);
  const buy =
    smartflowNumber(row.foreignBuyValueMatched) ??
    smartflowNumber(row.foreignBuyValueTotal) ??
    smartflowNumber(row.foreignBuyValue);
  const sell =
    smartflowNumber(row.foreignSellValueMatched) ??
    smartflowNumber(row.foreignSellValueTotal) ??
    smartflowNumber(row.foreignSellValue);
  return buy != null || sell != null ? normalizeMoneyToBillion((buy ?? 0) - (sell ?? 0)) : null;
}

function readSmartflowProprietaryNet(row: JsonRecord) {
  const direct =
    smartflowNumber(row.proprietaryNet) ??
    smartflowNumber(row.proprietary_net) ??
    smartflowNumber(row.selfTradingNet) ??
    smartflowNumber(row.self_trading_net) ??
    smartflowNumber(row.proprietaryTotalNetValue) ??
    smartflowNumber(row.netProprietaryMatchValue);
  if (direct != null) return normalizeMoneyToBillion(direct);
  const buy =
    smartflowNumber(row.proprietaryTotalBuyTradeValue) ??
    smartflowNumber(row.proprietaryTotalMatchBuyTradeValue) ??
    smartflowNumber(row.selfTradingBuyValue);
  const sell =
    smartflowNumber(row.proprietaryTotalSellTradeValue) ??
    smartflowNumber(row.proprietaryTotalMatchSellTradeValue) ??
    smartflowNumber(row.selfTradingSellValue);
  return buy != null || sell != null ? normalizeMoneyToBillion((buy ?? 0) - (sell ?? 0)) : null;
}

function readSmartflowInstitutionalVolume(row: JsonRecord) {
  const direct =
    smartflowNumber(row.institutionalNetVolume) ??
    smartflowNumber(row.institutional_net_volume) ??
    smartflowNumber(row.organizationNetVolume) ??
    smartflowNumber(row.organization_net_volume);
  if (direct != null) return direct;

  const foreignNet =
    smartflowNumber(row.foreignNetVolume) ??
    smartflowNumber(row.foreign_net_volume) ??
    smartflowNumber(row.foreignTotalNetVolume) ??
    smartflowNumber(row.netForeignVolume);
  const proprietaryNet =
    smartflowNumber(row.proprietaryNetVolume) ??
    smartflowNumber(row.proprietary_net_volume) ??
    smartflowNumber(row.selfTradingNetVolume) ??
    smartflowNumber(row.self_trading_net_volume) ??
    smartflowNumber(row.proprietaryTotalNetVolume);

  const foreignBuy =
    smartflowNumber(row.foreignBuyVolumeMatched) ??
    smartflowNumber(row.foreignBuyVolumeTotal) ??
    smartflowNumber(row.foreignBuyVolume);
  const foreignSell =
    smartflowNumber(row.foreignSellVolumeMatched) ??
    smartflowNumber(row.foreignSellVolumeTotal) ??
    smartflowNumber(row.foreignSellVolume);
  const proprietaryBuy =
    smartflowNumber(row.proprietaryTotalMatchBuyTradeVolume) ??
    smartflowNumber(row.proprietaryTotalBuyTradeVolume) ??
    smartflowNumber(row.selfTradingBuyVolume);
  const proprietarySell =
    smartflowNumber(row.proprietaryTotalMatchSellTradeVolume) ??
    smartflowNumber(row.proprietaryTotalSellTradeVolume) ??
    smartflowNumber(row.selfTradingSellVolume);

  if (foreignNet != null || proprietaryNet != null) return (foreignNet ?? 0) + (proprietaryNet ?? 0);
  if (foreignBuy != null || foreignSell != null || proprietaryBuy != null || proprietarySell != null) {
    return (foreignBuy ?? 0) - (foreignSell ?? 0) + (proprietaryBuy ?? 0) - (proprietarySell ?? 0);
  }
  return null;
}

function readSmartflowDateKey(row: JsonRecord) {
  const raw = String(row.date ?? row.tradingDate ?? row.timestamp ?? row.time ?? "").trim();
  if (!raw) return currentVnDateKey();
  return raw.slice(0, 10);
}

function readSmartflowExchange(row: JsonRecord) {
  const raw = String(row.exchange ?? row.floor ?? row.market ?? row.board ?? "").toUpperCase();
  if (raw.includes("HOSE") || raw.includes("HSX")) return "HSX";
  if (raw.includes("HNX")) return "HNX";
  if (raw.includes("UPCOM")) return "UPCOM";
  return "ALL";
}

function aggregateSmartflowRows(payload: unknown): SmartflowFlowRow[] {
  const rows = new Map<string, { netBuyValue: number; netBuyVolume: number | null }>();
  for (const item of smartflowToArray(payload)) {
    const row = item && typeof item === "object" ? (item as JsonRecord) : null;
    if (!row) continue;
    const ticker = readSmartflowTicker(row);
    if (!ticker) continue;
    const net = readSmartflowInstitutionalNet(row);
    if (net == null || !Number.isFinite(net)) continue;
    const volume = readSmartflowInstitutionalVolume(row);
    const current = rows.get(ticker) ?? { netBuyValue: 0, netBuyVolume: null };
    rows.set(ticker, {
      netBuyValue: current.netBuyValue + net,
      netBuyVolume:
        volume != null && Number.isFinite(volume)
          ? (current.netBuyVolume ?? 0) + volume
          : current.netBuyVolume,
    });
  }
  return Array.from(rows.entries())
    .map(([ticker, value]) => ({
      ticker,
      netBuyValue: Number(value.netBuyValue.toFixed(2)),
      netBuyVolume: value.netBuyVolume == null ? null : Math.round(value.netBuyVolume),
    }))
    .filter((row) => row.netBuyValue !== 0);
}

async function smartflowMapLimit<T, R>(items: T[], limit: number, task: (item: T) => Promise<R>): Promise<R[]> {
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

async function loadSmartflowUniverse(limit: number) {
  const instruments = await fetchDnseInstruments({ limit }).catch(() => []);
  const dnseSymbols = instruments
    .map((item) => item.symbol)
    .filter((ticker) => /^[A-Z]{3,5}$/.test(ticker))
    .slice(0, limit);
  if (dnseSymbols.length > 0) return Array.from(new Set(dnseSymbols));

  const rsPayload = await loadRsRatingList(false).catch(() => null);
  const rows = Array.isArray((rsPayload as JsonRecord | null)?.stocks)
    ? ((rsPayload as JsonRecord).stocks as unknown[])
    : smartflowToArray(rsPayload);
  return Array.from(
    new Set(
      rows
        .map((row) => (row && typeof row === "object" ? readSmartflowTicker(row as JsonRecord) : ""))
        .filter(Boolean),
    ),
  ).slice(0, limit);
}

async function loadMa200Breadth(tickers: string[]) {
  const checked = await smartflowMapLimit(tickers, 8, async (ticker) => {
    const dnseOhlc = await fetchDnseOhlc(ticker, { timeframe: "1d", days: 380, timeoutMs: 8_000 }).catch(() => null);
    const initialHistorical = hasCandleRows(dnseOhlc) ? dnseOhlc : await loadHistoricalTicker(ticker).catch(() => null);
    const initialRows = getMarketPayloadRows(initialHistorical);
    const historical =
      initialRows.length >= 200
        ? initialHistorical
        : await loadBridgeHistoricalTicker(ticker, "1d", 420, 30_000).catch(() => initialHistorical);
    const rows = getMarketPayloadRows(historical);
    const closes = rows
      .map((row) => readPositiveNumber(row.close ?? row.c))
      .filter((value): value is number => value != null && Number.isFinite(value) && value > 0);
    if (closes.length < 200) return null;
    const last = closes[closes.length - 1];
    const ma200 = closes.slice(-200).reduce((sum, value) => sum + value, 0) / 200;
    return {
      ticker,
      currentPrice: Number(last.toFixed(2)),
      ma200: Number(ma200.toFixed(2)),
      distanceToMa200Pct: Number((((last - ma200) / ma200) * 100).toFixed(2)),
      above: last > ma200,
    };
  });
  const valid = checked.filter((item): item is SmartflowMa200Leader & { above: boolean } => Boolean(item));
  const above = valid.filter((item) => item.above).length;
  return {
    percent: valid.length > 0 ? Number(((above / valid.length) * 100).toFixed(1)) : null,
    above,
    total: valid.length,
    leaders: valid
      .filter((item) => item.above)
      .sort((a, b) => b.distanceToMa200Pct - a.distanceToMa200Pct)
      .slice(0, 5)
      .map(({ ticker, currentPrice, ma200, distanceToMa200Pct }) => ({
        ticker,
        currentPrice,
        ma200,
        distanceToMa200Pct,
      })),
  };
}

function readIndexContributionPoints(row: JsonRecord) {
  return readFirstSmartflowNumber(row, [
    "contributionPoints",
    "contribution_points",
    "indexContributionPoints",
    "index_contribution_points",
    "contribution",
    "impactPoints",
    "pointContribution",
  ]);
}

function normalizeSmartflowIndexImpactRows(rows: SmartflowIndexImpactRow[], direction: "positive" | "negative") {
  return rows
    .filter((row) =>
      row.ticker &&
      Number.isFinite(row.contributionPoints) &&
      Number.isFinite(row.changePct) &&
      (direction === "positive" ? row.contributionPoints > 0 : row.contributionPoints < 0)
    )
    .sort((a, b) => Math.abs(b.contributionPoints) - Math.abs(a.contributionPoints))
    .slice(0, 10)
    .map((row) => ({
      ...row,
      impact: Number(row.contributionPoints.toFixed(2)),
      contributionPoints: Number(row.contributionPoints.toFixed(2)),
      changePct: Number(row.changePct.toFixed(2)),
    }));
}

async function buildIndexImpactFromFiinQuant(indexTicker = "VNINDEX", contributionDay: "1Day" | "5Day" | "10Day" | "20Day" = "1Day") {
  const payload = await fetchIndexContribution({
    ticker: indexTicker,
    contributionDay,
    top: 15,
  }).catch(() => null);
  const contributionAsOf = String(payload?.contributionAsOf ?? payload?.updatedAt ?? new Date().toISOString());
  const contributionAsOfSource = String(payload?.contributionAsOfSource ?? "collector_received_at");
  const rowsFromPayload = [
    ...smartflowToArray(payload?.topGainers),
    ...smartflowToArray(payload?.topLosers),
  ];
  const baseRows = rowsFromPayload
    .map((item): SmartflowIndexImpactRow | null => {
      const row = item && typeof item === "object" ? (item as JsonRecord) : null;
      if (!row) return null;
      const ticker = readSmartflowTicker(row);
      const contributionPoints = readIndexContributionPoints(row);
      if (!ticker || contributionPoints == null || !Number.isFinite(contributionPoints) || contributionPoints === 0) return null;
      return {
        ticker,
        impact: contributionPoints,
        contributionPoints,
        changePct: 0,
        contributionType: "actual",
        contributionAsOf: String(row.contributionAsOf ?? contributionAsOf),
        contributionAsOfSource: String(row.contributionAsOfSource ?? contributionAsOfSource),
        sourceType: String(row.sourceType ?? payload?.sourceType ?? "fiinquant"),
        realtimePatched: false,
        updatedAt: payload?.updatedAt ?? contributionAsOf,
      };
    })
    .filter((row): row is SmartflowIndexImpactRow => Boolean(row));

  if (baseRows.length === 0) {
    return {
      index: indexTicker,
      updatedAt: payload?.updatedAt ?? new Date().toISOString(),
      positive: [] as SmartflowIndexImpactRow[],
      negative: [] as SmartflowIndexImpactRow[],
    };
  }

  const board = await loadMarketBoardForTickers(baseRows.map((row) => row.ticker).join(",")).catch(() => null);
  const boardPrices = board?.prices && typeof board.prices === "object" ? board.prices as Record<string, JsonRecord> : {};
  const boardUpdatedAt = board?.updatedAt ?? new Date().toISOString();
  const patchedRows = baseRows.map((row) => {
    const boardRow = boardPrices[row.ticker] ?? null;
    const normalizedBoard = boardRow ? normalizeMarketBoardRow(boardRow) : null;
    const price = normalizedBoard
      ? smartflowNumber(normalizedBoard.close ?? normalizedBoard.price ?? normalizedBoard.matchPrice)
      : null;
    const changePct = normalizedBoard
      ? smartflowNumber(normalizedBoard.changePct ?? normalizedBoard.percentChange)
      : null;
    return {
      ...row,
      price: price != null && Number.isFinite(price) ? price : null,
      changePct: changePct != null && Number.isFinite(changePct) ? changePct : row.changePct,
      realtimePatched: Boolean(normalizedBoard),
      realtimeUpdatedAt: normalizedBoard ? String(boardUpdatedAt) : null,
      updatedAt: new Date().toISOString(),
    };
  });

  return {
    index: indexTicker,
    updatedAt: payload?.updatedAt ?? new Date().toISOString(),
    positive: normalizeSmartflowIndexImpactRows(patchedRows, "positive"),
    negative: normalizeSmartflowIndexImpactRows(patchedRows, "negative"),
  };
}

// Index impact từ vnstock SentimentInsights (adn-vnstock /api/v1/index-impact) — FALLBACK khi FiinQuant
// hết hạn 27/6 (fetchIndexContribution rỗng). contribution.point = điểm tác động, value = %thay đổi.
async function buildIndexImpactFromVnstock() {
  const data = await fetchVnstockIndexImpact().catch(() => null);
  const rows: SmartflowIndexImpactRow[] = (data?.contribution ?? [])
    .filter((row) => row.ticker && Number.isFinite(row.contributionPoints) && Number.isFinite(row.changePct))
    .map((row): SmartflowIndexImpactRow => ({
      ticker: row.ticker,
      impact: row.contributionPoints,
      contributionPoints: row.contributionPoints,
      changePct: row.changePct,
      contributionType: "actual",
      contributionAsOf: data?.retrievedAt ?? null,
      contributionAsOfSource: "vnstock",
      sourceType: "vnstock",
      realtimePatched: false,
      updatedAt: data?.retrievedAt ?? null,
    }));
  return {
    updatedAt: data?.retrievedAt ?? null,
    positive: normalizeSmartflowIndexImpactRows(rows, "positive"),
    negative: normalizeSmartflowIndexImpactRows(rows, "negative"),
  };
}

async function buildIndexImpact(snapshot: Awaited<ReturnType<typeof getMarketSnapshot>> | null) {
  let result = await buildIndexImpactFromFiinQuant("VNINDEX", "1Day").catch(() => ({ updatedAt: null as string | null, positive: [] as SmartflowIndexImpactRow[], negative: [] as SmartflowIndexImpactRow[] }));
  // FiinQuant rỗng (hết hạn 27/6 hoặc lỗi) → fallback vnstock SentimentInsights để widget "Tác động Index" còn sống.
  if (result.positive.length === 0 && result.negative.length === 0) {
    result = await buildIndexImpactFromVnstock();
  }
  return {
    index: "VNINDEX",
    updatedAt: result.updatedAt ?? snapshot?.timestamp ?? new Date().toISOString(),
    positive: result.positive,
    negative: result.negative,
  };
}

function buildSmartflowInvestorRows(payload: unknown, kind: "foreign" | "proprietary") {
  const rows = new Map<string, {
    ticker: string;
    exchange: string;
    netBuyValue: number;
    netBuyVolume: number | null;
  }>();
  const series = new Map<string, { netValue: number; netVolume: number | null }>();

  for (const item of smartflowToArray(payload)) {
    const row = item && typeof item === "object" ? (item as JsonRecord) : null;
    if (!row) continue;
    const ticker = readSmartflowTicker(row);
    if (!ticker) continue;
    const net = kind === "foreign" ? readSmartflowForeignNet(row) : readSmartflowProprietaryNet(row);
    if (net == null || !Number.isFinite(net)) continue;

    const volume = readSmartflowInstitutionalVolume(row);
    const current = rows.get(ticker) ?? {
      ticker,
      exchange: readSmartflowExchange(row),
      netBuyValue: 0,
      netBuyVolume: null,
    };
    rows.set(ticker, {
      ...current,
      netBuyValue: current.netBuyValue + net,
      netBuyVolume: volume != null && Number.isFinite(volume) ? (current.netBuyVolume ?? 0) + volume : current.netBuyVolume,
    });

    const date = readSmartflowDateKey(row);
    const point = series.get(date) ?? { netValue: 0, netVolume: null };
    series.set(date, {
      netValue: point.netValue + net,
      netVolume: volume != null && Number.isFinite(volume) ? (point.netVolume ?? 0) + volume : point.netVolume,
    });
  }

  const normalizedRows = Array.from(rows.values())
    .map((row) => ({
      ...row,
      netBuyValue: Number(row.netBuyValue.toFixed(2)),
      netBuyVolume: row.netBuyVolume == null ? null : Math.round(row.netBuyVolume),
    }))
    .filter((row) => row.netBuyValue !== 0);
  const normalizedSeries: SmartflowInvestorFlowPoint[] = Array.from(series.entries())
    .map(([date, value]) => ({
      date,
      netValue: Number(value.netValue.toFixed(2)),
      netVolume: value.netVolume == null ? null : Math.round(value.netVolume),
    }))
    .sort((a, b) => a.date.localeCompare(b.date));

  return {
    netValue: Number(normalizedRows.reduce((sum, row) => sum + row.netBuyValue, 0).toFixed(2)),
    netVolume: normalizedRows.reduce((sum, row) => sum + (row.netBuyVolume ?? 0), 0) || null,
    series: normalizedSeries,
    topBuy: normalizedRows.filter((row) => row.netBuyValue > 0).sort((a, b) => b.netBuyValue - a.netBuyValue).slice(0, 10),
    topSell: normalizedRows.filter((row) => row.netBuyValue < 0).sort((a, b) => a.netBuyValue - b.netBuyValue).slice(0, 10),
  };
}

function buildSmartflowInvestorFlow(payloadByTimeframe: Record<string, unknown>) {
  const timeframes = ["1D", "1W", "1M", "3M", "6M", "1Y"] as const;
  return {
    foreign: Object.fromEntries(
      timeframes.map((timeframe) => [timeframe, buildSmartflowInvestorRows(payloadByTimeframe[timeframe], "foreign")]),
    ),
    proprietary: Object.fromEntries(
      timeframes.map((timeframe) => [timeframe, buildSmartflowInvestorRows(payloadByTimeframe[timeframe], "proprietary")]),
    ),
  };
}

async function loadSmartflowPriceMap(tickers: string[]) {
  const normalized = Array.from(new Set(tickers.map((ticker) => ticker.toUpperCase()).filter(Boolean))).slice(0, 50);
  if (normalized.length === 0) return new Map<string, number>();
  const [dnseBoard, bridgeBoard] = await Promise.all([
    fetchDnseMarketBoard(normalized).catch(() => null),
    fetchMarketBoard(normalized).catch(() => null),
  ]);
  const prices = new Map<string, number>();
  for (const ticker of normalized) {
    const row =
      ((dnseBoard?.prices as JsonRecord | undefined)?.[ticker] as JsonRecord | undefined) ??
      ((bridgeBoard?.prices as JsonRecord | undefined)?.[ticker] as JsonRecord | undefined);
    const price = readPositiveNumber(row?.close ?? row?.price ?? row?.currentPrice ?? row?.matchPrice ?? row?.lastPrice);
    if (price != null && Number.isFinite(price) && price > 0) {
      prices.set(ticker, Number(price.toFixed(2)));
    }
  }
  return prices;
}

// Chuỗi dòng tiền NGOẠI theo NGÀY (market-wide net) từ market.eod row "f" (foreign) của DNSE —
// nguồn time-series THẬT (FiinQuant investor-trading chỉ trả tổng-hợp-cả-kỳ = 1 điểm). Net = tổng
// (totalBuyTradedAmount − totalSellTradedAmount) theo ngày, đổi ra tỷ. Cache 20' (data theo ngày).
let foreignDailySeriesCache: { at: number; data: SmartflowInvestorFlowPoint[] } | null = null;
async function loadMarketForeignDailySeries(): Promise<SmartflowInvestorFlowPoint[]> {
  if (foreignDailySeriesCache && Date.now() - foreignDailySeriesCache.at < 20 * 60_000) return foreignDailySeriesCache.data;
  try {
    const rows = await prisma.$queryRaw<Array<{ tradingDate: string; net_ty: unknown; net_vol: unknown }>>`
      SELECT "tradingDate" AS "tradingDate",
        sum(("payload"->>'totalBuyTradedAmount')::numeric - ("payload"->>'totalSellTradedAmount')::numeric) / 1e9 AS net_ty,
        sum(("payload"->>'totalBuyVolume')::numeric - ("payload"->>'totalSellVolume')::numeric) AS net_vol
      FROM "DatabaseMarketLatest"
      WHERE dataset = 'market.eod' AND "payload"->>'T' = 'f' AND ("payload"->>'totalBuyTradedAmount') IS NOT NULL
      GROUP BY "tradingDate"
      ORDER BY "tradingDate" ASC`;
    const series = rows
      .filter((row) => row.tradingDate)
      .map((row) => ({
        date: row.tradingDate,
        netValue: Number(Number(row.net_ty ?? 0).toFixed(2)),
        netVolume: row.net_vol == null ? null : Math.round(Number(row.net_vol)),
      }));
    foreignDailySeriesCache = { at: Date.now(), data: series };
    return series;
  } catch {
    return foreignDailySeriesCache?.data ?? [];
  }
}

// Foreign NĐT NN per-MÃ theo cửa sổ N phiên — aggregate market.eod 'f' (= DNSE foreign.G1.json, nguồn SÀN
// THẬT) → net tổng + top mua/bán ròng. Thay vnstock cho foreign (DNSE chính xác hơn). Cache 20'.
type DnseForeignRow = { ticker: string; exchange: string; netBuyValue: number; netBuyVolume: number | null };
const dnseForeignWindowCache = new Map<number, { at: number; data: { net: number; topBuy: DnseForeignRow[]; topSell: DnseForeignRow[] } }>();
async function loadDnseForeignByWindow(tradingDays: number): Promise<{ net: number; topBuy: DnseForeignRow[]; topSell: DnseForeignRow[] }> {
  const days = Math.max(1, Math.round(tradingDays));
  const hit = dnseForeignWindowCache.get(days);
  if (hit && Date.now() - hit.at < 20 * 60_000) return hit.data;
  try {
    const rows = await prisma.$queryRaw<Array<{ symbol: string; net_ty: unknown; net_vol: unknown }>>`
      WITH recent AS (
        SELECT DISTINCT "tradingDate" FROM "DatabaseMarketLatest"
        WHERE dataset = 'market.eod' AND "payload"->>'T' = 'f'
        ORDER BY "tradingDate" DESC LIMIT ${days}
      )
      SELECT "symbol" AS symbol,
        sum(("payload"->>'totalBuyTradedAmount')::numeric - ("payload"->>'totalSellTradedAmount')::numeric) / 1e9 AS net_ty,
        sum(("payload"->>'totalBuyVolume')::numeric - ("payload"->>'totalSellVolume')::numeric) AS net_vol
      FROM "DatabaseMarketLatest"
      WHERE dataset = 'market.eod' AND "payload"->>'T' = 'f'
        AND ("payload"->>'totalBuyTradedAmount') IS NOT NULL
        AND "tradingDate" IN (SELECT "tradingDate" FROM recent)
      GROUP BY "symbol"`;
    const parsed: DnseForeignRow[] = rows
      .filter((row) => row.symbol)
      .map((row) => ({
        ticker: String(row.symbol).toUpperCase(),
        exchange: "",
        netBuyValue: Number(Number(row.net_ty ?? 0).toFixed(2)),
        netBuyVolume: row.net_vol == null ? null : Math.round(Number(row.net_vol)),
      }))
      .filter((row) => Number.isFinite(row.netBuyValue) && row.netBuyValue !== 0);
    const data = {
      net: Number(parsed.reduce((sum, row) => sum + row.netBuyValue, 0).toFixed(2)),
      topBuy: parsed.filter((row) => row.netBuyValue > 0).sort((a, b) => b.netBuyValue - a.netBuyValue).slice(0, 10),
      topSell: parsed.filter((row) => row.netBuyValue < 0).sort((a, b) => a.netBuyValue - b.netBuyValue).slice(0, 10),
    };
    dnseForeignWindowCache.set(days, { at: Date.now(), data });
    return data;
  } catch {
    return hit?.data ?? { net: 0, topBuy: [], topSell: [] };
  }
}

// Tích lũy net TỰ DOANH hằng ngày: vnstock chỉ trả net hôm nay (không có chuỗi ngày) → upsert mỗi lần
// precompute để dựng dần time-series cho sparkline tự doanh. Giữ ~13 tháng (TTL).
async function recordPropDailyNet(net: number | null) {
  if (net == null || !Number.isFinite(net)) return;
  const today = getSmartflowDate(0);
  await upsertDatabaseToolLatest({
    tool: "pulse",
    dataset: "prop.net.daily",
    key: today,
    tradingDate: today,
    source: "vnstock",
    payload: { date: today, netValue: Number(net.toFixed(2)) },
    ttlMs: 400 * 24 * 60 * 60_000,
  }).catch(() => {});
}

async function loadPropDailySeries(): Promise<SmartflowInvestorFlowPoint[]> {
  try {
    const rows = await listDatabaseToolLatest<{ date?: string; netValue?: number }>({
      tool: "pulse",
      dataset: "prop.net.daily",
      limit: 400,
      maxAgeMs: 400 * 24 * 60 * 60_000,
    });
    return rows
      .map((row) => ({
        date: String(row.payload?.date ?? row.key ?? ""),
        netValue: Number(row.payload?.netValue ?? 0),
        netVolume: null as number | null,
      }))
      .filter((point) => point.date && Number.isFinite(point.netValue))
      .sort((a, b) => a.date.localeCompare(b.date));
  } catch {
    return [];
  }
}

// Cache investor-trading theo cửa sổ ngày. Dữ liệu theo NGÀY → các khung lịch sử (1W–1Y) gần như
// không đổi trong phiên; cache TTL bậc thang để precompute (chạy mỗi 15') không fetch lại bridge nặng
// mỗi lần. Lỗi bridge → trả CACHE CŨ (resilient với bridge sắp hết hạn). Cache theo process (clear khi deploy).
const investorTradingCache = new Map<number, { at: number; data: Awaited<ReturnType<typeof fetchInvestorTrading>> }>();
async function cachedInvestorTrading(fromDays: number, ttlMs: number) {
  const now = Date.now();
  const hit = investorTradingCache.get(fromDays);
  if (hit && now - hit.at < ttlMs) return hit.data;
  const data = await fetchInvestorTrading({ fromDate: getSmartflowDate(fromDays), toDate: getSmartflowDate(0) }).catch(() => null);
  if (data) {
    investorTradingCache.set(fromDays, { at: now, data });
    return data;
  }
  return hit?.data ?? null;
}

async function loadPulseSmartflow() {
  const [snapshot, oneDayFlow, oneWeekFlow, oneMonthFlow, threeMonthFlow, sixMonthFlow, oneYearFlow] = await Promise.all([
    getMarketSnapshot().catch(() => null),
    cachedInvestorTrading(0, 2 * 60_000),
    cachedInvestorTrading(7, 30 * 60_000),
    cachedInvestorTrading(31, 60 * 60_000),
    cachedInvestorTrading(92, 3 * 60 * 60_000),
    cachedInvestorTrading(183, 6 * 60 * 60_000),
    cachedInvestorTrading(365, 6 * 60 * 60_000),
  ]);

  const oneMonthRows = aggregateSmartflowRows(oneMonthFlow);
  const threeMonthRows = aggregateSmartflowRows(threeMonthFlow);
  const oneMonthNet = oneMonthRows.reduce((sum, row) => sum + row.netBuyValue, 0);
  const investorFlow = buildSmartflowInvestorFlow({
    "1D": oneDayFlow,
    "1W": oneWeekFlow,
    "1M": oneMonthFlow,
    "3M": threeMonthFlow,
    "6M": sixMonthFlow,
    "1Y": oneYearFlow,
  });
  // === FOREIGN (NĐT NN) → VNSTOCK-PRIMARY cho NET + TOP mua/bán ròng (TỔNG CHÍNH THỨC = khớp lệnh + THỎA
  // THUẬN, khớp FireAnt/CafeF/sàn). DNSE foreign.G1 CHỈ có khớp lệnh — thiếu thỏa thuận, lệch 40-90 tỷ/mã
  // (vd VPB DNSE -2.7 vs sàn -89). vnstock có 1D/1W; khung dài hơn (1M+) vnstock rỗng → fallback DNSE windowed.
  // DNSE vẫn lo: (a) đường sparkline nhiều phiên (vnstock chỉ có điểm tổng theo khung). ===
  const foreignDailySeries = await loadMarketForeignDailySeries();
  const seriesDays: Record<string, number> = { "1D": 10, "1W": 8, "1M": 22, "3M": 66, "6M": 132, "1Y": 260 };
  const foreignNetDays: Record<string, number> = { "1D": 1, "1W": 5, "1M": 22, "3M": 66, "6M": 132, "1Y": 260 };
  const dnseDays = foreignDailySeries.length;
  const vnstockFlow = await fetchVnstockInvestorFlow({ top: 10 }).catch(() => null);
  for (const [tf, bucket] of Object.entries(investorFlow.foreign)) {
    if (!bucket) continue;
    // (a) sparkline nhiều phiên từ DNSE
    const slicedSeries = foreignDailySeries.slice(-(seriesDays[tf] ?? 10));
    if (slicedSeries.length >= 2) (bucket as { series?: SmartflowInvestorFlowPoint[] }).series = slicedSeries;
    // (b) net + top: ưu tiên vnstock (tổng chuẩn) khi khung đó có data; vnstock rỗng (1M+) → DNSE windowed.
    const vn = vnstockFlow?.foreign?.[tf];
    const vnHasData = !!vn && ((vn.topBuy?.length ?? 0) > 0 || (vn.topSell?.length ?? 0) > 0 || (vn.net != null && vn.net !== 0));
    if (vnHasData && vn) {
      if (vn.net != null && Number.isFinite(vn.net)) bucket.netValue = vn.net;
      if ((vn.topBuy?.length ?? 0) > 0) bucket.topBuy = vn.topBuy.slice(0, 10).map((row) => ({ ticker: row.ticker, exchange: "", netBuyValue: row.netValue, netBuyVolume: null }));
      if ((vn.topSell?.length ?? 0) > 0) bucket.topSell = vn.topSell.slice(0, 10).map((row) => ({ ticker: row.ticker, exchange: "", netBuyValue: row.netValue, netBuyVolume: null }));
    } else {
      const win = foreignNetDays[tf] ?? 1;
      if (win <= dnseDays && foreignDailySeries.length > 0) {
        const dnse = await loadDnseForeignByWindow(win);
        if (dnse.topBuy.length > 0 || dnse.topSell.length > 0) {
          bucket.topBuy = dnse.topBuy.slice(0, 10);
          bucket.topSell = dnse.topSell.slice(0, 10);
        }
        const window = foreignDailySeries.slice(-win);
        bucket.netValue = Number(window.reduce((sum, point) => sum + (Number.isFinite(point.netValue) ? point.netValue : 0), 0).toFixed(2));
      }
    }
  }
  // TỰ DOANH (prop): DNSE không có kênh prop → lấy thẳng vnstock (net + top names) khi bucket còn rỗng.
  if (vnstockFlow) {
    for (const [tf, bucket] of Object.entries(investorFlow.proprietary)) {
      const vn = vnstockFlow.proprietary?.[tf];
      if (!bucket || !vn) continue;
      const empty = bucket.topBuy.length === 0 && bucket.topSell.length === 0;
      if (empty && (vn.topBuy.length > 0 || vn.topSell.length > 0)) {
        bucket.topBuy = vn.topBuy.slice(0, 10).map((row) => ({ ticker: row.ticker, exchange: "", netBuyValue: row.netValue, netBuyVolume: null }));
        bucket.topSell = vn.topSell.slice(0, 10).map((row) => ({ ticker: row.ticker, exchange: "", netBuyValue: row.netValue, netBuyVolume: null }));
      }
      if ((bucket.netValue == null || bucket.netValue === 0) && vn.net != null && Number.isFinite(vn.net)) {
        bucket.netValue = vn.net;
      }
    }
  }
  // Foreign net fallback CUỐI (DNSE + vnstock đều thiếu, vd 1Y): tổng cửa sổ chuỗi market.eod.
  if (foreignDailySeries.length > 0) {
    for (const [tf, bucket] of Object.entries(investorFlow.foreign)) {
      if (!bucket || (bucket.netValue != null && bucket.netValue !== 0)) continue;
      const window = foreignDailySeries.slice(-(foreignNetDays[tf] ?? 1));
      if (window.length > 0) {
        bucket.netValue = Number(window.reduce((sum, point) => sum + (Number.isFinite(point.netValue) ? point.netValue : 0), 0).toFixed(2));
      }
    }
  }
  // === TỰ DOANH sparkline: tích lũy net prop hằng ngày (vnstock không có chuỗi ngày) → dựng dần. ===
  const propTodayNet = vnstockFlow?.proprietary?.["1D"]?.net ?? investorFlow.proprietary["1D"]?.netValue ?? null;
  await recordPropDailyNet(propTodayNet);
  const propDailySeries = await loadPropDailySeries();
  if (propDailySeries.length >= 2) {
    for (const [tf, bucket] of Object.entries(investorFlow.proprietary)) {
      if (!bucket) continue;
      const sliced = propDailySeries.slice(-(seriesDays[tf] ?? 10));
      if (sliced.length >= 2) (bucket as { series?: SmartflowInvestorFlowPoint[] }).series = sliced;
    }
  }
  const realtimeNet =
    snapshot?.supplyDemand.netVolume ??
    snapshot?.investorTrading.foreign.net ??
    null;
  const activeTrendNet = oneMonthRows.length > 0 ? oneMonthNet : realtimeNet;
  const activeBuySellTrend1M =
    activeTrendNet == null ? "Trung tính" : activeTrendNet >= 0 ? "Mua chủ động" : "Bán chủ động";

  const absoluteNets = oneMonthRows.map((row) => Math.abs(row.netBuyValue)).sort((a, b) => a - b);
  const median = absoluteNets.length > 0 ? absoluteNets[Math.floor(absoluteNets.length / 2)] : 0;
  const spikeThreshold = Math.max(median * 2.5, 20);
  const spikeCandidates = oneMonthRows
    .map((row) => ({
      ...row,
      spikeRatio: median > 0 ? row.netBuyValue / median : row.netBuyValue >= spikeThreshold ? 2.5 : 0,
    }))
    .filter((row) => row.netBuyValue > 0 && row.netBuyValue >= spikeThreshold && row.spikeRatio >= 2.5)
    .sort((a, b) => b.netBuyValue - a.netBuyValue)
    .slice(0, 8);
  const accumulationCandidates = threeMonthRows
    .filter((row) => row.netBuyValue > 0)
    .sort((a, b) => b.netBuyValue - a.netBuyValue)
    .slice(0, 8);
  const smartflowPrices = await loadSmartflowPriceMap([
    ...spikeCandidates.map((row) => row.ticker),
    ...accumulationCandidates.map((row) => row.ticker),
  ]);
  const institutionalFlowSpikes = spikeCandidates
    .map((row) => {
      const currentPrice = smartflowPrices.get(row.ticker);
      if (currentPrice == null) return null;
      return {
        ticker: row.ticker,
        currentPrice,
        netBuyValue: row.netBuyValue,
        spikeRatio: Number(row.spikeRatio.toFixed(1)),
        reason: `Mua ròng ${Math.round(row.netBuyValue)} tỷ, cao hơn nền 1 tháng ${row.spikeRatio.toFixed(1)} lần`,
      };
    })
    .filter((row): row is NonNullable<typeof row> => Boolean(row))
    .slice(0, 5);
  const institutionalAccumulation3M = accumulationCandidates
    .map((row, index) => {
      const currentPrice = smartflowPrices.get(row.ticker);
      if (currentPrice == null) return null;
      return {
        ticker: row.ticker,
        currentPrice,
        netBuyValue3M: row.netBuyValue,
        netBuyVolume3M:
          row.netBuyVolume != null && row.netBuyVolume > 0
            ? row.netBuyVolume
            : Math.round((row.netBuyValue * 1_000_000_000) / currentPrice),
        accumulationRank: index + 1,
      };
    })
    .filter((row): row is NonNullable<typeof row> => Boolean(row))
    .slice(0, 5);

  const indexImpact = await buildIndexImpact(snapshot);
  const missingFields = [
    indexImpact.positive.length === 0 && indexImpact.negative.length === 0 ? "indexImpact" : null,
    oneMonthRows.length === 0 ? "activeBuySellTrend1M" : null,
    investorFlow.foreign["1D"].topBuy.length === 0 && investorFlow.proprietary["1D"].topBuy.length === 0 ? "investorFlow" : null,
    institutionalAccumulation3M.length === 0 ? "institutionalAccumulation3M" : null,
  ].filter((item): item is string => Boolean(item));

  return {
    title: "ADN Smartflow",
    subtitle: "Smart Money · Accumulation · Market Breadth",
    indexImpact,
    activeBuySellTrend1M,
    activeBuySellTrendNet: activeTrendNet,
    investorFlow,
    institutionalFlowSpikes,
    institutionalAccumulation3M,
    sourceStatus: {
      primary: "dnse",
      fallback: "fiinquant",
      missingFields,
      publish: missingFields.length < 4,
    },
    updatedAt: new Date().toISOString(),
  };
}

async function loadPulseSmartflowTopic(force = false) {
  if (force) return loadPulseSmartflow();
  const cached = await loadLatestPrecomputedTopicValue("pulse_smartflow_precompute", "pulse:smartflow");
  if (cached) return cached;
  throw new Error("pulse_smartflow_precomputed_unavailable");
}

async function loadPulseRankStocks(force = false, limit = 260): Promise<PulseStockRow[]> {
  const rankPayload =
    (!force ? await loadDatabaseV2ToolPayload("rank", "rank.rs", 24 * 60 * 60_000).catch(() => null) : null) ??
    await loadRsRatingTopic(force).catch(() => null);
  const rawRows = rankRowsFromPayload(rankPayload).slice(0, limit);
  const tickers = Array.from(new Set(rawRows.map((row) => readSmartflowTicker(row)).filter(Boolean)));
  const board = tickers.length > 0 ? await loadMarketBoardForTickers(tickers.join(",")).catch(() => null) : null;
  const boardMap = board?.prices && typeof board.prices === "object" ? board.prices as Record<string, JsonRecord> : {};

  return rawRows
    .map((row): PulseStockRow | null => {
      const ticker = readSmartflowTicker(row);
      if (!ticker) return null;
      const boardRow = boardMap[ticker] ?? {};
      const normalizedBoard = normalizeMarketBoardRow(boardRow);
      const price =
        readFirstSmartflowNumber(normalizedBoard, ["close", "price", "currentPrice", "matchPrice", "lastPrice"]) ??
        readFirstSmartflowNumber(row, ["price", "close", "lastPrice"]) ??
        0;
      if (!Number.isFinite(price) || price <= 0) return null;
      const reference = readFirstSmartflowNumber(normalizedBoard, ["reference", "refPrice", "previousClose", "basicPrice"]);
      const ceiling = readFirstSmartflowNumber(normalizedBoard, ["ceiling", "ceilingPrice"]);
      const floor = readFirstSmartflowNumber(normalizedBoard, ["floor", "floorPrice"]);
      const changePct =
        readFirstSmartflowNumber(normalizedBoard, ["changePct", "percentChange", "changePercent"]) ??
        readFirstSmartflowNumber(row, ["changePct", "changePercent"]) ??
        (reference != null && reference > 0 ? ((price - reference) / reference) * 100 : 0);
      const volume =
        readFirstSmartflowNumber(normalizedBoard, ["volume", "matchVolume", "totalVolume", "totalVolumeTraded"]) ??
        readFirstSmartflowNumber(row, ["volume", "matchVolume", "totalVolume"]) ??
        0;
      const tradedValue = readFirstSmartflowNumber(normalizedBoard, ["grossTradeAmount", "tradingValue", "value", "amount"]);
      const valueBillion = normalizeTradeValueBillion(tradedValue, price, volume);
      const marketCapBillion = normalizeMarketCapBillion(
        readFirstSmartflowNumber(normalizedBoard, ["marketCap", "marketCapitalization", "capitalization", "marketValue"]) ??
        readFirstSmartflowNumber(row, ["marketCap", "marketCapitalization", "capitalization", "marketValue"]) ??
        null,
      );
      const sector = classifyTickerSector(ticker, String(row.sector ?? row.industry ?? ""));
      return {
        ticker,
        name: String(row.name ?? row.companyName ?? ticker),
        sector,
        exchange: normalizeExchange(normalizedBoard.exchange ?? row.exchange ?? row.floor),
        price,
        reference,
        ceiling,
        floor,
        changePct,
        volume,
        valueBillion,
        marketCapBillion,
        state: classifyPriceState(price, reference, ceiling, floor, changePct),
        rsRating: readFirstSmartflowNumber(row, ["rsRating", "rsScore", "rs_rating", "rs_score"]),
        pct1w: readFirstSmartflowNumber(row, ["pct_1w", "pct1w"]),
        pct1m: readFirstSmartflowNumber(row, ["pct_1m", "pct1m"]),
        pct3m: readFirstSmartflowNumber(row, ["pct_3m", "pct3m"]),
      };
    })
    .filter((row): row is PulseStockRow => Boolean(row))
    .sort((a, b) => b.valueBillion - a.valueBillion);
}

async function loadPulseMarketHeatmap(force = false) {
  const stocks = await loadPulseRankStocks(force, 300);
  const sectorMap = new Map<string, PulseStockRow[]>();
  for (const stock of stocks.filter((item) => item.valueBillion > 0).slice(0, 240)) {
    const rows = sectorMap.get(stock.sector) ?? [];
    rows.push(stock);
    sectorMap.set(stock.sector, rows);
  }
  const sectors = Array.from(sectorMap.entries())
    .map(([sector, rows]) => ({
      sector,
      totalValueBillion: Number(rows.reduce((sum, row) => sum + row.valueBillion, 0).toFixed(2)),
      stocks: rows
        .sort((a, b) => b.valueBillion - a.valueBillion)
        .slice(0, 24)
        .map((row) => ({
          ticker: row.ticker,
          sector: row.sector,
          price: Number(row.price.toFixed(2)),
          changePct: Number(row.changePct.toFixed(2)),
          valueBillion: Number(row.valueBillion.toFixed(2)),
          state: row.state,
        })),
    }))
    .filter((sector) => sector.totalValueBillion > 0)
    .sort((a, b) => b.totalValueBillion - a.totalValueBillion)
    .slice(0, 16);

  return {
    sectors,
    count: sectors.reduce((sum, sector) => sum + sector.stocks.length, 0),
    sourceStatus: {
      publish: sectors.length > 0,
      missingFields: sectors.length > 0 ? [] : ["marketHeatmap"],
    },
    updatedAt: new Date().toISOString(),
  };
}

function topMoverRowFromStock(stock: PulseStockRow, periodChangePercent: number) {
  return {
    ticker: stock.ticker,
    exchange: stock.exchange,
    sector: stock.sector,
    price: Number(stock.price.toFixed(2)),
    volume: Math.round(stock.volume),
    valueBillion: Number(stock.valueBillion.toFixed(2)),
    marketCapBillion: stock.marketCapBillion == null ? null : Number(stock.marketCapBillion.toFixed(2)),
    changePercent1D: Number(stock.changePct.toFixed(2)),
    periodChangePercent: Number(periodChangePercent.toFixed(2)),
  };
}

// Lịch sử giá đóng cửa theo ngày từ radar.realtime.tick (nguồn v2, KHÔNG gọi bridge → còn giúp giảm
// tải precompute). 1 row/mã/ngày, field price = giá đóng cửa (thang nghìn — % bất biến theo thang nên ok).
async function loadDailyTickCloseHistory(tickers: string[]): Promise<Map<string, Array<{ date: string; close: number }>>> {
  const map = new Map<string, Array<{ date: string; close: number }>>();
  if (!tickers.length) return map;
  const rows = await prisma.databaseToolLatest.findMany({
    where: { tool: "radar", dataset: "radar.realtime.tick", key: { in: tickers } },
    select: { key: true, tradingDate: true, payload: true },
    orderBy: [{ key: "asc" }, { tradingDate: "asc" }],
    take: 20000,
  });
  for (const row of rows) {
    if (!row.tradingDate) continue;
    const close = smartflowNumber((row.payload as JsonRecord | null)?.price);
    if (close == null || close <= 0) continue;
    const arr = map.get(row.key) ?? [];
    arr.push({ date: row.tradingDate, close });
    map.set(row.key, arr);
  }
  return map;
}

// % thay đổi qua N phiên. Đủ phiên → chính xác; thiếu nhưng phủ ≥70% N → xấp xỉ bằng phiên cũ nhất; còn lại null.
function periodPctFromHistory(hist: Array<{ date: string; close: number }> | undefined, periodDays: number): number | null {
  if (!hist || hist.length < 2) return null;
  const sorted = hist.slice().sort((a, b) => (a.date < b.date ? -1 : 1));
  const latest = sorted[sorted.length - 1].close;
  const idx = sorted.length - 1 - periodDays;
  let past: number | null = null;
  if (idx >= 0) past = sorted[idx].close;
  else if (sorted.length - 1 >= periodDays * 0.7) past = sorted[0].close;
  if (past == null || past <= 0 || !Number.isFinite(latest)) return null;
  return ((latest - past) / past) * 100;
}

type DnseTeBoardRow = { price: number; changePct1D: number | null; volume: number; valueBillion: number };
let dnseTeBoardCache: { at: number; data: Map<string, DnseTeBoardRow> } | null = null;
// Bảng giá NGÀY MỚI NHẤT từ market.eod 'te' (DNSE cron thu, đúng từng ngày). Dùng SỬA giá + %1D cho top-movers:
// fetchDnseMarketBoard (realtime 5m/close endpoint) trả T-1 lẫn lộn sau phiên (vd LPB 52.6 ngày 23/6 thay vì 55.1 ngày 24/6).
// price = matchPrice×1000 (VND); %1D = (close mới − close phiên trước)/phiên trước; KLGD/GTGD từ phiên mới nhất.
async function loadDnseTeBoardLatest(): Promise<Map<string, DnseTeBoardRow>> {
  if (dnseTeBoardCache && Date.now() - dnseTeBoardCache.at < 5 * 60_000) return dnseTeBoardCache.data;
  const map = new Map<string, DnseTeBoardRow>();
  try {
    const rows = await prisma.$queryRaw<Array<{ symbol: string; tradingDate: string; matchprice: unknown; vol: unknown }>>`
      WITH recent AS (
        SELECT DISTINCT "tradingDate" FROM "DatabaseMarketLatest"
        WHERE dataset = 'market.eod' AND "payload"->>'T' = 'te'
        ORDER BY "tradingDate" DESC LIMIT 2
      )
      SELECT "symbol" AS symbol, "tradingDate" AS "tradingDate",
        ("payload"->>'matchPrice')::numeric AS matchprice,
        ("payload"->>'totalVolumeTraded')::numeric AS vol
      FROM "DatabaseMarketLatest"
      WHERE dataset = 'market.eod' AND "payload"->>'T' = 'te'
        AND ("payload"->>'matchPrice') IS NOT NULL
        AND "tradingDate" IN (SELECT "tradingDate" FROM recent)
      ORDER BY "symbol", "tradingDate" ASC`;
    const bySym = new Map<string, Array<{ date: string; price: number; vol: number }>>();
    for (const row of rows) {
      const sym = String(row.symbol).toUpperCase();
      const price = Number(row.matchprice);
      if (!Number.isFinite(price) || price <= 0) continue;
      const list = bySym.get(sym) ?? [];
      list.push({ date: row.tradingDate, price, vol: row.vol == null ? 0 : Number(row.vol) });
      bySym.set(sym, list);
    }
    for (const [sym, list] of bySym) {
      list.sort((a, b) => (a.date < b.date ? -1 : 1));
      const latest = list[list.length - 1];
      const prev = list.length >= 2 ? list[list.length - 2] : null;
      const priceVnd = Number((latest.price * 1000).toFixed(2));
      const changePct1D = prev && prev.price > 0 ? Number((((latest.price - prev.price) / prev.price) * 100).toFixed(2)) : null;
      const volume = Math.max(0, Math.round(latest.vol));
      map.set(sym, { price: priceVnd, changePct1D, volume, valueBillion: Number(((priceVnd * volume) / 1e9).toFixed(2)) });
    }
  } catch {
    return dnseTeBoardCache?.data ?? map;
  }
  dnseTeBoardCache = { at: Date.now(), data: map };
  return map;
}

async function loadPulseTopMovers(force = false) {
  const stocks = await loadPulseRankStocks(force, 500);
  // SỬA giá + %1D + KLGD/GTGD từ market.eod 'te' (đúng từng ngày) — fetchDnseMarketBoard realtime trả T-1 lẫn lộn sau phiên.
  const teBoard = await loadDnseTeBoardLatest().catch(() => new Map<string, DnseTeBoardRow>());
  if (teBoard.size > 0) {
    for (const stock of stocks) {
      const te = teBoard.get(stock.ticker);
      if (!te) continue;
      stock.price = te.price;
      if (te.changePct1D != null) stock.changePct = te.changePct1D;
      if (te.volume > 0) {
        stock.volume = te.volume;
        stock.valueBillion = te.valueBillion;
      }
    }
  }
  const history = await loadDailyTickCloseHistory(stocks.map((stock) => stock.ticker)).catch(() => new Map());
  const minCoverage = Math.max(20, Math.floor(stocks.length * 0.3));

  const frames: Record<string, { enabled: boolean; label: string; rows: ReturnType<typeof topMoverRowFromStock>[]; missingReason: string | null }> = {};
  for (const timeframe of PULSE_TOP_MOVER_TIMEFRAMES) {
    const label = formatPulseTopMoverTimeframe(timeframe);
    if (timeframe === "1D") {
      // Chỉ mã có 'te' hôm nay (giá + %1D đáng tin, CÙNG NGÀY) → tránh mã giá T-1 (realtime stale) lọt top.
      // 'te' rỗng (lỗi DB) → fallback toàn bộ như cũ.
      const teRows = stocks
        .filter((stock) => teBoard.get(stock.ticker)?.changePct1D != null)
        .map((stock) => topMoverRowFromStock(stock, stock.changePct));
      const rows = teRows.length > 0 ? teRows : stocks.map((stock) => topMoverRowFromStock(stock, stock.changePct));
      frames[timeframe] = { enabled: rows.length > 0, label, rows, missingReason: rows.length > 0 ? null : "Chưa có dữ liệu hôm nay." };
      continue;
    }
    const periodDays = PULSE_MOVER_PERIOD_DAYS[timeframe];
    if (periodDays) {
      // %-kỳ ƯU TIÊN từ RS-rating bridge (close history sâu ~252 phiên → đủ cho 1M=22/3M=66); thiếu (mã
      // ngoài RS) mới fallback tick (20 phiên). Trước đây CHỈ dùng tick → 1M/3M thiếu lịch sử bị disable.
      const rankPct = (stock: PulseStockRow): number | null =>
        timeframe === "1W" ? stock.pct1w : timeframe === "1M" ? stock.pct1m : timeframe === "3M" ? stock.pct3m : null;
      const rows = stocks
        .map((stock) => {
          const fromRank = rankPct(stock);
          const pct = fromRank != null && Number.isFinite(fromRank)
            ? fromRank
            : periodPctFromHistory(history.get(stock.ticker), periodDays);
          return pct == null ? null : topMoverRowFromStock(stock, pct);
        })
        .filter((row): row is ReturnType<typeof topMoverRowFromStock> => row != null);
      frames[timeframe] = rows.length >= minCoverage
        ? { enabled: true, label, rows, missingReason: null }
        : { enabled: false, label, rows: [], missingReason: `Đang tích lũy đủ dữ liệu khung ${label}.` };
      continue;
    }
    // Khung intraday (5m/15m/30m/1h): chờ dữ liệu nến trong phiên (đợt khôi phục intraday).
    frames[timeframe] = { enabled: false, label, rows: [], missingReason: "Đang cập nhật dữ liệu trong phiên." };
  }

  const publishable = Object.values(frames).some((frame) => frame.enabled);
  return {
    defaultTimeframe: "1D",
    timeframes: frames,
    sourceStatus: {
      publish: publishable,
      missingFields: publishable ? [] : ["topMovers"],
    },
    updatedAt: new Date().toISOString(),
  };
}

async function loadPulseIndexImpactTopic() {
  const impact = await buildIndexImpact(null);
  const combined = [...impact.positive, ...impact.negative]
    .sort((a, b) => Math.abs(b.contributionPoints) - Math.abs(a.contributionPoints));
  return {
    indices: {
      VNINDEX: {
        index: "VNINDEX",
        updatedAt: impact.updatedAt,
        contributionType: combined.some((row) => row.contributionType === "estimated") ? "estimated" : "actual",
        rows: combined,
        missingFields: combined.length > 0 ? [] : ["indexContributionPoints"],
      },
      VN30: { index: "VN30", rows: [], missingFields: ["indexContributionPoints"] },
      HNX: { index: "HNX", rows: [], missingFields: ["indexContributionPoints"] },
      UPCOM: { index: "UPCOM", rows: [], missingFields: ["indexContributionPoints"] },
    },
    sourceStatus: {
      publish: combined.length > 0,
      missingFields: combined.length > 0 ? [] : ["indexImpact"],
    },
    updatedAt: new Date().toISOString(),
  };
}

async function loadRankSnapshots(limit = 90) {
  const dbRows = await listDatabaseToolLatest<JsonRecord>({
    tool: "rank",
    dataset: "rank.rs",
    limit,
    ignoreExpires: true,
  }).catch(() => []);
  const dbSnapshots = dbRows
    .map((row) => ({
      date: String((row.payload as JsonRecord)?.asOfDate ?? row.tradingDate),
      payload: row.payload,
      updatedAt: row.updatedAt,
      source: "database_v2",
    }))
    .filter((row) => rankRowsFromPayload(row.payload).length > 0);

  const cronRows = await prisma.cronLog.findMany({
    where: { cronName: "adn_rank_15h", status: "success" },
    orderBy: { createdAt: "desc" },
    take: limit,
    select: { resultData: true, createdAt: true },
  }).catch(() => []);
  const cronSnapshots = cronRows
    .map((row) => {
      const payload = extractPrecomputedTopicValue(row, "research:rs-rating:list", 180 * 24 * 60 * 60_000);
      return {
        date: String((payload as JsonRecord | null)?.asOfDate ?? row.createdAt.toISOString().slice(0, 10)),
        payload,
        updatedAt: row.createdAt.toISOString(),
        source: "cron_log",
      };
    })
    .filter((row) => rankRowsFromPayload(row.payload).length > 0);

  const byDate = new Map<string, { date: string; payload: unknown; updatedAt: string; source: string }>();
  for (const row of cronSnapshots) byDate.set(row.date, row);
  for (const row of dbSnapshots) byDate.set(row.date, row);
  return Array.from(byDate.values())
    .sort((a, b) => a.date.localeCompare(b.date))
    .slice(-limit);
}

function normalizeRankHistoryRow(row: JsonRecord) {
  const ticker = readSmartflowTicker(row);
  const score = readFirstSmartflowNumber(row, ["rsRating", "rsScore", "rs_rating", "rs_score"]);
  if (!ticker || score == null) return null;
  const price = readFirstSmartflowNumber(row, ["price", "close", "lastPrice"]) ?? 0;
  const volume = readFirstSmartflowNumber(row, ["volume", "matchVolume", "totalVolume"]) ?? 0;
  return {
    ticker,
    name: String(row.name ?? row.companyName ?? ticker),
    sector: classifyTickerSector(ticker, String(row.sector ?? row.industry ?? "")),
    score: Number(score.toFixed(2)),
    price,
    volume,
    changePercent: readFirstSmartflowNumber(row, ["changePercent", "changePct"]) ?? 0,
    valueBillion: estimateTradeValueBillion(price, volume),
  };
}

async function loadRankStocksHistory() {
  const snapshots = await loadRankSnapshots(90);
  const timeline = snapshots.map((snapshot) => snapshot.date);
  const byTicker = new Map<string, {
    ticker: string;
    name: string;
    sector: string;
    latestScore: number;
    values: Array<{ date: string; score: number | null }>;
  }>();

  for (const snapshot of snapshots) {
    for (const item of rankRowsFromPayload(snapshot.payload)) {
      const row = normalizeRankHistoryRow(item);
      if (!row) continue;
      const current = byTicker.get(row.ticker) ?? {
        ticker: row.ticker,
        name: row.name,
        sector: row.sector,
        latestScore: row.score,
        values: [],
      };
      current.latestScore = row.score;
      current.values.push({ date: snapshot.date, score: row.score });
      byTicker.set(row.ticker, current);
    }
  }

  return {
    timeline,
    rows: Array.from(byTicker.values())
      .map((row) => ({
        ...row,
        values: timeline.map((date) => row.values.find((item) => item.date === date) ?? { date, score: null }),
      }))
      .sort((a, b) => b.latestScore - a.latestScore),
    updatedAt: snapshots.at(-1)?.updatedAt ?? new Date().toISOString(),
  };
}

function median(values: number[]) {
  if (values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

async function loadRankSectorsHistory() {
  const snapshots = await loadRankSnapshots(90);
  const timeline = snapshots.map((snapshot) => snapshot.date);
  const latestDate = snapshots.at(-1)?.date ?? null;
  const bySector = new Map<string, {
    sector: string;
    stockCount: number;
    liquidStockCount: number;
    latestScore: number;
    values: Array<{ date: string; score: number | null; stockCount: number }>;
    members: Array<{
      ticker: string;
      name: string;
      sector: string;
      latestScore: number | null;
      price: number | null;
      changePercent: number | null;
      valueBillion: number | null;
    }>;
  }>();

  for (const snapshot of snapshots) {
    const groups = new Map<string, ReturnType<typeof normalizeRankHistoryRow>[]>();
    for (const item of rankRowsFromPayload(snapshot.payload)) {
      const row = normalizeRankHistoryRow(item);
      if (!row) continue;
      const current = groups.get(row.sector) ?? [];
      current.push(row);
      groups.set(row.sector, current);
    }
    for (const [sector, rows] of groups.entries()) {
      const score = median(rows.map((row) => row?.score ?? 0).filter((value) => Number.isFinite(value)));
      if (score == null) continue;
      const current = bySector.get(sector) ?? {
        sector,
        stockCount: rows.length,
        liquidStockCount: 0,
        latestScore: score,
        values: [],
        members: [],
      };
      current.stockCount = rows.length;
      current.liquidStockCount = rows.filter((row) => (row?.valueBillion ?? 0) >= 10).length;
      current.latestScore = score;
      current.values.push({ date: snapshot.date, score: Number(score.toFixed(2)), stockCount: rows.length });
      if (snapshot.date === latestDate) {
        current.members = rows
          .filter((row): row is NonNullable<typeof row> => Boolean(row))
          .map((row) => ({
            ticker: row.ticker,
            name: row.name,
            sector: row.sector,
            latestScore: row.score,
            price: row.price,
            changePercent: row.changePercent,
            valueBillion: row.valueBillion,
          }))
          .sort((a, b) => (b.latestScore ?? -1) - (a.latestScore ?? -1));
      }
      bySector.set(sector, current);
    }
  }

  return {
    timeline,
    rows: Array.from(bySector.values())
      .map((row) => ({
        ...row,
        latestScore: Number(row.latestScore.toFixed(2)),
        values: timeline.map((date) => row.values.find((item) => item.date === date) ?? { date, score: null, stockCount: 0 }),
      }))
      .sort((a, b) => b.latestScore - a.latestScore),
    liquidityRule: "Hiển thị toàn bộ nhóm ngành có dữ liệu ADN Rank; GTGD chỉ dùng để tham khảo.",
    updatedAt: snapshots.at(-1)?.updatedAt ?? new Date().toISOString(),
  };
}

async function loadCanonicalMarketTopic(topicKey: string) {
  const snapshot = await getMarketSnapshot();
  const canonical = {
    date: snapshot.requestDateVN,
    updatedAt: snapshot.timestamp,
    sourceStatus: snapshot.source,
    indices: snapshot.indices,
    liquidityByExchange: snapshot.liquidityByExchange,
    totalMatchedLiquidity: snapshot.liquidity,
    totalDealLiquidity: null,
    breadth: snapshot.breadth,
    breadthByExchange: snapshot.breadthByExchange,
    investorFlow: {
      foreign: snapshot.investorTrading.foreign,
      proprietary: snapshot.investorTrading.proprietary,
      individual: snapshot.investorTrading.retail,
      availability: snapshot.investorTrading.availability,
    },
    publishReady: snapshot.publish,
    missingFields: snapshot.publishBlockers,
    freshness: snapshot.freshness,
    providerDiagnostics: snapshot.providerDiagnostics,
  };

  if (topicKey === "market:liquidity:latest") {
    return {
      date: canonical.date,
      updatedAt: canonical.updatedAt,
      liquidityByExchange: canonical.liquidityByExchange,
      totalMatchedLiquidity: canonical.totalMatchedLiquidity,
      totalDealLiquidity: canonical.totalDealLiquidity,
      publishReady: canonical.publishReady,
      missingFields: canonical.missingFields,
      sourceStatus: canonical.sourceStatus,
    };
  }
  if (topicKey === "market:breadth:latest") {
    return {
      date: canonical.date,
      updatedAt: canonical.updatedAt,
      breadth: canonical.breadth,
      breadthByExchange: canonical.breadthByExchange,
      publishReady: canonical.publishReady,
      missingFields: canonical.missingFields,
      sourceStatus: canonical.sourceStatus,
    };
  }
  if (topicKey === "market:investor-flow:latest") {
    return {
      date: canonical.date,
      updatedAt: canonical.updatedAt,
      investorFlow: canonical.investorFlow,
      publishReady: canonical.publishReady,
      missingFields: canonical.missingFields,
      sourceStatus: canonical.sourceStatus,
    };
  }
  return canonical;
}

const TOPIC_DEFINITIONS: TopicDefinition[] = [
  {
    id: "market:canonical:latest",
    ttlMs: 60_000,
    minIntervalMs: 10_000,
    source: "datahub:canonical-market",
    version: "v1",
    tags: ["dashboard", "market", "canonical"],
    match: (topicKey) =>
      ["market:canonical:latest", "market:liquidity:latest", "market:breadth:latest", "market:investor-flow:latest"].includes(topicKey)
        ? { ok: true }
        : { ok: false },
    resolve: async (topicKey) => loadCanonicalMarketTopic(topicKey),
  },
  {
    id: "vn:index:overview",
    ttlMs: 60_000,
    minIntervalMs: 10_000,
    source: "api:market",
    version: "v1",
    tags: ["dashboard", "market"],
    match: (topicKey) => (topicKey === "vn:index:overview" ? { ok: true } : { ok: false }),
    resolve: async () => loadMarketOverview(),
  },
  {
    id: "vn:index:snapshot",
    ttlMs: 60_000,
    minIntervalMs: 10_000,
    source: "datahub:canonical-market",
    version: "v1",
    tags: ["dashboard", "market"],
    match: (topicKey) => (topicKey === "vn:index:snapshot" ? { ok: true } : { ok: false }),
    resolve: async () => getMarketSnapshot(),
  },
  {
    id: "vn:index:composite",
    ttlMs: 60_000,
    minIntervalMs: 15_000,
    source: "api:market-status",
    version: "v1",
    tags: ["dashboard", "market", "composite"],
    match: (topicKey) => (topicKey === "vn:index:composite" ? { ok: true } : { ok: false }),
    resolve: async () => loadCompositeCache(),
  },
  {
    id: "vn:index:composite:live",
    ttlMs: 300_000,
    minIntervalMs: 30_000,
    source: "api:market-overview",
    version: "v1",
    tags: ["dashboard", "market", "composite"],
    match: (topicKey) => (topicKey === "vn:index:composite:live" ? { ok: true } : { ok: false }),
    resolve: async () => loadCompositeLive(),
  },
  {
    id: "vn:index:valuation:VNINDEX",
    ttlMs: 15 * 60 * 1000,
    minIntervalMs: 60_000,
    source: "api:index-valuation",
    version: "v1",
    tags: ["dashboard", "market", "composite", "valuation"],
    match: (topicKey) => (topicKey === "vn:index:valuation:VNINDEX" ? { ok: true } : { ok: false }),
    resolve: async () => loadIndexValuation("VNINDEX"),
  },
  {
    id: "vn:index:chart:30d",
    ttlMs: 60_000,
    minIntervalMs: 15_000,
    source: "datahub:index-history+snapshot",
    version: "v1",
    tags: ["dashboard", "market", "chart", "historical"],
    match: (topicKey) => (topicKey === "vn:index:chart:30d" ? { ok: true } : { ok: false }),
    resolve: async () => loadVNIndexChart30d(),
  },
  {
    id: "vn:index:breadth:VNINDEX",
    ttlMs: 60_000,
    minIntervalMs: 15_000,
    source: "aggregator:marketDataFetcher",
    version: "v1",
    tags: ["dashboard", "market", "breadth"],
    match: (topicKey) => (topicKey === "vn:index:breadth:VNINDEX" ? { ok: true } : { ok: false }),
    resolve: async () => {
      const snapshot = await getMarketSnapshot();
      return {
        ticker: "VNINDEX",
        breadth: snapshot.breadth,
        byExchange: snapshot.breadthByExchange,
        source: snapshot.source.breadth,
        timestamp: snapshot.timestamp,
        freshness: snapshot.freshness,
        publish: snapshot.publish,
        publishBlockers: snapshot.publishBlockers,
      };
    },
  },
  {
    id: "pulse:smartflow",
    ttlMs: 300_000,
    minIntervalMs: 60_000,
    staleWhileRevalidateMs: 300_000,
    source: "datahub:dnse-primary-fiinquant-fallback",
    version: "v1",
    tags: ["dashboard", "pulse", "smartflow", "market"],
    match: (topicKey) => (topicKey === "pulse:smartflow" ? { ok: true } : { ok: false }),
    resolve: async (_, context) => loadDatabaseV2PulseTopic(context.force === true),
  },
  {
    id: "pulse:market:heatmap",
    ttlMs: 60_000,
    minIntervalMs: 30_000,
    staleWhileRevalidateMs: 120_000,
    source: "datahub:rank-board-heatmap",
    version: "v1",
    tags: ["dashboard", "pulse", "heatmap", "market"],
    match: (topicKey) => (topicKey === "pulse:market:heatmap" ? { ok: true } : { ok: false }),
    resolve: async (_, context) => loadPulseMarketHeatmap(context.force === true),
  },
  {
    id: "pulse:index-impact",
    ttlMs: 300_000,
    // minIntervalMs LỚN (24h) = lever chống block thật của core: quá TTL nhưng còn trong minInterval thì
    // core trả bản cache NGAY (không recompute on-demand ~27s). Chỉ cron force=1 (mỗi 5' trong phiên) recompute.
    // → user KHÔNG bao giờ chờ/rỗng sau phiên/qua đêm. (Task A.)
    minIntervalMs: 86_400_000,
    staleWhileRevalidateMs: 86_400_000,
    source: "datahub:fiinquant-index-contribution",
    version: "v1",
    tags: ["dashboard", "pulse", "index-impact"],
    match: (topicKey) => (topicKey === "pulse:index-impact" ? { ok: true } : { ok: false }),
    resolve: async () => loadPulseIndexImpactTopic(),
  },
  {
    id: "pulse:top-movers",
    ttlMs: 60_000,
    // minIntervalMs LỚN (24h): compute lạnh ~26-30s (rank 500 mã + lịch sử tick) là thủ phạm card rỗng/chờ.
    // Với minInterval lớn, core trả bản cache NGAY khi quá TTL (không recompute on-demand). Cron force=1 (5'/phiên)
    // mới recompute → mọi load nhanh, kể cả sau phiên/qua đêm. (Task A.)
    minIntervalMs: 86_400_000,
    staleWhileRevalidateMs: 86_400_000,
    source: "datahub:rank-board-movers",
    version: "v1",
    tags: ["dashboard", "pulse", "top-movers"],
    match: (topicKey) => (topicKey === "pulse:top-movers" ? { ok: true } : { ok: false }),
    resolve: async (_, context) => loadPulseTopMovers(context.force === true),
  },
  {
    id: "news:morning:latest",
    ttlMs: 300_000,
    minIntervalMs: 60_000,
    staleWhileRevalidateMs: 300_000,
    source: "db:market-report",
    version: "v1",
    tags: ["brief", "morning-brief", "public"],
    match: (topicKey) => (topicKey === "news:morning:latest" ? { ok: true } : { ok: false }),
    resolve: async () => loadDatabaseV2MorningBriefTopic(),
  },
  {
    id: "brief:morning:latest",
    ttlMs: 300_000,
    minIntervalMs: 60_000,
    staleWhileRevalidateMs: 300_000,
    source: "db:market-report",
    version: "v1",
    tags: ["brief", "morning-brief", "public"],
    match: (topicKey) => (topicKey === "brief:morning:latest" ? { ok: true } : { ok: false }),
    resolve: async () => loadDatabaseV2MorningBriefTopic(),
  },
  {
    id: "brief:morning:{date}",
    ttlMs: 24 * 60 * 60 * 1000,
    minIntervalMs: 60_000,
    source: "db:market-report",
    version: "v1",
    tags: ["brief", "morning-brief", "public"],
    match: (topicKey) => {
      const match = topicKey.match(/^brief:morning:(\d{4}-\d{2}-\d{2})$/);
      return match ? { ok: true, params: { date: match[1] } } : { ok: false };
    },
    resolve: async (_, __, params) => loadBriefByTypeAndDate("morning_brief", params.date),
  },
  {
    id: "news:eod:latest",
    ttlMs: 300_000,
    minIntervalMs: 60_000,
    staleWhileRevalidateMs: 300_000,
    source: "db:market-report",
    version: "v1",
    tags: ["brief", "eod-brief", "public"],
    match: (topicKey) => (topicKey === "news:eod:latest" ? { ok: true } : { ok: false }),
    resolve: async () => loadDatabaseV2EodBriefTopic(),
  },
  {
    id: "brief:close:latest",
    ttlMs: 300_000,
    minIntervalMs: 30_000,
    source: "db:market-report",
    version: "v1",
    tags: ["brief", "close-brief", "public"],
    match: (topicKey) => (topicKey === "brief:close:latest" ? { ok: true } : { ok: false }),
    resolve: async () => loadLatestCloseBrief(),
  },
  {
    id: "brief:close:{date}:15h",
    ttlMs: 24 * 60 * 60 * 1000,
    minIntervalMs: 60_000,
    source: "db:market-report",
    version: "v1",
    tags: ["brief", "close-brief", "public"],
    match: (topicKey) => {
      const match = topicKey.match(/^brief:close:(\d{4}-\d{2}-\d{2}):15h$/);
      return match ? { ok: true, params: { date: match[1] } } : { ok: false };
    },
    resolve: async (_, __, params) => loadBriefByTypeAndDate("close_brief_15h", params.date),
  },
  {
    id: "brief:eod:latest",
    ttlMs: 300_000,
    minIntervalMs: 60_000,
    staleWhileRevalidateMs: 300_000,
    source: "db:market-report",
    version: "v1",
    tags: ["brief", "eod-brief", "public"],
    match: (topicKey) => (topicKey === "brief:eod:latest" ? { ok: true } : { ok: false }),
    resolve: async () => loadDatabaseV2EodBriefTopic(),
  },
  {
    id: "brief:eod:{date}:19h",
    ttlMs: 24 * 60 * 60 * 1000,
    minIntervalMs: 60_000,
    source: "db:market-report",
    version: "v1",
    tags: ["brief", "eod-brief", "public"],
    match: (topicKey) => {
      const match = topicKey.match(/^brief:eod:(\d{4}-\d{2}-\d{2}):19h$/);
      return match ? { ok: true, params: { date: match[1] } } : { ok: false };
    },
    resolve: async (_, __, params) => loadBriefByTypeAndDate("eod_full_19h", params.date),
  },
  {
    id: "signal:market:radar",
    ttlMs: 60_000,
    minIntervalMs: 10_000,
    source: "db:signal",
    version: "v1",
    tags: ["signal", "public"],
    match: (topicKey) => (topicKey === "signal:market:radar" ? { ok: true } : { ok: false }),
    resolve: async () => loadSignalList("RADAR"),
  },
  {
    id: "radar:watchlist:active",
    ttlMs: 60_000,
    minIntervalMs: 10_000,
    source: "config:radar",
    version: "v1",
    tags: ["signal", "signal-scan", "radar", "internal"],
    match: (topicKey) => (topicKey === "radar:watchlist:active" ? { ok: true } : { ok: false }),
    resolve: async () => loadRadarWatchlistActive(),
  },
  {
    id: "radar:prefilter:latest",
    ttlMs: 60_000,
    minIntervalMs: 10_000,
    source: "db:cron-log",
    version: "v1",
    tags: ["signal", "signal-scan", "radar", "internal"],
    match: (topicKey) => (topicKey === "radar:prefilter:latest" ? { ok: true } : { ok: false }),
    resolve: async () => loadRadarPrefilterLatest(),
  },
  {
    id: "signal:market:active",
    ttlMs: 60_000,
    minIntervalMs: 10_000,
    source: "db:signal",
    version: "v1",
    tags: ["signal", "public"],
    match: (topicKey) => (topicKey === "signal:market:active" ? { ok: true } : { ok: false }),
    resolve: async () => loadSignalList("ACTIVE"),
  },
  {
    id: "signal:radar",
    ttlMs: 60_000,
    minIntervalMs: 10_000,
    source: "db:signal",
    version: "v1",
    tags: ["signal", "public", "legacy-alias"],
    match: (topicKey) => (topicKey === "signal:radar" ? { ok: true } : { ok: false }),
    resolve: async () => loadSignalList("RADAR"),
  },
  {
    id: "signal:active",
    ttlMs: 60_000,
    minIntervalMs: 10_000,
    source: "db:signal",
    version: "v1",
    tags: ["signal", "public", "legacy-alias"],
    match: (topicKey) => (topicKey === "signal:active" ? { ok: true } : { ok: false }),
    resolve: async () => loadSignalList("ACTIVE"),
  },
  {
    id: "signal:map:latest",
    ttlMs: 300_000,       // 5 min — was 60s; /api/signals now returns immediately from DB
    minIntervalMs: 30_000, // 30s min re-fetch gap — was 10s
    source: "api:signals",
    version: "v1",
    tags: ["signal", "public", "dashboard"],
    match: (topicKey) => (topicKey === "signal:map:latest" ? { ok: true } : { ok: false }),
    resolve: async () => loadSignalMapLatest(),
  },
  {
    id: "signal:scan:latest",
    ttlMs: 60_000,
    minIntervalMs: 10_000,
    source: "db:cron-log",
    version: "v1",
    tags: ["signal", "signal-scan", "public", "dashboard"],
    match: (topicKey) => (topicKey === "signal:scan:latest" ? { ok: true } : { ok: false }),
    resolve: async () => loadLatestSignalScanArtifact(),
  },
  {
    id: "signal:scan:{date}:{slot}",
    ttlMs: 24 * 60 * 60 * 1000,
    minIntervalMs: 60_000,
    source: "db:cron-log",
    version: "v1",
    tags: ["signal", "signal-scan", "public", "dashboard"],
    match: (topicKey) => {
      const match = topicKey.match(/^signal:scan:(\d{4}-\d{2}-\d{2}):(\d{2}:?\d{2})$/);
      return match ? { ok: true, params: { date: match[1], slot: match[2] } } : { ok: false };
    },
    resolve: async (_, __, params) => loadSignalScanArtifactByDateSlot(params.date, params.slot),
  },
  {
    id: "signal:reported:today",
    ttlMs: 120_000,       // 2 min — was 30s; no need to hit DB every 30s
    minIntervalMs: 30_000, // 30s min re-fetch gap — was 10s
    source: "db:signal-history",
    version: "v1",
    tags: ["signal", "signal-reported", "public", "dashboard"],
    match: (topicKey) => (topicKey === "signal:reported:today" ? { ok: true } : { ok: false }),
    resolve: async () => loadReportedSignalSummary(),
  },
  {
    id: "signal:reported:{date}",
    ttlMs: 24 * 60 * 60 * 1000,
    minIntervalMs: 60_000,
    source: "db:signal-history",
    version: "v1",
    tags: ["signal", "signal-reported", "public", "dashboard"],
    match: (topicKey) => {
      const match = topicKey.match(/^signal:reported:(\d{4}-\d{2}-\d{2})$/);
      return match ? { ok: true, params: { date: match[1] } } : { ok: false };
    },
    resolve: async (_, __, params) => loadReportedSignalSummary(params.date),
  },
  {
    id: "portfolio:user:{userId}:overview",
    ttlMs: 60_000,
    minIntervalMs: 15_000,
    source: "db:portfolio",
    version: "v1",
    access: "private",
    cacheScope: "user",
    tags: ["portfolio", "private"],
    match: (topicKey) => {
      const match = topicKey.match(/^portfolio:user:([A-Za-z0-9-]+):overview$/);
      return match ? { ok: true, params: { userId: match[1] } } : { ok: false };
    },
    resolve: async (_, context, params) => {
      if (!context.userId || context.userId !== params.userId) throw new Error("Unauthorized user topic");
      return loadPortfolioOverviewForUser(context.userId);
    },
  },
  {
    id: "portfolio:user:{userId}:holdings",
    ttlMs: 60_000,
    minIntervalMs: 15_000,
    source: "db:portfolio",
    version: "v1",
    access: "private",
    cacheScope: "user",
    tags: ["portfolio", "private"],
    match: (topicKey) => {
      const match = topicKey.match(/^portfolio:user:([A-Za-z0-9-]+):holdings$/);
      return match ? { ok: true, params: { userId: match[1] } } : { ok: false };
    },
    resolve: async (_, context, params) => {
      if (!context.userId || context.userId !== params.userId) throw new Error("Unauthorized user topic");
      return loadPortfolioSignalsForUser(context.userId);
    },
  },
  {
    id: "portfolio:holding:{userId}:{ticker}",
    ttlMs: 60_000,
    minIntervalMs: 15_000,
    source: "db:portfolio",
    version: "v1",
    access: "private",
    cacheScope: "user",
    tags: ["portfolio", "private"],
    match: (topicKey) => {
      const match = topicKey.match(/^portfolio:holding:([A-Za-z0-9-]+):([A-Z0-9._-]{1,12})$/);
      return match ? { ok: true, params: { userId: match[1], ticker: match[2] } } : { ok: false };
    },
    resolve: async (_, context, params) => {
      if (!context.userId || context.userId !== params.userId) throw new Error("Unauthorized user topic");
      return loadPortfolioHoldingForUser(context.userId, params.ticker);
    },
  },
  {
    id: "portfolio:holding:current-user:{ticker}",
    ttlMs: 60_000,
    minIntervalMs: 15_000,
    source: "db:portfolio",
    version: "v1",
    access: "private",
    cacheScope: "user",
    tags: ["portfolio", "private", "legacy-alias"],
    match: (topicKey) => {
      const match = topicKey.match(/^portfolio:holding:current-user:([A-Z0-9._-]{1,12})$/);
      return match ? { ok: true, params: { ticker: match[1] } } : { ok: false };
    },
    resolve: async (_, context, params) => {
      if (!context.userId) throw new Error("Unauthorized user topic");
      await assertValidTicker(params.ticker);
      return loadPortfolioHoldingForUser(context.userId, params.ticker);
    },
  },
  {
    id: "signal:user:{userId}:portfolio",
    ttlMs: 60_000,
    minIntervalMs: 15_000,
    source: "db:signal+portfolio",
    version: "v1",
    access: "private",
    cacheScope: "user",
    tags: ["signal", "private", "portfolio"],
    match: (topicKey) => {
      const match = topicKey.match(/^signal:user:([A-Za-z0-9-]+):portfolio$/);
      return match ? { ok: true, params: { userId: match[1] } } : { ok: false };
    },
    resolve: async (_, context, params) => {
      if (!context.userId || context.userId !== params.userId) throw new Error("Unauthorized user topic");
      return loadPortfolioSignalsForUser(context.userId);
    },
  },
  {
    id: "signal:user:{userId}:conflicts",
    ttlMs: 60_000,
    minIntervalMs: 15_000,
    source: "computed:signal-conflict",
    version: "v1",
    access: "private",
    cacheScope: "user",
    tags: ["signal", "private", "risk"],
    match: (topicKey) => {
      const match = topicKey.match(/^signal:user:([A-Za-z0-9-]+):conflicts$/);
      return match ? { ok: true, params: { userId: match[1] } } : { ok: false };
    },
    resolve: async (_, context, params) => {
      if (!context.userId || context.userId !== params.userId) throw new Error("Unauthorized user topic");
      const portfolio = await loadPortfolioSignalsForUser(context.userId);
      const conflicts = portfolio.positions
        .filter((item) => (item.currentPnl ?? 0) <= -5)
        .map((item) => ({
          ticker: item.ticker,
          reason: "P/L below -5%, review stoploss discipline",
          severity: "high",
        }));
      return {
        userId: context.userId,
        count: conflicts.length,
        conflicts,
      };
    },
  },
  {
    id: "watchlist:user:{userId}",
    ttlMs: 120_000,
    minIntervalMs: 30_000,
    source: "computed:watchlist",
    version: "v1",
    access: "private",
    cacheScope: "user",
    tags: ["watchlist", "private"],
    match: (topicKey) => {
      const match = topicKey.match(/^watchlist:user:([A-Za-z0-9-]+)$/);
      return match ? { ok: true, params: { userId: match[1] } } : { ok: false };
    },
    resolve: async (_, context, params) => {
      if (!context.userId || context.userId !== params.userId) throw new Error("Unauthorized user topic");
      return loadWatchlistForUser(context.userId);
    },
  },
  {
    id: "signal:portfolio:current-user",
    ttlMs: 60_000,
    minIntervalMs: 15_000,
    source: "db:signal+user",
    version: "v1",
    access: "private",
    cacheScope: "user",
    tags: ["signal", "private", "legacy-alias"],
    match: (topicKey) => (topicKey === "signal:portfolio:current-user" ? { ok: true } : { ok: false }),
    resolve: async (_, context) => {
      if (!context.userId) throw new Error("Unauthorized user topic");
      return loadPortfolioSignalsForUser(context.userId);
    },
  },
  {
    id: "ticker:resolve:{ticker}",
    ttlMs: 6 * 60 * 60 * 1000,
    minIntervalMs: 30_000,
    source: "resolver:ticker",
    version: "v1",
    tags: ["research", "ticker-resolver"],
    match: (topicKey) => {
      const match = topicKey.match(/^ticker:resolve:([A-Z0-9._-]{1,12})$/);
      return match ? { ok: true, params: { ticker: match[1] } } : { ok: false };
    },
    resolve: async (_, __, params) => resolveMarketTicker(params.ticker),
  },
  {
    id: "research:recent-tickers",
    ttlMs: 60_000,
    minIntervalMs: 15_000,
    source: "db:chat+ta",
    version: "v1",
    tags: ["research", "workbench", "public"],
    match: (topicKey) => (topicKey === "research:recent-tickers" ? { ok: true } : { ok: false }),
    resolve: async () => loadRecentResearchTickers(),
  },
  {
    id: "vn:price-snapshot:{ticker}",
    ttlMs: 60_000,
    minIntervalMs: 10_000,
    staleWhileRevalidateMs: 120_000,
    source: "aggregator:price-snapshot",
    version: "v1",
    tags: ["research", "price", "snapshot", "market"],
    match: (topicKey) => {
      const match = topicKey.match(/^vn:price-snapshot:([A-Z0-9._-]{1,12})$/);
      return match ? { ok: true, params: { ticker: match[1] } } : { ok: false };
    },
    resolve: async (_, __, params) => {
      const resolved = await assertValidTicker(params.ticker);
      return loadPriceSnapshotForTicker(resolved.ticker);
    },
  },
  {
    id: "vn:ta:{ticker}",
    ttlMs: 120_000,
    minIntervalMs: 15_000,
    source: "datahub:dnse-primary-fiinquant-fallback",
    version: "v1",
    tags: ["research", "ta"],
    match: (topicKey) => {
      const match = topicKey.match(/^vn:ta:([A-Z0-9._-]{1,12})$/);
      return match ? { ok: true, params: { ticker: match[1] } } : { ok: false };
    },
    resolve: async (_, __, params) => {
      const resolved = await assertValidTicker(params.ticker);
      const [ta, historical, realtime, board] = await Promise.all([
        fetchTAData(resolved.ticker),
        loadHistoricalTicker(resolved.ticker).catch(() => null),
        loadRealtimeTicker(resolved.ticker, "5m").catch(() => null),
        loadMarketBoardForTickers(resolved.ticker).catch(() => null),
      ]);
      const priceSnapshot = buildStockPriceSnapshot({
        ticker: resolved.ticker,
        historical,
        realtime,
        ta,
        marketBoard: board?.prices?.[resolved.ticker],
      });
      const recentClose = priceSnapshot.price ?? latestClosePriceFromPayload(historical);
      return applyPriceSnapshotToTA(normalizeTAWithHistorical(ta, historical, recentClose), priceSnapshot);
    },
  },
  {
    id: "vn:fa:{ticker}",
    ttlMs: 900_000,
    minIntervalMs: 60_000,
    source: "fiinquant",
    version: "v1",
    tags: ["research", "fa"],
    match: (topicKey) => {
      const match = topicKey.match(/^vn:fa:([A-Z0-9._-]{1,12})$/);
      return match ? { ok: true, params: { ticker: match[1] } } : { ok: false };
    },
    resolve: async (_, __, params) => {
      const resolved = await assertValidTicker(params.ticker);
      return loadHydratedFAData(resolved.ticker);
    },
  },
  {
    id: "vn:seasonality:{ticker}",
    ttlMs: 900_000,
    minIntervalMs: 60_000,
    source: "db:signal",
    version: "v1",
    tags: ["research", "seasonality"],
    match: (topicKey) => {
      const match = topicKey.match(/^vn:seasonality:([A-Z0-9._-]{1,12})$/);
      return match ? { ok: true, params: { ticker: match[1] } } : { ok: false };
    },
    resolve: async (_, __, params) => {
      const resolved = await assertValidTicker(params.ticker);
      return loadSeasonalityForTicker(resolved.ticker);
    },
  },
  {
    id: "vn:realtime:{ticker}:{timeframe}",
    ttlMs: 60_000,
    minIntervalMs: 5_000,
    source: "datahub:dnse-primary-fiinquant-fallback",
    version: "v1",
    tags: ["research", "realtime", "market"],
    match: (topicKey) => {
      const match = topicKey.match(/^vn:realtime:([A-Z0-9._-]{1,12}):(1m|5m|15m|30m)$/);
      return match ? { ok: true, params: { ticker: match[1], timeframe: match[2] } } : { ok: false };
    },
    resolve: async (_, __, params) => {
      const resolved = await assertValidTicker(params.ticker);
      const timeframe = REALTIME_TIMEFRAMES.has(params.timeframe) ? params.timeframe : "5m";
      return loadRealtimeTicker(resolved.ticker, timeframe);
    },
  },
  {
    id: "vn:depth:{ticker}",
    ttlMs: 15_000,
    minIntervalMs: 10_000,
    staleWhileRevalidateMs: 60_000,
    source: "datahub:dnse-primary-fiinquant-fallback",
    version: "v1",
    tags: ["research", "depth", "orderbook", "market"],
    match: (topicKey) => {
      const match = topicKey.match(/^vn:depth:([A-Z0-9._-]{1,12})$/);
      return match ? { ok: true, params: { ticker: match[1] } } : { ok: false };
    },
    resolve: async (_, __, params) => {
      const resolved = await assertValidTicker(params.ticker);
      return fetchMarketDepth(resolved.ticker);
    },
  },
  {
    id: "vn:board:{tickers}",
    ttlMs: 30_000,
    minIntervalMs: 15_000,
    staleWhileRevalidateMs: 90_000,
    source: "datahub:dnse-primary-fiinquant-fallback",
    version: "v1",
    tags: ["watchlist", "board", "market"],
    match: (topicKey) => {
      const match = topicKey.match(/^vn:board:([A-Z0-9._,-]{1,300})$/);
      return match ? { ok: true, params: { tickers: match[1] } } : { ok: false };
    },
    resolve: async (_, __, params) => {
      return loadMarketBoardForTickers(params.tickers);
    },
  },
  {
    id: "vn:investor:{ticker}",
    ttlMs: 60_000,
    minIntervalMs: 15_000,
    source: "datahub:dnse-primary-fiinquant-fallback",
    version: "v1",
    tags: ["research", "investor-flow"],
    match: (topicKey) => {
      const match = topicKey.match(/^vn:investor:([A-Z0-9._-]{1,12})$/);
      return match ? { ok: true, params: { ticker: match[1] } } : { ok: false };
    },
    resolve: async (_, __, params) => {
      const resolved = await assertValidTicker(params.ticker);
      return loadRealtimeTicker(resolved.ticker, "5m");
    },
  },
  {
    id: "news:ticker:{ticker}",
    ttlMs: 300_000,
    minIntervalMs: 30_000,
    source: "datahub:dnse-primary-fiinquant-fallback",
    version: "v1",
    tags: ["news", "research", "workbench"],
    match: (topicKey) => {
      const match = topicKey.match(/^news:ticker:([A-Z0-9._-]{1,12})$/);
      return match ? { ok: true, params: { ticker: match[1] } } : { ok: false };
    },
    resolve: async (_, __, params) => {
      const resolved = await assertValidTicker(params.ticker);
      return loadTickerNews(resolved.ticker);
    },
  },
  {
    id: "signal:leader-radar",
    ttlMs: 300_000,
    minIntervalMs: 60_000,
    source: "fiinquant",
    version: "v1",
    tags: ["signal", "dashboard", "leader-radar"],
    match: (topicKey) => (topicKey === "signal:leader-radar" ? { ok: true } : { ok: false }),
    resolve: async () => loadLeaderRadar(),
  },
  {
    id: "vn:historical:{ticker}:1d",
    ttlMs: 300_000,
    minIntervalMs: 60_000,
    source: "datahub:dnse-primary-fiinquant-fallback",
    version: "v1",
    tags: ["research", "historical", "market"],
    match: (topicKey) => {
      const match = topicKey.match(/^vn:historical:([A-Z0-9._-]{1,12}):1d$/);
      return match ? { ok: true, params: { ticker: match[1] } } : { ok: false };
    },
    resolve: async (_, __, params) => {
      const resolved = await assertValidTicker(params.ticker);
      return loadHistoricalTickerWithMarketClose(resolved.ticker);
    },
  },
  {
    id: "signal:ticker:{ticker}",
    ttlMs: 60_000,
    minIntervalMs: 10_000,
    source: "db:signal",
    version: "v1",
    tags: ["signal", "research", "workbench"],
    match: (topicKey) => {
      const match = topicKey.match(/^signal:ticker:([A-Z0-9._-]{1,12})$/);
      return match ? { ok: true, params: { ticker: match[1] } } : { ok: false };
    },
    resolve: async (_, __, params) => {
      const resolved = await assertValidTicker(params.ticker);
      return loadSignalForTicker(resolved.ticker);
    },
  },
  {
    id: "research:workbench:{ticker}",
    ttlMs: 120_000,
    minIntervalMs: 15_000,
    source: "aggregator:workbench",
    version: "v1",
    tags: ["research", "workbench"],
    match: (topicKey) => {
      const match = topicKey.match(/^research:workbench:([A-Z0-9._-]{1,12})$/);
      return match ? { ok: true, params: { ticker: match[1] } } : { ok: false };
    },
    resolve: async (topicKey) => loadResearchWorkbench(topicKey),
  },
  {
    id: "broker:dnse:{userId}:{accountId}:positions",
    ttlMs: 45_000,
    minIntervalMs: 10_000,
    source: "broker-sync",
    version: "v2",
    access: "private",
    cacheScope: "user",
    tags: ["broker", "dnse", "private", "positions", "canonical-v2"],
    match: (topicKey) => {
      const match = topicKey.match(/^broker:dnse:([A-Za-z0-9_-]+):([A-Za-z0-9_-]+):positions$/);
      return match ? { ok: true, params: { userId: match[1], accountId: match[2], channel: "positions" } } : { ok: false };
    },
    resolve: async (_, context, params) =>
      loadBrokerTopicForUserAccount(params.userId, params.accountId, "positions", context),
  },
  {
    id: "broker:dnse:{userId}:{accountId}:orders",
    ttlMs: 45_000,
    minIntervalMs: 10_000,
    source: "broker-sync",
    version: "v2",
    access: "private",
    cacheScope: "user",
    tags: ["broker", "dnse", "private", "orders", "canonical-v2"],
    match: (topicKey) => {
      const match = topicKey.match(/^broker:dnse:([A-Za-z0-9_-]+):([A-Za-z0-9_-]+):orders$/);
      return match ? { ok: true, params: { userId: match[1], accountId: match[2], channel: "orders" } } : { ok: false };
    },
    resolve: async (_, context, params) =>
      loadBrokerTopicForUserAccount(params.userId, params.accountId, "orders", context),
  },
  {
    id: "broker:dnse:{userId}:{accountId}:balance",
    ttlMs: 45_000,
    minIntervalMs: 10_000,
    source: "broker-sync",
    version: "v2",
    access: "private",
    cacheScope: "user",
    tags: ["broker", "dnse", "private", "balance", "canonical-v2"],
    match: (topicKey) => {
      const match = topicKey.match(/^broker:dnse:([A-Za-z0-9_-]+):([A-Za-z0-9_-]+):balance$/);
      return match ? { ok: true, params: { userId: match[1], accountId: match[2], channel: "balance" } } : { ok: false };
    },
    resolve: async (_, context, params) =>
      loadBrokerTopicForUserAccount(params.userId, params.accountId, "balance", context),
  },
  {
    id: "broker:dnse:{userId}:{accountId}:holdings",
    ttlMs: 45_000,
    minIntervalMs: 10_000,
    source: "broker-sync",
    version: "v2",
    access: "private",
    cacheScope: "user",
    tags: ["broker", "dnse", "private", "holdings", "canonical-v2"],
    match: (topicKey) => {
      const match = topicKey.match(/^broker:dnse:([A-Za-z0-9_-]+):([A-Za-z0-9_-]+):holdings$/);
      return match ? { ok: true, params: { userId: match[1], accountId: match[2], channel: "holdings" } } : { ok: false };
    },
    resolve: async (_, context, params) =>
      loadBrokerTopicForUserAccount(params.userId, params.accountId, "holdings", context),
  },
  {
    id: "broker:dnse:{connectionId}:positions",
    ttlMs: 45_000,
    minIntervalMs: 10_000,
    source: "broker-sync",
    version: "v1",
    access: "private",
    cacheScope: "user",
    tags: ["broker", "dnse", "private", "positions"],
    match: (topicKey) => {
      const match = topicKey.match(/^broker:dnse:(?!current-user:)([A-Za-z0-9_-]+):positions$/);
      return match ? { ok: true, params: { connectionId: match[1], channel: "positions" } } : { ok: false };
    },
    resolve: async (_, context, params) => loadBrokerTopic(params.connectionId, "positions", context),
  },
  {
    id: "broker:dnse:{connectionId}:orders",
    ttlMs: 45_000,
    minIntervalMs: 10_000,
    source: "broker-sync",
    version: "v1",
    access: "private",
    cacheScope: "user",
    tags: ["broker", "dnse", "private", "orders"],
    match: (topicKey) => {
      const match = topicKey.match(/^broker:dnse:(?!current-user:)([A-Za-z0-9_-]+):orders$/);
      return match ? { ok: true, params: { connectionId: match[1], channel: "orders" } } : { ok: false };
    },
    resolve: async (_, context, params) => loadBrokerTopic(params.connectionId, "orders", context),
  },
  {
    id: "broker:dnse:{connectionId}:balance",
    ttlMs: 45_000,
    minIntervalMs: 10_000,
    source: "broker-sync",
    version: "v1",
    access: "private",
    cacheScope: "user",
    tags: ["broker", "dnse", "private", "balance"],
    match: (topicKey) => {
      const match = topicKey.match(/^broker:dnse:(?!current-user:)([A-Za-z0-9_-]+):balance$/);
      return match ? { ok: true, params: { connectionId: match[1], channel: "balance" } } : { ok: false };
    },
    resolve: async (_, context, params) => loadBrokerTopic(params.connectionId, "balance", context),
  },
  {
    id: "broker:dnse:{connectionId}:holdings",
    ttlMs: 45_000,
    minIntervalMs: 10_000,
    source: "broker-sync",
    version: "v1",
    access: "private",
    cacheScope: "user",
    tags: ["broker", "dnse", "private", "holdings"],
    match: (topicKey) => {
      const match = topicKey.match(/^broker:dnse:(?!current-user:)([A-Za-z0-9_-]+):holdings$/);
      return match ? { ok: true, params: { connectionId: match[1], channel: "holdings" } } : { ok: false };
    },
    resolve: async (_, context, params) => loadBrokerTopic(params.connectionId, "holdings", context),
  },
  {
    id: "broker:dnse:{connectionId}:accounts",
    ttlMs: 120_000,
    minIntervalMs: 20_000,
    source: "broker-sync",
    version: "v1",
    access: "private",
    cacheScope: "user",
    tags: ["broker", "dnse", "private", "accounts"],
    match: (topicKey) => {
      const match = topicKey.match(/^broker:dnse:(?!current-user:)([A-Za-z0-9_-]+):accounts$/);
      return match ? { ok: true, params: { connectionId: match[1], channel: "accounts" } } : { ok: false };
    },
    resolve: async (_, context, params) => loadBrokerTopic(params.connectionId, "accounts", context),
  },
  {
    id: "broker:dnse:{connectionId}:loan-packages",
    ttlMs: 900_000,
    minIntervalMs: 60_000,
    source: "broker-sync",
    version: "v1",
    access: "private",
    cacheScope: "user",
    tags: ["broker", "dnse", "private", "margin", "loan"],
    match: (topicKey) => {
      const match = topicKey.match(/^broker:dnse:(?!current-user:)([A-Za-z0-9_-]+):loan-packages$/);
      return match ? { ok: true, params: { connectionId: match[1], channel: "loan-packages" } } : { ok: false };
    },
    resolve: async (_, context, params) =>
      loadBrokerTopic(params.connectionId, "loan-packages", context),
  },
  {
    id: "broker:dnse:{connectionId}:order-history",
    ttlMs: 120_000,
    minIntervalMs: 20_000,
    source: "broker-sync",
    version: "v1",
    access: "private",
    cacheScope: "user",
    tags: ["broker", "dnse", "private", "order-history"],
    match: (topicKey) => {
      const match = topicKey.match(/^broker:dnse:(?!current-user:)([A-Za-z0-9_-]+):order-history$/);
      return match ? { ok: true, params: { connectionId: match[1], channel: "order-history" } } : { ok: false };
    },
    resolve: async (_, context, params) => loadBrokerTopic(params.connectionId, "order-history", context),
  },
  {
    id: "broker:dnse:{connectionId}:ppse:{symbol}",
    ttlMs: 15_000,
    minIntervalMs: 5_000,
    source: "broker-sync",
    version: "v1",
    access: "private",
    cacheScope: "user",
    tags: ["broker", "dnse", "private", "ppse"],
    match: (topicKey) => {
      const match = topicKey.match(/^broker:dnse:(?!current-user:)([A-Za-z0-9_-]+):ppse:([A-Z0-9._-]{1,12})$/);
      return match
        ? {
            ok: true,
            params: {
              connectionId: match[1],
              channel: "ppse",
              symbol: match[2],
            },
          }
        : { ok: false };
    },
    resolve: async (_, context, params) =>
      loadBrokerTopic(params.connectionId, "ppse", context, { symbol: params.symbol }),
  },
  {
    id: "broker:dnse:current-user:positions",
    ttlMs: 45_000,
    minIntervalMs: 10_000,
    source: "broker-sync",
    version: "v1",
    access: "private",
    cacheScope: "user",
    tags: ["broker", "dnse", "private", "positions", "legacy-alias"],
    match: (topicKey) => (topicKey === "broker:dnse:current-user:positions" ? { ok: true } : { ok: false }),
    resolve: async (_, context) => {
      return loadCurrentUserBrokerTopic("positions", context);
    },
  },
  {
    id: "broker:dnse:current-user:orders",
    ttlMs: 45_000,
    minIntervalMs: 10_000,
    source: "broker-sync",
    version: "v1",
    access: "private",
    cacheScope: "user",
    tags: ["broker", "dnse", "private", "orders", "legacy-alias"],
    match: (topicKey) => (topicKey === "broker:dnse:current-user:orders" ? { ok: true } : { ok: false }),
    resolve: async (_, context) => {
      return loadCurrentUserBrokerTopic("orders", context);
    },
  },
  {
    id: "broker:dnse:current-user:balance",
    ttlMs: 45_000,
    minIntervalMs: 10_000,
    source: "broker-sync",
    version: "v1",
    access: "private",
    cacheScope: "user",
    tags: ["broker", "dnse", "private", "balance", "legacy-alias"],
    match: (topicKey) => (topicKey === "broker:dnse:current-user:balance" ? { ok: true } : { ok: false }),
    resolve: async (_, context) => {
      return loadCurrentUserBrokerTopic("balance", context);
    },
  },
  {
    id: "broker:dnse:current-user:holdings",
    ttlMs: 45_000,
    minIntervalMs: 10_000,
    source: "broker-sync",
    version: "v1",
    access: "private",
    cacheScope: "user",
    tags: ["broker", "dnse", "private", "holdings", "legacy-alias"],
    match: (topicKey) => (topicKey === "broker:dnse:current-user:holdings" ? { ok: true } : { ok: false }),
    resolve: async (_, context) => {
      return loadCurrentUserBrokerTopic("holdings", context);
    },
  },
  {
    id: "broker:dnse:current-user:accounts",
    ttlMs: 120_000,
    minIntervalMs: 20_000,
    source: "broker-sync",
    version: "v1",
    access: "private",
    cacheScope: "user",
    tags: ["broker", "dnse", "private", "accounts", "legacy-alias"],
    match: (topicKey) => (topicKey === "broker:dnse:current-user:accounts" ? { ok: true } : { ok: false }),
    resolve: async (_, context) => {
      return loadCurrentUserBrokerTopic("accounts", context);
    },
  },
  {
    id: "broker:dnse:current-user:loan-packages",
    ttlMs: 900_000,
    minIntervalMs: 60_000,
    source: "broker-sync",
    version: "v1",
    access: "private",
    cacheScope: "user",
    tags: ["broker", "dnse", "private", "margin", "loan", "legacy-alias"],
    match: (topicKey) =>
      topicKey === "broker:dnse:current-user:loan-packages" ? { ok: true } : { ok: false },
    resolve: async (_, context) => {
      return loadCurrentUserBrokerTopic("loan-packages", context);
    },
  },
  {
    id: "broker:dnse:current-user:order-history",
    ttlMs: 120_000,
    minIntervalMs: 20_000,
    source: "broker-sync",
    version: "v1",
    access: "private",
    cacheScope: "user",
    tags: ["broker", "dnse", "private", "order-history", "legacy-alias"],
    match: (topicKey) =>
      topicKey === "broker:dnse:current-user:order-history" ? { ok: true } : { ok: false },
    resolve: async (_, context) => {
      return loadCurrentUserBrokerTopic("order-history", context);
    },
  },
  {
    id: "broker:dnse:current-user:ppse:{symbol}",
    ttlMs: 15_000,
    minIntervalMs: 5_000,
    source: "broker-sync",
    version: "v1",
    access: "private",
    cacheScope: "user",
    tags: ["broker", "dnse", "private", "ppse", "legacy-alias"],
    match: (topicKey) => {
      const match = topicKey.match(/^broker:dnse:current-user:ppse:([A-Z0-9._-]{1,12})$/);
      return match ? { ok: true, params: { symbol: match[1] } } : { ok: false };
    },
    resolve: async (_, context, params) => {
      return loadCurrentUserBrokerTopic("ppse", context, { symbol: params.symbol });
    },
  },
  {
    id: "research:rs-rating:list",
    ttlMs: 900_000,
    minIntervalMs: 60_000,
    source: "api:rs-rating",
    version: "v1",
    tags: ["research", "rs-rating", "fiinquant", "legacy-alias"],
    match: (topicKey) =>
      ["research:rs-rating:list", "market:rs:latest", "scan:rs-rating:list"].includes(topicKey)
        ? { ok: true }
        : { ok: false },
    resolve: async (_, context) => loadDatabaseV2RankTopic(context.force === true),
  },
  {
    id: "research:rank:stocks:history",
    ttlMs: 900_000,
    minIntervalMs: 60_000,
    staleWhileRevalidateMs: 900_000,
    source: "database:rank-history",
    version: "v1",
    tags: ["research", "rank", "history"],
    match: (topicKey) => (topicKey === "research:rank:stocks:history" ? { ok: true } : { ok: false }),
    resolve: async () => loadRankStocksHistory(),
  },
  {
    id: "research:rank:sectors:history",
    ttlMs: 900_000,
    minIntervalMs: 60_000,
    staleWhileRevalidateMs: 900_000,
    source: "database:rank-sector-history",
    version: "v1",
    tags: ["research", "rank", "history", "sector"],
    match: (topicKey) => (topicKey === "research:rank:sectors:history" ? { ok: true } : { ok: false }),
    resolve: async () => loadRankSectorsHistory(),
  },
];

export function resolveTopicDefinition(topicKey: string): {
  definition: TopicDefinition;
  params: Record<string, string>;
} | null {
  for (const definition of TOPIC_DEFINITIONS) {
    const matched = definition.match(topicKey);
    if (matched.ok) {
      return {
        definition,
        params: matched.params ?? {},
      };
    }
  }
  return null;
}

export function listTopicDefinitions() {
  return TOPIC_DEFINITIONS.map((definition) => ({
    id: definition.id,
    ttlMs: definition.ttlMs,
    minIntervalMs: definition.minIntervalMs,
    staleWhileRevalidateMs: resolveTopicStaleWindowMs(definition),
    family: resolveTopicFamily(definition),
    access: definition.access ?? "public",
    cacheScope: definition.cacheScope ?? "global",
    source: definition.source,
    version: definition.version,
    tags: definition.tags,
  }));
}

export { buildTopicContext } from "./producer-context";
