/**
 * API Cron: Close Brief 15:00 (Mon-Fri)
 *
 * Public rule: publish only when the report has market index, liquidity for
 * HoSE/HNX/UPCoM, total market breadth, and foreign trading flow.
 */
import { NextRequest, NextResponse } from "next/server";
import {
  validateCronSecret,
  logCron,
  pushNotification,
  saveMarketReport,
  isTradingDay,
  getVNDateString,
} from "@/lib/cronHelpers";
import { getMarketSnapshot, getInvestorTradingText } from "@/lib/marketDataFetcher";
import { getVnNow } from "@/lib/time";
import { invalidateTopics } from "@/lib/datahub/core";
import { emitWorkflowTrigger } from "@/lib/workflows";

export const maxDuration = 60;

type MarketSnapshot = Awaited<ReturnType<typeof getMarketSnapshot>>;
type ExchangeKey = "HOSE" | "HNX" | "UPCOM";

const EXCHANGES: ExchangeKey[] = ["HOSE", "HNX", "UPCOM"];

function hasFullExchangeLiquidity(snapshot: MarketSnapshot): boolean {
  return EXCHANGES.every((exchange) => {
    const value = snapshot.liquidityByExchange[exchange];
    return value != null && Number.isFinite(value) && value > 0;
  });
}

function hasRequiredCloseData(snapshot: MarketSnapshot): boolean {
  const hasMainIndex = snapshot.indices.some((item) => item.ticker === "VNINDEX");
  const breadth = snapshot.breadth;
  const hasTotalBreadth = !!breadth && breadth.up + breadth.down + breadth.unchanged > 0;
  const hasTotalLiquidity = snapshot.liquidity != null && snapshot.liquidity > 0;
  return (
    hasMainIndex &&
    hasTotalLiquidity &&
    hasFullExchangeLiquidity(snapshot) &&
    hasTotalBreadth &&
    snapshot.investorTrading.availability.foreign
  );
}

function formatTy(value: number | null | undefined): string {
  if (value == null || !Number.isFinite(value)) return "chưa cập nhật";
  return `${Math.abs(value).toLocaleString("vi-VN", { maximumFractionDigits: 0 })} tỷ`;
}

function formatPct(value: number | null | undefined): string {
  if (value == null || !Number.isFinite(value)) return "chưa cập nhật";
  return `${value >= 0 ? "+" : ""}${value.toFixed(2)}%`;
}

