/**
 * Lightweight scan-slot constants. Keep this file dependency-free so core
 * DataHub registry imports do not pull the signal engine into every route.
 */
export const SIGNAL_SCAN_SLOTS = ["10:00", "10:30", "14:00", "14:25"] as const;
export type SignalScanSlot = (typeof SIGNAL_SCAN_SLOTS)[number];
export const SIGNAL_SCAN_SLOT_SET = new Set<string>(SIGNAL_SCAN_SLOTS);
