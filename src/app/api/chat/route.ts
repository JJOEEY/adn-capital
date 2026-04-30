/**
 * /api/chat/route.ts
 *
 * API xử lý chat AI với kỹ thuật RAG (Retrieval-Augmented Generation):
 * - Ưu tiên FiinQuant Bridge (localhost:8000) để lấy dữ liệu thực
 * - Fallback VNDirect nếu bridge không khả dụng
 * - Inject dữ liệu thật vào Prompt để AI KHÔNG được hallucinate số liệu
 * - Các lệnh: /ta, /fa, /news, /tamly
 */

import { NextRequest, NextResponse } from "next/server";
import { getCurrentDbUser } from "@/lib/current-user";
import { prisma } from "@/lib/prisma";
import { executeAIRequest, INTENT } from "@/lib/gemini";
import { consumeChatQuota, resolveChatQuota } from "@/lib/chat-quota";
import { fetchTAData, fetchFAData, type TAData, type FAData } from "@/lib/stockData";
import { resolveMarketTicker } from "@/lib/ticker-resolver";
import { isMockMode } from "@/lib/settings";
import { MockFactory } from "@/lib/mock-factory";
import { getFullWidgetData } from "@/lib/widget-service";
import { getVnDateISO } from "@/lib/time";
import { getPythonBridgeUrl } from "@/lib/runtime-config";
import { loadReportedSignalSummary } from "@/lib/signals/report-history";
import { formatReportedSignalSummary } from "@/lib/signals/reporting";

const FIINQUANT_BRIDGE = getPythonBridgeUrl();
const CHAT_BRIDGE_AI_TIMEOUT_MS = 5_500;
const CHAT_BRIDGE_CONTEXT_TIMEOUT_MS = 5_000;
const CHAT_BRIDGE_LIGHT_CONTEXT_TIMEOUT_MS = 4_000;
const CHAT_AI_FALLBACK_TIMEOUT_MS = 10_000;
const CHAT_PERSONA_REWRITE_TIMEOUT_MS = 4_000;

// ─── Knowledge Base Cache ─────────────────────────────────────
let knowledgeCache: { content: string; ts: number } | null = null;
const KNOWLEDGE_CACHE_TTL = 300_000; // 5 phút

async function getKnowledgeContext(): Promise<string> {
  if (knowledgeCache && Date.now() - knowledgeCache.ts < KNOWLEDGE_CACHE_TTL) {
    return knowledgeCache.content;
  }

  try {
    const knowledge = await prisma.chatKnowledge.findMany({
      where: { isActive: true },
      orderBy: [{ priority: "desc" }, { category: "asc" }],
    });

    if (knowledge.length === 0) return "";

    const sections = knowledge.map(
      (k) => `### [${k.category.toUpperCase()}] ${k.title}\n${k.content}`
    );

    const content = `
═══════════════════════════════════════════
📚 KNOWLEDGE BASE ADN CAPITAL (Tuân thủ nghiêm ngặt)
═══════════════════════════════════════════
${sections.join("\n\n")}
═══════════════════════════════════════════`;

    knowledgeCache = { content, ts: Date.now() };
    return content;
  } catch (err) {
    console.error("[ChatKnowledge] Error loading:", err);
    return "";
  }
}

// ─── Recent Chat History ──────────────────────────────────────
async function getRecentChatHistory(userId: string | null, limit = 6): Promise<string> {
  if (!userId) return "";
  try {
    const chats = await prisma.chat.findMany({
      where: { userId },
      orderBy: { createdAt: "desc" },
      take: limit,
    });
    if (chats.length === 0) return "";

    const history = chats
      .reverse()
      .map((c) => `[${c.role}]: ${c.message.substring(0, 200)}`)
      .join("\n");

    return `\n\n📝 LỊCH SỬ TRÒ CHUYỆN GẦN ĐÂY:\n${history}\n`;
  } catch {
    return "";
  }
}

// ─── Fetch TA Summary đã tính sẵn từ FiinQuant Bridge ────────────
interface TASummary {
  ticker: string;
  dataDate: string;
  totalSessions: number;
  price: {
    current: number;
    prevClose: number;
    change: number;
    changePct: number;
    high52w: number | null;
    low52w: number | null;
  };
  trend: {
    direction: string;
    strength: string;
    adx: number | null;
    adxPlus: number | null;
    adxMinus: number | null;
  };
  indicators: Record<string, number | null>;
  levels: Record<string, number | null>;
  volume: {
    last: number | null;
    avg10: number | null;
    avg20: number | null;
    ratio: number | null;
  };
  signal: string;
  bullishScore: number;
  bearishScore: number;
  patterns: string[];
  recentCandles: Record<string, unknown>[];
}

async function fetchTASummary(ticker: string, timeoutMs = CHAT_BRIDGE_CONTEXT_TIMEOUT_MS): Promise<TASummary | null> {
  try {
    const url = `${FIINQUANT_BRIDGE}/api/v1/ta-summary/${ticker}`;
    console.log(`[Chat /ta] Fetching TA Summary: ${url}`);
    const res = await fetch(url, {
      signal: AbortSignal.timeout(timeoutMs),
      cache: "no-store",
    });
    if (!res.ok) {
      console.warn(`[Chat /ta] Bridge ta-summary ${ticker}: HTTP ${res.status}`);
      return null;
    }
    return (await res.json()) as TASummary;
  } catch (err) {
    console.warn(`[Chat /ta] Bridge ta-summary ${ticker}: Lỗi kết nối`, err);
    return null;
  }
}

// ─── Fetch AI phân tích từ FiinQuant Bridge (trực tiếp) ─────────────
interface AIAnalysisResult {
  ticker: string;
  analysis: string;
  signal?: string;
  support?: number;
  resistance?: number;
  media_url?: string;
  price?: number;
  quarter?: string;
  date?: string;
  cached?: boolean;
}

interface BridgeNewsItem {
  title?: string;
  summary?: string;
  time?: string;
  published_at?: string;
  source?: string;
  link?: string;
}

async function fetchBridgeAI(
  endpoint: "ta" | "fa" | "tamly",
  ticker: string,
  context: string = "",
  timeoutMs = CHAT_BRIDGE_AI_TIMEOUT_MS,
): Promise<AIAnalysisResult | null> {
  try {
    const url = `${FIINQUANT_BRIDGE}/api/v1/ai/${endpoint}/${ticker}?context=${encodeURIComponent(context)}`;
    console.log(`[Chat AI] Fetching bridge AI ${endpoint}: ${url}`);
    const res = await fetch(url, {
      signal: AbortSignal.timeout(timeoutMs),
      cache: "no-store",
    });
    if (!res.ok) {
      console.warn(`[Chat AI] Bridge AI ${endpoint} ${ticker}: HTTP ${res.status}`);
      return null;
    }
    return (await res.json()) as AIAnalysisResult;
  } catch (err) {
    console.warn(`[Chat AI] Bridge AI ${endpoint} ${ticker}: Lỗi kết nối`, err);
    return null;
  }
}

async function withTimeout<T>(task: Promise<T>, timeoutMs: number, label: string): Promise<T> {
  let timeoutHandle: NodeJS.Timeout | null = null;
  try {
    return await Promise.race([
      task,
      new Promise<T>((_, reject) => {
        timeoutHandle = setTimeout(() => {
          reject(new Error(`[${label}] timed out after ${timeoutMs}ms`));
        }, timeoutMs);
      }),
    ]);
  } finally {
    if (timeoutHandle) clearTimeout(timeoutHandle);
  }
}

async function fetchBridgeTickerNews(ticker: string): Promise<BridgeNewsItem[]> {
  try {
    const url = `${FIINQUANT_BRIDGE}/api/v1/news/${ticker}?limit=5`;
    const res = await fetch(url, {
      signal: AbortSignal.timeout(CHAT_BRIDGE_CONTEXT_TIMEOUT_MS),
      cache: "no-store",
    });
    if (!res.ok) return [];
    const payload = (await res.json()) as { items?: BridgeNewsItem[]; news?: BridgeNewsItem[] };
    const items = Array.isArray(payload.items)
      ? payload.items
      : Array.isArray(payload.news)
        ? payload.news
        : [];
    return items.slice(0, 5);
  } catch {
    return [];
  }
}

// ─── Fetch Market Overview (Đánh giá Đáy Thị Trường) từ FiinQuant ──
interface MarketOverviewData {
  ticker: string;
  score: number;
  max_score: number;
  level: number;
  status_badge: string;
  market_breadth: string;
  technical_highlights: { ema: string; vsa: string; divergence: string };
  reasons: string[];
  action_message: string;
  disclaimer: string;
  liquidity: number;
  price: number;
}

async function fetchMarketOverview(): Promise<MarketOverviewData | null> {
  try {
    const res = await fetch(`${FIINQUANT_BRIDGE}/api/v1/market-overview`, {
      signal: AbortSignal.timeout(CHAT_BRIDGE_CONTEXT_TIMEOUT_MS),
      cache: "no-store",
    });
    if (!res.ok) return null;
    return (await res.json()) as MarketOverviewData;
  } catch {
    return null;
  }
}

// ─── Detect stock tickers trong tin nhắn tự do ────────────────────
function detectTickers(msg: string): string[] {
  return extractTickerCandidates(msg).slice(0, 3);
}

function shouldFetchMarketContext(msg: string): boolean {
  if (detectTickers(msg).length > 0) return true;

  const normalized = msg
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();

  const keywordPatterns = [
    /\bthi truong\b/,
    /\bchung khoan\b/,
    /\bvn-?index\b/,
    /\bvn30\b/,
    /\bco phieu\b/,
    /\bthanh khoan\b/,
    /\bdong tien\b/,
    /\bchart\b/,
    /\b(ptkt|ptcb)\b/,
    /\bky thuat\b/,
    /\bco ban\b/,
    /\b(ho tro|khang cu)\b/,
    /\b(support|resistance)\b/,
    /\b(ema\d*|rsi|macd|adx|mfi)\b/,
    /\b(stop ?loss|target|gia muc tieu)\b/,
    /\b(danh muc|ti trong)\b/,
  ];

  return keywordPatterns.some((pattern) => pattern.test(normalized));
}