function formatIndex(
  index: { value: number; changePct: number } | undefined,
): string {
  if (!index) return "chưa cập nhật";
  return `${index.value.toLocaleString("vi-VN", { maximumFractionDigits: 2 })} (${formatPct(index.changePct)})`;
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

function buildLiquiditySection(snapshot: MarketSnapshot): string {
  return [
    `• Tổng: ${formatTy(snapshot.liquidity)}`,
    `• HoSE: ${formatTy(snapshot.liquidityByExchange.HOSE)}`,
    `• HNX: ${formatTy(snapshot.liquidityByExchange.HNX)}`,
    `• UPCoM: ${formatTy(snapshot.liquidityByExchange.UPCOM)}`,
  ].join("\n");
}

function buildBreadthSection(snapshot: MarketSnapshot): string {
  const byExchange = snapshot.breadthByExchange;
  return [
    `• Toàn thị trường: ${formatBreadthGroup(snapshot.breadth)}`,
    `• HoSE: ${formatBreadthGroup(byExchange?.HOSE)}`,
    `• HNX: ${formatBreadthGroup(byExchange?.HNX)}`,
    `• UPCoM: ${formatBreadthGroup(byExchange?.UPCOM)}`,
  ].join("\n");
}

function buildClose15Report(today: string, snapshot: MarketSnapshot) {
  const vnindex = snapshot.indices.find((item) => item.ticker === "VNINDEX");
  const vn30 = snapshot.indices.find((item) => item.ticker === "VN30");
  const investorLines = getInvestorTradingText(snapshot, "close15");
  const investorSection =
    investorLines.length > 0
      ? investorLines.map((line) => `• ${line}`).join("\n")
      : "• Khối ngoại: chưa cập nhật";

  const verdictText =
    (vnindex?.changePct ?? 0) >= 0
      ? "Đạt - tìm cơ hội có chọn lọc."
      : "Không đạt - ưu tiên phòng thủ.";

  return `🌆 *BẢN TIN KẾT PHIÊN 15:00 — ${today}*

📊 *CHỈ SỐ CHÍNH*
• VN-INDEX: ${formatIndex(vnindex)}
• VN30: ${formatIndex(vn30)}

💧 *THANH KHOẢN THEO SÀN*
${buildLiquiditySection(snapshot)}

📈 *ĐỘ RỘNG THỊ TRƯỜNG*
${buildBreadthSection(snapshot)}

🏦 *DÒNG TIỀN NHÀ ĐẦU TƯ*
${investorSection}

🎯 *NHẬN ĐỊNH*
• Trạng thái: ${verdictText}
• Ưu tiên kỷ luật điểm mua và kiểm soát tỷ trọng theo biến động chỉ số.

_Powered by ADN Capital AI_`;
}

export async function GET(req: NextRequest) {
  if (!validateCronSecret(req)) {
    return NextResponse.json({ error: "Không có quyền truy cập" }, { status: 401 });
  }

  const forceRun = req.nextUrl.searchParams.get("force") === "1";

  if (!forceRun && !isTradingDay()) {
    return NextResponse.json({ message: "Không phải ngày giao dịch" });
  }

  const startTime = Date.now();
  const today = getVNDateString();

  try {
    const snapshot = await getMarketSnapshot();

    if (!hasRequiredCloseData(snapshot) && !forceRun) {
      const duration = Date.now() - startTime;
      await logCron(
        "close_brief_15h",
        "skipped",
        "Thiếu dữ liệu bắt buộc cho bản tin 15:00, không publish công khai",
        duration,
        {
          liquidity: snapshot.liquidity,
          liquidityByExchange: snapshot.liquidityByExchange,
          breadth: snapshot.breadth,
          breadthByExchange: snapshot.breadthByExchange,
          investorAvailability: snapshot.investorTrading.availability,
          indices: snapshot.indices.map((item) => item.ticker),
          providerDiagnostics: snapshot.providerDiagnostics,
        },
      );
      return NextResponse.json({
        type: "close_brief_15h",
        published: false,
        reason: "missing_required_fields",
      });
    }

    const report = buildClose15Report(today, snapshot);
    const vnindex = snapshot.indices.find((item) => item.ticker === "VNINDEX");
    const isGood = (vnindex?.changePct ?? 0) >= 0;

    await saveMarketReport(
      "close_brief_15h",
      `Bản tin kết phiên 15:00 ${today}`,
      report,
      { snapshot },
      {
        verdict: isGood ? "GOOD" : "BAD",
        indices: snapshot.indices,
        marketScore: snapshot.marketOverview?.score,
        liquidity: snapshot.liquidity,
        liquidityByExchange: snapshot.liquidityByExchange,
        breadth: snapshot.breadth,
        breadthByExchange: snapshot.breadthByExchange,
        source: snapshot.source,
      },
    );

    await pushNotification("close_brief_15h", `🌆 Bản tin kết phiên 15:00 ${today}`, report);
    invalidateTopics({ tags: ["news", "brief", "dashboard", "market"] });
    await emitWorkflowTrigger({
      type: "brief_ready",
      source: "cron:close_brief_15h",
      payload: {
        reportType: "close_brief_15h",
        title: `Bản tin kết phiên 15:00 ${today}`,
        content: report,
        dateLabel: today,
      },
    });

    const duration = Date.now() - startTime;
    await logCron("close_brief_15h", "success", `Verdict: ${isGood ? "GOOD" : "BAD"}`, duration, {
      requestDateVN: snapshot.requestDateVN,
      providerDiagnostics: snapshot.providerDiagnostics,
      fallbackUsed: snapshot.providerDiagnostics.length > 0,
    });

    return NextResponse.json({
      type: "close_brief_15h",
      timestamp: getVnNow().toISOString(),
      verdict: isGood ? "GOOD" : "BAD",
      report,
    });
  } catch (error) {
    const duration = Date.now() - startTime;
    await logCron("close_brief_15h", "error", String(error), duration);
    console.error("[CRON close-brief-15h]", error);
    return NextResponse.json({ error: "Lỗi tạo bản tin kết phiên" }, { status: 500 });
  }
}
