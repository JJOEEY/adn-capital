/**
 * API Cron: Đánh giá thị trường 17h
 * Đo EMA10, 30, 50, 100 của VN-Index để quyết định:
 * "Tắt app" hay "Tìm cơ hội".
 * Thiết kế để chờ trigger từ bên ngoài (cron service, Vercel Cron, etc.)
 */
import { NextRequest, NextResponse } from "next/server";
import { generateText } from "@/lib/gemini";

// Header bảo mật
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
Hôm nay là ${today}, phiên giao dịch đã kết thúc. Hãy viết BÁO CÁO CHIỀU 17:00 đánh giá thị trường.

NHIỆM VỤ CHÍNH: Đo lường sức khoẻ thị trường qua hệ thống EMA và chỉ báo kỹ thuật, từ đó đưa ra verdict rõ ràng.

## 🌅 ĐÁNH GIÁ THỊ TRƯỜNG CHIỀU - ${today}

### 1. BẢNG ĐIỂM CHỈ SỐ KỸ THUẬT VN-INDEX
| Chỉ báo | Trạng thái | Kết luận |
|---------|-----------|---------|
| EMA10 vs EMA30 | ? | ĐẠT / KHÔNG ĐẠT |
| EMA50 vs EMA100 | ? | ĐẠT / KHÔNG ĐẠT |
| RSI(14) | ? | Quá mua / Hợp lệ / Quá bán |
| MACD | ? | Tín hiệu mua / bán / trung tính |
| MFI | ? | Dòng tiền vào / ra |

### 2. VERDICT CUỐI CÙNG
**[ĐẠT → Tìm cơ hội]** hoặc **[KHÔNG ĐẠT → Tắt bảng điện]**
- Giải thích ngắn gọn 2-3 câu lý do

### 3. TÓM TẮT PHIÊN
- Diễn biến chính trong phiên
- Thanh khoản và dòng tiền
- Nhóm ngành dẫn dắt / kéo lùi

### 4. TOP CỔ PHIẾU NỔI BẬT
- 5 mã tăng mạnh nhất + lý do
- 5 mã giảm mạnh nhất + cảnh báo

### 5. KẾ HOẠCH PHIÊN TỚI
- Kịch bản tăng: Điều kiện & hành động
- Kịch bản giảm: Điều kiện & hành động
- Mức hỗ trợ / kháng cự VN-Index cần theo dõi

Viết bằng tiếng Việt, dứt khoát.`;

    const report = await generateText(prompt);

    // Phân tích verdict từ báo cáo
    const isGood = report.toLowerCase().includes("đạt → tìm cơ hội") ||
                   report.toLowerCase().includes("tìm cơ hội");

    return NextResponse.json({
      type: "afternoon_review",
      timestamp: new Date().toISOString(),
      verdict: isGood ? "GOOD" : "BAD",
      verdictLabel: isGood ? "ĐẠT → Tìm cơ hội" : "KHÔNG ĐẠT → Tắt bảng điện",
      report,
    });
  } catch (error) {
    console.error("[CRON /api/cron/afternoon-review] Lỗi:", error);
    return NextResponse.json({ error: "Lỗi tạo báo cáo chiều" }, { status: 500 });
  }
}
