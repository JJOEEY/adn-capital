/**
 * UltimateSignalEngine — 3-Step Pipeline (v2 — Optimized)
 *
 * Step 1: Map scanner signal → tier + base NAV
 * Step 2: Seasonality filter (NodeCache memory, TTL 30 ngày per ticker-month)
 * Step 3: AIDEN/ADN Pilot card (Gemini — CHỈ gọi khi signal FIRST-TIME NEW/RADAR)
 *
 * ✅ KHÔNG gọi Gemini khi chỉ cập nhật PnL định kỳ
 * ✅ KHÔNG hardcode FiinQuant credentials
 * ✅ Seasonality cache TTL = 30 ngày (dữ liệu chu kỳ tháng)
 * ✅ NAV multiplier: x1.2 nếu WR > 70%, x0.5 nếu WR < 40%
 */

import { getBatchSeasonality, type SeasonalityItem } from "@/lib/PriceCache";
import NodeCache from "node-cache";
import { executeAIRequest, INTENT } from "@/lib/gemini";

// Seasonality in-memory cache: TTL 30 ngày (2592000s)
// Key format: "ticker:YYYY-MM" — chỉ fetch lại khi sang tháng mới
const _seasonalityMonthCache = new NodeCache({ stdTTL: 2592000, checkperiod: 86400 });

// ═══════════════════════════════════════════════════════════════════
//  Types
// ═══════════════════════════════════════════════════════════════════

export type SignalTier = "LEADER" | "TRUNG_HAN" | "NGAN_HAN" | "TAM_NGAM";
export type SignalStatus = "RADAR" | "ACTIVE" | "CLOSED" | "HOLD_TO_DIE";

export interface RawScannerSignal {
  ticker: string;
  type: "SIEU_CO_PHIEU" | "TRUNG_HAN" | "DAU_CO" | "TAM_NGAM";
  entryPrice: number;
  reason?: string;
  // Technical flags (optional, từ Python scanner)
  rsRating?: number;
  isVCP?: boolean;
  emaCross10_30?: boolean;
  emaCross50_100?: boolean;
  isDoubleBottom?: boolean;
  macdCrossUp?: boolean;
  volRatio?: number;
}

export interface ProcessedSignal {
  ticker: string;
  type: "SIEU_CO_PHIEU" | "TRUNG_HAN" | "DAU_CO" | "TAM_NGAM";
  tier: SignalTier;
  status: SignalStatus;
  entryPrice: number;
  target: number;      // Ngưỡng cảnh báo (alert level), KHÔNG phải auto-close
  stoploss: number;
  navAllocation: number;
  triggerSignal: string;
  aiReasoning: string;
  reason: string;
  winRate: number;
  sharpeRatio: number;
  rrRatio: string;       // "1:X.X" format (e.g. "1:2.5")
}

// ═══════════════════════════════════════════════════════════════════
//  Constants
// ═══════════════════════════════════════════════════════════════════

const TIER_CONFIG: Record<SignalTier, {
  baseNav: number;
  alertPct: number;   // Ngưỡng cảnh báo (cũ là target)
  stopPct: number;
}> = {
  LEADER:    { baseNav: 30, alertPct: 20, stopPct: 7 },
  TRUNG_HAN: { baseNav: 20, alertPct: 10, stopPct: 5 },
  NGAN_HAN:  { baseNav: 10, alertPct: 7,  stopPct: 3 },
  TAM_NGAM:  { baseNav: 0,  alertPct: 10, stopPct: 5 },
};

const TYPE_TO_TIER: Record<string, SignalTier> = {
  SIEU_CO_PHIEU: "LEADER",
  TRUNG_HAN: "TRUNG_HAN",
  DAU_CO: "NGAN_HAN",
  TAM_NGAM: "TAM_NGAM",
};

// ═══════════════════════════════════════════════════════════════════
//  Step 1: Map scanner signal → tier + base NAV
// ═══════════════════════════════════════════════════════════════════

