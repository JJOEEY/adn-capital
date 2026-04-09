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
import { USAGE_LIMITS } from "@/lib/utils";
import { fetchTAData, fetchFAData, type TAData, type FAData } from "@/lib/stockData";
import { isMockMode } from "@/lib/settings";
import { MockFactory } from "@/lib/mock-factory";
import { getFullWidgetData } from "@/lib/widget-service";

const FIINQUANT_BRIDGE = process.env.FIINQUANT_URL ?? "http://localhost:8000";

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

async function fetchTASummary(ticker: string): Promise<TASummary | null> {
  try {
    const url = `${FIINQUANT_BRIDGE}/api/v1/ta-summary/${ticker}`;
    console.log(`[Chat /ta] Fetching TA Summary: ${url}`);
    const res = await fetch(url, {
      signal: AbortSignal.timeout(30000),
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
      signal: AbortSignal.timeout(15000),
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
  // Match 2-4 uppercase letter sequences that look like tickers
  const matches = msg.match(/\b[A-Z]{2,4}\b/g) ?? [];
  // Also catch lowercase mentions like "hpg", "fpt"
  const lowerMatches = msg.match(/\b(?:mã|cổ phiếu|cp)\s+([a-zA-Z]{2,4})\b/gi) ?? [];
  const extracted = lowerMatches.map(m => {
    const parts = m.split(/\s+/);
    return parts[parts.length - 1].toUpperCase();
  });
  const all = [...new Set([...matches, ...extracted])];
  // Filter out common Vietnamese words that look like tickers
  const EXCLUDE = new Set(["VND", "CUA", "CHO", "CON", "MOT", "HAI", "HOI", "NAY", "NHU", "THE", "VAN", "VOI", "TAT", "BAT", "MAU", "DAU", "BAN", "MUA", "LAM", "SAU", "ROI", "NEN", "KHI", "TAI", "VUA", "DAY", "HAY", "NHO", "TOI", "BOT"]);
  return all.filter(t => t.length >= 3 && !EXCLUDE.has(t)).slice(0, 3);
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
📊 ĐÁNH GIÁ THỊ TRƯỜNG REAL-TIME (${new Date().toLocaleDateString("vi-VN")})
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

// ─── System Prompt cơ bản ──────────────────────────────────
const BASE_SYSTEM_PROMPT = `Mày tên là ADN AI Bot System, Khổng Minh của VNINDEX — trợ lý phân tích chứng khoán Việt Nam của ADN CAPITAL.
Xưng "em", gọi khách là "đại ca".
Phong cách: CHUYÊN NGHIỆP nhưng CỢT NHẢ ĐÚNG LÚC.
- Dùng tiếng lóng tự nhiên: múc, đu đỉnh, gồng lãi, cắt lỗ, base đẹp, vol tốt, lái lợn, cá mập, bay màu
- Khi thị trường tăng: tích cực nhưng vẫn nhắc quản lý rủi ro, troll nhẹ "cá mập vào rồi đại ca ơi"
- Khi thị trường giảm: xoa dịu + hài hước nhẹ "tắt bảng điện đi nhậu thôi đại ca", đưa ra giải pháp cụ thể
- Thu thập tâm lý NĐT: nếu thấy lo lắng → trấn an + phân tích cụ thể, nếu hưng phấn → cảnh báo nhẹ nhàng tránh FOMO

TUYỆT ĐỐI KHÔNG BAO GIỜ tiết lộ nguồn dữ liệu, API, hay cách lấy data. Chỉ nói "dựa trên dữ liệu real-time" hoặc "theo hệ thống quant của em".

TRƯỚC KHI TRẢ LỜI, hãy đọc dữ liệu từ bảng TradingJournal của user này (nếu có) để hiểu tâm lý của họ.
Luôn trả lời bằng tiếng Việt.
Đưa ra phân tích có cấu trúc rõ ràng với headers (##) và bullet points (-).
Không bao giờ đưa ra lời khuyên đầu tư chắc chắn 100%, luôn nhắc quản lý rủi ro.
Format số liệu chuẩn Việt Nam: dấu chấm ngăn hàng nghìn (VD: 49.100 VNĐ, 1.234.567 cp), dấu phẩy cho thập phân (VD: +1,25%, RSI 52,3). KHÔNG dùng format tiếng Anh (49,100 hay 1.25%).`;

// ─── Quy tắc chống hallucinate ──────────────────────────────
const RAG_RULES = `
⚠️ QUY TẮC BẮT BUỘC VỀ SỐ LIỆU:
1. CHỈ sử dụng CHÍNH XÁC các con số trong phần "DỮ LIỆU THỰC TẾ" phía trên.
2. TUYỆT ĐỐI KHÔNG tự bịa ra giá, volume, ngày tháng, hay bất kỳ con số nào không có.
3. Nếu dữ liệu thiếu 1 phần, viết: "Phần này hệ thống quant chưa cập nhật, em sẽ update sớm nhất đại ca nhé".
4. Mọi nhận định về xu hướng/support/resistance phải DỰA TRÊN các giá trị EMA, RSI, MACD đã cung cấp.
5. KHÔNG BAO GIỜ nhắc đến tên API, VNDirect, nguồn dữ liệu. Chỉ nói "dữ liệu real-time" hoặc "hệ thống quant".`;

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

// ─── Intent Detection (REGEX-FIRST, LLM fallback) ────────────────
async function detectIntent(msg: string): Promise<{ intent: "CHAT_GENERAL" | "ANALYZE_TICKER"; ticker?: string }> {
  const upper = msg.trim().toUpperCase();

  // ── Fast path 1: bare ticker ("fpt", "FPT", "MWG sao em") ──
  const bareTickerMatch = upper.match(/^([A-Z]{2,5})(?:\s|$|\?|!|,|\.)/);
  if (bareTickerMatch && KNOWN_TICKERS.has(bareTickerMatch[1])) {
    return { intent: "ANALYZE_TICKER", ticker: bareTickerMatch[1] };
  }

  // ── Fast path 2: known ticker anywhere in short msg (<= 10 words) ──
  const words = upper.split(/\s+/);
  if (words.length <= 10) {
    for (const word of words) {
      const cleaned = word.replace(/[^A-Z]/g, "");
      if (cleaned.length >= 2 && cleaned.length <= 5 && KNOWN_TICKERS.has(cleaned)) {
        return { intent: "ANALYZE_TICKER", ticker: cleaned };
      }
    }
  }

  // ── Fast path 3: regex for any 2-5 uppercase ticker with analysis keywords ──
  const analysisKeywords = /(nh\u1eadn \u0111\u1ecbnh|ph\u00e2n t\u00edch|c\u00f3 n\u00ean|xem|n\u00f3 sao|sao r\u1ed3i|c\u00f3 ti\u1ec1m|m\u00e3|c\u1ed5 phi\u1ebfu|k\u1eb9o|xem h\u1ed9)/i;
  const tickerInMsg = upper.match(/\b([A-Z]{2,5})\b/);
  if (tickerInMsg && analysisKeywords.test(msg)) {
    return { intent: "ANALYZE_TICKER", ticker: tickerInMsg[1] };
  }

  // ── Slow path: LLM for ambiguous cases ──
  const prompt = `Bạn là bộ phân loại ý định cho ADN AI Bot. Phân tích tin nhắn và trả về JSON duy nhất.
Intent:
- ANALYZE_TICKER: hỏi về 1 mã cổ phiếu cụ thể
- CHAT_GENERAL: hỏi chung, vĩ mô, kiến thức

Tin nhắn: "${msg}"
JSON: {"intent": "...", "ticker": "..."}  (ticker chỉ có nếu ANALYZE_TICKER)`;

  try {
    const raw = await executeAIRequest(prompt, "INTENT_CLASSIFICATION" as any);
    const cleaned = raw.replace(/```json|```/g, "").trim();
    const parsed = JSON.parse(cleaned);
    if (parsed.ticker) parsed.ticker = parsed.ticker.toUpperCase();
    return parsed;
  } catch {
    return { intent: "CHAT_GENERAL" };
  }
}

// ─── Parse lệnh từ tin nhắn ──────────────────────────────────
function parseCommand(msg: string): { cmd: string | null; stock: string | null } {
  const trimmed = msg.trim();
  const lower = trimmed.toLowerCase();
  const taMatch = trimmed.match(/^\/ta\s+([A-Za-z0-9]{2,10})/i);
  const faMatch = trimmed.match(/^\/fa\s+([A-Za-z0-9]{2,10})/i);
  const newsMatch = trimmed.match(/^\/news\s+([A-Za-z0-9]{2,10})/i);
  const tamlyMatch = trimmed.match(/^\/tamly\s+([A-Za-z0-9]{2,10})/i);
  if (taMatch) return { cmd: "/ta", stock: taMatch[1].toUpperCase() };
  if (faMatch) return { cmd: "/fa", stock: faMatch[1].toUpperCase() };
  if (newsMatch) return { cmd: "/news", stock: newsMatch[1].toUpperCase() };
  if (tamlyMatch) return { cmd: "/tamly", stock: tamlyMatch[1].toUpperCase() };
  if (lower.startsWith("/ta")) return { cmd: "/ta", stock: null };
  if (lower.startsWith("/fa")) return { cmd: "/fa", stock: null };
  if (lower.startsWith("/news")) return { cmd: "/news", stock: null };
  if (lower.startsWith("/tamly")) return { cmd: "/tamly", stock: null };
  return { cmd: null, stock: null };
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

Đại ca yêu cầu PHÂN TÍCH KỸ THUẬT cổ phiếu **${stock}** (ngày ${taData?.dataDate ?? new Date().toLocaleDateString("vi-VN")}).
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
- % vốn nên phân bổ | Khuyến nghị chia bao nhiêu lần mua${journalCtx ? "\n\n### 6. TƯ VẤN CÁ NHÂN\nDựa trên hồ sơ giao dịch của đại ca đã cung cấp..." : ""}`;
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
Tóm 2-3 câu ĐÁNH GIÁ CUỐI CÙNG cho ${stock}: nên MUA / BÁN / CHỜ, lý do chính, mức giá hành động. Viết ấn tượng, rõ ràng để đại ca ra quyết định ngay.${journalCtx ? "\n\n### 6. Tư vấn cá nhân\nDựa trên hồ sơ giao dịch đại ca, gợi ý ngắn gọn." : ""}`;
}

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

Đại ca yêu cầu PHÂN TÍCH CƠ BẢN cổ phiếu **${stock}**.
Hãy dùng Google Search để bổ sung thông tin định tính (tin tức, ngành, vị thế).
Nhưng tất cả CON SỐ tài chính phải từ DỮ LIỆU REAL-TIME phía trên, KHÔNG được tự nghĩ ra.
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

### 3. ĐIỂM MẠNH, RỦI RO & CATALYST
(Tìm thêm từ Google Search)

### 4. ĐỊNH GIÁ & VÙNG GIÁ HỢP LÝ (BẮT BUỘC nêu con số)
- **P/E hợp lý ngành:** XXx → Giá hợp lý = EPS × P/E hợp lý = XX.XXX VNĐ
- **P/B hợp lý:** XXx → Giá hợp lý = Book Value × P/B = XX.XXX VNĐ
- **Vùng giá tích lũy tốt:** từ XX.XXX → XX.XXX VNĐ
- **Giá mục tiêu 6-12 tháng:** XX.XXX VNĐ (upside bao nhiêu %)
- So sánh giá hiện tại với vùng giá hợp lý: đang rẻ / hợp lý / đắt

### 5. KHUYẾN NGHỊ HÀNH ĐỘNG (giá cụ thể)
- Nếu định hướng TÍCH LŨY DÀI HẠN: Mua vùng XX.XXX - XX.XXX VNĐ, chia 2-3 lần giải ngân
- Stop-loss: XX.XXX VNĐ | Target: XX.XXX VNĐ
- Mức phân bổ vốn: bao nhiêu %${journalCtx ? "\n\n### 6. PHÙ HỢP ĐẠI CA?\nDựa trên hồ sơ giao dịch..." : ""}`;
}

// ─── Build Prompt: /news ────────────────────────────────────
function buildNewsPrompt(stock: string, journalCtx: string): string {
  return `${BASE_SYSTEM_PROMPT}${journalCtx}

Đại ca muốn xem TIN TỨC mới nhất về **${stock}** (hôm nay ${new Date().toLocaleDateString("vi-VN")}).
Hãy dùng Google Search để tìm tin tức thật. Chỉ báo cáo tin đã xác nhận, không bịa.

## 📰 TIN TỨC & SỰ KIỆN ${stock}

### 1. TIN TỨC GẦN ĐÂY (7-30 ngày)
### 2. ĐÁNH GIÁ CTCK (Khuyến nghị + Giá mục tiêu)
### 3. CỔ ĐÔNG & INSIDERS
### 4. LỊCH SỰ KIỆN SẮP TỚI
### 5. NHẬN ĐỊNH CỦA EM${journalCtx ? "\n### 6. PHÙ HỢP ĐẠI CA?" : ""}`;
}

// ─── Build Prompt: /tamly ────────────────────────────────────
function buildTamlyPrompt(stock: string, taData: TAData | null, journalCtx: string): string {
  const dataBlock = taData
    ? formatTAContext(taData)
    : `\n⚠️ Hệ thống quant chưa cập nhật dữ liệu real-time cho ${stock}.\n`;

  return `${BASE_SYSTEM_PROMPT}${journalCtx}
${dataBlock}
${taData ? RAG_RULES : ""}

Đại ca yêu cầu ĐỌC VỊ DÒNG TIỀN & TÂM LÝ ATC của **${stock}**.
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

// ─── Helpers ────────────────────────────────────────────────────
function generateId() {
  return Math.random().toString(36).slice(2) + Date.now().toString(36);
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
    const upper = message.trim().toUpperCase();
    const isDirectTicker = /^[A-Z]{2,5}$/.test(upper);
    const isAnalyzePhrase =
      /\b[A-Z]{2,5}\b/.test(upper) && (
        upper.includes("PHÂN TÍCH") || upper.includes("NHAN DINH") || upper.includes("NHẬN ĐỊNH") ||
        upper.includes("NHẬ") || upper.includes("XEM") || upper.includes("TA ") ||
        upper.includes("/TA") || upper.includes("/FA") || upper.includes("/PTKT") || upper.includes("/PTCB") ||
        upper.includes("MUA") || upper.includes("BÁN") || upper.includes("BAN ") ||
        upper.includes("PTKT") || upper.includes("PTCB") || upper.includes("CHART") ||
        upper.includes("KỸ THUẬT") || upper.includes("KY THUAT") || upper.includes("CƠ BẢN") ||
        upper.includes("CO BAN") || upper.includes("DASHBOARD")
      );

    const shouldRenderWidget = isDirectTicker || isAnalyzePhrase;

    if (shouldRenderWidget) {
      const ticker = isDirectTicker ? upper : (extractTicker(upper) ?? "FPT");

      console.log(`[INTERCEPTOR] 🎯 Widget triggered for ticker: ${ticker}`);

      // Auth check (don't block widget, just track usage)
      const dbUser = await getCurrentDbUser();
      const userId = dbUser?.id ?? null;
      const userRole = dbUser?.role ?? "GUEST";
      const currentUsage = dbUser ? dbUser.chatCount : guestUsage;
      const limit = (USAGE_LIMITS as Record<string, number>)[userRole] ?? 3;

      if (currentUsage >= limit) {
        return NextResponse.json(
          { error: "LIMIT_REACHED", message: `Đại ca hết ${limit} lượt rồi ạ 😢 Nâng cấp VIP để chat không giới hạn!` },
          { status: 429 }
        );
      }

      // Mock Mode — instant
      if (await isMockMode()) {
        console.log(`[INTERCEPTOR] 🎬 Mock Mode — serving ${ticker} from MockFactory`);
        const mockData = MockFactory.getTicker(ticker);
        if (userId) {
          prisma.$transaction([
            prisma.user.update({ where: { id: userId }, data: { chatCount: { increment: 1 } } }),
            prisma.chat.create({ data: { userId, message, role: "user" } }),
            prisma.chat.create({ data: { userId, message: `[WIDGET:MOCK:${ticker}]`, role: "assistant" } }),
          ]).catch(console.error);
        }
        // EXACT shape that useChat.ts expects
        return NextResponse.json({
          id: generateId(),
          role: "assistant",
          type: "widget",
          widgetType: "TICKER_DASHBOARD",
          ticker,
          content: "",
          data: mockData,
        });
      }

      // Real mode — inline service (no self-HTTP)
      const widgetPayload = await getFullWidgetData(ticker);

      if (userId) {
        prisma.$transaction([
          prisma.user.update({ where: { id: userId }, data: { chatCount: { increment: 1 } } }),
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
        newUsage: currentUsage + 1,
      });
    }
    // ══════════════════════════════════════════════════════════
    // END INTERCEPTOR — below here = general chat only
    // ══════════════════════════════════════════════════════════

    // ── Step 0: FAST intent detection (ưu tiên đầu tiên, trước mọi thứ) ──
    const { cmd, stock } = parseCommand(message);

    // ── Step 1: User auth + rate limit ──
    const dbUser = await getCurrentDbUser();
    let userId: string | null = null;
    let userRole = "GUEST";
    let currentUsage = guestUsage;

    if (dbUser) {
      userId = dbUser.id;
      userRole = dbUser.role;
      currentUsage = dbUser.chatCount;
    }

    const limit = (USAGE_LIMITS as Record<string, number>)[userRole] ?? 3;
    if (currentUsage >= limit) {
      return NextResponse.json(
        { error: "LIMIT_REACHED", message: `Đại ca hết ${limit} lượt rồi ạ 😢 Nâng cấp VIP để chat không giới hạn!` },
        { status: 429 }
      );
    }

    if (cmd && !stock) {
      return NextResponse.json({
        message: `Em cần mã cổ phiếu đại ca ơi! Ví dụ: **/ta DGC**, **/fa FPT**, **/news VNM** 📊`,
        newUsage: currentUsage,
      });
    }


    // ── Step 3: Build expensive context (only for non-widget requests) ──
    let journalCtx = "";
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

    // ── Xử lý các lệnh với RAG (Giữ nguyên logic cũ) ──
    let responseText: string;
    let chartStock: string | undefined;
    let chartExchange: string | undefined;

    if (cmd === "/ta" && stock) {
      console.log(`[Chat /ta] Fetching TA Summary từ FiinQuant cho ${stock}...`);
      const [taSummary, signalCtx] = await Promise.all([
        fetchTASummary(stock),
        getSignalContext(stock),
      ]);

      if (taSummary) {
        console.log(`[Chat /ta] ${stock}: FiinQuant OK – Giá=${taSummary.price.current}, Trend=${taSummary.trend.direction}, Signal=${taSummary.signal}`);
        responseText = await executeAIRequest(buildTaPromptFromSummary(stock, taSummary, journalCtx + signalCtx), INTENT.PTKT);
      } else {
        // Fallback: dùng VNDirect nếu bridge lỗi
        console.warn(`[Chat /ta] ${stock}: FiinQuant Bridge lỗi, fallback VNDirect`);
        const taData = await fetchTAData(stock);
        if (taData) chartExchange = taData.exchange;
        responseText = await executeAIRequest(buildTaPrompt(stock, taData, journalCtx + signalCtx), INTENT.PTKT);
      }
      chartStock = stock;

    } else if (cmd === "/fa" && stock) {
      console.log(`[Chat /fa] Fetching TAData + FAData cho ${stock}...`);
      const signalCtx = await getSignalContext(stock);
      const [taData, faData] = await Promise.all([fetchTAData(stock), fetchFAData(stock)]);
      if (taData) console.log(`[Chat /fa] ${stock}: Giá=${taData.currentPrice}, PE=${faData?.pe}`);
      responseText = await executeAIRequest(buildFaPrompt(stock, taData, faData, journalCtx + signalCtx), INTENT.PTCB);

    } else if (cmd === "/news" && stock) {
      responseText = await executeAIRequest(buildNewsPrompt(stock, journalCtx), INTENT.NEWS);

    } else if (cmd === "/tamly" && stock) {
      console.log(`[Chat /tamly] Fetching TAData cho ${stock}...`);
      const taData = await fetchTAData(stock);
      responseText = await executeAIRequest(buildTamlyPrompt(stock, taData, journalCtx), INTENT.TAMLY);

    } else {
      // Chat thông thường — LUÔN fetch data real-time trước khi trả lời
      console.log(`[Chat General] Fetching market context cho: "${message.slice(0, 60)}..."`);

      // Fetch market overview + VNINDEX TA song song
      const [overview, vnindexTA] = await Promise.all([
        fetchMarketOverview(),
        fetchTASummary("VNINDEX"),
      ]);

      // Detect stock tickers trong tin nhắn → fetch TA cho từng mã
      const tickers = detectTickers(message);
      const stockTAs: { ticker: string; ta: TASummary }[] = [];
      if (tickers.length > 0) {
        console.log(`[Chat General] Detected tickers: ${tickers.join(", ")}`);
        const taResults = await Promise.all(
          tickers.map(async (t) => {
            const ta = await fetchTASummary(t);
            return ta ? { ticker: t, ta } : null;
          })
        );
        for (const r of taResults) if (r) stockTAs.push(r);
      }

      const marketCtx = formatMarketContext(overview, vnindexTA, stockTAs);
      const hasData = marketCtx.length > 0;

      console.log(`[Chat General] Market data: overview=${!!overview}, vnindexTA=${!!vnindexTA}, stocks=${stockTAs.length}`);

      const prompt = `${BASE_SYSTEM_PROMPT}${journalCtx}
${marketCtx}
${hasData ? RAG_RULES : ""}
${hasData ? `\n⚠️ QUAN TRỌNG: Phân tích thị trường PHẢI dựa trên DỮ LIỆU REAL-TIME phía trên. Khi nói về VN-Index, giá, thanh khoản, RSI, EMA, support/resistance — CHỈ dùng số liệu đã cung cấp. KHÔNG tự bịa thêm con số nào không có trong dữ liệu.\n` : ""}

Đại ca hỏi: ${message}`;

      responseText = await executeAIRequest(prompt, INTENT.GENERAL);
    }

    // Lưu lịch sử chat
    if (userId) {
      await prisma.$transaction([
        prisma.user.update({ where: { id: userId }, data: { chatCount: { increment: 1 } } }),
        prisma.chat.create({ data: { userId, message, role: "user" } }),
        prisma.chat.create({ data: { userId, message: responseText, role: "assistant" } }),
      ]);
    }

    return NextResponse.json({
      message: responseText,
      newUsage: currentUsage + 1,
      ...(chartStock ? { chartStock, chartExchange: chartExchange ?? "HOSE" } : {}),
    });

  } catch (error) {
    console.error("[/api/chat] Lỗi:", error);
    return NextResponse.json(
      { error: "Hệ thống gặp lỗi, đại ca thử lại sau nhé ạ 🙏" },
      { status: 500 }
    );
  }
}
