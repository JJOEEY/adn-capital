/**
 * /api/widget/[ticker]/route.ts
 *
 * Dedicated data API for TickerWidget.tsx
 *
 * Flow:
 *   0. isMockMode() → true? Return MockFactory immediately (no API calls)
 *   1. Fetch TA + FA từ FiinQuant Bridge (CHỈ nguồn này)
 *   2. Check AiInsightCache trong DB (PTKT=1d, PTCB=90d)
 *   3. Cache miss → gọi Gemini (Flash for PTKT, Pro for PTCB)
 *   4. Lưu cache, trả về Frontend
 */
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { executeAIRequest, INTENT } from "@/lib/gemini";
import { fetchFAData } from "@/lib/stockData";
import { isMockMode } from "@/lib/settings";
import { MockFactory } from "@/lib/mock-factory";

const FIINQUANT_BRIDGE = process.env.FIINQUANT_URL ?? process.env.PYTHON_BRIDGE_URL ?? "http://localhost:8000";
const CACHE_EXPIRY_PTKT_MS = 24 * 60 * 60 * 1000;        // 1 ngày
const CACHE_EXPIRY_PTCB_MS = 90 * 24 * 60 * 60 * 1000;   // 90 ngày (1 quý)

async function fetchTASummary(ticker: string) {
  try {
    const res = await fetch(`${FIINQUANT_BRIDGE}/api/v1/ta-summary/${ticker}`, {
      signal: AbortSignal.timeout(20_000), cache: "no-store",
    });
    if (!res.ok) return null;
    return await res.json();
  } catch { return null; }
}

async function fetchTEI(ticker: string): Promise<number | null> {
  try {
    const res = await fetch(`${FIINQUANT_BRIDGE}/api/v1/rpi/${ticker}`, {
      signal: AbortSignal.timeout(10_000), cache: "no-store",
    });
    if (!res.ok) return null;
    const d = await res.json();
    return d?.rpi_current ?? d?.tei ?? null;
  } catch { return null; }
}

async function fetchTickerNews(ticker: string): Promise<{ title: string; time: string; url?: string }[]> {
  try {
    const res = await fetch(`${FIINQUANT_BRIDGE}/api/v1/news/${ticker}?limit=5`, {
      signal: AbortSignal.timeout(10_000), cache: "no-store",
    });
    if (!res.ok) return [];
    const d = await res.json();
    return d?.items ?? d?.news ?? [];
  } catch { return []; }
}

function isCacheValid(updatedAt: Date, expiryMs: number): boolean {
  return Date.now() - updatedAt.getTime() < expiryMs;
}

