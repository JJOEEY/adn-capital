/**
 * widget-service.ts
 * Centralized service for TickerWidget data.
 * INLINE logic to avoid Vercel self-call timeouts.
 */
import { prisma } from "@/lib/prisma";
import { executeAIRequest, INTENT } from "@/lib/gemini";
import { fetchFAData } from "@/lib/stockData";

const FIINQUANT_BRIDGE = process.env.FIINQUANT_URL ?? "http://localhost:8000";

// ─── TAB 1: PTKT (Technical Analysis) ──────────────────────────
export async function getPTKTData(ticker: string) {
  // 1. Check DB Cache first (1 day TTL)
  const cached = await prisma.aiInsightCache.findUnique({
    where: { ticker_tabType: { ticker, tabType: "PTKT" } }
  });
  
  const isFresh = cached && (Date.now() - cached.updatedAt.getTime() < 24 * 60 * 60 * 1000);
  
  // 2. Fetch Real-time Data from FiinQuant
  let ta: any = null;
  try {
    const res = await fetch(`${FIINQUANT_BRIDGE}/api/v1/ta-summary/${ticker}`, { cache: "no-store" });
    if (res.ok) ta = await res.json();
  } catch (e) { console.error("PTKT Fetch Error:", e); }

  if (!ta) return { stats: null, aiInsight: isFresh ? cached!.content : "Dữ liệu FiinQuant tạm thời gián đoạn, đại ca thông cảm!" };

  // 3. AI Insight (Gemini 3.1 Flash)
  let insight = isFresh ? cached!.content : null;
  if (!insight) {
    const prompt = `Mày là Khổng Minh của VNINDEX. Gọi khách là 'đại ca'. Văn phong sắc bén, thực chiến.
Dữ liệu PTKT ${ticker}: Giá ${ta.price?.current?.toLocaleString()} (${ta.price?.changePct}%), Xu hướng ${ta.trend?.direction}, RSI ${ta.indicators?.rsi14}.
Phân tích 3-4 câu thực chiến, chỉ rõ hỗ trợ/kháng cự.`;
    
    insight = await executeAIRequest(prompt, INTENT.PTKT);
    // Save to DB
    await prisma.aiInsightCache.upsert({
      where: { ticker_tabType: { ticker, tabType: "PTKT" } },
      update: { content: insight },
      create: { ticker, tabType: "PTKT", content: insight }
    });
  }

  return { stats: ta, aiInsight: insight };
}

// ─── TAB 2: PTCB (Fundamental Analysis) ────────────────────────
export async function getPTCBData(ticker: string) {
  // 1. Check DB Cache (90 days TTL - 1 quarter)
  const cached = await prisma.aiInsightCache.findUnique({
    where: { ticker_tabType: { ticker, tabType: "PTCB" } }
  });
  
  const isFresh = cached && (Date.now() - cached.updatedAt.getTime() < 90 * 24 * 60 * 60 * 1000);
  if (isFresh) {
    const fa = await fetchFAData(ticker); // Still need stats for the grid
    return { stats: fa, aiInsight: cached!.content };
  }

  // 2. Fetch Real-time Data (BCTC + Valuation)
  const fa = await fetchFAData(ticker);
  if (!fa) return { stats: null, aiInsight: "Chưa có dữ liệu BCTC cho mã này đại ca ơi." };

  // 3. AI Insight (Gemini 3 Pro)
  const prompt = `Mày là Khổng Minh VNINDEX. Phân tích BCTC ${ticker}: P/E ${fa.pe}x, P/B ${fa.pb}x, ROE ${fa.roe}%, LN tăng trưởng ${fa.profitGrowthYoY}%.
Phân tích sâu sức khỏe tài chính trong 4-5 câu.`;
  
  const insight = await executeAIRequest(prompt, INTENT.PTCB);
  
  await prisma.aiInsightCache.upsert({
    where: { ticker_tabType: { ticker, tabType: "PTCB" } },
    update: { content: insight },
    create: { ticker, tabType: "PTCB", content: insight }
  });

  return { stats: fa, aiInsight: insight };
}

// ─── TAB 3: Behavior (Sentiment/ATC) ───────────────────────────
export async function getBehaviorData(ticker: string) {
  let tei: number | null = null;
  try {
    const res = await fetch(`${FIINQUANT_BRIDGE}/api/v1/rpi/${ticker}`, { cache: "no-store" });
    if (res.ok) {
      const d = await res.json();
      tei = d?.rpi_current ?? d?.tei ?? null;
    }
  } catch (e) { console.error("Behavior Fetch Error:", e); }

  const score = tei ?? 2.5;
  
  // AI Insight (Gemini 3.1 Flash with Fallback)
  const prompt = `Mày là Khổng Minh. Đọc vị hành vi mã ${ticker} với điểm tâm lý TEI là ${score}/5. 
Giải thích ngắn gọn tâm lý đám đông hiện tại.`;

  let insight: string;
  try {
    insight = await executeAIRequest(prompt, INTENT.TAMLY); // Try 3.1 Flash (mapped in gemini.ts)
  } catch (e) {
    console.warn("Gemini 3.1 Flash overloaded, falling back to 2.5 Flash");
    insight = await executeAIRequest(prompt, INTENT.GENERAL); // Fallback to 2.5 Flash
  }

  return {
    teiScore: score,
    status: score >= 4 ? "Hưng phấn cực độ" : score >= 3 ? "Rủi ro cao" : score >= 2 ? "Trung tính" : "Bi quan — Cơ hội",
    aiInsight: insight
  };
}

// ─── TAB 4: News (CafeF/vnstock) ───────────────────────────────
export async function getNewsData(ticker: string) {
  // Mocking 30 news items (In real VPS, this would be a scraper call)
  const news = [
    { title: `${ticker}: Lợi nhuận quý 1 tăng trưởng vượt kỳ vọng`, time: "1 giờ trước", url: "#" },
    { title: `Khối ngoại gom mạnh cổ phiếu ${ticker}`, time: "3 giờ trước", url: "#" },
    { title: `Phân tích kỹ thuật: ${ticker} đang tiệm cận vùng kháng cự mạnh`, time: "5 giờ trước", url: "#" },
  ];

  const prompt = `Tóm tắt 3 tin tức trên về ${ticker} và đưa ra lời khuyên ngắn gọn cho đại ca.`;
  const insight = await executeAIRequest(prompt, INTENT.NEWS);

  return { items: news, aiInsight: insight };
}

// ─── Main Aggregator ───────────────────────────────────────────
export async function getFullWidgetData(ticker: string) {
  const [technical, fundamental, behavior, news] = await Promise.all([
    getPTKTData(ticker),
    getPTCBData(ticker),
    getBehaviorData(ticker),
    getNewsData(ticker)
  ]);

  return {
    type: "widget",
    widgetType: "TICKER_DASHBOARD",
    ticker,
    data: { technical, fundamental, behavior, news }
  };
}
