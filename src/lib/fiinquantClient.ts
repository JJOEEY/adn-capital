/**
 * FiinQuant Client — Gọi Python backend (FastAPI) đã tích hợp fiinquant library.
 * 
 * Credentials FiinQuant được lưu trong .env:
 *   FIINQUANT_URL, FIINQUANT_USERNAME, FIINQUANT_PASSWORD
 * 
 * Python backend xử lý auth + data fetch → trả JSON cho Next.js.
 * Module này cung cấp typed wrappers cho các endpoint.
 */

const BACKEND = () => process.env.FIINQUANT_URL ?? "http://localhost:8000";
const TIMEOUT = 30_000;

// ═══════════════════════════════════════════════
//  Interfaces
// ═══════════════════════════════════════════════

export interface FiinMarketOverview {
  ticker: string;
  score: number;
  max_score: number;
  level: number;
  status_badge: string;
  market_breadth: string | {
    up: number;
    down: number;
    unchanged: number;
    total: number;
  };
  technical_highlights: {
    ema: string;
    vsa: string;
    divergence: string;
    monthly: string;
    weekly: string;
  };
  reasons: string[];
  action_message: string;
  liquidity: number | { total: number; change_pct: number };
  price: number | { current: number; change: number; change_pct: number };
}

export interface FiinTASummary {
  ticker: string;
  dataDate: string;
  totalSessions: number;
  price: {
    current: number;
    prevClose: number;
    change: number;
    changePct: number;
    high52w: number;
    low52w: number;
  };
  trend: {
    direction: string;
    strength: string;
    adx: number;
    adxPlus: number;
    adxMinus: number;
  };
  indicators: {
    ema10: number;
    ema20: number;
    ema50: number;
    ema200: number;
    rsi14: number;
    macd: { macd: number; signal: number; histogram: number };
    stoch: { k: number; d: number };
    bb: { upper: number; middle: number; lower: number };
    mfi14: number;
  };
  levels: { support: number[]; resistance: number[] };
  volume: { last: number; avg10: number; avg20: number; ratio: number };
  signal: string;
  bullishScore: number;
  bearishScore: number;
  patterns: string[];
}

export interface FiinRSRating {
  symbol: string;          // mapped from "ticker"
  name: string;
  sector: string;
  price: number;           // mapped from "close"
  change: number;
  changePercent: number;
  volume: number;
  rsScore: number;
  rsRating: number;
  // Raw fields from API (may be present)
  ticker?: string;
  close?: number;
  prev_close?: number;
  rs_rating?: number;
}

export interface FiinPropTrading {
  date: string;
  totalBuy: number;
  totalSell: number;
  netValue: number;
  topBuy: Array<{ ticker: string; value: number }>;
  topSell: Array<{ ticker: string; value: number }>;
}

export interface FiinMarketBreadthItem {
  index: string;
  up: number;
  down: number;
  unchanged: number;
  ceiling: number;
  floor: number;
  total: number;
  error?: string;
}

export interface FiinMarketBreadthResponse {
  data: FiinMarketBreadthItem[];
  count: number;
}

export interface FiinInvestorTradingSummary {
  proprietary?: {
    total_buy_bn: number;
    total_sell_bn: number;
    total_net_bn: number;
    top_buy: Array<{ ticker: string; net_bn: number }>;
    top_sell: Array<{ ticker: string; net_bn: number }>;
  };
}

export interface FiinInvestorTradingResponse {
  data: Record<string, unknown>[];
  summary: FiinInvestorTradingSummary;
  columns: string[];
  count: number;
  from_date: string;
  to_date: string;
}

export interface FiinMorningNews {
  date: string;
  reference_indices: Array<{ name: string; value: number; change_pct: number }>;
  vn_market: string[];
  macro: string[];
  risk_opportunity: string[];
}