export async function GET(req: NextRequest, { params }: { params: Promise<{ ticker: string }> }) {
  const { ticker: rawTicker } = await params;
  const ticker = rawTicker.toUpperCase();

  try {
    // ── 0. Presentation Mode: skip ALL external APIs ──────────────────────
    if (await isMockMode()) {
      console.log(`[Widget API] 🎬 Presentation Mode ACTIVE for ${ticker}`);
      const mockData = MockFactory.getTicker(ticker);
      return NextResponse.json({
        type: "widget",
        widgetType: "TICKER_DASHBOARD",
        ticker,
        data: mockData,
      });
    }

    // ── 1. Fetch real data from FiinQuant (parallel) ─────────────────────
    const [ta, fa, tei, news, signal] = await Promise.all([
      fetchTASummary(ticker),
      fetchFAData(ticker),
      fetchTEI(ticker),
      fetchTickerNews(ticker),
      prisma.signal.findFirst({ where: { ticker }, orderBy: { createdAt: "desc" } }),
    ]);

    if (!ta) {
      return NextResponse.json({ error: `Không có dữ liệu FiinQuant cho mã ${ticker}` }, { status: 404 });
    }

    // ── 2. Load AI insight caches from DB ─────────────────────────────────
    const cachedInsights = await prisma.aiInsightCache.findMany({ where: { ticker } });
    const getCache = (type: "PTKT" | "PTCB") => {
      const c = cachedInsights.find(i => i.tabType === type);
      if (!c) return null;
      const expiry = type === "PTKT" ? CACHE_EXPIRY_PTKT_MS : CACHE_EXPIRY_PTCB_MS;
      return isCacheValid(c.updatedAt, expiry) ? c.content : null;
    };

    let ptktInsight = getCache("PTKT");
    let ptcbInsight = getCache("PTCB");

    // ── 3. Generate PTKT AI Insight (Gemini Flash) if cache miss ──────────
    if (!ptktInsight) {
      const prompt = `Bạn là AI Broker của ADN Capital. Văn phong ngắn gọn, chuyên nghiệp, định hướng hành động.

Dữ liệu PTKT ${ticker} từ hệ thống Quant ADN Capital:
- Giá: ${ta.price?.current?.toLocaleString("vi-VN")} (${ta.price?.changePct}%)
- 52W: ${ta.price?.high52w} / ${ta.price?.low52w}
- Xu hướng: ${ta.trend?.direction} | ADX: ${ta.trend?.adx}
- EMA10=${ta.indicators?.ema10} | EMA50=${ta.indicators?.ema50} | EMA200=${ta.indicators?.ema200}
- RSI(14): ${ta.indicators?.rsi14} | MACD Hist: ${ta.indicators?.macdHistogram} | MFI: ${ta.indicators?.mfi14}
- Tín hiệu: ${ta.signal} (Bull ${ta.bullishScore}/Bear ${ta.bearishScore})
- Mẫu hình: ${ta.patterns?.join(", ") || "Chưa có"}

Viết 3-4 câu nhận xét PTKT thực chiến (điểm mua lý tưởng, cảnh báo, kháng cự). Không giải thích khái niệm.`;

      ptktInsight = await executeAIRequest(prompt, INTENT.PTKT);
      await prisma.aiInsightCache.upsert({
        where: { ticker_tabType: { ticker, tabType: "PTKT" } },
        update: { content: ptktInsight },
        create: { ticker, tabType: "PTKT", content: ptktInsight },
      });
    }

    // ── 4. Generate PTCB AI Insight (Gemini Pro) if cache miss ───────────
    if (!ptcbInsight && fa) {
      const prompt = `Bạn là AI Broker của ADN Capital. Văn phong ngắn gọn, chuyên nghiệp, định hướng hành động.

Dữ liệu BCTC ${ticker} từ FiinQuant:
- P/E: ${fa.pe}x | P/B: ${fa.pb}x | EPS: ${fa.eps?.toLocaleString("vi-VN")} đ/cp
- ROE: ${fa.roe}% | ROA: ${fa.roa}%
- DT: ${fa.revenueLastQ} tỷ (YoY ${fa.revenueGrowthYoY}%) | LN: ${fa.profitLastQ} tỷ (YoY ${fa.profitGrowthYoY}%)

Phân tích ngắn gọn sức khỏe tài chính. Cảnh báo nếu bơm thổi hoặc khen ngợi nếu nền tảng tốt. 3-4 câu.`;

      ptcbInsight = await executeAIRequest(prompt, INTENT.PTCB);
      await prisma.aiInsightCache.upsert({
        where: { ticker_tabType: { ticker, tabType: "PTCB" } },
        update: { content: ptcbInsight },
        create: { ticker, tabType: "PTCB", content: ptcbInsight },
      });
    }

    // ── 5. Return widget data ─────────────────────────────────────────────
    const teiScore = tei ?? ta.indicators?.tei ?? 2.5;
    return NextResponse.json({
      type: "widget",
      widgetType: "TICKER_DASHBOARD",
      ticker,
      data: {
        technical: { stats: ta, aiInsight: ptktInsight },
        fundamental: { stats: fa, aiInsight: ptcbInsight ?? null },
        news,
        behavior: {
          teiScore,
          status: teiScore >= 4 ? "Hưng phấn cực độ" : teiScore >= 3 ? "Rủi ro cao" : teiScore >= 2 ? "Trung tính" : "Bi quan — Cơ hội",
        },
        signal,
      },
    });

  } catch (error) {
    console.error(`[Widget API] ${ticker}:`, error);
    return NextResponse.json({ error: "Lỗi lấy dữ liệu widget" }, { status: 500 });
  }
}
