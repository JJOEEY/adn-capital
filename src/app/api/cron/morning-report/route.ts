/**
 * API Cron: Morning Brief — 8:00 sáng hằng ngày
 *
 * 1. Fetch data thực từ FiinQuant (market overview, indices)
 * 2. Fetch tin CafeF (chứng khoán, vĩ mô, quốc tế)
 * 3. Gemini viết bài dựa trên data thực (KHÔNG hallucinate)
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
    // ═══ 1. Fetch data thực song song ═══
    const [snapshot, cafefNews] = await Promise.all([
      getMarketSnapshot(),
      fetchAllCafefNews(),
    ]);

    const marketContext = formatSnapshotForAI(snapshot);
    const newsContext = buildCafefContext(cafefNews);

    // ═══ 2. Gemini viết bài với data thực ═══
    const prompt = `Bạn là ADN AI Bot System - Khổng Minh của VNINDEX.
Hôm nay là ${today}. Hãy viết BÁO CÁO SÁNG 8:00 cho nhà đầu tư chứng khoán Việt Nam.

QUY TẮC BẮT BUỘC:
1. CHỈ dùng chính xác các con số trong phần "DỮ LIỆU REAL-TIME" bên dưới
2. TUYỆT ĐỐI KHÔNG tự bịa giá, volume, ngày tháng, tên công ty
3. Tin tức phải dựa trên phần "TIN TỨC CAFEF" bên dưới
4. Nếu thiếu dữ liệu → nói rõ "chưa cập nhật", KHÔNG bịa số

${marketContext}

${newsContext}

Cấu trúc báo cáo:

## ☀️ BÁO CÁO SÁNG - ${today}

### 1. THỊ TRƯỜNG QUỐC TẾ QUA ĐÊM
- Dựa trên tin tức quốc tế từ CafeF ở trên
- Nếu có data DXY, vàng, dầu → ghi cụ thể

### 2. NHẬN ĐỊNH PHIÊN SÁNG
- VN-Index: dùng số liệu real-time ở trên
- Điểm sức khỏe thị trường (nếu có)
- Thanh khoản kỳ vọng

### 3. CỔ PHIẾU CẦN THEO DÕI HÔM NAY
- Dựa trên top tăng/giảm trong data
- Ghi rõ lý do (kỹ thuật / tin tức)

### 4. TIN TỨC ĐÁNG CHÚ Ý
- Tóm tắt 3-5 tin quan trọng nhất từ CafeF
- Ảnh hưởng đến thị trường

### 5. LƯU Ý RỦI RO
- Cảnh báo nếu thị trường có rủi ro lớn
- Khuyến nghị tỷ trọng

Viết bằng tiếng Việt, phong cách trader chuyên nghiệp, dứt khoát.`;

    const report = await generateText(prompt);

    // ═══ 3. Lưu DB ═══
    const rawData = {
      snapshot: {
        indices: snapshot.indices,
        breadth: snapshot.breadth,
        liquidity: snapshot.liquidity,
      },
      cafefArticles: {
        stockMarket: cafefNews.stockMarket.articles.length,
        macro: cafefNews.macro.articles.length,
        global: cafefNews.global.articles.length,
      },
    };

    await saveMarketReport("morning_brief", `Báo cáo sáng ${today}`, report, rawData, {
      indices: snapshot.indices,
      marketScore: snapshot.marketOverview?.score,
    });

    // Morning Brief chỉ hiển thị trên Dashboard, KHÔNG đẩy Notification

    const duration = Date.now() - startTime;
    await logCron("morning_brief", "success", `Tạo thành công trong ${duration}ms`, duration, {
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
    console.error("[CRON morning-brief] Lỗi:", error);
    return NextResponse.json({ error: "Lỗi tạo báo cáo sáng" }, { status: 500 });
  }
}
