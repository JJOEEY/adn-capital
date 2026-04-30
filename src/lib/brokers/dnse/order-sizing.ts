export type DnseSizingSide = "BUY" | "SELL";

export type NormalizedDnseLoanPackage = {
  loanPackageId: string;
  loanPackageName: string;
  interestRate: number | null;
  maxLoanRatio: number | null;
  isCash: boolean;
};

export type OrderSizingInput = {
  side: DnseSizingSide;
  price: number | null;
  totalAsset: number | null;
  buyingPower: number | null;
  sellingPower: number | null;
  availableSellQty: number | null;
  dnseMaxBuyQty?: number | null;
  dnseMaxSellQty?: number | null;
  recommendedNavPct?: number | null;
  fallbackNavPct?: number | null;
};

export type OrderSizingResult = {
  price: number | null;
  displayPrice: number | null;
  totalAsset: number | null;
  buyingPower: number | null;
  sellingPower: number | null;
  buyMaxQuantity: number;
  sellMaxQuantity: number;
  recommendedQuantity: number;
  recommendedValue: number;
  recommendedNavPct: number;
};

const LOT_SIZE = 100;
const DEFAULT_RECOMMENDED_NAV_PCT = 5;

export function toFiniteNumber(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string") {
    const raw = value.trim();
    if (!raw) return null;
    const normalized =
      /^\d{1,3}(,\d{3})+(\.\d+)?$/.test(raw)
        ? raw.replace(/,/g, "")
        : raw.replace(",", ".");
    const parsed = Number(normalized);
    if (Number.isFinite(parsed)) return parsed;
  }
  return null;
}

export function normalizeOrderPrice(value: unknown): number | null {
  const parsed = toFiniteNumber(value);
  if (parsed == null || parsed <= 0) return null;
  return Math.round(parsed < 1000 ? parsed * 1000 : parsed);
}

export function toDisplayPrice(value: unknown): number | null {
  const price = normalizeOrderPrice(value);
  if (price == null) return null;
  return price >= 1000 ? Number((price / 1000).toFixed(2)) : price;
}

export function floorToLot(quantity: number, lotSize = LOT_SIZE) {
  if (!Number.isFinite(quantity) || quantity <= 0) return 0;
  return Math.floor(quantity / lotSize) * lotSize;
}

export function toRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function nestedRecord(value: unknown) {
  const root = toRecord(value);
  const data = toRecord(root?.data);
  return data ?? root;
}

export function readFirstNumber(
  value: unknown,
  keys: string[],
  fallback: number | null = null,
): number | null {
  const row = nestedRecord(value);
  if (!row) return fallback;
  for (const key of keys) {
    const parsed = toFiniteNumber(row[key]);
    if (parsed != null) return parsed;
  }
  return fallback;
}

export function readBestPositiveNumber(
  value: unknown,
  keys: string[],
  fallback: number | null = null,
): number | null {
  const row = nestedRecord(value);
  if (!row) return fallback;
  const values = keys
    .map((key) => toFiniteNumber(row[key]))
    .filter((item): item is number => item != null);
  return values.find((item) => item > 0) ?? values[0] ?? fallback;
}

export function extractArrayPayload(value: unknown): unknown[] {
  if (Array.isArray(value)) return value;
  const root = toRecord(value);
  if (!root) return [];
  if (Array.isArray(root.data)) return root.data;
  const data = toRecord(root.data);
  if (Array.isArray(data?.loanPackages)) return data.loanPackages;
  if (Array.isArray(data?.positions)) return data.positions;
  if (Array.isArray(data?.orders)) return data.orders;
  if (Array.isArray(data?.items)) return data.items;
  if (Array.isArray(data?.rows)) return data.rows;
  if (Array.isArray(root.loanPackages)) return root.loanPackages;
  if (Array.isArray(root.positions)) return root.positions;
  if (Array.isArray(root.orders)) return root.orders;
  if (Array.isArray(root.items)) return root.items;
  if (Array.isArray(root.rows)) return root.rows;
  if (Array.isArray(root.packages)) return root.packages;
  return [];
}

export function normalizeLoanPackageRows(rows: unknown[]): NormalizedDnseLoanPackage[] {
  const packages: NormalizedDnseLoanPackage[] = [];

  rows.forEach((item, index) => {
    const row = toRecord(item);
    if (!row) return;
    const id = String(row.id ?? row.code ?? row.loanPackageId ?? row.name ?? "").trim();
    if (!id) return;
    const initialRate = readFirstNumber(row, ["initialRate", "initialMarginRate"], null);
    const packageName =
      String(row.name ?? row.loanPackageName ?? row.code ?? `Gói giao dịch ${index + 1}`).trim() ||
      `Gói giao dịch ${index + 1}`;
    const isCash =
      initialRate === 1 ||
      /ti[eề]n m[aặ]t|cash|gd ti[eề]n m[aặ]t/i.test(packageName);
    const computedLoanRatio = initialRate != null ? Math.max(0, (1 - initialRate) * 100) : null;

    packages.push({
      loanPackageId: id,
      loanPackageName: packageName,
      interestRate: readFirstNumber(row, ["interestRate", "rate", "loanRate", "marginRate", "interest"], null),
      maxLoanRatio: readFirstNumber(row, ["maxLoanRatio", "loanRatio", "marginRatio"], computedLoanRatio),
      isCash,
    });
  });

  if (!packages.length) {
    packages.push({
      loanPackageId: "CASH",
      loanPackageName: "Giao dịch tiền mặt",
      interestRate: 0,
      maxLoanRatio: 0,
      isCash: true,
    });
  }

  const dedup = new Map<string, NormalizedDnseLoanPackage>();
  for (const item of packages) dedup.set(item.loanPackageId, item);
  return Array.from(dedup.values());
}

