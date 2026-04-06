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
  fetchIntradaySnapshot,
  fetchPropTrading,
  type FiinMarketOverview,
  type FiinRSRating,
  type FiinIntradaySnapshot,
  type FiinPropTrading,
} from "./fiinquantClient";

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

async function fetchIndexFromDchart(symbol: string): Promise<IndexData | null> {
  try {
    const now = Math.floor(Date.now() / 1000);
    const from = now - 5 * 86400; // 5 ngày
    const url = `${DCHART_BASE}?resolution=D&symbol=${symbol}&from=${from}&to=${now}`;

    const res = await fetch(url, {
      signal: AbortSignal.timeout(10_000),
      headers: { "User-Agent": "Mozilla/5.0" },
    });
    if (!res.ok) return null;

    const data = await res.json();
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
    return null;
  }
}

// ═══════════════════════════════════════════════
//  Aggregated Data Fetchers
// ═══════════════════════════════════════════════

export interface MarketSnapshot {
  timestamp: string;
  indices: IndexData[];
  breadth: { up: number; down: number; unchanged: number } | null;
  liquidity: number | null;
  marketOverview: FiinMarketOverview | null;
  topGainers: Array<{ ticker: string; changePct: number }>;
  topLosers: Array<{ ticker: string; changePct: number }>;
}

/** Snapshot thị trường (dùng cho intraday notifications + briefs) */
export async function getMarketSnapshot(): Promise<MarketSnapshot> {
  // Fetch song song: FiinQuant + VNDirect indices
  const [overview, fiinSnapshot, vnindex, hnx, vn30] = await Promise.all([
    fetchMarketOverview(),
    fetchIntradaySnapshot(),
    fetchIndexFromDchart("VNINDEX"),
    fetchIndexFromDchart("HNX"),
    fetchIndexFromDchart("VN30"),
  ]);

  const indices: IndexData[] = [];
  if (vnindex) indices.push(vnindex);
  if (hnx) indices.push(hnx);
  if (vn30) indices.push(vn30);

  return {
    timestamp: new Date().toISOString(),
    indices,
    breadth: fiinSnapshot?.breadth
      ? fiinSnapshot.breadth
      : overview?.market_breadth ?? null,
    liquidity: fiinSnapshot?.liquidity ?? overview?.liquidity?.total ?? null,
    marketOverview: overview,
    topGainers: fiinSnapshot?.topGainers ?? [],
    topLosers: fiinSnapshot?.topLosers ?? [],
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

// ═══════════════════════════════════════════════
//  Data Formatting Helpers
// ═══════════════════════════════════════════════

/** Format market snapshot thành text context cho Gemini */
export function formatSnapshotForAI(snap: MarketSnapshot): string {
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
    lines.push(`Thanh khoản: ${(snap.liquidity / 1_000_000_000).toFixed(0)} tỷ VNĐ`);
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