export interface FiinEodNews {
  date: string;
  vnindex: number;
  change_pct: number;
  liquidity: number;
  breadth: { up: number; down: number; unchanged: number; total: number };
  session_summary: string;
  liquidity_detail: string;
  foreign_flow: string;
  notable_trades: string;
  outlook: string;
  sub_indices: Array<{ name: string; change_pts: number; change_pct: number }>;
  foreign_top_buy: string[];
  foreign_top_sell: string[];
  prop_trading_top_buy: string[];
  prop_trading_top_sell: string[];
  sector_gainers: string[];
  sector_losers: string[];
  buy_signals: string[];
  sell_signals: string[];
  top_breakout: string[];
}

export interface FiinIntradaySnapshot {
  timestamp: string;
  vnindex: { value: number; change: number; changePct: number };
  hnx: { value: number; change: number; changePct: number };
  breadth: { up: number; down: number; unchanged: number };
  liquidity: number;
  topGainers: Array<{ ticker: string; changePct: number }>;
  topLosers: Array<{ ticker: string; changePct: number }>;
  topVolume: Array<{ ticker: string; volume: number }>;
}

export interface FiinRealtimePoint {
  ticker?: string;
  date?: string;
  open?: number;
  high?: number;
  low?: number;
  close?: number;
  volume?: number;
  bu?: number;
  sd?: number;
  fn?: number;
  fs?: number;
  fb?: number;
  [key: string]: unknown;
}

export interface FiinRealtimeResponse {
  ticker: string;
  timeframe?: string;
  date?: string;
  count?: number;
  summary?: {
    totalBuyVolume?: number;
    totalSellVolume?: number;
    netVolume?: number;
    [key: string]: unknown;
  };
  data?: FiinRealtimePoint[];
  [key: string]: unknown;
}

// ═══════════════════════════════════════════════
//  Generic Fetch Helper
// ═══════════════════════════════════════════════

async function fiinFetch<T>(path: string, options?: { timeout?: number }): Promise<T | null> {
  try {
    const res = await fetch(`${BACKEND()}${path}`, {
      cache: "no-store",
      signal: AbortSignal.timeout(options?.timeout ?? TIMEOUT),
      headers: {
        "Content-Type": "application/json",
        // Python backend quản lý FiinQuant auth nội bộ
        "x-api-key": process.env.FIINQUANT_API_KEY ?? "",
      },
    });

    if (!res.ok) {
      console.error(`[FiinQuant] ${path} → ${res.status}`);
      return null;
    }

    const raw = await res.text();
    if (!raw?.trim()) {
      console.error(`[FiinQuant] ${path} -> empty body`);
      return null;
    }

    try {
      return JSON.parse(raw) as T;
    } catch (err) {
      console.error(`[FiinQuant] ${path} -> invalid JSON`, err);
      return null;
    }
  } catch (err) {
    console.error(`[FiinQuant] ${path} error:`, err);
    return null;
  }
}

// ═══════════════════════════════════════════════
//  API Endpoints
// ═══════════════════════════════════════════════

/** Market Overview (VNINDEX health score) */
export async function fetchMarketOverview(): Promise<FiinMarketOverview | null> {
  return fiinFetch<FiinMarketOverview>("/api/v1/market-overview");
}

/** TA Summary cho 1 mã cổ phiếu */
export async function fetchTASummary(ticker: string): Promise<FiinTASummary | null> {
  return fiinFetch<FiinTASummary>(`/api/v1/ta-summary/${ticker}`);
}

