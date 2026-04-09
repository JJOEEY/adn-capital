/**
 * API Cron Dispatcher — Smart Scheduler v2
 *
 * Smart Cron Schedule (VN Market Hours):
 * - 09:00–11:00: Quét 15 phút/lần (quét kỹ thuật)
 * - 11:00–11:30: TẠM DỪNG (nghỉ trưa Nhật/Pháp)
 * - 11:30: Quét 1 lần
 * - 13:00–13:30: TẠM DỪNG (nghỉ trưa phiên chiều)
 * - 13:30–14:00: Quét 15 phút/lần
 * - 14:00–14:45: Quét 5 phút/lần (Giờ Vàng)
 *
 * Endpoints:
 * - GET /api/cron?type=prop_trading     → 19:00 T2-T6
 * - GET /api/cron?type=intraday         → 10:00/11:30/14:00/14:45
 * - GET /api/cron?type=signal_scan_5m   → Smart 5m/15m gate
 */
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { generateText } from "@/lib/gemini";
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
} from "@/lib/marketDataFetcher";
import { fetchAllCafefNews, buildCafefContext } from "@/lib/cafefScraper";

export const maxDuration = 120;
export const dynamic = "force-dynamic";

const PYTHON_BRIDGE = process.env.PYTHON_BRIDGE_URL ?? "http://localhost:8000";

// ═══════════════════════════════════════════════════════════════
//  Router
// ═══════════════════════════════════════════════════════════════

export async function GET(req: NextRequest) {
  if (!validateCronSecret(req)) {
    return NextResponse.json({ error: "Không có quyền truy cập" }, { status: 401 });
  }

  const type = req.nextUrl.searchParams.get("type");

  switch (type) {
    case "prop_trading":     return handlePropTrading();
    case "intraday":         return handleIntraday(req);
    case "signal_scan_5m":   return handleSignalScan5m();
    default:
      return NextResponse.json({
        error: "Thiếu hoặc sai tham số 'type'",
        availableTypes: ["prop_trading", "intraday", "signal_scan_5m"],
      }, { status: 400 });
  }
}

// ═══════════════════════════════════════════════════════════════
//  1. PROP TRADING (TỰ DOANH) — 19:00 T2-T6
// ═══════════════════════════════════════════════════════════════

async function handlePropTrading(): Promise<NextResponse> {
  const startTime = Date.now();
  if (!isTradingDay()) {
    await logCron("prop_trading", "skipped", "Không phải ngày giao dịch", 0);
    return NextResponse.json({ message: "Skipped" });
  }

  const today = getVNDateString();
  const dateISO = getVNDateISO();

  try {
    const propData = await getPropTradingData();
    if (!propData) {
      await logCron("prop_trading", "error", "Không lấy được data", 0);
      return NextResponse.json({ error: "No data" }, { status: 502 });
    }

    // Lưu DB
    await prisma.propTrading.upsert({
      where: { date: dateISO },
      update: { totalBuy: propData.totalBuy, totalSell: propData.totalSell, netValue: propData.netValue, topBuy: JSON.stringify(propData.topBuy), topSell: JSON.stringify(propData.topSell), rawData: JSON.stringify(propData) },
      create: { date: dateISO, totalBuy: propData.totalBuy, totalSell: propData.totalSell, netValue: propData.netValue, topBuy: JSON.stringify(propData.topBuy), topSell: JSON.stringify(propData.topSell), rawData: JSON.stringify(propData) },
    });

    // Gemini — Telegram-friendly Markdown format
    const prompt = `Bạn là Senior Quant tại ADN Capital.
Dữ liệu Tự Doanh: ${formatPropTradingForAI(propData)}

Hãy viết bản tin Tự Doanh theo đúng format Markdown Telegram dưới đây.
KHÔNG thêm các section không có trong format. CHỈ dùng số liệu từ dữ liệu được cung cấp:

🏦 *BÁO CÁO TỰ DOANH CTCK — ${today}*

📊 *TỔNG QUAN:*
• Mua ròng: ${propData.totalBuy?.toFixed(1)} tỷ
• Bán ròng: ${propData.totalSell?.toFixed(1)} tỷ
• Ròng: *${propData.netValue >= 0 ? "+" : ""}${propData.netValue?.toFixed(1)} tỷ*

📈 *TOP MUA RÒNG:*
[Liệt kê từ topBuy, format: + TICKER: X.X tỷ]

📉 *TOP BÁN RÒNG:*
[Liệt kê từ topSell, format: - TICKER: X.X tỷ]

💡 *NHẬN ĐỊNH SMART MONEY:*
[2-3 câu phân tích súc tích — Smart Money đang làm gì?]

_Powered by ADN Capital AI_`;

    const report = await generateText(prompt);
    await saveMarketReport("prop_trading", `Tự Doanh ${today}`, report, propData, { netValue: propData.netValue });
    await pushNotification("prop_trading", `🏦 Tự Doanh ${today}: ${propData.netValue >= 0 ? "+" : ""}${propData.netValue?.toFixed(1)} tỷ`, report);

    const duration = Date.now() - startTime;
    await logCron("prop_trading", "success", `Net: ${propData.netValue} tỷ`, duration);
    return NextResponse.json({ type: "prop_trading", timestamp: new Date().toISOString(), report });
  } catch (error) {
    await logCron("prop_trading", "error", String(error), Date.now() - startTime);
    return NextResponse.json({ error: "Lỗi Tự Doanh" }, { status: 500 });
  }
}

