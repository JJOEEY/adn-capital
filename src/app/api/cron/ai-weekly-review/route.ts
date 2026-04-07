/**
 * AI Weekly Review Cron — Chạy 17:00 chiều Thứ 6 hàng tuần.
 *
 * Quét tất cả User có enableAIReview === true, thu thập giao dịch tuần,
 * gửi qua Gemini AI để phân tích tâm lý, lưu kết quả notification 1-1 riêng tư.
 *
 * GET /api/cron/ai-weekly-review?secret=xxx
 */

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { generateText } from "@/lib/gemini";
import { validateCronSecret, logCron } from "@/lib/cronHelpers";

export const maxDuration = 300; // 5 phút cho batch processing
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  if (!validateCronSecret(req)) {
    return NextResponse.json({ error: "Không có quyền truy cập" }, { status: 401 });
  }

  const startTime = Date.now();

  try {
    // Lấy tất cả user có bật AI Review
    const users = await prisma.user.findMany({
      where: { enableAIReview: true },
      select: { id: true, name: true, email: true },
    });

    if (users.length === 0) {
      await logCron("ai_weekly_review", "skipped", "Không có user nào bật AI Review", 0);
      return NextResponse.json({ message: "Không có user nào bật AI Review", processed: 0 });
    }

    // Thời gian: 7 ngày trước (Thứ 6 tuần trước 17h -> Thứ 6 này 17h)
    const now = new Date();
    const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

    const results: { userId: string; status: string; message?: string }[] = [];

    for (const user of users) {
      try {
        // Lấy giao dịch tuần này của user
        const trades = await prisma.tradingJournal.findMany({
          where: {
            userId: user.id,
            OR: [
              { tradeDate: { gte: weekAgo, lte: now } },
              { tradeDate: null, createdAt: { gte: weekAgo, lte: now } },
            ],
          },
          orderBy: [{ tradeDate: "asc" }, { createdAt: "asc" }],
        });

        if (trades.length === 0) {
          results.push({ userId: user.id, status: "skipped", message: "Không có giao dịch tuần này" });
          continue;
        }

        // Chuẩn bị dữ liệu cho AI
        const tradeList = trades.map((t, i) => {
          const date = t.tradeDate
            ? new Date(t.tradeDate).toLocaleDateString("vi-VN")
            : new Date(t.createdAt).toLocaleDateString("vi-VN");
          const pnlValue = t.action === "SELL" ? t.price * t.quantity : -(t.price * t.quantity);
          return `${i + 1}. [${date}] ${t.action === "BUY" ? "MUA" : "BÁN"} ${t.ticker} - Giá: ${t.price.toLocaleString("vi-VN")} - KL: ${t.quantity} - Tâm lý: ${t.psychologyTag ?? t.psychology} - Lý do: ${t.tradeReason ?? "Không ghi"} - Giá trị: ${Math.abs(pnlValue).toLocaleString("vi-VN")} VNĐ`;
        }).join("\n");

        // Thống kê
        const buyCount = trades.filter((t) => t.action === "BUY").length;
        const sellCount = trades.filter((t) => t.action === "SELL").length;
        const psychTags: Record<string, number> = {};
        trades.forEach((t) => {
          const tag = t.psychologyTag ?? t.psychology;
          psychTags[tag] = (psychTags[tag] ?? 0) + 1;
        });

        const totalBuyValue = trades.filter((t) => t.action === "BUY").reduce((s, t) => s + t.price * t.quantity, 0);
        const totalSellValue = trades.filter((t) => t.action === "SELL").reduce((s, t) => s + t.price * t.quantity, 0);
        const weekPnL = totalSellValue - totalBuyValue;

        const displayName = user.name ?? user.email?.split("@")[0] ?? "Trader";

        // AI Prompt — Persona: Chuyên gia Tâm lý Giao dịch ADN Capital
        const prompt = `Bạn là Chuyên gia Tâm lý Giao dịch riêng của ADN Capital. Hãy đọc lý do vào lệnh của User. Nhận xét thẳng thắn, mang tính xây dựng trong 3 câu xem họ có nhất quán với kế hoạch không, hay đang bị FOMO/Nghe phím hàng. Cảnh báo nghiêm khắc nếu có sự mâu thuẫn giữa lý do và kết quả cắt lỗ.

THÔNG TIN TRADER: ${displayName}
TUẦN: ${weekAgo.toLocaleDateString("vi-VN")} → ${now.toLocaleDateString("vi-VN")}

THỐNG KÊ TUẦN:
- Tổng lệnh: ${trades.length} (Mua: ${buyCount} | Bán: ${sellCount})
- Lãi/Lỗ tuần: ${weekPnL >= 0 ? "+" : ""}${weekPnL.toLocaleString("vi-VN")} VNĐ
- Phân bổ tâm lý: ${Object.entries(psychTags).map(([k, v]) => `${k}: ${v} lần`).join(", ")}

DANH SÁCH GIAO DỊCH:
${tradeList}

QUY TẮC PHẢN HỒI:
1. Viết bằng tiếng Việt, xưng "bạn" với trader
2. Nhận xét thẳng thắn nhưng tôn trọng (3-5 câu)
3. Nêu rõ nếu thấy FOMO, cảm tính, hoảng loạn
4. Khen ngợi nếu thấy có kế hoạch, kỷ luật tốt
5. Cảnh báo mạnh nếu: lý do mua mâu thuẫn với kết quả cắt lỗ, hoặc mua bán liên tục không theo plan
6. Gợi ý 1-2 điều cần cải thiện cụ thể
7. Kết thúc bằng 1 câu động viên ngắn gọn

QUAN TRỌNG: Phản hồi là tin nhắn riêng tư gửi thẳng cho trader, hãy viết dạng đoạn văn tự nhiên, KHÔNG dùng JSON/markdown heading.`;

        const aiResponse = await generateText(prompt);

        if (!aiResponse || aiResponse.trim().length === 0) {
          results.push({ userId: user.id, status: "error", message: "AI không trả về phản hồi" });
          continue;
        }

        // Lưu notification RIÊNG TƯ 1-1 cho user
        await prisma.notification.create({
          data: {
            type: "ai_weekly_review",
            title: `🧠 Đánh giá tâm lý giao dịch tuần ${now.toLocaleDateString("vi-VN")}`,
            content: aiResponse.trim(),
            userId: user.id, // QUAN TRỌNG: Gán userId để thông báo riêng tư 1-1
          },
        });

        results.push({ userId: user.id, status: "success" });
      } catch (userError) {
        console.error(`[AI Weekly Review] Lỗi xử lý user ${user.id}:`, userError);
        results.push({ userId: user.id, status: "error", message: String(userError) });
      }
    }

    const successCount = results.filter((r) => r.status === "success").length;
    const skippedCount = results.filter((r) => r.status === "skipped").length;
    const errorCount = results.filter((r) => r.status === "error").length;

    const duration = Date.now() - startTime;
    const summary = `Thành công: ${successCount}, Bỏ qua: ${skippedCount}, Lỗi: ${errorCount}`;

    await logCron("ai_weekly_review", "success", summary, duration, {
      totalUsers: users.length,
      successCount,
      skippedCount,
      errorCount,
      results,
    });

    return NextResponse.json({
      type: "ai_weekly_review",
      timestamp: new Date().toISOString(),
      totalUsers: users.length,
      successCount,
      skippedCount,
      errorCount,
      results,
      duration,
    });
  } catch (error) {
    const duration = Date.now() - startTime;
    await logCron("ai_weekly_review", "error", String(error), duration);
    console.error("[CRON ai-weekly-review]", error);
    return NextResponse.json({ error: "Lỗi chạy AI Weekly Review" }, { status: 500 });
  }
}
