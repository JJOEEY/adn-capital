export type RadarScanMode = "hot" | "wide";

export const RADAR_SCAN_BUDGET = {
  monthlyQuota: 400_000,
  warningPct: 70,
  throttlePct: 85,
  criticalPct: 95,
  hotUniverseSize: 150,
  wideUniverseSize: 500,
  deepCandidateLimit: 30,
} as const;

const WIDE_SCAN_SLOTS = new Set(["10:00", "14:00"]);

export function estimateRadarScanCost(mode: RadarScanMode): number {
  return mode === "wide" ? RADAR_SCAN_BUDGET.wideUniverseSize : RADAR_SCAN_BUDGET.hotUniverseSize;
}

export function chooseRadarScanMode(timeKey: string, monthlyUsedPct: number): RadarScanMode | null {
  if (monthlyUsedPct >= RADAR_SCAN_BUDGET.criticalPct) {
    return WIDE_SCAN_SLOTS.has(timeKey) ? "hot" : null;
  }

  if (monthlyUsedPct >= RADAR_SCAN_BUDGET.throttlePct) {
    return "hot";
  }

  return WIDE_SCAN_SLOTS.has(timeKey) ? "wide" : "hot";
}
