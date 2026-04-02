/**
 * API Cron: Báo cáo sáng 8h
 * Tóm tắt thị trường quốc tế qua đêm, nhận định phiên sáng,
 * cổ phiếu cần theo dõi hôm nay.
 * Thiết kế để chờ trigger từ bên ngoài (cron service, Vercel Cron, etc.)
 */
import { NextRequest, NextResponse } from "next/server";
import { generateText } from "@/lib/gemini";

// Header bảo mật - chỉ cho phép trigger từ cron service có API key đúng
function validateCronSecret(req: NextRequest): boolean {
  const secret = req.headers.get("x-cron-secret");
  return secret === (process.env.CRON_SECRET ?? "adn-cron-dev-key");
}

export async function GET(req: NextRequest) {
  if (!validateCronSecret(req)) {
    return NextResponse.json({ error: "Không có quyền truy cập" }, { status: 401 });
  }

  try {
    const today = new Date().toLocaleDateString("vi-VN", {
      weekday: "long",
      year: "numeric",
      month: "long",
      day: "numeric",
    });

    const prompt = `Bạn là ADN AI Bot System - Khổng Minh của VNINDEX.
Hôm nay là ${today}. Hãy viết BÁO CÁO SÁNG 8:00 cho nhà đầu tư chứng khoán Việt Nam.

Cấu trúc báo cáo:

## ☀️ BÁO CÁO SÁNG - ${today}

### 1. THỊ TRƯỜNG QUỐC TẾ QUA ĐÊM
- Dow Jones, S&P 500, Nasdaq: xu hướng và mức biến động
- Thị trường châu Á (Nikkei, Hang Seng, Shanghai): xu hướng
- Giá dầu, vàng, USD Index: diễn biến đáng chú ý

### 2. NHẬN ĐỊNH PHIÊN SÁNG
- Kỳ vọng mở cửa VN-Index
- Yếu tố hỗ trợ / kìm hãm
- Thanh khoản kỳ vọng

### 3. CỔ PHIẾU CẦN THEO DÕI HÔM NAY
- 5-7 mã cổ phiếu có tín hiệu kỹ thuật đáng chú ý
- Lý do theo dõi từng mã

### 4. LƯU Ý RỦI RO
- Cảnh báo nếu thị trường có rủi ro lớn
- Khuyến nghị tỷ trọng cổ phiếu trong ngày

Viết bằng tiếng Việt, phong cách trader chuyên nghiệp.`;

    const report = await generateText(prompt);

    return NextResponse.json({
      type: "morning_report",
      timestamp: new Date().toISOString(),
      report,
    });
  } catch (error) {
    console.error("[CRON /api/cron/morning-report] Lỗi:", error);
    return NextResponse.json({ error: "Lỗi tạo báo cáo sáng" }, { status: 500 });
  }
}
