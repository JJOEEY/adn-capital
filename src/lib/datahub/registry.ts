import { NextRequest } from "next/server";
import { fetchMarketBoard, fetchMarketDepth, fetchRealtimeTradingData } from "@/lib/fiinquantClient";
import { getMarketSnapshot } from "@/lib/marketDataFetcher";
import { prisma } from "@/lib/prisma";
import { getPythonBridgeUrl } from "@/lib/runtime-config";
import { fetchFAData, fetchTAData, type FAData, type TAData } from "@/lib/stockData";
import { resolveMarketTicker } from "@/lib/ticker-resolver";
import { listDnseOrderHistory } from "@/lib/brokers/dnse/order-history";
import { decryptDnseToken } from "@/lib/brokers/dnse/crypto";
import { getDnseTradingClient } from "@/lib/providers/dnse/trading-client";
import type { SignalScanArtifact } from "@/lib/signals/ingest";
import { loadReportedSignalSummary } from "@/lib/signals/report-history";
import { normalizeSignalPrice } from "@/lib/signals/price-units";
import {
  applyMarketPriceScale,
  chooseMarketDisplayPrice,
  getMarketPayloadRows,
  latestClosePriceFromPayload,
  latestTurnoverPriceFromPayload,
  marketPriceScaleFromPayload,
  normalizeHistoricalPricePayload,
} from "@/lib/market-price-normalization";
import { resolveTopicFamily, resolveTopicStaleWindowMs } from "./policy";
import { TopicContext, TopicDefinition } from "./types";

type JsonRecord = Record<string, unknown>;
type PersistedSignalScanArtifact = SignalScanArtifact & {
  cronLogId: string;
  persistedAt: Date;
};

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
  const res = await mod.GET();
  if (!res.ok) throw new Error(`market-overview HTTP ${res.status}`);
  return res.json();
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

async function loadRsRatingList() {
  const mod = await import("@/app/api/rs-rating/route");
  const res = await mod.GET();
  if (!res.ok) throw new Error(`rs-rating HTTP ${res.status}`);
  return res.json();
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
  const board = await fetchMarketBoard(tickers);
  return {
    tickers,
    prices: board?.prices ?? {},
    source: "VNStock price_board via FiinQuant Bridge",
    updatedAt: new Date().toISOString(),
  };
}