// ─── Format market context cho general chat ──────────────────────
function formatMarketContext(
  overview: MarketOverviewData | null,
  vnindexTA: TASummary | null,
  stockTAs: { ticker: string; ta: TASummary }[],
): string {
  const parts: string[] = [];

  if (overview) {
    const levelLabel = overview.level === 3 ? "FULL MARGIN" : overview.level === 2 ? "THĂM DÒ" : "QUAN SÁT";
    parts.push(`
════════════════════════════════════════
📊 ĐÁNH GIÁ THỊ TRƯỜNG REAL-TIME (${getVnDateISO()})
════════════════════════════════════════
VN-Index: ${fmtPrice(overview.price)} điểm
Thanh khoản: ${new Intl.NumberFormat("vi-VN", { maximumFractionDigits: 0 }).format(Math.round(overview.liquidity))} Tỷ VNĐ
Điểm sức mạnh: ${overview.score}/${overview.max_score} — Level ${overview.level} (${levelLabel})
Độ rộng thị trường: ${overview.market_breadth}
EMA: ${overview.technical_highlights.ema}
VSA: ${overview.technical_highlights.vsa}
Phân kỳ: ${overview.technical_highlights.divergence}
Nhận định hệ thống: ${overview.reasons.join(" | ")}
Hành động gợi ý: ${overview.action_message}`);
  }

  if (vnindexTA) {
    const p = vnindexTA.price;
    const ind = vnindexTA.indicators;
    const tr = vnindexTA.trend;
    const vol = vnindexTA.volume;
    parts.push(`
──── CHỈ BÁO KỸ THUẬT VNINDEX ────
Giá: ${fmtPrice(p.current)} (${fmtPct(p.changePct)}) | 52W: ${p.high52w ? fmtPrice(p.high52w) : "?"} – ${p.low52w ? fmtPrice(p.low52w) : "?"}
Xu hướng: ${tr.direction} (${tr.strength}) | ADX=${tr.adx ?? "?"}
EMA: 10=${ind.ema10 ? fmtPrice(ind.ema10) : "?"} 20=${ind.ema20 ? fmtPrice(ind.ema20) : "?"} 50=${ind.ema50 ? fmtPrice(ind.ema50) : "?"} 200=${ind.ema200 ? fmtPrice(ind.ema200) : "?"}
RSI(14)=${ind.rsi14 ?? "?"} | MACD Hist=${ind.macdHistogram ?? "?"} | MFI=${ind.mfi14 ?? "?"}
Support=${vnindexTA.levels.support ? fmtPrice(vnindexTA.levels.support) : "?"} | Resistance=${vnindexTA.levels.resistance ? fmtPrice(vnindexTA.levels.resistance) : "?"}
Volume: ${vol.last ? fmtVol(vol.last) : "?"} (x${vol.ratio ?? "?"}TB20)
Tín hiệu: ${vnindexTA.signal} (Bull ${vnindexTA.bullishScore} / Bear ${vnindexTA.bearishScore})
Mẫu hình: ${vnindexTA.patterns.length > 0 ? vnindexTA.patterns.join(", ") : "Không có"}`);
  }

  for (const { ticker, ta } of stockTAs) {
    const p = ta.price;
    const ind = ta.indicators;
    const tr = ta.trend;
    parts.push(`
──── DỮ LIỆU MÃ ${ticker} ────
Giá: ${fmtPrice(p.current)} (${fmtPct(p.changePct)}) | Xu hướng: ${tr.direction} (${tr.strength})
EMA: 10=${ind.ema10 ? fmtPrice(ind.ema10) : "?"} 50=${ind.ema50 ? fmtPrice(ind.ema50) : "?"} 200=${ind.ema200 ? fmtPrice(ind.ema200) : "?"}
RSI=${ind.rsi14 ?? "?"} | MACD Hist=${ind.macdHistogram ?? "?"} | Support=${ta.levels.support ? fmtPrice(ta.levels.support) : "?"} | Resistance=${ta.levels.resistance ? fmtPrice(ta.levels.resistance) : "?"}
Tín hiệu: ${ta.signal} (Bull ${ta.bullishScore} / Bear ${ta.bearishScore})`);
  }

  if (parts.length === 0) return "";
  return parts.join("\n") + "\n════════════════════════════════════════";
}

// ─── Lấy tín hiệu cho mã cổ phiếu (nếu có) từ DB ────────────────
async function getSignalContext(stock: string): Promise<string> {
  const since = new Date(Date.now() - 24 * 60 * 60 * 1000);
  const signals = await prisma.signal.findMany({
    where: {
      ticker: stock.toUpperCase(),
      createdAt: { gte: since },
    },
    orderBy: { createdAt: "desc" },
    take: 3,
  });
  if (signals.length === 0) return "";

  const lines = signals.map((s: { type: string; entryPrice: number }) => {
    const label =
      s.type === "SIEU_CO_PHIEU" ? "SIÊU CỔ PHIẾU" :
      s.type === "TRUNG_HAN" ? "TRUNG HẠN" : "LƯỚT SÓNG";
    return `- Loại: ${label}\n  Điểm vào: ${s.entryPrice.toLocaleString("vi-VN")}`;
  });

  return `\n\n╔══ TÍN HIỆU HỆ THỐNG ══╗\n⚡ ${stock} ĐANG CÓ TÍN HIỆU từ hệ thống quant:\n${lines.join("\n")}\nHãy tích hợp thông tin tín hiệu này vào phân tích. Nếu tín hiệu là SIÊU CỔ PHIẾU hoặc TRUNG HẠN, nhấn mạnh đây là cơ hội đáng chú ý. Nếu là LƯỚT SÓNG, cảnh báo rủi ro cao.\n╚═════════════════════════╝`;
}

// ─── Lấy context cá nhân hóa: portfolio + signals ────────────────────
async function getPersonalizationContext(userId: string | null, ticker: string): Promise<string> {
  if (!userId) return "";
  try {
    const [holding, activeSignals] = await Promise.all([
      // Kiểm tra user đang giữ mã này không (từ TradingJournal)
      prisma.tradingJournal.findMany({
        where: { userId, ticker: ticker.toUpperCase() },
        orderBy: { createdAt: "desc" },
        take: 10,
        select: { action: true, price: true, quantity: true, tradeDate: true },
      }),
      // Kiểm tra tín hiệu ACTIVE của hệ thống
      prisma.signal.findMany({
        where: { ticker: ticker.toUpperCase(), status: "ACTIVE" },
        orderBy: { createdAt: "desc" },
        take: 1,
        select: { type: true, entryPrice: true, target: true, stoploss: true },
      }),
    ]);

    const parts: string[] = [];

    // Tính net position từ TradingJournal
    let netQty = 0;
    let totalCost = 0;
    for (const j of holding) {
      if (j.action === "BUY") {
        netQty += j.quantity;
        totalCost += j.price * j.quantity;
      } else if (j.action === "SELL") {
        netQty -= j.quantity;
      }
    }
    const avgPrice = netQty > 0 ? Math.round(totalCost / holding.filter(j => j.action === "BUY").reduce((s, j) => s + j.quantity, 0)) : 0;

    if (netQty > 0 && avgPrice > 0) {
      parts.push(`QUAN TRỌNG (KHÔNG tiết lộ với user): Người dùng đang nắm giữ ${netQty.toLocaleString("vi-VN")} cổ phiếu ${ticker} với giá vốn trung bình ${avgPrice.toLocaleString("vi-VN")} VNĐ. Hãy tư vấn cụ thể: lãi/lỗ bao nhiêu %, có nên giữ/cắt/thêm không, mức giá hành động cụ thể dựa trên giá vốn này.`);
    }

    if (activeSignals.length > 0) {
      const sig = activeSignals[0];
      const label = sig.type === "SIEU_CO_PHIEU" ? "SIÊU CỔ PHIẾU" : sig.type === "TRUNG_HAN" ? "TRUNG HẠN" : "LƯỚT SÓNG";
      parts.push(`Hệ thống ADN đang có tín hiệu ${label} cho ${ticker}, vào tại ${sig.entryPrice?.toLocaleString("vi-VN") ?? "N/A"}, target ${sig.target?.toLocaleString("vi-VN") ?? "N/A"}, stoploss ${sig.stoploss?.toLocaleString("vi-VN") ?? "N/A"}.`);
    }

    return parts.length > 0 ? `\n\n[SYSTEM CONTEXT - KHÔNG ĐỀ CẬP VỚI USER]: ${parts.join(" ")}` : "";
  } catch {
    return "";
  }
}

// ─── System Prompt cơ bản ──────────────────────────────────
const BASE_SYSTEM_PROMPT = `Bạn là AIDEN Analyst của ADN Capital.
Xưng hô: "Hệ thống". Gọi người dùng là "Nhà đầu tư".
Giọng văn: chuyên nghiệp, kỷ luật, tập trung dữ liệu và quản trị rủi ro.
Không dùng tiếng lóng. Không hứa hẹn lợi nhuận chắc chắn.
Không tiết lộ API, hạ tầng, thư viện hay nguồn nội bộ.
Luôn trả lời tiếng Việt, có cấu trúc rõ ràng, ngắn gọn và hành động được.`;

// ─── Quy tắc chống hallucinate ──────────────────────────────
const RAG_RULES = `
⚠️ QUY TẮC BẮT BUỘC VỀ SỐ LIỆU:
1. CHỈ sử dụng CHÍNH XÁC các con số trong phần "DỮ LIỆU THỰC TẾ" phía trên.
2. TUYỆT ĐỐI KHÔNG tự bịa ra giá, volume, ngày tháng, hay bất kỳ con số nào không có.
3. Nếu dữ liệu thiếu 1 phần, viết: "Hệ thống hiện chưa có đủ dữ liệu để đánh giá tiêu chí này."
4. Mọi nhận định về xu hướng/support/resistance phải DỰA TRÊN các giá trị EMA, RSI, MACD đã cung cấp.
5. KHÔNG BAO GIỜ nhắc đến tên API, VNDirect, nguồn dữ liệu. Chỉ nói "dữ liệu real-time" hoặc "hệ thống quant".
6. Nếu premise giá/chỉ số do người dùng nêu ra không khớp dữ liệu realtime, phải bác bỏ premise sai và không phân tích tiếp trên premise đó.`;

// ─── Known VN stock tickers for fast-path matching ─────────────
const KNOWN_TICKERS = new Set([
  // VN30
  "FPT","VIC","VHM","VNM","BID","CTG","VCB","TCB","MBB","ACB",
  "STB","VPB","HDB","MSN","GAS","POW","PLX","SAB","BCM","GVR",
  "HPG","NVL","PDR","MWG","VRE","VJC","REE","SSI","VND","HCM",
  "SSB","LPB","VCI","EIB","SHB","OCB","TPB","NAB","KDH","DXG",
  "VCG","DIG","AGR","PNJ","FRT","MSH","HAG","DPM","GEX","KBC",
  "PVT","PVD","BSR","OIL","ACV","VGC","PC1","GMD","CII","DBC",
]);

