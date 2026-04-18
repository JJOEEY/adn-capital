/**
 * Market Data Fetcher — Tổng hợp data thực từ nhiều nguồn.
 *
 * Ưu tiên: FiinQuant Bridge → VNDirect dchart → fallback
 * Dùng cho tất cả cron jobs: Morning Brief, EOD Brief, Intraday, Signal Scan.
 */

import { fetchTAData, type TAData } from "./stockData";
import {
  fetchMarketOverview,
  fetchRSRatingList,
  fetchPropTrading,
  fetchMarketBreadth,
  fetchInvestorTrading,
  fetchRealtimeTradingData,
  type FiinMarketOverview,
  type FiinPropTrading,
  type FiinMarketBreadthResponse,
  type FiinInvestorTradingResponse,
  type FiinRealtimeResponse,
} from "./fiinquantClient";
import { getVnDateISO, getVnNow, isVnTradingDay, toVnTime } from "./time";
import { fetchDnseMarketSnapshot } from "./dnseClient";

type JsonRecord = Record<string, unknown>;
type ProviderId = "fiin" | "vnd" | "vnstock" | "dnse" | "tcbs";

interface AlternativeSnapshot {
  liquidityByExchange: {
    HOSE: number | null;
    HNX: number | null;
    UPCOM: number | null;
    total: number | null;
  };
  investorTrading: {
    foreignNet: number | null;
    proprietaryNet: number | null;
    retailNet: number | null;
  };
}

const PROVIDER_RING: ProviderId[] = ["vnd", "vnstock", "fiin", "dnse", "tcbs"];

type MarketSnapshotCacheEntry = {
  requestDateVN: string;
  timestampMs: number;
  data: MarketSnapshot;
};

const SNAPSHOT_CACHE_TTL_MS = 90_000;
let marketSnapshotCache: MarketSnapshotCacheEntry | null = null;
let marketSnapshotInFlight: Promise<MarketSnapshot> | null = null;

function getProviderOrder(): ProviderId[] {
  const vnNow = getVnNow();
  const seed = vnNow.hour() * 60 + vnNow.minute();
  const start = seed % PROVIDER_RING.length;
  return [...PROVIDER_RING.slice(start), ...PROVIDER_RING.slice(0, start)];
}

function pickRoundRobinValue(
  order: ProviderId[],
  values: Partial<Record<ProviderId, number | null>>,
): number | null {
  for (const provider of order) {
    const value = values[provider];
    if (value != null && Number.isFinite(value)) return value;
  }
  return null;
}

export interface ProviderDiagnostic {
  provider: string;
  endpoint: string;
  requestDateVN: string;
  httpStatus: number | null;
  error: string;
  fallbackUsed: boolean;
}

