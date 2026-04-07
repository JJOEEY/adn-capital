/**
 * PriceCache — Centralized price caching layer
 *
 * Nguyên tắc:
 * - 1 batch request duy nhất lấy giá TẤT CẢ tickers
 * - Cache TTL 15s — VNStock Silver 300 req/min cho phép refresh nhanh
 * - Mọi module (Lifecycle, SignalEngine, UI) đều đọc từ cache
 * - Không bao giờ gọi API giá per-ticker
 */

import NodeCache from "node-cache";

const PYTHON_BRIDGE = process.env.PYTHON_BRIDGE_URL ?? "http://localhost:8000";

// ═══════════════════════════════════════════════════════════════════
//  Types
// ═══════════════════════════════════════════════════════════════════

export interface PriceItem {
  close: number;
  volume: number;
  ma20Volume: number;
}

export interface ExitScanItem {
  shouldExit: boolean;
  reason: string | null;
}

// ═══════════════════════════════════════════════════════════════════
//  Cache instances (module-level singletons)
// ═══════════════════════════════════════════════════════════════════

// Price cache: TTL 15s — VNStock Silver cho phép refresh nhanh hơn
const priceCache = new NodeCache({ stdTTL: 15, checkperiod: 10 });

// Exit-scan cache: TTL 300s — heavy computation, chỉ cần 1 lần/5 phút
const exitScanCache = new NodeCache({ stdTTL: 300, checkperiod: 60 });

// Seasonality cache: TTL 86400s (24h) — dữ liệu ít thay đổi
const seasonalityCache = new NodeCache({ stdTTL: 86400, checkperiod: 3600 });

const PRICE_BATCH_KEY = "__all_prices__";
const EXIT_SCAN_BATCH_KEY = "__exit_scan_batch__";

// ═══════════════════════════════════════════════════════════════════
//  Batch Price: 1 request duy nhất cho TẤT CẢ tickers
// ═══════════════════════════════════════════════════════════════════

/**
 * Lấy giá batch cho nhiều tickers. Dùng cache 60s.
 * Nếu cache còn hạn → trả về ngay, KHÔNG gọi API.
 * Nếu cache hết hạn → 1 POST request duy nhất.
 */
export async function getBatchPrices(
  tickers: string[]
): Promise<Record<string, PriceItem>> {
  if (tickers.length === 0) return {};

  // Check cache first
  const cached = priceCache.get<Record<string, PriceItem>>(PRICE_BATCH_KEY);
  if (cached) {
    // Kiểm tra xem tất cả tickers đã có trong cache chưa
    const missing = tickers.filter((t) => !(t in cached));
    if (missing.length === 0) {
      console.log(`[PriceCache] HIT — ${tickers.length} tickers từ cache`);
      return cached;
    }
    // Nếu có ticker mới chưa có trong cache → fetch thêm
    console.log(
      `[PriceCache] PARTIAL HIT — ${tickers.length - missing.length} cached, ${missing.length} cần fetch`
    );
  }

  // Fetch from Python Bridge
  try {
    const res = await fetch(`${PYTHON_BRIDGE}/api/v1/batch-price`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ tickers }),
      signal: AbortSignal.timeout(30_000),
    });

    if (!res.ok) {
      console.error(`[PriceCache] API error: ${res.status}`);
      return cached ?? {};
    }

    const data = await res.json();
    const prices: Record<string, PriceItem> = data.prices ?? {};

    // Merge với cache cũ (nếu có) để giữ lại dữ liệu đã có
    const merged = { ...(cached ?? {}), ...prices };
    priceCache.set(PRICE_BATCH_KEY, merged);

    console.log(
      `[PriceCache] FETCHED — ${Object.keys(prices).length}/${tickers.length} tickers`
    );
    return merged;
  } catch (e) {
    console.error("[PriceCache] Fetch error:", e);
    return cached ?? {};
  }
}

/**
 * Lấy giá 1 ticker từ cache. KHÔNG gọi API.
 * Dùng cho UI / display — chỉ đọc từ cache có sẵn.
 */
export function getCachedPrice(ticker: string): PriceItem | undefined {
  const cached = priceCache.get<Record<string, PriceItem>>(PRICE_BATCH_KEY);
  return cached?.[ticker];
}

