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
        "id",
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
        accountName: readString(row, [
          "accountName",
          "name",
          "ownerName",
          "fullName",
          "accountTypeName",
        ]),
        custodyCode: readString(row, ["custodyCode", "subAccount", "sub_account"]),
        accountType:
          readString(row, ["accountType", "type", "assetType", "accountTypeName"])?.toUpperCase() ??
          "SPOT",
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

function toCandidateUrls(baseUrls: string[], relativePaths: string[]) {
  const urls: string[] = [];
  const normalizedBases = baseUrls
    .map((base) => base.trim().replace(/\/+$/, ""))
    .filter((base) => base.length > 0);

  for (const path of relativePaths) {
    if (/^https?:\/\//i.test(path)) {
      urls.push(path);
      continue;
    }
    for (const base of normalizedBases) {
      if (!path.startsWith("/")) {
        urls.push(`${base}/${path}`);
      } else {
        urls.push(`${base}${path}`);
      }
    }
  }

  return urls;
}

type CandidateRequest = {
  path: string;
  method?: "GET" | "POST";
};

export class DnseTradingClient {
  private readonly apiKey: string;
  private readonly baseUrls: string[];
  private readonly userJwtToken: string | null;

  constructor(options?: { userJwtToken?: string | null; baseUrls?: string[] }) {
    this.apiKey = (process.env.DNSE_API_KEY ?? "").trim();
    if (!this.apiKey) {
      throw new Error("DNSE_API_KEY is not configured");
    }
    this.userJwtToken = options?.userJwtToken?.trim() || null;
    const envBaseUrls = (process.env.DNSE_TRADING_BASE_URLS ?? "")
      .split(",")
      .map((item) => item.trim())
      .filter(Boolean);
    const baseFromEnv = process.env.DNSE_TRADING_BASE_URL?.trim();
    this.baseUrls = [
      ...(options?.baseUrls?.filter(Boolean) ?? []),
      ...envBaseUrls,
      ...(baseFromEnv ? [baseFromEnv] : []),
      "https://api.dnse.com.vn",
      "https://openapi.dnse.com.vn",
    ]
      .map((base) => base.trim())
      .filter(Boolean)
      .filter((value, index, arr) => arr.indexOf(value) === index);
  }

  private async requestJson(url: string, method: "GET" | "POST" = "GET") {
    const headers: HeadersInit = {
      Accept: "application/json",
      "Content-Type": "application/json",
    };
    if (this.userJwtToken) {
      headers.Authorization = `Bearer ${this.userJwtToken}`;
    } else {
      headers.Authorization = `Bearer ${this.apiKey}`;
      headers["X-API-KEY"] = this.apiKey;
      headers["x-api-key"] = this.apiKey;
    }
    const response = await fetch(url, {
      method,
      cache: "no-store",
      signal: AbortSignal.timeout(12_000),
      headers,
    });

    const rawText = await response.text().catch(() => "");
    let payload: unknown = null;
    if (rawText) {
      try {
        payload = JSON.parse(rawText) as unknown;
      } catch {
        payload = null;
      }
    }
    if (!response.ok) {
      const row = toRecord(payload);
      const reason =
        readString(row ?? {}, ["message", "error", "detail", "msg"]) ??
        (rawText ? rawText.slice(0, 200) : null) ??
        `HTTP_${response.status}`;
      throw new Error(`${reason} @ ${url}`);
    }
    return payload;
  }

  private async requestFromCandidates(candidates: CandidateRequest[]) {
    const requests =
      candidates.length > 0
        ? candidates
        : [{ path: "", method: "GET" as const }];
    let lastError: Error | null = null;
    let authLikeError: Error | null = null;
    for (const candidate of requests) {
      const urls = toCandidateUrls(this.baseUrls, [candidate.path]);
      const method = candidate.method ?? "GET";
      for (const url of urls) {
        try {
          return await this.requestJson(url, method);
        } catch (error) {
          lastError = error instanceof Error ? error : new Error("Unknown DNSE error");
          if (error instanceof Error && /HTTP_401|unauthorized|forbidden|token|jwt/i.test(error.message)) {
            authLikeError = error;
          }
        }
      }
    }
    throw authLikeError ?? lastError ?? new Error("DNSE request failed");
  }

