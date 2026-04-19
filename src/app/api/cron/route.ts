/**
 * API Cron Dispatcher — Smart Scheduler v2
 *
 * Smart Cron Schedule (VN Market Hours):
 * - Chỉ quét tại 4 mốc cố định để bảo toàn quota FiinQuant:
 *   10:00, 10:30, 14:00, 14:20
 *
 * Endpoints:
 * - GET /api/cron?type=prop_trading     → 19:00 T2-T6
 * - GET /api/cron?type=market_stats     → 10:00/11:30/14:00/14:45
 * - GET /api/cron?type=signal_scan_5m   → fixed-slot gate
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
} from "@/lib/marketDataFetcher";
import { fetchAllCafefNews, buildCafefContext } from "@/lib/cafefScraper";
import { processSignals } from "@/lib/UltimateSignalEngine";
import { getVnNow } from "@/lib/time";
import {
  getAiBrokerRuntimeConfig,
  shouldAutoActivateSignal,
  rebalanceActiveBasketNav,
} from "@/lib/aiBroker";
import { invalidateTopics } from "@/lib/datahub/core";
import { normalizeCronType, LEGACY_CRON_ALIASES } from "@/lib/cron-contracts";
import { getPythonBridgeUrl } from "@/lib/runtime-config";
import { emitWorkflowTrigger } from "@/lib/workflows";

export const maxDuration = 120;
export const dynamic = "force-dynamic";

const PYTHON_BRIDGE = getPythonBridgeUrl();

function buildInternalCronRequest(url: string): NextRequest {
  const headers = new Headers();
  headers.set("x-cron-secret", process.env.CRON_SECRET ?? "adn-cron-dev-key");
  return new NextRequest(url, { headers });
}

async function runCronHandlerWithWorkflowHook(
  cronType: string,
  handler: () => Promise<NextResponse>,
  source: string,
) {
  try {
    const response = await handler();
    const status = response.status < 400 ? "success" : "error";
    await emitWorkflowTrigger({
      type: "cron",
      source,
      payload: {
        cronType,
        status,
        httpStatus: response.status,
      },
    });
    return response;
  } catch (error) {
    await emitWorkflowTrigger({
      type: "cron",
      source,
      payload: {
        cronType,
        status: "error",
        error: error instanceof Error ? error.message : String(error),
      },
    });
    throw error;
  }
}

async function handleMorningBrief(forceRun = false): Promise<NextResponse> {
  const mod = await import("@/app/api/cron/morning-report/route");
  const url = new URL("http://localhost/api/cron/morning-report");
  if (forceRun) url.searchParams.set("force", "1");
  return mod.GET(buildInternalCronRequest(url.toString()));
}

async function handleCloseBrief15(forceRun = false): Promise<NextResponse> {
  const mod = await import("@/app/api/cron/afternoon-review/route");
  const url = new URL("http://localhost/api/cron/afternoon-review");
  if (forceRun) url.searchParams.set("force", "1");
  return mod.GET(buildInternalCronRequest(url.toString()));
}

function hasMeaningfulBreadth(snapshot: Awaited<ReturnType<typeof getMarketSnapshot>>): boolean {
  const breadth = snapshot.breadth;
  return !!breadth && breadth.up + breadth.down + breadth.unchanged > 0;
}

function hasMeaningfulLiquidity(snapshot: Awaited<ReturnType<typeof getMarketSnapshot>>): boolean {
  const total = snapshot.liquidity;
  const hose = snapshot.liquidityByExchange.HOSE;
  return total != null && total > 0 && hose != null && hose > 0;
}

function hasRequiredStatsData(snapshot: Awaited<ReturnType<typeof getMarketSnapshot>>): boolean {
  const hasMainIndex = snapshot.indices.some((item) => item.ticker === "VNINDEX");
  return (
    hasMainIndex &&
    hasMeaningfulLiquidity(snapshot) &&
    hasMeaningfulBreadth(snapshot) &&
    snapshot.investorTrading.availability.foreign
  );
}

function hasRequiredClose15Data(snapshot: Awaited<ReturnType<typeof getMarketSnapshot>>): boolean {
  const hasMainIndex = snapshot.indices.some((item) => item.ticker === "VNINDEX");
  return (
    hasMainIndex &&
    hasMeaningfulLiquidity(snapshot) &&
    hasMeaningfulBreadth(snapshot) &&
    snapshot.investorTrading.availability.foreign
  );
}

function hasRequiredFull19Data(snapshot: Awaited<ReturnType<typeof getMarketSnapshot>>): boolean {
  const hasMainIndex = snapshot.indices.some((item) => item.ticker === "VNINDEX");
  return (
    hasMainIndex &&
    hasMeaningfulLiquidity(snapshot) &&
    hasMeaningfulBreadth(snapshot) &&
    snapshot.investorTrading.availability.foreign &&
    snapshot.investorTrading.availability.proprietary &&
    snapshot.investorTrading.availability.retail
  );
}

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

function formatTy(value: number | null | undefined): string {
  if (value == null || !Number.isFinite(value)) return "chưa cập nhật";
  return `${Math.abs(value).toLocaleString("vi-VN", { maximumFractionDigits: 0 })} tỷ`;
}

function buildPropTradingReport(today: string, snapshot: Awaited<ReturnType<typeof getMarketSnapshot>>) {
  const vnindex = snapshot.indices.find((item) => item.ticker === "VNINDEX");
  const vn30 = snapshot.indices.find((item) => item.ticker === "VN30");
  const investorLines = getInvestorTradingText(snapshot, "full19");
  const investorSection =
    investorLines.length > 0
      ? investorLines.map((line) => `• ${line}`).join("\n")
      : "• Khối ngoại: chưa cập nhật\n• Tự doanh: chưa cập nhật\n• Cá nhân: chưa cập nhật";

  const fmtExchange = (value: number | null) => (value == null ? "?" : formatTy(value));
  const liquidityTotal = snapshot.liquidity != null ? formatTy(snapshot.liquidity) : "chưa cập nhật";

  const direction =
    (vnindex?.changePct ?? 0) > 0
      ? "thị trường duy trì sắc xanh."
      : (vnindex?.changePct ?? 0) < 0
      ? "thị trường chịu áp lực điều chỉnh."
      : "thị trường đi ngang, chưa hình thành xu hướng rõ.";

  const foreignNet = snapshot.investorTrading.foreign.net ?? 0;
  const flowNote =
    foreignNet > 0
      ? "Khối ngoại đang hỗ trợ xu hướng ngắn hạn."
      : foreignNet < 0
      ? "Khối ngoại vẫn bán ròng, cần quản trị rủi ro chặt chẽ."
      : "Dòng tiền khối ngoại trung tính.";

  return `🌙 *BẢN TIN TỔNG HỢP 19:00 — ${today}*

📊 *KẾT QUẢ CHỈ SỐ:*
🇻🇳 VN-INDEX: ${vnindex ? `${vnindex.value} | ${vnindex.changePct >= 0 ? "+" : ""}${vnindex.changePct}%` : "chưa cập nhật"}
💎 VN30: ${vn30 ? `${vn30.value} | ${vn30.changePct >= 0 ? "+" : ""}${vn30.changePct}%` : "chưa cập nhật"}

💧 *THANH KHOẢN:*
• Tổng: ${liquidityTotal}
• HoSE/HNX/UPCoM: ${fmtExchange(snapshot.liquidityByExchange.HOSE)} | ${fmtExchange(snapshot.liquidityByExchange.HNX)} | ${fmtExchange(snapshot.liquidityByExchange.UPCOM)}

🏦 *DÒNG TIỀN NHÀ ĐẦU TƯ:*
${investorSection}

💡 *NHẬN ĐỊNH SMART MONEY:*
• ${direction}
• ${flowNote}

_Powered by ADN Capital AI_`;
}

// ═══════════════════════════════════════════════════════════════
//  Router
// ═══════════════════════════════════════════════════════════════

export async function GET(req: NextRequest) {
  if (!validateCronSecret(req)) {
    return NextResponse.json({ error: "Không có quyền truy cập" }, { status: 401 });
  }

  const requestedType = req.nextUrl.searchParams.get("type");
  const type = normalizeCronType(requestedType);
  const sync = req.nextUrl.searchParams.get("sync") === "1";
  const forceRun = req.nextUrl.searchParams.get("force") === "1";

  if (!type) {
    return NextResponse.json(
      {
        error: "Thiếu hoặc sai tham số 'type'",
        availableTypes: [
          "morning_brief",
          "close_brief_15h",
          "eod_full_19h",
          "market_stats_type2",
          "signal_scan_type1",
        ],
        legacyAliases: LEGACY_CRON_ALIASES,
      },
      { status: 400 }
    );
  }

  if (sync) {
    if (type === "morning_brief") {
      return runCronHandlerWithWorkflowHook(type, () => handleMorningBrief(forceRun), "cron-dispatch:sync");
    }
    if (type === "close_brief_15h") {
      return runCronHandlerWithWorkflowHook(type, () => handleCloseBrief15(forceRun), "cron-dispatch:sync");
    }
    if (type === "eod_full_19h") {
      return runCronHandlerWithWorkflowHook(type, () => handlePropTrading(forceRun), "cron-dispatch:sync");
    }
    if (type === "market_stats_type2") {
      return runCronHandlerWithWorkflowHook(type, () => handleIntraday(forceRun), "cron-dispatch:sync");
    }
    return runCronHandlerWithWorkflowHook(type, () => handleSignalScan5m(), "cron-dispatch:sync");
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
      if (type === "morning_brief") {
        await runCronHandlerWithWorkflowHook(type, () => handleMorningBrief(forceRun), "cron-dispatch:async");
      } else if (type === "close_brief_15h") {
        await runCronHandlerWithWorkflowHook(type, () => handleCloseBrief15(forceRun), "cron-dispatch:async");
      } else if (type === "eod_full_19h") {
        await runCronHandlerWithWorkflowHook(type, () => handlePropTrading(forceRun), "cron-dispatch:async");
      } else if (type === "market_stats_type2") {
        await runCronHandlerWithWorkflowHook(type, () => handleIntraday(forceRun), "cron-dispatch:async");
      } else {
        await runCronHandlerWithWorkflowHook(type, () => handleSignalScan5m(), "cron-dispatch:async");
      }
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
    requestedType,
  });
}

// ═══════════════════════════════════════════════════════════════
//  1. EOD FULL 19:00 — Ngoại + Tự doanh + Cá nhân
// ═══════════════════════════════════════════════════════════════

async function handlePropTrading(forceRun = false): Promise<NextResponse> {
  const startTime = Date.now();
  if (!forceRun && !isTradingDay()) {
    await logCron("eod_full_19h", "skipped", "Không phải ngày giao dịch", 0);
    return NextResponse.json({ message: "Skipped" });
  }

  const today = getVNDateString();
  const dateISO = getVNDateISO();

  try {
    const [propData, snapshot] = await Promise.all([getPropTradingData(), getMarketSnapshot()]);

    if (!hasRequiredFull19Data(snapshot) && !forceRun) {
      const duration = Date.now() - startTime;
      await logCron(
        "eod_full_19h",
        "skipped",
        "Thiếu dữ liệu bắt buộc cho bản tin 19:00, không publish công khai",
        duration,
        {
          availability: snapshot.investorTrading.availability,
          liquidity: snapshot.liquidity,
          indices: snapshot.indices.map((item) => item.ticker),
          providerDiagnostics: snapshot.providerDiagnostics,
        },
      );
      return NextResponse.json({
        type: "eod_full_19h",
        published: false,
        reason: "missing_required_fields",
      });
    }

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

    const safeReport = buildPropTradingReport(today, snapshot);

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
    invalidateTopics({ tags: ["news", "brief", "market", "dashboard"] });
    await emitWorkflowTrigger({
      type: "brief_ready",
      source: "cron:eod_full_19h",
      payload: {
        reportType: "eod_full_19h",
        title: `Bản tin tổng hợp 19:00 ${today}`,
        content: safeReport,
        dateLabel: today,
      },
    });

    const duration = Date.now() - startTime;
    await logCron("eod_full_19h", "success", `EOD full 19h, ${duration}ms`, duration, {
      investorAvailability: snapshot.investorTrading.availability,
      providerDiagnostics: snapshot.providerDiagnostics,
      requestDateVN: snapshot.requestDateVN,
      fallbackUsed: snapshot.providerDiagnostics.length > 0,
    });
    return NextResponse.json({ type: "eod_full_19h", timestamp: new Date().toISOString(), report: safeReport });
  } catch (error) {
    await logCron("eod_full_19h", "error", String(error), Date.now() - startTime);
    return NextResponse.json({ error: "Lỗi Tự Doanh" }, { status: 500 });
  }
}

// ═══════════════════════════════════════════════════════════════
//  2. INTRADAY — 10:00, 10:30, 14:00, 14:20
//     Format Dashboard chuyên nghiệp
// ═══════════════════════════════════════════════════════════════

async function handleIntraday(forceRun = false): Promise<NextResponse> {
  const startTime = Date.now();
  if (!forceRun && !isTradingDay()) {
    await logCron("market_stats_type2", "skipped", "Không phải ngày giao dịch", 0);
    return NextResponse.json({ message: "Skipped" });
  }

  const today = getVNDateString();
  const vnNow = getVnNow();
  const windowInfo = getSignalWindowInfo(vnNow.toDate(), "type2");
  const notifType = windowInfo.type;
  const timeLabel = windowInfo.label;

  try {
    const [snapshot, cafefNews] = await Promise.all([
      getMarketSnapshot(),
      fetchAllCafefNews(),
    ]);

    if (!hasRequiredStatsData(snapshot)) {
      const duration = Date.now() - startTime;
      await logCron(
        "market_stats_type2",
        "skipped",
        "Thiếu dữ liệu bắt buộc cho bản tin cập nhật thông tin, không publish công khai",
        duration,
        {
          availability: snapshot.investorTrading.availability,
          liquidity: snapshot.liquidity,
          indices: snapshot.indices.map((item) => item.ticker),
          providerDiagnostics: snapshot.providerDiagnostics,
        },
      );
      return NextResponse.json({
        type: "market_stats_type2",
        published: false,
        reason: "missing_required_fields",
      });
    }

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
    await saveMarketReport("market_stats_update", `Market Update ${timeLabel}`, safeReport, {
      indices: snapshot.indices, breadth: snapshot.breadth, liquidity: snapshot.liquidity,
    });

    const idxInfo = vnidx ? ` | VN-Index: ${vnidx.value} (${vnidx.changePct >= 0 ? "+" : ""}${vnidx.changePct}%)` : "";
    await pushNotification(notifType, `⚡ Market Update ${timeLabel}${idxInfo}`, safeReport);
    invalidateTopics({ tags: ["market", "dashboard", "news"] });

    const duration = Date.now() - startTime;
    await logCron("market_stats_type2", "success", `${notifType}, ${duration}ms`, duration, {
      providerDiagnostics: snapshot.providerDiagnostics,
      requestDateVN: snapshot.requestDateVN,
      fallbackUsed: snapshot.providerDiagnostics.length > 0,
    });
    return NextResponse.json({ type: "market_stats_type2", notifType, timeLabel, report: safeReport, timestamp: new Date().toISOString() });
  } catch (error) {
    await logCron("market_stats_type2", "error", String(error), Date.now() - startTime);
    return NextResponse.json({ error: "Lỗi market stats" }, { status: 500 });
  }
}

// ═══════════════════════════════════════════════════════════════
//  3. SIGNAL SCAN — fixed-slot gate
//
//  Chỉ quét khi khớp 4 mốc đã chốt để bảo toàn quota.
// ═══════════════════════════════════════════════════════════════

interface PythonScanSignal {
  ticker: string;
  type: "SIEU_CO_PHIEU" | "TRUNG_HAN" | "DAU_CO" | "TAM_NGAM";
  entryPrice: number;
  reason?: string;
}

const FIXED_SCAN_SLOTS = new Set(["10:00", "10:30", "14:00", "14:20"]);

function toSignalKey(ticker: string, type: string): string {
  return `${ticker.toUpperCase().trim()}|${type}`;
}

async function handleSignalScan5m(): Promise<NextResponse> {
  const startTime = Date.now();
  if (!isTradingDay()) {
    await logCron("signal_scan_type1", "skipped", "Không phải ngày giao dịch", 0);
    return NextResponse.json({ message: "Skipped" });
  }

  const vnNow = getVnNow();
  const hour = vnNow.hour();
  const min = vnNow.minute();
  const timeKey = `${hour}:${min.toString().padStart(2, "0")}`;

  // ── Fixed Gate ─────────────────────────────────────────────────────
  //  Chỉ cho phép quét đúng 4 mốc:
  //  10:00, 10:30, 14:00, 14:20
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

    const validSignals = scanResult.signals.filter((s) =>
      s?.ticker &&
      typeof s?.entryPrice === "number" &&
      ["SIEU_CO_PHIEU", "TRUNG_HAN", "DAU_CO", "TAM_NGAM"].includes(s?.type)
    );
    const uniqueSignals = Array.from(
      new Map(validSignals.map((s) => [toSignalKey(s.ticker, s.type), s])).values()
    );
    const processed = await processSignals(uniqueSignals);
    const aiBrokerConfig = await getAiBrokerRuntimeConfig();

    const startOfDay = getVnNow().startOf("day").toDate();
    const todaySignals = await prisma.signal.findMany({
      where: { createdAt: { gte: startOfDay } },
      select: { id: true, ticker: true, type: true, status: true },
    });
    const existingMap = new Map(todaySignals.map((s) => [toSignalKey(s.ticker, s.type), s]));

    let createdCount = 0;
    let updatedCount = 0;
    const createCandidatesForNotify: PythonScanSignal[] = [];
    const activatedSignals: Array<{
      ticker: string;
      signalType: string;
      fromStatus: string;
      toStatus: string;
      entryPrice: number;
      reason: string | null;
    }> = [];

    const operations = processed.map((s) => {
      const normalizedTicker = s.ticker.toUpperCase().trim();
      const key = toSignalKey(normalizedTicker, s.type);
      const existing = existingMap.get(key);
      const autoActivate = shouldAutoActivateSignal(
        {
          entryPrice: s.entryPrice,
          currentPrice: s.entryPrice,
          winRate: s.winRate,
          rrRatio: s.rrRatio,
        },
        aiBrokerConfig
      );
      const nextStatus =
        existing?.status === "CLOSED"
          ? "CLOSED"
          : autoActivate
          ? "ACTIVE"
          : s.status;

      if (existing) {
        updatedCount += 1;
        if (existing.status !== nextStatus && nextStatus === "ACTIVE") {
          activatedSignals.push({
            ticker: normalizedTicker,
            signalType: s.type,
            fromStatus: existing.status,
            toStatus: nextStatus,
            entryPrice: s.entryPrice,
            reason: s.reason ?? null,
          });
        }
        const activePayload =
          existing.status !== "ACTIVE" && nextStatus === "ACTIVE"
            ? { currentPrice: s.entryPrice, currentPnl: 0 }
            : {};

        return prisma.signal.update({
          where: { id: existing.id },
          data: {
            status: nextStatus,
            entryPrice: s.entryPrice,
            tier: s.tier,
            navAllocation: s.navAllocation,
            target: s.target,
            stoploss: s.stoploss,
            triggerSignal: s.triggerSignal,
            aiReasoning: s.aiReasoning,
            reason: s.reason ?? null,
            winRate: s.winRate,
            sharpeRatio: s.sharpeRatio,
            rrRatio: s.rrRatio,
            ...activePayload,
          },
        });
      }

      createdCount += 1;
      if (nextStatus === "ACTIVE") {
        activatedSignals.push({
          ticker: normalizedTicker,
          signalType: s.type,
          fromStatus: "NEW",
          toStatus: nextStatus,
          entryPrice: s.entryPrice,
          reason: s.reason ?? null,
        });
      }
      createCandidatesForNotify.push({
        ticker: normalizedTicker,
        type: s.type,
        entryPrice: s.entryPrice,
        reason: s.reason,
      });
      return prisma.signal.create({
        data: {
          ticker: normalizedTicker,
          type: s.type,
          status: nextStatus,
          tier: s.tier,
          entryPrice: s.entryPrice,
          target: s.target,
          stoploss: s.stoploss,
          navAllocation: s.navAllocation,
          triggerSignal: s.triggerSignal,
          aiReasoning: s.aiReasoning,
          reason: s.reason ?? null,
          winRate: s.winRate,
          sharpeRatio: s.sharpeRatio,
          rrRatio: s.rrRatio,
          ...(nextStatus === "ACTIVE"
            ? {
                currentPrice: s.entryPrice,
                currentPnl: 0,
              }
            : {}),
        },
      });
    });

    if (operations.length > 0) {
      await prisma.$transaction(operations);
      await rebalanceActiveBasketNav(aiBrokerConfig.maxTotalNav);
    }

    const notifySignals = createCandidatesForNotify.filter(
      (s) => !alreadySent.has(toSignalKey(s.ticker, s.type))
    );
    const backfillCandidates = createCandidatesForNotify.filter(
      (s) => alreadySent.has(toSignalKey(s.ticker, s.type))
    );

    if (notifySignals.length > 0) {
      await prisma.signalHistory.createMany({
        data: notifySignals.map((s) => ({
          ticker: s.ticker,
          signalType: s.type,
          sentDate: todayISO,
        })),
        skipDuplicates: true,
      });
    }

    const reconciliationCutoff = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const recentSignalNotifications = await prisma.notification.findMany({
      where: {
        type: {
          in: [
            "signal_10h",
            "signal_1030",
            "signal_14h",
            "signal_1420",
            "signal_1130", // legacy
            "signal_1445", // legacy
            "signal_scan",
          ],
        },
        createdAt: { gte: reconciliationCutoff },
      },
      select: { content: true },
    });
    const recentContent = recentSignalNotifications.map((n) => n.content).join("\n");
    const missingOnWeb = backfillCandidates.filter((s) => !recentContent.includes(s.ticker));

    const webNotifySignals = Array.from(
      new Map(
        [...notifySignals, ...missingOnWeb].map((s) => [toSignalKey(s.ticker, s.type), s]),
      ).values(),
    );

    if (webNotifySignals.length > 0) {
      const signalText = webNotifySignals
        .map((s) => `• ${s.ticker}: ${s.entryPrice.toLocaleString("vi-VN")} VNĐ${s.reason ? ` — ${s.reason}` : ""}`)
        .join("\n");
      const windowInfo = getSignalWindowInfo(vnNow.toDate());
      await pushNotification(
        windowInfo.type,
        `⚡ ${windowInfo.label} — ${webNotifySignals.length} tín hiệu mới`,
        `## TÍN HIỆU MỚI (${windowInfo.label})\n\n${signalText}`
      );
    }
    if (activatedSignals.length > 0) {
      await Promise.all(
        activatedSignals.map((signal) =>
          emitWorkflowTrigger({
            type: "signal_status_changed",
            source: "cron:signal_scan_type1",
            payload: signal,
          }),
        ),
      );
    }
    invalidateTopics({ tags: ["signal", "broker", "portfolio"] });

    const duration = Date.now() - startTime;
    await logCron("signal_scan_type1", "success",
      `Python scan: ${scanResult.detected} phát hiện, tạo ${createdCount}, cập nhật ${updatedCount}, notify ${notifySignals.length}`,
      duration,
      {
        scanned: scanResult.detected,
        created: createdCount,
        updated: updatedCount,
        notified: notifySignals.length,
        reconciledWebOnly: missingOnWeb.length,
      }
    );

    return NextResponse.json({
      type: "signal_scan_type1",
      timestamp: new Date().toISOString(),
      message:
        createdCount + updatedCount > 0
          ? `Đồng bộ ${createdCount + updatedCount} tín hiệu (mới ${createdCount}, cập nhật ${updatedCount})`
          : "Không có tín hiệu cần đồng bộ",
      created: createdCount,
      updated: updatedCount,
      notified: notifySignals.length,
      reconciledWebOnly: missingOnWeb.length,
      totalSignaledToday: alreadySent.size + notifySignals.length,
    });
  } catch (error) {
    await logCron("signal_scan_type1", "error", String(error), Date.now() - startTime);
    return NextResponse.json({ error: "Lỗi quét tín hiệu" }, { status: 500 });
  }
}