function mapToTier(signal: RawScannerSignal): {
  tier: SignalTier;
  baseNav: number;
  target: number;   // Ngưỡng cảnh báo
  stoploss: number;
  rrRatio: string;  // "1:X.X"
} {
  const tier = TYPE_TO_TIER[signal.type] ?? "NGAN_HAN";
  const cfg = TIER_CONFIG[tier];
  const entry    = signal.entryPrice;
  const target   = +(entry * (1 + cfg.alertPct / 100)).toFixed(2);
  const stoploss = +(entry * (1 - cfg.stopPct  / 100)).toFixed(2);
  const riskReward = entry - stoploss > 0
    ? +((target - entry) / (entry - stoploss)).toFixed(2)
    : 0;
  const rrRatio = `1:${riskReward}`;
  return { tier, baseNav: cfg.baseNav, target, stoploss, rrRatio };
}

// ═══════════════════════════════════════════════════════════════════
//  Step 2: Seasonality — DB cache 30 ngày (TTL per tháng)
//  API FiinQuant credentials: process.env.FIINQUANT_USER / PASS
// ═══════════════════════════════════════════════════════════════════

interface SeasonalityData {
  ticker: string;
  currentMonth: number;
  winRate: number;
  sharpeRatio: number;
}

/**
 * Lấy seasonality của ticker với NodeCache in-memory theo tháng.
 * Cache key = "ticker:YYYY-MM" → TTL 30 ngày.
 * Nếu đã có trong cache → dùng luôn, KHÔNG gọi API.
 * Nếu chưa có → getBatchSeasonality (1 call batch).
 */
async function getSeasonalityCached(
  tickers: string[]
): Promise<Record<string, SeasonalityData | null>> {
  const currentMonth = new Date().toISOString().slice(0, 7); // YYYY-MM
  const result: Record<string, SeasonalityData | null> = {};
  const needFetch: string[] = [];

  // Kiểm tra NodeCache trước (key = "ticker:YYYY-MM")
  for (const t of tickers) {
    const cacheKey = `${t}:${currentMonth}`;
    const cached = _seasonalityMonthCache.get<SeasonalityData>(cacheKey);
    if (cached) {
      result[t] = cached;
    } else {
      needFetch.push(t);
    }
  }

  if (needFetch.length === 0) {
    console.log(`[SeasonalityCache] HIT — ${tickers.length} tickers from memory (month ${currentMonth})`);
    return result;
  }

  // Batch fetch từ FiinQuant cho các ticker chưa có
  try {
    const fetched = await getBatchSeasonality(needFetch);

    for (const [ticker, item] of Object.entries(fetched)) {
      const data: SeasonalityData = { ticker, currentMonth: new Date().getMonth() + 1, winRate: item.winRate, sharpeRatio: item.sharpeRatio };
      _seasonalityMonthCache.set(`${ticker}:${currentMonth}`, data);
      result[ticker] = data;
    }

    for (const t of needFetch) {
      if (!result[t]) result[t] = null;
    }

    console.log(`[SeasonalityCache] FETCHED ${Object.keys(fetched).length}/${needFetch.length} tickers, ${tickers.length - needFetch.length} cached`);
  } catch (e) {
    console.error("[SeasonalityCache] Batch fetch error:", e);
    for (const t of needFetch) result[t] = null;
  }

  return result;
}

function getSeasonalityMultiplier(data: SeasonalityData | null): {
  multiplier: number;
  label: string;
} {
  if (!data) return { multiplier: 1.0, label: "N/A" };
  const { winRate } = data;
  if (winRate > 70) return { multiplier: 1.2, label: "Mùa thuận lợi 🌿" };
  if (winRate < 40) return { multiplier: 0.5, label: "Mùa bất lợi ⚠️" };
  return { multiplier: 1.0, label: "Trung tính 📊" };
}

// ═══════════════════════════════════════════════════════════════════
//  Step 3: AIDEN/ADN Pilot message (Gemini)
//  CHỈ GỌI KHI signal LẦN ĐẦU TIÊN (status NEW / RADAR)
//  Cấm gọi khi cập nhật PnL định kỳ
// ═══════════════════════════════════════════════════════════════════

/**
 * Gọi Gemini để sinh AI Reasoning.
 * Hàm này CHỈ được gọi trong processSignals() — không gọi từ lifecycle.
 */