async function safeReadJson<T>(res: Response): Promise<T | null> {
  const raw = await res.text();
  if (!raw?.trim()) return null;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

function isRecord(value: unknown): value is JsonRecord {
  return typeof value === "object" && value !== null;
}

function pickRecord(base: JsonRecord, keys: string[]): JsonRecord | null {
  for (const key of keys) {
    const value = base[key];
    if (isRecord(value)) return value;
  }
  return null;
}

// ═══════════════════════════════════════════════
//  VNDirect Public API — Index Data (no auth)
// ═══════════════════════════════════════════════

interface IndexData {
  ticker: string;
  value: number;
  change: number;
  changePct: number;
  volume: number;
}

const DCHART_BASE = "https://dchart-api.vndirect.com.vn/dchart/history";

async function fetchIndexFromDchart(
  symbol: string,
  diagnostics: ProviderDiagnostic[],
  requestDateVN: string,
): Promise<IndexData | null> {
  const endpoint = `${DCHART_BASE}?resolution=D&symbol=${symbol}`;
  try {
    const now = Math.floor(Date.now() / 1000);
    const from = now - 5 * 86400; // 5 ngày
    const url = `${DCHART_BASE}?resolution=D&symbol=${symbol}&from=${from}&to=${now}`;

    const res = await fetch(url, {
      signal: AbortSignal.timeout(10_000),
      headers: { "User-Agent": "Mozilla/5.0" },
    });
    if (!res.ok) {
      diagnostics.push({
        provider: "VND",
        endpoint,
        requestDateVN,
        httpStatus: res.status,
        error: `HTTP ${res.status}`,
        fallbackUsed: true,
      });
      return null;
    }

    const data = await safeReadJson<{ c?: number[]; v?: number[] }>(res);
    if (!data) {
      diagnostics.push({
        provider: "VND",
        endpoint,
        requestDateVN,
        httpStatus: res.status,
        error: "Empty or invalid JSON body",
        fallbackUsed: true,
      });
      return null;
    }
    if (!data.c || data.c.length < 2) return null;

    const len = data.c.length;
    const current = data.c[len - 1];
    const prev = data.c[len - 2];
    const change = current - prev;
    const changePct = prev > 0 ? (change / prev) * 100 : 0;

    return {
      ticker: symbol,
      value: Math.round(current * 100) / 100,
      change: Math.round(change * 100) / 100,
      changePct: Math.round(changePct * 100) / 100,
      volume: data.v?.[len - 1] ?? 0,
    };
  } catch (err) {
    console.error(`[dchart] Error fetching ${symbol}:`, err);
    diagnostics.push({
      provider: "VND",
      endpoint,
      requestDateVN,
      httpStatus: null,
      error: err instanceof Error ? err.message : String(err),
      fallbackUsed: true,
    });
    return null;
  }
}

// ═══════════════════════════════════════════════
//  VNDirect Top Gainers / Losers (public API)
// ═══════════════════════════════════════════════

interface StockMove {
  ticker: string;
  changePct: number;
  price?: number;
  volume?: number;
}

async function fetchTopMovers(
  diagnostics: ProviderDiagnostic[],
  requestDateVN: string,
): Promise<{ gainers: StockMove[]; losers: StockMove[] }> {
  const result = { gainers: [] as StockMove[], losers: [] as StockMove[] };

  try {
    // VNDirect board API — top gainers
    const gainUrl = "https://finfo-api.vndirect.com.vn/v4/top_stocks?type=changeUp&exchange=HOSE&limit=10";
    const loseUrl = "https://finfo-api.vndirect.com.vn/v4/top_stocks?type=changeDown&exchange=HOSE&limit=10";

    const [gainRes, loseRes] = await Promise.all([
      fetch(gainUrl, { signal: AbortSignal.timeout(10_000), headers: { "User-Agent": "Mozilla/5.0" } }).catch(() => null),
      fetch(loseUrl, { signal: AbortSignal.timeout(10_000), headers: { "User-Agent": "Mozilla/5.0" } }).catch(() => null),
    ]);

    if (gainRes?.ok) {
      const data = await safeReadJson<JsonRecord>(gainRes);
      if (!data) {
        diagnostics.push({
          provider: "VND",
          endpoint: gainUrl,
          requestDateVN,
          httpStatus: gainRes.status,
          error: "Empty or invalid JSON body",
          fallbackUsed: true,
        });
      }
      const items = data?.data ?? data ?? [];
      if (Array.isArray(items)) {
        result.gainers = items.slice(0, 10).map((s: Record<string, unknown>) => ({
          ticker: String(s.code || s.symbol || s.ticker || ""),
          changePct: Number(s.changePct || s.change_pct || s.percentChange || 0),
          price: Number(s.price || s.close || s.lastPrice || 0),
        })).filter((s: StockMove) => s.ticker);
      }
    }

    if (loseRes?.ok) {
      const data = await safeReadJson<JsonRecord>(loseRes);
      if (!data) {
        diagnostics.push({
          provider: "VND",
          endpoint: loseUrl,
          requestDateVN,
          httpStatus: loseRes.status,
          error: "Empty or invalid JSON body",
          fallbackUsed: true,
        });
      }
      const items = data?.data ?? data ?? [];
      if (Array.isArray(items)) {
        result.losers = items.slice(0, 10).map((s: Record<string, unknown>) => ({
          ticker: String(s.code || s.symbol || s.ticker || ""),
          changePct: Number(s.changePct || s.change_pct || s.percentChange || 0),
          price: Number(s.price || s.close || s.lastPrice || 0),
        })).filter((s: StockMove) => s.ticker);
      }
    }
  } catch (err) {
    console.error("[topMovers] Error:", err);
    diagnostics.push({
      provider: "VND",
      endpoint: "finfo-api.vndirect.com.vn/v4/top_stocks",
      requestDateVN,
      httpStatus: null,
      error: err instanceof Error ? err.message : String(err),
      fallbackUsed: true,
    });
  }

  // Fallback: SSI iBoard
  if (result.gainers.length === 0 && result.losers.length === 0) {
    try {
      const ssiUrl = "https://iboard-query.ssi.com.vn/v2/stock/type/s/hose";
      const ssiRes = await fetch(ssiUrl, {
        signal: AbortSignal.timeout(10_000),
        headers: { "User-Agent": "Mozilla/5.0", "Accept": "application/json" },
      });

      if (ssiRes.ok) {
        const ssiData = await safeReadJson<JsonRecord>(ssiRes);
        if (!ssiData) {
          diagnostics.push({
            provider: "VND",
            endpoint: ssiUrl,
            requestDateVN,
            httpStatus: ssiRes.status,
            error: "Empty or invalid JSON body",
            fallbackUsed: true,
          });
        }
        const stocks = ssiData?.data ?? [];
        if (Array.isArray(stocks) && stocks.length > 0) {
          const mapped = stocks
            .filter((s: Record<string, unknown>) => s.ss === "ATC" || s.ss === "LO" || s.ss === "C")
            .map((s: Record<string, unknown>) => ({
              ticker: String(s.symbol || s.ss || ""),
              changePct: Number(s.changePc || 0),
              price: Number(s.lastPrice || s.closePrice || 0) / 1000,
            }))
            .filter((s: StockMove) => s.ticker && s.ticker.length <= 5);

          mapped.sort((a: StockMove, b: StockMove) => b.changePct - a.changePct);
          result.gainers = mapped.slice(0, 10).filter((s: StockMove) => s.changePct > 0);
          result.losers = mapped.slice(-10).reverse().filter((s: StockMove) => s.changePct < 0);
        }
      }
    } catch (err) {
      console.error("[topMovers SSI fallback] Error:", err);
      diagnostics.push({
        provider: "VND",
        endpoint: "iboard-query.ssi.com.vn/v2/stock/type/s/hose",
        requestDateVN,
        httpStatus: null,
        error: err instanceof Error ? err.message : String(err),
        fallbackUsed: true,
      });
    }
  }

  // Fallback 2: RS-Rating data (Python backend — always available)
  if (result.gainers.length === 0 && result.losers.length === 0) {
    try {
      const { fetchRSRatingList } = await import("./fiinquantClient");
      const rsStocks = await fetchRSRatingList();
      if (rsStocks && rsStocks.length > 0) {
        const withChange = rsStocks
          .filter((s) => s.symbol && s.changePercent !== 0)
          .map((s) => ({
            ticker: s.symbol,
            changePct: s.changePercent,
            price: s.price,
          }));

        withChange.sort((a, b) => b.changePct - a.changePct);
        result.gainers = withChange.filter((s) => s.changePct > 0).slice(0, 10);
        result.losers = withChange.filter((s) => s.changePct < 0).sort((a, b) => a.changePct - b.changePct).slice(0, 10);
      }
    } catch (err) {
      console.error("[topMovers RS-Rating fallback] Error:", err);
      diagnostics.push({
        provider: "FiinQuant",
        endpoint: "/api/v1/rs-rating",
        requestDateVN,
        httpStatus: null,
        error: err instanceof Error ? err.message : String(err),
        fallbackUsed: true,
      });
    }
  }

  return result;
}

// ═══════════════════════════════════════════════
//  Parse Breadth Helper
// ═══════════════════════════════════════════════

function parseBreadth(raw: unknown): { up: number; down: number; unchanged: number } | null {
  if (!raw) return null;

  // Already object
  if (typeof raw === "object" && raw !== null) {
    const obj = raw as Record<string, unknown>;
    if ("up" in obj && "down" in obj) {
      return {
        up: Number(obj.up) || 0,
        down: Number(obj.down) || 0,
        unchanged: Number(obj.unchanged) || 0,
      };
    }
  }

  // Parse string: "Tăng: 31 | Giảm: 137 | Không đổi: 31"
  if (typeof raw === "string") {
    const normalized = raw
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase();

    const upMatch = normalized.match(/(?:tang|up)[^\d]{0,8}(\d+)/);
    const downMatch = normalized.match(/(?:giam|down)[^\d]{0,8}(\d+)/);
    const unchMatch = normalized.match(/(?:khong doi|dung|unchanged|flat)[^\d]{0,8}(\d+)/);

    if (upMatch || downMatch || unchMatch) {
      return {
        up: upMatch ? Number.parseInt(upMatch[1], 10) : 0,
        down: downMatch ? Number.parseInt(downMatch[1], 10) : 0,
        unchanged: unchMatch ? Number.parseInt(unchMatch[1], 10) : 0,
      };
    }

    // Fallback for arrow formats: "↑170 | ↓152 | =40" or "↑0 ↓0 -0"
    const upArrow = raw.match(/[↑↗]\s*(\d+)/);
    const downArrow = raw.match(/[↓↘]\s*(\d+)/);
    const equalArrow = raw.match(/[=→\-]\s*(\d+)/);
    if (upArrow || downArrow || equalArrow) {
      return {
        up: upArrow ? Number.parseInt(upArrow[1], 10) : 0,
        down: downArrow ? Number.parseInt(downArrow[1], 10) : 0,
        unchanged: equalArrow ? Number.parseInt(equalArrow[1], 10) : 0,
      };
    }

    // Generic numeric fallback: first 3 numbers are up/down/unchanged
    const numbers = raw.match(/\d+/g);
    if (numbers && numbers.length >= 3) {
      return {
        up: Number.parseInt(numbers[0], 10),
        down: Number.parseInt(numbers[1], 10),
        unchanged: Number.parseInt(numbers[2], 10),
      };
    }
  }

  return null;
}

function parseLiquidity(raw: unknown): number | null {
  if (typeof raw === "number") return raw > 0 ? raw : null;
  if (typeof raw === "object" && raw !== null) {
    const obj = raw as Record<string, unknown>;
    const candidates = [
      obj.total,
      obj.totalValue,
      obj.matchValue,
      obj.value,
      obj.liquidity,
    ];
    for (const item of candidates) {
      const num = Number(item);
      if (Number.isFinite(num) && num > 0) return num;
    }
  }
  return null;
}

function getLatestTradingDateISO(): string {
  let cursor = toVnTime();
  for (let i = 0; i < 10; i += 1) {
    if (isVnTradingDay(cursor)) {
      return cursor.format("YYYY-MM-DD");
    }
    cursor = cursor.subtract(1, "day");
  }
  return getVnDateISO();
}

function toNumber(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string") {
    const cleaned = value.replace(/[^\d.-]/g, "");
    if (!cleaned) return null;
    const num = Number(cleaned);
    if (Number.isFinite(num)) return num;
  }
  return null;
}