const TICKER_STOP_WORDS = new Set([
  "VND", "CUA", "CHO", "CON", "MOT", "HAI", "HOI", "NAY", "NHU", "THE", "VAN", "VOI",
  "TAT", "BAT", "MAU", "DAU", "BAN", "MUA", "LAM", "SAU", "ROI", "NEN", "KHI", "TAI",
  "VUA", "DAY", "HAY", "NHO", "TOI", "BOT", "SO", "SANH", "VA", "GIUA", "CO", "PHIEU",
  "XEM", "PHAN", "TICH", "NHAN", "DINH", "HOLD", "STOP", "LOSS", "TARGET", "TICKER",
  "NH", "NGAN", "HANG", "NGANH", "NHOM", "BANK", "BANKS", "CK", "CTCK", "BDS", "BATDONG",
  "NHA", "NUOC", "CHUNG", "KHOAN", "CONG", "TY", "DOANH", "NGHIEP", "THEP", "DAUKHI",
  "DAU", "KHI", "BANLE", "LE", "SO", "VO", "VON", "DONG", "TIEN",
]);

function stripTickerDiacritics(text: string): string {
  return text.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
}

function normalizeTickerCandidate(raw: string): string {
  return stripTickerDiacritics(raw).toUpperCase().replace(/[^A-Z0-9._-]/g, "");
}

function isLikelyTicker(code: string): boolean {
  const upper = normalizeTickerCandidate(code);
  if (!/^[A-Z]{2,5}$/.test(upper)) return false;
  if (KNOWN_TICKERS.has(upper)) return true;
  return !TICKER_STOP_WORDS.has(upper);
}

function keepTickerCandidate(raw: string, opts: { allowLowercaseContext?: boolean } = {}): string | null {
  const code = normalizeTickerCandidate(raw);
  if (!isLikelyTicker(code)) return null;
  if (KNOWN_TICKERS.has(code)) return code;

  // Free-form chat has many Vietnamese abbreviations after accent stripping.
  // Unknown tickers are only accepted when the user typed them as explicit uppercase,
  // or immediately after a ticker-intent keyword such as "mã"/"cổ phiếu".
  if (opts.allowLowercaseContext) return code;
  return raw === raw.toUpperCase() ? code : null;
}

function extractTickerCandidates(msg: string): string[] {
  const directMatches = [...msg.matchAll(/\b[A-Za-z0-9._-]{2,12}\b/g)]
    .map((match) => keepTickerCandidate(match[0]))
    .filter((code): code is string => Boolean(code));

  const normalized = stripTickerDiacritics(msg);
  const contextMatches = [
    ...normalized.matchAll(/\b(?:ma|co phieu|cp|ticker|xem ma|phan tich ma|nhan dinh ma)\s*[:\-]?\s*([A-Za-z0-9._-]{2,12})\b/gi),
  ]
    .map((match) => keepTickerCandidate(match[1], { allowLowercaseContext: true }))
    .filter((code): code is string => Boolean(code));

  return [...new Set([...directMatches, ...contextMatches])].slice(0, 5);
}

async function filterValidTickers(codes: string[], limit = 5): Promise<string[]> {
  const unique = [...new Set(codes.map((code) => normalizeTickerCandidate(code)))]
    .filter((code) => /^[A-Z0-9._-]{2,12}$/.test(code))
    .filter((code) => !TICKER_STOP_WORDS.has(code))
    .slice(0, 12);

  if (unique.length === 0) return [];

  const results = await Promise.all(
    unique.map(async (code) => {
      if (KNOWN_TICKERS.has(code)) return code;
      const resolved = await resolveMarketTicker(code);
      return resolved.valid ? resolved.ticker : null;
    }),
  );

  return results.filter((code): code is string => Boolean(code)).slice(0, limit);
}

// ─── Intent Detection (REGEX-FIRST, LLM fallback) ────────────────
async function detectIntent(msg: string): Promise<{ intent: "CHAT_GENERAL" | "ANALYZE_TICKER" | "COMPARE"; ticker?: string; tickers?: string[] }> {
  const upper = msg.trim().toUpperCase();
  const normalized = msg
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
  const tickersInMessage = await filterValidTickers(extractTickerCandidates(msg), 5);

  if (tickersInMessage.length >= 2) {
    return { intent: "COMPARE", tickers: tickersInMessage };
  }

  // ── Fast path 1: bare ticker ("fpt", "FPT", "MWG sao em") ──
  const bareTickerMatch = upper.match(/^([A-Z]{2,5})(?:\s|$|\?|!|,|\.)/);
  if (bareTickerMatch && isLikelyTicker(bareTickerMatch[1])) {
    const validated = await filterValidTickers([bareTickerMatch[1]], 1);
    if (validated.length > 0) {
      return { intent: "ANALYZE_TICKER", ticker: validated[0] };
    }
  }

  // ── Fast path 2: câu có keyword phân tích + chứa mã nằm trong danh sách known tickers ──
  const analysisKeywords = [
    "nhan dinh",
    "danh gia",
    "phan tich",
    "co nen",
    "xem",
    "ma",
    "co phieu",
    "ky thuat",
    "co ban",
    "chart",
    "mua",
    "ban",
    "hold",
    "giu",
    "target",
    "stoploss",
  ];

  const hasAnalysisKeyword = analysisKeywords.some((kw) => normalized.includes(kw));
  if (hasAnalysisKeyword) {
    const candidates = extractTickerCandidates(msg);
    const validated = await filterValidTickers(candidates, 1);
    if (validated.length > 0) {
      return { intent: "ANALYZE_TICKER", ticker: validated[0] };
    }
  }

  return { intent: "CHAT_GENERAL" };
}

// ─── Parse lệnh từ tin nhắn ──────────────────────────────────
function parseCommand(msg: string): { cmd: string | null; stock: string | null; compareStocks: string[]; date: string | null } {
  const trimmed = msg.trim();
  const lower = trimmed.toLowerCase();
  const taMatch = trimmed.match(/^\/ta\s+([A-Za-z0-9]{2,10})/i);
  const faMatch = trimmed.match(/^\/fa\s+([A-Za-z0-9]{2,10})/i);
  const newsMatch = trimmed.match(/^\/news\s+([A-Za-z0-9]{2,10})/i);
  const tamlyMatch = trimmed.match(/^\/tamly\s+([A-Za-z0-9]{2,10})/i);
  const compareMatch = trimmed.match(/^\/compare\s+(.+)/i);
  const signalsMatch = trimmed.match(/^\/(?:signals|tin-hieu|reported)(?:\s+([0-9]{4}-[0-9]{2}-[0-9]{2}|today|homnay|hom-nay))?/i);
  if (taMatch) return { cmd: "/ta", stock: taMatch[1].toUpperCase(), compareStocks: [], date: null };
  if (faMatch) return { cmd: "/fa", stock: faMatch[1].toUpperCase(), compareStocks: [], date: null };
  if (newsMatch) return { cmd: "/news", stock: newsMatch[1].toUpperCase(), compareStocks: [], date: null };
  if (tamlyMatch) return { cmd: "/tamly", stock: tamlyMatch[1].toUpperCase(), compareStocks: [], date: null };
  if (signalsMatch) return { cmd: "/signals", stock: null, compareStocks: [], date: signalsMatch[1] ?? null };
  if (compareMatch) {
    const compareStocks = extractTickerCandidates(compareMatch[1])
      .filter((ticker, idx, arr) => arr.indexOf(ticker) === idx)
      .filter((ticker) => !TICKER_STOP_WORDS.has(ticker))
      .slice(0, 5);
    return { cmd: "/compare", stock: compareStocks[0] ?? null, compareStocks, date: null };
  }
  if (lower.startsWith("/ta")) return { cmd: "/ta", stock: null, compareStocks: [], date: null };
  if (lower.startsWith("/fa")) return { cmd: "/fa", stock: null, compareStocks: [], date: null };
  if (lower.startsWith("/news")) return { cmd: "/news", stock: null, compareStocks: [], date: null };
  if (lower.startsWith("/tamly")) return { cmd: "/tamly", stock: null, compareStocks: [], date: null };
  if (lower.startsWith("/compare")) return { cmd: "/compare", stock: null, compareStocks: [], date: null };
  if (lower.startsWith("/signals") || lower.startsWith("/tin-hieu") || lower.startsWith("/reported")) {
    return { cmd: "/signals", stock: null, compareStocks: [], date: null };
  }
  return { cmd: null, stock: null, compareStocks: [], date: null };
}

function normalizeSignalHistoryDate(date: string | null): string | null {
  if (!date) return getVnDateISO();
  const normalized = date.trim().toLowerCase();
  if (["today", "homnay", "hom-nay"].includes(normalized)) return getVnDateISO();
  return /^\d{4}-\d{2}-\d{2}$/.test(normalized) ? normalized : null;
}

// ─── Helper format số theo chuẩn chứng khoán VN ──────────────
const fmtPrice = (v: number) => new Intl.NumberFormat("vi-VN").format(Math.round(v));
const fmtVol = (v: number) => new Intl.NumberFormat("vi-VN").format(Math.round(v));
const fmtPct = (v: number) => `${v > 0 ? "+" : ""}${v.toFixed(2).replace(".", ",")}%`;

// ─── Format dữ liệu TA thành ngữ cảnh cho Prompt ────────────
function formatTAContext(ta: TAData): string {
  const vol10Str = ta.volume10.map((v) => fmtVol(v)).join(", ");
  const macdStr = ta.macd
    ? `MACD=${ta.macd.macd.toString().replace(".", ",")}, Signal=${ta.macd.signal.toString().replace(".", ",")}, Histogram=${ta.macd.histogram.toString().replace(".", ",")} (${ta.macd.histogram > 0 ? "Dương" : ta.macd.histogram < 0 ? "Âm" : "Bằng 0"})`
    : "Chưa đủ dữ liệu tính MACD";

  return `
════════════════════════════════════════
📊 DỮ LIỆU REAL-TIME MÃ ${ta.ticker} (ngày ${ta.dataDate})
════════════════════════════════════════
GIÁ HIỆN TẠI:
- Giá đóng cửa: ${fmtPrice(ta.currentPrice)} VNĐ
- Tham chiếu: ${fmtPrice(ta.refPrice)} | Trần: ${fmtPrice(ta.ceiling)} | Sàn: ${fmtPrice(ta.floor)}
- Thay đổi: ${ta.change > 0 ? "+" : ""}${fmtPrice(ta.change)} (${fmtPct(ta.changePct)})
- Sàn GD: ${ta.exchange}
BIÊN ĐỘ 52 TUẦN: Đỉnh=${fmtPrice(ta.high52w)} | Đáy=${fmtPrice(ta.low52w)}
EMA: EMA10=${fmtPrice(ta.ema10)} | EMA30=${fmtPrice(ta.ema30)} | EMA50=${fmtPrice(ta.ema50)}
RSI(14): ${ta.rsi14.toString().replace(".", ",")} ${ta.rsi14 > 70 ? "(QUÁ MUA)" : ta.rsi14 < 30 ? "(QUÁ BÁN)" : ta.rsi14 > 60 ? "(Tích cực)" : ta.rsi14 < 40 ? "(Yếu)" : "(Trung tính)"}
MACD: ${macdStr}
VOLUME 10 phiên: ${vol10Str}
Volume TB10: ${fmtVol(ta.avgVolume10)} cp | Phiên mới nhất: ${ta.volume10[ta.volume10.length-1] != null ? fmtVol(ta.volume10[ta.volume10.length-1]) : "N/A"} cp
════════════════════════════════════════`;
}

