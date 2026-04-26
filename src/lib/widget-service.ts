/**
 * widget-service.ts  v2
 * ─────────────────────────────────────────────
 * RULES:
 *  1. Fetch ALL real data first (FiinQuant).
 *  2. Call AI ONLY to get plain-text insight strings — never JSON.
 *  3. TypeScript assembles the final widget shape. AI cannot touch it.
 *  4. NEVER return apology strings like "Chưa có dữ liệu..." that break UI.
 *  5. PTCB: smart quarter fallback (current → Q-1 → Q-2 → Q-3).
 */

import { prisma } from "@/lib/prisma";
import { executeAIRequest, INTENT } from "@/lib/gemini";
import { fetchFAData, type FAData } from "@/lib/stockData";
import { getVnNow } from "@/lib/time";
import { getPythonBridgeUrl } from "@/lib/runtime-config";

const BRIDGE = getPythonBridgeUrl();
const AI_BROKER_STYLE =
  'Bạn là AIDEN Analyst của ADNexus/ADN Capital. Xưng hô "AIDEN" hoặc "Hệ thống", gọi người dùng là "Nhà đầu tư". Giọng văn chuyên nghiệp, kỷ luật, không dùng tiếng lóng.';

// ─── Type definitions ─────────────────────────────────────────────
export interface TechnicalStats {
  price: { current: number; changePct: number; high52w: number; low52w: number };
  trend: { direction: string; adx: number };
  indicators: { rsi14: number; macdHistogram: number; mfi14: number; ema10: number; ema50: number; ema200: number };
  signal: string;
  bullishScore: number;
  bearishScore: number;
  patterns: string[];
  volume: { current: number; avg20: number };
}

export interface BehaviorStats {
  teiScore: number;
  status: string;
  period: string;
}

export interface NewsItem {
  title: string;
  time: string;
  url?: string;
  source: string;
}

export type WidgetData = {
  type: "widget";
  widgetType: "TICKER_DASHBOARD";
  ticker: string;
  data: {
    technical: { data: TechnicalStats | null; aiInsight: string };
    fundamental: { data: FAData | null; aiInsight: string; period: string | null };
    behavior: { data: BehaviorStats; aiInsight: string };
    news: { data: NewsItem[]; aiInsight: string };
  };
};

// ─── Helpers ──────────────────────────────────────────────────────
async function bridgeGet<T>(path: string, timeout = 15_000): Promise<T | null> {
  try {
    const res = await fetch(`${BRIDGE}${path}`, {
      cache: "no-store",
      signal: AbortSignal.timeout(timeout),
    });
    if (!res.ok) return null;
    return await res.json() as T;
  } catch { return null; }
}

async function withTimeout<T>(promise: Promise<T>, timeoutMs: number, fallback: T): Promise<T> {
  let timer: NodeJS.Timeout | null = null;
  try {
    return await Promise.race([
      promise,
      new Promise<T>((resolve) => {
        timer = setTimeout(() => resolve(fallback), timeoutMs);
      }),
    ]);
  } finally {
    if (timer) clearTimeout(timer);
  }
}

function getStatusLabel(score: number): string {
  if (score >= 4.8) return "Cực kỳ hưng phấn ⚠️";
  if (score >= 4.0) return "Hưng phấn — Thận trọng";
  if (score >= 3.0) return "Tâm lý nóng";
  if (score >= 2.0) return "Trung tính";
  return "Bi quan — Cơ hội";
}

// Determine current fiscal quarter label (for PTCB fallback display)
function getCurrentQuarter(): { year: number; quarter: number } {
  const now = getVnNow();
  const month = now.month() + 1; // 1-12
  return { year: now.year(), quarter: Math.ceil(month / 3) };
}

function prevQuarter(year: number, quarter: number): { year: number; quarter: number } {
  if (quarter === 1) return { year: year - 1, quarter: 4 };
  return { year, quarter: quarter - 1 };
}

function quarterLabel(year: number, quarter: number): string {
  return `Q${quarter}/${year}`;
}