/**
 * Buộc invalidate cache (e.g. khi cần re-fetch ngay).
 */
export function invalidatePriceCache(): void {
  priceCache.del(PRICE_BATCH_KEY);
}

// ═══════════════════════════════════════════════════════════════════
//  Batch Exit-Scan: 1 POST request cho TẤT CẢ ACTIVE tickers
// ═══════════════════════════════════════════════════════════════════

/**
 * Batch exit-scan cho nhiều tickers. Cache 300s.
 * 1 POST request duy nhất thay vì N GET requests per-ticker.
 */
export async function getBatchExitScan(
  tickers: string[]
): Promise<Record<string, ExitScanItem>> {
  if (tickers.length === 0) return {};

  // Check cache
  const cached = exitScanCache.get<Record<string, ExitScanItem>>(EXIT_SCAN_BATCH_KEY);
  if (cached) {
    const allPresent = tickers.every((t) => t in cached);
    if (allPresent) {
      console.log(`[ExitScanCache] HIT — ${tickers.length} tickers từ cache`);
      return cached;
    }
  }

  try {
    const res = await fetch(`${PYTHON_BRIDGE}/api/v1/batch-exit-scan`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ tickers }),
      signal: AbortSignal.timeout(45_000),
    });

    if (!res.ok) {
      console.error(`[ExitScanCache] API error: ${res.status}`);
      return cached ?? {};
    }

    const data = await res.json();
    const results: Record<string, ExitScanItem> = data.results ?? {};

    const merged = { ...(cached ?? {}), ...results };
    exitScanCache.set(EXIT_SCAN_BATCH_KEY, merged);

    const exitCount = Object.values(results).filter((r) => r.shouldExit).length;
    console.log(
      `[ExitScanCache] FETCHED — ${Object.keys(results).length} tickers, ${exitCount} cần thoát`
    );
    return merged;
  } catch (e) {
    console.error("[ExitScanCache] Fetch error:", e);
    return cached ?? {};
  }
}

// ═══════════════════════════════════════════════════════════════════
//  Batch Seasonality: 1 POST request cho nhiều tickers (EOD only)
// ═══════════════════════════════════════════════════════════════════

export interface SeasonalityItem {
  ticker: string;
  currentMonth: number;
  winRate: number;
  sharpeRatio: number;
}

/**
 * Batch seasonality cho nhiều tickers. Cache 24h.
 * Chỉ gọi khi có signal mới vào RADAR (KHÔNG gọi trong lifecycle).
 */
export async function getBatchSeasonality(
  tickers: string[]
): Promise<Record<string, SeasonalityItem>> {
  if (tickers.length === 0) return {};

  // Check cache: trả về cached tickers + fetch missing
  const result: Record<string, SeasonalityItem> = {};
  const missing: string[] = [];

  for (const t of tickers) {
    const cached = seasonalityCache.get<SeasonalityItem>(`seasonality:${t}`);
    if (cached) {
      result[t] = cached;
    } else {
      missing.push(t);
    }
  }

  if (missing.length === 0) {
    console.log(`[SeasonalityCache] HIT — ${tickers.length} tickers từ cache`);
    return result;
  }

  try {
    const res = await fetch(`${PYTHON_BRIDGE}/api/v1/batch-seasonality`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ tickers: missing }),
      signal: AbortSignal.timeout(60_000),
    });

    if (!res.ok) {
      console.error(`[SeasonalityCache] API error: ${res.status}`);
      return result;
    }

    const data = await res.json();
    const fetched: Record<string, SeasonalityItem> = data.results ?? {};

    for (const [t, item] of Object.entries(fetched)) {
      seasonalityCache.set(`seasonality:${t}`, item);
      result[t] = item;
    }

    console.log(
      `[SeasonalityCache] FETCHED ${Object.keys(fetched).length}/${missing.length} tickers (${tickers.length - missing.length} cached)`
    );
    return result;
  } catch (e) {
    console.error("[SeasonalityCache] Fetch error:", e);
    return result;
  }
}

// ═══════════════════════════════════════════════════════════════════
//  Stats (for monitoring)
// ═══════════════════════════════════════════════════════════════════

export function getCacheStats() {
  return {
    price: priceCache.getStats(),
    exitScan: exitScanCache.getStats(),
    seasonality: seasonalityCache.getStats(),
  };
}
