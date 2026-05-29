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
    activeTopBuy?: string[];
    activeTopSell?: string[];
    source?: "fiinquant" | "vnstock";
  } | null;
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
  relatedNews: DatabaseNewsItem[];
  missingFields: string[];
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
