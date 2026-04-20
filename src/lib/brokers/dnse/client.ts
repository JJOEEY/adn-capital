import { getDnseOAuthConfig, resolveDnseUrlTemplate } from "./oauth";

type JsonRecord = Record<string, unknown>;

function toRecord(value: unknown): JsonRecord | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  return value as JsonRecord;
}

function toArray(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}

function toNumber(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string") {
    const parsed = Number(value.replace(/[^\d.-]/g, ""));
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

function toStringValue(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function pickString(row: JsonRecord, keys: string[]) {
  for (const key of keys) {
    const value = toStringValue(row[key]);
    if (value) return value;
  }
  return null;
}

function pickNumber(row: JsonRecord, keys: string[]) {
  for (const key of keys) {
    const value = toNumber(row[key]);
    if (value != null) return value;
  }
  return null;
}

function extractDataArray(payload: unknown): JsonRecord[] {
  const root = toRecord(payload);
  if (!root) return [];
  const candidate = [
    root.data,
    root.items,
    root.rows,
    root.result,
    root.holdings,
    root.positions,
    root.orders,
  ];
  for (const item of candidate) {
    const arr = toArray(item)
      .map((row) => toRecord(row))
      .filter((row): row is JsonRecord => Boolean(row));
    if (arr.length > 0) return arr;
  }
  return [];
}

async function requestDnseJson(args: {
  url: string;
  accessToken: string;
  method?: "GET" | "POST";
  body?: unknown;
}) {
  const config = getDnseOAuthConfig();
  const response = await fetch(args.url, {
    method: args.method ?? "GET",
    headers: {
      Accept: "application/json",
      Authorization: `Bearer ${args.accessToken}`,
      ...(config.apiKey ? { "X-Api-Key": config.apiKey } : {}),
      ...(args.body ? { "Content-Type": "application/json" } : {}),
    },
    body: args.body ? JSON.stringify(args.body) : undefined,
    cache: "no-store",
    signal: AbortSignal.timeout(15_000),
  });

  const payload = (await response.json().catch(() => null)) as unknown;
  if (!response.ok) {
    const errorText =
      payload && typeof payload === "object"
        ? String(
            (payload as JsonRecord).message ??
              (payload as JsonRecord).error ??
              `HTTP_${response.status}`,
          )
        : `HTTP_${response.status}`;
    throw new Error(`DNSE request failed: ${errorText}`);
  }

  return payload;
}

function buildEndpoint(template: string | null, params: { accountId: string; userId: string }) {
  if (!template) return null;
  return resolveDnseUrlTemplate(template, params);
}

export type DnseAccountProfile = {
  accountId: string | null;
  accountName: string | null;
  subAccountId: string | null;
  raw: JsonRecord | null;
};

export async function fetchDnseAccountProfile(args: {
  accessToken: string;
  accountId: string;
  userId: string;
}) {
  const config = getDnseOAuthConfig();
  const endpoint = buildEndpoint(config.accountProfileUrl, {
    accountId: args.accountId,
    userId: args.userId,
  });
  if (!endpoint) return null;

  const payload = await requestDnseJson({
    url: endpoint,
    accessToken: args.accessToken,
  });
  const root = toRecord(payload);
  if (!root) {
    return {
      accountId: null,
      accountName: null,
      subAccountId: null,
      raw: null,
    };
  }
  const accountId = pickString(root, ["accountNo", "accountId", "account_id", "subAccount", "sub_account"]);
  const accountName = pickString(root, ["name", "accountName", "ownerName", "fullName"]);
  const subAccountId = pickString(root, ["subAccount", "sub_account", "custodyCode"]);
  return {
    accountId,
    accountName,
    subAccountId,
    raw: root,
  } satisfies DnseAccountProfile;
}

type NormalizedHolding = {
  ticker: string;
  quantity: number;
  averagePrice: number | null;
  currentPrice: number | null;
  marketValue: number | null;
  pnlPercent: number | null;
};

function normalizeHoldingRows(payload: unknown): NormalizedHolding[] {
  const rows = extractDataArray(payload);
  return rows
    .map((row) => {
      const ticker = pickString(row, ["symbol", "ticker", "code", "stockCode"]);
      if (!ticker) return null;
      const quantity =
        pickNumber(row, ["quantity", "qty", "volume", "holdingQty", "availableQty"]) ?? 0;
      const averagePrice = pickNumber(row, [
        "avgPrice",
        "averagePrice",
        "costPrice",
        "priceAvg",
      ]);
      const currentPrice = pickNumber(row, [
        "marketPrice",
        "currentPrice",
        "lastPrice",
        "price",
      ]);
      const marketValue = pickNumber(row, [
        "marketValue",
        "value",
        "totalValue",
      ]);
      const pnlPercent = pickNumber(row, [
        "pnlPercent",
        "profitPercent",
        "profitRate",
      ]);

      return {
        ticker: ticker.toUpperCase(),
        quantity: Math.max(0, Math.trunc(quantity)),
        averagePrice,
        currentPrice,
        marketValue,
        pnlPercent,
      } satisfies NormalizedHolding;
    })
    .filter((row): row is NormalizedHolding => row !== null)
    .filter((row) => row.quantity > 0);
}

function normalizeOrders(payload: unknown) {
  const rows = extractDataArray(payload);
  return rows.map((row) => ({
    ticker: pickString(row, ["symbol", "ticker", "code", "stockCode"])?.toUpperCase() ?? null,
    side: pickString(row, ["side", "orderSide", "buySell"])?.toUpperCase() ?? null,
    quantity:
      pickNumber(row, ["quantity", "qty", "volume", "orderQty"]) ?? null,
    price: pickNumber(row, ["price", "orderPrice", "matchedPrice"]),
    status: pickString(row, ["status", "orderStatus", "state"]),
    submittedAt: pickString(row, ["createdAt", "submittedAt", "orderTime", "time"]),
    brokerOrderId: pickString(row, ["orderId", "id", "clientOrderId", "orderNo"]),
  }));
}

function normalizeBalance(payload: unknown) {
  const row = toRecord(payload);
  if (!row) return null;
  const totalNav = pickNumber(row, [
    "totalNav",
    "nav",
    "netAssetValue",
    "equity",
    "totalAsset",
  ]);
  const buyingPower = pickNumber(row, [
    "buyingPower",
    "cashAvailable",
    "availableCash",
    "sucMua",
  ]);
  const cash = pickNumber(row, ["cash", "cashBalance", "cashAvailable"]);
  const debt = pickNumber(row, ["debt", "marginDebt", "loanOutstanding"]);
  return {
    totalNav,
    buyingPower,
    cash,
    debt,
    raw: row,
  };
}

export type DnseBrokerChannelData = {
  source: "dnse-oauth";
  connected: boolean;
  accountId: string;
  positions?: Array<{
    ticker: string;
    entryPrice: number | null;
    currentPrice: number | null;
    pnlPercent: number | null;
    quantity: number;
    marketValue: number | null;
  }>;
  holdings?: Array<{
    ticker: string;
    entryPrice: number | null;
    currentPrice: number | null;
    pnlPercent: number | null;
    quantity: number;
    marketValue: number | null;
  }>;
  orders?: Array<{
    ticker: string | null;
    side: string | null;
    quantity: number | null;
    price: number | null;
    status: string | null;
    submittedAt: string | null;
    brokerOrderId: string | null;
  }>;
  totalNav?: number | null;
  buyingPower?: number | null;
  cash?: number | null;
  debt?: number | null;
};

export async function fetchDnseBrokerChannel(args: {
  channel: "positions" | "orders" | "balance" | "holdings";
  accessToken: string;
  accountId: string;
  userId: string;
}) {
  const config = getDnseOAuthConfig();
  const params = { accountId: args.accountId, userId: args.userId };
  const endpoints = {
    positions: buildEndpoint(config.positionsUrl, params),
    orders: buildEndpoint(config.ordersUrl, params),
    balance: buildEndpoint(config.balanceUrl, params),
    holdings: buildEndpoint(config.holdingsUrl, params),
  };

  const selectedUrl = endpoints[args.channel];
  if (!selectedUrl) {
    throw new Error(`DNSE ${args.channel} endpoint not configured`);
  }

  const payload = await requestDnseJson({
    url: selectedUrl,
    accessToken: args.accessToken,
  });

  if (args.channel === "orders") {
    return {
      source: "dnse-oauth",
      connected: true,
      accountId: args.accountId,
      orders: normalizeOrders(payload),
    } satisfies DnseBrokerChannelData;
  }

  if (args.channel === "balance") {
    const balance = normalizeBalance(payload);
    return {
      source: "dnse-oauth",
      connected: true,
      accountId: args.accountId,
      totalNav: balance?.totalNav ?? null,
      buyingPower: balance?.buyingPower ?? null,
      cash: balance?.cash ?? null,
      debt: balance?.debt ?? null,
    } satisfies DnseBrokerChannelData;
  }

  const holdings = normalizeHoldingRows(payload).map((row) => ({
    ticker: row.ticker,
    entryPrice: row.averagePrice,
    currentPrice: row.currentPrice,
    pnlPercent: row.pnlPercent,
    quantity: row.quantity,
    marketValue: row.marketValue,
  }));

  if (args.channel === "positions") {
    return {
      source: "dnse-oauth",
      connected: true,
      accountId: args.accountId,
      positions: holdings,
    } satisfies DnseBrokerChannelData;
  }

  return {
    source: "dnse-oauth",
    connected: true,
    accountId: args.accountId,
    holdings,
  } satisfies DnseBrokerChannelData;
}

export async function submitDnseOrderByUserToken(args: {
  accessToken: string;
  submitUrl: string;
  payload: unknown;
}) {
  return requestDnseJson({
    url: args.submitUrl,
    accessToken: args.accessToken,
    method: "POST",
    body: args.payload,
  });
}