// ═══════════════════════════════════════════════════════════════
//  2. INTRADAY — 10:00, 11:30, 14:00, 14:45
//     Format Dashboard chuyên nghiệp
// ═══════════════════════════════════════════════════════════════

async function handleIntraday(req: NextRequest): Promise<NextResponse> {
  const startTime = Date.now();
  if (!isTradingDay()) {
    await logCron("intraday", "skipped", "Không phải ngày giao dịch", 0);
    return NextResponse.json({ message: "Skipped" });
  }

  const today = getVNDateString();
  const vnNow = new Date(new Date().toLocaleString("en-US", { timeZone: "Asia/Ho_Chi_Minh" }));
  const hour = vnNow.getHours();
  const minute = vnNow.getMinutes();
  const timeLabel = `${hour}:${minute.toString().padStart(2, "0")}`;

  let notifType: string;
  if (hour === 10) notifType = "signal_10h";
  else if (hour === 11) notifType = "signal_1130";
  else if (hour === 14 && minute < 30) notifType = "signal_14h";
  else notifType = "signal_1445";

  try {
    const [snapshot, cafefNews] = await Promise.all([
      getMarketSnapshot(),
      fetchAllCafefNews(),
    ]);

    const vnidx = snapshot.indices.find(i => i.ticker === "VNINDEX");
    const vn30  = snapshot.indices.find(i => i.ticker === "VN30");
    const breadth = snapshot.breadth;

    const prompt = `Bạn là ADN AI Bot — trợ lý giao dịch chuyên nghiệp.
Data thực: ${formatSnapshotForAI(snapshot)}
Tin CafeF: ${buildCafefContext(cafefNews)}

Hãy viết bản tin intraday theo format Markdown Telegram dưới đây.
TUYỆT ĐỐI CHỈ dùng số liệu từ Data thực được cung cấp:

⚡ *BẢN TIN INTRADAY — ${timeLabel} ${today}*

📊 *CHỈ SỐ:*
🇻🇳 VN\\-INDEX: ${vnidx?.value ?? "N/A"} \\| ${vnidx && vnidx.changePct >= 0 ? "+" : ""}${vnidx?.changePct ?? "N/A"}%
💎 VN30: ${vn30?.value ?? "N/A"} \\| ${vn30 && vn30.changePct >= 0 ? "+" : ""}${vn30?.changePct ?? "N/A"}%

📈 *ĐỘ RỘNG & THANH KHOẢN:*
• ${breadth?.up ?? "?"} Tăng \\| ${breadth?.down ?? "?"} Giảm \\| ${breadth?.unchanged ?? "?"} Đứng
• Thanh khoản: ${snapshot.liquidity ?? "?"} tỷ VNĐ
• Khối ngoại: [Lấy từ data nếu có, nếu không thì bỏ qua]

🌐 *TIN NHANH:*
[2 tin quan trọng nhất từ CafeF, 1 dòng/tin]

⚠️ *NHẬN ĐỊNH:*
[1-2 câu ngắn gọn, dứt khoát]

_Powered by ADN Capital AI_`;

    const report = await generateText(prompt);
    await saveMarketReport("intraday_update", `Market Update ${timeLabel}`, report, {
      indices: snapshot.indices, breadth: snapshot.breadth, liquidity: snapshot.liquidity,
    });

    const idxInfo = vnidx ? ` | VN-Index: ${vnidx.value} (${vnidx.changePct >= 0 ? "+" : ""}${vnidx.changePct}%)` : "";
    await pushNotification(notifType, `⚡ Market Update ${timeLabel}${idxInfo}`, report);

    const duration = Date.now() - startTime;
    await logCron("intraday", "success", `${notifType}, ${duration}ms`, duration);
    return NextResponse.json({ type: "intraday", notifType, timeLabel, report, timestamp: new Date().toISOString() });
  } catch (error) {
    await logCron("intraday", "error", String(error), Date.now() - startTime);
    return NextResponse.json({ error: "Lỗi intraday" }, { status: 500 });
  }
}

