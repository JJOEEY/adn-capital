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
  // Only a clean power-of-10 gap is a real unit mismatch (close quoted in thousands
  // vs VND). A sub-10x ratio is a corporate-action artifact: value/turnover uses the
  // raw matched price while close is dividend-adjusted (e.g. ratio 1.28 on an ex-rights
  // stock). Rescaling by it would inflate the adjusted close, so snap to the nearest
  // power of 10 and only apply a genuine unit conversion.
  const nearestPow10 = Math.pow(10, Math.round(Math.log10(ratio)));
  if (nearestPow10 === 1) return 1;
  return Math.abs(ratio - nearestPow10) / nearestPow10 <= 0.2 ? nearestPow10 : 1;
}

export function applyMarketPriceScale(value: number | null | undefined, scale: number): number | null {
  if (value == null || !Number.isFinite(value)) return null;
  const scaled = value * scale;
  // Round về bội-10 chỉ hợp lý ở thang VND (≥1000, tick 10đ, sai số bỏ qua). Với thang NGHÌN
  // (giá nhỏ, vd 73.8) mà round /10*10 sẽ phá thành 70 → chart bậc-thang thô. Giữ 2 số lẻ cho
  // giá nhỏ để không mất chính xác (bug /api/chart mã FPT/VCB/STB hiện 70/60/70).
  return scaled >= 1000 ? Math.round(scaled / 10) * 10 : Math.round(scaled * 100) / 100;
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

export function alignMarketPriceToAnchor(
  value: number | null | undefined,
  anchor?: number | null,
): number | null {
  if (value == null || !Number.isFinite(value) || value <= 0) return null;
  const cleanAnchor = anchor != null && Number.isFinite(anchor) && anchor > 0 ? anchor : null;
  const candidates = [value, value * 10, value * 100, value * 1000, value / 10, value / 100, value / 1000]
    .filter((item) => Number.isFinite(item) && item > 0);

  const selected = cleanAnchor == null
    ? value < 1000 ? value * 1000 : value
    : candidates.reduce((best, item) => {
        const bestGap = Math.abs(best - cleanAnchor) / Math.max(1, cleanAnchor);
        const itemGap = Math.abs(item - cleanAnchor) / Math.max(1, cleanAnchor);
        return itemGap < bestGap ? item : best;
      }, candidates[0]);

  // Cùng lỗi round /10*10 như applyMarketPriceScale: với giá thang NGHÌN (vd tick 42.9) thì
  // round(42.9/10)*10 = 40 → nến live rơi về 40 (BID hiện 40.000 giữa phiên). Chỉ round bội-10 ở
  // thang VND (≥1000); giá nhỏ (nghìn) giữ 2 số lẻ.
  return selected >= 1000 ? Math.round(selected / 10) * 10 : Math.round(selected * 100) / 100;
}

export function normalizeMarketBoardRow<T extends JsonRecord>(row: T): T {
  const close = alignMarketPriceToAnchor(readMarketNumber(row.close ?? row.price ?? row.currentPrice ?? row.lastPrice));
  const reference = alignMarketPriceToAnchor(
    readMarketNumber(row.reference ?? row.refPrice ?? row.basicPrice ?? row.previousClose),
    close,
  );
  const change = close != null && reference != null ? close - reference : readMarketNumber(row.change);
  const changePct = close != null && reference != null && reference > 0
    ? Number((((close - reference) / reference) * 100).toFixed(2))
    : readMarketNumber(row.changePct ?? row.percentChange);

  return {
    ...row,
    ...(close != null ? { close } : {}),
    ...(reference != null ? { reference } : {}),
    ...(change != null ? { change } : {}),
    ...(changePct != null ? { changePct } : {}),
  };
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
