import type { DnseEodFieldMapItem } from "./types";

export const DNSE_INDEX_SYMBOLS = new Set(["VNINDEX", "VN30", "VN30F1M", "HNXINDEX", "HNX30", "UPCOMINDEX"]);
export const DNSE_REQUIRED_EOD_INDICES = ["VNINDEX", "VN30", "HNX", "UPCOM"] as const;
export const DNSE_DEFAULT_EOD_SYMBOLS = ["HPG", "FPT", "DGC", "SSI", "VHM", "VIC", "VCB"] as const;

export const DNSE_EOD_FIELD_MAP: DnseEodFieldMapItem[] = [
  {
    field: "date",
    source: "computed_from_dnse_ws",
    dnseChannels: ["market_index.*.json", "ohlc_closed.1D.json"],
    dnseFields: ["transactTime", "time", "timestamp"],
    fallbackSource: "adn",
    note: "EOD date is derived from DNSE timestamps or the ADN trading date.",
  },
  {
    field: "vnindex/value/change/change_pct",
    source: "dnse_ws",
    dnseChannels: ["market_index.VNINDEX.json"],
    dnseFields: ["valueIndexes", "changedValue", "changedRatio", "priorValueIndexes"],
    fallbackSource: null,
    note: "Main index level and movement.",
  },
  {
    field: "sub_indices",
    source: "dnse_ws",
    dnseChannels: ["market_index.VN30.json", "market_index.HNX.json", "market_index.UPCOM.json"],
    dnseFields: ["valueIndexes", "changedValue", "changedRatio"],
    fallbackSource: null,
    note: "VN30, HNX and UPCOM index values.",
  },
  {
    field: "breadth",
    source: "dnse_ws",
    dnseChannels: ["market_index.*.json"],
    dnseFields: [
      "fluctuationUpIssueCount",
      "fluctuationDownIssueCount",
      "fluctuationSteadinessIssueCount",
      "fluctuationUpperLimitIssueCount",
      "fluctuationLowerLimitIssueCount",
    ],
    fallbackSource: null,
    note: "Market breadth from index statistics.",
  },
  {
    field: "liquidity/total_liquidity/matched_liquidity/liquidity_by_exchange",
    source: "dnse_ws",
    dnseChannels: ["market_index.VNINDEX.json", "market_index.HNX.json", "market_index.UPCOM.json"],
    dnseFields: ["contauctAccTrdVal", "contauctAccTrdVol", "grossTradeAmount", "totalVolumeTraded"],
    fallbackSource: null,
    note: "Matched value and volume by exchange/index.",
  },
  {
    field: "negotiated_liquidity",
    source: "dnse_ws",
    dnseChannels: ["market_index.*.json"],
    dnseFields: ["blkTrdAccTrdVal", "blkTrdAccTrdVol"],
    fallbackSource: null,
    note: "Put-through/block trade value if available from DNSE.",
  },
  {
    field: "ohlcv_1d",
    source: "dnse_ws",
    dnseChannels: ["ohlc_closed.1D.json", "tick_extra.G1.json"],
    dnseFields: ["open", "openPrice", "high", "highestPrice", "low", "lowestPrice", "close", "matchPrice", "volume", "totalVolumeTraded", "value", "grossTradeAmount"],
    fallbackSource: null,
    note: "Daily OHLCV captured by the live collector.",
  },
  {
    field: "foreign_flow/foreign_top_buy/foreign_top_sell",
    source: "computed_from_dnse_ws",
    dnseChannels: ["foreign.G1.json"],
    dnseFields: ["totalBuyTradedAmount", "totalSellTradedAmount", "buyTradedAmount", "sellTradedAmount"],
    fallbackSource: null,
    note: "Foreign net flow computed from buy and sell values.",
  },
  {
    field: "prop_trading_top_buy/prop_trading_top_sell/notable_trades.proprietary",
    source: "fiinquant_fallback",
    dnseChannels: [],
    dnseFields: [],
    fallbackSource: "fiinquant",
    note: "Proprietary flow is not covered by the current DNSE LightSpeed map.",
  },
  {
    field: "individual_top_buy/individual_top_sell/notable_trades.retail",
    source: "fiinquant_fallback",
    dnseChannels: [],
    dnseFields: [],
    fallbackSource: "fiinquant",
    note: "Retail flow is not covered by the current DNSE LightSpeed map.",
  },
  {
    field: "sector_gainers/sector_losers",
    source: "computed_from_dnse_ws",
    dnseChannels: ["tick_extra.G1.json", "ohlc_closed.1D.json"],
    dnseFields: ["symbol", "matchPrice", "changedRatio", "close", "volume"],
    fallbackSource: "adn",
    note: "Sector output needs ADN sector mapping on top of DNSE prices.",
  },
  {
    field: "buy_signals/sell_signals/top_breakout/top_new_high",
    source: "adn_computed",
    dnseChannels: ["tick_extra.G1.json", "ohlc_closed.1D.json"],
    dnseFields: ["symbol", "matchPrice", "highestPrice", "lowestPrice", "totalVolumeTraded"],
    fallbackSource: "adn",
    note: "Signals are ADN-computed from stored price and volume data.",
  },
  {
    field: "session_summary/liquidity_detail/foreign_flow/notable_trades/outlook",
    source: "computed_from_dnse_ws",
    dnseChannels: ["market_index.*.json", "foreign.G1.json"],
    dnseFields: ["fieldMap-derived"],
    fallbackSource: "adn",
    note: "Brief text is generated from mapped fields, not directly from DNSE.",
  },
];

export function normalizeDnseSymbol(value: string | null | undefined) {
  const normalized = (value ?? "").trim().toUpperCase().replace(/[^A-Z0-9._-]/g, "").slice(0, 16);
  const compact = normalized.replace(/[^A-Z0-9]/g, "");
  if (compact === "HNX") return "HNXINDEX";
  if (compact === "HNX30" || compact === "HNX30INDEX") return "HNX30";
  if (compact === "UPCOM" || compact === "UPINDEX") return "UPCOMINDEX";
  if (compact === "VN30INDEX") return "VN30";
  if (compact === "VN30F1M" || compact.startsWith("VN30F")) return "VN30F1M";
  return normalized;
}

export function normalizeDnseIndexSymbol(value: string) {
  return normalizeDnseSymbol(value).replace(/[^A-Z0-9]/g, "");
}

export function toDnseWireSymbol(symbol: string) {
  const normalized = normalizeDnseIndexSymbol(symbol);
  if (normalized === "HNXINDEX") return "HNX";
  if (normalized === "UPCOMINDEX") return "UPCOM";
  return normalized;
}

export function dnseEodChannels(symbols: string[]) {
  const normalized = Array.from(new Set(symbols.map(normalizeDnseSymbol).filter(Boolean))).slice(0, 100);
  return [
    ...DNSE_REQUIRED_EOD_INDICES.map((index) => ({ name: `market_index.${index}.json`, symbols: [] })),
    { name: "foreign.G1.json", symbols: normalized },
    { name: "ohlc_closed.1D.json", symbols: [...normalized, "VN30"] },
    { name: "tick_extra.G1.json", symbols: normalized },
  ];
}
