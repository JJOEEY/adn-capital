import crypto from "crypto";

type JsonRecord = Record<string, unknown>;

export interface DnseAccount {
  accountNo: string;
  accountName: string | null;
  custodyCode: string | null;
  accountType: string;
  status: string;
}

export interface DnseBalance {
  accountNo: string;
  cashBalance: number;
  cashWithdrawable: number;
  cashAvailable: number;
  totalAsset: number;
  totalDebt: number;
  netAssetValue: number;
  cash?: number;
  buyingPower?: number;
  totalNav?: number;
  debt?: number;
  marginRatio?: number;
  maintenanceMargin?: number;
}

export interface DnsePosition {
  accountNo: string;
  symbol: string;
  ticker?: string;
  quantity: number;
  availableQty: number;
  avgPrice: number;
  lastPrice: number;
  marketValue: number;
  totalPL: number;
  totalPLPct: number;
  weight: number;
}

export interface DnseOrder {
  orderId: string;
  accountNo: string;
  symbol: string;
  side: "BUY" | "SELL";
  orderType: string;
  price: number;
  quantity: number;
  filledQty: number;
  remainingQty: number;
  status: string;
  createdAt: string;
  updatedAt: string;
}

type ClientOptions = {
  userJwtToken?: string | null;
};

function toRecord(value: unknown): JsonRecord | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  return value as JsonRecord;
}

function readString(row: JsonRecord, keys: string[]) {
  for (const key of keys) {
    const raw = row[key];
    if (typeof raw !== "string") continue;
    const value = raw.trim();
    if (value) return value;
  }
  return null;
}

function normalizeBaseUrls(baseUrl?: string) {
  const envBaseUrls = (process.env.DNSE_TRADING_BASE_URLS ?? "")
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
  const baseFromEnv = process.env.DNSE_TRADING_BASE_URL?.trim();
  const all = [
    ...(baseUrl?.trim() ? [baseUrl.trim()] : []),
    ...envBaseUrls,
    ...(baseFromEnv ? [baseFromEnv] : []),
    "https://api.dnse.com.vn",
    "https://openapi.dnse.com.vn",
  ]
    .map((base) => base.replace(/\/+$/, ""))
    .filter(Boolean);

  return all.filter((value, index, arr) => arr.indexOf(value) === index);
}

function normalizeErrorMessage(text: string) {
  const raw = text.trim();
  if (!raw) return "";
  try {
    const parsed = JSON.parse(raw) as unknown;
    const root = toRecord(parsed);
    if (!root) return raw;
    return (
      readString(root, ["message", "error", "detail", "msg"]) ??
      readString(toRecord(root.data) ?? {}, ["message", "error", "detail", "msg"]) ??
      raw
    );
  } catch {
    return raw;
  }
}

function looksLikeRouteMismatch(status: number, message: string) {
  return (
    status === 404 ||
    /no route matched|not found|HTTP_404|cannot .* route/i.test(message)
  );
}

function looksLikeAuthError(status: number, message: string) {
  return (
    status === 401 ||
    status === 403 ||
    /authorization|unauthorized|forbidden|token|jwt|oa-400/i.test(message)
  );
}

function extractArrayPayload(payload: unknown): unknown[] {
  if (Array.isArray(payload)) return payload;
  const root = toRecord(payload);
  if (!root) return [];
  const data = root.data;
  if (Array.isArray(data)) return data;
  const nested = toRecord(data);
  if (nested) {
    if (Array.isArray(nested.accounts)) return nested.accounts;
    if (Array.isArray(nested.items)) return nested.items;
    if (Array.isArray(nested.rows)) return nested.rows;
  }
  if (Array.isArray(root.accounts)) return root.accounts;
  if (Array.isArray(root.items)) return root.items;
  if (Array.isArray(root.rows)) return root.rows;
  return [];
}

function normalizeAccounts(rows: unknown[]): DnseAccount[] {
  const accounts: DnseAccount[] = [];
  for (const item of rows) {
    const row = toRecord(item);
    if (!row) continue;
    const accountNo =
      readString(row, ["accountNo", "accountId", "account", "id", "subAccountId"]) ?? "";
    if (!accountNo) continue;

    accounts.push({
      accountNo: accountNo.toUpperCase(),
      accountName: readString(row, ["accountName", "name", "customerName"]),
      custodyCode: readString(row, ["custodyCode", "subAccountId", "custody"]),
      accountType: readString(row, ["accountType", "type"]) ?? "SPOT",
      status: readString(row, ["status", "state"]) ?? "ACTIVE",
    });
  }

  const dedup = new Map<string, DnseAccount>();
  for (const account of accounts) {
    if (!dedup.has(account.accountNo)) {
      dedup.set(account.accountNo, account);
    }
  }
  return Array.from(dedup.values());
}

export class DnseTradingClient {
  private readonly apiKey: string;
  private readonly apiSecret: string;
  private readonly baseUrls: string[];
  private readonly userJwtToken: string | null;
  private tradingToken: string | null = null;
  private tokenExpiry = 0;