function toBillion(value: number | null): number | null {
  if (value == null || !Number.isFinite(value)) return null;
  return Math.abs(value) >= 1_000_000 ? value / 1_000_000_000 : value;
}

function pickNumber(obj: JsonRecord, keys: string[]): number | null {
  for (const key of keys) {
    if (!(key in obj)) continue;
    const num = toNumber(obj[key]);
    if (num !== null) return num;
  }
  return null;
}

function hasAnyValue(raw: unknown): boolean {
  if (raw == null) return false;
  if (Array.isArray(raw)) return raw.length > 0;
  if (typeof raw === "object") return Object.keys(raw as JsonRecord).length > 0;
  return true;
}

function isInvestorPayloadUsable(raw: FiinInvestorTradingResponse | null): boolean {
  if (!raw) return false;
  const hasRows = Array.isArray(raw.data) && raw.data.length > 0;
  const hasSummary = hasAnyValue(raw.summary);
  return hasRows || hasSummary;
}

function inferGroup(raw: string): "foreign" | "proprietary" | "retail" | null {
  const value = raw
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
  if (/(ngoai|foreign|nn\b)/i.test(value)) return "foreign";
  if (/(tu\s*doanh|proprietary|self\s*trading|to\s*chuc)/i.test(value)) return "proprietary";
  if (/(ca\s*nhan|retail|individual|noi\s*dia)/i.test(value)) return "retail";
  return null;
}

function extractGroupLabel(row: JsonRecord): string {
  const keys = ["investor_type", "investorType", "group", "name", "label", "nha_dau_tu"];
  for (const key of keys) {
    if (typeof row[key] === "string" && row[key]) return String(row[key]);
  }
  return "";
}

function parseExchange(raw: string): "HOSE" | "HNX" | "UPCOM" | null {
  const value = raw.toUpperCase();
  if (
    value.includes("HOSE") ||
    value.includes("HSX") ||
    value.includes("VNINDEX") ||
    value.includes("VN30")
  ) {
    return "HOSE";
  }
  if (value.includes("HNX")) return "HNX";
  if (value.includes("UPCOM") || value.includes("UP-COM")) return "UPCOM";
  return null;
}

function extractExchange(row: JsonRecord): "HOSE" | "HNX" | "UPCOM" | null {
  const keys = [
    "exchange",
    "market",
    "index",
    "ticker",
    "symbol",
    "comGroupCode",
    "ComGroupCode",
    "groupCode",
  ];
  for (const key of keys) {
    if (typeof row[key] !== "string") continue;
    const ex = parseExchange(String(row[key]));
    if (ex) return ex;
  }
  return null;
}

function readLiquidityValue(row: JsonRecord): number | null {
  return pickNumber(row, [
    "totalValue",
    "total_value",
    "totalTradingValue",
    "total_trading_value",
    "matchValue",
    "match_value",
    "trading_value",
    "value",
    "gia_tri_giao_dich",
    "gia_tri_khop_lenh",
    "gtgd",
    "gtgd_ty",
  ]);
}

function readBuySellNet(row: JsonRecord): { buy: number | null; sell: number | null; net: number | null } {
  const buy = pickNumber(row, [
    "buy",
    "buy_value",
    "buyValue",
    "buy_bn",
    "mua",
    "mua_gia_tri",
    "mua_rong",
    "foreignBuyValueMatched",
    "foreignBuyValueTotal",
    "proprietaryTotalMatchBuyTradeValue",
    "proprietaryTotalBuyTradeValue",
    "localIndividualBuyValue",
    "localIndividualBuyMatchValue",
  ]);
  const sell = pickNumber(row, [
    "sell",
    "sell_value",
    "sellValue",
    "sell_bn",
    "ban",
    "ban_gia_tri",
    "ban_rong",
    "foreignSellValueMatched",
    "foreignSellValueTotal",
    "proprietaryTotalMatchSellTradeValue",
    "proprietaryTotalSellTradeValue",
    "localIndividualSellValue",
    "localIndividualSellMatchValue",
  ]);
  const net = pickNumber(row, [
    "net",
    "net_value",
    "netValue",
    "net_bn",
    "rong",
    "gia_tri_rong",
    "net_buy_sell",
    "foreignNetValueMatched",
    "proprietaryNetValue",
    "localIndividualNetValue",
  ]);
  const resolvedNet = net ?? (buy != null && sell != null ? buy - sell : null);
  return {
    buy: toBillion(buy),
    sell: toBillion(sell),
    net: toBillion(resolvedNet),
  };
}

