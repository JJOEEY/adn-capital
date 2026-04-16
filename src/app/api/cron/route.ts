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
  getSignalWindowInfo,
} from "@/lib/cronHelpers";
import {
  getMarketSnapshot,
  formatSnapshotForAI,
  getInvestorTradingText,
  getPropTradingData,
  formatPropTradingForAI,
} from "@/lib/marketDataFetcher";
import { fetchAllCafefNews, buildCafefContext } from "@/lib/cafefScraper";

export const maxDuration = 120;
export const dynamic = "force-dynamic";

const PYTHON_BRIDGE = process.env.PYTHON_BRIDGE_URL ?? "http://localhost:8000";

type CronType = "prop_trading" | "intraday" | "signal_scan_5m";

function buildIntradayFallback(today: string, timeLabel: string, vnidx?: { value: number; changePct: number }) {
  const idx = vnidx ? `${vnidx.value} | ${vnidx.changePct >= 0 ? "+" : ""}${vnidx.changePct}%` : "chưa cập nhật";
  return `⚡ *BẢN TIN INTRADAY — ${timeLabel} ${today}*

📊 *CHỈ SỐ:*
🇻🇳 VN-INDEX: ${idx}

⚠️ *GHI CHÚ DỮ LIỆU:*
• Một số dữ liệu intraday đang cập nhật.
• Hệ thống sẽ tự đồng bộ ngay khi nguồn dữ liệu đầy đủ.

_Powered by ADN Capital AI_`;
}

function buildPropTradingFallback(today: string, foreignNet?: number | null, propNet?: number | null, retailNet?: number | null) {
  const format = (value: number | null | undefined) =>
    value == null ? "chưa cập nhật" : `${value >= 0 ? "+" : ""}${value.toFixed(1)} tỷ`;
  return `🌙 *BẢN TIN TỔNG HỢP 19:00 — ${today}*

📊 *DÒNG TIỀN NHÀ ĐẦU TƯ:*
• Khối ngoại: ${format(foreignNet)}
• Tự doanh: ${format(propNet)}
• Cá nhân: ${format(retailNet)}

⚠️ *GHI CHÚ DỮ LIỆU:*
• Một số dữ liệu có thể đang đồng bộ cuối ngày.
• Hệ thống sẽ tự cập nhật lại khi nguồn đầy đủ.

_Powered by ADN Capital AI_`;
}

// ═══════════════════════════════════════════════════════════════
//  Router
// ═══════════════════════════════════════════════════════════════

export async function GET(req: NextRequest) {
  if (!validateCronSecret(req)) {
    return NextResponse.json({ error: "Không có quyền truy cập" }, { status: 401 });
  }

  const type = req.nextUrl.searchParams.get("type") as CronType | null;
  const sync = req.nextUrl.searchParams.get("sync") === "1";

  if (!type || !["prop_trading", "intraday", "signal_scan_5m"].includes(type)) {
    return NextResponse.json(
      {
        error: "Thiếu hoặc sai tham số 'type'",
        availableTypes: ["prop_trading", "intraday", "signal_scan_5m"],
      },
      { status: 400 }
    );
  }

  if (sync) {
    if (type === "prop_trading") return handlePropTrading();
    if (type === "intraday") return handleIntraday();
    return handleSignalScan5m();
  }

  const queued = await prisma.cronLog.create({
    data: {
      cronName: type,
      status: "skipped",
      message: "queued",
      resultData: JSON.stringify({ type, queuedAt: new Date().toISOString() }),
      duration: 0,
    },
    select: { id: true, createdAt: true },
  });

  const run = async () => {
    try {
      if (type === "prop_trading") await handlePropTrading();
      else if (type === "intraday") await handleIntraday();
      else await handleSignalScan5m();
      await prisma.cronLog.update({
        where: { id: queued.id },
        data: { status: "success", message: "completed" },
      });
    } catch (error) {
      await prisma.cronLog.update({
        where: { id: queued.id },
        data: { status: "error", message: String(error) },
      });
    }
  };

  setTimeout(() => {
    void run();
  }, 0);

  return NextResponse.json({
    accepted: true,
    jobId: queued.id,
    queuedAt: queued.createdAt.toISOString(),
    type,
  });
}

