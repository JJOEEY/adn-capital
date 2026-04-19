import { NextRequest } from "next/server";
import { fetchRealtimeTradingData } from "@/lib/fiinquantClient";
import { getMarketSnapshot } from "@/lib/marketDataFetcher";
import { prisma } from "@/lib/prisma";
import { getPythonBridgeUrl } from "@/lib/runtime-config";
import { fetchFAData, fetchTAData } from "@/lib/stockData";
import { resolveMarketTicker } from "@/lib/ticker-resolver";
import { TopicContext, TopicDefinition } from "./types";

type JsonRecord = Record<string, unknown>;

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

async function loadNews(type: "morning" | "eod") {
  const mod = await import("@/app/api/market-news/route");
  const req = new NextRequest(`http://localhost/api/market-news?type=${type}`);
  const res = await mod.GET(req);
  if (!res.ok) throw new Error(`market-news ${type} HTTP ${res.status}`);
  return res.json();
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

async function loadSignalList(status: "RADAR" | "ACTIVE") {
  return prisma.signal.findMany({
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
  const row = await prisma.signal.findFirst({
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
  const backend = getPythonBridgeUrl();
  const res = await fetch(`${backend}/api/v1/news/${encodeURIComponent(ticker)}?limit=6`, {
    cache: "no-store",
    signal: AbortSignal.timeout(20_000),
  });
  if (!res.ok) return [];
  const payload = (await res.json()) as { items?: JsonRecord[]; news?: JsonRecord[] };
  return Array.isArray(payload.items) ? payload.items : Array.isArray(payload.news) ? payload.news : [];
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

async function loadHistoricalTicker(ticker: string) {
  const backend = getPythonBridgeUrl();
  const symbol = ticker.toUpperCase().trim();
  const res = await fetch(
    `${backend}/api/v1/historical/${encodeURIComponent(symbol)}?days=300&timeframe=1d`,
    {
      cache: "no-store",
      signal: AbortSignal.timeout(30_000),
    },
  );
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`historical ${symbol} HTTP ${res.status}: ${text}`);
  }
  return res.json();
}

async function loadAiCachesForTicker(ticker: string) {
  const [insight, ta, fa, tamly] = await Promise.all([
    prisma.aiInsightCache.findMany({
      where: { ticker },
      orderBy: { updatedAt: "desc" },
      take: 4,
      select: { tabType: true, content: true, updatedAt: true },
    }),
    prisma.aiTaCache.findFirst({
      where: { ticker },
      orderBy: { createdAt: "desc" },
      select: { analysis: true, createdAt: true },
    }),
    prisma.aiFaCache.findFirst({
      where: { ticker },
      orderBy: { createdAt: "desc" },
      select: { analysis: true, createdAt: true, quarter: true },
    }),
    prisma.aiTamlyCache.findFirst({
      where: { ticker },
      orderBy: { createdAt: "desc" },
      select: { analysis: true, createdAt: true, date: true },
    }),
  ]);

  return {
    insight,
    ta,
    fa,
    tamly,
  };
}

async function loadResearchWorkbench(topicKey: string) {
  const ticker = tickerFromTopic(topicKey, "research:workbench:");
  if (!ticker) throw new Error("Invalid ticker");
  const resolved = await assertValidTicker(ticker);
  const normalizedTicker = resolved.ticker;

  const [ta, fa, seasonality, investor, marketSnapshot, activeSignal, news, aiCaches] = await Promise.all([
    fetchTAData(normalizedTicker),
    fetchFAData(normalizedTicker),
    loadSeasonalityForTicker(normalizedTicker),
    fetchRealtimeTradingData(normalizedTicker, "5m"),
    getMarketSnapshot(),
    prisma.signal.findFirst({
      where: { ticker: normalizedTicker, status: { in: ["RADAR", "ACTIVE"] } },
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
    }),
    loadTickerNews(normalizedTicker),
    loadAiCachesForTicker(normalizedTicker),
  ]);

  return {
    ticker: normalizedTicker,
    market: {
      vnindex: marketSnapshot.indices.find((item) => item.ticker === "VNINDEX") ?? null,
      vn30: marketSnapshot.indices.find((item) => item.ticker === "VN30") ?? null,
      liquidity: marketSnapshot.liquidity,
      breadth: marketSnapshot.breadth,
      investorTrading: marketSnapshot.investorTrading,
    },
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

async function loadBrokerTopic(connectionId: string, channel: "positions" | "orders" | "balance" | "holdings", context: TopicContext) {
  if (!context.userId) {
    throw new Error("Unauthorized private broker topic");
  }

  const currentUser = await prisma.user.findUnique({
    where: { id: context.userId },
    select: { dnseId: true, dnseVerified: true },
  });

  const allowedConnectionId = currentUser?.dnseId?.trim() || null;
  if (!allowedConnectionId || connectionId !== allowedConnectionId) {
    throw new Error("Broker connection not found for current user");
  }

  const activeSignals = await loadSignalList("ACTIVE");
  const positions = activeSignals.map((row) => ({
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

  if (channel === "positions") {
    return {
      connected: Boolean(currentUser?.dnseId && currentUser?.dnseVerified),
      connectionId,
      source: "internal-merged",
      positions,
    };
  }

  if (channel === "orders") {
    return {
      connected: Boolean(currentUser?.dnseId && currentUser?.dnseVerified),
      connectionId,
      source: "internal-stub",
      orders: [],
    };
  }

  if (channel === "balance") {
    const navAllocatedPct = positions.reduce((sum, row) => sum + (row.navAllocation ?? 0), 0);
    return {
      connected: Boolean(currentUser?.dnseId && currentUser?.dnseVerified),
      connectionId,
      source: "internal-estimate",
      navAllocatedPct: Number(navAllocatedPct.toFixed(2)),
      navRemainingPct: Number(Math.max(0, 100 - navAllocatedPct).toFixed(2)),
      maxActiveNavPct: 90,
    };
  }

  return {
    connected: Boolean(currentUser?.dnseId && currentUser?.dnseVerified),
    connectionId,
    source: "internal-merged",
    holdings: positions,
  };
}

async function resolveCurrentBrokerConnectionId(userId: string): Promise<string> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { dnseId: true, dnseVerified: true },
  });
  const connectionId = user?.dnseId?.trim() ?? "";
  if (!connectionId || !user?.dnseVerified) {
    throw new Error("DNSE connection is not verified for current user");
  }
  return connectionId;
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
      };
    },
  },
  {
    id: "news:morning:latest",
    ttlMs: 300_000,
    minIntervalMs: 30_000,
    source: "api:market-news",
    version: "v1",
    tags: ["news", "brief", "dashboard"],
    match: (topicKey) => (topicKey === "news:morning:latest" ? { ok: true } : { ok: false }),
    resolve: async () => loadNews("morning"),
  },
  {
    id: "brief:morning:latest",
    ttlMs: 300_000,
    minIntervalMs: 30_000,
    source: "api:market-news",
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
    ttlMs: 300_000,
    minIntervalMs: 30_000,
    source: "api:market-news",
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
    resolve: async () => {
      const row = await prisma.marketReport.findFirst({
        where: { type: "close_brief_15h" },
        orderBy: { createdAt: "desc" },
        select: { id: true, type: true, title: true, content: true, rawData: true, metadata: true, createdAt: true },
      });
      if (!row) return null;
      return { ...row, rawData: safeParseJson(row.rawData), metadata: safeParseJson(row.metadata) };
    },
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
    minIntervalMs: 30_000,
    source: "db:market-report",
    version: "v1",
    tags: ["brief", "eod-brief", "public"],
    match: (topicKey) => (topicKey === "brief:eod:latest" ? { ok: true } : { ok: false }),
    resolve: async () => {
      const row = await prisma.marketReport.findFirst({
        where: { type: "eod_full_19h" },
        orderBy: { createdAt: "desc" },
        select: { id: true, type: true, title: true, content: true, rawData: true, metadata: true, createdAt: true },
      });
      if (!row) return null;
      return { ...row, rawData: safeParseJson(row.rawData), metadata: safeParseJson(row.metadata) };
    },
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
    id: "vn:ta:{ticker}",
    ttlMs: 120_000,
    minIntervalMs: 15_000,
    source: "vndirect",
    version: "v1",
    tags: ["research", "ta"],
    match: (topicKey) => {
      const match = topicKey.match(/^vn:ta:([A-Z0-9._-]{1,12})$/);
      return match ? { ok: true, params: { ticker: match[1] } } : { ok: false };
    },
    resolve: async (_, __, params) => {
      const resolved = await assertValidTicker(params.ticker);
      return fetchTAData(resolved.ticker);
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
      return fetchFAData(resolved.ticker);
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
    id: "vn:realtime:{ticker}:5m",
    ttlMs: 60_000,
    minIntervalMs: 10_000,
    source: "fiinquant",
    version: "v1",
    tags: ["research", "realtime", "market"],
    match: (topicKey) => {
      const match = topicKey.match(/^vn:realtime:([A-Z0-9._-]{1,12}):5m$/);
      return match ? { ok: true, params: { ticker: match[1] } } : { ok: false };
    },
    resolve: async (_, __, params) => {
      const resolved = await assertValidTicker(params.ticker);
      return fetchRealtimeTradingData(resolved.ticker, "5m");
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
      return fetchRealtimeTradingData(resolved.ticker, "5m");
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
    id: "broker:dnse:{connectionId}:positions",
    ttlMs: 45_000,
    minIntervalMs: 10_000,
    source: "broker-sync",
    version: "v1",
    access: "private",
    cacheScope: "user",
    tags: ["broker", "dnse", "private", "positions"],
    match: (topicKey) => {
      const match = topicKey.match(/^broker:dnse:([A-Za-z0-9_-]+):positions$/);
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
      const match = topicKey.match(/^broker:dnse:([A-Za-z0-9_-]+):orders$/);
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
      const match = topicKey.match(/^broker:dnse:([A-Za-z0-9_-]+):balance$/);
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
      const match = topicKey.match(/^broker:dnse:([A-Za-z0-9_-]+):holdings$/);
      return match ? { ok: true, params: { connectionId: match[1], channel: "holdings" } } : { ok: false };
    },
    resolve: async (_, context, params) => loadBrokerTopic(params.connectionId, "holdings", context),
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
      if (!context.userId) throw new Error("Unauthorized user topic");
      const connectionId = await resolveCurrentBrokerConnectionId(context.userId);
      return loadBrokerTopic(connectionId, "positions", context);
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
      if (!context.userId) throw new Error("Unauthorized user topic");
      const connectionId = await resolveCurrentBrokerConnectionId(context.userId);
      return loadBrokerTopic(connectionId, "orders", context);
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
      if (!context.userId) throw new Error("Unauthorized user topic");
      const connectionId = await resolveCurrentBrokerConnectionId(context.userId);
      return loadBrokerTopic(connectionId, "balance", context);
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
      if (!context.userId) throw new Error("Unauthorized user topic");
      const connectionId = await resolveCurrentBrokerConnectionId(context.userId);
      return loadBrokerTopic(connectionId, "holdings", context);
    },
  },
  {
    id: "scan:rs-rating:list",
    ttlMs: 900_000,
    minIntervalMs: 60_000,
    source: "api:rs-rating",
    version: "v1",
    tags: ["research", "rs-rating"],
    match: (topicKey) => (topicKey === "scan:rs-rating:list" ? { ok: true } : { ok: false }),
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
    staleWhileRevalidateMs: definition.staleWhileRevalidateMs ?? 0,
    access: definition.access ?? "public",
    cacheScope: definition.cacheScope ?? "global",
    source: definition.source,
    version: definition.version,
    tags: definition.tags,
  }));
}

export { buildTopicContext } from "./producer-context";