async function fetchTcbsMarketSnapshot(requestDateVN: string): Promise<AlternativeSnapshot | null> {
  const endpoint = process.env.TCBS_MARKET_SNAPSHOT_URL;
  if (!endpoint) return null;

  const apiKey = process.env.TCBS_API_KEY;
  try {
    const url = new URL(endpoint);
    if (!url.searchParams.has("date")) {
      url.searchParams.set("date", requestDateVN);
    }

    const res = await fetch(url.toString(), {
      cache: "no-store",
      signal: AbortSignal.timeout(12_000),
      headers: {
        "Content-Type": "application/json",
        ...(apiKey ? { Authorization: `Bearer ${apiKey}`, "X-Api-Key": apiKey } : {}),
      },
    });

    if (!res.ok) return null;
    const raw = await safeReadJson<JsonRecord>(res);
    if (!raw) return null;

    const hose = readLiquidityValue(raw);
    const hnx = pickNumber(raw, ["hnx", "hnxValue", "liquidity_hnx"]);
    const upcom = pickNumber(raw, ["upcom", "upcomValue", "liquidity_upcom"]);
    const total = pickNumber(raw, ["total", "totalValue", "liquidity_total"]);

    const foreignNet = pickNumber(raw, ["foreign_net", "foreignNet", "foreign_value"]);
    const proprietaryNet = pickNumber(raw, ["proprietary_net", "proprietaryNet", "self_trading_net"]);
    const retailNet = pickNumber(raw, ["retail_net", "retailNet", "individual_net"]);

    return {
      liquidityByExchange: {
        HOSE: hose,
        HNX: hnx,
        UPCOM: upcom,
        total,
      },
      investorTrading: {
        foreignNet,
        proprietaryNet,
        retailNet,
      },
    };
  } catch {
    return null;
  }
}

async function fetchVnstockMarketSnapshot(requestDateVN: string): Promise<AlternativeSnapshot | null> {
  const endpoint = process.env.VNSTOCK_BRIDGE_URL ?? process.env.VNSTOCK_MARKET_SNAPSHOT_URL;
  if (!endpoint) return null;

  const apiKey = process.env.VNSTOCK_API_KEY;
  try {
    const url = new URL(endpoint);
    if (!url.searchParams.has("date")) {
      url.searchParams.set("date", requestDateVN);
    }

    const res = await fetch(url.toString(), {
      cache: "no-store",
      signal: AbortSignal.timeout(12_000),
      headers: {
        "Content-Type": "application/json",
        ...(apiKey ? { Authorization: `Bearer ${apiKey}`, "X-Api-Key": apiKey } : {}),
      },
    });

    if (!res.ok) return null;
    const raw = await safeReadJson<JsonRecord>(res);
    if (!raw) return null;

    const payload = isRecord(raw.snapshot) ? (raw.snapshot as JsonRecord) : raw;
    const liquidityRoot = pickRecord(payload, ["liquidityByExchange", "liquidity", "marketLiquidity"]) ?? payload;
    const investorRoot = pickRecord(payload, ["investorTrading", "investorFlow", "investor"]) ?? payload;

    const hose = toBillion(readLiquidityValue(liquidityRoot));
    const hnx = toBillion(pickNumber(liquidityRoot, ["hnx", "hnxValue", "liquidity_hnx", "HNX"]));
    const upcom = toBillion(pickNumber(liquidityRoot, ["upcom", "upcomValue", "liquidity_upcom", "UPCOM"]));
    const total =
      toBillion(pickNumber(liquidityRoot, ["total", "totalValue", "liquidity_total", "all"])) ??
      ((hose ?? 0) + (hnx ?? 0) + (upcom ?? 0) > 0 ? (hose ?? 0) + (hnx ?? 0) + (upcom ?? 0) : null);

    return {
      liquidityByExchange: {
        HOSE: hose,
        HNX: hnx,
        UPCOM: upcom,
        total,
      },
      investorTrading: {
        foreignNet: toBillion(
          pickNumber(investorRoot, ["foreign_net", "foreignNet", "foreign", "netForeign", "nn_net"]),
        ),
        proprietaryNet: toBillion(
          pickNumber(investorRoot, ["proprietary_net", "proprietaryNet", "self_trading_net", "tu_doanh_net"]),
        ),
        retailNet: toBillion(
          pickNumber(investorRoot, ["retail_net", "retailNet", "individual_net", "ca_nhan_net"]),
        ),
      },
    };
  } catch {
    return null;
  }
}

// ═══════════════════════════════════════════════
//  Aggregated Data Fetchers
// ═══════════════════════════════════════════════

export interface MarketSnapshot {
  timestamp: string;
  requestDateVN: string;
  providerDiagnostics: ProviderDiagnostic[];
  indices: IndexData[];
  breadth: { up: number; down: number; unchanged: number } | null;
  supplyDemand: {
    buyVolume: number | null;
    sellVolume: number | null;
    netVolume: number | null;
    buySellRatio: number | null;
    source: "realtime" | "snapshot" | null;
  };
  liquidity: number | null;
  liquidityByExchange: {
    HOSE: number | null;
    HNX: number | null;
    UPCOM: number | null;
    total: number | null;
  };
  investorTrading: {
    foreign: { buy: number | null; sell: number | null; net: number | null };
    proprietary: { buy: number | null; sell: number | null; net: number | null };
    retail: { buy: number | null; sell: number | null; net: number | null };
    availability: { foreign: boolean; proprietary: boolean; retail: boolean };
  };
  marketOverview: FiinMarketOverview | null;
  topGainers: Array<{ ticker: string; changePct: number }>;
  topLosers: Array<{ ticker: string; changePct: number }>;
}

function emptyGroup() {
  return { buy: null as number | null, sell: null as number | null, net: null as number | null };
}

