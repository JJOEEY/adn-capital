import "server-only";

type JsonRecord = Record<string, unknown>;

export type DnseTradingAccount = {
  accountNo: string;
  accountName: string | null;
  custodyCode: string | null;
  accountType: string;
  status: string;
};

export type DnseTradingBalance = {
  accountNo: string;
  totalNav: number | null;
  buyingPower: number | null;
  cash: number | null;
  debt: number | null;
};

export type DnseTradingPosition = {
  accountNo: string;
  symbol: string;
  quantity: number;
  availableQty: number | null;
  avgPrice: number | null;
  lastPrice: number | null;
  marketValue: number | null;
  totalPL: number | null;
  totalPLPct: number | null;
  weight: number | null;
};

export type DnseTradingOrder = {
  orderId: string;
  accountNo: string;
  symbol: string | null;
  side: string | null;
  orderType: string | null;
  price: number | null;
  quantity: number | null;
  filledQty: number | null;
  remainingQty: number | null;
  status: string | null;
  createdAt: string | null;
  updatedAt: string | null;
};

export type DnseLoanPackage = {
  loanPackageId: string;
  loanPackageName: string;
  interestRate: number | null;
  maxLoanRatio: number | null;
  minAmount: number | null;
  description: string | null;
};

export type DnsePpseSnapshot = {
  symbol: string | null;
  buyingPower: number | null;
  sellingPower: number | null;
  maxBuyQty: number | null;
  maxSellQty: number | null;
};

function toRecord(value: unknown): JsonRecord | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  return value as JsonRecord;
}

function toArray(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}

function readString(row: JsonRecord, keys: string[]) {
  for (const key of keys) {
    const raw = row[key];
    if (typeof raw !== "string") continue;
    const value = raw.trim();
    if (value.length > 0) return value;
  }
  return null;
}

function readNumber(row: JsonRecord, keys: string[]) {
  for (const key of keys) {
    const raw = row[key];
    if (typeof raw === "number" && Number.isFinite(raw)) return raw;
    if (typeof raw === "string") {
      const parsed = Number(raw.replace(/[^\d.-]/g, ""));
      if (Number.isFinite(parsed)) return parsed;
    }
  }
  return null;
}

function extractRows(payload: unknown) {
  const root = toRecord(payload);
  if (!root) return [] as JsonRecord[];
  const candidates = [
    root.data,
    root.items,
    root.rows,
    root.result,
    root.list,
    root.accounts,
    root.positions,
    root.orders,
    root.orderHistory,
    root.loanPackages,
    root.holdings,
  ];
  for (const value of candidates) {
    const rows = toArray(value)
      .map((item) => toRecord(item))
      .filter((item): item is JsonRecord => Boolean(item));
    if (rows.length > 0) return rows;
  }
  return [];
}

function normalizeAccounts(payload: unknown): DnseTradingAccount[] {
  const rows = extractRows(payload);
  if (rows.length === 0) return [];
  return rows
    .map((row) => {
      const accountNo = readString(row, [
        "accountNo",
        "accountId",
        "account_id",
        "subAccount",
        "sub_account",
        "tradingAccount",
      ]);
      if (!accountNo) return null;
      return {
        accountNo: accountNo.toUpperCase(),
        accountName: readString(row, ["accountName", "name", "ownerName", "fullName"]),
        custodyCode: readString(row, ["custodyCode", "subAccount", "sub_account"]),
        accountType:
          readString(row, ["accountType", "type", "assetType"])?.toUpperCase() ?? "SPOT",
        status: readString(row, ["status", "state"])?.toUpperCase() ?? "ACTIVE",
      } satisfies DnseTradingAccount;
    })
    .filter((item): item is DnseTradingAccount => Boolean(item));
}

function normalizeBalance(accountNo: string, payload: unknown): DnseTradingBalance {
  const root = toRecord(payload);
  const row = root ?? extractRows(payload)[0] ?? {};
  return {
    accountNo,
    totalNav: readNumber(row, ["totalNav", "nav", "netAssetValue", "equity", "totalAsset"]),
    buyingPower: readNumber(row, ["buyingPower", "cashAvailable", "availableCash", "sucMua"]),
    cash: readNumber(row, ["cash", "cashBalance", "cashAvailable"]),
    debt: readNumber(row, ["debt", "marginDebt", "loanOutstanding"]),
  };
}

