/**
 * stockData.ts
 * Module fetching dữ liệu chứng khoán thực từ VNDirect dchart API (public, không cần auth).
 *
 * Endpoint OHLCV:
 *   https://dchart-api.vndirect.com.vn/dchart/history
 *     ?resolution=D&symbol={TICKER}&from={unix}&to={unix}
 *
 * Giá trả về theo đơn vị "nghìn đồng" => nhân x1000 ra VNĐ thực.
 * Ví dụ: DGC close=49.1 => 49,100 VNĐ.
 */

import { getPythonBridgeUrl } from "@/lib/runtime-config";

const DCHART_BASE = "https://dchart-api.vndirect.com.vn/dchart/history";

// Header giả lập browser, tránh bị chặn
const FETCH_HEADERS: HeadersInit = {
  "User-Agent":
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
  "Accept": "*/*",
  "Referer": "https://dchart.vndirect.com.vn/",
  "Origin": "https://dchart.vndirect.com.vn",
};

// ═══════════════════════════════════════════════
//  PHẦN 1: Lookup sàn (HNX/UPCOM/HOSE)
//  VNDirect dchart không trả về exchange,
//  nên ta dùng danh sách nhúng sẵn.
//  HOSE = mặc định nếu không thuộc HNX/UPCOM.
// ═══════════════════════════════════════════════

const HNX_STOCKS = new Set([
  "SHB","NVB","PVS","VCS","TNG","HUT","BVS","IDC","PVI","MBB",
  "ACB","TV2","TDN","VCG","SCI","HHC","DGW","HBC","KLB","LAS",
  "MAS","NTP","PLC","PPE","PPT","SLS","TCS","VC3","VGC","VMC",
  "VNR","VND","VDS","BVH","HNX","CEO","DDG","HEM","HFC","HLD",
  "KSD","NBB","NHA","NHC","NST","NTP","PDB","PPC","PTK","QST",
  "SDA","SHI","SKV","SNN","SRS","STB","STC","SVN","TAC","THA",
  "THD","TIG","TMX","TNT","TPC","TPP","TRS","TST","TTZ","TXM",
  "UNI","VBH","VCR","VDL","VDT","VFG","VHE","VHL","VMP","VNC",
  "VNN","VNS","VOC","VRE","VTC","VXB","WCS","WIN",
]);
const UPCOM_STOCKS = new Set([
  "BSR","OIL","QNS","ACV","MCH","MSR","VTP","SBS","DIC","BCG",
  "LHG","NTC","VEA","HVN","MPC","BAB","BAF","VGT","SIP","DXS",
  "ELP","GVR","HAH","HAX","HPX","HQC","ICT","IDI","ILS","KBC",
  "L14","LAF","LBC","LCM","LCS","LEC","LGL","LHC","LHS","LIG",
]);

/** Tra sàn từ danh sách tĩnh. Mặc định HOSE. */
function lookupExchange(ticker: string): string {
  const upper = ticker.toUpperCase();
  if (HNX_STOCKS.has(upper)) return "HNX";
  if (UPCOM_STOCKS.has(upper)) return "UPCOM";
  return "HOSE";
}

// ═══════════════════════════════════════════════
//  PHẦN 2: Tính chỉ báo kỹ thuật
// ═══════════════════════════════════════════════

/** Tính mảng EMA đầy đủ. Index < period-1 = 0. */
function calcAllEMAs(closes: number[], period: number): number[] {
  const result = new Array(closes.length).fill(0);
  if (closes.length < period) return result;
  let sum = 0;
  for (let i = 0; i < period; i++) sum += closes[i];
  result[period - 1] = sum / period;
  const k = 2 / (period + 1);
  for (let i = period; i < closes.length; i++) {
    result[i] = closes[i] * k + result[i - 1] * (1 - k);
  }
  return result;
}