function parseInvestorTradingData(raw: FiinInvestorTradingResponse | null) {
  const foreign = emptyGroup();
  const proprietary = emptyGroup();
  const retail = emptyGroup();

  const liquidityByExchange: MarketSnapshot["liquidityByExchange"] = {
    HOSE: null,
    HNX: null,
    UPCOM: null,
    total: null,
  };

  if (raw?.summary?.proprietary) {
    proprietary.buy = toNumber(raw.summary.proprietary.total_buy_bn);
    proprietary.sell = toNumber(raw.summary.proprietary.total_sell_bn);
    proprietary.net = toNumber(raw.summary.proprietary.total_net_bn);
  }

  const foreignSummary = (raw?.summary as JsonRecord | undefined)?.foreign as JsonRecord | undefined;
  if (foreignSummary) {
    foreign.buy = toNumber(foreignSummary.total_buy_bn ?? foreignSummary.totalBuyBn ?? foreignSummary.buy_bn);
    foreign.sell = toNumber(foreignSummary.total_sell_bn ?? foreignSummary.totalSellBn ?? foreignSummary.sell_bn);
    foreign.net = toNumber(foreignSummary.total_net_bn ?? foreignSummary.totalNetBn ?? foreignSummary.net_bn);
  }

  const retailSummary = (raw?.summary as JsonRecord | undefined)?.retail as JsonRecord | undefined;
  if (retailSummary) {
    retail.buy = toNumber(retailSummary.total_buy_bn ?? retailSummary.totalBuyBn ?? retailSummary.buy_bn);
    retail.sell = toNumber(retailSummary.total_sell_bn ?? retailSummary.totalSellBn ?? retailSummary.sell_bn);
    retail.net = toNumber(retailSummary.total_net_bn ?? retailSummary.totalNetBn ?? retailSummary.net_bn);
  }

  const summaryRecord = (raw?.summary ?? {}) as JsonRecord;
  if (foreign.net == null) {
    foreign.net = pickNumber(summaryRecord, ["foreign_net_bn", "foreign_net", "foreignNet", "khoi_ngoai_rong"]);
  }
  if (retail.net == null) {
    retail.net = pickNumber(summaryRecord, ["retail_net_bn", "retail_net", "retailNet", "ca_nhan_rong"]);
  }

  const hasForeignSummary = foreign.buy != null || foreign.sell != null || foreign.net != null;
  const hasProprietarySummary = proprietary.buy != null || proprietary.sell != null || proprietary.net != null;
  const hasRetailSummary = retail.buy != null || retail.sell != null || retail.net != null;

  const addToGroup = (group: "foreign" | "proprietary" | "retail", buy: number | null, sell: number | null, net: number | null) => {
    const target = group === "foreign" ? foreign : group === "proprietary" ? proprietary : retail;
    const nextBuy = (target.buy ?? 0) + (buy ?? 0);
    const nextSell = (target.sell ?? 0) + (sell ?? 0);
    const nextNet = (target.net ?? 0) + (net ?? ((buy ?? 0) - (sell ?? 0)));
    target.buy = Number.isFinite(nextBuy) ? nextBuy : target.buy;
    target.sell = Number.isFinite(nextSell) ? nextSell : target.sell;
    target.net = Number.isFinite(nextNet) ? nextNet : target.net;
  };

  const columns = Array.isArray(raw?.columns)
    ? raw.columns.map((col) => String(col))
    : [];
  for (const item of raw?.data ?? []) {
    let row: JsonRecord | null = null;
    if (Array.isArray(item)) {
      row = {};
      if (columns.length > 0) {
        columns.forEach((col, idx) => {
          row![col] = item[idx];
        });
      }
    } else if (typeof item === "object" && item !== null) {
      row = item as JsonRecord;
    }
    if (!row) continue;

    const label = extractGroupLabel(row);
    const group = inferGroup(label);
    const { buy, sell, net } = readBuySellNet(row);
    if (group) addToGroup(group, buy, sell, net);

    const foreignBuy = toBillion(
      pickNumber(row, [
        "foreignBuyValueMatched",
        "foreignBuyValueTotal",
        "foreignIndividualBuyTradingMatchValue",
        "foreignInstitutionalBuyTradingMatchValue",
      ]),
    );
    const foreignSell = toBillion(
      pickNumber(row, [
        "foreignSellValueMatched",
        "foreignSellValueTotal",
        "foreignIndividualSellTradingMatchValue",
        "foreignInstitutionalSellTradingMatchValue",
      ]),
    );
    if (!hasForeignSummary && (foreignBuy != null || foreignSell != null)) {
      addToGroup("foreign", foreignBuy, foreignSell, null);
    }

    const propBuy = toBillion(
      pickNumber(row, ["proprietaryTotalMatchBuyTradeValue", "proprietaryTotalBuyTradeValue"]),
    );
    const propSell = toBillion(
      pickNumber(row, ["proprietaryTotalMatchSellTradeValue", "proprietaryTotalSellTradeValue"]),
    );
    if (!hasProprietarySummary && (propBuy != null || propSell != null)) {
      addToGroup("proprietary", propBuy, propSell, null);
    }

    const retailBuy = toBillion(
      pickNumber(row, ["localIndividualBuyValue", "localIndividualBuyMatchValue"]),
    );
    const retailSell = toBillion(
      pickNumber(row, ["localIndividualSellValue", "localIndividualSellMatchValue"]),
    );
    if (!hasRetailSummary && (retailBuy != null || retailSell != null)) {
      addToGroup("retail", retailBuy, retailSell, null);
    }

    const exchange = extractExchange(row);
    const liquidityValue = readLiquidityValue(row);
    if (exchange && liquidityValue != null && liquidityValue > 0) {
      liquidityByExchange[exchange] = (liquidityByExchange[exchange] ?? 0) + liquidityValue;
    }
  }

  const sumLiquidity = (liquidityByExchange.HOSE ?? 0) + (liquidityByExchange.HNX ?? 0) + (liquidityByExchange.UPCOM ?? 0);
  liquidityByExchange.total = sumLiquidity > 0 ? sumLiquidity : null;

  if (foreign.buy != null) foreign.buy = toBillion(foreign.buy);
  if (foreign.sell != null) foreign.sell = toBillion(foreign.sell);
  if (foreign.net != null) foreign.net = toBillion(foreign.net);
  if (proprietary.buy != null) proprietary.buy = toBillion(proprietary.buy);
  if (proprietary.sell != null) proprietary.sell = toBillion(proprietary.sell);
  if (proprietary.net != null) proprietary.net = toBillion(proprietary.net);
  if (retail.buy != null) retail.buy = toBillion(retail.buy);
  if (retail.sell != null) retail.sell = toBillion(retail.sell);
  if (retail.net != null) retail.net = toBillion(retail.net);

  return {
    investorTrading: {
      foreign,
      proprietary,
      retail,
      availability: {
        foreign: foreign.net != null || foreign.buy != null || foreign.sell != null,
        proprietary: proprietary.net != null || proprietary.buy != null || proprietary.sell != null,
        retail: retail.net != null || retail.buy != null || retail.sell != null,
      },
    },
    liquidityByExchange,
  };
}

function parseBreadthFromFeed(raw: FiinMarketBreadthResponse | null): { up: number; down: number; unchanged: number } | null {
  const rows = Array.isArray(raw?.data) ? raw.data : [];
  if (rows.length === 0) return null;

  const validRows = rows.filter((row) => !(row?.error ?? "").toString().trim());
  if (validRows.length === 0) return null;

  const summed = validRows.reduce(
    (acc, row) => {
      acc.up += Number(row.up ?? 0);
      acc.down += Number(row.down ?? 0);
      acc.unchanged += Number(row.unchanged ?? 0);
      return acc;
    },
    { up: 0, down: 0, unchanged: 0 },
  );

  if (summed.up + summed.down + summed.unchanged <= 0) return null;
  return summed;
}