  constructor(
    apiKey: string,
    apiSecret: string,
    baseUrl = "https://api.dnse.com.vn",
    options?: ClientOptions,
  ) {
    this.apiKey = apiKey.trim();
    this.apiSecret = apiSecret.trim();
    this.baseUrls = normalizeBaseUrls(baseUrl);
    this.userJwtToken = options?.userJwtToken?.trim() || null;
  }

  private generateSignature(auxDate: string) {
    const message = this.apiKey + auxDate;
    return crypto.createHmac("sha256", this.apiSecret).update(message).digest("hex");
  }

  private buildHeaders(includeBody = false) {
    const headers: Record<string, string> = {
      Accept: "application/json",
    };

    if (includeBody) {
      headers["Content-Type"] = "application/json";
    }

    if (this.userJwtToken) {
      headers.Authorization = `Bearer ${this.userJwtToken}`;
    }

    if (this.apiKey) {
      headers["X-API-Key"] = this.apiKey;
      headers["x-api-key"] = this.apiKey;
    }

    if (this.apiKey && this.apiSecret) {
      const auxDate = new Date().toISOString();
      headers["X-Aux-Date"] = auxDate;
      headers["X-Signature"] = this.generateSignature(auxDate);
    }

    return headers;
  }

  private async requestFirstSuccess(
    method: string,
    pathCandidates: string[],
    options?: { body?: string; includeBody?: boolean; label?: string },
  ) {
    let lastError = "Unknown DNSE error";
    for (const baseUrl of this.baseUrls) {
      for (const path of pathCandidates) {
        const url = `${baseUrl}${path.startsWith("/") ? path : `/${path}`}`;
        try {
          const response = await fetch(url, {
            method,
            headers: this.buildHeaders(Boolean(options?.includeBody)),
            body: options?.body,
            cache: "no-store",
            signal: AbortSignal.timeout(15_000),
          });

          if (response.ok) {
            return await response.json();
          }

          const raw = await response.text();
          const normalized = normalizeErrorMessage(raw);
          lastError = `${response.status} ${normalized || raw || response.statusText}`;

          if (looksLikeRouteMismatch(response.status, lastError)) {
            continue;
          }
          if (looksLikeAuthError(response.status, lastError)) {
            throw new Error(lastError);
          }
        } catch (error) {
          lastError = error instanceof Error ? error.message : "Unknown fetch failure";
        }
      }
    }
    throw new Error(`${options?.label ?? "DNSE request failed"}: ${lastError}`);
  }

  async getAccounts(): Promise<DnseAccount[]> {
    const payload = await this.requestFirstSuccess(
      "GET",
      [
        "/accounts",
        "/account-service/accounts",
        "/account-service/api/accounts",
        "/account-service/api/get-accounts",
        "/account-service/get-accounts",
      ],
      { label: "Failed to get accounts" },
    );
    const rows = extractArrayPayload(payload);
    return normalizeAccounts(rows);
  }

  async getBalance(accountNo: string): Promise<DnseBalance> {
    const payload = await this.requestFirstSuccess(
      "GET",
      [
        `/accounts/${accountNo}/balances`,
        `/account-service/accounts/${accountNo}/balances`,
      ],
      { label: "Failed to get balance" },
    );
    const root = toRecord(payload) ?? {};
    const balance = (toRecord(root.data) ?? root) as unknown as DnseBalance;
    return {
      ...balance,
      accountNo: balance.accountNo || accountNo,
      cash: balance.cash ?? balance.cashBalance ?? balance.cashAvailable ?? 0,
      buyingPower: balance.buyingPower ?? balance.cashAvailable ?? 0,
      totalNav: balance.totalNav ?? balance.netAssetValue ?? balance.totalAsset ?? 0,
      debt: balance.debt ?? balance.totalDebt ?? 0,
    };
  }

  async getPositions(accountNo: string): Promise<DnsePosition[]> {
    const payload = await this.requestFirstSuccess(
      "GET",
      [
        `/accounts/${accountNo}/positions`,
        `/account-service/accounts/${accountNo}/positions`,
      ],
      { label: "Failed to get positions" },
    );
    const positions = extractArrayPayload(payload) as Array<Record<string, unknown>>;
    const totalMarketValue = positions.reduce(
      (sum, p) => sum + Number(p.marketValue ?? 0),
      0,
    );

    return positions.map((p) => {
      const avgPrice = Number(p.avgPrice ?? 0);
      const lastPrice = Number(p.lastPrice ?? avgPrice);
      const marketValue = Number(p.marketValue ?? 0);
      return {
        accountNo: String(p.accountNo ?? accountNo),
        symbol: String(p.symbol ?? p.ticker ?? ""),
        ticker: String(p.ticker ?? p.symbol ?? ""),
        quantity: Number(p.quantity ?? 0),
        availableQty: Number(p.availableQty ?? 0),
        avgPrice,
        lastPrice,
        marketValue,
        totalPL: Number(p.totalPL ?? 0),
        totalPLPct: avgPrice > 0 ? ((lastPrice - avgPrice) / avgPrice) * 100 : 0,
        weight: totalMarketValue > 0 ? (marketValue / totalMarketValue) * 100 : 0,
      };
    });
  }

