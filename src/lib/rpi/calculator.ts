/**
 * TEI (Trend Exhaustion Index) Calculator — v2 (narrow-amplitude)
 * Formula: RSI(7)×5% + Stochastic %K(5)×70% + ROC(5)×25%
 * VN30 mode: MEDIAN of 30 constituent stock scores per day
 */

import {
  calcRSI,
  calcStochastic,
  calcROC,
  calcBollingerPosition,
} from "./indicators";

export interface OHLCVData {
  date: string;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

export interface RPIResult {
  date: string;
  rpi: number | null;
  ma7: number | null;
  classification: string | null;
  classColor: string | null;
  details?: {
    rsiScore: number;
    stochScore: number;
    rocScore: number;
    bbScore: number;
  };
}

interface DailyScore {
  date: string;
  score: number;
  rsiScore: number;
  stochScore: number;
  rocScore: number;
  bbScore: number;
}

/* ── Helpers ───────────────────────────────────────────────────────────── */

function median(arr: number[]): number {
  if (arr.length === 0) return 0;
  const sorted = [...arr].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 !== 0
    ? sorted[mid]
    : (sorted[mid - 1] + sorted[mid]) / 2;
}

function classify(rpi: number): { classification: string; classColor: string } {
  if (rpi >= 4.0) return { classification: "CẠN KIỆT XU HƯỚNG TĂNG", classColor: "red" };
  if (rpi <= 1.0) return { classification: "CẠN KIỆT XU HƯỚNG GIẢM", classColor: "green" };
  return { classification: "TRUNG TÍNH", classColor: "yellow" };
}

function addMA7AndClassification(results: RPIResult[]): void {
  // Lọc lấy các index có rpi khác null
  const validIndices = results
    .map((r, idx) => (r.rpi !== null ? idx : -1))
    .filter((idx) => idx !== -1);

  for (let i = 0; i < validIndices.length; i++) {
    const currentIdx = validIndices[i];
    
    // SMA(7) — Cần ít nhất 7 phiên có dữ liệu
    if (i >= 6) {
      const windowIndices = validIndices.slice(i - 6, i + 1);
      const windowValues = windowIndices.map((idx) => results[idx].rpi as number);
      
      const sum = windowValues.reduce((s, v) => s + v, 0);
      results[currentIdx].ma7 = Math.round((sum / 7) * 100) / 100;
    }

    const { classification, classColor } = classify(results[currentIdx].rpi!);
    results[currentIdx].classification = classification;
    results[currentIdx].classColor = classColor;
  }
}

/* ══════════════════════════════════════════════════════════════════════════
 *  Per-stock daily scores (4 indicators)
 * ══════════════════════════════════════════════════════════════════════════ */

export function calculateStockDailyScores(ohlcv: OHLCVData[]): DailyScore[] {
  if (ohlcv.length < 20) return [];

  const closes = ohlcv.map((d) => d.close);
  const highs = ohlcv.map((d) => d.high);
  const lows = ohlcv.map((d) => d.low);

  // [A] RSI(7) — Wilder smoothing, shorter period for more sensitivity
  const rsi = calcRSI(closes, 7);

  // [B] Stochastic %K(5) — raw, short period for narrow amplitude
  const stoch = calcStochastic(closes, highs, lows, 5);

  // [C] ROC(5)
  const roc = calcROC(closes, 5);

  // [D] Bollinger Band Position (20, 2σ) — weight=0 but kept for detail display
  const bb = calcBollingerPosition(closes, 20);

  const results: DailyScore[] = [];

  for (let i = 0; i < ohlcv.length; i++) {
    if (rsi[i] === null || stoch[i] === null || bb[i] === null) continue;

    // [A] rsi_score = (RSI / 100) × 5
    const rsiScore = (rsi[i]! / 100) * 5;

    // [B] sto_score = (%K / 100) × 5
    const stochScore = (stoch[i]! / 100) * 5;

    // [C] ROC — rolling 60-period normalization
    let rocScore = 2.5;
    if (roc[i] !== null) {
      const start = Math.max(0, i - 59);
      const rocWindow: number[] = [];
      for (let j = start; j <= i; j++) {
        if (roc[j] !== null) rocWindow.push(roc[j]!);
      }
      if (rocWindow.length > 1) {
        const rocMin = Math.min(...rocWindow);
        const rocMax = Math.max(...rocWindow);
        if (rocMax !== rocMin) {
          const rocNorm = Math.max(0, Math.min(1, (roc[i]! - rocMin) / (rocMax - rocMin)));
          rocScore = rocNorm * 5;
        }
      }
    }

    // [D] bb_score = clip(BB_pos / 100, 0, 1) × 5
    const bbScore = Math.max(0, Math.min(5, (bb[i]! / 100) * 5));

    // Weighted: RSI(5%) + Stochastic(70%) + ROC(25%) + BB(0%)
    const score =
      0.05 * rsiScore + 0.70 * stochScore + 0.25 * rocScore + 0.00 * bbScore;

    results.push({
      date: ohlcv[i].date,
      score: Math.round(score * 100) / 100,
      rsiScore: Math.round(rsiScore * 100) / 100,
      stochScore: Math.round(stochScore * 100) / 100,
      rocScore: Math.round(rocScore * 100) / 100,
      bbScore: Math.round(bbScore * 100) / 100,
    });
  }

  return results;
}

/* ══════════════════════════════════════════════════════════════════════════
 *  Single-ticker RPI (client-side use)
 * ══════════════════════════════════════════════════════════════════════════ */

export function calculateRPI(ohlcvData: OHLCVData[]): RPIResult[] {
  if (ohlcvData.length < 30) return [];

  const dailyScores = calculateStockDailyScores(ohlcvData);
  const scoreMap = new Map(dailyScores.map((s) => [s.date, s]));

  const results: RPIResult[] = ohlcvData.map((item) => {
    const s = scoreMap.get(item.date);
    return {
      date: item.date,
      rpi: s ? s.score : null,
      ma7: null,
      classification: null,
      classColor: null,
      details: s
        ? {
            rsiScore: s.rsiScore,
            stochScore: s.stochScore,
            rocScore: s.rocScore,
            bbScore: s.bbScore,
          }
        : undefined,
    };
  });

  addMA7AndClassification(results);
  return results;
}

/* ══════════════════════════════════════════════════════════════════════════
 *  VN30 mode — MEDIAN of per-stock scores (server-side use)
 * ══════════════════════════════════════════════════════════════════════════ */

export function calculateRPIFromVN30(
  allStocks: { ticker: string; data: OHLCVData[] }[],
): RPIResult[] {
  // Step 1: daily scores per stock
  const stockScores = allStocks.map((s) => ({
    ticker: s.ticker,
    scores: calculateStockDailyScores(s.data),
  }));

  // Step 2: group by date
  const dateMap = new Map<
    string,
    { scores: number[]; rsi: number[]; stoch: number[]; roc: number[]; bb: number[] }
  >();

  for (const st of stockScores) {
    for (const s of st.scores) {
      let entry = dateMap.get(s.date);
      if (!entry) {
        entry = { scores: [], rsi: [], stoch: [], roc: [], bb: [] };
        dateMap.set(s.date, entry);
      }
      entry.scores.push(s.score);
      entry.rsi.push(s.rsiScore);
      entry.stoch.push(s.stochScore);
      entry.roc.push(s.rocScore);
      entry.bb.push(s.bbScore);
    }
  }

  // Step 3: for each date, take MEDIAN (need >= 10 stocks)
  const allDates = [...dateMap.keys()].sort();
  const results: RPIResult[] = [];

  for (const date of allDates) {
    const entry = dateMap.get(date)!;
    if (entry.scores.length < 10) continue;

    results.push({
      date,
      rpi: Math.round(median(entry.scores) * 100) / 100,
      ma7: null,
      classification: null,
      classColor: null,
      details: {
        rsiScore: Math.round(median(entry.rsi) * 100) / 100,
        stochScore: Math.round(median(entry.stoch) * 100) / 100,
        rocScore: Math.round(median(entry.roc) * 100) / 100,
        bbScore: Math.round(median(entry.bb) * 100) / 100,
      },
    });
  }

  addMA7AndClassification(results);
  return results;
}

/* ── Utility ───────────────────────────────────────────────────────────── */

export function getLatestRPI(results: RPIResult[]): RPIResult | null {
  return [...results].reverse().find((r) => r.rpi !== null) ?? null;
}

// Cache nến hôm nay đã "đóng băng" cho mốc GIỮA PHIÊN (11:00–15:00), theo (ticker, ngày VN).
// Module-level → chia sẻ giữa /api/rpi và /api/og/art trong cùng tiến trình adn-web
// (web ↔ Discord đọc CÙNG 1 snapshot). Reset khi redeploy / prune khi phình.
const artMidBarSnapshot = new Map<string, OHLCVData>();

function vnDateAndMinutes(now: Date): { dateKey: string; minutes: number; weekend: boolean } {
  const vn = new Date(now.toLocaleString("en-US", { timeZone: "Asia/Ho_Chi_Minh" }));
  const dateKey = `${vn.getFullYear()}-${String(vn.getMonth() + 1).padStart(2, "0")}-${String(vn.getDate()).padStart(2, "0")}`;
  const day = vn.getDay();
  return { dateKey, minutes: vn.getHours() * 60 + vn.getMinutes(), weekend: day === 0 || day === 6 };
}

/**
 * ART theo mốc SNAPSHOT 11:00 & 15:00 (giờ VN, T2–T6) — thay vì tính live từng tick.
 *
 * ART/RPI là chỉ báo THEO NGÀY. Tính trên nến intraday CHƯA CHỐT làm Stochastic %K(5)
 * (trọng số 70%) nhảy loạn theo tick → "CẠN KIỆT XU HƯỚNG TĂNG" ảo giữa phiên (vd STB 01/07:
 * 2.49 → 5.0 → 2.21 dù giá đi ngang). Snapshot theo mốc để ART chỉ đổi 2 lần/ngày, đứng yên giữa:
 *  - Trước 11:00 / cuối tuần → nến hôm nay CHƯA vào mốc → dùng nến ĐÃ ĐÓNG (bỏ nến hôm nay).
 *  - 11:00–15:00 → SNAPSHOT GIỮA PHIÊN: đóng băng nến hôm nay ở lần tính đầu sau 11:00, ĐỨNG YÊN tới 15:00.
 *  - Sau 15:00 → phiên đã đóng, nến hôm nay đã cố định → dùng trực tiếp (bản chốt cuối).
 * Cache theo (ticker, ngày) → web ↔ Discord ↔ VN30 cùng 1 giá trị trong mỗi mốc.
 */
export function snapshotArtRows(ticker: string, rows: OHLCVData[], now: Date = new Date()): OHLCVData[] {
  if (rows.length === 0) return rows;
  const { dateKey, minutes, weekend } = vnDateAndMinutes(now);
  const last = rows[rows.length - 1];
  const lastIsToday = last.date.slice(0, 10) === dateKey;

  // Trước 11:00 hoặc cuối tuần → dùng nến đã đóng.
  if (weekend || minutes < 11 * 60) {
    return lastIsToday ? rows.slice(0, -1) : rows;
  }
  // Sau 15:00 → nến hôm nay đã chốt → dùng trực tiếp.
  if (minutes >= 15 * 60) return rows;
  // 11:00–15:00 → không có nến hôm nay thì thôi; có thì đóng băng (snapshot giữa phiên).
  if (!lastIsToday) return rows;
  const key = `${ticker.toUpperCase()}:${dateKey}`;
  let frozen = artMidBarSnapshot.get(key);
  if (!frozen) {
    if (artMidBarSnapshot.size > 3000) artMidBarSnapshot.clear();
    frozen = { ...last };
    artMidBarSnapshot.set(key, frozen);
  }
  return [...rows.slice(0, -1), frozen];
}