async function callGeminiReasoning(params: {
  ticker: string;
  tier: SignalTier;
  entryPrice: number;
  target: number;
  stoploss: number;
  navAllocation: number;
  triggerSignal: string;
  seasonalityLabel: string;
  winRate: number;
  sharpeRatio: number;
  rrRatio: string;
  raw: RawScannerSignal;
}): Promise<string> {
  const checklist = buildChecklist(params.raw, params.tier);

  const prompt = `Bạn là AIDEN Analyst của ADN Capital.
Xưng hô bản thân là "Hệ thống", gọi người dùng là "Nhà đầu tư".
Giọng văn: chuyên nghiệp, kỷ luật, sắc bén, không dùng tiếng lóng.
Viết 1 đoạn phân tích ngắn gọn (3-4 câu) về tín hiệu sau:
Mã: ${params.ticker} | Tier: ${params.tier}
Entry: ${params.entryPrice.toLocaleString()} | Alert: ${params.target.toLocaleString()} | SL: ${params.stoploss.toLocaleString()}
Lý do: ${params.triggerSignal}
Chu kỳ tháng: ${params.seasonalityLabel} (Win-Rate ${params.winRate}%, Sharpe ${params.sharpeRatio})
NAV: ${params.navAllocation}%
Nhắc nhở: Cơ chế gồng lãi — chỉ chốt khi TEI >= 4.8 (thị trường hưng phấn cực độ).`;

  try {
    const aiText = await executeAIRequest(prompt, INTENT.GENERAL);
    return buildFinalCard({ ...params, aiText, checklist });
  } catch (e) {
    console.error("[Gemini] Error:", e);
    return generateFallbackMessage({ ...params, checklist });
  }
}

function buildChecklist(raw: RawScannerSignal, tier: SignalTier): string {
  const checks: string[] = [];
  if (tier === "LEADER") {
    checks.push(`${raw.rsRating && raw.rsRating >= 85 ? "✅" : "⬜"} ADN Rank ≥ 85 (${raw.rsRating ?? "N/A"})`);
    checks.push(`${raw.isVCP ? "✅" : "⬜"} VCP (Vol co lại)`);
    checks.push(`${raw.emaCross10_30 ? "✅" : "⬜"} EMA10 cắt lên EMA30`);
    checks.push(`${raw.emaCross50_100 ? "✅" : "⬜"} EMA50 cắt lên EMA100`);
    checks.push(`${raw.volRatio && raw.volRatio >= 2 ? "✅" : "⬜"} Vol ≥ 2× TB20 (x${raw.volRatio?.toFixed(1) ?? "N/A"})`);
  } else if (tier === "TRUNG_HAN") {
    checks.push(`${raw.emaCross10_30 ? "✅" : "⬜"} EMA10 cắt lên EMA30`);
    checks.push(`${raw.isDoubleBottom ? "✅" : "⬜"} Mô hình 2 đáy (Double Bottom)`);
    checks.push(`${raw.macdCrossUp ? "✅" : "⬜"} MACD Signal cắt lên`);
    checks.push(`${raw.volRatio && raw.volRatio >= 1.5 ? "✅" : "⬜"} Vol ≥ 1.5× TB20 (x${raw.volRatio?.toFixed(1) ?? "N/A"})`);
  } else if (tier === "NGAN_HAN") {
    checks.push(`${raw.emaCross10_30 ? "✅" : "⬜"} EMA10 cắt lên EMA30`);
    checks.push(`${raw.macdCrossUp ? "✅" : "⬜"} MACD cắt lên`);
    checks.push(`${raw.volRatio && raw.volRatio >= 1.2 ? "✅" : "⬜"} Vol ≥ 1.2× TB20 (x${raw.volRatio?.toFixed(1) ?? "N/A"})`);
  }
  return checks.join("\n");
}