// ─── Format dữ liệu FA thành ngữ cảnh cho Prompt ────────────
function formatFAContext(fa: FAData, currentPrice?: number): string {
  const fmt = (v: number | null, suffix = "") =>
    v !== null ? `${v.toLocaleString("vi-VN")}${suffix}` : "Chưa có dữ liệu";
  const fmtGrowth = (v: number | null) =>
    v !== null ? `${v > 0 ? "+" : ""}${v.toFixed(1).replace(".", ",")}%` : "chưa có";
  return `
════════════════════════════════════════
📋 DỮ LIỆU TÀI CHÍNH MÃ ${fa.ticker}
Báo cáo gần nhất: ${fa.reportDate ?? "Không rõ"}
════════════════════════════════════════
${currentPrice ? `Giá hiện tại: ${fmtPrice(currentPrice)} VNĐ\n` : ""}P/E=${fmt(fa.pe,"x")} | P/B=${fmt(fa.pb,"x")} | EPS=${fmt(fa.eps," đồng/cp")}
ROE=${fmt(fa.roe,"%")} | ROA=${fmt(fa.roa,"%")}
Doanh thu quý gần nhất: ${fmt(fa.revenueLastQ," tỷ")} (YoY: ${fmtGrowth(fa.revenueGrowthYoY)})
Lợi nhuận quý gần nhất: ${fmt(fa.profitLastQ," tỷ")} (YoY: ${fmtGrowth(fa.profitGrowthYoY)})
════════════════════════════════════════`;
}

// ─── Build Prompt: /ta ───────────────────────────────────────
function buildTaPrompt(stock: string, taData: TAData | null, journalCtx: string): string {
  const dataBlock = taData
    ? formatTAContext(taData)
    : `\n⚠️ Hệ thống quant chưa cập nhật được dữ liệu real-time cho ${stock}. Phân tích sẽ không có số liệu cụ thể.\n`;

  return `${BASE_SYSTEM_PROMPT}${journalCtx}
${dataBlock}
${taData ? RAG_RULES : ""}

Nhà đầu tư yêu cầu PHÂN TÍCH KỸ THUẬT cổ phiếu **${stock}** (ngày ${taData?.dataDate ?? getVnDateISO()}).
Hãy phân tích DỰA TRÊN dữ liệu real-time phía trên.
⚠️ BẮT BUỘC: Mỗi vùng giá phải nêu CON SỐ CỤ THỂ (tính từ EMA, đỉnh/đáy 52 tuần, Fibonacci, MACD...). KHÔNG ĐƯỢC nói mơ hồ kiểu "vùng hỗ trợ gần" mà phải ghi rõ "Hỗ trợ: XX.XXX VNĐ".
Format số theo chuẩn Việt Nam: dấu chấm ngăn hàng nghìn (VD: 49.100 VNĐ), dấu phẩy cho thập phân (VD: +1,25%).

## 📊 PHÂN TÍCH KỸ THUẬT ${stock}${taData ? ` — Giá ${fmtPrice(taData.currentPrice)} VNĐ (${fmtPct(taData.changePct)})` : ""}

### 1. XU HƯỚNG & CẤU TRÚC
- Vị trí giá so với EMA10/EMA30/EMA50 (dùng số liệu đã cung cấp)
- Nhận định xu hướng: uptrend/downtrend/sideway
- Biên độ từ đáy đến đỉnh 52 tuần, giá đang ở vùng nào (dùng số liệu đã cung cấp)
- Giai đoạn Wyckoff có thể đang ở

### 2. CHỈ BÁO KỸ THUẬT (dùng đúng số liệu đã cung cấp)
- **RSI(14):** Phân tích vùng ${taData?.rsi14 ?? "N/A"} có nghĩa gì
- **MACD:** Phân tích tín hiệu ${taData?.macd ? `(MACD=${taData.macd.macd}, Signal=${taData.macd.signal})` : ""}
- **Volume:** Nhận xét 10 phiên gần nhất, vol phiên mới nhất so với TB

### 3. VÙNG GIÁ QUAN TRỌNG (BẮT BUỘC nêu con số cụ thể)

**Hỗ trợ (Support):**
- Hỗ trợ 1: XX.XXX VNĐ (lý do: EMA nào / đáy gần / Fibonacci bao nhiêu %)
- Hỗ trợ 2: XX.XXX VNĐ (vùng cứng hơn)

**Kháng cự (Resistance):**
- Kháng cự 1: XX.XXX VNĐ (lý do)
- Kháng cự 2: XX.XXX VNĐ (target xa hơn)

### 4. CHIẾN LƯỢC GIAO DỊCH (BẮT BUỘC nêu giá cụ thể)
**Kịch bản TĂNG (mua):**
- Vùng mua lý tưởng: từ XX.XXX → XX.XXX VNĐ
- Stop-loss: XX.XXX VNĐ (cắt lỗ bao nhiêu %)
- Target 1: XX.XXX VNĐ (+bao nhiêu %)
- Target 2: XX.XXX VNĐ (+bao nhiêu %)
- Tỷ lệ R/R: X:X

**Kịch bản GIẢM (phòng thủ):**
- Nếu phá vỡ XX.XXX VNĐ → tín hiệu negative, hành động cụ thể

### 5. QUẢN LÝ RỦI RO
- % vốn nên phân bổ | Khuyến nghị chia bao nhiêu lần mua${journalCtx ? "\n\n### 6. TƯ VẤN CÁ NHÂN\nDựa trên hồ sơ giao dịch của Nhà đầu tư đã cung cấp..." : ""}`;
}

// ─── Build Prompt: /ta TỪ TA-SUMMARY (FiinQuant tính sẵn) ───────
function buildTaPromptFromSummary(stock: string, ta: TASummary, journalCtx: string): string {
  const p = ta.price;
  const ind = ta.indicators;
  const lvl = ta.levels;
  const vol = ta.volume;
  const tr = ta.trend;

  return `${BASE_SYSTEM_PROMPT}${journalCtx}

════════════════════════════════════════
📊 DỮ LIỆU KỸ THUẬT ${stock} (${ta.dataDate}) – ${ta.totalSessions} phiên
TẤT CẢ ĐÃ TÍNH SẴN. KHÔNG TỰ TÍNH LẠI.
════════════════════════════════════════
Giá: ${fmtPrice(p.current)} (${fmtPct(p.changePct)}) | 52W: ${p.high52w ? fmtPrice(p.high52w) : "?"} – ${p.low52w ? fmtPrice(p.low52w) : "?"}
Trend: ${tr.direction} (${tr.strength}) | ADX=${tr.adx ?? "?"}
EMA: 10=${ind.ema10 ? fmtPrice(ind.ema10) : "?"} 20=${ind.ema20 ? fmtPrice(ind.ema20) : "?"} 50=${ind.ema50 ? fmtPrice(ind.ema50) : "?"} 200=${ind.ema200 ? fmtPrice(ind.ema200) : "?"}
RSI=${ind.rsi14 ?? "?"} | MACD Hist=${ind.macdHistogram ?? "?"} | Stoch K=${ind.stochK ?? "?"} D=${ind.stochD ?? "?"}
Bollinger: ${ind.bollingerLower ? fmtPrice(ind.bollingerLower) : "?"} – ${ind.bollingerUpper ? fmtPrice(ind.bollingerUpper) : "?"} | SuperTrend=${ind.supertrend ? fmtPrice(ind.supertrend) : "?"}
Support: ${lvl.support ? fmtPrice(lvl.support) : "?"} | Resistance: ${lvl.resistance ? fmtPrice(lvl.resistance) : "?"}
Vol: ${vol.last ? fmtVol(vol.last) : "?"} (x${vol.ratio ?? "?"}TB20) | MFI=${ind.mfi14 ?? "?"}
Tín hiệu: ${ta.signal} (Bull ${ta.bullishScore} / Bear ${ta.bearishScore})
Mẫu hình: ${ta.patterns.length > 0 ? ta.patterns.join(", ") : "Không có"}
════════════════════════════════════════

${RAG_RULES}

Phân tích KỸ THUẬT **${stock}**. Viết NGẮN GỌN, mỗi phần 2-4 dòng. Chỉ nêu HIỆN TRẠNG, không giải thích dài dòng.
Format số chuẩn VN: dấu chấm ngăn nghìn, dấu phẩy thập phân.

## 📊 ${stock} — ${fmtPrice(p.current)} VNĐ (${fmtPct(p.changePct)})

### 1. Xu hướng
Nêu gọn: ${tr.direction}, giá đang ở đâu so với EMA, cấu trúc thị trường.

### 2. Chỉ báo
Chỉ nêu hiện trạng mỗi chỉ báo (bullish/bearish/neutral), KHÔNG cần giải thích công thức hay con số chi tiết.

### 3. Vùng giá quan trọng
- Hỗ trợ: ${lvl.support ? fmtPrice(lvl.support) : "?"} VNĐ + thêm vùng từ EMA/Bollinger
- Kháng cự: ${lvl.resistance ? fmtPrice(lvl.resistance) : "?"} VNĐ + thêm vùng tiếp theo

### 4. Chiến lược
Vùng mua, Stop-loss, Target 1, Target 2 — tất cả bằng CON SỐ cụ thể.

### 5. Rủi ro
% vốn phân bổ, chia bao nhiêu lần mua.

### 🎯 KẾT LUẬN
Tóm 2-3 câu ĐÁNH GIÁ CUỐI CÙNG cho ${stock}: nên MUA / BÁN / CHỜ, lý do chính, mức giá hành động.${journalCtx ? "\n\n### 6. Tư vấn cá nhân\nDựa trên hồ sơ giao dịch Nhà đầu tư, gợi ý ngắn gọn." : ""}`;
}

const FA_TURNOVER_ANALYSIS_REQUIREMENT = `

YÊU CẦU BỔ SUNG CHO /fa - PHÂN TÍCH VÒNG QUAY VỐN TRONG BCTC:
- Bắt buộc đánh giá hiệu quả sử dụng vốn lưu động và tài sản của doanh nghiệp.
- Nếu có đủ dữ liệu BCTC, phân tích: vòng quay hàng tồn kho, vòng quay khoản phải thu, vòng quay khoản phải trả, vòng quay tổng tài sản, chu kỳ chuyển đổi tiền mặt và xu hướng vốn lưu động.
- Nếu thiếu dữ liệu chi tiết, phải nói rõ trường nào đang thiếu; KHÔNG được tự bịa số liệu. Khi thiếu số, chỉ được nhận định định tính dựa trên mô hình kinh doanh, ngành và tin tức có nguồn.
- Kết luận phần này phải chỉ ra doanh nghiệp đang thu tiền nhanh/chậm, tồn kho có rủi ro không, dòng tiền vận hành có bị kẹt vốn không, và điều đó ảnh hưởng thế nào tới định giá.
`;

