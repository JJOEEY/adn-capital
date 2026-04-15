/**
 * API Cron: EOD Brief — 15:00 T2-T6
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
import { getMarketSnapshot, formatSnapshotForAI, getInvestorTradingText } from "@/lib/marketDataFetcher";
import { fetchAllCafefNews, buildCafefContext } from "@/lib/cafefScraper";

export const maxDuration = 60;

function buildEodFallback(today: string, vnidx?: { value: number; changePct: number }) {
  const idxText = vnidx
    ? `${vnidx.value} | ${vnidx.changePct >= 0 ? "+" : ""}${vnidx.changePct}%`
    : "chưa cập nhật";

  return `🌆 *BẢN TIN KẾT PHIÊN — ${today}*

📊 *KẾT QUẢ CHỈ SỐ:*
🇻🇳 VN-INDEX: ${idxText}

⚠️ *GHI CHÚ DỮ LIỆU:*
• Một số dữ liệu cuối phiên đang cập nhật.
• Hệ thống sẽ tự bổ sung khi nguồn dữ liệu đồng bộ xong.

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
    const [snapshot, cafefNews] = await Promise.all([
      getMarketSnapshot(),
      fetchAllCafefNews(),
    ]);

    const newsContext = buildCafefContext(cafefNews);

    const vnidx = snapshot.indices.find((i) => i.ticker === "VNINDEX");
    const vn30 = snapshot.indices.find((i) => i.ticker === "VN30");
    const breadth = snapshot.breadth;

    const prompt = `Bạn là ADN AI Bot — trợ lý giao dịch chuyên nghiệp.
Hôm nay: ${today}. Phiên giao dịch đã kết thúc. Hãy viết BẢN TIN KẾT PHIÊN 15:00.

DỮ LIỆU THỊ TRƯỜNG (THỰC):
${formatSnapshotForAI(snapshot, { investorMode: "close15" })}

TIN TỨC CAFEF (RSS):
${newsContext}

QUY TẮC TUYỆT ĐỐI:
1. CHỈ dùng số liệu từ DỮ LIỆU THỊ TRƯỜNG bên trên
2. KHÔNG bịa giá, % thay đổi, ngày tháng
3. Format Markdown Telegram: dùng *bold* // _italic_ // \\- \\| cho ký tự đặc biệt

Viết theo đúng template dưới đây (giữ nguyên icon và cấu trúc):

🌆 *BẢN TIN KẾT PHIÊN — ${today}*

📊 *KẾT QUẢ CHỈ SỐ:*
🇻🇳 VN\\-INDEX: ${vnidx?.value ?? "N/A"} \\| ${vnidx ? (vnidx.changePct >= 0 ? "+" : "") + vnidx.changePct + "%" : "N/A"}
💎 VN30: ${vn30?.value ?? "N/A"} \\| ${vn30 ? (vn30.changePct >= 0 ? "+" : "") + vn30.changePct + "%" : "N/A"}

📈 *DIỄN BIẾN THỊ TRƯỜNG:*
• Độ rộng: ${breadth?.up ?? "?"} Tăng \\| ${breadth?.down ?? "?"} Giảm \\| ${breadth?.unchanged ?? "?"} Đứng
• Thanh khoản: ${snapshot.liquidity ?? "?"} tỷ VNĐ
• Dòng tiền NĐT:
${(() => {
      const lines = getInvestorTradingText(snapshot, "close15");
      if (lines.length === 0) return "  - Khối ngoại: chưa cập nhật";
      return lines.map((line) => `  - ${line}`).join("\n");
    })()}

🌐 *TIN TỨC PHIÊN CHIỀU:*
[3 tin quan trọng nhất từ CafeF, tóm tắt 1 dòng/tin]

🎯 *VERDICT & KẾ HOẠCH:*
• Trạng thái: [ĐẠT - Tìm cơ hội / KHÔNG ĐẠT - Tắt bảng điện]
• Nhận định: [1-2 câu ngắn gọn về xu hướng phiên tới]

_Powered by ADN Capital AI_`;

    let report = "";
    try {
      report = await generateText(prompt);
    } catch (err) {
      console.warn("[CRON eod-brief] Gemini fallback:", err);
    }
    const safeReport = report?.trim() ? report : buildEodFallback(today, vnidx);

    const isGood = safeReport.toLowerCase().includes("đạt - tìm cơ hội");

    await saveMarketReport(
      "close_brief_15h",
      `Bản tin kết phiên ${today}`,
      safeReport,
      {
        snapshot: { indices: snapshot.indices, breadth: snapshot.breadth, liquidity: snapshot.liquidity },
      },
      { verdict: isGood ? "GOOD" : "BAD", indices: snapshot.indices, marketScore: snapshot.marketOverview?.score }
    );

    await pushNotification("close_brief_15h", `🌆 Bản tin kết phiên ${today}`, safeReport);

    const duration = Date.now() - startTime;
    await logCron("close_brief_15h", "success", `Verdict: ${isGood ? "GOOD" : "BAD"}`, duration);

    return NextResponse.json({
      type: "close_brief_15h",
      timestamp: new Date().toISOString(),
      verdict: isGood ? "GOOD" : "BAD",
      report: safeReport,
    });
  } catch (error) {
    const duration = Date.now() - startTime;
    await logCron("close_brief_15h", "error", String(error), duration);
    console.error("[CRON eod-brief]", error);
    return NextResponse.json({ error: "Lỗi tạo bản tin kết phiên" }, { status: 500 });
  }
}
