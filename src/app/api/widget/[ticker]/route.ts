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
import { getPythonBridgeUrl } from "@/lib/runtime-config";
import { fetchIncomeStatement, incomeYoY } from "@/lib/research/income-statement";
import { fetchVndirectRecommendations } from "@/lib/research/vndirect";

const FIINQUANT_BRIDGE = getPythonBridgeUrl();
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

// Insight AI có dùng được không — tránh CACHE (PTCB 90 ngày!) fallback quá tải
// hoặc output cợt nhả/từ chối ("đại ca", "Khổng Minh", "em không thể"…).
function isUsableInsight(text: string | null | undefined): boolean {
  const t = String(text ?? "").trim();
  if (t.length < 30) return false;
  if (/quá tải|thử lại sau|đại ca|khổng minh|em không thể|em không phải|không có bất kỳ/i.test(t)) return false;
  return true;
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
    const [ta, fa, tei, news, signal, income, broker] = await Promise.all([
      fetchTASummary(ticker),
      fetchFAData(ticker),
      fetchTEI(ticker),
      fetchTickerNews(ticker),
      prisma.signal.findFirst({ where: { ticker }, orderBy: { createdAt: "desc" } }),
      fetchIncomeStatement(ticker).catch(() => null),         // KQKD đa kỳ chuẩn (tỷ) + YoY
      fetchVndirectRecommendations(ticker).catch(() => null), // đồng thuận CTCK (bên thứ 3)
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
      return isCacheValid(c.updatedAt, expiry) && isUsableInsight(c.content) ? c.content : null;
    };

    let ptktInsight = getCache("PTKT");
    let ptcbInsight = getCache("PTCB");

    // ── 3. Generate PTKT AI Insight (Gemini Flash) if cache miss ──────────
    if (!ptktInsight) {
      const prompt = `Bạn là AIDEN Analyst của ADNexus, vận hành bởi ADN Capital. Văn phong ngắn gọn, chuyên nghiệp, định hướng hành động.

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
      if (isUsableInsight(ptktInsight)) {
        await prisma.aiInsightCache.upsert({
          where: { ticker_tabType: { ticker, tabType: "PTKT" } },
          update: { content: ptktInsight },
          create: { ticker, tabType: "PTKT", content: ptktInsight },
        });
      }
    }

    // ── 4. Generate PTCB AI Insight (Gemini Pro) if cache miss ───────────
    if (!ptcbInsight && fa) {
      // Gom đa nguồn: KQKD đa kỳ (tỷ) + YoY (income statement) + đồng thuận CTCK (VNDirect) → AIDEN nhận định.
      const periods = income?.periods ?? [];
      const last = periods[0] ?? null;
      const revYoY = periods.length ? incomeYoY(periods, "netRevenueBn") : null;
      const lnYoY = periods.length ? incomeYoY(periods, "profitAfterTaxBn") : null;
      const pctFmt = (v: number | null | undefined) =>
        v == null ? "—" : `${(Math.abs(v) < 1 ? v * 100 : v).toFixed(1)}%`;
      const kqkdLine = last
        ? `- KQKD ${last.period}: Doanh thu ${last.netRevenueBn ?? "—"} tỷ (YoY ${revYoY ?? "—"}%) · LNST ${last.profitAfterTaxBn ?? "—"} tỷ (YoY ${lnYoY ?? "—"}%)`
        : "- KQKD: chưa có dữ liệu income statement";
      const trendLine =
        periods.length >= 3
          ? `- Xu hướng LNST các kỳ (mới→cũ): ${periods.slice(0, 4).map((p) => p.profitAfterTaxBn ?? "—").join(" / ")} tỷ`
          : "";
      const brokerLine = broker
        ? `- Đồng thuận CTCK (VNDirect, ${broker.recent} báo cáo ~18 tháng): ${broker.buy} Mua / ${broker.hold} Giữ / ${broker.sell} Bán${broker.avgTargetPrice ? ` · giá mục tiêu TB ${broker.avgTargetPrice} (nghìn đ)` : ""}`
        : "- Đồng thuận CTCK: chưa có dữ liệu VNDirect";

      const prompt = `Bạn là AIDEN Analyst của ADN Capital — chuyên gia định giá & phân tích cơ bản. Tự xưng "Hệ thống", gọi người dùng "Nhà đầu tư". Văn phong chuyên nghiệp, sắc bén; TUYỆT ĐỐI không xưng hô thân mật/cợt nhả.

Dữ liệu ${ticker} (gom nhiều nguồn ADN Capital):
- Định giá: P/E ${fa.pe ?? "—"}x · P/B ${fa.pb ?? "—"}x · EPS ${fa.eps != null ? fa.eps.toLocaleString("vi-VN") : "—"} đ/cp
- Hiệu quả: ROE ${pctFmt(fa.roe)} · ROA ${pctFmt(fa.roa)}
${kqkdLine}
${trendLine}
${brokerLine}

Viết NHẬN ĐỊNH cơ bản thực chiến cho Nhà đầu tư (4-6 câu, có thể xuống dòng):
1. Định giá đắt/rẻ (P/E, P/B) + chất lượng lợi nhuận (ROE/ROA, tăng trưởng LNST).
2. Sức khoẻ & xu hướng KQKD (đang cải thiện hay suy giảm).
3. Đồng thuận CTCK + dư địa so giá mục tiêu (nếu có dữ liệu).
4. Kết luận: nền tảng tốt/trung bình/cảnh báo bơm thổi + hành động (tích luỹ/quan sát/tránh).
Chỉ dùng số đã cấp, không bịa, không giải thích khái niệm.`;

      ptcbInsight = await executeAIRequest(prompt, INTENT.PTCB);
      if (isUsableInsight(ptcbInsight)) {
        await prisma.aiInsightCache.upsert({
          where: { ticker_tabType: { ticker, tabType: "PTCB" } },
          update: { content: ptcbInsight },
          create: { ticker, tabType: "PTCB", content: ptcbInsight },
        });
      }
    }

    // ── 5. Return widget data ─────────────────────────────────────────────
    const teiScore = tei ?? ta.indicators?.tei ?? 2.5;
    return NextResponse.json({
      type: "widget",
      widgetType: "TICKER_DASHBOARD",
      ticker,
      data: {
        technical: { stats: ta, aiInsight: ptktInsight },
        fundamental: { stats: fa, income, broker, aiInsight: ptcbInsight ?? null },
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