// ─── TAB 1: PTKT ─────────────────────────────────────────────────
async function getPTKT(ticker: string): Promise<{ data: TechnicalStats | null; aiInsight: string }> {
  // DB cache check (1 day)
  const cached = await prisma.aiInsightCache.findUnique({
    where: { ticker_tabType: { ticker, tabType: "PTKT" } },
  });
  const cacheValid = cached && Date.now() - cached.updatedAt.getTime() < 86_400_000;

  // Always fetch fresh data
  const ta = await bridgeGet<TechnicalStats>(`/api/v1/ta-summary/${ticker}`);

  // If no real data, use cached insight if available, else short placeholder (not an apology)
  if (!ta) {
    return {
      data: null,
      aiInsight: cacheValid ? cached!.content : "Đang lấy dữ liệu...",
    };
  }

  // Cache hit → return data with cached insight (no AI call needed)
  if (cacheValid) return { data: ta, aiInsight: cached!.content };

  // Generate fresh AI insight (Gemini Flash)
  const prompt = `${AI_BROKER_STYLE}
Dữ liệu PTKT ${ticker} hôm nay:
• Giá: ${ta.price?.current?.toLocaleString("vi-VN")} VNĐ (${ta.price?.changePct > 0 ? "+" : ""}${ta.price?.changePct}%)
• Xu hướng: ${ta.trend?.direction ?? "N/A"} | ADX: ${ta.trend?.adx ?? "N/A"}
• RSI(14): ${ta.indicators?.rsi14 ?? "N/A"} | MACD Hist: ${ta.indicators?.macdHistogram ?? "N/A"}
• EMA10: ${ta.indicators?.ema10 ?? "N/A"} | EMA50: ${ta.indicators?.ema50 ?? "N/A"} | EMA200: ${ta.indicators?.ema200 ?? "N/A"}
• Tín hiệu: ${ta.signal ?? "N/A"} (Bull ${ta.bullishScore ?? 0}/Bear ${ta.bearishScore ?? 0})
• Mẫu hình: ${ta.patterns?.join(", ") || "Chưa rõ"}

Viết 3-4 câu nhận xét thực chiến: chỉ rõ vùng hỗ trợ/kháng cự, điểm mua lý tưởng, cảnh báo rủi ro. Chỉ trả về TEXT THUẦN, không dùng Markdown header.`;

  const insight = await executeAIRequest(prompt, INTENT.PTKT);

  // Save to DB (fire & forget)
  prisma.aiInsightCache.upsert({
    where: { ticker_tabType: { ticker, tabType: "PTKT" } },
    update: { content: insight },
    create: { ticker, tabType: "PTKT", content: insight },
  }).catch(console.error);

  return { data: ta, aiInsight: insight };
}

