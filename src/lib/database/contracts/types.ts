export type DatabaseDataset =
  | "market.instruments"
  | "market.ohlcv"
  | "market.realtime"
  | "market.board"
  | "market.websocket"
  | "market.indices"
  | "market.eod"
  | "aiden.context"
  | "aiden.market_context"
  | "aiden.stock_context"
  | "radar.realtime"
  | "realtime.health"
  | "database.readiness"
  | "tool.latest"
  | "news.morning"
  | "news.market"
  | "news.macro"
  | "news.global"
  | "news.latest"
  | "fundamental.profile"
  | "fundamental.financials"
  | "fundamental.valuation";

export type DatabaseSource = "dnse" | "fiinquant" | "vnstock" | "cafef" | "vietstock" | "database";

export type DatabaseProviderStatus = {
  provider: DatabaseSource;
  ok: boolean;
  endpoint?: string;
  httpStatus?: number | null;
  code?: string;
  message?: string;
  latencyMs?: number;
  retryable?: boolean;
};

export type DatabaseResult<T> = {
  ok: boolean;
  dataset: DatabaseDataset;
  source: DatabaseSource;
  data: T | null;
  missingFields: string[];
  retrievedAt: string;
  providerStatus: DatabaseProviderStatus;
};

export function databaseOk<T>(
  dataset: DatabaseDataset,
  source: DatabaseSource,
  data: T,
  providerStatus: DatabaseProviderStatus,
  missingFields: string[] = [],
): DatabaseResult<T> {
  return {
    ok: missingFields.length === 0,
    dataset,
    source,
    data,
    missingFields,
    retrievedAt: new Date().toISOString(),
    providerStatus: { ...providerStatus, ok: missingFields.length === 0 && providerStatus.ok },
  };
}

export function databaseError<T>(
  dataset: DatabaseDataset,
  source: DatabaseSource,
  providerStatus: DatabaseProviderStatus,
  missingFields: string[] = [],
): DatabaseResult<T> {
  return {
    ok: false,
    dataset,
    source,
    data: null,
    missingFields,
    retrievedAt: new Date().toISOString(),
    providerStatus: { ...providerStatus, ok: false },
  };
}