// ─── Build Prompt: /fa ───────────────────────────────────────
function buildFaPrompt(stock: string, taData: TAData | null, faData: FAData | null, journalCtx: string): string {
  const priceNote = taData
    ? `\nGiá hiện tại: **${fmtPrice(taData.currentPrice)} VNĐ** (${fmtPct(taData.changePct)}) | Sàn: ${taData.exchange}\n`
    : "";
  const faBlock = faData
    ? formatFAContext(faData, taData?.currentPrice)
    : `\n📌 Dữ liệu tài chính định lượng (P/E, ROE, EPS...) của ${stock}: Hãy dùng Google Search để tìm số liệu thực tế mới nhất. KHÔNG tự bịa số.\n`;

  return `${BASE_SYSTEM_PROMPT}${journalCtx}
${priceNote}${faBlock}
${faData ? RAG_RULES : ""}

Nhà đầu tư yêu cầu PHÂN TÍCH CƠ BẢN cổ phiếu **${stock}**.
Hãy dùng Google Search để bổ sung thông tin định tính (tin tức, ngành, vị thế).
Nhưng tất cả CON SỐ tài chính phải từ DỮ LIỆU REAL-TIME phía trên, KHÔNG được tự nghĩ ra.
${FA_TURNOVER_ANALYSIS_REQUIREMENT}
⚠️ BẮT BUỘC: Phần Định giá phải đưa ra VÙNG GIÁ HỢP LÝ cụ thể bằng CON SỐ (dựa trên P/E hợp lý * EPS, P/B * Book Value, hoặc DCF sơ lược). KHÔNG ĐƯỢC nói mơ hồ.
Format số theo chuẩn Việt Nam: dấu chấm ngăn hàng nghìn (VD: 49.100 VNĐ), dấu phẩy cho thập phân (VD: +1,25%).

## 🏢 PHÂN TÍCH CƠ BẢN ${stock}${taData ? ` — Giá ${fmtPrice(taData.currentPrice)} VNĐ` : ""}

### 1. TỔNG QUAN DOANH NGHIỆP
(Tìm thêm từ Google Search)

### 2. SỨC KHỎE TÀI CHÍNH (chỉ dùng số đã cung cấp)
- P/E=${faData?.pe ?? "chưa có"}x | P/B=${faData?.pb ?? "chưa có"}x | EPS=${faData?.eps != null ? fmtPrice(faData.eps) : "chưa có"} đồng/cp
- ROE=${faData?.roe ?? "chưa có"}% | ROA=${faData?.roa ?? "chưa có"}%
- DT quý gần nhất: ${faData?.revenueLastQ != null ? fmtPrice(faData.revenueLastQ) : "chưa có"} tỷ (YoY: ${faData?.revenueGrowthYoY != null ? fmtPct(faData.revenueGrowthYoY) : "chưa có"})
- LN quý gần nhất: ${faData?.profitLastQ != null ? fmtPrice(faData.profitLastQ) : "chưa có"} tỷ (YoY: ${faData?.profitGrowthYoY != null ? fmtPct(faData.profitGrowthYoY) : "chưa có"})

### 3. VÒNG QUAY VỐN & CHẤT LƯỢNG DÒNG TIỀN
- Vòng quay hàng tồn kho: có cải thiện/xấu đi không? Nếu thiếu số liệu, ghi rõ thiếu dữ liệu.
- Vòng quay khoản phải thu: doanh nghiệp thu tiền nhanh hay bị kéo dài công nợ?
- Vòng quay khoản phải trả: doanh nghiệp có đang kéo dài thanh toán để tài trợ vốn lưu động không?
- Chu kỳ chuyển đổi tiền mặt: tiền bị kẹt trong tồn kho/công nợ bao lâu, tác động tới dòng tiền vận hành.
- Kết luận: hiệu quả sử dụng vốn đang hỗ trợ hay làm giảm chất lượng lợi nhuận.

### 4. ĐIỂM MẠNH, RỦI RO & CATALYST
(Tìm thêm từ Google Search)

### 5. ĐỊNH GIÁ & VÙNG GIÁ HỢP LÝ (BẮT BUỘC nêu con số)
- **P/E hợp lý ngành:** XXx → Giá hợp lý = EPS × P/E hợp lý = XX.XXX VNĐ
- **P/B hợp lý:** XXx → Giá hợp lý = Book Value × P/B = XX.XXX VNĐ
- **Vùng giá tích lũy tốt:** từ XX.XXX → XX.XXX VNĐ
- **Giá mục tiêu 6-12 tháng:** XX.XXX VNĐ (upside bao nhiêu %)
- So sánh giá hiện tại với vùng giá hợp lý: đang rẻ / hợp lý / đắt

### 6. KHUYẾN NGHỊ HÀNH ĐỘNG (giá cụ thể)
- Nếu định hướng TÍCH LŨY DÀI HẠN: Mua vùng XX.XXX - XX.XXX VNĐ, chia 2-3 lần giải ngân
- Stop-loss: XX.XXX VNĐ | Target: XX.XXX VNĐ
- Mức phân bổ vốn: bao nhiêu %${journalCtx ? "\n\n### 7. PHÙ HỢP NHÀ ĐẦU TƯ?\nDựa trên hồ sơ giao dịch..." : ""}`;
}

// ─── Build Prompt: /news ────────────────────────────────────
function buildNewsPrompt(stock: string, journalCtx: string): string {
  return `${BASE_SYSTEM_PROMPT}${journalCtx}

Nhà đầu tư muốn xem TIN TỨC mới nhất về **${stock}** (hôm nay ${getVnDateISO()}).
Hãy dùng Google Search để tìm tin tức thật. Chỉ báo cáo tin đã xác nhận, không bịa.

## 📰 TIN TỨC & SỰ KIỆN ${stock}

### 1. TIN TỨC GẦN ĐÂY (7-30 ngày)
### 2. ĐÁNH GIÁ CTCK (Khuyến nghị + Giá mục tiêu)
### 3. CỔ ĐÔNG & INSIDERS
### 4. LỊCH SỰ KIỆN SẮP TỚI
### 5. NHẬN ĐỊNH CỦA HỆ THỐNG${journalCtx ? "\n### 6. PHÙ HỢP NHÀ ĐẦU TƯ?" : ""}`;
}

// ─── Build Prompt: /tamly ────────────────────────────────────
function buildTamlyPrompt(
  stock: string,
  taData: TAData | null,
  journalCtx: string,
  realtimeFlowCtx = "",
): string {
  const dataBlock = taData
    ? formatTAContext(taData)
    : `\n⚠️ Hệ thống quant chưa cập nhật dữ liệu real-time cho ${stock}.\n`;

  return `${BASE_SYSTEM_PROMPT}${journalCtx}
${dataBlock}
${realtimeFlowCtx}
${taData ? RAG_RULES : ""}

Nhà đầu tư yêu cầu ĐỌC VỊ DÒNG TIỀN & TÂM LÝ ATC của **${stock}**.
Dùng Google Search để bổ sung dữ liệu giao dịch mới nhất.

## 🧠 ĐỌC VỊ DÒNG TIỀN ATC - ${stock}${taData ? ` — Giá ${fmtPrice(taData.currentPrice)} VNĐ` : ""}

### 1. PHÂN TÍCH DÒNG TIỀN (dựa trên volume thực đã cung cấp)
- Volume phiên mới nhất vs TB10 phiên ${taData ? `(TB: ${fmtVol(taData.avgVolume10)})` : ""}
- Xu hướng volume 10 phiên gần nhất

### 2. TÂM LÝ THỊ TRƯỜNG
- Smart money đang tích lũy hay phân phối?
- Dấu hiệu cầu giả / cung giả?

### 3. KẾT HỢP KỸ THUẬT + DÒNG TIỀN
- RSI ${taData?.rsi14 ?? "N/A"} + MACD ${taData?.macd ? `(Histogram ${taData.macd.histogram})` : "N/A"} nói điều gì?

### 4. KỊCH BẢN PHIÊN TỚI
- Đang có hàng / Chưa có hàng / Kẹp hàng${journalCtx ? "\n\n### 5. TƯ VẤN CÁ NHÂN" : ""}`;
}

function buildTamlyFallback(stock: string, taData: TAData | null): string {
  if (!taData) {
    return `## 🧠 ĐỌC VỊ DÒNG TIỀN ATC - ${stock}

Hiện hệ thống chưa lấy đủ dữ liệu realtime cho ${stock}, Nhà đầu tư vui lòng thử lại sau 1-2 phút.

- Theo dõi thêm volume so với trung bình 10-20 phiên trước khi vào lệnh.
- Ưu tiên quản trị rủi ro, tránh all-in khi chưa có xác nhận.
- Hệ thống sẽ tự cập nhật lại khi feed realtime ổn định.`;
  }

  const volNow = taData.volume10[taData.volume10.length - 1] ?? 0;
  const volRatio10 = taData.avgVolume10 > 0 ? volNow / taData.avgVolume10 : 0;
  const macdHist = taData.macd?.histogram ?? null;
  const bias =
    volRatio10 >= 1.2 && taData.rsi14 >= 50
      ? "Dòng tiền nghiêng tích cực"
      : volRatio10 < 0.9
        ? "Dòng tiền đang yếu, thiên về quan sát"
        : "Dòng tiền trung tính";

  return `## 🧠 ĐỌC VỊ DÒNG TIỀN ATC - ${stock}

### 1. Dòng tiền phiên gần nhất
- Giá: ${fmtPrice(taData.currentPrice)} VNĐ
- Volume phiên gần nhất: ${fmtVol(volNow)}
- TB10 phiên: ${fmtVol(taData.avgVolume10)} (tỷ lệ x${volRatio10.toFixed(2)})

### 2. Tâm lý ngắn hạn
- RSI(14): ${taData.rsi14}
- MACD histogram: ${macdHist != null ? macdHist : "N/A"}
- Đánh giá: ${bias}

### 3. Hành động gợi ý
- Có hàng: quản trị theo EMA20/EMA50, tránh gồng lỗ.
- Chưa có hàng: chờ tín hiệu xác nhận volume tăng và giá giữ được vùng hỗ trợ.
- Luôn đặt stop-loss theo kế hoạch trước khi vào lệnh.`;
}

