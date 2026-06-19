export interface VnstockMorningNewsItem {
  source: "vnstock_news";
  providerSite?: string;
  category: "market" | "macro" | "global" | "morning" | "latest";
  title: string;
  url: string;
  summary: string | null;
  publishedAt: string | null;
  fetchedAt: string;
  rawPayload?: Record<string, unknown>;
}

export interface VnstockMorningNewsResponse {
  ok: boolean;
  source: "vnstock_news";
  retrievedAt: string;
  articles: VnstockMorningNewsItem[];
  byCategory: Record<string, number>;
  errors: string[];
  missingFields: string[];
}

const DEFAULT_VNSTOCK_BRIDGE_URL =
  process.env.NODE_ENV === "production" ? "http://fiinquant:8000" : "http://127.0.0.1:8000";

function getVnstockBridgeUrl() {
  return (
    process.env.VNSTOCK_NEWS_BRIDGE_URL ||
    process.env.PYTHON_BRIDGE_URL ||
    process.env.VNSTOCK_BRIDGE_URL ||
    DEFAULT_VNSTOCK_BRIDGE_URL
  ).replace(/\/$/, "");
}

export interface VnstockInvestorFlowRow {
  ticker: string;
  netValue: number;
}

export interface VnstockInvestorFlowBucket {
  net: number | null;
  topBuy: VnstockInvestorFlowRow[];
  topSell: VnstockInvestorFlowRow[];
}

export interface VnstockInvestorFlowResponse {
  source: string;
  retrievedAt: string;
  foreign: Record<string, VnstockInvestorFlowBucket>;
  proprietary: Record<string, VnstockInvestorFlowBucket>;
  missingFields?: string[];
}

// Bridge vnstock CHUYÊN BIỆT (adn-vnstock:8010, VNSTOCK_BRIDGE_URL) — khác bridge news ở trên.
function getVnstockDataBridgeUrl() {
  return (
    process.env.VNSTOCK_BRIDGE_URL ||
    (process.env.NODE_ENV === "production" ? "http://vnstock:8010" : "http://127.0.0.1:8010")
  ).replace(/\/$/, "");
}

// Dòng tiền NĐT NN + Tự doanh toàn thị trường, đa khung (FlowInsights). Dùng làm FALLBACK cho FiinQuant.
export async function fetchVnstockInvestorFlow(options?: {
  top?: number;
  timeout?: number;
}): Promise<VnstockInvestorFlowResponse | null> {
  const top = Math.max(3, Math.min(20, options?.top ?? 10));
  const url = `${getVnstockDataBridgeUrl()}/api/v1/investor-flow?top=${top}`;
  try {
    const res = await fetch(url, {
      cache: "no-store",
      signal: AbortSignal.timeout(options?.timeout ?? 60_000),
    });
    if (!res.ok) {
      console.warn(`[Vnstock] /api/v1/investor-flow -> ${res.status}`);
      return null;
    }
    return (await res.json()) as VnstockInvestorFlowResponse;
  } catch (error) {
    console.warn("[Vnstock] /api/v1/investor-flow failed:", error instanceof Error ? error.message : String(error));
    return null;
  }
}

export interface VnstockFundamentalResponse {
  ticker: string;
  source: string;
  retrievedAt: string;
  valuation: { pe: number | null; pb: number | null; reportDate?: string | null } | null;
  ratios: Array<{
    reportDate?: string | null;
    eps?: number | null;
    bookValuePerShare?: number | null;
    pe?: number | null;
    pb?: number | null;
    roe?: number | null;
  }>;
  profile: {
    companyName?: string | null;
    industry?: string | null;
    exchange?: string | null;
    marketCap?: number | null;
    currentPrice?: number | null;
  } | null;
  missingFields?: string[];
}

// FA (định giá + chỉ số + hồ sơ) toàn-vnstock — FALLBACK cho FiinQuant (hết hạn 27/6). Nguồn sponsor MAS.
export async function fetchVnstockFundamental(
  ticker: string,
  options?: { timeout?: number },
): Promise<VnstockFundamentalResponse | null> {
  const url = `${getVnstockDataBridgeUrl()}/api/v1/fundamental/${encodeURIComponent(ticker.toUpperCase())}`;
  try {
    const res = await fetch(url, {
      cache: "no-store",
      signal: AbortSignal.timeout(options?.timeout ?? 30_000),
    });
    if (!res.ok) {
      console.warn(`[Vnstock] /api/v1/fundamental -> ${res.status}`);
      return null;
    }
    return (await res.json()) as VnstockFundamentalResponse;
  } catch (error) {
    console.warn("[Vnstock] /api/v1/fundamental failed:", error instanceof Error ? error.message : String(error));
    return null;
  }
}

export async function fetchVnstockMorningNews(options?: {
  limit?: number;
  timeout?: number;
}): Promise<VnstockMorningNewsResponse | null> {
  const limit = Math.max(6, Math.min(80, options?.limit ?? 36));
  const url = `${getVnstockBridgeUrl()}/api/v1/vnstock/news/morning?limit=${encodeURIComponent(String(limit))}`;
  try {
    const res = await fetch(url, {
      cache: "no-store",
      signal: AbortSignal.timeout(options?.timeout ?? 45_000),
    });
    if (!res.ok) {
      console.warn(`[Vnstock] /api/v1/vnstock/news/morning -> ${res.status}`);
      return null;
    }
    return (await res.json()) as VnstockMorningNewsResponse;
  } catch (error) {
    console.warn("[Vnstock] /api/v1/vnstock/news/morning failed:", error instanceof Error ? error.message : String(error));
    return null;
  }
}
