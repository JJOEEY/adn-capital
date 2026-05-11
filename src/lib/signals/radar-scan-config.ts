export const SIGNAL_SCAN_SLOTS = ["10:00", "10:30", "14:00", "14:25"] as const;

export const SIGNAL_SCAN_SLOT_SET = new Set<string>(SIGNAL_SCAN_SLOTS);

export const RADAR_SCAN_BUDGET = {
  monthlyQuota: 400_000,
  hotScanMaxTickers: 150,
  wideScanMaxTickers: 500,
  deepConfirmMaxTickers: 30,
  quotaGuard: {
    slowDownPct: 70,
    criticalPct: 85,
    emergencyPct: 95,
  },
} as const;

export type RadarScanMode = "hot" | "wide" | "deep";

export function chooseRadarScanMode(slot: string, monthlyUsedPct = 0): RadarScanMode | null {
  const normalizedSlot = slot.trim();

  if (monthlyUsedPct >= RADAR_SCAN_BUDGET.quotaGuard.emergencyPct) {
    return normalizedSlot === "10:00" || normalizedSlot === "14:25" ? "hot" : null;
  }

  if (monthlyUsedPct >= RADAR_SCAN_BUDGET.quotaGuard.criticalPct) {
    return normalizedSlot === "10:00" || normalizedSlot === "14:25" ? "hot" : null;
  }

  if (monthlyUsedPct >= RADAR_SCAN_BUDGET.quotaGuard.slowDownPct) {
    return normalizedSlot === "10:00" || normalizedSlot === "14:25" ? "wide" : "hot";
  }

  return normalizedSlot === "10:00" || normalizedSlot === "14:25" ? "wide" : "hot";
}
