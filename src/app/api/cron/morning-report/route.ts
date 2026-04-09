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
  isTradingDay,
  getVNDateString,
} from "@/lib/cronHelpers";
import { getMarketSnapshot, formatSnapshotForAI } from "@/lib/marketDataFetcher";
import { fetchAllCafefNews, buildCafefContext } from "@/lib/cafefScraper";

export const maxDuration = 60;

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
    // ── 1. Lấy data song song (1 API call FiinQuant + 3 CafeF RSS) ──
    const [snapshot, cafefNews] = await Promise.all([
      getMarketSnapshot(),
      fetchAllCafefNews(),
    ]);

    const marketContext = formatSnapshotForAI(snapshot);
    const newsContext = buildCafefContext(cafefNews);

    const vnidx = snapshot.indices.find(i => i.ticker === "VNINDEX");
    const vn30  = snapshot.indices.find(i => i.ticker === "VN30");

    // ── 2. Gemini viết theo format Dashboard chuẩn Telegram ──────────
    const prompt = `Bạn là ADN AI Bot — Trợ lý giao dịch chuyên nghiệp của ADN Capital.
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

    const report = await generateText(prompt);

    // ── 3. Lưu DB ────────────────────────────────────────────────────
    await saveMarketReport("morning_brief", `Báo cáo sáng ${today}`, report, {
      snapshot: { indices: snapshot.indices, breadth: snapshot.breadth, liquidity: snapshot.liquidity },
      cafefArticles: { stockMarket: cafefNews.stockMarket.articles.length, macro: cafefNews.macro.articles.length, global: cafefNews.global.articles.length },
    }, { indices: snapshot.indices, marketScore: snapshot.marketOverview?.score });

    // ── 4. Push Notification ──────────────────────────────────────────
    await pushNotification("morning_brief", `☀️ Bản tin sáng ${today}`, report);

    const duration = Date.now() - startTime;
    await logCron("morning_brief", "success", `Created in ${duration}ms`, duration, {
      indicesCount: snapshot.indices.length,
      cafefArticles: cafefNews.stockMarket.articles.length + cafefNews.macro.articles.length,
    });

    return NextResponse.json({
      type: "morning_brief",
      timestamp: new Date().toISOString(),
      report,
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
