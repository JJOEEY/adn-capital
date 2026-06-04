export type DatabaseNewsCategory = "market" | "macro" | "global" | "morning" | "latest";

export type DatabaseNewsSourceName = "cafef" | "vietstock" | "vnstock_news";

export type DatabaseNewsItem = {
  id?: string;
  source: DatabaseNewsSourceName;
  category: DatabaseNewsCategory;
  title: string;
  url: string;
  summary: string | null;
  publishedAt: string | null;
  fetchedAt: string;
  hash: string;
};

export type DatabaseNewsCollectResult = {
  ok: boolean;
  sources: DatabaseNewsSourceName[];
  fetched: number;
  stored: number;
  skipped: number;
  bySource: Record<string, number>;
  byCategory: Record<string, number>;
  errors: string[];
  missingFields: string[];
  collectedAt: string;
};

export type DatabaseNewsHealth = {
  status: "ok" | "degraded" | "blocked";
  checkedAt: string;
  windowHours: number;
  total: number;
  bySource: Record<string, number>;
  byCategory: Record<string, number>;
  latest: DatabaseNewsItem[];
  missingFields: string[];
};

export type DatabaseMorningReadiness = {
  ok: boolean;
  publishAllowed: boolean;
  checkedAt: string;
  tradingDate: string;
  previousTradingDate: string;
  missingFields: string[];
  checks: {
    referenceIndices: {
      ok: boolean;
      required: string[];
      available: string[];
    };
    news: {
      ok: boolean;
      cafefCount: number;
      vietstockCount: number;
      vnstockNewsCount: number;
      marketCount: number;
      macroCount: number;
      latest: DatabaseNewsItem[];
    };
    eod: {
      ok: boolean;
      dataset: string;
      providerCode: string | null;
      missingFields: string[];
      optionalMissingFields?: string[];
    };
  };
};

export type DatabaseMorningBriefPayload = {
  date: string;
  reference_indices: Array<{
    name: string;
    value: number | null;
    change_pct: number | null;
  }>;
  vn_market: string[];
  macro: string[];
  risk_opportunity: string[];
  metadata: {
    tradingDate: string;
    previousTradingDate: string;
    generatedAt: string;
    newsSources: DatabaseNewsSourceName[];
    format: "database-v2-morning-brief";
    rewriteSource?: "deterministic" | "freemodel" | "openrouter";
  };
};