function parseRealtimeSupplyDemand(raw: FiinRealtimeResponse | null): MarketSnapshot["supplyDemand"] {
  if (!raw) {
    return {
      buyVolume: null,
      sellVolume: null,
      netVolume: null,
      buySellRatio: null,
      source: null,
    };
  }

  const summary = (raw.summary ?? {}) as JsonRecord;
  const data = Array.isArray(raw.data) ? raw.data : [];
  const latest = data.length > 0 ? (data[data.length - 1] as JsonRecord) : null;

  const buy =
    toNumber(summary.totalBuyVolume) ??
    toNumber(summary.buyVolume) ??
    toNumber(latest?.bu) ??
    toNumber(latest?.totalBuyTradeVolume) ??
    null;
  const sell =
    toNumber(summary.totalSellVolume) ??
    toNumber(summary.sellVolume) ??
    toNumber(latest?.sd) ??
    toNumber(latest?.totalSellTradeVolume) ??
    null;
  const net =
    toNumber(summary.netVolume) ??
    toNumber(latest?.netVolume) ??
    toNumber(latest?.fn) ??
    (buy != null && sell != null ? buy - sell : null);

  return {
    buyVolume: buy,
    sellVolume: sell,
    netVolume: net,
    buySellRatio: buy != null && sell != null && sell > 0 ? buy / sell : null,
    source: buy != null || sell != null || net != null ? "realtime" : null,
  };
}

function isValidLiquidity(value: number | null): value is number {
  return value != null && Number.isFinite(value) && value > 0;
}

function liquidityMismatch(overviewLiquidity: number | null, inferredLiquidity: number | null): boolean {
  if (!isValidLiquidity(overviewLiquidity) || !isValidLiquidity(inferredLiquidity)) return false;
  // Allow normal deviation range; reject clearly broken unit/source values.
  return inferredLiquidity < overviewLiquidity * 0.25 || inferredLiquidity > overviewLiquidity * 3.5;
}

/** Snapshot thị trường (dùng cho intraday notifications + briefs) */
export async function getMarketSnapshot(): Promise<MarketSnapshot> {
  const requestDateVN = getLatestTradingDateISO();
  const nowMs = Date.now();

  if (
    marketSnapshotCache &&
    marketSnapshotCache.requestDateVN === requestDateVN &&
    nowMs - marketSnapshotCache.timestampMs < SNAPSHOT_CACHE_TTL_MS
  ) {
    return marketSnapshotCache.data;
  }

  if (marketSnapshotInFlight) {
    return marketSnapshotInFlight;
  }

  marketSnapshotInFlight = (async () => {
    const providerDiagnostics: ProviderDiagnostic[] = [];

    const [
      overview,
      investorRawByDate,
      breadthFeed,
      realtimeVnindex,
      vnindex,
      hnxindex,
      upcomindex,
      vn30,
      movers,
      vnstockSnapshot,
      dnseSnapshot,
      tcbsSnapshot,
    ] = await Promise.all([
      fetchMarketOverview(),
      fetchInvestorTrading({
        fromDate: requestDateVN,
        toDate: requestDateVN,
      }),
      fetchMarketBreadth("VNINDEX,VN30,HNXINDEX,UPCOMINDEX"),
      fetchRealtimeTradingData("VNINDEX", "5m"),
      fetchIndexFromDchart("VNINDEX", providerDiagnostics, requestDateVN),
      fetchIndexFromDchart("HNXINDEX", providerDiagnostics, requestDateVN),
      fetchIndexFromDchart("UPCOMINDEX", providerDiagnostics, requestDateVN),
      fetchIndexFromDchart("VN30", providerDiagnostics, requestDateVN),
      fetchTopMovers(providerDiagnostics, requestDateVN),
      fetchVnstockMarketSnapshot(requestDateVN),
      fetchDnseMarketSnapshot(requestDateVN),
      fetchTcbsMarketSnapshot(requestDateVN),
    ]);

    if (!overview) {
      providerDiagnostics.push({
        provider: "FiinQuant",
        endpoint: "/api/v1/market-overview",
        requestDateVN,
        httpStatus: null,
        error: "No data",
        fallbackUsed: true,
      });
    }
    if (!breadthFeed) {
      providerDiagnostics.push({
        provider: "FiinQuant",
        endpoint: "/api/v1/market-breadth",
        requestDateVN,
        httpStatus: null,
        error: "No data",
        fallbackUsed: true,
      });
    }

    let investorRaw = investorRawByDate;
    if (!isInvestorPayloadUsable(investorRawByDate)) {
      investorRaw = await fetchInvestorTrading({
        fromDate: requestDateVN,
        toDate: requestDateVN,
      });
    }

    if (!isInvestorPayloadUsable(investorRaw)) {
      providerDiagnostics.push({
        provider: "FiinQuant",
        endpoint: "/api/v1/investor-trading",
        requestDateVN,
        httpStatus: null,
        error: "No data",
        fallbackUsed: true,
      });
    }

    const parsedInvestor = parseInvestorTradingData(investorRaw);

    if (!vnstockSnapshot) {
      providerDiagnostics.push({
        provider: "VNStock",
        endpoint: process.env.VNSTOCK_BRIDGE_URL ?? process.env.VNSTOCK_MARKET_SNAPSHOT_URL ?? "VNSTOCK_BRIDGE_URL(not-configured)",
        requestDateVN,
        httpStatus: null,
        error: "No data",
        fallbackUsed: true,
      });
    }

    if (!dnseSnapshot) {
      providerDiagnostics.push({
        provider: "DNSE",
        endpoint: process.env.DNSE_MARKET_SNAPSHOT_URL ?? "DNSE_MARKET_SNAPSHOT_URL(not-configured)",
        requestDateVN,
        httpStatus: null,
        error: "No data",
        fallbackUsed: true,
      });
    }

    if (!tcbsSnapshot) {
      providerDiagnostics.push({
        provider: "TCBS",
        endpoint: process.env.TCBS_MARKET_SNAPSHOT_URL ?? "TCBS_MARKET_SNAPSHOT_URL(not-configured)",
        requestDateVN,
        httpStatus: null,
        error: "No data",
        fallbackUsed: true,
      });
    }

    const providerOrder = getProviderOrder();

    parsedInvestor.liquidityByExchange.HOSE = pickRoundRobinValue(providerOrder, {
      fiin: parsedInvestor.liquidityByExchange.HOSE,
      vnd: null,
      vnstock: vnstockSnapshot?.liquidityByExchange.HOSE ?? null,
      dnse: dnseSnapshot?.liquidityByExchange.HOSE ?? null,
      tcbs: tcbsSnapshot?.liquidityByExchange.HOSE ?? null,
    });
    parsedInvestor.liquidityByExchange.HNX = pickRoundRobinValue(providerOrder, {
      fiin: parsedInvestor.liquidityByExchange.HNX,
      vnd: null,
      vnstock: vnstockSnapshot?.liquidityByExchange.HNX ?? null,
      dnse: dnseSnapshot?.liquidityByExchange.HNX ?? null,
      tcbs: tcbsSnapshot?.liquidityByExchange.HNX ?? null,
    });
    parsedInvestor.liquidityByExchange.UPCOM = pickRoundRobinValue(providerOrder, {
      fiin: parsedInvestor.liquidityByExchange.UPCOM,
      vnd: null,
      vnstock: vnstockSnapshot?.liquidityByExchange.UPCOM ?? null,
      dnse: dnseSnapshot?.liquidityByExchange.UPCOM ?? null,
      tcbs: tcbsSnapshot?.liquidityByExchange.UPCOM ?? null,
    });

    parsedInvestor.investorTrading.foreign.net = pickRoundRobinValue(providerOrder, {
      fiin: parsedInvestor.investorTrading.foreign.net,
      vnd: null,
      vnstock: vnstockSnapshot?.investorTrading.foreignNet ?? null,
      dnse: dnseSnapshot?.investorTrading.foreignNet ?? null,
      tcbs: tcbsSnapshot?.investorTrading.foreignNet ?? null,
    });
    parsedInvestor.investorTrading.proprietary.net = pickRoundRobinValue(providerOrder, {
      fiin: parsedInvestor.investorTrading.proprietary.net,
      vnd: null,
      vnstock: vnstockSnapshot?.investorTrading.proprietaryNet ?? null,
      dnse: dnseSnapshot?.investorTrading.proprietaryNet ?? null,
      tcbs: tcbsSnapshot?.investorTrading.proprietaryNet ?? null,
    });
    parsedInvestor.investorTrading.retail.net = pickRoundRobinValue(providerOrder, {
      fiin: parsedInvestor.investorTrading.retail.net,
      vnd: null,
      vnstock: vnstockSnapshot?.investorTrading.retailNet ?? null,
      dnse: dnseSnapshot?.investorTrading.retailNet ?? null,
      tcbs: tcbsSnapshot?.investorTrading.retailNet ?? null,
    });

    parsedInvestor.investorTrading.availability.foreign = parsedInvestor.investorTrading.foreign.net != null;
    parsedInvestor.investorTrading.availability.proprietary = parsedInvestor.investorTrading.proprietary.net != null;
    parsedInvestor.investorTrading.availability.retail = parsedInvestor.investorTrading.retail.net != null;

    const inferredExchangeTotal =
      (parsedInvestor.liquidityByExchange.HOSE ?? 0) +
      (parsedInvestor.liquidityByExchange.HNX ?? 0) +
      (parsedInvestor.liquidityByExchange.UPCOM ?? 0);
    const overviewLiquidity = overview ? parseLiquidity(overview.liquidity) : null;

    const allowInferredLiquidity =
      inferredExchangeTotal > 0 && !liquidityMismatch(overviewLiquidity, inferredExchangeTotal);

    if (inferredExchangeTotal > 0 && !allowInferredLiquidity && isValidLiquidity(overviewLiquidity)) {
      providerDiagnostics.push({
        provider: "liquidity-guard",
        endpoint: "snapshot-aggregation",
        requestDateVN,
        httpStatus: null,
        error: `Ignored inferred liquidity ${inferredExchangeTotal.toFixed(2)} due to mismatch vs overview ${overviewLiquidity.toFixed(2)}`,
        fallbackUsed: true,
      });
    }

    parsedInvestor.liquidityByExchange.total = allowInferredLiquidity ? inferredExchangeTotal : null;
    const totalLiquidity =
      parsedInvestor.liquidityByExchange.total ??
      (isValidLiquidity(overviewLiquidity) ? overviewLiquidity : null) ??
      (inferredExchangeTotal > 0 ? inferredExchangeTotal : null);

    const breadthFromFeed = parseBreadthFromFeed(breadthFeed);
    const breadth = breadthFromFeed ?? (overview ? parseBreadth(overview.market_breadth) : null);
    const supplyDemand = parseRealtimeSupplyDemand(realtimeVnindex);

    const indices: IndexData[] = [];
    if (vnindex) indices.push(vnindex);
    if (hnxindex) indices.push(hnxindex);
    if (upcomindex) indices.push(upcomindex);
    if (vn30) indices.push(vn30);

    const snapshot: MarketSnapshot = {
      timestamp: getVnNow().toISOString(),
      requestDateVN,
      providerDiagnostics,
      indices,
      breadth,
      supplyDemand,
      liquidity: totalLiquidity,
      liquidityByExchange: {
        HOSE: parsedInvestor.liquidityByExchange.HOSE,
        HNX: parsedInvestor.liquidityByExchange.HNX,
        UPCOM: parsedInvestor.liquidityByExchange.UPCOM,
        total: totalLiquidity,
      },
      investorTrading: parsedInvestor.investorTrading,
      marketOverview: overview,
      topGainers: movers.gainers,
      topLosers: movers.losers,
    };

    marketSnapshotCache = {
      requestDateVN,
      timestampMs: Date.now(),
      data: snapshot,
    };

    return snapshot;
  })();

  try {
    return await marketSnapshotInFlight;
  } finally {
    marketSnapshotInFlight = null;
  }
}