  async getOrders(accountNo: string): Promise<DnseOrder[]> {
    const payload = await this.requestFirstSuccess(
      "GET",
      [
        `/accounts/${accountNo}/orders`,
        `/order-service/accounts/${accountNo}/orders`,
      ],
      { label: "Failed to get orders" },
    );
    return extractArrayPayload(payload) as DnseOrder[];
  }

  async getLoanPackages(accountNo: string): Promise<JsonRecord[]> {
    const payload = await this.requestFirstSuccess(
      "GET",
      [
        `/accounts/${accountNo}/loan-packages`,
        `/loan-service/accounts/${accountNo}/loan-packages`,
      ],
      { label: "Failed to get loan packages" },
    );
    return extractArrayPayload(payload) as JsonRecord[];
  }

  async getPPSE(accountNo: string, symbol: string): Promise<JsonRecord | null> {
    const payload = await this.requestFirstSuccess(
      "GET",
      [
        `/accounts/${accountNo}/ppse?symbol=${encodeURIComponent(symbol)}`,
        `/account-service/accounts/${accountNo}/ppse?symbol=${encodeURIComponent(symbol)}`,
      ],
      { label: "Failed to get PPSE" },
    );
    return (toRecord(payload)?.data as JsonRecord) ?? toRecord(payload);
  }

  async sendEmailOTP(): Promise<void> {
    await this.requestFirstSuccess(
      "GET",
      ["/auth-service/api/email-otp", "/auth-service/email-otp"],
      { label: "Failed to send OTP" },
    );
  }

  async createTradingToken(otp: string): Promise<{ token: string; expiresIn: number }> {
    const payload = await this.requestFirstSuccess(
      "POST",
      ["/order-service/trading-token", "/auth/trading-token"],
      { includeBody: false, label: "Invalid OTP" },
    );

    const root = toRecord(payload) ?? {};
    const nested = toRecord(root.data) ?? {};
    const token =
      readString(root, ["token", "tradingToken", "accessToken"]) ??
      readString(nested, ["token", "tradingToken", "accessToken"]) ??
      "";
    const expiresInRaw =
      Number((root.expiresIn as number | string | undefined) ?? nested.expiresIn ?? 25200) ||
      25200;

    if (!token) {
      throw new Error("DNSE không trả trading token hợp lệ.");
    }
    this.tradingToken = token;
    this.tokenExpiry = Date.now() + expiresInRaw * 1000;

    return { token, expiresIn: expiresInRaw };
  }

  setTradingToken(token: string, expiresIn = 25200) {
    this.tradingToken = token;
    this.tokenExpiry = Date.now() + expiresIn * 1000;
  }

  async placeOrder(params: {
    accountNo: string;
    symbol: string;
    side: "BUY" | "SELL";
    orderType: string;
    price?: number;
    quantity: number;
    loanPackageId?: string;
  }): Promise<{ orderId: string }> {
    if (!this.tradingToken || Date.now() > this.tokenExpiry) {
      throw new Error("Trading token required. Please authenticate with OTP first.");
    }

    const payload = await this.requestFirstSuccess(
      "POST",
      ["/accounts/orders", "/order-service/orders"],
      {
        includeBody: true,
        body: JSON.stringify({
          accountNo: params.accountNo,
          symbol: params.symbol,
          side: params.side,
          orderType: params.orderType,
          price: params.price,
          quantity: params.quantity,
          loanPackageId: params.loanPackageId,
        }),
        label: "Failed to place order",
      },
    );

    const root = toRecord(payload) ?? {};
    const nested = toRecord(root.data) ?? {};
    const orderId =
      readString(root, ["orderId", "id"]) ?? readString(nested, ["orderId", "id"]) ?? "";
    return { orderId };
  }

  async cancelOrder(accountNo: string, orderId: string): Promise<void> {
    if (!this.tradingToken) {
      throw new Error("Trading token required");
    }
    await this.requestFirstSuccess(
      "DELETE",
      [`/accounts/${accountNo}/orders/${orderId}`, `/order-service/accounts/${accountNo}/orders/${orderId}`],
      { label: "Failed to cancel order" },
    );
  }
}

let clientInstance: DnseTradingClient | null = null;

export function getDnseTradingClient(options?: {
  userJwtToken?: string | null;
  isolated?: boolean;
}): DnseTradingClient {
  const apiKey = process.env.DNSE_API_KEY?.trim() ?? "";
  const apiSecret = process.env.DNSE_API_SECRET?.trim() ?? "";
  const baseUrl = process.env.DNSE_TRADING_BASE_URL?.trim() || "https://api.dnse.com.vn";
  const userJwtToken = options?.userJwtToken?.trim() || null;

  if (options?.isolated || userJwtToken) {
    return new DnseTradingClient(apiKey, apiSecret, baseUrl, { userJwtToken });
  }

  if (!clientInstance) {
    if (!apiKey) {
      throw new Error("DNSE_API_KEY chưa được cấu hình trong môi trường.");
    }
    clientInstance = new DnseTradingClient(apiKey, apiSecret, baseUrl);
  }

  return clientInstance;
}
