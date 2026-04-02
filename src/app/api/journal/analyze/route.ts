import { NextResponse } from "next/server";
import { getCurrentDbUser } from "@/lib/current-user";
import { prisma } from "@/lib/prisma";
import { getGeminiModel } from "@/lib/gemini";

export async function POST() {
  const dbUser = await getCurrentDbUser();
  if (!dbUser) {
    return NextResponse.json({ error: "Chưa đăng nhập" }, { status: 401 });
  }

  try {
    const journals: { ticker: string; action: string; price: number; quantity: number; psychology: string }[] = await prisma.tradingJournal.findMany({
      where: { userId: dbUser.id },
      orderBy: { createdAt: "desc" },
      take: 50,
    });

    if (journals.length < 3) {
      return NextResponse.json({
        error: "Cần ít nhất 3 lệnh để phân tích tâm lý. Hãy ghi thêm nhật ký đại ca nhé!",
      }, { status: 400 });
    }

    const buyCount = journals.filter((j) => j.action === "BUY").length;
    const sellCount = journals.filter((j) => j.action === "SELL").length;

    const psychCounts: Record<string, number> = {};
    journals.forEach((j) => {
      psychCounts[j.psychology] = (psychCounts[j.psychology] ?? 0) + 1;
    });

    const journalSummary = journals.slice(0, 30).map((j) => ({
      ticker: j.ticker,
      action: j.action,
      price: j.price.toLocaleString("vi-VN"),
      quantity: j.quantity,
      psychology: j.psychology,
    }));

    const prompt = `Bạn là chuyên gia tâm lý giao dịch chứng khoán Việt Nam.
Hãy phân tích lịch sử giao dịch của trader này và đưa ra phân tích tâm lý chi tiết.

THỐNG KÊ TỔNG QUAN:
- Tổng lệnh: ${journals.length}
- Mua: ${buyCount} | Bán: ${sellCount}

TÂM LÝ KHI VÀO LỆNH:
${Object.entries(psychCounts).map(([p, c]) => `- ${p}: ${c} lần`).join("\n")}

30 GIAO DỊCH GẦN NHẤT:
${journalSummary.map((j, i) => `${i + 1}. ${j.ticker} (${j.action}) - Giá: ${j.price} - KL: ${j.quantity} - Tâm lý: ${j.psychology}`).join("\n")}

Hãy trả lời bằng tiếng Việt theo cấu trúc JSON sau:
{
  "overallRating": "Đánh giá tổng thể về trader này (1-2 câu)",
  "strengths": ["Điểm mạnh 1", "Điểm mạnh 2", "Điểm mạnh 3"],
  "weaknesses": ["Điểm yếu 1", "Điểm yếu 2", "Điểm yếu 3"],
  "recurringMistakes": ["Sai lầm lặp lại 1", "Sai lầm lặp lại 2"],
  "recommendations": ["Khuyến nghị 1", "Khuyến nghị 2", "Khuyến nghị 3", "Khuyến nghị 4"]
}`;

    const model = getGeminiModel("gemini-2.5-flash");
    const result = await model.generateContent(prompt);
    const responseText = result.response.text();

    let analysis;
    try {
      const jsonMatch = responseText.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        analysis = JSON.parse(jsonMatch[0]);
      } else {
        throw new Error("No JSON found");
      }
    } catch {
      analysis = {
        overallRating: responseText.slice(0, 300),
        strengths: ["Cần thêm dữ liệu để phân tích"],
        weaknesses: ["Cần thêm dữ liệu để phân tích"],
        recurringMistakes: ["Cần thêm dữ liệu để phân tích"],
        recommendations: ["Hãy tiếp tục ghi nhật ký đầy đủ hơn"],
      };
    }

    return NextResponse.json({
      analysis,
      stats: {
        totalTrades: journals.length,
        buyCount,
        sellCount,
      },
    });
  } catch (error) {
    console.error("[POST /api/journal/analyze] Error:", error);
    return NextResponse.json({ error: "Lỗi phân tích tâm lý" }, { status: 500 });
  }
}
