/**
 * UltimateSignalEngine — 3-Step Pipeline
 * Step 1: VSA/TA scan (3 tier) → base NAV%
 * Step 2: Seasonality filter → multiplier
 * Step 3: Output AI Broker Card JSON
 *
 * Tiers: LEADER (base 30%), TRUNG_HAN (base 20%), NGAN_HAN (base 10%)
 *
 * API Budget: 1 batch-seasonality request cho TẤT CẢ tickers (thay vì N per-ticker)
 */

import { getBatchSeasonality, type SeasonalityItem } from "@/lib/PriceCache";

// ═══════════════════════════════════════════════════════════════════
//  Types
// ═══════════════════════════════════════════════════════════════════

export type SignalTier = "LEADER" | "TRUNG_HAN" | "NGAN_HAN" | "TAM_NGAM";
export type SignalStatus = "RADAR" | "ACTIVE" | "CLOSED";

interface RawScannerSignal {
  ticker: string;
  type: "SIEU_CO_PHIEU" | "TRUNG_HAN" | "DAU_CO" | "TAM_NGAM";
  entryPrice: number;
  reason?: string;
}

export interface ProcessedSignal {
  ticker: string;
  type: "SIEU_CO_PHIEU" | "TRUNG_HAN" | "DAU_CO" | "TAM_NGAM";
  tier: SignalTier;
  status: SignalStatus;
  entryPrice: number;
  target: number;
  stoploss: number;
  navAllocation: number;
  triggerSignal: string;
  aiReasoning: string;
  reason: string;
  winRate: number;
  sharpeRatio: number;
}

// ═══════════════════════════════════════════════════════════════════
//  Constants
// ═══════════════════════════════════════════════════════════════════

const TIER_CONFIG: Record<SignalTier, { baseNav: number; targetPct: number; stopPct: number }> = {
  LEADER:    { baseNav: 30, targetPct: 15, stopPct: 7 },
  TRUNG_HAN: { baseNav: 20, targetPct: 10, stopPct: 5 },
  NGAN_HAN:  { baseNav: 10, targetPct: 7,  stopPct: 3 },
  TAM_NGAM:  { baseNav: 0,  targetPct: 10, stopPct: 5 }, // Chỉ theo dõi, chưa vào lệnh
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
  target: number;
  stoploss: number;
} {
  const tier = TYPE_TO_TIER[signal.type] ?? "NGAN_HAN";
  const cfg = TIER_CONFIG[tier];
  return {
    tier,
    baseNav: cfg.baseNav,
    target: +(signal.entryPrice * (1 + cfg.targetPct / 100)).toFixed(2),
    stoploss: +(signal.entryPrice * (1 - cfg.stopPct / 100)).toFixed(2),
  };
}

// ═══════════════════════════════════════════════════════════════════
//  Step 2: Seasonality multiplier (dùng batch data, KHÔNG gọi API per-ticker)
// ═══════════════════════════════════════════════════════════════════

interface SeasonalityData {
  ticker: string;
  currentMonth: number;
  winRate: number;
  sharpeRatio: number;
}

function getSeasonalityMultiplier(data: SeasonalityData | null): {
  multiplier: number;
  label: string;
} {
  if (!data) return { multiplier: 1.0, label: "N/A" };

  const { winRate, sharpeRatio } = data;

  if (winRate >= 70 && sharpeRatio >= 1.0) {
    return { multiplier: 1.2, label: "Mùa thuận lợi" };
  }
  if (winRate >= 50 && sharpeRatio >= 0.5) {
    return { multiplier: 1.0, label: "Trung tính" };
  }
  return { multiplier: 0.5, label: "Mùa bất lợi" };
}

// ═══════════════════════════════════════════════════════════════════
//  Step 3: Generate AI Broker message
// ═══════════════════════════════════════════════════════════════════

function generateAIBrokerMessage(params: {
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
}): string {
  const tierLabels: Record<SignalTier, string> = {
    LEADER: "👑 LEADER — Siêu Cổ Phiếu",
    TRUNG_HAN: "🛡️ TRUNG HẠN — Tăng trưởng",
    NGAN_HAN: "⚡ NGẮN HẠN — Lướt sóng",
    TAM_NGAM: "🎯 TẦM NGẮM — Tiếp cận",
  };

  const rr = ((params.target - params.entryPrice) / (params.entryPrice - params.stoploss)).toFixed(1);

  return [
    `📊 **${params.ticker}** — ${tierLabels[params.tier]}`,
    ``,
    `🎯 Entry: ${params.entryPrice.toLocaleString()} | Target: ${params.target.toLocaleString()} | Stoploss: ${params.stoploss.toLocaleString()}`,
    `📐 R/R = 1:${rr} | NAV: ${params.navAllocation}%`,
    ``,
    `💡 **Trigger:** ${params.triggerSignal}`,
    `📅 **Seasonality:** ${params.seasonalityLabel} (WR: ${params.winRate}%, Sharpe: ${params.sharpeRatio})`,
    ``,
    `⚠️ Tuân thủ stoploss — Không bình quân giá xuống.`,
  ].join("\n");
}

// ═══════════════════════════════════════════════════════════════════
//  Main Pipeline: processSignals()
//  API Budget: 1 batch-seasonality call cho TẤT CẢ tickers
// ═══════════════════════════════════════════════════════════════════

export async function processSignals(
  rawSignals: RawScannerSignal[]
): Promise<ProcessedSignal[]> {
  if (rawSignals.length === 0) return [];

  // Step 2 (BATCH): Lấy seasonality cho TẤT CẢ tickers trong 1 request
  const allTickers = [...new Set(rawSignals.map((r) => r.ticker))];
  const seasonalityMap = await getBatchSeasonality(allTickers);

  const results: ProcessedSignal[] = [];

  for (const raw of rawSignals) {
    // Step 1: Map tier + base NAV
    const { tier, baseNav, target, stoploss } = mapToTier(raw);

    // Step 2: Seasonality multiplier (từ batch data đã fetch ở trên)
    const seasonality = seasonalityMap[raw.ticker] ?? null;
    const { multiplier, label: seasonalityLabel } = getSeasonalityMultiplier(seasonality);
    const navAllocation = Math.round(baseNav * multiplier);

    // Step 3: AI Broker message
    const winRate = seasonality?.winRate ?? 0;
    const sharpeRatio = seasonality?.sharpeRatio ?? 0;

    const aiReasoning = generateAIBrokerMessage({
      ticker: raw.ticker,
      tier,
      entryPrice: raw.entryPrice,
      target,
      stoploss,
      navAllocation,
      triggerSignal: raw.reason ?? "Tín hiệu kỹ thuật",
      seasonalityLabel,
      winRate,
      sharpeRatio,
    });

    results.push({
      ticker: raw.ticker,
      type: raw.type,
      tier,
      status: "RADAR",
      entryPrice: raw.entryPrice,
      target,
      stoploss,
      navAllocation,
      triggerSignal: raw.reason ?? "Tín hiệu kỹ thuật",
      aiReasoning,
      reason: raw.reason ?? "",
      winRate,
      sharpeRatio,
    });
  }

  return results;
}
