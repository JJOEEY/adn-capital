/**
 * API Cron Dispatcher — Xử lý các cron job qua query parameter.
 *
 * GET /api/cron?type=prop_trading     → 19h T2-T6, Tự Doanh
 * GET /api/cron?type=intraday         → 10h/11h30/14h/14h45, Market snapshot
 * GET /api/cron?type=signal_scan_5m   → Mỗi 5 phút, quét tín hiệu
 *
 * Các cron riêng vẫn hoạt động:
 *   /api/cron/morning-report   → 8h Morning Brief
 *   /api/cron/afternoon-review → 15h EOD Brief
 *   /api/cron/scan-signals     → Legacy signal scan
 */
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { generateText } from "@/lib/gemini";
import { fetchTAData, type TAData } from "@/lib/stockData";
import {
  validateCronSecret,
  logCron,
  pushNotification,
  saveMarketReport,
  isTradingDay,
  getVNDateString,
  getVNDateISO,
} from "@/lib/cronHelpers";
import {
  getMarketSnapshot,
  formatSnapshotForAI,
  getPropTradingData,
  formatPropTradingForAI,
  getRSRatingStocks,
  batchFetchTA,
} from "@/lib/marketDataFetcher";
import { fetchAllCafefNews, buildCafefContext } from "@/lib/cafefScraper";

export const maxDuration = 120;
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  if (!validateCronSecret(req)) {
    return NextResponse.json({ error: "Không có quyền truy cập" }, { status: 401 });
  }

  const type = req.nextUrl.searchParams.get("type");

  switch (type) {
    case "prop_trading":
      return handlePropTrading();
    case "intraday":
      return handleIntraday(req);
    case "signal_scan_5m":
      return handleSignalScan5m();
    default:
      return NextResponse.json({
        error: "Thiếu hoặc sai tham số 'type'",
        availableTypes: ["prop_trading", "intraday", "signal_scan_5m"],
      }, { status: 400 });
  }
}

// ═══════════════════════════════════════════════════════════════
//  1. PROP TRADING (TỰ DOANH) — 19h T2-T6
// ═══════════════════════════════════════════════════════════════

async function handlePropTrading(): Promise<NextResponse> {
  const startTime = Date.now();

  if (!isTradingDay()) {
    await logCron("prop_trading", "skipped", "Không phải ngày giao dịch", 0);
    return NextResponse.json({ type: "prop_trading", message: "Không phải ngày giao dịch" });
  }

  const today = getVNDateString();
  const dateISO = getVNDateISO();

  try {
    const propData = await getPropTradingData();

    if (!propData) {
      await logCron("prop_trading", "error", "Không lấy được data Tự Doanh", Date.now() - startTime);
      return NextResponse.json({ error: "Không lấy được data Tự Doanh từ FiinQuant" }, { status: 502 });
    }

    // Lưu PropTrading table
    await prisma.propTrading.upsert({
      where: { date: dateISO },
      update: {
        totalBuy: propData.totalBuy,
        totalSell: propData.totalSell,
        netValue: propData.netValue,
        topBuy: JSON.stringify(propData.topBuy),
        topSell: JSON.stringify(propData.topSell),
        rawData: JSON.stringify(propData),
      },
      create: {
        date: dateISO,
        totalBuy: propData.totalBuy,
        totalSell: propData.totalSell,
        netValue: propData.netValue,
        topBuy: JSON.stringify(propData.topBuy),
        topSell: JSON.stringify(propData.topSell),
        rawData: JSON.stringify(propData),
      },
    });

    // Gemini phân tích Tự Doanh
    const propContext = formatPropTradingForAI(propData);
    const prompt = `Bạn là ADN AI Bot System - Khổng Minh của VNINDEX.
Hôm nay là ${today}. Hãy viết BÁO CÁO TỰ DOANH CTCK 19:00.

QUY TẮC BẮT BUỘC:
1. CHỈ dùng chính xác các con số trong "DỮ LIỆU TỰ DOANH" bên dưới
2. TUYỆT ĐỐI KHÔNG bịa số liệu

${propContext}

## 🏦 BÁO CÁO TỰ DOANH CTCK - ${today}

### 1. TỔNG QUAN
- Tổng mua / bán / ròng (số liệu thực)
- Xu hướng mua ròng hay bán ròng

### 2. TOP MÃ MUA RÒNG
- Liệt kê từ data topBuy, phân tích

### 3. TOP MÃ BÁN RÒNG
- Liệt kê từ data topSell, phân tích

### 4. NHẬN ĐỊNH SMART MONEY
- Hành vi tự doanh kỳ vọng gì?
- Nhóm ngành được ưa chuộng
- Cảnh báo nếu bán ròng mạnh

Viết tiếng Việt, ngắn gọn.`;

    const report = await generateText(prompt);

    await saveMarketReport("prop_trading", `Tự Doanh ${today}`, report, propData, {
      netValue: propData.netValue,
    });

    const netLabel = propData.netValue >= 0 ? "MUA ròng" : "BÁN ròng";
    const netAbs = Math.abs(propData.netValue).toLocaleString("vi-VN");
    await pushNotification("prop_19h", `🏦 Tự Doanh ${netLabel} ${netAbs} tỷ`, report);

    const duration = Date.now() - startTime;
    await logCron("prop_trading", "success", `Net: ${propData.netValue} tỷ`, duration);

    return NextResponse.json({ type: "prop_trading", timestamp: new Date().toISOString(), propData, report });
  } catch (error) {
    await logCron("prop_trading", "error", String(error), Date.now() - startTime);
    console.error("[CRON prop-trading]", error);
    return NextResponse.json({ error: "Lỗi cập nhật Tự Doanh" }, { status: 500 });
  }
}

