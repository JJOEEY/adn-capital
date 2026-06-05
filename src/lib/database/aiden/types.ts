import type { DatabaseNewsItem } from "@/lib/database/providers/news";

export type DatabaseAidenMarketContext = {
  tradingDate: string;
  previousTradingDate: string | null;
  indices: Array<{
    ticker: string;
    value: number | null;
    change: number | null;
    changePct: number | null;
    volume: number | null;
    updatedAt: string | null;
  }>;
  breadth: {
    up: number | null;
    down: number | null;
    unchanged: number | null;
    ceiling: number | null;
    floor: number | null;
  } | null;
  liquidity: {
    matchedValue: number | null;
    matchedVolume: number | null;
    negotiatedValue: number | null;
    negotiatedVolume: number | null;
  } | null;
  foreignFlow: {
    buyValue: number | null;
    sellValue: number | null;
    netValue: number | null;
  } | null;
  investorFlow: {
    propTradingTopBuy: string[];
    propTradingTopSell: string[];
    individualTopBuy: string[];
    individualTopSell: string[];
  } | null;
};

export type DatabaseAidenMetric = {
  value: number;
  display: string;
};

export type DatabaseAidenTechnicalContext = {
  ma20: number | null;
  ma50: number | null;
  ma200: number | null;
  rsi: number | null;
  macdHistogram: number | null;
  volumeMa20: number | null;
  support: number | null;
  resistance: number | null;
  updatedAt: string | null;
};

export type DatabaseAidenFundamentalContext = {
  financialPeriod: {
    reportPeriod: string | null;
    periodEnd: string | null;
    reportDate: string | null;
    updatedAt: string | null;
    eps: DatabaseAidenMetric | null;
    bvps: DatabaseAidenMetric | null;
    roe: DatabaseAidenMetric | null;
    roa: DatabaseAidenMetric | null;
  } | null;
  valuation: {
    valuationDate: string | null;
    updatedAt: string | null;
    pe: DatabaseAidenMetric | null;
    pb: DatabaseAidenMetric | null;
  } | null;
  profile: {
    companyName: string | null;
    industry: string | null;
    exchange: string | null;
    updatedAt: string | null;
  } | null;
};

export type DatabaseAidenMissingFieldGroups = {
  quote: string[];
  ohlcv: string[];
  technical: string[];
  fundamental: string[];
  profile: string[];
};

export type DatabaseAidenDataSources = {
  quote: string[];
  ohlcv: string[];
  technical: string[];
  fundamental: string[];
  profile: string[];
  reference: string[];
  blockedLegacy: string[];
};

export type DatabaseAidenDataFreshness = {
  quoteAsOf: string | null;
  ohlcvLatestDate: string | null;
  technicalAsOf: string | null;
  financialReportPeriod: string | null;
  financialPeriodEnd: string | null;
  valuationDate: string | null;
  contextFetchedAt: string;
};

export type DatabaseAidenTickerContext = {
  ticker: string;
  market: {
    price: number | null;
    reference: number | null;
    change: number | null;
    changePct: number | null;
    volume: number | null;
    value: number | null;
    updatedAt: string | null;
    tradingDate: string | null;
  };
  dailyOhlcv: {
    open: number | null;
    high: number | null;
    low: number | null;
    close: number | null;
    volume: number | null;
    value: number | null;
    updatedAt: string | null;
  } | null;
  technical: DatabaseAidenTechnicalContext | null;
  fundamental: DatabaseAidenFundamentalContext;
  relatedNews: DatabaseNewsItem[];
  missingFields: string[];
  missingFieldGroups: DatabaseAidenMissingFieldGroups;
  dataSources: DatabaseAidenDataSources;
  dataFreshness: DatabaseAidenDataFreshness;
};

export type DatabaseAidenContext = {
  generatedAt: string;
  format: "database-v2-aiden-context";
  market: DatabaseAidenMarketContext | null;
  news: {
    latest: DatabaseNewsItem[];
    market: DatabaseNewsItem[];
    macro: DatabaseNewsItem[];
    global: DatabaseNewsItem[];
  };
  tickers: DatabaseAidenTickerContext[];
  missingFields: string[];
};

export type DatabaseAidenHealth = {
  ok: boolean;
  status: "ok" | "degraded" | "blocked";
  checkedAt: string;
  sampleTickers: string[];
  missingFields: string[];
  checks: {
    market: {
      ok: boolean;
      requiredIndices: string[];
      availableIndices: string[];
    };
    news: {
      ok: boolean;
      latestCount: number;
      marketCount: number;
      macroCount: number;
      globalCount: number;
    };
    tickers: Array<{
      ticker: string;
      ok: boolean;
      hasPrice: boolean;
      hasOhlcv: boolean;
      newsCount: number;
      missingFields: string[];
    }>;
  };
};
