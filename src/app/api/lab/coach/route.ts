import { NextRequest, NextResponse } from "next/server";
import { getCurrentDbUser } from "@/lib/current-user";
import { getGeminiModel } from "@/lib/gemini";

export const dynamic = "force-dynamic";

// ADN Coach AI — phân tích kết quả backtest bằng LLM (on-demand, admin-only → kiểm soát chi phí Gemini).
export async function POST(req: NextRequest) {
  const dbUser = await getCurrentDbUser();
  if (!dbUser || dbUser.systemRole !== "ADMIN") {
    return NextResponse.json({ error: "Chỉ admin dùng được ADN Lab" }, { status: 403 });
  }
  const body = await req.json().catch(() => null);
  const metrics = body?.metrics;
  const ctx = (body?.context ?? {}) as Record<string, unknown>;
  if (!metrics) return NextResponse.json({ error: "Thiếu kết quả để phân tích" }, { status: 400 });

  const buyLabels = Array.isArray(ctx.buyLabels) ? ctx.buyLabels.join(", ") : "—";
  const sellLabels = Array.isArray(ctx.sellLabels) ? ctx.sellLabels.join(", ") : "—";

  const prompt = `Bạn là chuyên gia kiểm định chiến thuật giao dịch (backtest) của ADN Capital.
Phân tích kết quả backtest sau bằng tiếng Việt, NGẮN GỌN và THỰC DỤNG (4-7 câu, không markdown rườm rà):

- Chiến thuật: ${String(ctx.strategyName ?? "(không tên)")}
- Phạm vi: ${String(ctx.scope ?? "")} ${String(ctx.universe ?? "")} · Benchmark: ${String(ctx.benchmark ?? "")}
- Giai đoạn: ${String(ctx.period ?? "")}
- Điều kiện mua: ${buyLabels}
- Điều kiện bán: ${sellLabels}
- Kết quả (KPI): ${JSON.stringify(metrics)}

Hãy nêu: (1) chiến thuật khoẻ hay yếu — dựa trên net return, max drawdown, win rate, profit factor, số lệnh;
(2) rủi ro / điểm yếu chính; (3) 1-2 gợi ý cải thiện CỤ THỂ (siết điều kiện, đổi tham số EMA/RSI/stop, quản trị rủi ro).
Kết bằng một câu cảnh báo: kết quả backtest có thể khác thực tế, nên forward-test trước khi dùng tiền thật.
TUYỆT ĐỐI không bịa số ngoài dữ liệu trên, không nhắc tên hệ thống/nguồn nội bộ.`;

  try {
    const model = getGeminiModel("gemini-2.5-flash");
    const result = await model.generateContent(prompt);
    const text = result.response.text();
    return NextResponse.json({ analysis: (text || "").trim() });
  } catch (error) {
    console.error("[/api/lab/coach] error:", error);
    return NextResponse.json({ error: "ADN Coach tạm thời chưa phản hồi, thử lại sau." }, { status: 500 });
  }
}