export function extractAvailableSellQty(positions: unknown[], ticker: string): number | null {
  const normalizedTicker = ticker.trim().toUpperCase();
  for (const item of positions) {
    const row = toRecord(item);
    if (!row) continue;
    const symbol = String(row.symbol ?? row.ticker ?? row.stockCode ?? "").trim().toUpperCase();
    if (symbol !== normalizedTicker) continue;
    return readBestPositiveNumber(row, [
      "availableQty",
      "availableQuantity",
      "sellableQuantity",
      "sellableQty",
      "tradeQuantity",
      "openQuantity",
      "quantity",
      "totalQuantity",
      "accumulateQuantity",
    ], 0);
  }
  return null;
}

function boundedPct(value: number | null | undefined, fallback: number) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) return fallback;
  return Math.min(100, Math.max(0.1, parsed));
}

function minDefinedNonNegative(values: Array<number | null | undefined>) {
  const defined = values.filter((item): item is number => Number.isFinite(item) && Number(item) >= 0);
  if (defined.length === 0) return 0;
  return Math.min(...defined);
}

export function calculateOrderSizing(input: OrderSizingInput): OrderSizingResult {
  const price = normalizeOrderPrice(input.price);
  const totalAsset = input.totalAsset != null && input.totalAsset > 0 ? input.totalAsset : null;
  const buyingPower = input.buyingPower != null && input.buyingPower >= 0 ? input.buyingPower : null;
  const sellingPower = input.sellingPower != null && input.sellingPower >= 0 ? input.sellingPower : null;
  const recommendedNavPct = boundedPct(
    input.recommendedNavPct,
    boundedPct(input.fallbackNavPct, DEFAULT_RECOMMENDED_NAV_PCT),
  );

  const buyByAmount =
    price && buyingPower != null ? floorToLot(Math.floor(buyingPower / price)) : null;
  const buyByDnse = input.dnseMaxBuyQty != null ? floorToLot(input.dnseMaxBuyQty) : null;
  const buyMaxQuantity = minDefinedNonNegative([buyByAmount, buyByDnse]);

  const sellByHolding = input.availableSellQty != null ? floorToLot(input.availableSellQty) : null;
  const sellByDnse = input.dnseMaxSellQty != null ? floorToLot(input.dnseMaxSellQty) : null;
  const sellMaxQuantity = minDefinedNonNegative([sellByHolding, sellByDnse]);

  const recommendedByAsset =
    price && totalAsset
      ? floorToLot(Math.floor((totalAsset * recommendedNavPct) / 100 / price))
      : 0;
  const sideCap = input.side === "SELL" ? sellMaxQuantity : buyMaxQuantity;
  const recommendedQuantity = sideCap > 0
    ? floorToLot(Math.min(sideCap, recommendedByAsset || sideCap))
    : 0;

  return {
    price,
    displayPrice: toDisplayPrice(price),
    totalAsset,
    buyingPower,
    sellingPower,
    buyMaxQuantity,
    sellMaxQuantity,
    recommendedQuantity,
    recommendedValue: price ? Math.round(recommendedQuantity * price) : 0,
    recommendedNavPct,
  };
}

export const PPSE_BUYING_POWER_KEYS = [
  "buyingPower",
  "purchasingPower",
  "maxBuyAmount",
  "maxBuyValue",
  "cashAvailable",
  "availableCash",
  "pp",
  "PP",
  "ppse",
  "PPSE",
];

export const PPSE_SELLING_POWER_KEYS = [
  "sellingPower",
  "sellAmount",
  "maxSellAmount",
  "maxSellValue",
];

export const PPSE_MAX_BUY_QTY_KEYS = [
  "maxBuyQty",
  "maxBuyQuantity",
  "buyingQuantity",
  "buyQty",
  "quantity",
];

export const PPSE_MAX_SELL_QTY_KEYS = [
  "maxSellQty",
  "maxSellQuantity",
  "sellingQuantity",
  "sellQty",
  "availableQty",
];

export const BALANCE_TOTAL_ASSET_KEYS = [
  "totalNav",
  "netAssetValue",
  "totalAsset",
  "totalAssets",
  "nav",
  "asset",
  "equity",
];

export const BALANCE_BUYING_POWER_KEYS = [
  "buyingPower",
  "cashAvailable",
  "availableCash",
  "cashWithdrawable",
  "maxBuyAmount",
  "maxBuyValue",
];
