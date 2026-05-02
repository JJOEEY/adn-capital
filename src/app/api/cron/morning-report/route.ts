/**
 * API Cron: Morning Brief — 08:00 T2-T6
 *
 * Format: Dashboard Telegram chuyên nghiệp ADN Capital
 * Data: FiinQuant (market ref) + CafeF RSS (news) — tối ưu API calls
 * AI: Gemini tổng hợp và format output theo chuẩn Telegram Markdown
 */
import { NextRequest, NextResponse } from "next/server";
import { generateText } from "@/lib/gemini";
import {
  validateCronSecret,
  logCron,
  pushNotification,
  saveMarketReport,
  getVNDateString,
} from "@/lib/cronHelpers";
import { getMarketSnapshot, formatSnapshotForAI } from "@/lib/marketDataFetcher";
import { fetchAllCafefNews, buildCafefContext } from "@/lib/cafefScraper";
import { getVnNow } from "@/lib/time";
import { invalidateTopics } from "@/lib/datahub/core";
import { emitWorkflowTrigger } from "@/lib/workflows";

export const maxDuration = 60;

function hasRequiredMorningData(snapshot: Awaited<ReturnType<typeof getMarketSnapshot>>): boolean {
  const requiredIndices = ["VNINDEX", "HNXINDEX", "UPCOMINDEX"];
  const existing = new Set(snapshot.indices.map((item) => item.ticker));
  const hasAllIndices = requiredIndices.every((ticker) => existing.has(ticker));
  return hasAllIndices && snapshot.liquidity != null && snapshot.investorTrading.availability.foreign;
}

function buildMorningFallback(today: string, vnidx?: { value: number; changePct: number }) {
  const idxText = vnidx
    ? `${vnidx.value} | ${vnidx.changePct >= 0 ? "+" : ""}${vnidx.changePct}%`
    : "chưa cập nhật";

  return `☀️ *BẢN TIN SÁNG ADN CAPITAL — ${today}*

📊 *CHỈ SỐ THAM CHIẾU:*
🇻🇳 VN-INDEX: ${idxText}

⚠️ *GHI CHÚ DỮ LIỆU:*
• Một số dữ liệu đang cập nhật.
• Hệ thống sẽ tự bổ sung ngay khi nguồn dữ liệu đầy đủ.

_Powered by ADN Capital AI_`;
}