/** RS-Rating danh sách cổ phiếu */
export async function fetchRSRatingList(): Promise<FiinRSRating[] | null> {
  // API trả về { count, data: [{ticker, sector, close, prev_close, rs_rating}] }
  const raw = await fiinFetch<{ data?: unknown[]; stocks?: FiinRSRating[] }>("/api/v1/rs-rating");
  if (!raw) return null;

  const items = raw.data ?? raw.stocks ?? [];
  if (!Array.isArray(items) || items.length === 0) return null;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return (items as any[]).map((s: Record<string, unknown>) => {
    const close = Number(s.close ?? s.price ?? 0);
    const prevClose = Number(s.prev_close ?? s.prevClose ?? close);
    const changePct = prevClose > 0 ? ((close - prevClose) / prevClose) * 100 : 0;
    return {
      symbol: String(s.ticker ?? s.symbol ?? ""),
      ticker: String(s.ticker ?? s.symbol ?? ""),
      name: String(s.name ?? ""),
      sector: String(s.sector ?? ""),
      price: close,
      close,
      prev_close: prevClose,
      change: close - prevClose,
      changePercent: Math.round(changePct * 100) / 100,
      volume: Number(s.volume ?? 0),
      rsScore: Number(s.rs_score ?? s.rsScore ?? 0),
      rsRating: Number(s.rs_rating ?? s.rsRating ?? 0),
      rs_rating: Number(s.rs_rating ?? s.rsRating ?? 0),
    } as FiinRSRating;
  });
}

/** Dữ liệu Tự Doanh CTCK */
export async function fetchPropTrading(): Promise<FiinPropTrading | null> {
  return fiinFetch<FiinPropTrading>("/api/v1/prop-trading", { timeout: 60_000 });
}

/** Morning News (Gemini + real data from Python) */
export async function fetchMorningNews(): Promise<FiinMorningNews | null> {
  return fiinFetch<FiinMorningNews>("/api/v1/news/morning", { timeout: 60_000 });
}

/** EOD News */
export async function fetchEodNews(): Promise<FiinEodNews | null> {
  return fiinFetch<FiinEodNews>("/api/v1/news/eod", { timeout: 60_000 });
}

/** Intraday Market Snapshot (realtime) */
export async function fetchIntradaySnapshot(): Promise<FiinIntradaySnapshot | null> {
  return fiinFetch<FiinIntradaySnapshot>("/api/v1/market-snapshot");
}

/** Dữ liệu realtime theo mã (nền tảng Trading_Data_Stream/Fetch_Trading_Data từ bridge) */
export async function fetchRealtimeTradingData(
  ticker: string,
  timeframe = "5m"
): Promise<FiinRealtimeResponse | null> {
  const normalized = ticker.trim().toUpperCase();
  if (!normalized) return null;
  return fiinFetch<FiinRealtimeResponse>(
    `/api/v1/realtime/${encodeURIComponent(normalized)}?timeframe=${encodeURIComponent(timeframe)}`
  );
}

/** Scan Now (VIP feature — full market scanner) */
export async function fetchScanNow(): Promise<unknown> {
  return fiinFetch("/api/v1/scan-now", { timeout: 120_000 });
}

/** Độ rộng thị trường (MarketBreadth) — số mã tăng/giảm/trần/sàn */
export async function fetchMarketBreadth(
  tickers = "VNINDEX,VN30,HNXINDEX,UPCOMINDEX"
): Promise<FiinMarketBreadthResponse | null> {
  return fiinFetch<FiinMarketBreadthResponse>(
    `/api/v1/market-breadth?tickers=${encodeURIComponent(tickers)}`
  );
}

/** Dữ liệu giao dịch theo NĐT (Tự Doanh, Khối Ngoại...) */
export async function fetchInvestorTrading(options?: {
  tickers?: string;
  fromDate?: string;
  toDate?: string;
}): Promise<FiinInvestorTradingResponse | null> {
  const params = new URLSearchParams();
  if (options?.tickers) params.set("tickers", options.tickers);
  if (options?.fromDate) params.set("from_date", options.fromDate);
  if (options?.toDate) params.set("to_date", options.toDate);
  const qs = params.toString();
  return fiinFetch<FiinInvestorTradingResponse>(
    `/api/v1/investor-trading${qs ? `?${qs}` : ""}`,
    { timeout: 60_000 }
  );
}
