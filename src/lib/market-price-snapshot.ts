import {
  applyMarketPriceScale,
  chooseMarketDisplayPrice,
  getMarketPayloadRows,
  latestClosePriceFromPayload,
  latestTurnoverPriceFromPayload,
  marketPriceScaleFromPayload,
  readMarketNumber,
} from "@/lib/market-price-normalization";

type JsonRecord = Record<string, unknown>;

export type StockPriceSnapshot = {
  ticker: string;
  price: number | null;
  close: number | null;
  previousClose: number | null;
  change: number | null;
  changePct: number | null;
  latestVolume: number | null;
  volumeMa20: number | null;
  priceDate: string | null;
  realtimeAt: string | null;
  historicalClose: number | null;
  historicalTurnoverPrice: number | null;
  realtimeClose: number | null;
  realtimePrice: number | null;
  historicalScale: number;
  realtimeScale: number;
  selected: "realtime" | "historical" | "ta" | "none";
  consistency: {
    realtimeAccepted: boolean;
    realtimeVsHistoricalPct: number | null;
    historicalTurnoverVsClosePct: number | null;
  };
};

function asRecord(value: unknown): JsonRecord {
  return value && typeof value === "object" ? (value as JsonRecord) : {};
}

function roundPrice(value: number | null | undefined) {
  if (value == null || !Number.isFinite(value)) return null;
  return Math.round(value / 10) * 10;
}

function lastRow(value: unknown) {
  const rows = getMarketPayloadRows(value);
  return rows.length > 0 ? rows[rows.length - 1] : null;
}

function previousRow(value: unknown) {
  const rows = getMarketPayloadRows(value);
  return rows.length > 1 ? rows[rows.length - 2] : null;
}

function readClose(row: unknown) {
  const record = asRecord(row);
  return readMarketNumber(record.close ?? record.c ?? record.price);
}

function readVolume(row: unknown) {
  const record = asRecord(row);
  return readMarketNumber(record.volume ?? record.v);
}

function readRowTime(row: unknown) {
  const record = asRecord(row);
  const raw = record.time ?? record.timestamp ?? record.date;
  return typeof raw === "string" || typeof raw === "number" ? String(raw) : null;
}

function pctDiff(value: number | null, base: number | null) {
  if (value == null || base == null || base === 0) return null;
  return Number((((value - base) / base) * 100).toFixed(2));
}

export function alignPriceToAnchor(value: number | null | undefined, anchor: number | null | undefined) {
  if (value == null || !Number.isFinite(value) || value <= 0) return null;
  const cleanAnchor = anchor != null && Number.isFinite(anchor) && anchor > 0 ? anchor : null;

  if (!cleanAnchor) {
    return roundPrice(value > 0 && value < 1000 ? value * 1000 : value);
  }

  const candidates = [1, 10, 100, 1000, 0.1, 0.01, 0.001]
    .map((factor) => ({ factor, price: value * factor }))
    .filter((item) => item.price > 0);

  const best = candidates.reduce((winner, item) => {
    const winnerDiff = Math.abs(winner.price - cleanAnchor) / cleanAnchor;
    const itemDiff = Math.abs(item.price - cleanAnchor) / cleanAnchor;
    return itemDiff < winnerDiff ? item : winner;
  }, candidates[0]);

  const bestDiff = Math.abs(best.price - cleanAnchor) / cleanAnchor;
  if (bestDiff <= 0.35) return roundPrice(best.price);
  if (value < 1000 && cleanAnchor >= 1000) return roundPrice(value * 1000);
  return roundPrice(value);
}

export function buildStockPriceSnapshot(input: {
  ticker: string;
  historical: unknown;
  realtime?: unknown;
  ta?: unknown;
}): StockPriceSnapshot {
  const ticker = input.ticker.toUpperCase().trim();
  const ta = asRecord(input.ta);
  const historicalLast = lastRow(input.historical);
  const historicalPrev = previousRow(input.historical);
  const realtimeLast = lastRow(input.realtime);
  const historicalScale = marketPriceScaleFromPayload(input.historical);
  const historicalClose = latestClosePriceFromPayload(input.historical);
  const historicalTurnoverPrice = latestTurnoverPriceFromPayload(input.historical);
  const close = chooseMarketDisplayPrice(historicalClose, historicalTurnoverPrice);
  const previousClose =
    alignPriceToAnchor(readClose(historicalPrev), close) ??
    alignPriceToAnchor(readMarketNumber(ta.refPrice ?? ta.prevClose), close);
  const realtimeClose = readClose(realtimeLast);
  const realtimePrice = alignPriceToAnchor(realtimeClose, close);
  const realtimeVsHistoricalPct = pctDiff(realtimePrice, close);
  const realtimeAccepted =
    realtimePrice != null &&
    (close == null || Math.abs(realtimeVsHistoricalPct ?? 0) <= 30);
  const taPrice = alignPriceToAnchor(readMarketNumber(ta.currentPrice), close);
  const price = realtimeAccepted ? realtimePrice : close ?? taPrice;
  const selected = realtimeAccepted ? "realtime" : close != null ? "historical" : taPrice != null ? "ta" : "none";
  const change =
    price != null && previousClose != null
      ? Number((price - previousClose).toFixed(2))
      : readMarketNumber(ta.change);
  const changePct =
    price != null && previousClose != null && previousClose > 0
      ? Number((((price - previousClose) / previousClose) * 100).toFixed(2))
      : readMarketNumber(ta.changePct);

  return {
    ticker,
    price: price ?? null,
    close: close ?? null,
    previousClose: previousClose ?? null,
    change: change ?? null,
    changePct: changePct ?? null,
    latestVolume: readVolume(realtimeLast) ?? readVolume(historicalLast),
    volumeMa20: readMarketNumber(ta.avgVolume20),
    priceDate: readRowTime(historicalLast),
    realtimeAt: readRowTime(realtimeLast),
    historicalClose,
    historicalTurnoverPrice,
    realtimeClose,
    realtimePrice,
    historicalScale,
    realtimeScale: realtimeClose != null && realtimePrice != null && realtimeClose > 0 ? realtimePrice / realtimeClose : 1,
    selected,
    consistency: {
      realtimeAccepted,
      realtimeVsHistoricalPct,
      historicalTurnoverVsClosePct: pctDiff(historicalTurnoverPrice, historicalClose),
    },
  };
}

export function normalizePriceWithSnapshot(value: number | null | undefined, snapshot: StockPriceSnapshot) {
  return alignPriceToAnchor(value, snapshot.price ?? snapshot.close);
}

export function normalizeHistoricalPriceWithSnapshot(value: number | null | undefined, snapshot: StockPriceSnapshot) {
  if (value == null || !Number.isFinite(value)) return null;
  const scaled = applyMarketPriceScale(value, snapshot.historicalScale || 1);
  return alignPriceToAnchor(scaled, snapshot.price ?? snapshot.close);
}
