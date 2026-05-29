export type DnseInstrument = {
  symbol: string;
  marketId: string | null;
  securityGroupId: string | null;
  symbolType: string | null;
  shortName: string | null;
  name: string | null;
  indexName: string | null;
};

export type DnseOhlcvRow = {
  date: string;
  timestamp: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
};

export type DnseOhlcv = {
  ticker: string;
  timeframe: string;
  marketType: "STOCK" | "INDEX";
  rows: DnseOhlcvRow[];
};

export type DnseRealtimeQuote = {
  ticker: string;
  price: number | null;
  reference: number | null;
  change: number | null;
  changePct: number | null;
  volume: number | null;
  sourceChannel: "dnse-ws";
  updatedAt: string | null;
};

export type DnseBoard = {
  prices: Record<string, DnseRealtimeQuote>;
};

export type DnseIndexValue = {
  ticker: "VNINDEX" | "VN30" | "VN30F1M" | "HNXINDEX" | "HNX30" | "UPCOMINDEX";
  value: number | null;
  change: number | null;
  changePct: number | null;
  volume: number | null;
  date: string | null;
};

export type DnseWebsocketStatus = {
  opened: boolean;
  authenticated: boolean;
  subscribedChannels: string[];
  symbols: string[];
  messageCount: number;
  sampleTypes: string[];
  errors: string[];
};

export type DnseEodFieldSource =
  | "dnse_ws"
  | "computed_from_dnse_ws"
  | "fiinquant_enrichment"
  | "vnstock_enrichment"
  | "adn_computed";

export type DnseEodFieldMapItem = {
  field: string;
  source: DnseEodFieldSource;
  dnseChannels: string[];
  dnseFields: string[];
  enrichmentSource: "fiinquant" | "vnstock" | "adn" | null;
  note: string;
};

export type DnseEodEnrichment = {
  fiinquant?: {
    foreignFlowText?: string | null;
    foreignTopBuy: string[];
    foreignTopSell: string[];
    propTradingTopBuy: string[];
    propTradingTopSell: string[];
    individualTopBuy: string[];
    individualTopSell: string[];
    missingFields: string[];
    retrievedAt: string;
  };
  vnstock?: {
    foreignFlowText?: string | null;
    foreignTopBuy: string[];
    foreignTopSell: string[];
    propTradingTopBuy: string[];
    propTradingTopSell: string[];
    activeTopBuy: string[];
    activeTopSell: string[];
    indexContribution: Array<{
      exchange: string;
      symbol: string;
      point: number;
      type?: string | null;
      time?: string | null;
    }>;
    contributionAsOf?: string | null;
    missingFields: string[];
    retrievedAt: string;
  };
};

export type DnseEodMarketData = {
  mode: "lightspeed-websocket" | "database-storage";
  channels: Array<{ name: string; symbols: string[] }>;
  fieldMap: DnseEodFieldMapItem[];
  runtimeCoverage: {
    messages: number;
    latestRows?: number;
    eventRows?: number;
    activeChannels: string[];
    observedMessageTypes: string[];
    presentFields: string[];
    missingFields: string[];
  };
  storage?: {
    tradingDate: string;
    lastReceivedAt: string | null;
    lastCollectorRunAt: string | null;
  };
  indices?: Array<{
    ticker: string;
    value: number | null;
    change: number | null;
    changePct: number | null;
    volume: number | null;
    updatedAt: string | null;
  }>;
  breadth?: {
    up: number | null;
    down: number | null;
    unchanged: number | null;
    ceiling: number | null;
    floor: number | null;
  };
  liquidity?: {
    matchedValue: number | null;
    matchedVolume: number | null;
    negotiatedValue: number | null;
    negotiatedVolume: number | null;
  };
  foreignFlow?: {
    buyValue: number | null;
    sellValue: number | null;
    netValue: number | null;
    topBuy?: string[];
    topSell?: string[];
  };
  brief?: {
    sessionSummary: string | null;
    liquidityDetail: string | null;
    foreignFlow: string | null;
    notableTrades: string | null;
    outlook: string | null;
  };
  enrichment?: DnseEodEnrichment;
  fallback?: DnseEodEnrichment;
  ohlcv?: Array<{
    ticker: string;
    open: number | null;
    high: number | null;
    low: number | null;
    close: number | null;
    volume: number | null;
    value: number | null;
    updatedAt: string | null;
  }>;
};

export type DnseMarketStorageCollectResult = {
  ok: boolean;
  source: "dnse";
  dataset: "market.eod";
  tradingDate: string;
  opened: boolean;
  authenticated: boolean;
  receivedMessages: number;
  storedEvents: number;
  updatedLatest: number;
  channels: Array<{ name: string; symbols: string[] }>;
  activeChannels: string[];
  errors: string[];
  missingFields: string[];
  startedAt: string;
  finishedAt: string;
};