// ═══════════════════════════════════════════════════════════════
//  1. EOD FULL 19:00 — Ngoại + Tự doanh + Cá nhân
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
    const [propData, snapshot] = await Promise.all([getPropTradingData(), getMarketSnapshot()]);

    if (propData) {
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
    }

    const foreignLine = getInvestorTradingText(snapshot, "full19").find((line) => line.startsWith("Khối ngoại")) ?? "Khối ngoại: chưa cập nhật";
    const proprietaryLine = getInvestorTradingText(snapshot, "full19").find((line) => line.startsWith("Tự doanh")) ?? "Tự doanh: chưa cập nhật";
    const retailLine = getInvestorTradingText(snapshot, "full19").find((line) => line.startsWith("Cá nhân")) ?? "Cá nhân: chưa cập nhật";

    // Gemini — Telegram-friendly Markdown format
    const prompt = `Bạn là Senior Quant tại ADN Capital.
Dữ liệu thị trường tổng hợp cuối ngày:
${formatSnapshotForAI(snapshot, { investorMode: "full19" })}
${propData ? `\nDữ liệu tự doanh chi tiết:\n${formatPropTradingForAI(propData)}` : ""}

Hãy viết bản tin tổng hợp 19:00 theo đúng format Markdown Telegram dưới đây.
KHÔNG thêm các section không có trong format. CHỈ dùng số liệu từ dữ liệu được cung cấp:

🌙 *BẢN TIN TỔNG HỢP 19:00 — ${today}*

📊 *DÒNG TIỀN NHÀ ĐẦU TƯ:*
• ${foreignLine}
• ${proprietaryLine}
• ${retailLine}

💧 *THANH KHOẢN:*
• Tổng: ${snapshot.liquidity != null ? `${snapshot.liquidity}` : "chưa cập nhật"} tỷ VNĐ
• HoSE/HNX/UPCoM: ${snapshot.liquidityByExchange.HOSE ?? "?"}/${snapshot.liquidityByExchange.HNX ?? "?"}/${snapshot.liquidityByExchange.UPCOM ?? "?"}

💡 *NHẬN ĐỊNH SMART MONEY:*
[2-3 câu phân tích ngắn gọn, không bịa số]

_Powered by ADN Capital AI_`;

    let report = "";
    try {
      report = await generateText(prompt);
    } catch (err) {
      console.warn("[prop_trading] Gemini fallback:", err);
    }
    const safeReport =
      report?.trim()
        ? report
        : buildPropTradingFallback(
            today,
            snapshot.investorTrading.foreign.net,
            snapshot.investorTrading.proprietary.net,
            snapshot.investorTrading.retail.net
          );

    await saveMarketReport(
      "eod_full_19h",
      `Bản tin tổng hợp 19:00 ${today}`,
      safeReport,
      { snapshot, propData },
      {
        investorAvailability: snapshot.investorTrading.availability,
        liquidityByExchange: snapshot.liquidityByExchange,
      }
    );
    await pushNotification("eod_full_19h", `🌙 Bản tin tổng hợp 19:00 ${today}`, safeReport);

    const duration = Date.now() - startTime;
    await logCron("prop_trading", "success", `EOD full 19h, ${duration}ms`, duration, {
      investorAvailability: snapshot.investorTrading.availability,
    });
    return NextResponse.json({ type: "eod_full_19h", timestamp: new Date().toISOString(), report: safeReport });
  } catch (error) {
    await logCron("prop_trading", "error", String(error), Date.now() - startTime);
    return NextResponse.json({ error: "Lỗi Tự Doanh" }, { status: 500 });
  }
}

// ═══════════════════════════════════════════════════════════════
//  2. INTRADAY — 10:00, 11:30, 14:00, 14:45
//     Format Dashboard chuyên nghiệp
// ═══════════════════════════════════════════════════════════════

