/**
 * API Cron: Quét tín hiệu giao dịch THỰC từ VNDirect dchart data.
 *
 * 2 loại tín hiệu Đầu Cơ (Vàng):
 *
 * Case 1 — "Bắt đáy hoảng loạn":
 *   RSI < 30 + MACD Histogram thu hẹp (đang âm nhưng bớt âm) + Close nảy lên từ BB dưới
 *
 * Case 2 — "Đảo chiều ngắn hạn":
 *   Close cắt lên EMA10 hoặc EMA20 + Volume > TB 20 phiên
 *   + MACD Line đang tăng (chưa cần cắt Signal) + RSI 45-65
 *
 * Không báo trùng mã trong ngày.
 */
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { fetchTAData, type TAData } from "@/lib/stockData";

// ═══════════════════════════════════════════════
//  Danh sách cổ phiếu quét (VN30 + mid-cap phổ biến)
// ═══════════════════════════════════════════════
const SCAN_WATCHLIST = [
  // VN30
  "ACB","BCM","BID","BVH","CTG","FPT","GAS","GVR","HDB","HPG",
  "MBB","MSN","MWG","PLX","POW","SAB","SHB","SSB","SSI","STB",
  "TCB","TPB","VCB","VHM","VIB","VIC","VJC","VNM","VPB","VRE",
  // Mid-cap đầu cơ phổ biến
  "DGC","DPM","DGW","DCM","PNJ","REE","KDH","NLG","HDG","HSG",
  "NKG","DPG","PC1","DVN","SZC","GMD","ANV","VND","HCM","BSI",
  "PVD","PVS","HAG","DXG","KBC","IJC","LPB","OCB","EIB","TCH",
];

// ═══════════════════════════════════════════════
//  Bảo mật & Anti-duplicate
// ═══════════════════════════════════════════════

function validateCronSecret(req: NextRequest): boolean {
  const secret = req.headers.get("x-cron-secret");
  return secret === (process.env.CRON_SECRET ?? "adn-cron-dev-key");
}

async function getSignaledTodayStocks(): Promise<string[]> {
  const startOfDay = new Date();
  startOfDay.setHours(0, 0, 0, 0);

  const todaySignals = await prisma.signal.findMany({
    where: { createdAt: { gte: startOfDay } },
    select: { ticker: true },
  });
  return todaySignals.map((s: { ticker: string }) => s.ticker);
}

// ═══════════════════════════════════════════════
//  Logic phát hiện tín hiệu Đầu Cơ
// ═══════════════════════════════════════════════

interface DetectedSignal {
  ticker: string;
  type: "DAU_CO";
  entryPrice: number;
}

/**
 * Case 1 — Bắt đáy hoảng loạn:
 * - RSI < 30
 * - MACD Histogram âm nhưng đang thu hẹp (phiên nay > phiên trước, cả hai < 0)
 * - Close > BB dưới (nảy lên từ vùng quá bán)
 */
function checkPanicBottom(d: TAData): string | null {
  if (d.rsi14 >= 30) return null;
  if (!d.macd) return null;
  if (!d.bollinger) return null;

  const { histogram, histogramPrev } = d.macd;
  const histNarrowing = histogram < 0 && histogramPrev < 0 && histogram > histogramPrev;
  if (!histNarrowing) return null;

  // Close phải ở gần hoặc trên BB dưới (nảy lên, không còn chìm)
  if (d.currentPrice < d.bollinger.lower) return null;

  return (
    `BẮT ĐÁY HOẢNG LOẠN: RSI=${d.rsi14} (< 30), ` +
    `MACD Histogram thu hẹp (${d.macd.histogramPrev} → ${d.macd.histogram}), ` +
    `Close ${d.currentPrice.toLocaleString("vi-VN")} nảy từ BB dưới ${d.bollinger.lower.toLocaleString("vi-VN")}`
  );
}

/**
 * Case 2 — Đảo chiều ngắn hạn:
 * - Close cắt lên EMA10 hoặc EMA20 (phiên trước dưới, phiên nay trên)
 * - Volume hôm nay > TB 20 phiên
 * - MACD Line đang tăng (macd nay > macd phiên trước, dùng histogramPrev dịch ngược)
 * - RSI nằm trong 45-65
 */