// ═══════════════════════════════════════════════════════════════
//  2. INTRADAY NOTIFICATION — 10h, 11h30, 14h, 14h45
// ═══════════════════════════════════════════════════════════════

async function handleIntraday(req: NextRequest): Promise<NextResponse> {
  const startTime = Date.now();

  if (!isTradingDay()) {
    await logCron("intraday", "skipped", "Không phải ngày giao dịch", 0);
    return NextResponse.json({ type: "intraday", message: "Không phải ngày giao dịch" });
  }

  const today = getVNDateString();

  // Xác định khung giờ notification
  const vnNow = new Date(new Date().toLocaleString("en-US", { timeZone: "Asia/Ho_Chi_Minh" }));
  const hour = vnNow.getHours();
  const minute = vnNow.getMinutes();

  let notifType: string;
  let timeLabel: string;

  if (hour === 10 && minute < 30) {
    notifType = "signal_10h";
    timeLabel = "10:00";
  } else if ((hour === 11 && minute >= 15) || (hour === 11 && minute < 45)) {
    notifType = "signal_1130";
    timeLabel = "11:30";
  } else if (hour === 14 && minute < 30) {
    notifType = "signal_14h";
    timeLabel = "14:00";
  } else if (hour === 14 && minute >= 30) {
    notifType = "signal_1445";
    timeLabel = "14:45";
  } else {
    // Fallback: dùng giờ hiện tại
    notifType = `intraday_${hour}h${minute > 0 ? minute : ""}`;
    timeLabel = `${hour}:${minute.toString().padStart(2, "0")}`;
  }

  try {
    // Fetch data thực
    const [snapshot, cafefNews] = await Promise.all([
      getMarketSnapshot(),
      fetchAllCafefNews(),
    ]);

    const marketContext = formatSnapshotForAI(snapshot);
    const newsContext = buildCafefContext(cafefNews);

    const prompt = `Bạn là ADN AI Bot System - Khổng Minh của VNINDEX.
Hôm nay là ${today}, hiện tại ${timeLabel}. Hãy viết CẬP NHẬT THỊ TRƯỜNG NHANH.

QUY TẮC: CHỈ dùng số liệu real-time bên dưới, KHÔNG bịa.

${marketContext}

${newsContext}

## ⚡ CẬP NHẬT THỊ TRƯỜNG — ${timeLabel} ${today}

### CHỈ SỐ
(Ghi VN-Index, HNX, VN30 từ data thực)

### ĐỘ RỘNG & THANH KHOẢN
(Tăng/giảm/đứng, thanh khoản)

### ĐIỂM NÓNG
- Top mã tăng mạnh (từ topGainers)
- Top mã giảm mạnh (từ topLosers)

### TIN NHANH
- 2-3 tin quan trọng nhất từ CafeF

### NHẬN ĐỊNH NGẮN
- 1-2 câu nhận định xu hướng

Viết cực ngắn gọn, kiểu bullet point, phù hợp notification.`;

    const report = await generateText(prompt);

    // Lưu DB
    await saveMarketReport("intraday_update", `Market Update ${timeLabel}`, report, {
      indices: snapshot.indices,
      breadth: snapshot.breadth,
      liquidity: snapshot.liquidity,
      topGainers: snapshot.topGainers.slice(0, 5),
      topLosers: snapshot.topLosers.slice(0, 5),
    });

    // Đẩy Notification
    const vnidx = snapshot.indices.find((i) => i.ticker === "VNINDEX");
    const idxInfo = vnidx
      ? ` | VN-Index: ${vnidx.value} (${vnidx.changePct >= 0 ? "+" : ""}${vnidx.changePct}%)`
      : "";

    await pushNotification(
      notifType,
      `⚡ Market Update ${timeLabel}${idxInfo}`,
      report
    );

    const duration = Date.now() - startTime;
    await logCron("intraday", "success", `${notifType}, ${duration}ms`, duration);

    return NextResponse.json({ type: "intraday", notifType, timeLabel, report, timestamp: new Date().toISOString() });
  } catch (error) {
    await logCron("intraday", "error", String(error), Date.now() - startTime);
    console.error("[CRON intraday]", error);
    return NextResponse.json({ error: "Lỗi cập nhật intraday" }, { status: 500 });
  }
}