function normalizePositions(accountNo: string, payload: unknown): DnseTradingPosition[] {
  const rows = extractRows(payload);
  const mapped = rows
    .map((row) => {
      const symbol = readString(row, ["symbol", "ticker", "code", "stockCode"]);
      if (!symbol) return null;
      const quantity = readNumber(row, ["quantity", "qty", "volume", "holdingQty", "availableQty"]) ?? 0;
      const avgPrice = readNumber(row, ["avgPrice", "averagePrice", "costPrice", "priceAvg"]);
      const lastPrice = readNumber(row, ["marketPrice", "currentPrice", "lastPrice", "price"]);
      const marketValue = readNumber(row, ["marketValue", "value", "totalValue"]);
      const totalPL =
        readNumber(row, ["totalPL", "profitLoss", "pnl"]) ??
        (avgPrice != null && lastPrice != null ? (lastPrice - avgPrice) * quantity : null);
      const totalPLPct =
        readNumber(row, ["totalPLPct", "profitPercent", "pnlPercent", "profitRate"]) ??
        (avgPrice != null && lastPrice != null && avgPrice > 0
          ? ((lastPrice - avgPrice) / avgPrice) * 100
          : null);
      const position: DnseTradingPosition = {
        accountNo,
        symbol: symbol.toUpperCase(),
        quantity: Math.max(0, Math.trunc(quantity)),
        availableQty: readNumber(row, ["availableQty", "tradableQty", "freeQty"]),
        avgPrice,
        lastPrice,
        marketValue,
        totalPL,
        totalPLPct,
        weight: null,
      };
      return position;
    })
    .filter((item): item is DnseTradingPosition => Boolean(item))
    .filter((item) => item.quantity > 0);

  const totalValue = mapped.reduce((sum, row) => sum + (row.marketValue ?? 0), 0);
  return mapped.map((row) => ({
    ...row,
    weight: totalValue > 0 && row.marketValue != null ? (row.marketValue / totalValue) * 100 : null,
  }));
}

function normalizeOrders(accountNo: string, payload: unknown): DnseTradingOrder[] {
  return extractRows(payload).map((row) => ({
    orderId:
      readString(row, ["orderId", "id", "clientOrderId", "orderNo", "brokerOrderId"]) ??
      `ORD-${Date.now()}`,
    accountNo,
    symbol: readString(row, ["symbol", "ticker", "code", "stockCode"])?.toUpperCase() ?? null,
    side: readString(row, ["side", "orderSide", "buySell"])?.toUpperCase() ?? null,
    orderType: readString(row, ["orderType", "type", "priceType"])?.toUpperCase() ?? null,
    price: readNumber(row, ["price", "orderPrice", "matchedPrice"]),
    quantity: readNumber(row, ["quantity", "qty", "volume", "orderQty"]),
    filledQty: readNumber(row, ["filledQty", "matchedQty", "executedQty"]),
    remainingQty: readNumber(row, ["remainingQty", "leftQty"]),
    status: readString(row, ["status", "orderStatus", "state"])?.toUpperCase() ?? null,
    createdAt: readString(row, ["createdAt", "submittedAt", "orderTime", "time"]),
    updatedAt: readString(row, ["updatedAt", "modifiedAt", "lastUpdatedAt"]),
  }));
}

function normalizeLoanPackages(payload: unknown): DnseLoanPackage[] {
  return extractRows(payload)
    .map((row) => {
      const loanPackageId = readString(row, ["loanPackageId", "id", "packageId", "code"]);
      if (!loanPackageId) return null;
      return {
        loanPackageId,
        loanPackageName:
          readString(row, ["loanPackageName", "name", "packageName", "title"]) ?? loanPackageId,
        interestRate: readNumber(row, ["interestRate", "rate", "yearlyRate"]),
        maxLoanRatio: readNumber(row, ["maxLoanRatio", "loanRatio", "maxRatio"]),
        minAmount: readNumber(row, ["minAmount", "minimumAmount", "minLoanAmount"]),
        description: readString(row, ["description", "note", "details"]),
      } satisfies DnseLoanPackage;
    })
    .filter((item): item is DnseLoanPackage => Boolean(item));
}

function normalizePpse(symbol: string, payload: unknown): DnsePpseSnapshot {
  const root = toRecord(payload);
  const row = root ?? extractRows(payload)[0] ?? {};
  return {
    symbol: readString(row, ["symbol", "ticker", "code"])?.toUpperCase() ?? symbol.toUpperCase(),
    buyingPower: readNumber(row, ["buyingPower", "powerBuy", "cashAvailable", "availableBuyValue"]),
    sellingPower: readNumber(row, ["sellingPower", "powerSell", "availableSellValue"]),
    maxBuyQty: readNumber(row, ["maxBuyQty", "maxBuyQuantity", "maxBuyVolume"]),
    maxSellQty: readNumber(row, ["maxSellQty", "maxSellQuantity", "maxSellVolume"]),
  };
}

