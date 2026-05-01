type JsonRecord = Record<string, unknown>;

function asRecord(value: unknown): JsonRecord {
  return value && typeof value === "object" ? (value as JsonRecord) : {};
}

export function readMarketNumber(value: unknown): number | null {
  if (value == null || value === "") return null;
  const numberValue = Number(value);
  return Number.isFinite(numberValue) ? numberValue : null;
}

export function getMarketPayloadRows(value: unknown): JsonRecord[] {
  const record = asRecord(value);
  const rows = Array.isArray(record.data)
    ? record.data
    : Array.isArray(record.candles)
      ? record.candles
      : Array.isArray(record.items)
        ? record.items
        : Array.isArray(value)
          ? value
          : [];

  return rows
    .filter((row): row is JsonRecord => Boolean(row) && typeof row === "object")
    .map((row) => row as JsonRecord);
}

export function median(values: number[]): number | null {
  const clean = values.filter((value) => Number.isFinite(value)).sort((a, b) => a - b);
  if (clean.length === 0) return null;
  const middle = Math.floor(clean.length / 2);
  return clean.length % 2 === 0 ? (clean[middle - 1] + clean[middle]) / 2 : clean[middle];
}

export function latestTurnoverPriceFromRows(rows: JsonRecord[]): number | null {
  for (let index = rows.length - 1; index >= 0; index -= 1) {
    const row = rows[index];
    const volume = readMarketNumber(row.volume ?? row.v);
    const value = readMarketNumber(row.value ?? row.tradingValue ?? row.amount);
    if (volume != null && value != null && volume > 0 && value > 0) {
      return Math.round((value / volume) / 10) * 10;
    }
  }
  return null;
}

export function latestClosePriceFromRows(rows: JsonRecord[], scale = 1): number | null {
  for (let index = rows.length - 1; index >= 0; index -= 1) {
    const row = rows[index];
    const close = readMarketNumber(row.close ?? row.c ?? row.price);
    const scaled = applyMarketPriceScale(close, scale);
    if (scaled != null && scaled > 0) return scaled;
  }
  return null;
}

export function estimatePriceScaleFromRows(rows: JsonRecord[]): number {
  const ratios = rows
    .slice(-40)
    .map((row) => {
      const close = readMarketNumber(row.close ?? row.c ?? row.price);
      const volume = readMarketNumber(row.volume ?? row.v);
      const value = readMarketNumber(row.value ?? row.tradingValue ?? row.amount);
      if (close == null || volume == null || value == null || close <= 0 || volume <= 0 || value <= 0) {
        return null;
      }
      const averageTradePrice = value / volume;
      const ratio = averageTradePrice / close;
      return ratio > 0.2 && ratio < 5 ? ratio : null;
    })
    .filter((value): value is number => value != null);

  const ratio = median(ratios);
  if (ratio == null) return 1;
  return Math.abs(ratio - 1) >= 0.08 ? ratio : 1;
}

export function applyMarketPriceScale(value: number | null | undefined, scale: number): number | null {
  if (value == null || !Number.isFinite(value)) return null;
  return Math.round((value * scale) / 10) * 10;
}

export function chooseMarketDisplayPrice(
  primary: number | null | undefined,
  turnoverPrice: number | null | undefined,
): number | null {
  const base = primary != null && Number.isFinite(primary) ? primary : null;
  const turnover = turnoverPrice != null && Number.isFinite(turnoverPrice) ? turnoverPrice : null;
  if (base == null) return turnover;
  if (turnover == null) return base;
  return Math.abs(turnover - base) / Math.max(1, base) >= 0.08 ? turnover : base;
}

export function normalizeHistoricalPricePayload<T>(payload: T): T {
  const rows = getMarketPayloadRows(payload);
  const scale = estimatePriceScaleFromRows(rows);
  if (scale === 1) return payload;

  const normalizedRows = rows.map((row) => ({
    ...row,
    open: applyMarketPriceScale(readMarketNumber(row.open ?? row.o), scale) ?? row.open,
    high: applyMarketPriceScale(readMarketNumber(row.high ?? row.h), scale) ?? row.high,
    low: applyMarketPriceScale(readMarketNumber(row.low ?? row.l), scale) ?? row.low,
    close: applyMarketPriceScale(readMarketNumber(row.close ?? row.c ?? row.price), scale) ?? row.close,
  }));

  if (payload && typeof payload === "object") {
    const record = payload as JsonRecord;
    if (Array.isArray(record.data)) return { ...record, data: normalizedRows } as T;
    if (Array.isArray(record.candles)) return { ...record, candles: normalizedRows } as T;
    if (Array.isArray(record.items)) return { ...record, items: normalizedRows } as T;
  }

  return normalizedRows as T;
}

export function marketPriceScaleFromPayload(payload: unknown): number {
  return estimatePriceScaleFromRows(getMarketPayloadRows(payload));
}

export function latestTurnoverPriceFromPayload(payload: unknown): number | null {
  return latestTurnoverPriceFromRows(getMarketPayloadRows(payload));
}

export function latestClosePriceFromPayload(payload: unknown): number | null {
  const rows = getMarketPayloadRows(payload);
  return latestClosePriceFromRows(rows, estimatePriceScaleFromRows(rows));
}