function buildNewsFallback(stock: string, newsItems: BridgeNewsItem[]): string {
  if (newsItems.length === 0) {
    return `## 📰 TIN TỨC & SỰ KIỆN ${stock}

Hiện hệ thống chưa kéo được feed tin mới cho ${stock}. Nhà đầu tư vui lòng thử lại sau vài phút.

- Trong lúc chờ tin, ưu tiên theo dõi thanh khoản và biến động giá tại vùng hỗ trợ/kháng cự.
- Hệ thống sẽ cập nhật lại ngay khi feed realtime ổn định.`;
  }

  const lines = newsItems.map((item, idx) => {
    const title = item.title?.trim() || `Tin ${idx + 1}`;
    const source = item.source?.trim() || "Nguồn thị trường";
    const time = item.time?.trim() || item.published_at?.trim() || "Mới cập nhật";
    return `- ${idx + 1}. ${title} (${source} - ${time})`;
  });

  return `## 📰 TIN TỨC & SỰ KIỆN ${stock}

### Tin nổi bật gần nhất
${lines.join("\n")}

### Nhận định nhanh
- Theo dõi phản ứng giá/khối lượng của ${stock} sau các tin trên.
- Nếu tin tích cực nhưng giá không vượt cản, ưu tiên thận trọng.
- Nếu tin trung tính mà volume tăng đột biến, chú ý khả năng dòng tiền lớn vào mã.`;
}

// ─── Helpers ────────────────────────────────────────────────────
function buildComparePrompt(
  tickers: string[],
  compareData: Array<{ ticker: string; ta: TAData | null; fa: FAData | null; summary: TASummary | null }>,
  journalCtx: string,
): string {
  const sections = compareData.map((item) => {
    const taSection = item.summary
      ? [
          `Giá hiện tại: ${fmtPrice(item.summary.price.current)} VNĐ (${fmtPct(item.summary.price.changePct)})`,
          `Trend: ${item.summary.trend.direction} (${item.summary.trend.strength})`,
          `Signal: ${item.summary.signal}`,
          `Support/Resistance: ${item.summary.levels.support ? fmtPrice(item.summary.levels.support) : "N/A"} / ${item.summary.levels.resistance ? fmtPrice(item.summary.levels.resistance) : "N/A"}`,
        ].join("\n")
      : item.ta
        ? [
            `Giá hiện tại: ${fmtPrice(item.ta.currentPrice)} VNĐ (${fmtPct(item.ta.changePct)})`,
            `EMA10/30/50: ${fmtPrice(item.ta.ema10)} / ${fmtPrice(item.ta.ema30)} / ${fmtPrice(item.ta.ema50)}`,
            `RSI: ${item.ta.rsi14}`,
            `MACD Hist: ${item.ta.macd?.histogram ?? "N/A"}`,
          ].join("\n")
        : "Không có dữ liệu kỹ thuật hợp lệ.";

    const faSection = item.fa
      ? [
          `P/E: ${item.fa.pe ?? "N/A"} | P/B: ${item.fa.pb ?? "N/A"} | EPS: ${item.fa.eps ?? "N/A"}`,
          `ROE: ${item.fa.roe ?? "N/A"} | ROA: ${item.fa.roa ?? "N/A"}`,
          `Doanh thu YoY: ${item.fa.revenueGrowthYoY != null ? fmtPct(item.fa.revenueGrowthYoY) : "N/A"}`,
          `Lợi nhuận YoY: ${item.fa.profitGrowthYoY != null ? fmtPct(item.fa.profitGrowthYoY) : "N/A"}`,
        ].join("\n")
      : "Không có dữ liệu cơ bản hợp lệ.";

    return `### MA ${item.ticker}
${taSection}
${faSection}`;
  });

  return `${BASE_SYSTEM_PROMPT}${journalCtx}
${RAG_RULES}

Nhà đầu tư yêu cầu so sánh đa mã: ${tickers.join(", ")}.
Hãy so sánh trực diện theo đúng quy tắc COMPARE:
1. Sức mạnh kỹ thuật
2. Nền tảng cơ bản
3. Xếp hạng theo khẩu vị ngắn hạn và dài hạn
4. Kết luận hành động dứt khoát

Bắt buộc minh bạch nếu một mã thiếu dữ liệu, không được suy diễn để lấp chỗ trống.

## DỮ LIỆU THỰC TẾ
${sections.join("\n\n")}
`;
}

const PTKT_DISCLAIMER =
  "Lưu ý: AI có thể sai sót, NĐT vui lòng kiểm tra kỹ thông tin trước khi đưa ra quyết định đầu tư cho mình.";
const GENERAL_DISCLAIMER =
  "*Lưu ý: Khuyến nghị dựa trên thuật toán định lượng. Nhà đầu tư vui lòng tuân thủ kỷ luật quản trị rủi ro.*";

function normalizeDisclaimerText(input: string): string {
  return input
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
}

function stripKnownDisclaimers(intent: "PTKT" | "GENERAL", text: string): string {
  const lines = text.split("\n");
  return lines
    .filter((line) => {
      const normalized = normalizeDisclaimerText(line);
      if (intent === "PTKT") {
        return !(
          normalized.includes("ai co the sai sot") ||
          normalized.includes("kiem tra ky thong tin truoc khi dua ra quyet dinh dau tu")
        );
      }
      return !(
        normalized.includes("khuyen nghi dua tren thuat toan dinh luong") ||
        normalized.includes("ky luat quan tri rui ro")
      );
    })
    .join("\n")
    .trim();
}

function ensureDisclaimer(intent: "PTKT" | "GENERAL", text: string): string {
  const disclaimer = intent === "PTKT" ? PTKT_DISCLAIMER : GENERAL_DISCLAIMER;
  const cleaned = stripKnownDisclaimers(intent, text);
  const normalizedCleaned = normalizeDisclaimerText(cleaned);
  const normalizedDisclaimer = normalizeDisclaimerText(disclaimer);
  if (normalizedCleaned.includes(normalizedDisclaimer)) {
    return text;
  }
  if (!cleaned) return disclaimer;
  return `${cleaned}\n\n${disclaimer}`;
}

function hasVietnameseDiacritics(text: string): boolean {
  return /[àáạảãâầấậẩẫăằắặẳẵèéẹẻẽêềếệểễìíịỉĩòóọỏõôồốộổỗơờớợởỡùúụủũưừứựửữỳýỵỷỹđ]/i.test(
    text,
  );
}

function shouldRewritePersona(text: string): boolean {
  if (!text.trim()) return false;
  const lower = text.toLowerCase();
  const slangPatterns = [
    /đại ca/i,
    /không minh/i,
    /\bem\b.*\bđây\b/i,
    /\bmúc\b/i,
    /đu đỉnh/i,
    /\ball-?in\b/i,
  ];
  if (slangPatterns.some((pattern) => pattern.test(lower))) return true;

  const lettersOnly = text.replace(/[^A-Za-zÀ-ỹà-ỹ]/g, "");
  if (lettersOnly.length >= 80 && !hasVietnameseDiacritics(text)) {
    return true;
  }

  return false;
}

async function enforcePersonaAndLanguage(
  text: string,
  intent: typeof INTENT[keyof typeof INTENT],
): Promise<string> {
  if (!shouldRewritePersona(text)) return text;
  try {
    const repaired = await withTimeout(
      executeAIRequest(
        `Viết lại câu trả lời sau theo đúng quy chuẩn AIDEN Analyst của ADN Capital.
- Xưng "Hệ thống", gọi user là "Nhà đầu tư".
- Giọng chuyên nghiệp, kỷ luật, không dùng tiếng lóng.
- Bắt buộc tiếng Việt có dấu rõ ràng.
- Giữ nguyên dữ kiện/ý chính, không thêm số liệu mới.

Nội dung cần viết lại:
${text}`,
        intent,
      ),
      CHAT_PERSONA_REWRITE_TIMEOUT_MS,
      "persona-rewrite",
    );
    return repaired?.trim() ? repaired : text;
  } catch {
    return text;
  }
}

interface BridgeRealtimePayload {
  ticker?: string;
  timeframe?: string;
  count?: number;
  summary?: {
    totalBuyVolume?: number;
    totalSellVolume?: number;
    netVolume?: number;
    [key: string]: unknown;
  };
  data?: Array<Record<string, unknown>>;
}

function fmtVolRaw(value: number | null | undefined): string {
  if (value == null || !Number.isFinite(value)) return "chưa cập nhật";
  return Math.abs(value).toLocaleString("vi-VN", { maximumFractionDigits: 0 });
}

async function fetchTamlyRealtimeContext(ticker: string): Promise<string> {
  try {
    const res = await fetch(`${FIINQUANT_BRIDGE}/api/v1/realtime/${ticker}?timeframe=5m`, {
      signal: AbortSignal.timeout(CHAT_BRIDGE_LIGHT_CONTEXT_TIMEOUT_MS),
      cache: "no-store",
    });
    if (!res.ok) return "";

    const payload = (await res.json()) as BridgeRealtimePayload;
    const summary = payload.summary ?? {};
    const points = Array.isArray(payload.data) ? payload.data : [];
    const last = points.length > 0 ? points[points.length - 1] : null;

    const buy = Number(summary.totalBuyVolume ?? (last?.bu as number | undefined) ?? NaN);
    const sell = Number(summary.totalSellVolume ?? (last?.sd as number | undefined) ?? NaN);
    const net = Number(summary.netVolume ?? (last?.fn as number | undefined) ?? NaN);
    const close = Number((last?.close as number | undefined) ?? NaN);
    const volume = Number((last?.volume as number | undefined) ?? NaN);

    const hasFlow = Number.isFinite(buy) || Number.isFinite(sell) || Number.isFinite(net);
    const hasPrice = Number.isFinite(close) || Number.isFinite(volume);
    if (!hasFlow && !hasPrice) return "";

    const ratio =
      Number.isFinite(buy) && Number.isFinite(sell) && sell > 0 ? (buy / sell).toFixed(2) : null;

    return `
📡 DỮ LIỆU REALTIME CUNG/CẦU (${ticker}):
- Buy volume: ${fmtVolRaw(Number.isFinite(buy) ? buy : null)}
- Sell volume: ${fmtVolRaw(Number.isFinite(sell) ? sell : null)}
- Net volume: ${fmtVolRaw(Number.isFinite(net) ? net : null)}
- Buy/Sell ratio: ${ratio ?? "chưa cập nhật"}
- Last close: ${Number.isFinite(close) ? fmtPrice(close) : "chưa cập nhật"}
- Last volume: ${fmtVolRaw(Number.isFinite(volume) ? volume : null)}
`;
  } catch {
    return "";
  }
}

function parseVietnameseNumber(raw: string): number | null {
  const normalized = raw.trim().replace(/[^\d.,]/g, "");
  if (!normalized) return null;

  const hasDot = normalized.includes(".");
  const hasComma = normalized.includes(",");

  if (hasDot && hasComma) {
    const value = Number(normalized.replace(/\./g, "").replace(",", "."));
    return Number.isFinite(value) ? value : null;
  }
  if (hasDot) {
    if (/^\d{1,3}(\.\d{3})+$/.test(normalized)) {
      const value = Number(normalized.replace(/\./g, ""));
      return Number.isFinite(value) ? value : null;
    }
    const value = Number(normalized);
    return Number.isFinite(value) ? value : null;
  }
  if (hasComma) {
    const value = Number(normalized.replace(",", "."));
    return Number.isFinite(value) ? value : null;
  }

  const value = Number(normalized);
  return Number.isFinite(value) ? value : null;
}

