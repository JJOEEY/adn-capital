const VN_SIGNAL_PRICE_UNIT_THRESHOLD = 1000;

export function normalizeSignalPrice(value: number): number;
export function normalizeSignalPrice(value: null): null;
export function normalizeSignalPrice(value: undefined): undefined;
export function normalizeSignalPrice(value: number | null): number | null;
export function normalizeSignalPrice(value: number | undefined): number | undefined;
export function normalizeSignalPrice(value: number | null | undefined): number | null | undefined;
export function normalizeSignalPrice(value: number | null | undefined): number | null | undefined {
  if (typeof value !== "number" || !Number.isFinite(value) || value <= 0) {
    return value;
  }

  const normalized = value < VN_SIGNAL_PRICE_UNIT_THRESHOLD ? value * 1000 : value;
  return Number(normalized.toFixed(2));
}

export function normalizeSignalPriceFields<T extends Record<string, unknown>>(
  record: T,
  fields: readonly string[],
): T {
  const next = { ...record };
  for (const field of fields) {
    const value = next[field];
    if (typeof value === "number" || value == null) {
      next[field as keyof T] = normalizeSignalPrice(value as number | null | undefined) as T[keyof T];
    }
  }
  return next;
}