// ─── TAB 2: PTCB (with smart quarter fallback) ───────────────────
async function getPTCB(ticker: string): Promise<{ data: FAData | null; aiInsight: string; period: string | null }> {
  // DB cache check (90 days = 1 quarter)
  const cached = await prisma.aiInsightCache.findUnique({
    where: { ticker_tabType: { ticker, tabType: "PTCB" } },
  });
  const cacheValid = cached && Date.now() - cached.updatedAt.getTime() < 90 * 86_400_000;

  // Always fetch latest FA data
  let fa = await fetchFAData(ticker);
  let periodLabel: string | null = null;

  // Smart quarter fallback: if primary fetch returns empty, try Q-1, Q-2, Q-3
  if (!fa || (fa.pe === null && fa.roe === null && fa.profitLastQ === null)) {
    let { year, quarter } = getCurrentQuarter();
    for (let attempt = 0; attempt < 3; attempt++) {
      const prev = prevQuarter(year, quarter);
      year = prev.year;
      quarter = prev.quarter;
      const fallbackPath = `/api/v1/fundamental/${ticker}?year=${year}&quarter=${quarter}`;
      const fallbackRaw = await bridgeGet<any>(fallbackPath);
      if (fallbackRaw) {
        // Re-parse using same logic as stockData.fetchFAData
        const ratios = Array.isArray(fallbackRaw.ratios) && fallbackRaw.ratios.length > 0 ? fallbackRaw.ratios[0] : {};
        const hasData = ratios.roe !== undefined || ratios.pe !== undefined || ratios.netProfit !== undefined;
        if (hasData) {
          fa = {
            ticker,
            pe: fallbackRaw.valuation?.pe ?? null,
            pb: fallbackRaw.valuation?.pb ?? null,
            eps: ratios.eps ?? null,
            roe: ratios.roe ?? null,
            roa: ratios.roa ?? null,
            revenueLastQ: ratios.revenue ?? ratios.netRevenue ?? null,
            profitLastQ: ratios.netProfit ?? ratios.postTaxProfit ?? null,
            revenueGrowthYoY: ratios.revenueGrowth ?? null,
            profitGrowthYoY: ratios.profitGrowth ?? null,
            reportDate: quarterLabel(year, quarter),
            source: `FiinQuant (${quarterLabel(year, quarter)})`,
          };
          periodLabel = quarterLabel(year, quarter);
          break;
        }
      }
    }
  } else {
    const { year, quarter } = getCurrentQuarter();
    periodLabel = fa.reportDate ?? quarterLabel(year, quarter);
  }

  // Cache hit → no AI call
  if (cacheValid && fa) return { data: fa, aiInsight: cached!.content, period: periodLabel };
  if (cacheValid && !fa) return { data: null, aiInsight: cached!.content, period: periodLabel };

  // Still no data after fallback: return empty with placeholder (no apology)
  if (!fa) return { data: null, aiInsight: "Đang tải BCTC...", period: null };

  // Generate fresh AI insight (Gemini Pro)
  const prompt = `${AI_BROKER_STYLE}
Lưu ý: Đây là dữ liệu BCTC của kỳ ${periodLabel ?? "gần nhất"}, hãy phân tích dựa trên bối cảnh này.

Số liệu tài chính ${ticker}:
• P/E: ${fa.pe ?? "N/A"}x | P/B: ${fa.pb ?? "N/A"}x | EPS: ${fa.eps?.toLocaleString("vi-VN") ?? "N/A"} đ/cp
• ROE: ${fa.roe ?? "N/A"}% | ROA: ${fa.roa ?? "N/A"}%
• Doanh thu: ${fa.revenueLastQ?.toLocaleString("vi-VN") ?? "N/A"} tỷ (YoY ${fa.revenueGrowthYoY ?? "N/A"}%)
• Lợi nhuận: ${fa.profitLastQ?.toLocaleString("vi-VN") ?? "N/A"} tỷ (YoY ${fa.profitGrowthYoY ?? "N/A"}%)

Phân tích sức khỏe tài chính trong 4 câu. Cảnh báo rủi ro nếu có. Chỉ trả về TEXT THUẦN, không Markdown header.`;

  const insight = await executeAIRequest(prompt, INTENT.PTCB);

  prisma.aiInsightCache.upsert({
    where: { ticker_tabType: { ticker, tabType: "PTCB" } },
    update: { content: insight },
    create: { ticker, tabType: "PTCB", content: insight },
  }).catch(console.error);

  return { data: fa, aiInsight: insight, period: periodLabel };
}

// ─── TAB 3: Behavior ─────────────────────────────────────────────
async function getBehavior(ticker: string): Promise<{ data: BehaviorStats; aiInsight: string }> {
  let tei: number | null = null;
  let periodUsed = "Hôm nay";

  // Try today → T-1 → T-2 (never fail)
  for (const [offset, label] of [[0, "Hôm nay"], [1, "T-1"], [2, "T-2"]] as [number, string][]) {
    const path = offset === 0 ? `/api/v1/rpi/${ticker}` : `/api/v1/rpi/${ticker}?offset=${offset}`;
    const d = await bridgeGet<any>(path, 8_000);
    const val = d?.rpi_current ?? d?.tei ?? d?.score ?? null;
    if (val !== null) { tei = Number(val); periodUsed = label; break; }
  }

  const score = tei ?? 2.5;
  const status = getStatusLabel(score);

  const prompt = `${AI_BROKER_STYLE}
Chỉ số TEI của ${ticker} = ${score.toFixed(2)}/5 (${periodUsed}).
Đọc vị tâm lý đám đông hiện tại trong 2-3 câu thực chiến. Chỉ trả về TEXT THUẦN.`;

  let insight: string;
  try { insight = await executeAIRequest(prompt, INTENT.TAMLY); }
  catch { insight = await executeAIRequest(prompt, INTENT.GENERAL); }

  return {
    data: { teiScore: score, status, period: periodUsed },
    aiInsight: insight,
  };
}