/** EMA tại điểm cuối mảng. Làm tròn đến hàng trăm cho giá VNĐ. */
function calcLastEMA(closes: number[], period: number): number {
  const emas = calcAllEMAs(closes, period);
  return Math.round(emas[emas.length - 1] / 100) * 100;
}

/** RSI(14) theo Wilder Smoothing. Trả 50 nếu không đủ data. */
function calcRSI(closes: number[], period = 14): number {
  if (closes.length < period + 2) return 50;
  const changes = closes.slice(1).map((c, i) => c - closes[i]);
  let avgGain = 0;
  let avgLoss = 0;
  for (let i = 0; i < period; i++) {
    if (changes[i] > 0) avgGain += changes[i];
    else avgLoss -= changes[i];
  }
  avgGain /= period;
  avgLoss /= period;
  for (let i = period; i < changes.length; i++) {
    const gain = changes[i] > 0 ? changes[i] : 0;
    const loss = changes[i] < 0 ? -changes[i] : 0;
    avgGain = (avgGain * (period - 1) + gain) / period;
    avgLoss = (avgLoss * (period - 1) + loss) / period;
  }
  if (avgLoss === 0) return 100;
  return +(100 - 100 / (1 + avgGain / avgLoss)).toFixed(1);
}

/** MACD(12,26,9). Cần ít nhất 35 nến. Trả null nếu thiếu. */
function calcMACD(
  closes: number[]
): { macd: number; signal: number; histogram: number; histogramPrev: number } | null {
  if (closes.length < 35) return null;
  const ema12 = calcAllEMAs(closes, 12);
  const ema26 = calcAllEMAs(closes, 26);
  const macdLine: number[] = [];
  for (let i = 25; i < closes.length; i++) macdLine.push(ema12[i] - ema26[i]);
  if (macdLine.length < 9) return null;
  const sig = calcAllEMAs(macdLine, 9);
  const macd = macdLine[macdLine.length - 1];
  const macdPrev = macdLine[macdLine.length - 2];
  const signal = sig[sig.length - 1];
  const signalPrev = sig[sig.length - 2];
  const histogram = macd - signal;
  const histogramPrev = macdPrev - signalPrev;
  return {
    macd: +macd.toFixed(3),
    signal: +signal.toFixed(3),
    histogram: +histogram.toFixed(3),
    histogramPrev: +histogramPrev.toFixed(3),
  };
}

/** Bollinger Bands (SMA20 ± 2*StdDev). Trả null nếu thiếu data. */
function calcBollingerBands(
  closes: number[],
  period = 20,
  mult = 2
): { upper: number; middle: number; lower: number } | null {
  if (closes.length < period) return null;
  const slice = closes.slice(-period);
  const sma = slice.reduce((s, v) => s + v, 0) / period;
  const variance = slice.reduce((s, v) => s + (v - sma) ** 2, 0) / period;
  const stdDev = Math.sqrt(variance);
  return {
    upper: Math.round((sma + mult * stdDev) / 100) * 100,
    middle: Math.round(sma / 100) * 100,
    lower: Math.round((sma - mult * stdDev) / 100) * 100,
  };
}

// ═══════════════════════════════════════════════
//  PHẦN 3: Interfaces
// ═══════════════════════════════════════════════

export interface TAData {
  ticker: string;
  exchange: string;
  currentPrice: number;
  ceiling: number;
  floor: number;
  refPrice: number;
  change: number;
  changePct: number;
  volume10: number[];
  avgVolume10: number;
  ema10: number;
  ema20: number;
  ema30: number;
  ema50: number;
  rsi14: number;
  macd: { macd: number; signal: number; histogram: number; histogramPrev: number } | null;
  bollinger: { upper: number; middle: number; lower: number } | null;
  avgVolume20: number;
  prevClose: number;
  prevEma10: number;
  prevEma20: number;
  high52w: number;
  low52w: number;
  dataDate: string;
  source: string;
}