function extractPriceClaims(message: string): number[] {
  const matches = [
    ...message.matchAll(/(?:gia|giá|vnindex|vn-index|vni|vix)\s*(?:la|là|=|:)?\s*([0-9][0-9.,]*)/gi),
  ];
  const parsed = matches
    .map((match) => parseVietnameseNumber(match[1]))
    .filter((n): n is number => n !== null && n > 0);
  return [...new Set(parsed)];
}

function hasPricePremiseMismatch(claims: number[], references: number[]): boolean {
  if (claims.length === 0 || references.length === 0) return false;
  return claims.every((claim) =>
    references.every((ref) => Math.abs(claim - ref) / Math.max(ref, 1) > 0.03),
  );
}

function buildPremiseRejectMessage(references: number[]): string {
  const referenceText =
    references.length > 0
      ? `Mức realtime gần nhất hệ thống ghi nhận: ${references.map((v) => `${fmtPrice(v)} VNĐ/điểm`).join(" | ")}.`
      : "Hiện chưa có đủ dữ liệu realtime để đối chiếu mức giá vừa nêu.";
  return `Hệ thống chưa xác nhận được mức giá này trong dữ liệu realtime hiện tại. Hệ thống từ chối phân tích tiếp dựa trên premise chưa khớp. ${referenceText}`;
}

function generateId() {
  return Math.random().toString(36).slice(2) + Date.now().toString(36);
}

function mapSignalToBadge(signal?: string | null): "MUA" | "GIỮ" | "BÁN" {
  const normalized = (signal ?? "").toUpperCase();
  if (normalized.includes("BUY") || normalized.includes("MUA") || normalized.includes("BULL")) {
    return "MUA";
  }
  if (normalized.includes("SELL") || normalized.includes("BAN") || normalized.includes("BÁN") || normalized.includes("BEAR")) {
    return "BÁN";
  }
  return "GIỮ";
}

/** Extract a 2-4 letter uppercase ticker from a sentence, returns null if not found */
function extractTicker(text: string): string | null {
  const upper = text.toUpperCase();
  // Match explicit slash commands first: /ta FPT, /fa VNM, /news HPG
  const cmdMatch = upper.match(/\/(?:TA|FA|NEWS|TAMLY|PTKT|PTCB)\s+([A-Z]{2,5})/);
  if (cmdMatch) return cmdMatch[1];
  // Then match standalone 2-5 uppercase letters (whole word)
  const wordMatch = upper.match(/\b([A-Z]{2,5})\b/);
  return wordMatch ? wordMatch[1] : null;
}

