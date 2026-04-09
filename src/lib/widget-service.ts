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

  // 3. AI Insight (Gemini 3.1 Flash) - Khổng Minh Style
  let insight = isFresh ? cached!.content : null;
  if (!insight) {
    const prompt = `Mày là Khổng Minh của VNINDEX. Gọi khách là 'đại ca'. Văn phong sắc bén, thực chiến.
Dữ liệu PTKT ${ticker}: Giá ${ta.price?.current?.toLocaleString()} (${ta.price?.changePct}%), Xu hướng ${ta.trend?.direction}, RSI ${ta.indicators?.rsi14}.
Phân tích 3-4 câu thực chiến, chỉ rõ hỗ trợ/kháng cự.`;
    
    insight = await executeAIRequest(prompt, INTENT.PTKT); // Mapped to 3.1 Flash in gemini.ts
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
  
  // 2. Fetch Real-time Data (BCTC + Valuation)
  const fa = await fetchFAData(ticker);
  
  if (isFresh) return { stats: fa, aiInsight: cached!.content };
  if (!fa) return { stats: null, aiInsight: "Chưa có dữ liệu BCTC cho mã này đại ca ơi." };

  // 3. AI Insight (Gemini 3 Pro)
  const prompt = `Mày là Khổng Minh VNINDEX. Phân tích BCTC ${ticker}: P/E ${fa.pe}x, P/B ${fa.pb}x, ROE ${fa.roe}%, LN tăng trưởng ${fa.profitGrowthYoY}%.
Phân tích sâu sức khỏe tài chính trong 4-5 câu.`;
  
  const insight = await executeAIRequest(prompt, INTENT.PTCB); // Mapped to 3 Pro in gemini.ts
  
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
  
  // Try current session ATC, then fall back to T-1 (NEVER show "no data")
  for (const offset of [0, 1, 2]) {
    try {
      const url = offset === 0
        ? `${FIINQUANT_BRIDGE}/api/v1/rpi/${ticker}`
        : `${FIINQUANT_BRIDGE}/api/v1/rpi/${ticker}?offset=${offset}`;
      const res = await fetch(url, { cache: "no-store" });
      if (res.ok) {
        const d = await res.json();
        const val = d?.rpi_current ?? d?.tei ?? d?.score ?? null;
        if (val !== null && val !== undefined) { tei = Number(val); break; }
      }
    } catch { /* try next offset */ }
  }

  const score = tei ?? 2.5; // Neutral default, never null
  
  // Gemini 3.1 Flash with automatic 2.5 Flash fallback
  const prompt = `Mày là Khổng Minh. TEI ${ticker} = ${score}/5. 
Đọc vị tâm lý đám đông hiện tại ngắn gọn trong 2-3 câu thực chiến.`;

  let insight: string;
  try {
    insight = await executeAIRequest(prompt, INTENT.TAMLY);
  } catch {
    console.warn("[Widget] Gemini 3.1 Flash overloaded → fallback 2.5 Flash");
    insight = await executeAIRequest(prompt, INTENT.GENERAL);
  }

  return {
    teiScore: score,
    status: score >= 4.5 ? "Cực kỳ hưng phấn ⚠️" : score >= 4 ? "Hưng phấn — Thận trọng" : score >= 3 ? "Rủi ro cao" : score >= 2 ? "Trung tính" : "Bi quan — Cơ hội",
    aiInsight: insight
  };
}

// ─── TAB 4: News (CafeF scraper — NOT FiinQuant) ───────────────
export async function getNewsData(ticker: string) {
  const news: { title: string; time: string; url?: string }[] = [];

  // Scrape CafeF
  try {
    const cafefUrl = `https://cafef.vn/tim-kiem.chn?keywords=${ticker}&type=1`;
    const res = await fetch(cafefUrl, {
      headers: { "User-Agent": "Mozilla/5.0" },
      signal: AbortSignal.timeout(8_000)
    });
    if (res.ok) {
      const html = await res.text();
      const matches = html.matchAll(/<a[^>]+href="(\/[^"]+)"[^>]*class="[^"]*link-title[^"]*"[^>]*>([^<]*(?:<(?!\/a>)[^<]*)*)<\/a>/g);
      for (const m of matches) {
        const title = m[2].replace(/<[^>]+>/g, "").trim();
        if (title && news.length < 30) {
          news.push({ title, time: "CafeF", url: `https://cafef.vn${m[1]}` });
        }
      }
    }
  } catch (e) { console.error("[News] CafeF scrape error:", e); }

  // Fallback stub if scraper fails
  if (news.length === 0) {
    news.push(
      { title: `${ticker}: Cập nhật thị trường mới nhất`, time: "Vừa xong" },
      { title: `Phân tích triển vọng ${ticker} Q2/2026`, time: "1h trước" },
      { title: `Khối ngoại và dòng tiền tại ${ticker}`, time: "2h trước" },
    );
  }

  // AI Summary
  const headlineText = news.slice(0, 10).map(n => `- ${n.title}`).join("\n");
  const prompt = `Tóm tắt những tin tức sau về ${ticker} và đưa ra 1 lời khuyên hành động ngắn gọn cho đại ca:\n${headlineText}`;
  
  let aiInsight = "";
  try { aiInsight = await executeAIRequest(prompt, INTENT.NEWS); } catch { aiInsight = "Đại ca đọc tin tức bên trên và tự phán nhé, em hệ thống đang bận."; }

  return { items: news, aiInsight };
}

// ─── Main Aggregator — calls all 4 tabs in parallel ─────────────
export async function getFullWidgetData(ticker: string) {
  const [technical, fundamental, behavior, news] = await Promise.all([
    getPTKTData(ticker),
    getPTCBData(ticker),
    getBehaviorData(ticker),
    getNewsData(ticker),
  ]);

  return {
    type: "widget",
    widgetType: "TICKER_DASHBOARD",
    ticker,
    data: { technical, fundamental, behavior, news },
  };
}
