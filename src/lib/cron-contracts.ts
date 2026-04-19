export type CanonicalCronType =
  | "morning_brief"
  | "close_brief_15h"
  | "eod_full_19h"
  | "market_stats_type2"
  | "signal_scan_type1";

export const CRON_TYPE_ALIASES: Record<string, CanonicalCronType> = {
  morning_brief: "morning_brief",
  close_brief_15h: "close_brief_15h",
  eod_full_19h: "eod_full_19h",
  market_stats_type2: "market_stats_type2",
  signal_scan_type1: "signal_scan_type1",

  // legacy aliases
  prop_trading: "eod_full_19h",
  intraday: "market_stats_type2",
  market_stats: "market_stats_type2",
  signal_scan_5m: "signal_scan_type1",
};

export const LEGACY_CRON_ALIASES = ["prop_trading", "intraday", "market_stats", "signal_scan_5m"] as const;

export const SIGNAL_SCANNER_CRON_NAMES = [
  "signal_scan_type1",
  "signal_scan_5m",
  "signal_scan",
  "scan-signals",
  "scan_signals",
] as const;

export function normalizeCronType(input: string | null): CanonicalCronType | null {
  if (!input) return null;
  return CRON_TYPE_ALIASES[input] ?? null;
}