async function handleIntraday(): Promise<NextResponse> {
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
    const investorLines = getInvestorTradingText(snapshot, "intraday");
    const investorSection = investorLines.length > 0 ? investorLines.map((line) => `• ${line}`).join("\n") : "• Khối ngoại: chưa cập nhật";
    const liq = snapshot.liquidityByExchange;
    const fmtLiq = (v: number | null) => (v == null ? "?" : `${(v > 1_000_000 ? v / 1_000_000_000 : v).toFixed(0)} tỷ`);

    const prompt = `Bạn là ADN AI Bot — trợ lý giao dịch chuyên nghiệp.
Data thực: ${formatSnapshotForAI(snapshot, { investorMode: "intraday" })}
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
• Thanh khoản sàn: HoSE ${fmtLiq(liq.HOSE)} \\| HNX ${fmtLiq(liq.HNX)} \\| UPCoM ${fmtLiq(liq.UPCOM)}
${investorSection}

🌐 *TIN NHANH:*
[2 tin quan trọng nhất từ CafeF, 1 dòng/tin]

⚠️ *NHẬN ĐỊNH:*
[1-2 câu ngắn gọn, dứt khoát]

_Powered by ADN Capital AI_`;

    let report = "";
    try {
      report = await generateText(prompt);
    } catch (err) {
      console.warn("[intraday] Gemini fallback:", err);
    }
    const safeReport = report?.trim() ? report : buildIntradayFallback(today, timeLabel, vnidx);
    await saveMarketReport("intraday_update", `Market Update ${timeLabel}`, safeReport, {
      indices: snapshot.indices, breadth: snapshot.breadth, liquidity: snapshot.liquidity,
    });

    const idxInfo = vnidx ? ` | VN-Index: ${vnidx.value} (${vnidx.changePct >= 0 ? "+" : ""}${vnidx.changePct}%)` : "";
    await pushNotification(notifType, `⚡ Market Update ${timeLabel}${idxInfo}`, safeReport);

    const duration = Date.now() - startTime;
    await logCron("intraday", "success", `${notifType}, ${duration}ms`, duration);
    return NextResponse.json({ type: "intraday", notifType, timeLabel, report: safeReport, timestamp: new Date().toISOString() });
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

const FIXED_SCAN_SLOTS = new Set(["10:00", "10:30", "11:30", "14:00", "14:45"]);

function toSignalKey(ticker: string, type: string): string {
  return `${ticker.toUpperCase().trim()}|${type}`;
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
  const timeKey = `${hour}:${min.toString().padStart(2, "0")}`;

  // ── Smart Gate ─────────────────────────────────────────────────────
  //  09:00–11:00 → quét 15m (min chia hết cho 15)
  //  11:00–11:30 → TẠM DỪNG
  //  11:30       → quét 1 lần
  //  11:30–13:00 → TẠM DỪNG
  //  13:00–13:30 → TẠM DỪNG
  //  13:30–14:00 → quét 15m
  //  14:00–14:45 → quét 5m (Giờ Vàng — pass through)
  // ──────────────────────────────────────────────────────────────────
  if (!FIXED_SCAN_SLOTS.has(timeKey)) {
    return NextResponse.json({ message: `Fixed Gate: skip ${timeKey}` });
  }

  try {
    // Lấy mã đã báo hôm nay
    const todayISO = getVNDateISO();
    const sentTodayRows = await prisma.signalHistory.findMany({
      where: { sentDate: todayISO },
      select: { ticker: true, signalType: true },
    });
    const alreadySent = new Set(sentTodayRows.map((r) => toSignalKey(r.ticker, r.signalType)));

    // 1 API call → Python scanner
    const res = await fetch(`${PYTHON_BRIDGE}/api/v1/scan-now`, { method: "POST", signal: AbortSignal.timeout(90_000) });
    if (!res.ok) throw new Error(`Python scanner HTTP ${res.status}`);
    const scanResult: { detected: number; signals: PythonScanSignal[] } = await res.json();

    const uniqueSignals = Array.from(
      new Map(scanResult.signals.map((s) => [toSignalKey(s.ticker, s.type), s])).values()
    );
    const startOfDay = new Date();
    startOfDay.setHours(0, 0, 0, 0);

    const todaySignals = await prisma.signal.findMany({
      where: { createdAt: { gte: startOfDay } },
      select: { id: true, ticker: true, type: true, status: true },
    });
    const existingMap = new Map(todaySignals.map((s) => [toSignalKey(s.ticker, s.type), s]));

    let createdCount = 0;
    let updatedCount = 0;
    const notifySignals: PythonScanSignal[] = [];

    await prisma.$transaction(async (tx) => {
      for (const signal of uniqueSignals) {
        const ticker = signal.ticker.toUpperCase().trim();
        const key = toSignalKey(ticker, signal.type);
        const existing = existingMap.get(key);

        if (existing) {
          if (existing.status !== "CLOSED") {
            await tx.signal.update({
              where: { id: existing.id },
              data: {
                entryPrice: signal.entryPrice,
                reason: signal.reason ?? null,
              },
            });
            updatedCount += 1;
          }
        } else {
          await tx.signal.create({
            data: {
              ticker,
              type: signal.type,
              entryPrice: signal.entryPrice,
              reason: signal.reason ?? null,
            },
          });
          createdCount += 1;
        }

        if (!alreadySent.has(key)) {
          notifySignals.push({ ...signal, ticker });
        }
      }

      if (notifySignals.length > 0) {
        await tx.signalHistory.createMany({
          data: notifySignals.map((s) => ({
            ticker: s.ticker,
            signalType: s.type,
            sentDate: todayISO,
          })),
          skipDuplicates: true,
        });
      }
    });

    if (notifySignals.length > 0) {
      const signalText = notifySignals
        .map((s) => `• ${s.ticker}: ${s.entryPrice.toLocaleString("vi-VN")} VNĐ${s.reason ? ` — ${s.reason}` : ""}`)
        .join("\n");
      const windowInfo = getSignalWindowInfo(vnNow);
      await pushNotification(
        windowInfo.type,
        `⚡ ${windowInfo.label} — ${notifySignals.length} tín hiệu mới`,
        `## TÍN HIỆU MỚI (${windowInfo.label})\n\n${signalText}`
      );
    }

    const duration = Date.now() - startTime;
    await logCron("signal_scan_5m", "success",
      `Python scan: ${scanResult.detected} phát hiện, tạo ${createdCount}, cập nhật ${updatedCount}, notify ${notifySignals.length}`,
      duration,
      { scanned: scanResult.detected, created: createdCount, updated: updatedCount, notified: notifySignals.length }
    );

    return NextResponse.json({
      type: "signal_scan_5m",
      timestamp: new Date().toISOString(),
      message:
        createdCount + updatedCount > 0
          ? `Đồng bộ ${createdCount + updatedCount} tín hiệu (mới ${createdCount}, cập nhật ${updatedCount})`
          : "Không có tín hiệu cần đồng bộ",
      created: createdCount,
      updated: updatedCount,
      notified: notifySignals.length,
      totalSignaledToday: alreadySent.size + notifySignals.length,
    });
  } catch (error) {
    await logCron("signal_scan_5m", "error", String(error), Date.now() - startTime);
    return NextResponse.json({ error: "Lỗi quét tín hiệu" }, { status: 500 });
  }
}
