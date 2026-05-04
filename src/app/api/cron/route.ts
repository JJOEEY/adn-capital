/**
 * API Cron Dispatcher — Smart Scheduler v2
 *
 * Smart Cron Schedule (VN Market Hours):
 * - Chỉ quét tại 4 mốc cố định để bảo toàn quota FiinQuant:
 *   10:00, 10:30, 14:00, 14:25
 *
 * Endpoints:
 * - GET /api/cron?type=prop_trading     → 19:00 T2-T6
 * - GET /api/cron?type=market_stats     → 10:00/11:30/14:00/14:45
 * - GET /api/cron?type=signal_scan_5m   → fixed-slot gate
 */
import { NextRequest, NextResponse } from "next/server";
import fs from "fs";
import path from "path";
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
  findMarketReportForVNDate,
} from "@/lib/cronHelpers";
import {
  getMarketSnapshot,
  formatSnapshotForAI,
  getInvestorTradingText,
  getPropTradingData,
} from "@/lib/marketDataFetcher";
import { fetchEodNews, type FiinEodNews } from "@/lib/fiinquantClient";
import { fetchAllCafefNews, buildCafefContext } from "@/lib/cafefScraper";
import { getVnNow } from "@/lib/time";
import { invalidateTopics } from "@/lib/datahub/core";
import { normalizeCronType, LEGACY_CRON_ALIASES } from "@/lib/cron-contracts";
import { getPythonBridgeUrl } from "@/lib/runtime-config";
import { emitWorkflowTrigger } from "@/lib/workflows";
import { emitObservabilityEvent } from "@/lib/observability";
import { SIGNAL_SCAN_SLOT_SET, ingestSignalScanBatch } from "@/lib/signals/ingest";
import { sendClaimedSignalsToTelegram } from "@/lib/signals/telegram-notify";

export const maxDuration = 120;
export const dynamic = "force-dynamic";

const PYTHON_BRIDGE = getPythonBridgeUrl();
const MARKET_OVERVIEW_CACHE_FILE = path.join(process.cwd(), "market_cache.json");
const EOD_FULL_MINUTE_VN = 19 * 60;

function getVnMinuteOfDay(): number {
  const now = getVnNow();
  return now.hour() * 60 + now.minute();
}

function saveMarketOverviewCache(overview: unknown) {
  if (!overview || typeof overview !== "object") return;
  try {
    fs.writeFileSync(
      MARKET_OVERVIEW_CACHE_FILE,
      JSON.stringify(
        {
          ...(overview as Record<string, unknown>),
          last_updated: new Date().toISOString(),
        },
        null,
        2,
      ),
    );
  } catch (error) {
    console.error("[cron:eod_full_19h] Failed to save ADNCore cache:", error);
  }
}

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

