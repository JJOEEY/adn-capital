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
  type FiinMarketOverview,
  type FiinPropTrading,
  type FiinMarketBreadthResponse,
  type FiinInvestorTradingResponse,
} from "./fiinquantClient";
import { getVnDateISO, getVnNow } from "./time";
import { fetchDnseMarketSnapshot } from "./dnseClient";

type JsonRecord = Record<string, unknown>;
type ProviderId = "fiin" | "vnd" | "dnse" | "tcbs";

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

const PROVIDER_RING: ProviderId[] = ["fiin", "vnd", "dnse", "tcbs"];

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
    const upMatch = raw.match(/[Tt]ăng[:\s]+(\d+)/);
    const downMatch = raw.match(/[Gg]iảm[:\s]+(\d+)/);
    const unchMatch = raw.match(/(?:[Kk]hông đổi|[Đđ]ứng)[:\s]+(\d+)/);

    if (upMatch || downMatch) {
      return {
        up: upMatch ? parseInt(upMatch[1]) : 0,
        down: downMatch ? parseInt(downMatch[1]) : 0,
        unchanged: unchMatch ? parseInt(unchMatch[1]) : 0,
      };
    }
  }

  return null;
}

function parseLiquidity(raw: unknown): number | null {
  if (typeof raw === "number") return raw;
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

function pickNumber(obj: JsonRecord, keys: string[]): number | null {
  for (const key of keys) {
    if (!(key in obj)) continue;
    const num = toNumber(obj[key]);
    if (num !== null) return num;
  }
  return null;
}

function inferGroup(raw: string): "foreign" | "proprietary" | "retail" | null {
  const value = raw.toLowerCase();
  if (/(ngo[aạ]i|foreign|nn\b)/i.test(value)) return "foreign";
  if (/(t[ựu]\s*doanh|proprietary|tu_doanh)/i.test(value)) return "proprietary";
  if (/(c[aá]\s*nh[aâ]n|retail|individual)/i.test(value)) return "retail";
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
  if (value.includes("HOSE") || value.includes("VNINDEX") || value.includes("VN30")) return "HOSE";
  if (value.includes("HNX")) return "HNX";
  if (value.includes("UPCOM")) return "UPCOM";
  return null;
}

function extractExchange(row: JsonRecord): "HOSE" | "HNX" | "UPCOM" | null {
  const keys = ["exchange", "market", "index", "ticker", "symbol"];
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
    "matchValue",
    "match_value",
    "trading_value",
    "value",
    "gtgd",
    "gtgd_ty",
  ]);
}

