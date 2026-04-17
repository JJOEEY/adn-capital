/**
 * API Cron: Close Brief 15:00 (Mon-Fri)
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

export const maxDuration = 60;

function hasRequiredCloseData(snapshot: Awaited<ReturnType<typeof getMarketSnapshot>>): boolean {
  const hasMainIndex = snapshot.indices.some((item) => item.ticker === "VNINDEX");
  const breadth = snapshot.breadth;
  const hasBreadth = !!breadth && breadth.up + breadth.down + breadth.unchanged > 0;
  const hasLiquidity =
    snapshot.liquidity != null &&
    snapshot.liquidity > 0 &&
    snapshot.liquidityByExchange.HOSE != null &&
    snapshot.liquidityByExchange.HOSE > 0;
  return hasMainIndex && hasLiquidity && hasBreadth && snapshot.investorTrading.availability.foreign;
}

function formatTy(value: number | null | undefined): string {
  if (value == null || !Number.isFinite(value)) return "chưa cập nhật";
  return `${Math.abs(value).toLocaleString("vi-VN", { maximumFractionDigits: 0 })} tỷ`;
}

function buildClose15Report(today: string, snapshot: Awaited<ReturnType<typeof getMarketSnapshot>>) {
  const vnidx = snapshot.indices.find((i) => i.ticker === "VNINDEX");
  const vn30 = snapshot.indices.find((i) => i.ticker === "VN30");
  const breadth = snapshot.breadth;

  const investorLines = getInvestorTradingText(snapshot, "close15");
  const investorSection =
    investorLines.length > 0
      ? investorLines.map((line) => `• ${line}`).join("\n")
      : "• Khối ngoại: chưa cập nhật";

  const verdictText =
    (vnidx?.changePct ?? 0) >= 0 ? "ĐẠT - Tìm cơ hội có chọn lọc." : "KHÔNG ĐẠT - Ưu tiên phòng thủ.";

  return `🌆 *BẢN TIN KẾT PHIÊN — ${today}*

📊 *KẾT QUẢ CHỈ SỐ:*
🇻🇳 VN-INDEX: ${vnidx ? `${vnidx.value} | ${vnidx.changePct >= 0 ? "+" : ""}${vnidx.changePct}%` : "chưa cập nhật"}
💎 VN30: ${vn30 ? `${vn30.value} | ${vn30.changePct >= 0 ? "+" : ""}${vn30.changePct}%` : "chưa cập nhật"}

📈 *DIỄN BIẾN THỊ TRƯỜNG:*
• Độ rộng: ${breadth?.up ?? "?"} Tăng | ${breadth?.down ?? "?"} Giảm | ${breadth?.unchanged ?? "?"} Đứng
• Thanh khoản: ${formatTy(snapshot.liquidity)}
• Dòng tiền NĐT:
${investorSection}

🎯 *VERDICT & KẾ HOẠCH:*
• Trạng thái: ${verdictText}
• Nhận định: Ưu tiên kỷ luật điểm mua, kiểm soát tỷ trọng theo biến động chỉ số.

_Powered by ADN Capital AI_`;
}

export async function GET(req: NextRequest) {
  if (!validateCronSecret(req)) {
    return NextResponse.json({ error: "Không có quyền truy cập" }, { status: 401 });
  }

  if (!isTradingDay()) {
    return NextResponse.json({ message: "Không phải ngày giao dịch" });
  }

  const startTime = Date.now();
  const today = getVNDateString();

  try {
    const snapshot = await getMarketSnapshot();

    if (!hasRequiredCloseData(snapshot)) {
      const duration = Date.now() - startTime;
      await logCron(
        "close_brief_15h",
        "skipped",
        "Thiếu dữ liệu bắt buộc cho bản tin 15:00, không publish công khai",
        duration,
        {
          liquidity: snapshot.liquidity,
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

    const safeReport = buildClose15Report(today, snapshot);
    const vnidx = snapshot.indices.find((i) => i.ticker === "VNINDEX");
    const isGood = (vnidx?.changePct ?? 0) >= 0;

    await saveMarketReport(
      "close_brief_15h",
      `Bản tin kết phiên ${today}`,
      safeReport,
      { snapshot },
      {
        verdict: isGood ? "GOOD" : "BAD",
        indices: snapshot.indices,
        marketScore: snapshot.marketOverview?.score,
      },
    );

    await pushNotification("close_brief_15h", `🌆 Bản tin kết phiên ${today}`, safeReport);

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
      report: safeReport,
    });
  } catch (error) {
    const duration = Date.now() - startTime;
    await logCron("close_brief_15h", "error", String(error), duration);
    console.error("[CRON close-brief-15h]", error);
    return NextResponse.json({ error: "Lỗi tạo bản tin kết phiên" }, { status: 500 });
  }
}
