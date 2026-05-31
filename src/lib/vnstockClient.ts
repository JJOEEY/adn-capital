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