export async function GET(req: NextRequest) {
  if (!validateCronSecret(req)) {
    return NextResponse.json({ error: "Không có quyền truy cập" }, { status: 401 });
  }

  const startTime = Date.now();
  const today = getVNDateString();

  try {
    // ── 1. Lấy data song song (1 API call FiinQuant + 3 CafeF RSS) ──
    const [snapshot, cafefNews] = await Promise.all([
      getMarketSnapshot(),
      fetchAllCafefNews(),
    ]);

    if (!hasRequiredMorningData(snapshot)) {
      const duration = Date.now() - startTime;
      await logCron(
        "morning_brief",
        "skipped",
        "Thiếu dữ liệu bắt buộc cho Morning Brief, không publish công khai",
        duration,
        {
          liquidity: snapshot.liquidity,
          investorAvailability: snapshot.investorTrading.availability,
          indices: snapshot.indices.map((item) => item.ticker),
          providerDiagnostics: snapshot.providerDiagnostics,
        },
      );
      return NextResponse.json({
        type: "morning_brief",
        published: false,
        reason: "missing_required_fields",
      });
    }

    const marketContext = formatSnapshotForAI(snapshot);
    const newsContext = buildCafefContext(cafefNews);

    const vnidx = snapshot.indices.find(i => i.ticker === "VNINDEX");
    const vn30  = snapshot.indices.find(i => i.ticker === "VN30");

    // ── 2. Gemini viết theo format Dashboard chuẩn Telegram ──────────
    const prompt = `Bạn là AIDEN Analyst — trợ lý phân tích chuyên nghiệp của ADN Capital.
Hôm nay: ${today}. Nhiệm vụ: Viết BẢN TIN SÁNG 8:00.

DỮ LIỆU THAM CHIẾU THỊ TRƯỜNG (THỰC):
${marketContext}

TIN TỨC CAFEF (RSS):
${newsContext}

QUY TẮC TUYỆT ĐỐI:
1. CHỈ dùng số liệu từ DỮ LIỆU THAM CHIẾU bên trên
2. KHÔNG bịa giá, % thay đổi, tên công ty, số liệu
3. Nếu không có data → ghi "chưa cập nhật"
4. Format Markdown Telegram: dùng *bold* // _italic_ // \\- \\| cho ký tự đặc biệt

Viết theo đúng template dưới đây (giữ nguyên icon và cấu trúc):

⚡ *BẢN TIN SÁNG ADN CAPITAL — ${today}*

📊 *CHỈ SỐ THAM CHIẾU:*
🇻🇳 VN\\-INDEX: ${vnidx?.value ?? "chưa cập nhật"} \\| ${vnidx ? (vnidx.changePct >= 0 ? "+" : "") + vnidx.changePct + "%" : "N/A"}
🇺🇸 DOW JONES: [Lấy từ tin quốc tế CafeF nếu có, không thì "chưa cập nhật"]
💵 DXY: [Từ tin quốc tế nếu có]
🛢️ DẦU WTI: [Từ tin quốc tế nếu có]

📈 *THỊ TRƯỜNG VIỆT NAM:*
🔸 [Nhận xét phiên hôm qua: thanh khoản, điểm số, xu hướng]
🔸 [Dòng tiền, khối ngoại, tâm lý NĐT]

🌐 *VĨ MÔ TRONG NƯỚC & QUỐC TẾ:*
🔹 [Lãi suất, tỷ giá, tin kinh tế vĩ mô]
🔹 [Tin thế giới ảnh hưởng thị trường Việt]

⚠️ *RỦI RO / CƠ HỘI:*
🚨 Rủi ro: [Nhận định rủi ro nếu có]
🎯 Cơ hội: [Nhóm ngành/cổ phiếu tiềm năng]

_Powered by ADN Capital AI_`;

    let report = "";
    try {
      report = await generateText(prompt);
    } catch (err) {
      console.warn("[CRON morning-brief] Gemini fallback:", err);
    }
    const safeReport = report?.trim() ? report : buildMorningFallback(today, vnidx);

    // ── 3. Lưu DB ────────────────────────────────────────────────────
    await saveMarketReport(
      "morning_brief",
      `Báo cáo sáng ${today}`,
      safeReport,
      {
        snapshot,
        cafefArticles: {
          stockMarket: cafefNews.stockMarket.articles.length,
          macro: cafefNews.macro.articles.length,
          global: cafefNews.global.articles.length,
        },
      },
      { indices: snapshot.indices, marketScore: snapshot.marketOverview?.score },
    );

    // ── 4. Push Notification ──────────────────────────────────────────
    await pushNotification("morning_brief", `☀️ Bản tin sáng ${today}`, safeReport);
    invalidateTopics({ tags: ["news", "brief", "dashboard", "market"] });
    await emitWorkflowTrigger({
      type: "brief_ready",
      source: "cron:morning_brief",
      payload: {
        reportType: "morning_brief",
        title: `Báo cáo sáng ${today}`,
        content: safeReport,
        dateLabel: today,
      },
    });

    const duration = Date.now() - startTime;
    await logCron("morning_brief", "success", `Created in ${duration}ms`, duration, {
      indicesCount: snapshot.indices.length,
      cafefArticles: cafefNews.stockMarket.articles.length + cafefNews.macro.articles.length,
      requestDateVN: snapshot.requestDateVN,
      providerDiagnostics: snapshot.providerDiagnostics,
      fallbackUsed: snapshot.providerDiagnostics.length > 0,
    });

    return NextResponse.json({
      type: "morning_brief",
      timestamp: getVnNow().toISOString(),
      report: safeReport,
      dataSources: {
        fiinquant: !!snapshot.marketOverview,
        vndirect: snapshot.indices.length > 0,
        cafef: cafefNews.stockMarket.articles.length > 0,
      },
    });
  } catch (error) {
    const duration = Date.now() - startTime;
    await logCron("morning_brief", "error", String(error), duration);
    console.error("[CRON morning-brief]", error);
    return NextResponse.json({ error: "Lỗi tạo báo cáo sáng" }, { status: 500 });
  }
}