function checkShortTermReversal(d: TAData): string | null {
  if (d.rsi14 < 45 || d.rsi14 > 65) return null;
  if (!d.macd) return null;

  // Check EMA crossing: prev close dưới EMA, current close trên EMA
  const crossEma10 = d.prevClose < d.prevEma10 && d.currentPrice > d.ema10;
  const crossEma20 = d.prevClose < d.prevEma20 && d.currentPrice > d.ema20;
  if (!crossEma10 && !crossEma20) return null;

  // Volume > TB 20 phiên
  const todayVol = d.volume10[d.volume10.length - 1] ?? 0;
  if (d.avgVolume20 <= 0 || todayVol <= d.avgVolume20) return null;

  // MACD Line đang tăng: so macd hiện tại > macd trước
  // macd trước ≈ macd - (histogram - histogramPrev) (xấp xỉ, vì signal thay đổi ít)
  // Đơn giản hơn: histogram đang tăng → MACD line tăng nhanh hơn signal → bullish
  const macdRising = d.macd.histogram > d.macd.histogramPrev;
  if (!macdRising) return null;

  const crossLabel = crossEma10 && crossEma20 ? "EMA10+EMA20"
    : crossEma10 ? "EMA10" : "EMA20";
  const volRatio = (todayVol / d.avgVolume20).toFixed(1);

  return (
    `ĐẢO CHIỀU NGẮN HẠN: Close cắt lên ${crossLabel}, ` +
    `Vol=${todayVol.toLocaleString("vi-VN")} (x${volRatio} TB20), ` +
    `MACD tăng (hist ${d.macd.histogramPrev} → ${d.macd.histogram}), ` +
    `RSI=${d.rsi14}`
  );
}

// ═══════════════════════════════════════════════
//  Quét toàn bộ watchlist
// ═══════════════════════════════════════════════

async function scanSignals(alreadySignaled: string[]): Promise<DetectedSignal[]> {
  const toScan = SCAN_WATCHLIST.filter((s) => !alreadySignaled.includes(s));
  if (toScan.length === 0) return [];

  console.log(`[scan-signals] Bắt đầu quét ${toScan.length} mã: ${toScan.join(",")}`);

  const results: DetectedSignal[] = [];

  // Quét song song theo batch để tránh quá tải API (batch 10 mã)
  const BATCH_SIZE = 10;
  for (let i = 0; i < toScan.length; i += BATCH_SIZE) {
    const batch = toScan.slice(i, i + BATCH_SIZE);
    const promises = batch.map(async (ticker) => {
      try {
        const data = await fetchTAData(ticker);
        if (!data) return;

        const panic = checkPanicBottom(data);
        if (panic) {
          results.push({ ticker, type: "DAU_CO", entryPrice: data.currentPrice });
          return;
        }

        const reversal = checkShortTermReversal(data);
        if (reversal) {
          results.push({ ticker, type: "DAU_CO", entryPrice: data.currentPrice });
        }
      } catch (err) {
        console.error(`[scan-signals] Lỗi quét ${ticker}:`, err);
      }
    });

    await Promise.all(promises);

    // Nghỉ 500ms giữa các batch để tránh rate limit
    if (i + BATCH_SIZE < toScan.length) {
      await new Promise((r) => setTimeout(r, 500));
    }
  }

  console.log(`[scan-signals] Hoàn tất — tìm thấy ${results.length} tín hiệu mới`);
  return results;
}

// ═══════════════════════════════════════════════
//  HTTP Handler
// ═══════════════════════════════════════════════

export async function GET(req: NextRequest) {
  if (!validateCronSecret(req)) {
    return NextResponse.json({ error: "Không có quyền truy cập" }, { status: 401 });
  }

  try {
    const alreadySignaled = await getSignaledTodayStocks();
    const newSignals = await scanSignals(alreadySignaled);

    if (newSignals.length === 0) {
      return NextResponse.json({
        type: "signal_scan",
        timestamp: new Date().toISOString(),
        message: "Không có tín hiệu mới",
        newSignals: [],
        totalSignaledToday: alreadySignaled.length,
        scannedStocks: SCAN_WATCHLIST.length,
      });
    }

    const savedSignals = await prisma.$transaction(
      newSignals.map((signal) =>
        prisma.signal.create({
          data: {
            ticker: signal.ticker,
            type: signal.type,
            entryPrice: signal.entryPrice,
          },
        })
      )
    );

    return NextResponse.json({
      type: "signal_scan",
      timestamp: new Date().toISOString(),
      message: `Phát hiện ${savedSignals.length} tín hiệu đầu cơ mới`,
      newSignals: savedSignals,
      totalSignaledToday: alreadySignaled.length + savedSignals.length,
      scannedStocks: SCAN_WATCHLIST.length,
    });
  } catch (error) {
    console.error("[CRON /api/cron/scan-signals] Lỗi:", error);
    return NextResponse.json({ error: "Lỗi quét tín hiệu" }, { status: 500 });
  }
}