// ═══════════════════════════════════════════════════════════════
//  3. SMART SIGNAL SCAN — 15m/5m gate
//
//  Vercel gọi mỗi 5 phút. Logic nội bộ quyết định có chạy không.
// ═══════════════════════════════════════════════════════════════

interface PythonScanSignal {
  ticker: string;
  type: "SIEU_CO_PHIEU" | "TRUNG_HAN" | "DAU_CO";
  entryPrice: number;
  reason?: string;
}

async function handleSignalScan5m(): Promise<NextResponse> {
  const startTime = Date.now();
  if (!isTradingDay()) {
    await logCron("signal_scan_5m", "skipped", "Không phải ngày giao dịch", 0);
    return NextResponse.json({ message: "Skipped" });
  }

  const vnNow = new Date(new Date().toLocaleString("en-US", { timeZone: "Asia/Ho_Chi_Minh" }));
  const hour = vnNow.getHours();
  const min  = vnNow.getMinutes();

  // ── Smart Gate ─────────────────────────────────────────────────────
  //  09:00–11:00 → quét 15m (min chia hết cho 15)
  //  11:00–11:30 → TẠM DỪNG
  //  11:30       → quét 1 lần
  //  11:30–13:00 → TẠM DỪNG
  //  13:00–13:30 → TẠM DỪNG
  //  13:30–14:00 → quét 15m
  //  14:00–14:45 → quét 5m (Giờ Vàng — pass through)
  // ──────────────────────────────────────────────────────────────────
  let shouldRun = false;
  if      (hour === 9  || (hour === 10))                    shouldRun = (min % 15 === 0);
  else if (hour === 11 && min === 30)                       shouldRun = true;
  else if (hour === 13 && min >= 30)                        shouldRun = (min % 15 === 0);
  else if (hour === 14 && min <= 45)                        shouldRun = true; // Giờ Vàng

  if (!shouldRun) {
    return NextResponse.json({ message: `Smart Gate: skip ${hour}:${min.toString().padStart(2, "0")}` });
  }

  try {
    // Lấy mã đã báo hôm nay
    const startOfDay = new Date(); startOfDay.setHours(0, 0, 0, 0);
    const todaySignals = await prisma.signal.findMany({ where: { createdAt: { gte: startOfDay } }, select: { ticker: true } });
    const alreadySignaled = todaySignals.map((s: { ticker: string }) => s.ticker);

    // 1 API call → Python scanner
    const res = await fetch(`${PYTHON_BRIDGE}/api/v1/scan-now`, { method: "POST", signal: AbortSignal.timeout(90_000) });
    if (!res.ok) throw new Error(`Python scanner HTTP ${res.status}`);
    const scanResult: { detected: number; signals: PythonScanSignal[] } = await res.json();

    const newSignals = scanResult.signals.filter(s => !alreadySignaled.includes(s.ticker));

    if (newSignals.length > 0) {
      await prisma.$transaction(
        newSignals.map(sig => prisma.signal.create({
          data: { ticker: sig.ticker, type: sig.type, entryPrice: sig.entryPrice, reason: sig.reason },
        }))
      );
    }

    const duration = Date.now() - startTime;
    await logCron("signal_scan_5m", "success",
      `Python scan: ${scanResult.detected} phát hiện, ${newSignals.length} tín hiệu mới`,
      duration, { scanned: scanResult.detected, newSignals: newSignals.length }
    );

    return NextResponse.json({
      type: "signal_scan_5m",
      timestamp: new Date().toISOString(),
      message: newSignals.length > 0 ? `Phát hiện ${newSignals.length} tín hiệu mới` : "Không có tín hiệu mới",
      newSignals,
      totalSignaledToday: alreadySignaled.length + newSignals.length,
    });
  } catch (error) {
    await logCron("signal_scan_5m", "error", String(error), Date.now() - startTime);
    return NextResponse.json({ error: "Lỗi quét tín hiệu" }, { status: 500 });
  }
}