function toCandidateUrls(baseUrl: string, relativePaths: string[]) {
  const normalizedBase = baseUrl.replace(/\/+$/, "");
  return relativePaths.map((path) => {
    if (/^https?:\/\//i.test(path)) return path;
    if (!path.startsWith("/")) return `${normalizedBase}/${path}`;
    return `${normalizedBase}${path}`;
  });
}

export class DnseTradingClient {
  private readonly apiKey: string;
  private readonly baseUrl: string;

  constructor() {
    this.apiKey = (process.env.DNSE_API_KEY ?? "").trim();
    if (!this.apiKey) {
      throw new Error("DNSE_API_KEY is not configured");
    }
    this.baseUrl = (process.env.DNSE_TRADING_BASE_URL?.trim() || "https://api.dnse.com.vn").replace(
      /\/+$/,
      "",
    );
  }

  private async requestJson(url: string, method: "GET" | "POST" = "GET") {
    const response = await fetch(url, {
      method,
      cache: "no-store",
      signal: AbortSignal.timeout(12_000),
      headers: {
        Accept: "application/json",
        Authorization: `Bearer ${this.apiKey}`,
        "X-Api-Key": this.apiKey,
        "Content-Type": "application/json",
      },
    });

    const payload = (await response.json().catch(() => null)) as unknown;
    if (!response.ok) {
      const row = toRecord(payload);
      const reason =
        readString(row ?? {}, ["message", "error", "detail", "msg"]) ?? `HTTP_${response.status}`;
      throw new Error(reason);
    }
    return payload;
  }

  private async requestFromCandidates(relativePaths: string[]) {
    const urls = toCandidateUrls(this.baseUrl, relativePaths);
    let lastError: Error | null = null;
    for (const url of urls) {
      try {
        return await this.requestJson(url);
      } catch (error) {
        lastError = error instanceof Error ? error : new Error("Unknown DNSE error");
      }
    }
    throw lastError ?? new Error("DNSE request failed");
  }

  async getAccounts(): Promise<DnseTradingAccount[]> {
    const direct = process.env.DNSE_TRADING_ACCOUNTS_URL?.trim();
    const broker = process.env.DNSE_BROKER_ACCOUNTS_URL?.trim();
    const payload = await this.requestFromCandidates([
      ...(direct ? [direct] : []),
      ...(broker ? [broker] : []),
      "/auth-service/api/get-accounts",
      "/accounts",
      "/user-service/api/accounts",
      "/user-service/accounts",
      "/order-service/accounts",
      "/accounts/list",
    ]);
    const accounts = normalizeAccounts(payload);
    if (accounts.length === 0) {
      throw new Error("Không có tài khoản DNSE hợp lệ từ API");
    }
    return accounts;
  }

  async getBalance(accountNo: string): Promise<DnseTradingBalance> {
    const payload = await this.requestFromCandidates([
      `/asset-service/api/accounts/${accountNo}/balance`,
      `/asset-service/accounts/${accountNo}/balance`,
      `/accounts/${accountNo}/balances`,
      `/accounts/${accountNo}/balance`,
      `/user-service/accounts/${accountNo}/balances`,
      `/order-service/accounts/${accountNo}/balances`,
      `/order-service/accounts/${accountNo}/balance`,
    ]);
    return normalizeBalance(accountNo, payload);
  }

  async getPositions(accountNo: string): Promise<DnseTradingPosition[]> {
    const payload = await this.requestFromCandidates([
      `/asset-service/api/accounts/${accountNo}/positions`,
      `/asset-service/api/accounts/${accountNo}/holdings`,
      `/accounts/${accountNo}/positions`,
      `/accounts/${accountNo}/holdings`,
      `/user-service/accounts/${accountNo}/positions`,
      `/order-service/accounts/${accountNo}/positions`,
      `/order-service/accounts/${accountNo}/holdings`,
    ]);
    return normalizePositions(accountNo, payload);
  }

  async getOrders(accountNo: string): Promise<DnseTradingOrder[]> {
    const payload = await this.requestFromCandidates([
      `/order-service/api/accounts/${accountNo}/orders`,
      `/accounts/${accountNo}/orders`,
      `/order-service/accounts/${accountNo}/orders`,
      `/order-service/orders?accountNo=${accountNo}`,
    ]);
    return normalizeOrders(accountNo, payload);
  }

  async getLoanPackages(accountNo: string): Promise<DnseLoanPackage[]> {
    const payload = await this.requestFromCandidates([
      `/margin-service/api/accounts/${accountNo}/loan-packages`,
      `/margin-service/api/accounts/${accountNo}/loanPackages`,
      `/accounts/${accountNo}/loan-packages`,
      `/accounts/${accountNo}/loanPackages`,
      `/order-service/accounts/${accountNo}/loan-packages`,
      `/order-service/accounts/${accountNo}/loanPackages`,
    ]);
    return normalizeLoanPackages(payload);
  }

  async getPPSE(accountNo: string, symbol: string): Promise<DnsePpseSnapshot> {
    const payload = await this.requestFromCandidates([
      `/order-service/api/accounts/${accountNo}/ppse?symbol=${encodeURIComponent(symbol)}`,
      `/accounts/${accountNo}/ppse?symbol=${encodeURIComponent(symbol)}`,
      `/order-service/accounts/${accountNo}/ppse?symbol=${encodeURIComponent(symbol)}`,
    ]);
    return normalizePpse(symbol, payload);
  }
}

let singleton: DnseTradingClient | null = null;

export function getDnseTradingClient() {
  if (!singleton) {
    singleton = new DnseTradingClient();
  }
  return singleton;
}