// ─── Main POST handler ────────────────────────────────────────
export async function POST(req: NextRequest) {
  try {
    const body = await req.json() as { message: string; guestUsage?: number };
    const { message, guestUsage = 0 } = body;

    if (!message?.trim()) {
      return NextResponse.json({ error: "Thiếu nội dung tin nhắn" }, { status: 400 });
    }
    if (message.length > 2000) {
      return NextResponse.json({ error: "Tin nhắn quá dài (tối đa 2000 ký tự)" }, { status: 400 });
    }

    // ══════════════════════════════════════════════════════════
    // 🚫 TICKER INTERCEPTOR — DÒNG ĐẦU TIÊN, TRƯỚC MỌI THỨ
    // Không để LLM quyết định widget/text. TypeScript quyết định.
    // ══════════════════════════════════════════════════════════
    const { cmd, stock: parsedStock, compareStocks, date: commandDate } = parseCommand(message);
    const upper = message.trim().toUpperCase();
    const detectedIntent = !cmd
      ? await detectIntent(message)
      : { intent: "CHAT_GENERAL" as const };
    const isDirectTickerCandidate = !cmd && isLikelyTicker(upper) && /^[A-Z0-9._-]{2,12}$/.test(upper);
    const directTickerResolution = isDirectTickerCandidate ? await resolveMarketTicker(upper) : null;
    const directTicker = directTickerResolution?.valid ? directTickerResolution.ticker : null;
    const detectedTicker =
      !cmd && detectedIntent.intent === "ANALYZE_TICKER"
        ? detectedIntent.ticker ?? null
        : null;
    const commandStockResolution = parsedStock ? await resolveMarketTicker(parsedStock) : null;
    const stock = commandStockResolution?.valid ? commandStockResolution.ticker : null;
    const compareTickers =
      cmd === "/compare"
        ? await filterValidTickers(compareStocks, 5)
        : detectedIntent.intent === "COMPARE"
          ? detectedIntent.tickers ?? []
          : [];
    const isCompareFlow = compareTickers.length >= 2;
    const widgetTicker = !isCompareFlow
      ? directTicker
        ? directTicker
        : detectedTicker
      : null;
    const shouldRenderWidget = Boolean(widgetTicker);

    if (shouldRenderWidget) {
      const ticker = widgetTicker!;

      console.log(`[INTERCEPTOR] 🎯 Widget triggered for ticker: ${ticker}`);

      // Auth check (don't block widget, just track usage)
      const dbUser = await getCurrentDbUser();
      const userId = dbUser?.id ?? null;
      const quota = await resolveChatQuota({ userId, guestUsage });
      if (quota.usage.isLimitReached) {
        return NextResponse.json(
          {
            error: "LIMIT_REACHED",
            message: "Bạn đã dùng hết lượt tư vấn hôm nay. Nâng cấp VIP để tiếp tục ngay.",
            usage: quota.usage,
          },
          { status: 429 }
        );
      }

      // Mock Mode — instant
      if (await isMockMode()) {
        console.log(`[INTERCEPTOR] 🎬 Mock Mode — serving ${ticker} from MockFactory`);
        const mockData = MockFactory.getTicker(ticker);
        if (userId) {
          prisma.$transaction([
            prisma.chat.create({ data: { userId, message, role: "user" } }),
            prisma.chat.create({ data: { userId, message: `[WIDGET:MOCK:${ticker}]`, role: "assistant" } }),
          ]).catch(console.error);
        }
        const usageAfter = await consumeChatQuota(quota);
        // EXACT shape that useChat.ts expects
        return NextResponse.json({
          id: generateId(),
          role: "assistant",
          type: "widget",
          widgetType: "TICKER_DASHBOARD",
          ticker,
          content: "",
          data: mockData,
          newUsage: usageAfter.used,
          usage: usageAfter,
          streamState: "done",
          widgetMeta: {
            complete: true,
            ticker,
            badge: "GIỮ",
          },
        });
      }

      // Real mode — inline service (no self-HTTP)
      const widgetPayload = await getFullWidgetData(ticker);

      const usageAfter = await consumeChatQuota(quota);
      if (userId) {
        prisma.$transaction([
          prisma.chat.create({ data: { userId, message, role: "user" } }),
          prisma.chat.create({ data: { userId, message: `[WIDGET:${ticker}]`, role: "assistant" } }),
        ]).catch(console.error);
      }

      // EXACT shape that useChat.ts expects — type at top level, content empty
      return NextResponse.json({
        id: generateId(),
        role: "assistant",
        type: "widget",
        widgetType: "TICKER_DASHBOARD",
        ticker,
        content: "",
        data: widgetPayload.data,   // forward only the .data object (tabs)
        newUsage: usageAfter.used,
        usage: usageAfter,
        streamState: "done",
        widgetMeta: {
          complete: true,
          ticker,
          badge: mapSignalToBadge(widgetPayload.data?.technical?.data?.signal ?? null),
        },
      });
    }
    // ══════════════════════════════════════════════════════════
    // END INTERCEPTOR — below here = general chat only
    // ══════════════════════════════════════════════════════════

    // ── Step 1: User auth + rate limit ──
    const dbUser = await getCurrentDbUser();
    let userId: string | null = null;

    if (dbUser) {
      userId = dbUser.id;
    }

    const quota = await resolveChatQuota({ userId, guestUsage });
    if (quota.usage.isLimitReached) {
      return NextResponse.json(
        {
          error: "LIMIT_REACHED",
            message: "Bạn đã dùng hết lượt tư vấn hôm nay. Nâng cấp VIP để tiếp tục ngay.",
          usage: quota.usage,
        },
        { status: 429 }
      );
    }

    if (cmd === "/signals") {
      const tradingDate = normalizeSignalHistoryDate(commandDate);
      if (!tradingDate) {
        return NextResponse.json({
          message: "Ngày không hợp lệ. Ví dụ: **/signals** hoặc **/signals 2026-04-30**.",
          newUsage: quota.usage.used,
          usage: quota.usage,
        });
      }

      const summary = await loadReportedSignalSummary(tradingDate);
      const responseText = formatReportedSignalSummary(summary, { limit: 50 });
      if (userId) {
        await prisma.$transaction([
          prisma.chat.create({ data: { userId, message, role: "user" } }),
          prisma.chat.create({ data: { userId, message: responseText, role: "assistant" } }),
        ]);
      }
      return NextResponse.json({
        message: responseText,
        newUsage: quota.usage.used,
        usage: quota.usage,
        streamState: "done",
        widgetMeta: {
          complete: false,
        },
      });
    }

    if (cmd === "/compare" && compareTickers.length < 2) {
      return NextResponse.json({
        message:
          'Hệ thống cần ít nhất 2 mã để so sánh. Ví dụ: **/compare HPG HSG** hoặc **/compare FPT CMG VGI**.',
        newUsage: quota.usage.used,
        usage: quota.usage,
      });
    }

    if (cmd && cmd !== "/compare" && cmd !== "/signals" && !stock) {
      return NextResponse.json({
        message:
          "Hệ thống cần mã cổ phiếu hợp lệ. Ví dụ: **/ta DGC**, **/fa FPT**, **/news VNM**, **/tamly SSI**.",
        newUsage: quota.usage.used,
        usage: quota.usage,
      });
    }


    const messageTickers = !cmd && !isCompareFlow ? detectTickers(message) : [];
    const generalNeedsMarketContext =
      !cmd && !isCompareFlow && (shouldFetchMarketContext(message) || messageTickers.length > 0);
    const shouldLoadFullContext = Boolean(cmd) || isCompareFlow || generalNeedsMarketContext;

    // ── Step 3: Build context. Chỉ tải context nặng khi câu hỏi thật sự cần RAG/thị trường. ──
    let journalCtx = "";
    if (shouldLoadFullContext) {
      const [knowledgeCtx, chatHistoryCtx] = await Promise.all([
        getKnowledgeContext(),
        getRecentChatHistory(userId),
      ]);

      if (userId) {
        const journals = await prisma.tradingJournal.findMany({
          where: { userId },
          orderBy: { createdAt: "desc" },
          take: 15,
          select: { ticker: true, action: true, price: true, psychology: true },
        });
        if (journals.length >= 3) {
          const buyCount = journals.filter((j: { action: string }) => j.action === "BUY").length;
          const sellCount = journals.filter((j: { action: string }) => j.action === "SELL").length;
          const psychList = journals.map((j: { psychology: string }) => j.psychology);
          const psychCounts: Record<string, number> = {};
          psychList.forEach((p: string) => { psychCounts[p] = (psychCounts[p] ?? 0) + 1; });
          const topPsych = Object.entries(psychCounts).sort((a, b) => b[1] - a[1]).slice(0, 3);
          const warnings: string[] = [];
          if (psychCounts["FOMO"] >= 2) warnings.push(`hay FOMO (${psychCounts["FOMO"]} lần)`);
          if (psychCounts["Cảm tính"] >= 2) warnings.push(`giao dịch cảm tính (${psychCounts["Cảm tính"]} lần)`);
          journalCtx = `\n\n╔══ HỒ SƠ GIAO DỊCH (${journals.length} lệnh) ══╗\nMua: ${buyCount} | Bán: ${sellCount} | Tâm lý: ${topPsych.map(([p, c]) => `${p}(${c})`).join(", ")}\n${warnings.length > 0 ? `⚠️ Điểm yếu: ${warnings.join("; ")}` : "✅ Giao dịch tốt!"}\n╚═════════════════════════════╝`;
        }
      }

      journalCtx = knowledgeCtx + journalCtx + chatHistoryCtx;
    } else if (userId) {
      journalCtx = await getRecentChatHistory(userId, 2);
    }

    // ── Xử lý các lệnh với RAG (Giữ nguyên logic cũ) ──
    let responseText: string;
    let responseIntent: typeof INTENT[keyof typeof INTENT] = INTENT.GENERAL;
    let chartStock: string | undefined;
    let chartExchange: string | undefined;

    if (cmd === "/ta" && stock) {
      responseIntent = INTENT.PTKT;
      console.log(`[Chat /ta] Fetching AI TA từ Bridge cho ${stock}...`);
      const personCtx = await getPersonalizationContext(userId, stock);
      const aiResult = await fetchBridgeAI("ta", stock, personCtx);

      if (aiResult) {
        console.log(`[Chat /ta] Bridge AI OK – signal=${aiResult.signal}, price=${aiResult.price}`);
        responseText = aiResult.analysis;
        chartStock = stock;
        // Nếu có media_url (chart base64) thì đính kèm vào response
        if (aiResult.media_url) {
          responseText += `\n\n📊 *[Chart kỹ thuật ${stock} đã được tạo]*`;
        }
      } else {
        // Fallback: dùng FiinQuant ta-summary + Gemini local
        console.warn(`[Chat /ta] Bridge AI lỗi, fallback ta-summary...`);
        const [taSummary, signalCtx] = await Promise.all([
          fetchTASummary(stock),
          getSignalContext(stock),
        ]);
        if (taSummary) {
          responseText = await executeAIRequest(buildTaPromptFromSummary(stock, taSummary, journalCtx + signalCtx), INTENT.PTKT);
        } else {
          const taData = await fetchTAData(stock);
          if (taData) chartExchange = taData.exchange;
          responseText = await executeAIRequest(buildTaPrompt(stock, taData, journalCtx + signalCtx), INTENT.PTKT);
        }
        chartStock = stock;
      }
    } else if (cmd === "/fa" && stock) {
      responseIntent = INTENT.PTCB;
      console.log(`[Chat /fa] Fetching AI FA từ Bridge cho ${stock}...`);
      const personCtx = await getPersonalizationContext(userId, stock);
      const aiResult = await fetchBridgeAI(
        "fa",
        stock,
        [personCtx, FA_TURNOVER_ANALYSIS_REQUIREMENT].filter(Boolean).join("\n"),
      );

      if (aiResult) {
        responseText = aiResult.analysis;
      } else {
        console.warn(`[Chat /fa] Bridge AI lỗi, fallback VNDirect...`);
        const signalCtx = await getSignalContext(stock);
        const [taData, faData] = await Promise.all([fetchTAData(stock), fetchFAData(stock)]);
        responseText = await executeAIRequest(buildFaPrompt(stock, taData, faData, journalCtx + signalCtx), INTENT.PTCB);
      }

    } else if (cmd === "/news" && stock) {
      responseIntent = INTENT.NEWS;
      try {
        responseText = await withTimeout(
          executeAIRequest(buildNewsPrompt(stock, journalCtx), INTENT.NEWS),
          CHAT_AI_FALLBACK_TIMEOUT_MS,
          "news-ai"
        );
      } catch (error) {
        console.warn(`[Chat /news] Gemini lỗi, fallback feed bridge cho ${stock}:`, error);
        const bridgeNews = await fetchBridgeTickerNews(stock);
        responseText = buildNewsFallback(stock, bridgeNews);
      }

    } else if (cmd === "/tamly" && stock) {
      responseIntent = INTENT.TAMLY;
      console.log(`[Chat /tamly] Fetching AI Tâm lý từ Bridge cho ${stock}...`);
      const personCtx = await getPersonalizationContext(userId, stock);
      const realtimeFlowCtx = await fetchTamlyRealtimeContext(stock);
      const aiContext = [personCtx, realtimeFlowCtx].filter(Boolean).join("\n");
      const aiResult = await fetchBridgeAI("tamly", stock, aiContext);

      if (aiResult) {
        responseText = aiResult.analysis;
      } else {
        console.warn(`[Chat /tamly] Bridge AI lỗi, fallback local...`);
        const taData = await fetchTAData(stock);
        try {
          responseText = await withTimeout(
            executeAIRequest(buildTamlyPrompt(stock, taData, journalCtx, realtimeFlowCtx), INTENT.TAMLY),
            CHAT_AI_FALLBACK_TIMEOUT_MS,
            "tamly-ai"
          );
        } catch (error) {
          console.warn(`[Chat /tamly] Gemini lỗi, fallback deterministic cho ${stock}:`, error);
          responseText = buildTamlyFallback(stock, taData);
        }
      }

    } else if (isCompareFlow) {
      responseIntent = INTENT.COMPARE;
      const targets = compareTickers.slice(0, 5);
      const compareData = await Promise.all(
        targets.map(async (ticker) => {
          const [ta, fa, summary] = await Promise.all([
            fetchTAData(ticker),
            fetchFAData(ticker),
            fetchTASummary(ticker, CHAT_BRIDGE_CONTEXT_TIMEOUT_MS),
          ]);
          return { ticker, ta, fa, summary };
        }),
      );

      const comparePrompt = buildComparePrompt(targets, compareData, journalCtx);
      responseText = await executeAIRequest(comparePrompt, INTENT.COMPARE);

    } else {
      responseIntent = INTENT.GENERAL;
      // Chat thông thường — chỉ fetch market data khi câu hỏi thực sự liên quan thị trường
      const tickers = messageTickers;
      const needMarketContext = generalNeedsMarketContext;
      let overview: MarketOverviewData | null = null;
      let vnindexTA: TASummary | null = null;
      const stockTAs: { ticker: string; ta: TASummary }[] = [];

      if (needMarketContext) {
        console.log(`[Chat General] Fetching market context cho: "${message.slice(0, 60)}..."`);

        [overview, vnindexTA] = await Promise.all([
          fetchMarketOverview(),
          fetchTASummary("VNINDEX", CHAT_BRIDGE_CONTEXT_TIMEOUT_MS),
        ]);

        if (tickers.length > 0) {
          console.log(`[Chat General] Detected tickers: ${tickers.join(", ")}`);
          const taResults = await Promise.all(
            tickers.map(async (t) => {
              const ta = await fetchTASummary(t, CHAT_BRIDGE_LIGHT_CONTEXT_TIMEOUT_MS);
              return ta ? { ticker: t, ta } : null;
            })
          );
          for (const r of taResults) if (r) stockTAs.push(r);
        }
      } else {
        console.log(`[Chat General] Skip market context for non-market query: "${message.slice(0, 60)}..."`);
      }

      const marketCtx = formatMarketContext(overview, vnindexTA, stockTAs);
      const hasData = marketCtx.length > 0;
      const priceClaims = extractPriceClaims(message);
      const references: number[] = [];

      if (/(vnindex|vn-index|vni|vix)/i.test(message) && vnindexTA?.price?.current) {
        references.push(vnindexTA.price.current);
      }
      for (const item of stockTAs) {
        if (item.ta.price.current > 0) references.push(item.ta.price.current);
      }
      if (references.length === 0 && overview?.price) {
        references.push(overview.price);
      }

      console.log(`[Chat General] Market data: overview=${!!overview}, vnindexTA=${!!vnindexTA}, stocks=${stockTAs.length}`);

      if (hasPricePremiseMismatch(priceClaims, references)) {
        responseText = buildPremiseRejectMessage(references);
      } else {
        const prompt = `${BASE_SYSTEM_PROMPT}${journalCtx}
${marketCtx}
${hasData ? RAG_RULES : ""}
${hasData ? `\n⚠️ QUAN TRỌNG: Phân tích thị trường PHẢI dựa trên DỮ LIỆU REAL-TIME phía trên. Khi nói về VN-Index, giá, thanh khoản, RSI, EMA, support/resistance — CHỈ dùng số liệu đã cung cấp. KHÔNG tự bịa thêm con số nào không có trong dữ liệu.\n` : ""}

Nhà đầu tư hỏi: ${message}`;

        responseText = await executeAIRequest(prompt, INTENT.GENERAL);
      }
    }

    responseText = await enforcePersonaAndLanguage(responseText, responseIntent);
    if (responseIntent === INTENT.PTKT) {
      responseText = ensureDisclaimer("PTKT", responseText);
    }
    if (responseIntent === INTENT.GENERAL) {
      responseText = ensureDisclaimer("GENERAL", responseText);
    }

    // Lưu lịch sử chat
    const usageAfter = await consumeChatQuota(quota);
    if (userId) {
      await prisma.$transaction([
        prisma.chat.create({ data: { userId, message, role: "user" } }),
        prisma.chat.create({ data: { userId, message: responseText, role: "assistant" } }),
      ]);
    }

    return NextResponse.json({
      message: responseText,
      newUsage: usageAfter.used,
      usage: usageAfter,
      ...(chartStock ? { chartStock, chartExchange: chartExchange ?? "HOSE" } : {}),
      streamState: "done",
      widgetMeta: {
        complete: false,
      },
    });

  } catch (error) {
    console.error("[/api/chat] Lỗi:", error);
    return NextResponse.json(
      { error: "Hệ thống gặp lỗi, vui lòng thử lại sau." },
      { status: 500 }
    );
  }
}