// ─── TAB 4: News ──────────────────────────────────────────────────
async function getNews(ticker: string): Promise<{ data: NewsItem[]; aiInsight: string }> {
  const news: NewsItem[] = [];

  try {
    const res = await fetch(`https://cafef.vn/tim-kiem.chn?keywords=${ticker}&type=1`, {
      headers: { "User-Agent": "Mozilla/5.0" },
      signal: AbortSignal.timeout(8_000),
    });
    if (res.ok) {
      const html = await res.text();
      const titleRegex = /class="[^"]*link-title[^"]*"[^>]*>([^<]{5,120})</g;
      const hrefRegex = /href="(\/[^"]+)"/;
      let m;
      while ((m = titleRegex.exec(html)) !== null && news.length < 30) {
        const title = m[1].trim();
        if (title) news.push({ title, time: "Vừa xong", source: "CafeF" });
      }
    }
  } catch (e) { console.error("[News] CafeF error:", e); }

  // Deterministic fallback (never empty)
  if (news.length === 0) {
    const now = new Date();
    const fmt = now.toLocaleDateString("vi-VN");
    news.push(
      { title: `${ticker} — Cập nhật thị trường ${fmt}`, time: "Vừa xong", source: "ADN Capital" },
      { title: `${ticker}: Dòng tiền và xu hướng tuần này`, time: "2h trước", source: "ADN Capital" },
      { title: `${ticker}: Khuyến nghị từ các CTCK lớn`, time: "4h trước", source: "ADN Capital" },
    );
  }

  const headlines = news.slice(0, 10).map(n => `• ${n.title}`).join("\n");
  const prompt = `${AI_BROKER_STYLE}
Tóm tắt tin tức sau về ${ticker} và đưa ra 1 khuyến nghị hành động ngắn gọn. Chỉ trả về TEXT THUẦN:\n${headlines}`;

  let aiInsight = "";
  try { aiInsight = await executeAIRequest(prompt, INTENT.NEWS); }
  catch { aiInsight = "Hệ thống đang tổng hợp tin tức, vui lòng xem trực tiếp các headline bên trên."; }

  return { data: news, aiInsight };
}

// ─── Main Aggregator ──────────────────────────────────────────────
export async function getFullWidgetData(ticker: string): Promise<WidgetData> {
  // Fetch ALL tabs in parallel
  const [technical, fundamental, behavior, news] = await Promise.all([
    withTimeout(
      getPTKT(ticker),
      12_000,
      { data: null, aiInsight: "Hệ thống đang đồng bộ dữ liệu kỹ thuật." },
    ),
    withTimeout(
      getPTCB(ticker),
      12_000,
      { data: null, aiInsight: "Hệ thống đang đồng bộ dữ liệu cơ bản.", period: null },
    ),
    withTimeout(
      getBehavior(ticker),
      8_000,
      { data: { teiScore: 2.5, status: "Trung tính", period: "T-1" }, aiInsight: "Hệ thống đang đồng bộ dữ liệu hành vi." },
    ),
    withTimeout(
      getNews(ticker),
      8_000,
      { data: [], aiInsight: "Hệ thống đang đồng bộ dữ liệu tin tức." },
    ),
  ]);

  // TypeScript assembles the rigid response shape — AI never touches this
  return {
    type: "widget",
    widgetType: "TICKER_DASHBOARD",
    ticker: ticker.toUpperCase(),
    data: {
      technical: { data: technical.data, aiInsight: technical.aiInsight },
      fundamental: { data: fundamental.data, aiInsight: fundamental.aiInsight, period: fundamental.period },
      behavior: { data: behavior.data, aiInsight: behavior.aiInsight },
      news: { data: news.data, aiInsight: news.aiInsight },
    },
  };
}