// ═══════════════════════════════════════════════════════════════
//  3. SIGNAL SCAN 5 PHÚT — Quét tín hiệu từ RS-Rating stocks
// ═══════════════════════════════════════════════════════════════

interface DetectedSignal {
  ticker: string;
  type: "DAU_CO";
  entryPrice: number;
  reason: string;
}

function checkPanicBottom(d: TAData): string | null {
  if (d.rsi14 >= 30) return null;
  if (!d.macd || !d.bollinger) return null;

  const { histogram, histogramPrev } = d.macd;
  if (!(histogram < 0 && histogramPrev < 0 && histogram > histogramPrev)) return null;
  if (d.currentPrice < d.bollinger.lower) return null;

  return (
    `BẮT ĐÁY HOẢNG LOẠN: RSI=${d.rsi14.toFixed(1)} (<30), ` +
    `MACD Hist thu hẹp (${histogramPrev.toFixed(0)}→${histogram.toFixed(0)}), ` +
    `Close ${d.currentPrice.toLocaleString("vi-VN")} nảy BB dưới ${d.bollinger.lower.toLocaleString("vi-VN")}`
  );
}

function checkShortTermReversal(d: TAData): string | null {
  if (d.rsi14 < 45 || d.rsi14 > 65) return null;
  if (!d.macd) return null;

  const crossEma10 = d.prevClose < d.prevEma10 && d.currentPrice > d.ema10;
  const crossEma20 = d.prevClose < d.prevEma20 && d.currentPrice > d.ema20;
  if (!crossEma10 && !crossEma20) return null;

  const todayVol = d.volume10[d.volume10.length - 1] ?? 0;
  if (d.avgVolume20 <= 0 || todayVol <= d.avgVolume20) return null;
  if (d.macd.histogram <= d.macd.histogramPrev) return null;

  const crossLabel = crossEma10 && crossEma20 ? "EMA10+EMA20" : crossEma10 ? "EMA10" : "EMA20";
  const volRatio = (todayVol / d.avgVolume20).toFixed(1);

  return (
    `ĐẢO CHIỀU NGẮN HẠN: Close cắt lên ${crossLabel}, ` +
    `Vol x${volRatio} TB20, MACD tăng, RSI=${d.rsi14.toFixed(1)}`
  );
}

function checkBreakout52W(d: TAData): string | null {
  if (!d.high52w || d.currentPrice <= 0) return null;
  const ratio = d.currentPrice / d.high52w;
  if (ratio < 0.95) return null; // Cần gần đỉnh 52W (>= 95%)

  const todayVol = d.volume10[d.volume10.length - 1] ?? 0;
  if (d.avgVolume20 <= 0 || todayVol <= d.avgVolume20 * 1.5) return null; // Volume phải > 1.5x TB20

  return (
    `VƯỢT ĐỈNH 52W: Giá ${d.currentPrice.toLocaleString("vi-VN")} gần đỉnh ${d.high52w.toLocaleString("vi-VN")} (${(ratio * 100).toFixed(1)}%), ` +
    `Vol x${(todayVol / d.avgVolume20).toFixed(1)} TB20`
  );
}

function checkSupportTest(d: TAData): string | null {
  if (!d.bollinger) return null;

  // Test MA50: giá chạm EMA50 từ trên xuống và bật lên
  const nearEma50 = Math.abs(d.currentPrice - d.ema50) / d.ema50 < 0.02; // Trong 2% EMA50
  const bouncing = d.currentPrice > d.prevClose;

  if (!nearEma50 || !bouncing) return null;
  if (d.rsi14 < 35 || d.rsi14 > 55) return null; // RSI hợp lệ

  return (
    `VỀ VÙNG HỖ TRỢ: Giá ${d.currentPrice.toLocaleString("vi-VN")} test EMA50 (${d.ema50.toLocaleString("vi-VN")}), ` +
    `RSI=${d.rsi14.toFixed(1)}, đang bật lên`
  );
}