/** Lấy danh sách mã RS-Rating để scan tín hiệu */
export async function getRSRatingStocks(): Promise<string[]> {
  const rsStocks = await fetchRSRatingList();
  if (rsStocks && rsStocks.length > 0) {
    // Sắp xếp theo RS Rating giảm dần, lấy tất cả
    return rsStocks
      .sort((a, b) => b.rsRating - a.rsRating)
      .map((s) => s.symbol);
  }
  // Fallback: danh sách VN30 + mid-cap nếu FiinQuant không available
  return [
    "ACB","BCM","BID","BVH","CTG","FPT","GAS","GVR","HDB","HPG",
    "MBB","MSN","MWG","PLX","POW","SAB","SHB","SSB","SSI","STB",
    "TCB","TPB","VCB","VHM","VIB","VIC","VJC","VNM","VPB","VRE",
    "DGC","DPM","DGW","DCM","PNJ","REE","KDH","NLG","HDG","HSG",
    "NKG","DPG","PC1","DVN","SZC","GMD","ANV","VND","HCM","BSI",
    "PVD","PVS","HAG","DXG","KBC","IJC","LPB","OCB","EIB","TCH",
  ];
}

/** Fetch TA data cho nhiều mã cùng lúc (batch) */
export async function batchFetchTA(
  tickers: string[],
  batchSize = 10,
  delayMs = 500
): Promise<Map<string, TAData>> {
  const results = new Map<string, TAData>();

  for (let i = 0; i < tickers.length; i += batchSize) {
    const batch = tickers.slice(i, i + batchSize);
    const promises = batch.map(async (ticker) => {
      try {
        const data = await fetchTAData(ticker);
        if (data) results.set(ticker, data);
      } catch (err) {
        console.error(`[batchTA] ${ticker} error:`, err);
      }
    });

    await Promise.all(promises);

    if (i + batchSize < tickers.length) {
      await new Promise((r) => setTimeout(r, delayMs));
    }
  }

  return results;
}

/** Fetch Prop Trading (Tự Doanh) data */
export async function getPropTradingData(): Promise<FiinPropTrading | null> {
  return fetchPropTrading();
}

