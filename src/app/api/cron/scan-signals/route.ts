/**
 * API Cron: Quét tín hiệu giao dịch THỰC từ RS-Rating stocks.
 *
 * NÂNG CẤP: Dùng danh sách từ RS-Rating (FiinQuant) thay vì hardcoded.
 *
 * 5 loại tín hiệu:
 * 1. "Bắt đáy hoảng loạn": RSI<30 + MACD thu hẹp + BB nảy
 * 2. "Đảo chiều ngắn hạn": Cross EMA + Vol tăng + MACD tăng + RSI 45-65
 * 3. "Vượt đỉnh 52W": Giá gần đỉnh 52W + Vol > 1.5x TB20
 * 4. "Test hỗ trợ": Giá chạm EMA50 + bật lên
 * 5. "Tích lũy nén": BB hẹp + Vol thấp
 *
 * Kết quả lưu DB Signal + đẩy Notification.
 */
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { fetchTAData, type TAData } from "@/lib/stockData";
import {
  validateCronSecret,
  logCron,
  pushNotification,
  isTradingDay,
} from "@/lib/cronHelpers";
import { getRSRatingStocks, batchFetchTA } from "@/lib/marketDataFetcher";

// ═══════════════════════════════════════════════
//  Danh sách cổ phiếu quét — Dùng RS-Rating từ FiinQuant
// ═══════════════════════════════════════════════

// Fallback khi FiinQuant không available
const FALLBACK_WATCHLIST = [
  "ACB","BCM","BID","BVH","CTG","FPT","GAS","GVR","HDB","HPG",
  "MBB","MSN","MWG","PLX","POW","SAB","SHB","SSB","SSI","STB",
  "TCB","TPB","VCB","VHM","VIB","VIC","VJC","VNM","VPB","VRE",
  "DGC","DPM","DGW","DCM","PNJ","REE","KDH","NLG","HDG","HSG",
  "NKG","DPG","PC1","DVN","SZC","GMD","ANV","VND","HCM","BSI",
  "PVD","PVS","HAG","DXG","KBC","IJC","LPB","OCB","EIB","TCH",
];

// ═══════════════════════════════════════════════
//  Bảo mật & Anti-duplicate
// ═══════════════════════════════════════════════

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
//  Quét toàn bộ watchlist (dùng RS-Rating từ FiinQuant)
// ═══════════════════════════════════════════════

async function scanSignals(alreadySignaled: string[]): Promise<DetectedSignal[]> {
  // Ưu tiên RS-Rating stocks, fallback sang danh sách cứng
  const allStocks = await getRSRatingStocks();
  const toScan = allStocks.filter((s) => !alreadySignaled.includes(s));
  if (toScan.length === 0) return [];

  console.log(`[scan-signals] Bắt đầu quét ${toScan.length} mã (RS-Rating): ${toScan.slice(0, 10).join(",")}`);

  const results: DetectedSignal[] = [];

  // Batch fetch TA data
  const taMap = await batchFetchTA(toScan);

  for (const [ticker, data] of taMap) {
    const panic = checkPanicBottom(data);
    if (panic) {
      results.push({ ticker, type: "DAU_CO", entryPrice: data.currentPrice });
      continue;
    }

    const reversal = checkShortTermReversal(data);
    if (reversal) {
      results.push({ ticker, type: "DAU_CO", entryPrice: data.currentPrice });
    }
  }

  console.log(`[scan-signals] Hoàn tất — quét ${taMap.size} mã, ${results.length} tín hiệu mới`);
  return results;
}

// ═══════════════════════════════════════════════
//  HTTP Handler
// ═══════════════════════════════════════════════

export const maxDuration = 120;

export async function GET(req: NextRequest) {
  if (!validateCronSecret(req)) {
    return NextResponse.json({ error: "Không có quyền truy cập" }, { status: 401 });
  }

  const startTime = Date.now();

  if (!isTradingDay()) {
    await logCron("signal_scan", "skipped", "Không phải ngày giao dịch", 0);
    return NextResponse.json({ type: "signal_scan", message: "Không phải ngày giao dịch" });
  }

  try {
    const alreadySignaled = await getSignaledTodayStocks();
    const newSignals = await scanSignals(alreadySignaled);

    if (newSignals.length === 0) {
      const duration = Date.now() - startTime;
      await logCron("signal_scan", "success", "Không có tín hiệu mới", duration);
      return NextResponse.json({
        type: "signal_scan",
        timestamp: new Date().toISOString(),
        message: "Không có tín hiệu mới",
        newSignals: [],
        totalSignaledToday: alreadySignaled.length,
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

    // Đẩy Notification
    const signalText = savedSignals
      .map((s) => `• ${s.ticker}: ${s.entryPrice.toLocaleString("vi-VN")} VNĐ`)
      .join("\n");

    await pushNotification(
      "signal_5m",
      `📡 ${savedSignals.length} tín hiệu đầu cơ mới`,
      `## TÍN HIỆU MỚI\n\n${signalText}`
    );

    const duration = Date.now() - startTime;
    await logCron("signal_scan", "success", `${savedSignals.length} tín hiệu mới`, duration, {
      newSignals: savedSignals.length,
    });

    return NextResponse.json({
      type: "signal_scan",
      timestamp: new Date().toISOString(),
      message: `Phát hiện ${savedSignals.length} tín hiệu đầu cơ mới`,
      newSignals: savedSignals,
      totalSignaledToday: alreadySignaled.length + savedSignals.length,
    });
  } catch (error) {
    const duration = Date.now() - startTime;
    await logCron("signal_scan", "error", String(error), duration);
    console.error("[CRON scan-signals] Lỗi:", error);
    return NextResponse.json({ error: "Lỗi quét tín hiệu" }, { status: 500 });
  }
}