function buildFinalCard(params: {
  ticker: string;
  tier: SignalTier;
  entryPrice: number;
  target: number;
  stoploss: number;
  rrRatio: string;
  navAllocation: number;
  triggerSignal: string;
  seasonalityLabel: string;
  winRate: number;
  sharpeRatio: number;
  aiText?: string;
  checklist?: string;
}): string {
  const tierLabels: Record<SignalTier, string> = {
    LEADER:    "👑 LEADER — Siêu Cổ Phiếu",
    TRUNG_HAN: "🛡️ TRUNG HẠN — Tăng trưởng",
    NGAN_HAN:  "⚡ NGẮN HẠN — Lướt sóng",
    TAM_NGAM:  "🎯 TẦM NGẮM — Tiếp cận",
  };

  const rr = ((params.target - params.entryPrice) / (params.entryPrice - params.stoploss)).toFixed(1);

  return [
    `📊 **${params.ticker}** — ${tierLabels[params.tier]}`,
    ``,
    `🎯 Entry: ${params.entryPrice.toLocaleString()} | ⚠️ Alert: ${params.target.toLocaleString()} | 🛑 SL: ${params.stoploss.toLocaleString()}`,
    `📐 R/R = ${params.rrRatio} | NAV: ${params.navAllocation}%`,
    ``,
    ...(params.checklist ? [`📋 **Checklist:**\n${params.checklist}`, ``] : []),
    `💡 **Trigger:** ${params.triggerSignal}`,
    `📅 **Seasonality:** ${params.seasonalityLabel} (WR: ${params.winRate}%, Sharpe: ${params.sharpeRatio})`,
    ``,
    ...(params.aiText ? [`🤖 **AI nhận định:**\n${params.aiText}`, ``] : []),
    `🔥 **Gồng lãi:** Chốt khi TEI ≥ 4.8 (hưng phấn cực độ) hoặc vi phạm SL.`,
    `⚠️ Tuân thủ stoploss — Không bình quân giá xuống.`,
  ].join("\n");
}

function generateFallbackMessage(params: {
  ticker: string;
  tier: SignalTier;
  entryPrice: number;
  target: number;
  stoploss: number;
  rrRatio: string;
  navAllocation: number;
  triggerSignal: string;
  seasonalityLabel: string;
  winRate: number;
  sharpeRatio: number;
  checklist?: string;
}): string {
  return buildFinalCard({ ...params, aiText: undefined });
}

// ═══════════════════════════════════════════════════════════════════
//  Main Pipeline: processSignals()
//  Gọi Gemini CHỈ 1 lần khi signal vào RADAR lần đầu tiên.
//  KHÔNG gọi Gemini trong lifecycle / PnL updates.
// ═══════════════════════════════════════════════════════════════════

export async function processSignals(
  rawSignals: RawScannerSignal[]
): Promise<ProcessedSignal[]> {
  if (rawSignals.length === 0) return [];

  // Step 2 (BATCH DB-cached): Seasonality cho TẤT CẢ tickers
  const allTickers = [...new Set(rawSignals.map((r) => r.ticker))];
  const seasonalityMap = await getSeasonalityCached(allTickers);

  const results: ProcessedSignal[] = [];

  for (const raw of rawSignals) {
    // Step 1: Map tier + base NAV
    const { tier, baseNav, target, stoploss, rrRatio } = mapToTier(raw);

    // Step 2: Seasonality multiplier
    const seasonality = seasonalityMap[raw.ticker] ?? null;
    const { multiplier, label: seasonalityLabel } = getSeasonalityMultiplier(seasonality);
    const navAllocation = Math.round(baseNav * multiplier);
    const winRate = seasonality?.winRate ?? 0;
    const sharpeRatio = seasonality?.sharpeRatio ?? 0;
    const triggerSignal = raw.reason ?? "Tín hiệu kỹ thuật";

    // Step 3: AIDEN/ADN Pilot message (Gemini) — CHỈ gọi cho signal MỚI
    const aiReasoning = await callGeminiReasoning({
      ticker: raw.ticker,
      tier,
      entryPrice: raw.entryPrice,
      target,
      stoploss,
      rrRatio,
      navAllocation,
      triggerSignal,
      seasonalityLabel,
      winRate,
      sharpeRatio,
      raw,
    });

    results.push({
      ticker: raw.ticker,
      type: raw.type,
      tier,
      status: "RADAR",
      entryPrice: raw.entryPrice,
      target,
      stoploss,
      rrRatio,
      navAllocation,
      triggerSignal,
      aiReasoning,
      reason: raw.reason ?? "",
      winRate,
      sharpeRatio,
    });
  }

  return results;
}
