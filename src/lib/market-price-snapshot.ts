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

export interface StockPriceSnapshot {
  ticker: string;
  price: number | null;
  close: number | null;
  previousClose: number | null;
  change: number | null;
  changePct: number | null;
  latestVolume: number | null;
  volumeMa20: number | null;
  historicalScale: number;
  priceDate: string | null;
  realtimeAt: string | null;
}

interface BuildStockPriceSnapshotInput {
  ticker: string;
  historical?: unknown;
  realtime?: unknown;
  ta?: unknown;
}

function lastRow(payload: unknown): JsonRecord | null {
  const rows = getMarketPayloadRows(payload);
  return rows.length > 0 ? rows[rows.length - 1] : null;
}

function asRecord(value: unknown): JsonRecord {
  return value && typeof value === "object" ? (value as JsonRecord) : {};
}

function readDate(row: JsonRecord | null): string | null {
  if (!row) return null;
  const value = row.date ?? row.time ?? row.timestamp ?? row.tradingDate;
  return typeof value === "string" || typeof value === "number" ? String(value) : null;
}

function readPrice(row: JsonRecord | null): number | null {
  if (!row) return null;
  return readMarketNumber(row.close ?? row.c ?? row.price ?? row.matchPrice ?? row.lastPrice);
}

function readVolume(row: JsonRecord | null): number | null {
  if (!row) return null;
  return readMarketNumber(row.volume ?? row.v ?? row.matchVolume ?? row.totalVolume);
}

function averageVolume20(historical: unknown): number | null {
  const volumes = getMarketPayloadRows(historical)
    .slice(-20)
    .map((row) => readVolume(row))
    .filter((value): value is number => value != null && value > 0);
  if (volumes.length === 0) return null;
  return Math.round(volumes.reduce((sum, value) => sum + value, 0) / volumes.length);
}

function previousCloseFromHistorical(historical: unknown, scale: number): number | null {
  const rows = getMarketPayloadRows(historical);
  if (rows.length < 2) return null;
  return applyMarketPriceScale(readPrice(rows[rows.length - 2]), scale);
}

function pctDiff(current: number | null, previous: number | null): number | null {
  if (current == null || previous == null || previous <= 0) return null;
  return Number((((current - previous) / previous) * 100).toFixed(2));
}

export function normalizeHistoricalPriceWithSnapshot(
  value: number | null | undefined,
  snapshot: StockPriceSnapshot | null | undefined,
): number | null {
  if (value == null || !Number.isFinite(value)) return null;
  const scale = snapshot?.historicalScale && Number.isFinite(snapshot.historicalScale)
    ? snapshot.historicalScale
    : 1;
  return applyMarketPriceScale(value, scale);
}

export function buildStockPriceSnapshot(input: BuildStockPriceSnapshotInput): StockPriceSnapshot {
  const ta = asRecord(input.ta);
  const historicalScale = marketPriceScaleFromPayload(input.historical);
  const historicalClose = latestClosePriceFromPayload(input.historical);
  const turnoverPrice = latestTurnoverPriceFromPayload(input.historical);
  const realtimeRow = lastRow(input.realtime);
  const realtimePriceRaw = readPrice(realtimeRow);
  const realtimePrice = applyMarketPriceScale(realtimePriceRaw, historicalScale);
  const taCurrent = applyMarketPriceScale(readMarketNumber(ta.currentPrice), historicalScale);
  const close = chooseMarketDisplayPrice(realtimePrice ?? historicalClose ?? taCurrent, turnoverPrice);
  const previousClose =
    applyMarketPriceScale(readMarketNumber(ta.prevClose ?? ta.refPrice), historicalScale)
    ?? previousCloseFromHistorical(input.historical, historicalScale);

  return {
    ticker: input.ticker.toUpperCase(),
    price: close,
    close,
    previousClose,
    change: close != null && previousClose != null ? close - previousClose : null,
    changePct: pctDiff(close, previousClose) ?? readMarketNumber(ta.changePct),
    latestVolume: readVolume(realtimeRow) ?? readMarketNumber(ta.latestVolume),
    volumeMa20: readMarketNumber(ta.avgVolume20) ?? averageVolume20(input.historical),
    historicalScale,
    priceDate: readDate(realtimeRow) ?? readDate(lastRow(input.historical)),
    realtimeAt: readDate(realtimeRow),
  };
}
