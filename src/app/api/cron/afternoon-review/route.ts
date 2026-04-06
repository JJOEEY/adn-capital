/**
 * API Cron: EOD Brief — 15:00 hằng ngày (sau phiên chiều)
 *
 * 1. Fetch data thực từ FiinQuant (market overview, indices, breadth)
 * 2. Fetch tin CafeF tổng hợp phiên
 * 3. Gemini viết bài EOD Brief dựa trên data thực
 * 4. Lưu vào MarketReport + đẩy Notification
 */
import { NextRequest, NextResponse } from "next/server";
import { generateText } from "@/lib/gemini";
import {
  validateCronSecret,
  logCron,
  saveMarketReport,
  getVNDateString,
} from "@/lib/cronHelpers";
import { getMarketSnapshot, formatSnapshotForAI } from "@/lib/marketDataFetcher";
import { fetchAllCafefNews, buildCafefContext } from "@/lib/cafefScraper";

export const maxDuration = 60;

export async function GET(req: NextRequest) {
  if (!validateCronSecret(req)) {
    return NextResponse.json({ error: "Không có quyền truy cập" }, { status: 401 });
  }

  const startTime = Date.now();
  const today = getVNDateString();

  try {
    // ═══ 1. Fetch data thực ═══
    const [snapshot, cafefNews] = await Promise.all([
      getMarketSnapshot(),
      fetchAllCafefNews(),
    ]);

    const marketContext = formatSnapshotForAI(snapshot);
    const newsContext = buildCafefContext(cafefNews);

    // ═══ 2. Gemini viết EOD Brief ═══
    const prompt = `Bạn là ADN AI Bot System - Khổng Minh của VNINDEX.
Hôm nay là ${today}, phiên giao dịch chiều đã kết thúc. Hãy viết BÁO CÁO CUỐI PHIÊN 15:00.

QUY TẮC BẮT BUỘC:
1. CHỈ dùng chính xác các con số trong phần "DỮ LIỆU REAL-TIME" bên dưới
2. TUYỆT ĐỐI KHÔNG tự bịa giá, volume, ngày tháng
3. Tin tức phải dựa trên phần "TIN TỨC CAFEF"
4. Nếu thiếu → nói "chưa cập nhật", KHÔNG bịa số

${marketContext}

${newsContext}

NHIỆM VỤ: Đo lường sức khoẻ thị trường qua hệ thống EMA và chỉ báo kỹ thuật, đưa ra verdict rõ ràng.

## 🌅 BÁO CÁO CUỐI PHIÊN - ${today}

### 1. BẢNG ĐIỂM CHỈ SỐ KỸ THUẬT VN-INDEX
| Chỉ báo | Trạng thái | Kết luận |
|---------|-----------|---------|
| EMA10 vs EMA30 | (dùng data real-time) | ĐẠT / KHÔNG ĐẠT |
| EMA50 vs EMA100 | (dùng data real-time) | ĐẠT / KHÔNG ĐẠT |
| RSI(14) | (dùng data real-time) | Quá mua / Hợp lệ / Quá bán |
| MACD | (dùng data real-time) | Tín hiệu mua / bán / trung tính |
| MFI | (dùng data real-time nếu có) | Dòng tiền vào / ra |

### 2. VERDICT CUỐI CÙNG
**[ĐẠT → Tìm cơ hội]** hoặc **[KHÔNG ĐẠT → Tắt bảng điện]**
- Giải thích 2-3 câu dựa trên dữ liệu

### 3. TÓM TẮT PHIÊN
- Diễn biến chính (dùng số liệu index, breadth, liquidity)
- Thanh khoản & dòng tiền
- Nhóm ngành dẫn dắt / kéo lùi (dùng topGainers/topLosers)

### 4. TOP CỔ PHIẾU NỔI BẬT
- 5 mã tăng mạnh nhất (từ data)
- 5 mã giảm mạnh nhất (từ data)

### 5. TIN TỨC ẢNH HƯỞNG
- Tóm tắt 3 tin quan trọng từ CafeF

### 6. KẾ HOẠCH PHIÊN TỚI
- Kịch bản tăng: Điều kiện & hành động
- Kịch bản giảm: Điều kiện & hành động
- Mức hỗ trợ / kháng cự VN-Index

Viết bằng tiếng Việt, dứt khoát.`;

    const report = await generateText(prompt);

    // Phân tích verdict từ báo cáo
    const isGood =
      report.toLowerCase().includes("đạt → tìm cơ hội") ||
      report.toLowerCase().includes("tìm cơ hội");

    // ═══ 3. Lưu DB ═══
    const rawData = {
      snapshot: {
        indices: snapshot.indices,
        breadth: snapshot.breadth,
        liquidity: snapshot.liquidity,
        topGainers: snapshot.topGainers.slice(0, 10),
        topLosers: snapshot.topLosers.slice(0, 10),
      },
      cafefArticles: cafefNews.stockMarket.articles.slice(0, 5),
    };

    await saveMarketReport("eod_brief", `Báo cáo cuối phiên ${today}`, report, rawData, {
      verdict: isGood ? "GOOD" : "BAD",
      indices: snapshot.indices,
      marketScore: snapshot.marketOverview?.score,
    });

    // EOD Brief chỉ hiển thị trên Dashboard, KHÔNG đẩy Notification

    const duration = Date.now() - startTime;
    await logCron("eod_brief", "success", `Verdict: ${isGood ? "GOOD" : "BAD"}, ${duration}ms`, duration, {
      verdict: isGood ? "GOOD" : "BAD",
    });

    return NextResponse.json({
      type: "eod_brief",
      timestamp: new Date().toISOString(),
      verdict: isGood ? "GOOD" : "BAD",
      verdictLabel: isGood ? "ĐẠT → Tìm cơ hội" : "KHÔNG ĐẠT → Tắt bảng điện",
      report,
      dataSources: {
        fiinquant: !!snapshot.marketOverview,
        vndirect: snapshot.indices.length > 0,
        cafef: cafefNews.stockMarket.articles.length > 0,
      },
    });
  } catch (error) {
    const duration = Date.now() - startTime;
    await logCron("eod_brief", "error", String(error), duration);
    console.error("[CRON eod-brief] Lỗi:", error);
    return NextResponse.json({ error: "Lỗi tạo báo cáo cuối phiên" }, { status: 500 });
  }
}
