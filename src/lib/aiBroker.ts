import { prisma } from "@/lib/prisma";
import { getSetting } from "@/lib/settings";

export interface AiBrokerRuntimeConfig {
  minPrice: number;
  minWinRate: number;
  maxRr: number;
  maxTotalNav: number;
}

const DEFAULT_CONFIG: AiBrokerRuntimeConfig = {
  minPrice: 10,
  minWinRate: 60,
  maxRr: 2,
  maxTotalNav: 90,
};

function toFiniteNumber(value: string, fallback: number): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

export async function getAiBrokerRuntimeConfig(): Promise<AiBrokerRuntimeConfig> {
  const [minPriceRaw, minWinRateRaw, maxRrRaw, maxTotalNavRaw] = await Promise.all([
    getSetting("AI_BROKER_MIN_PRICE", String(DEFAULT_CONFIG.minPrice)),
    getSetting("AI_BROKER_MIN_WINRATE", String(DEFAULT_CONFIG.minWinRate)),
    getSetting("AI_BROKER_MAX_RR", String(DEFAULT_CONFIG.maxRr)),
    getSetting("AI_BROKER_MAX_TOTAL_NAV", String(DEFAULT_CONFIG.maxTotalNav)),
  ]);

  const minPrice = clamp(toFiniteNumber(minPriceRaw, DEFAULT_CONFIG.minPrice), 1, 1_000_000);
  const minWinRate = clamp(toFiniteNumber(minWinRateRaw, DEFAULT_CONFIG.minWinRate), 0, 100);
  const maxRr = clamp(toFiniteNumber(maxRrRaw, DEFAULT_CONFIG.maxRr), 0.1, 10);
  const maxTotalNav = clamp(toFiniteNumber(maxTotalNavRaw, DEFAULT_CONFIG.maxTotalNav), 1, 99);

  return { minPrice, minWinRate, maxRr, maxTotalNav };
}

export function parseRrRatio(rrRatio: string | null | undefined): number | null {
  if (!rrRatio) return null;

  const direct = Number(rrRatio);
  if (Number.isFinite(direct)) return direct;

  const parts = rrRatio.split(":");
  if (parts.length !== 2) return null;

  const value = Number(parts[1]);
  return Number.isFinite(value) ? value : null;
}

export function shouldAutoActivateSignal(
  params: {
    entryPrice: number;
    currentPrice?: number | null;
    winRate?: number | null;
    rrRatio?: string | null;
  },
  config: AiBrokerRuntimeConfig
): boolean {
  const priceNow = params.currentPrice ?? params.entryPrice;
  const rr = parseRrRatio(params.rrRatio);
  const winRate = params.winRate ?? 0;

  if (!Number.isFinite(priceNow) || !Number.isFinite(params.entryPrice)) return false;
  if (priceNow <= config.minPrice) return false;
  if (winRate < config.minWinRate) return false;
  if (rr == null || rr > config.maxRr) return false;
  if (params.entryPrice > priceNow) return false;

  return true;
}

export async function rebalanceActiveBasketNav(maxTotalNav: number): Promise<void> {
  const cap = clamp(maxTotalNav, 1, 99);
  const activeSignals = await prisma.signal.findMany({
    where: { status: "ACTIVE" },
    select: { id: true, navAllocation: true, createdAt: true },
    orderBy: [{ createdAt: "asc" }, { id: "asc" }],
  });

  if (activeSignals.length === 0) return;

  const rawWeights = activeSignals.map((s) => Math.max(0.1, s.navAllocation || 0.1));
  const totalRaw = rawWeights.reduce((sum, value) => sum + value, 0);
  if (totalRaw <= 0) return;

  const allocations = rawWeights.map((value) => Number(((value / totalRaw) * cap).toFixed(2)));
  const roundedTotal = allocations.reduce((sum, value) => sum + value, 0);
  const delta = Number((cap - roundedTotal).toFixed(2));
  if (Math.abs(delta) > 0) {
    allocations[allocations.length - 1] = Number((allocations[allocations.length - 1] + delta).toFixed(2));
  }

  const updates = activeSignals
    .map((signal, index) => ({
      id: signal.id,
      current: Number((signal.navAllocation ?? 0).toFixed(2)),
      next: allocations[index],
    }))
    .filter((item) => Math.abs(item.current - item.next) >= 0.01)
    .map((item) =>
      prisma.signal.update({
        where: { id: item.id },
        data: { navAllocation: item.next },
      })
    );

  if (updates.length > 0) {
    await prisma.$transaction(updates);
  }
}