function checkAccumulation(d: TAData): string | null {
  if (!d.bollinger) return null;

  // Tích lũy nến: BB hẹp + volume thấp
  const bbWidth = (d.bollinger.upper - d.bollinger.lower) / d.bollinger.middle;
  if (bbWidth > 0.08) return null; // BB phải hẹp (< 8%)

  const todayVol = d.volume10[d.volume10.length - 1] ?? 0;
  if (d.avgVolume20 > 0 && todayVol > d.avgVolume20 * 0.8) return null; // Volume phải thấp

  if (d.rsi14 < 40 || d.rsi14 > 60) return null;

  return (
    `TÍCH LŨY NÉN: BB width ${(bbWidth * 100).toFixed(1)}% (<8%), ` +
    `Vol thấp, RSI=${d.rsi14.toFixed(1)} — sắp breakout`
  );
}

async function handleSignalScan5m(): Promise<NextResponse> {
  const startTime = Date.now();

  if (!isTradingDay()) {
    await logCron("signal_scan_5m", "skipped", "Không phải ngày giao dịch", 0);
    return NextResponse.json({ type: "signal_scan_5m", message: "Không phải ngày giao dịch" });
  }

  try {
    // Lấy danh sách RS-Rating stocks (ưu tiên FiinQuant, fallback VN30+midcap)
    const rsStocks = await getRSRatingStocks();

    // Lấy các mã đã báo tín hiệu hôm nay
    const startOfDay = new Date();
    startOfDay.setHours(0, 0, 0, 0);
    const todaySignals = await prisma.signal.findMany({
      where: { createdAt: { gte: startOfDay } },
      select: { ticker: true },
    });
    const alreadySignaled = todaySignals.map((s: { ticker: string }) => s.ticker);

    const toScan = rsStocks.filter((s) => !alreadySignaled.includes(s));
    if (toScan.length === 0) {
      await logCron("signal_scan_5m", "success", "Tất cả mã đã được quét", Date.now() - startTime);
      return NextResponse.json({
        type: "signal_scan_5m",
        message: "Tất cả mã RS-Rating đã được quét hôm nay",
        totalSignaledToday: alreadySignaled.length,
      });
    }

    console.log(`[signal-5m] Quét ${toScan.length}/${rsStocks.length} mã RS-Rating`);

    // Batch fetch TA data
    const taMap = await batchFetchTA(toScan);

    // Phát hiện tín hiệu qua 5 loại pattern
    const newSignals: DetectedSignal[] = [];

    for (const [ticker, data] of taMap) {
      const checks = [
        checkPanicBottom(data),
        checkShortTermReversal(data),
        checkBreakout52W(data),
        checkSupportTest(data),
        checkAccumulation(data),
      ];

      for (const reason of checks) {
        if (reason) {
          newSignals.push({ ticker, type: "DAU_CO", entryPrice: data.currentPrice, reason });
          break; // 1 tín hiệu / mã
        }
      }
    }

    // Lưu signals vào DB
    if (newSignals.length > 0) {
      await prisma.$transaction(
        newSignals.map((sig) =>
          prisma.signal.create({
            data: {
              ticker: sig.ticker,
              type: sig.type,
              entryPrice: sig.entryPrice,
              reason: sig.reason,
            },
          })
        )
      );

      // Đẩy Notification tổng hợp
      const signalList = newSignals
        .map((s) => `• ${s.ticker}: ${s.reason}`)
        .join("\n");

      const vnNow = new Date(new Date().toLocaleString("en-US", { timeZone: "Asia/Ho_Chi_Minh" }));
      const timeStr = `${vnNow.getHours()}:${vnNow.getMinutes().toString().padStart(2, "0")}`;

      await pushNotification(
        "signal_5m",
        `📡 ${newSignals.length} tín hiệu mới (${timeStr})`,
        `## TÍN HIỆU MỚI PHÁT HIỆN\n\n${signalList}`
      );
    }

    const duration = Date.now() - startTime;
    await logCron("signal_scan_5m", "success",
      `Quét ${taMap.size}/${toScan.length} mã, ${newSignals.length} tín hiệu mới`,
      duration,
      { scanned: taMap.size, newSignals: newSignals.length }
    );

    return NextResponse.json({
      type: "signal_scan_5m",
      timestamp: new Date().toISOString(),
      message: newSignals.length > 0
        ? `Phát hiện ${newSignals.length} tín hiệu mới`
        : "Không có tín hiệu mới",
      newSignals,
      scanned: taMap.size,
      totalRSStocks: rsStocks.length,
      totalSignaledToday: alreadySignaled.length + newSignals.length,
    });
  } catch (error) {
    await logCron("signal_scan_5m", "error", String(error), Date.now() - startTime);
    console.error("[CRON signal-5m]", error);
    return NextResponse.json({ error: "Lỗi quét tín hiệu" }, { status: 500 });
  }
}