async function handleNewsCrawler(): Promise<NextResponse> {
  const startTime = Date.now();
  try {
    const mod = await import("@/app/api/crawler/run/route");
    const headers = new Headers();
    headers.set("x-cron-secret", process.env.CRON_SECRET ?? "adn-cron-dev-key");
    const response = await mod.POST(
      new Request("http://localhost/api/crawler/run", {
        method: "POST",
        headers,
      }),
    );
    const payload = await response.json().catch(() => ({}));
    const duration = Date.now() - startTime;
    await logCron(
      "news_crawler",
      response.ok ? "success" : "error",
      response.ok ? "News crawler completed" : "News crawler failed",
      duration,
      payload,
    );
    if (response.ok) {
      invalidateTopics({ tags: ["news", "articles", "dashboard"] });
    }
    return NextResponse.json({ type: "news_crawler", ...payload }, { status: response.status });
  } catch (error) {
    const duration = Date.now() - startTime;
    await logCron("news_crawler", "error", String(error), duration);
    return NextResponse.json({ error: "Lỗi cập nhật tin tức" }, { status: 500 });
  }
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

function hasFullExchangeLiquidity(snapshot: Awaited<ReturnType<typeof getMarketSnapshot>>): boolean {
  const liq = snapshot.liquidityByExchange;
  return ["HOSE", "HNX", "UPCOM"].every((exchange) => {
    const value = liq[exchange as keyof typeof liq];
    return value != null && Number.isFinite(value) && value > 0;
  });
}

function hasFullExchangeBreadth(snapshot: Awaited<ReturnType<typeof getMarketSnapshot>>): boolean {
  const byExchange = snapshot.breadthByExchange;
  if (!byExchange) return false;

  return ["HOSE", "HNX", "UPCOM"].every((exchange) => {
    const breadth = byExchange[exchange as keyof typeof byExchange];
    if (!breadth) return false;
    return breadth.up + breadth.down + breadth.unchanged > 0;
  });
}

function hasRequiredStatsData(snapshot: Awaited<ReturnType<typeof getMarketSnapshot>>): boolean {
  const hasMainIndex = snapshot.indices.some((item) => item.ticker === "VNINDEX");
  return (
    hasMainIndex &&
    hasMeaningfulLiquidity(snapshot) &&
    hasFullExchangeLiquidity(snapshot) &&
    hasMeaningfulBreadth(snapshot) &&
    hasFullExchangeBreadth(snapshot) &&
    snapshot.investorTrading.availability.foreign
  );
}

function hasRequiredClose15Data(snapshot: Awaited<ReturnType<typeof getMarketSnapshot>>): boolean {
  const hasMainIndex = snapshot.indices.some((item) => item.ticker === "VNINDEX");
  return (
    hasMainIndex &&
    hasMeaningfulLiquidity(snapshot) &&
    hasFullExchangeLiquidity(snapshot) &&
    hasMeaningfulBreadth(snapshot) &&
    snapshot.investorTrading.availability.foreign
  );
}

function hasRequiredFull19Data(snapshot: Awaited<ReturnType<typeof getMarketSnapshot>>): boolean {
  const hasMainIndex = snapshot.indices.some((item) => item.ticker === "VNINDEX");
  return (
    hasMainIndex &&
    hasMeaningfulLiquidity(snapshot) &&
    hasFullExchangeLiquidity(snapshot) &&
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

function formatBreadthGroup(
  breadth:
    | { up: number; down: number; unchanged: number; ceiling?: number; floor?: number }
    | null
    | undefined,
): string {
  if (!breadth) return "chưa cập nhật";
  const ceiling = Number(breadth.ceiling ?? 0);
  const floor = Number(breadth.floor ?? 0);
  const extra = ceiling > 0 || floor > 0 ? ` | Trần ${ceiling} | Sàn ${floor}` : "";
  return `Tăng ${breadth.up} | Giảm ${breadth.down} | Đứng ${breadth.unchanged}${extra}`;
}

function buildBreadthSection(snapshot: Awaited<ReturnType<typeof getMarketSnapshot>>): string {
  const byExchange = snapshot.breadthByExchange;
  return [
    "📊 *ĐỘ RỘNG THỊ TRƯỜNG:*",
    `• Toàn thị trường: ${formatBreadthGroup(snapshot.breadth)}`,
    `• HoSE: ${formatBreadthGroup(byExchange?.HOSE)}`,
    `• HNX: ${formatBreadthGroup(byExchange?.HNX)}`,
    `• UPCoM: ${formatBreadthGroup(byExchange?.UPCOM)}`,
  ].join("\n");
}

function buildPropTradingReport(today: string, snapshot: Awaited<ReturnType<typeof getMarketSnapshot>>) {
  {
    const idx = snapshot.indices.find((item) => item.ticker === "VNINDEX");
    const vn30Index = snapshot.indices.find((item) => item.ticker === "VN30");
    const investorLines = getInvestorTradingText(snapshot, "full19");
    const investorSection =
      investorLines.length > 0
        ? investorLines.map((line) => `• ${line}`).join("\n")
        : "• Khối ngoại: chưa cập nhật\n• Tự doanh: chưa cập nhật\n• Cá nhân: chưa cập nhật";
    const exchangeValue = (value: number | null) => (value == null ? "?" : formatTy(value));
    const totalLiquidity = snapshot.liquidity != null ? formatTy(snapshot.liquidity) : "chưa cập nhật";
    const indexDirection =
      (idx?.changePct ?? 0) > 0
        ? "Thị trường duy trì sắc xanh."
        : (idx?.changePct ?? 0) < 0
        ? "Thị trường chịu áp lực điều chỉnh."
        : "Thị trường đi ngang, chưa hình thành xu hướng rõ.";
    const foreignNet = snapshot.investorTrading.foreign.net ?? 0;
    const flowNote =
      foreignNet > 0
        ? "Khối ngoại đang hỗ trợ xu hướng ngắn hạn."
        : foreignNet < 0
        ? "Khối ngoại vẫn bán ròng, cần quản trị rủi ro chặt chẽ."
        : "Dòng tiền khối ngoại trung tính.";

    return `🌙 *BẢN TIN TỔNG HỢP 19:00 — ${today}*

📊 *KẾT QUẢ CHỈ SỐ:*
🇻🇳 VN-INDEX: ${idx ? `${idx.value} | ${idx.changePct >= 0 ? "+" : ""}${idx.changePct}%` : "chưa cập nhật"}
💎 VN30: ${vn30Index ? `${vn30Index.value} | ${vn30Index.changePct >= 0 ? "+" : ""}${vn30Index.changePct}%` : "chưa cập nhật"}

💧 *THANH KHOẢN:*
• Tổng: ${totalLiquidity}
• HoSE/HNX/UPCoM: ${exchangeValue(snapshot.liquidityByExchange.HOSE)} | ${exchangeValue(snapshot.liquidityByExchange.HNX)} | ${exchangeValue(snapshot.liquidityByExchange.UPCOM)}

${buildBreadthSection(snapshot)}

🏦 *DÒNG TIỀN NHÀ ĐẦU TƯ:*
${investorSection}

💡 *NHẬN ĐỊNH SMART MONEY:*
• ${indexDirection}
• ${flowNote}

_Powered by ADN Capital AI_`;
  }

  const vnindex = snapshot.indices.find((item) => item.ticker === "VNINDEX")!;
  const vn30 = snapshot.indices.find((item) => item.ticker === "VN30")!;
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
          "news_crawler",
        ],
        legacyAliases: LEGACY_CRON_ALIASES,
      },
      { status: 400 }
    );
  }

  emitObservabilityEvent({
    domain: "cron",
    event: "cron_dispatch_received",
    meta: {
      requestedType,
      normalizedType: type,
      sync,
      forceRun,
      legacyAliasUsed: Boolean(requestedType && requestedType !== type),
    },
  });

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
    if (type === "news_crawler") {
      return runCronHandlerWithWorkflowHook(type, () => handleNewsCrawler(), "cron-dispatch:sync");
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
      } else if (type === "news_crawler") {
        await runCronHandlerWithWorkflowHook(type, () => handleNewsCrawler(), "cron-dispatch:async");
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

  emitObservabilityEvent({
    domain: "cron",
    event: "cron_dispatch_queued",
    meta: {
      requestedType,
      normalizedType: type,
      queuedId: queued.id,
      sync,
      forceRun,
    },
  });

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

function formatTyPublic(value: number | null | undefined): string {
  if (value == null || !Number.isFinite(value)) return "chưa cập nhật";
  return `${Math.abs(value).toLocaleString("vi-VN", { maximumFractionDigits: 0 })} tỷ`;
}

function formatPctPublic(value: number | null | undefined): string {
  if (value == null || !Number.isFinite(value)) return "chưa cập nhật";
  return `${value >= 0 ? "+" : ""}${value.toFixed(2)}%`;
}

function formatIndexPublic(index: { value: number; changePct: number } | undefined): string {
  if (!index) return "chưa cập nhật";
  return `${index.value.toLocaleString("vi-VN", { maximumFractionDigits: 2 })} (${formatPctPublic(index.changePct)})`;
}

function formatBreadthPublic(
  breadth:
    | { up: number; down: number; unchanged: number; ceiling?: number; floor?: number }
    | null
    | undefined,
): string {
  if (!breadth) return "chưa cập nhật";
  const ceiling = Number(breadth.ceiling ?? 0);
  const floor = Number(breadth.floor ?? 0);
  const limitText = ceiling > 0 || floor > 0 ? ` | Trần ${ceiling} | Sàn ${floor}` : "";
  return `Tăng ${breadth.up} | Giảm ${breadth.down} | Đứng ${breadth.unchanged}${limitText}`;
}

function buildFull19PublicReport(today: string, snapshot: Awaited<ReturnType<typeof getMarketSnapshot>>) {
  const vnindex = snapshot.indices.find((item) => item.ticker === "VNINDEX");
  const vn30 = snapshot.indices.find((item) => item.ticker === "VN30");
  const investorLines = getInvestorTradingText(snapshot, "full19");
  const investorSection =
    investorLines.length > 0
      ? investorLines.map((line) => `• ${line}`).join("\n")
      : "• Khối ngoại: chưa cập nhật\n• Tự doanh: chưa cập nhật\n• Cá nhân: chưa cập nhật";
  const byExchange = snapshot.breadthByExchange;
  const foreignNet = snapshot.investorTrading.foreign.net ?? 0;
  const indexDirection =
    (vnindex?.changePct ?? 0) > 0
      ? "Thị trường duy trì sắc xanh, ưu tiên lọc nhóm giữ nền tích cực."
      : (vnindex?.changePct ?? 0) < 0
        ? "Thị trường chịu áp lực điều chỉnh, ưu tiên quản trị rủi ro."
        : "Thị trường đi ngang, chờ xác nhận dòng tiền mới.";
  const flowNote =
    foreignNet > 0
      ? "Khối ngoại mua ròng, hỗ trợ tâm lý ngắn hạn."
      : foreignNet < 0
        ? "Khối ngoại bán ròng, cần kiểm soát tỷ trọng và điểm dừng lỗ."
        : "Dòng tiền khối ngoại trung tính.";

  return `🌙 *BẢN TIN TỔNG HỢP 19:00 — ${today}*

📊 *CHỈ SỐ CHÍNH*
• VN-INDEX: ${formatIndexPublic(vnindex)}
• VN30: ${formatIndexPublic(vn30)}

💧 *THANH KHOẢN THEO SÀN*
• Tổng: ${formatTyPublic(snapshot.liquidity)}
• HoSE: ${formatTyPublic(snapshot.liquidityByExchange.HOSE)}
• HNX: ${formatTyPublic(snapshot.liquidityByExchange.HNX)}
• UPCoM: ${formatTyPublic(snapshot.liquidityByExchange.UPCOM)}

📈 *ĐỘ RỘNG THỊ TRƯỜNG*
• Toàn thị trường: ${formatBreadthPublic(snapshot.breadth)}
• HoSE: ${formatBreadthPublic(byExchange?.HOSE)}
• HNX: ${formatBreadthPublic(byExchange?.HNX)}
• UPCoM: ${formatBreadthPublic(byExchange?.UPCOM)}

🏦 *DÒNG TIỀN NHÀ ĐẦU TƯ*
${investorSection}

💡 *NHẬN ĐỊNH SMART MONEY*
• ${indexDirection}
• ${flowNote}

_Powered by ADN Capital AI_`;
}

function countEodDetailBuckets(eodDetail: FiinEodNews | null | undefined): number {
  if (!eodDetail) return 0;
  const buckets = [
    [...(eodDetail.foreign_top_buy ?? []), ...(eodDetail.foreign_top_sell ?? [])],
    [...(eodDetail.prop_trading_top_buy ?? []), ...(eodDetail.prop_trading_top_sell ?? [])],
    [...(eodDetail.individual_top_buy ?? []), ...(eodDetail.individual_top_sell ?? [])],
    [...(eodDetail.sector_gainers ?? []), ...(eodDetail.sector_losers ?? [])],
    [...(eodDetail.buy_signals ?? []), ...(eodDetail.sell_signals ?? [])],
    [...(eodDetail.top_breakout ?? []), ...(eodDetail.top_new_high ?? [])],
  ];
  return buckets.filter((items) => items.some((item) => String(item ?? "").trim().length > 0)).length;
}

function hasCompleteEodDetail(eodDetail: FiinEodNews | null | undefined): boolean {
  if (!eodDetail) return false;
  const liquidity = Number(eodDetail.total_liquidity ?? eodDetail.liquidity ?? 0);
  const hasOutlook = typeof eodDetail.outlook === "string" && eodDetail.outlook.trim().length >= 40;
  return Number.isFinite(liquidity) && liquidity > 0 && hasOutlook && countEodDetailBuckets(eodDetail) >= 3;
}

async function handlePropTrading(forceRun = false): Promise<NextResponse> {
  const startTime = Date.now();
  const today = getVNDateString();
  const dateISO = getVNDateISO();

  try {
    if (!forceRun && getVnMinuteOfDay() < EOD_FULL_MINUTE_VN) {
      const duration = Date.now() - startTime;
      await logCron("eod_full_19h", "skipped", "EOD Full skipped before 19:00 VN", duration, {
        nextSlot: "19:00",
      });
      return NextResponse.json({
        type: "eod_full_19h",
        skipped: true,
        reason: "before_scheduled_slot",
        nextSlot: "19:00",
      });
    }

    const existingReport = forceRun
      ? null
      : await findMarketReportForVNDate("eod_full_19h", dateISO, { notBeforeMinuteVN: 19 * 60 });
    if (existingReport) {
      const duration = Date.now() - startTime;
      await logCron("eod_full_19h", "skipped", "EOD Brief already generated for today", duration, {
        existingReportId: existingReport.id,
      });
      return NextResponse.json({
        type: "eod_full_19h",
        skipped: true,
        reason: "already_generated_today",
        reportId: existingReport.id,
        report: existingReport.content,
      });
    }

    const [propData, snapshot, eodDetail] = await Promise.all([
      getPropTradingData(),
      getMarketSnapshot(),
      fetchEodNews().catch(() => null),
    ]);
    saveMarketOverviewCache(snapshot.marketOverview);

    if (!hasCompleteEodDetail(eodDetail)) {
      const duration = Date.now() - startTime;
      await logCron("eod_full_19h", "skipped", "EOD detail incomplete, keep previous complete report", duration, {
        detailBuckets: countEodDetailBuckets(eodDetail),
        eodDetailAvailable: Boolean(eodDetail),
      });
      return NextResponse.json({
        type: "eod_full_19h",
        published: false,
        reason: "eod_detail_incomplete",
      });
    }

    if (
      !hasRequiredFull19Data(snapshot) &&
      !forceRun &&
      process.env.CRON_BLOCK_MISSING_BRIEF === "1"
    ) {
      const duration = Date.now() - startTime;
      await logCron(
        "eod_full_19h",
        "skipped",
        "Thiếu dữ liệu bắt buộc cho bản tin 19:00, không publish công khai",
        duration,
          {
            availability: snapshot.investorTrading.availability,
            liquidity: snapshot.liquidity,
            liquidityByExchange: snapshot.liquidityByExchange,
            breadth: snapshot.breadth,
            breadthByExchange: snapshot.breadthByExchange,
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

    const safeReport = buildFull19PublicReport(today, snapshot);

    await saveMarketReport(
      "eod_full_19h",
      `Bản tin tổng hợp 19:00 ${today}`,
      safeReport,
      { snapshot, propData, eodDetail },
      {
        investorAvailability: snapshot.investorTrading.availability,
        liquidity: snapshot.liquidity,
        liquidityByExchange: snapshot.liquidityByExchange,
        breadth: snapshot.breadth,
        breadthByExchange: snapshot.breadthByExchange,
        source: snapshot.source,
        eodDetailAvailable: Boolean(eodDetail),
        eodDetailComplete: hasCompleteEodDetail(eodDetail),
        publishBlockers: snapshot.publishBlockers,
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
//  2. INTRADAY — 10:00, 10:30, 14:00, 14:25
//     Format Dashboard chuyên nghiệp
// ═══════════════════════════════════════════════════════════════

async function handleIntraday(forceRun = false): Promise<NextResponse> {
  const startTime = Date.now();
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

  const prompt = `Bạn là AIDEN Analyst — trợ lý phân tích chuyên nghiệp của ADN Capital.
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

  if (!SIGNAL_SCAN_SLOT_SET.has(timeKey)) {
    return NextResponse.json({ message: `Fixed Gate: skip ${timeKey}` });
  }

  try {
    const todayISO = getVNDateISO();
    const windowInfo = getSignalWindowInfo(vnNow.toDate());
    const res = await fetch(`${PYTHON_BRIDGE}/api/v1/scan-now`, {
      method: "POST",
      signal: AbortSignal.timeout(90_000),
    });
    if (!res.ok) throw new Error(`Python scanner HTTP ${res.status}`);

    const scanResult: { detected?: number; signals?: PythonScanSignal[] } = await res.json();
    const signals = Array.isArray(scanResult.signals) ? scanResult.signals : [];
    const ingestResult = await ingestSignalScanBatch({
      signals,
      detected: Number.isFinite(scanResult.detected) ? Number(scanResult.detected) : signals.length,
      tradingDate: todayISO,
      slot: timeKey,
      slotLabel: windowInfo.label,
      source: "cron",
      scannedAt: new Date(),
    });

    const webNotifySignals = ingestResult.artifact.notifiedSignals;
    if (webNotifySignals.length > 0) {
      const signalText = webNotifySignals
        .map((signal) => `• ${signal.ticker}: ${signal.entryPrice.toLocaleString("vi-VN")} VNĐ${signal.reason ? ` — ${signal.reason}` : ""}`)
        .join("\n");
      await pushNotification(
        windowInfo.type,
        `⚡ ${windowInfo.label} — ${webNotifySignals.length} tín hiệu mới`,
        `## TÍN HIỆU MỚI (${windowInfo.label})\n\n${signalText}`,
      );
    }

    if (ingestResult.activatedSignals.length > 0) {
      await Promise.all(
        ingestResult.activatedSignals.map((signal) =>
          emitWorkflowTrigger({
            type: "signal_status_changed",
            source: "cron:signal_scan_type1",
            payload: signal,
          }),
        ),
      );
    }

    invalidateTopics({ tags: ["signal", "signal-scan", "broker", "portfolio"] });

    const duration = Date.now() - startTime;
    await logCron(
      "signal_scan_type1",
      "success",
      `Python scan: ${ingestResult.detected} phát hiện, tạo ${ingestResult.created}, cập nhật ${ingestResult.updated}, notify ${ingestResult.notified.length}`,
      duration,
      {
        scanned: ingestResult.detected,
        accepted: ingestResult.accepted,
        processed: ingestResult.processed.length,
        created: ingestResult.created,
        updated: ingestResult.updated,
        notified: ingestResult.notified.length,
        reconciledWebOnly: 0,
        scanArtifact: ingestResult.artifact,
      },
    );

    const totalSignaledToday = await prisma.signalHistory.count({ where: { sentDate: todayISO } });

    return NextResponse.json({
      type: "signal_scan_type1",
      timestamp: new Date().toISOString(),
      batchId: ingestResult.artifact.batchId,
      message:
        ingestResult.created + ingestResult.updated > 0
          ? `Đồng bộ ${ingestResult.created + ingestResult.updated} tín hiệu (mới ${ingestResult.created}, cập nhật ${ingestResult.updated})`
          : "Không có tín hiệu cần đồng bộ",
      created: ingestResult.created,
      updated: ingestResult.updated,
      notified: ingestResult.notified.length,
      reconciledWebOnly: 0,
      totalSignaledToday,
    });
  } catch (error) {
    await logCron("signal_scan_type1", "error", String(error), Date.now() - startTime);
    return NextResponse.json({ error: "Lỗi quét tín hiệu" }, { status: 500 });
  }
}

async function handleSignalScan5mWithMojibakeRetired(): Promise<NextResponse> {
  const startTime = Date.now();
  if (!isTradingDay()) {
    await logCron("signal_scan_type1", "skipped", "KhÃ´ng pháº£i ngÃ y giao dá»‹ch", 0);
    return NextResponse.json({ message: "Skipped" });
  }

  const vnNow = getVnNow();
  const hour = vnNow.hour();
  const min = vnNow.minute();
  const timeKey = `${hour}:${min.toString().padStart(2, "0")}`;

  if (!SIGNAL_SCAN_SLOT_SET.has(timeKey)) {
    return NextResponse.json({ message: `Fixed Gate: skip ${timeKey}` });
  }

  try {
    const todayISO = getVNDateISO();
    const windowInfo = getSignalWindowInfo(vnNow.toDate());
    const res = await fetch(`${PYTHON_BRIDGE}/api/v1/scan-now`, {
      method: "POST",
      signal: AbortSignal.timeout(90_000),
    });
    if (!res.ok) throw new Error(`Python scanner HTTP ${res.status}`);

    const scanResult: { detected?: number; signals?: PythonScanSignal[] } = await res.json();
    const signals = Array.isArray(scanResult.signals) ? scanResult.signals : [];
    const ingestResult = await ingestSignalScanBatch({
      signals,
      detected: Number.isFinite(scanResult.detected) ? Number(scanResult.detected) : signals.length,
      tradingDate: todayISO,
      slot: timeKey,
      slotLabel: windowInfo.label,
      source: "cron",
      scannedAt: new Date(),
    });

    const webNotifySignals = ingestResult.artifact.notifiedSignals;
    if (webNotifySignals.length > 0) {
      const signalText = webNotifySignals
        .map((signal) => `â€¢ ${signal.ticker}: ${signal.entryPrice.toLocaleString("vi-VN")} VNÄ${signal.reason ? ` â€” ${signal.reason}` : ""}`)
        .join("\n");
      await pushNotification(
        windowInfo.type,
        `âš¡ ${windowInfo.label} â€” ${webNotifySignals.length} tÃ­n hiá»‡u má»›i`,
        `## TÃN HIá»†U Má»šI (${windowInfo.label})\n\n${signalText}`,
      );
      await sendClaimedSignalsToTelegram({
        signals: webNotifySignals,
        tradingDate: todayISO,
        slotLabel: windowInfo.label,
        batchId: ingestResult.artifact.batchId,
      });
    }

    if (ingestResult.activatedSignals.length > 0) {
      await Promise.all(
        ingestResult.activatedSignals.map((signal) =>
          emitWorkflowTrigger({
            type: "signal_status_changed",
            source: "cron:signal_scan_type1",
            payload: signal,
          }),
        ),
      );
    }

    invalidateTopics({ tags: ["signal", "signal-scan", "broker", "portfolio"] });

    const duration = Date.now() - startTime;
    await logCron(
      "signal_scan_type1",
      "success",
      `Python scan: ${ingestResult.detected} phÃ¡t hiá»‡n, táº¡o ${ingestResult.created}, cáº­p nháº­t ${ingestResult.updated}, notify ${ingestResult.notified.length}`,
      duration,
      {
        scanned: ingestResult.detected,
        accepted: ingestResult.accepted,
        processed: ingestResult.processed.length,
        created: ingestResult.created,
        updated: ingestResult.updated,
        notified: ingestResult.notified.length,
        reconciledWebOnly: 0,
        scanArtifact: ingestResult.artifact,
      },
    );

    const totalSignaledToday = await prisma.signalHistory.count({ where: { sentDate: todayISO } });

    return NextResponse.json({
      type: "signal_scan_type1",
      timestamp: new Date().toISOString(),
      batchId: ingestResult.artifact.batchId,
      message:
        ingestResult.created + ingestResult.updated > 0
          ? `Äá»“ng bá»™ ${ingestResult.created + ingestResult.updated} tÃ­n hiá»‡u (má»›i ${ingestResult.created}, cáº­p nháº­t ${ingestResult.updated})`
          : "KhÃ´ng cÃ³ tÃ­n hiá»‡u cáº§n Ä‘á»“ng bá»™",
      created: ingestResult.created,
      updated: ingestResult.updated,
      notified: ingestResult.notified.length,
      reconciledWebOnly: 0,
      totalSignaledToday,
    });
  } catch (error) {
    await logCron("signal_scan_type1", "error", String(error), Date.now() - startTime);
    return NextResponse.json({ error: "Lá»—i quÃ©t tÃ­n hiá»‡u" }, { status: 500 });
  }
}
/* legacy signal scanner retired after DataHub ingest split.
async function handleSignalScan5mLegacy(): Promise<NextResponse> {
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
  //  10:00, 10:30, 14:00, 14:25
  // ──────────────────────────────────────────────────────────────────
  if (!SIGNAL_SCAN_SLOT_SET.has(timeKey)) {
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
      select: { id: true, ticker: true, type: true, status: true, entryPrice: true },
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
        const isExistingLive = existing.status === "ACTIVE" || existing.status === "HOLD_TO_DIE";
        const isNextLive = nextStatus === "ACTIVE" || nextStatus === "HOLD_TO_DIE";
        const effectiveEntryPrice =
          isExistingLive && isNextLive && existing.entryPrice > 0 ? existing.entryPrice : s.entryPrice;
        const livePayload =
          isNextLive && s.entryPrice > 0 && effectiveEntryPrice > 0
            ? {
                currentPrice: s.entryPrice,
                currentPnl: +(((s.entryPrice - effectiveEntryPrice) / effectiveEntryPrice) * 100).toFixed(2),
              }
            : {};

        return prisma.signal.update({
          where: { id: existing.id },
          data: {
            status: nextStatus,
            entryPrice: effectiveEntryPrice,
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
            ...livePayload,
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

    const notifySignals = await claimSignalNotifications(createCandidatesForNotify, todayISO);
    const webNotifySignals = notifySignals;

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
        reconciledWebOnly: 0,
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
      reconciledWebOnly: 0,
      totalSignaledToday: alreadySent.size + notifySignals.length,
    });
  } catch (error) {
    await logCron("signal_scan_type1", "error", String(error), Date.now() - startTime);
    return NextResponse.json({ error: "Lỗi quét tín hiệu" }, { status: 500 });
  }
}
*/