async function loadSignalList(status: "RADAR" | "ACTIVE") {
  const rows = await prisma.signal.findMany({
    where: { status },
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

  return rows.map((row) => ({
    ...row,
    entryPrice: normalizeSignalPrice(row.entryPrice),
    currentPrice: normalizeSignalPrice(row.currentPrice),
    target: normalizeSignalPrice(row.target),
    stoploss: normalizeSignalPrice(row.stoploss),
  }));
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
  const [portfolio, radar, chats] = await Promise.all([
    loadPortfolioSignalsForUser(userId),
    loadSignalList("RADAR"),
    prisma.chat.findMany({
      where: { userId },
      orderBy: { createdAt: "desc" },
      take: 50,
      select: { message: true },
    }),
  ]);

  const tickers = new Set<string>();
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
  const attempts = [
    { days: 260, timeout: 45_000 },
    { days: 180, timeout: 35_000 },
    { days: 90, timeout: 25_000 },
  ];
  let lastError: unknown = null;

  for (const attempt of attempts) {
    try {
      const payload = await loadBridgeHistoricalTicker(ticker, "1d", attempt.days, attempt.timeout);
      if (hasCandleRows(payload)) return payload;
    } catch (error) {
      lastError = error;
      console.warn(`[DataHub market] historical ${ticker} ${attempt.days}d unavailable:`, error);
    }
  }

  throw lastError instanceof Error ? lastError : new Error(`historical ${ticker} unavailable`);
}

function hasCandleRows(payload: unknown) {
  return getMarketPayloadRows(payload).length > 0;
}

async function loadRealtimeTicker(ticker: string, timeframe: string) {
  const realtime = await fetchRealtimeTradingData(ticker, timeframe, 5_000);
  const normalizedRealtime = normalizeHistoricalPricePayload(realtime);
  if (hasCandleRows(normalizedRealtime)) return normalizedRealtime;

  const historicalIntraday = await loadBridgeHistoricalTicker(ticker, timeframe, 30, 30_000).catch(() => null);
  if (hasCandleRows(historicalIntraday)) return historicalIntraday;

  return normalizedRealtime;
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

  const [taRaw, faRaw, seasonality, investor, marketSnapshot, activeSignal, news, aiCaches, art, historical] = await Promise.all([
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
  ]);
  const recentClose = latestClosePriceFromPayload(historical);
  const ta = normalizeTAWithHistorical(taRaw, historical, recentClose);
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

const TOPIC_DEFINITIONS: TopicDefinition[] = [
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
    source: "aggregator:marketDataFetcher",
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
    id: "news:morning:latest",
    ttlMs: 6 * 60 * 60 * 1000,
    minIntervalMs: 60_000,
    staleWhileRevalidateMs: 24 * 60 * 60 * 1000,
    source: "db:market-report",
    version: "v1",
    tags: ["news", "brief", "dashboard"],
    match: (topicKey) => (topicKey === "news:morning:latest" ? { ok: true } : { ok: false }),
    resolve: async () => loadNews("morning"),
  },
  {
    id: "brief:morning:latest",
    ttlMs: 6 * 60 * 60 * 1000,
    minIntervalMs: 60_000,
    staleWhileRevalidateMs: 24 * 60 * 60 * 1000,
    source: "db:market-report",
    version: "v1",
    tags: ["brief", "morning-brief", "public"],
    match: (topicKey) => (topicKey === "brief:morning:latest" ? { ok: true } : { ok: false }),
    resolve: async () => loadNews("morning"),
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
    ttlMs: 6 * 60 * 60 * 1000,
    minIntervalMs: 60_000,
    staleWhileRevalidateMs: 24 * 60 * 60 * 1000,
    source: "db:market-report",
    version: "v1",
    tags: ["news", "brief", "dashboard"],
    match: (topicKey) => (topicKey === "news:eod:latest" ? { ok: true } : { ok: false }),
    resolve: async () => loadNews("eod"),
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
    ttlMs: 6 * 60 * 60 * 1000,
    minIntervalMs: 60_000,
    staleWhileRevalidateMs: 24 * 60 * 60 * 1000,
    source: "db:market-report",
    version: "v1",
    tags: ["brief", "eod-brief", "news", "dashboard", "public"],
    match: (topicKey) => (topicKey === "brief:eod:latest" ? { ok: true } : { ok: false }),
    resolve: async () => loadNews("eod"),
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
    ttlMs: 60_000,
    minIntervalMs: 10_000,
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
    ttlMs: 30_000,
    minIntervalMs: 10_000,
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
    id: "vn:ta:{ticker}",
    ttlMs: 120_000,
    minIntervalMs: 15_000,
    source: "fiinquant",
    version: "v1",
    tags: ["research", "ta"],
    match: (topicKey) => {
      const match = topicKey.match(/^vn:ta:([A-Z0-9._-]{1,12})$/);
      return match ? { ok: true, params: { ticker: match[1] } } : { ok: false };
    },
    resolve: async (_, __, params) => {
      const resolved = await assertValidTicker(params.ticker);
      const [ta, historical] = await Promise.all([
        fetchTAData(resolved.ticker),
        loadHistoricalTicker(resolved.ticker).catch(() => null),
      ]);
      const recentClose = latestClosePriceFromPayload(historical);
      return normalizeTAWithHistorical(ta, historical, recentClose);
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
    source: "fiinquant",
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
    source: "fiinquant:vnstock-price-board",
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
    source: "fiinquant:vnstock-price-board",
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
    source: "fiinquant",
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
    source: "fiinquant",
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
    source: "fiinquant",
    version: "v1",
    tags: ["research", "historical", "market"],
    match: (topicKey) => {
      const match = topicKey.match(/^vn:historical:([A-Z0-9._-]{1,12}):1d$/);
      return match ? { ok: true, params: { ticker: match[1] } } : { ok: false };
    },
    resolve: async (_, __, params) => {
      const resolved = await assertValidTicker(params.ticker);
      return loadHistoricalTicker(resolved.ticker);
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
    resolve: async () => loadRsRatingList(),
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