/** Fetch Market Breadth (Độ rộng thị trường) */
export async function getMarketBreadthData(
  indices = "VNINDEX,VN30,HNXINDEX,UPCOMINDEX"
): Promise<FiinMarketBreadthResponse | null> {
  return fetchMarketBreadth(indices);
}

/** Fetch Investor Trading (Tự Doanh NĐT) */
export async function getInvestorTradingData(options?: {
  tickers?: string;
  fromDate?: string;
  toDate?: string;
}): Promise<FiinInvestorTradingResponse | null> {
  return fetchInvestorTrading(options);
}

// ═══════════════════════════════════════════════
//  Data Formatting Helpers
// ═══════════════════════════════════════════════

/** Format market snapshot thành text context cho Gemini */
type InvestorMode = "intraday" | "close15" | "full19";

function formatInvestorValue(v: number | null): string {
  if (v == null || !Number.isFinite(v)) return "chưa cập nhật";
  return `${v >= 0 ? "+" : ""}${Math.abs(v).toFixed(1)} tỷ`;
}

export function getInvestorTradingText(snap: MarketSnapshot, mode: InvestorMode): string[] {
  const lines: string[] = [];
  const { foreign, proprietary, retail, availability } = snap.investorTrading;

  if (availability.foreign) {
    lines.push(`Khối ngoại: ${formatInvestorValue(foreign.net)}`);
  }

  if (mode === "intraday") {
    return lines;
  }

  if (mode === "close15") {
    if (availability.foreign && availability.retail) {
      lines.push(`Cá nhân: ${formatInvestorValue(retail.net)}`);
    }
    return lines;
  }

  if (availability.proprietary) {
    lines.push(`Tự doanh: ${formatInvestorValue(proprietary.net)}`);
  }
  if (availability.retail) {
    lines.push(`Cá nhân: ${formatInvestorValue(retail.net)}`);
  }
  return lines;
}

export function formatSnapshotForAI(
  snap: MarketSnapshot,
  options?: { investorMode?: InvestorMode }
): string {
  const investorMode = options?.investorMode ?? "intraday";
  const lines: string[] = [];
  lines.push("## DỮ LIỆU THỊ TRƯỜNG REAL-TIME");
  lines.push(`Thời gian: ${new Date(snap.timestamp).toLocaleString("vi-VN", { timeZone: "Asia/Ho_Chi_Minh" })}`);
  lines.push("");

  for (const idx of snap.indices) {
    const sign = idx.changePct >= 0 ? "+" : "";
    lines.push(`${idx.ticker}: ${idx.value.toLocaleString("vi-VN")} (${sign}${idx.changePct}%)`);
  }

  if (snap.breadth) {
    lines.push(`\nĐộ rộng: Tăng ${snap.breadth.up} | Giảm ${snap.breadth.down} | Đứng ${snap.breadth.unchanged}`);
  }

  if (
    snap.supplyDemand.buyVolume != null ||
    snap.supplyDemand.sellVolume != null ||
    snap.supplyDemand.netVolume != null
  ) {
    const fmtVol = (v: number | null) =>
      v == null ? "?" : Math.abs(v).toLocaleString("vi-VN", { maximumFractionDigits: 0 });
    const ratio =
      snap.supplyDemand.buySellRatio != null
        ? snap.supplyDemand.buySellRatio.toFixed(2)
        : "?";
    lines.push(
      `Cung/Cầu: Mua ${fmtVol(snap.supplyDemand.buyVolume)} | Bán ${fmtVol(
        snap.supplyDemand.sellVolume,
      )} | Ròng ${fmtVol(snap.supplyDemand.netVolume)} | Tỷ lệ B/S ${ratio}`,
    );
  }

  if (snap.liquidity) {
    const liqInTy = snap.liquidity > 1_000_000 ? snap.liquidity / 1_000_000_000 : snap.liquidity;
    lines.push(`Thanh khoản tổng: ${liqInTy.toFixed(0)} tỷ VNĐ`);
  }

  const byExchange = snap.liquidityByExchange;
  if (byExchange.HOSE != null || byExchange.HNX != null || byExchange.UPCOM != null) {
    const fmt = (v: number | null) => (v == null ? "?" : `${(v > 1_000_000 ? v / 1_000_000_000 : v).toFixed(0)} tỷ`);
    lines.push(`Thanh khoản sàn: HoSE ${fmt(byExchange.HOSE)} | HNX ${fmt(byExchange.HNX)} | UPCoM ${fmt(byExchange.UPCOM)}`);
  }

  const investorLines = getInvestorTradingText(snap, investorMode);
  if (investorLines.length > 0) {
    lines.push(`\nDòng tiền NĐT:`);
    for (const line of investorLines) {
      lines.push(`- ${line}`);
    }
  }

  if (snap.marketOverview) {
    const mo = snap.marketOverview;
    lines.push(`\nĐiểm sức khỏe thị trường: ${mo.score}/${mo.max_score} (${mo.status_badge})`);
    if (mo.technical_highlights) {
      const th = mo.technical_highlights;
      if (th.ema) lines.push(`  EMA: ${th.ema}`);
      if (th.vsa) lines.push(`  VSA: ${th.vsa}`);
    }
  }

  if (snap.topGainers.length > 0) {
    lines.push(`\nTop tăng: ${snap.topGainers.slice(0, 10).map((s) => `${s.ticker}(+${s.changePct}%)`).join(", ")}`);
  }
  if (snap.topLosers.length > 0) {
    lines.push(`Top giảm: ${snap.topLosers.slice(0, 10).map((s) => `${s.ticker}(${s.changePct}%)`).join(", ")}`);
  }

  return lines.join("\n");
}

/** Format prop trading thành text */
export function formatPropTradingForAI(prop: FiinPropTrading): string {
  const lines: string[] = [];
  lines.push("## DỮ LIỆU TỰ DOANH CTCK (REAL-TIME)");
  lines.push(`Ngày: ${prop.date}`);
  lines.push(`Tổng mua: ${prop.totalBuy.toLocaleString("vi-VN")} tỷ VNĐ`);
  lines.push(`Tổng bán: ${prop.totalSell.toLocaleString("vi-VN")} tỷ VNĐ`);
  lines.push(`Ròng: ${prop.netValue >= 0 ? "MUA ròng" : "BÁN ròng"} ${Math.abs(prop.netValue).toLocaleString("vi-VN")} tỷ VNĐ`);

  if (prop.topBuy.length > 0) {
    lines.push(`\nTop mua ròng: ${prop.topBuy.slice(0, 5).map((s) => `${s.ticker}(${s.value.toLocaleString("vi-VN")} tỷ)`).join(", ")}`);
  }
  if (prop.topSell.length > 0) {
    lines.push(`Top bán ròng: ${prop.topSell.slice(0, 5).map((s) => `${s.ticker}(${s.value.toLocaleString("vi-VN")} tỷ)`).join(", ")}`);
  }

  return lines.join("\n");
}