export interface FAData {
  ticker: string;
  pe: number | null;
  pb: number | null;
  eps: number | null;
  roe: number | null;
  roa: number | null;
  revenueLastQ: number | null;
  profitLastQ: number | null;
  revenueGrowthYoY: number | null;
  profitGrowthYoY: number | null;
  reportDate: string | null;
  source: string;
}

// ═══════════════════════════════════════════════
//  PHẦN 4: Fetch dữ liệu
// ═══════════════════════════════════════════════

/**
 * Fetch dữ liệu TA thực từ VNDirect dchart API.
 *
 * Lấy 70 phiên (đủ cho EMA50, RSI14, MACD26).
 * Giá trả về nghìn đồng → nhân x1000 → VNĐ.
 * Log chi tiết mọi lỗi HTTP ra console backend.
 *
 * @param ticker - Mã cổ phiếu (VD: "DGC", "SSI")
 * @returns TAData đầy đủ, hoặc null nếu lỗi
 */
export async function fetchTAData(ticker: string): Promise<TAData | null> {
  const code = ticker.toUpperCase();

  try {
    const now  = Math.floor(Date.now() / 1000);
    const from = now - 90 * 86400; // 90 ngày trước ~ đủ 70 phiên giao dịch
    const url  = `${DCHART_BASE}?resolution=D&symbol=${code}&from=${from}&to=${now}`;

    console.log(`[fetchTAData] Fetching VNDirect dchart: ${url}`);

    const res = await fetch(url, {
      headers: FETCH_HEADERS,
      signal: AbortSignal.timeout(12000),
      cache: "no-store",
    });

    // ─── Log lỗi HTTP chi tiết để dễ debug ───
    if (!res.ok) {
      const body = await res.text().catch(() => "(unreadable)");
      console.error(
        `[fetchTAData] ${code}: HTTP ${res.status} ${res.statusText}\n` +
        `  URL: ${url}\n` +
        `  Body: ${body.slice(0, 200)}`
      );
      return null;
    }

    const json = await res.json();

    // Kiểm tra status từ dchart ("ok" = có data)
    if (json.s !== "ok") {
      console.error(
        `[fetchTAData] ${code}: dchart trả s="${json.s}" (không phải "ok").\n` +
        `  Response: ${JSON.stringify(json).slice(0, 300)}`
      );
      return null;
    }

    const closes_raw: number[] = json.c ?? [];
    const opens_raw:  number[] = json.o ?? [];
    const highs_raw:  number[] = json.h ?? [];
    const lows_raw:   number[] = json.l ?? [];
    const volumes:    number[] = json.v ?? [];
    const timestamps: number[] = json.t ?? [];

    if (!closes_raw.length) {
      console.error(`[fetchTAData] ${code}: mảng giá đóng cửa rỗng`);
      return null;
    }

    console.log(
      `[fetchTAData] ${code}: nhận ${closes_raw.length} phiên.\n` +
      `  Phiên mới nhất: t=${new Date(timestamps[timestamps.length - 1] * 1000).toLocaleDateString("vi-VN")}, ` +
      `o=${opens_raw[opens_raw.length-1]}, h=${highs_raw[highs_raw.length-1]}, ` +
      `l=${lows_raw[lows_raw.length-1]}, c=${closes_raw[closes_raw.length-1]}, v=${volumes[volumes.length-1]}`
    );

    // Giá dchart trả về đơn vị nghìn đồng (VD: 49.1 = 49.100 VNĐ)
    // Nhân x1000 và làm tròn hàng trăm → đúng format giá CKVN
    const SCALE = 1000;
    const closes = closes_raw.map((v) => Math.round((v * SCALE) / 100) * 100);
    const highs  = highs_raw.map((v) => Math.round((v * SCALE) / 100) * 100);
    const lows   = lows_raw.map((v) => Math.round((v * SCALE) / 100) * 100);

    const currentPrice = closes[closes.length - 1];
    const refPrice     = closes.length >= 2 ? closes[closes.length - 2] : currentPrice;
    const change       = currentPrice - refPrice;
    const changePct    = refPrice > 0 ? +((change / refPrice) * 100).toFixed(2) : 0;

    // Ước tính Trần/Sàn (HOSE ±7%, chưa biết sàn nên dùng đa số là HOSE)
    const exchange = lookupExchange(code);
    const upLimit   = exchange === "HNX" ? 0.10 : exchange === "UPCOM" ? 0.15 : 0.07;
    const ceiling   = Math.round(refPrice * (1 + upLimit) / 100) * 100;
    const floor     = Math.round(refPrice * (1 - upLimit) / 100) * 100;

    // Volume 10 phiên gần nhất (làm tròn, không số lẻ)
    const vol10    = volumes.slice(-10).map((v) => Math.round(v));
    const avgVol10 = Math.round(vol10.reduce((s, v) => s + v, 0) / vol10.length);

    // 52 tuần high/low (dùng tối đa 252 phiên có sẵn)
    const high52w = Math.max(...highs);
    const low52w  = Math.min(...lows);

    // Chỉ báo kỹ thuật
    const ema10 = calcLastEMA(closes, 10);
    const ema20 = calcLastEMA(closes, 20);
    const ema30 = calcLastEMA(closes, 30);
    const ema50 = calcLastEMA(closes, 50);
    const rsi14 = calcRSI(closes, 14);
    const macd  = calcMACD(closes);
    const bollinger = calcBollingerBands(closes, 20, 2);

    // EMA phiên trước (dùng cho crossing detection)
    const closesExLast = closes.slice(0, -1);
    const prevEma10 = closesExLast.length >= 10 ? calcLastEMA(closesExLast, 10) : ema10;
    const prevEma20 = closesExLast.length >= 20 ? calcLastEMA(closesExLast, 20) : ema20;
    const prevClose = closes.length >= 2 ? closes[closes.length - 2] : currentPrice;

    // Volume trung bình 20 phiên
    const vol20Slice = volumes.slice(-20);
    const avgVolume20 = vol20Slice.length > 0
      ? Math.round(vol20Slice.reduce((s, v) => s + v, 0) / vol20Slice.length)
      : 0;

    const lastTs   = timestamps[timestamps.length - 1];
    const dataDate = lastTs
      ? new Date(lastTs * 1000).toLocaleDateString("vi-VN")
      : new Date().toLocaleDateString("vi-VN");

    console.log(
      `[fetchTAData] ${code} ✓ ` +
      `Giá=${currentPrice.toLocaleString("vi-VN")} VNĐ | ` +
      `Δ${change > 0 ? "+" : ""}${changePct}% | ` +
      `RSI=${rsi14} | EMA10=${ema10} EMA20=${ema20} EMA30=${ema30} EMA50=${ema50} | ` +
      `BB=${bollinger ? `${bollinger.lower}-${bollinger.upper}` : "N/A"} | sàn=${exchange}`
    );

    return {
      ticker: code,
      exchange,
      currentPrice,
      ceiling,
      floor,
      refPrice,
      change,
      changePct,
      volume10: vol10,
      avgVolume10: avgVol10,
      ema10,
      ema20,
      ema30,
      ema50,
      rsi14,
      macd,
      bollinger,
      avgVolume20,
      prevClose,
      prevEma10,
      prevEma20,
      high52w,
      low52w,
      dataDate,
      source: "VNDirect dchart (realtime)",
    };

  } catch (err: any) {
    // Bắt tất cả: network timeout, DNS fail, JSON parse error...
    console.error(`[fetchTAData] ${code}: LỖI NGHIÊM TRỌNG!`, {
      message: err?.message,
      cause:   err?.cause?.code ?? err?.cause?.message ?? String(err?.cause ?? ""),
      stack:   (err?.stack ?? "").slice(0, 500),
    });
    return null;
  }
}