function readBuySellNet(row: JsonRecord): { buy: number | null; sell: number | null; net: number | null } {
  const buy = pickNumber(row, ["buy", "buy_value", "buyValue", "buy_bn", "mua", "mua_rong"]);
  const sell = pickNumber(row, ["sell", "sell_value", "sellValue", "sell_bn", "ban", "ban_rong"]);
  const net = pickNumber(row, ["net", "net_value", "netValue", "net_bn", "rong", "gia_tri_rong"]);
  return { buy, sell, net: net ?? (buy != null && sell != null ? buy - sell : null) };
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

// ═══════════════════════════════════════════════
//  Aggregated Data Fetchers
// ═══════════════════════════════════════════════

export interface MarketSnapshot {
  timestamp: string;
  requestDateVN: string;
  providerDiagnostics: ProviderDiagnostic[];
  indices: IndexData[];
  breadth: { up: number; down: number; unchanged: number } | null;
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

  const addToGroup = (group: "foreign" | "proprietary" | "retail", buy: number | null, sell: number | null, net: number | null) => {
    const target = group === "foreign" ? foreign : group === "proprietary" ? proprietary : retail;
    const nextBuy = (target.buy ?? 0) + (buy ?? 0);
    const nextSell = (target.sell ?? 0) + (sell ?? 0);
    const nextNet = (target.net ?? 0) + (net ?? ((buy ?? 0) - (sell ?? 0)));
    target.buy = Number.isFinite(nextBuy) ? nextBuy : target.buy;
    target.sell = Number.isFinite(nextSell) ? nextSell : target.sell;
    target.net = Number.isFinite(nextNet) ? nextNet : target.net;
  };

  for (const item of raw?.data ?? []) {
    if (typeof item !== "object" || item === null) continue;
    const row = item as JsonRecord;
    const label = extractGroupLabel(row);
    const group = inferGroup(label);
    const { buy, sell, net } = readBuySellNet(row);
    if (group) addToGroup(group, buy, sell, net);

    const exchange = extractExchange(row);
    const liquidityValue = readLiquidityValue(row);
    if (exchange && liquidityValue != null && liquidityValue > 0) {
      liquidityByExchange[exchange] = (liquidityByExchange[exchange] ?? 0) + liquidityValue;
    }
  }

  const sumLiquidity = (liquidityByExchange.HOSE ?? 0) + (liquidityByExchange.HNX ?? 0) + (liquidityByExchange.UPCOM ?? 0);
  liquidityByExchange.total = sumLiquidity > 0 ? sumLiquidity : null;

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

/** Snapshot thị trường (dùng cho intraday notifications + briefs) */
export async function getMarketSnapshot(): Promise<MarketSnapshot> {
  // Fetch song song: FiinQuant overview + VNDirect indices + top movers
  const requestDateVN = getVnDateISO();
  const providerDiagnostics: ProviderDiagnostic[] = [];

  const [overview, investorRaw, vnindex, hnxindex, upcomindex, vn30, movers, dnseSnapshot, tcbsSnapshot] = await Promise.all([
    fetchMarketOverview(),
    fetchInvestorTrading({
      tickers: "VNINDEX,HNXINDEX,UPCOMINDEX",
      fromDate: requestDateVN,
      toDate: requestDateVN,
    }),
    fetchIndexFromDchart("VNINDEX", providerDiagnostics, requestDateVN),
    fetchIndexFromDchart("HNXINDEX", providerDiagnostics, requestDateVN),
    fetchIndexFromDchart("UPCOMINDEX", providerDiagnostics, requestDateVN),
    fetchIndexFromDchart("VN30", providerDiagnostics, requestDateVN),
    fetchTopMovers(providerDiagnostics, requestDateVN),
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
  if (!investorRaw) {
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
    dnse: dnseSnapshot?.liquidityByExchange.HOSE ?? null,
    tcbs: tcbsSnapshot?.liquidityByExchange.HOSE ?? null,
  });
  parsedInvestor.liquidityByExchange.HNX = pickRoundRobinValue(providerOrder, {
    fiin: parsedInvestor.liquidityByExchange.HNX,
    vnd: null,
    dnse: dnseSnapshot?.liquidityByExchange.HNX ?? null,
    tcbs: tcbsSnapshot?.liquidityByExchange.HNX ?? null,
  });
  parsedInvestor.liquidityByExchange.UPCOM = pickRoundRobinValue(providerOrder, {
    fiin: parsedInvestor.liquidityByExchange.UPCOM,
    vnd: null,
    dnse: dnseSnapshot?.liquidityByExchange.UPCOM ?? null,
    tcbs: tcbsSnapshot?.liquidityByExchange.UPCOM ?? null,
  });

  parsedInvestor.investorTrading.foreign.net = pickRoundRobinValue(providerOrder, {
    fiin: parsedInvestor.investorTrading.foreign.net,
    vnd: null,
    dnse: dnseSnapshot?.investorTrading.foreignNet ?? null,
    tcbs: tcbsSnapshot?.investorTrading.foreignNet ?? null,
  });
  parsedInvestor.investorTrading.proprietary.net = pickRoundRobinValue(providerOrder, {
    fiin: parsedInvestor.investorTrading.proprietary.net,
    vnd: null,
    dnse: dnseSnapshot?.investorTrading.proprietaryNet ?? null,
    tcbs: tcbsSnapshot?.investorTrading.proprietaryNet ?? null,
  });
  parsedInvestor.investorTrading.retail.net = pickRoundRobinValue(providerOrder, {
    fiin: parsedInvestor.investorTrading.retail.net,
    vnd: null,
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
  if (inferredExchangeTotal > 0) {
    parsedInvestor.liquidityByExchange.total = inferredExchangeTotal;
  }
  const overviewLiquidity = overview ? parseLiquidity(overview.liquidity) : null;
  const totalLiquidity = overviewLiquidity ?? parsedInvestor.liquidityByExchange.total;

  const indices: IndexData[] = [];
  if (vnindex) indices.push(vnindex);
  if (hnxindex) indices.push(hnxindex);
  if (upcomindex) indices.push(upcomindex);
  if (vn30) indices.push(vn30);

  return {
    timestamp: getVnNow().toISOString(),
    requestDateVN,
    providerDiagnostics,
    indices,
    breadth: overview ? parseBreadth(overview.market_breadth) : null,
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
