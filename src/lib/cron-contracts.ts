export type CanonicalCronType =
  | "morning_brief"
  | "close_brief_15h"
  | "eod_full_19h"
  | "market_stats_type2"
  | "signal_scan_type1"
  | "news_crawler"
  | "adn_rank_15h"
  | "pulse_smartflow_precompute"
  | "art_daily_1905"
  | "database_news_collect"
  | "database_dnse_market_collect"
  | "database_morning_readiness"
  | "database_morning_brief"
  | "database_eod_collect"
  | "database_eod_readiness"
  | "database_radar_realtime_collect"
  | "database_realtime_health"
  | "database_adn_radar_collect"
  | "database_adn_radar_readiness"
  | "database_adn_art_collect"
  | "database_adn_art_readiness"
  | "database_adncore_collect"
  | "database_adncore_readiness"
  | "database_adn_rank_collect"
  | "database_adn_rank_readiness"
  | "database_aiden_context_collect";

export const CANONICAL_CRON_TYPES: readonly CanonicalCronType[] = [
  "morning_brief",
  "close_brief_15h",
  "eod_full_19h",
  "market_stats_type2",
  "signal_scan_type1",
  "news_crawler",
  "adn_rank_15h",
  "pulse_smartflow_precompute",
  "art_daily_1905",
  "database_news_collect",
  "database_dnse_market_collect",
  "database_morning_readiness",
  "database_morning_brief",
  "database_eod_collect",
  "database_eod_readiness",
  "database_radar_realtime_collect",
  "database_realtime_health",
  "database_adn_radar_collect",
  "database_adn_radar_readiness",
  "database_adn_art_collect",
  "database_adn_art_readiness",
  "database_adncore_collect",
  "database_adncore_readiness",
  "database_adn_rank_collect",
  "database_adn_rank_readiness",
  "database_aiden_context_collect",
] as const;

export const CRON_TYPE_ALIASES: Record<string, CanonicalCronType> = {
  morning_brief: "morning_brief",
  close_brief_15h: "close_brief_15h",
  eod_full_19h: "eod_full_19h",
  market_stats_type2: "market_stats_type2",
  signal_scan_type1: "signal_scan_type1",
  news_crawler: "news_crawler",
  adn_rank_15h: "adn_rank_15h",
  pulse_smartflow_precompute: "pulse_smartflow_precompute",
  art_daily_1905: "art_daily_1905",
  database_news_collect: "database_news_collect",
  database_dnse_market_collect: "database_dnse_market_collect",
  database_morning_readiness: "database_morning_readiness",
  database_morning_brief: "database_morning_brief",
  database_eod_collect: "database_eod_collect",
  database_eod_readiness: "database_eod_readiness",
  database_radar_realtime_collect: "database_radar_realtime_collect",
  database_realtime_health: "database_realtime_health",
  database_adn_radar_collect: "database_adn_radar_collect",
  database_adn_radar_readiness: "database_adn_radar_readiness",
  database_adn_art_collect: "database_adn_art_collect",
  database_adn_art_readiness: "database_adn_art_readiness",
  database_adncore_collect: "database_adncore_collect",
  database_adncore_readiness: "database_adncore_readiness",
  database_adn_rank_collect: "database_adn_rank_collect",
  database_adn_rank_readiness: "database_adn_rank_readiness",
  database_aiden_context_collect: "database_aiden_context_collect",

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
  smartflow: "pulse_smartflow_precompute",
  adn_smartflow: "pulse_smartflow_precompute",
  art_daily: "art_daily_1905",
  adn_art_1905: "art_daily_1905",
  art_1905: "art_daily_1905",
  database_v2_news_collect: "database_news_collect",
  database_v2_dnse_market_collect: "database_dnse_market_collect",
  database_v2_morning_readiness: "database_morning_readiness",
  database_v2_morning_brief: "database_morning_brief",
  database_v2_eod_collect: "database_eod_collect",
  database_v2_eod_readiness: "database_eod_readiness",
  database_v2_radar_realtime_collect: "database_radar_realtime_collect",
  database_v2_realtime_health: "database_realtime_health",
  database_v2_adn_radar_collect: "database_adn_radar_collect",
  database_v2_adn_radar_readiness: "database_adn_radar_readiness",
  database_v2_adn_art_collect: "database_adn_art_collect",
  database_v2_adn_art_readiness: "database_adn_art_readiness",
  database_v2_adncore_collect: "database_adncore_collect",
  database_v2_adncore_readiness: "database_adncore_readiness",
  database_v2_adn_rank_collect: "database_adn_rank_collect",
  database_v2_adn_rank_readiness: "database_adn_rank_readiness",
  database_v2_aiden_context_collect: "database_aiden_context_collect",
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
  "smartflow",
  "adn_smartflow",
  "art_daily",
  "adn_art_1905",
  "art_1905",
  "database_v2_news_collect",
  "database_v2_dnse_market_collect",
  "database_v2_morning_readiness",
  "database_v2_morning_brief",
  "database_v2_eod_collect",
  "database_v2_eod_readiness",
  "database_v2_radar_realtime_collect",
  "database_v2_realtime_health",
  "database_v2_adn_radar_collect",
  "database_v2_adn_radar_readiness",
  "database_v2_adn_art_collect",
  "database_v2_adn_art_readiness",
  "database_v2_adncore_collect",
  "database_v2_adncore_readiness",
  "database_v2_adn_rank_collect",
  "database_v2_adn_rank_readiness",
  "database_v2_aiden_context_collect",
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
