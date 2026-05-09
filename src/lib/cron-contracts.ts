export type CanonicalCronType =
  | "morning_brief"
  | "close_brief_15h"
  | "eod_full_19h"
  | "market_stats_type2"
  | "signal_scan_type1"
  | "news_crawler"
  | "adn_rank_15h";

export const CANONICAL_CRON_TYPES: readonly CanonicalCronType[] = [
  "morning_brief",
  "close_brief_15h",
  "eod_full_19h",
  "market_stats_type2",
  "signal_scan_type1",
  "news_crawler",
  "adn_rank_15h",
] as const;

export const CRON_TYPE_ALIASES: Record<string, CanonicalCronType> = {
  morning_brief: "morning_brief",
  close_brief_15h: "close_brief_15h",
  eod_full_19h: "eod_full_19h",
  market_stats_type2: "market_stats_type2",
  signal_scan_type1: "signal_scan_type1",
  news_crawler: "news_crawler",
  adn_rank_15h: "adn_rank_15h",

  // legacy aliases
  prop_trading: "eod_full_19h",
  intraday: "market_stats_type2",
  market_stats: "market_stats_type2",
  signal_scan_5m: "signal_scan_type1",
  signal_scan: "signal_scan_type1",
  "scan-signals": "signal_scan_type1",
  scan_signals: "signal_scan_type1",
  news_crawl: "news_crawler",
  crawler_news: "news_crawler",
  crawler: "news_crawler",
  adn_rank: "adn_rank_15h",
  rs_rating_15h: "adn_rank_15h",
  rs_rating: "adn_rank_15h",
};

export const LEGACY_CRON_ALIASES = [
  "prop_trading",
  "intraday",
  "market_stats",
  "signal_scan_5m",
  "signal_scan",
  "scan-signals",
  "scan_signals",
  "news_crawl",
  "crawler_news",
  "crawler",
  "adn_rank",
  "rs_rating_15h",
  "rs_rating",
] as const;

export const SIGNAL_SCANNER_CANONICAL_NAME: CanonicalCronType = "signal_scan_type1";
export const SIGNAL_SCANNER_LEGACY_NAMES = ["signal_scan_5m", "signal_scan", "scan-signals", "scan_signals"] as const;

export function normalizeCronType(input: string | null): CanonicalCronType | null {
  if (!input) return null;
  return CRON_TYPE_ALIASES[input] ?? null;
}

export function cronAliasesForCanonical(canonical: CanonicalCronType): string[] {
  return Object.keys(CRON_TYPE_ALIASES).filter((key) => CRON_TYPE_ALIASES[key] === canonical);
}