  async getAccounts(): Promise<DnseTradingAccount[]> {
    const direct = process.env.DNSE_TRADING_ACCOUNTS_URL?.trim();
    const broker = process.env.DNSE_BROKER_ACCOUNTS_URL?.trim();
    const payload = await this.requestFromCandidates([
      ...(direct ? [{ path: direct, method: "GET" as const }] : []),
      ...(broker ? [{ path: broker, method: "GET" as const }] : []),
      { path: "/order-service/v2/accounts", method: "GET" },
      { path: "/order-service/v2/accounts/list", method: "GET" },
      { path: "/order-service/accounts", method: "GET" },
      { path: "/order-service/api/accounts", method: "GET" },
      { path: "/user-service/api/get-all-account", method: "GET" },
      { path: "/user-service/api/accounts", method: "GET" },
      { path: "/user-service/accounts", method: "GET" },
      { path: "/accounts", method: "GET" },
      { path: "/api/accounts", method: "GET" },
      { path: "/api/v1/accounts", method: "GET" },
    ]);
    const accounts = normalizeAccounts(payload);
    if (accounts.length === 0) {
      throw new Error("Không có tài khoản DNSE hợp lệ từ API");
    }
    return accounts;
  }

  async getBalance(accountNo: string): Promise<DnseTradingBalance> {
    const payload = await this.requestFromCandidates([
      { path: `/order-service/account-balances/${accountNo}`, method: "GET" },
      { path: `/order-service/accounts/${accountNo}/balances`, method: "GET" },
      { path: `/order-service/accounts/${accountNo}/balance`, method: "GET" },
      { path: `/asset-service/api/accounts/${accountNo}/balance`, method: "GET" },
      { path: `/asset-service/accounts/${accountNo}/balance`, method: "GET" },
      { path: `/accounts/${accountNo}/balances`, method: "GET" },
      { path: `/accounts/${accountNo}/balance`, method: "GET" },
    ]);
    return normalizeBalance(accountNo, payload);
  }

  async getPositions(accountNo: string): Promise<DnseTradingPosition[]> {
    const payload = await this.requestFromCandidates([
      { path: `/order-service/account-stocks/${accountNo}`, method: "GET" },
      { path: `/order-service/accounts/${accountNo}/positions`, method: "GET" },
      { path: `/order-service/accounts/${accountNo}/holdings`, method: "GET" },
      { path: `/asset-service/api/accounts/${accountNo}/positions`, method: "GET" },
      { path: `/asset-service/api/accounts/${accountNo}/holdings`, method: "GET" },
      { path: `/accounts/${accountNo}/positions`, method: "GET" },
      { path: `/accounts/${accountNo}/holdings`, method: "GET" },
    ]);
    return normalizePositions(accountNo, payload);
  }

  async getOrders(accountNo: string): Promise<DnseTradingOrder[]> {
    const payload = await this.requestFromCandidates([
      { path: `/order-service/v2/orders?accountNo=${encodeURIComponent(accountNo)}`, method: "GET" },
      { path: `/order-service/orders?accountNo=${encodeURIComponent(accountNo)}`, method: "GET" },
      { path: `/order-service/api/accounts/${accountNo}/orders`, method: "GET" },
      { path: `/order-service/accounts/${accountNo}/orders`, method: "GET" },
      { path: `/accounts/${accountNo}/orders`, method: "GET" },
    ]);
    return normalizeOrders(accountNo, payload);
  }

  async getLoanPackages(accountNo: string): Promise<DnseLoanPackage[]> {
    const payload = await this.requestFromCandidates([
      { path: `/order-service/loan-packages/${accountNo}`, method: "GET" },
      { path: `/margin-service/api/accounts/${accountNo}/loan-packages`, method: "GET" },
      { path: `/margin-service/api/accounts/${accountNo}/loanPackages`, method: "GET" },
      { path: `/accounts/${accountNo}/loan-packages`, method: "GET" },
      { path: `/accounts/${accountNo}/loanPackages`, method: "GET" },
      { path: `/order-service/accounts/${accountNo}/loan-packages`, method: "GET" },
      { path: `/order-service/accounts/${accountNo}/loanPackages`, method: "GET" },
    ]);
    return normalizeLoanPackages(payload);
  }

  async getPPSE(accountNo: string, symbol: string): Promise<DnsePpseSnapshot> {
    const payload = await this.requestFromCandidates([
      {
        path: `/order-service/ppse/${accountNo}?symbol=${encodeURIComponent(symbol)}`,
        method: "GET",
      },
      {
        path: `/order-service/api/accounts/${accountNo}/ppse?symbol=${encodeURIComponent(symbol)}`,
        method: "GET",
      },
      { path: `/accounts/${accountNo}/ppse?symbol=${encodeURIComponent(symbol)}`, method: "GET" },
      {
        path: `/order-service/accounts/${accountNo}/ppse?symbol=${encodeURIComponent(symbol)}`,
        method: "GET",
      },
    ]);
    return normalizePpse(symbol, payload);
  }
}

let singleton: DnseTradingClient | null = null;

export function getDnseTradingClient(options?: { userJwtToken?: string | null; isolated?: boolean }) {
  if (options?.isolated || options?.userJwtToken) {
    return new DnseTradingClient({ userJwtToken: options.userJwtToken ?? null });
  }
  if (!singleton) {
    singleton = new DnseTradingClient();
  }
  return singleton;
}