/**
 * Fetch dữ liệu FA (P/E, P/B, ROE...) từ FiinQuant Bridge.
 *
 * Gọi endpoint /api/v1/fundamental/{ticker} trên Python backend.
 * Backend dùng MarketDepth.get_stock_valuation() + FundamentalAnalysis.get_ratios()
 * + BasicInfor để trả về P/E, P/B, EPS, ROE, ROA, vốn hoá, ngành.
 *
 * @param ticker - Mã cổ phiếu
 */
export async function fetchFAData(ticker: string): Promise<FAData | null> {
  const code = ticker.toUpperCase();
  const BACKEND = getPythonBridgeUrl();

  try {
    console.log(`[fetchFAData] ${code}: Gọi FiinQuant Bridge /api/v1/fundamental/${code}`);
    const res = await fetch(`${BACKEND}/api/v1/fundamental/${code}`, {
      cache: "no-store",
      signal: AbortSignal.timeout(30_000),
      headers: {
        "Content-Type": "application/json",
        "x-api-key": process.env.FIINQUANT_API_KEY ?? "",
      },
    });

    if (!res.ok) {
      console.error(`[fetchFAData] ${code}: HTTP ${res.status}`);
      return null;
    }

    const json = await res.json();

    // Parse valuation (MarketDepth.get_stock_valuation)
    const val = json.valuation ?? {};
    const pe = val.pe ?? val.PE ?? val.priceToEarning ?? null;
    const pb = val.pb ?? val.PB ?? val.priceToBook ?? null;

    // Parse ratios (FundamentalAnalysis.get_ratios)
    const ratios = Array.isArray(json.ratios) && json.ratios.length > 0 ? json.ratios[0] : {};
    const roe = ratios.roe ?? ratios.ROE ?? ratios.returnOnEquity ?? null;
    const roa = ratios.roa ?? ratios.ROA ?? ratios.returnOnAsset ?? null;
    const eps = ratios.eps ?? ratios.EPS ?? ratios.earningPerShare ?? null;
    const revenueLastQ = ratios.revenue ?? ratios.netRevenue ?? null;
    const profitLastQ = ratios.netProfit ?? ratios.postTaxProfit ?? null;
    const revenueGrowthYoY = ratios.revenueGrowth ?? ratios.revenueGrowthYoY ?? null;
    const profitGrowthYoY = ratios.profitGrowth ?? ratios.profitGrowthYoY ?? null;
    const reportDate = ratios.reportDate ?? ratios.year?.toString() ?? null;

    console.log(
      `[fetchFAData] ${code} ✓ PE=${pe}, PB=${pb}, ROE=${roe}%, EPS=${eps}`
    );

    return {
      ticker: code,
      pe: pe != null ? Number(pe) : null,
      pb: pb != null ? Number(pb) : null,
      eps: eps != null ? Number(eps) : null,
      roe: roe != null ? Number(roe) : null,
      roa: roa != null ? Number(roa) : null,
      revenueLastQ: revenueLastQ != null ? Number(revenueLastQ) : null,
      profitLastQ: profitLastQ != null ? Number(profitLastQ) : null,
      revenueGrowthYoY: revenueGrowthYoY != null ? Number(revenueGrowthYoY) : null,
      profitGrowthYoY: profitGrowthYoY != null ? Number(profitGrowthYoY) : null,
      reportDate,
      source: "FiinQuant Bridge",
    };
  } catch (err) {
    console.error(`[fetchFAData] ${code}: Lỗi kết nối FiinQuant Bridge`, err);
    return null;
  }
}

/**
 * Format mã cổ phiếu đúng chuẩn TradingView: "DGC" + "HOSE" → "HOSE:DGC".
 * Mặc định HOSE nếu không truyền exchange.
 */
export function formatTradingViewSymbol(
  ticker: string,
  exchange: string = "HOSE"
): string {
  const upper = ticker.toUpperCase();
  const ex    = exchange.toUpperCase().trim();
  if (ex === "HNX")   return `HNX:${upper}`;
  if (ex === "UPCOM") return `UPCOM:${upper}`;
  return `HOSE:${upper}`;
}
