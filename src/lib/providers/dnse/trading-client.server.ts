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
    "https://services.entrade.com.vn",
    "https://api.dnse.com.vn",
    "https://openapi.dnse.com.vn",
  ]
    .map((base) => base.replace(/\/+$/, ""))
    .filter(Boolean);

  return all.filter((value, index, arr) => arr.indexOf(value) === index);
}

function isOpenApiHost(baseUrl: string) {
  return /openapi\.dnse\.com\.vn$/i.test(baseUrl);
}

function isApiHost(baseUrl: string) {
  return /api\.dnse\.com\.vn$/i.test(baseUrl);
}

function isServiceHost(baseUrl: string) {
  return /services\.entrade\.com\.vn$/i.test(baseUrl);
}

function pad2(value: number) {
  return String(value).padStart(2, "0");
}

function formatDateHeader(date: Date) {
  const dayNames = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  const monthNames = [
    "Jan",
    "Feb",
    "Mar",
    "Apr",
    "May",
    "Jun",
    "Jul",
    "Aug",
    "Sep",
    "Oct",
    "Nov",
    "Dec",
  ];
  return `${dayNames[date.getUTCDay()]}, ${pad2(date.getUTCDate())} ${
    monthNames[date.getUTCMonth()]
  } ${date.getUTCFullYear()} ${pad2(date.getUTCHours())}:${pad2(
    date.getUTCMinutes(),
  )}:${pad2(date.getUTCSeconds())} +0000`;
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

  private generateOpenApiSignature(method: string, path: string, dateValue: string, nonce: string) {
    const signatureString = `(request-target): ${method.toLowerCase()} ${path}\ndate: ${dateValue}\nnonce: ${nonce}`;
    const signature = crypto
      .createHmac("sha256", Buffer.from(this.apiSecret, "utf8"))
      .update(signatureString, "utf8")
      .digest("base64");
    const escaped = encodeURIComponent(signature);
    return `Signature keyId="${this.apiKey}",algorithm="hmac-sha256",headers="(request-target) date",signature="${escaped}",nonce="${nonce}"`;
  }

  private buildHeaders(
    method: string,
    path: string,
    includeBody = false,
    includeAuthorization = false,
    baseUrl?: string,
  ) {
    const headers: Record<string, string> = {
      Accept: "application/json",
    };

    if (includeBody) {
      headers["Content-Type"] = "application/json";
    }

    if (includeAuthorization && this.userJwtToken) {
      headers.Authorization = `Bearer ${this.userJwtToken}`;
      return headers;
    }

    if (this.apiKey) {
      headers["x-api-key"] = this.apiKey;
      headers["X-API-Key"] = this.apiKey;
    }

    if (baseUrl && (isApiHost(baseUrl) || isServiceHost(baseUrl))) {
      // auth-service/order-service trên api/services chỉ cần x-api-key khi không có JWT linked-user.
      return headers;
    }

    const dateValue = formatDateHeader(new Date());
    const nonce = crypto.randomUUID().replace(/-/g, "");
    headers.Date = dateValue;
    headers["X-Signature"] = this.generateOpenApiSignature(method, path, dateValue, nonce);

    return headers;
  }

  private async requestFirstSuccess(
    method: string,
    pathCandidates: string[],
    options?: {
      body?: string;
      includeBody?: boolean;
      label?: string;
      includeAuthorization?: boolean;
      baseFilter?: "all" | "api" | "openapi" | "service";
      debugTag?: string;
    },
  ) {
    let lastError = "Unknown DNSE error";
    let lastAuthError: string | null = null;
    for (const baseUrl of this.baseUrls) {
      if (options?.baseFilter === "api" && !isApiHost(baseUrl)) continue;
      if (options?.baseFilter === "openapi" && !isOpenApiHost(baseUrl)) continue;
      if (options?.baseFilter === "service" && !isServiceHost(baseUrl)) continue;
      for (const path of pathCandidates) {
        const url = `${baseUrl}${path.startsWith("/") ? path : `/${path}`}`;
        try {
          const headers = this.buildHeaders(
            method,
            path.startsWith("/") ? path : `/${path}`,
            Boolean(options?.includeBody),
            Boolean(options?.includeAuthorization),
            baseUrl,
          );
          if (options?.debugTag) {
            const debugLabel = `[DNSE ${options.debugTag}]`;
            const logHeaders = { ...headers };
            if (logHeaders.Authorization) {
              const token = logHeaders.Authorization;
              logHeaders.Authorization =
                token.length > 24 ? `${token.slice(0, 24)}...` : "***";
            }
            const auxDate = new Date().toISOString();
            const signaturePreview = this.apiSecret
              ? this.generateOpenApiSignature(
              method,
              path.startsWith("/") ? path : `/${path}`,
              formatDateHeader(new Date()),
              crypto.randomUUID().replace(/-/g, ""),
                )
              : "";
            console.log(`${debugLabel} URL:`, url);
            console.log(
              `${debugLabel} API Key (first 20 chars):`,
              this.apiKey ? this.apiKey.substring(0, 20) : "(missing)",
            );
            console.log(`${debugLabel} API Secret exists:`, !!this.apiSecret);
            console.log(`${debugLabel} Aux-Date:`, auxDate);
            console.log(`${debugLabel} Signature (first 20 chars):`, signaturePreview.substring(0, 20));
            console.log(`${debugLabel} Headers:`, JSON.stringify(logHeaders, null, 2));
          }
          const response = await fetch(url, {
            method,
            headers,
            body: options?.body,
            cache: "no-store",
            signal: AbortSignal.timeout(15_000),
          });

          const responseText = await response.text();
          if (options?.debugTag) {
            const debugLabel = `[DNSE ${options.debugTag}]`;
            console.log(`${debugLabel} Response status:`, response.status);
            console.log(
              `${debugLabel} Response headers:`,
              JSON.stringify(Object.fromEntries(response.headers.entries()), null, 2),
            );
            console.log(`${debugLabel} Response body:`, responseText);
          }

          if (response.ok) {
            if (process.env.DNSE_DEBUG === "true" && !options?.debugTag) {
              console.info("[DNSE_CLIENT] request_ok", { method, baseUrl, path });
            }
            if (!responseText.trim()) return {} as JsonRecord;
            try {
              return JSON.parse(responseText) as unknown;
            } catch {
              throw new Error(`DNSE response is not valid JSON: ${responseText}`);
            }
          }

          const normalized = normalizeErrorMessage(responseText);
          lastError = `${response.status} ${normalized || responseText || response.statusText}`;
          if (process.env.DNSE_DEBUG === "true" && !options?.debugTag) {
            console.warn("[DNSE_CLIENT] request_failed", {
              method,
              baseUrl,
              path,
              status: response.status,
              error: lastError,
            });
          }

          if (looksLikeRouteMismatch(response.status, lastError)) {
            continue;
          }
          if (looksLikeAuthError(response.status, lastError)) {
            lastAuthError = lastError;
            continue;
          }
        } catch (error) {
          lastError = error instanceof Error ? error.message : "Unknown fetch failure";
          if (looksLikeAuthError(0, lastError)) {
            lastAuthError = lastError;
            continue;
          }
        }
      }
    }
    if (lastAuthError) {
      throw new Error(lastAuthError);
    }
    throw new Error(`${options?.label ?? "DNSE request failed"}: ${lastError}`);
  }

  async getAccounts(): Promise<DnseAccount[]> {
    // Luồng user-session: chỉ dùng JWT để gọi account list theo endpoint DNSE auth/order.
    // Không fallback qua API key nhằm tránh link nhầm account.
    if (this.userJwtToken) {
      console.log("[DNSE getAccounts] mode=user-jwt");
      console.log("[DNSE getAccounts] baseUrls:", JSON.stringify(this.baseUrls));
      console.log("[DNSE getAccounts] apiSecretExists:", !!this.apiSecret);
      console.log(
        "[DNSE getAccounts] jwtPreview:",
        this.userJwtToken.length > 20 ? `${this.userJwtToken.slice(0, 20)}...` : "***",
      );

      try {
        const payloadApi = await this.requestFirstSuccess(
          "GET",
          ["/order-service/accounts", "/order-service/api/accounts"],
          {
            label: "Failed to get accounts",
            includeAuthorization: true,
            baseFilter: "api",
            debugTag: "getAccounts",
          },
        );
        const accountsApi = normalizeAccounts(extractArrayPayload(payloadApi));
        console.log("[DNSE getAccounts] parsedAccounts(api):", accountsApi.length);
        if (accountsApi.length > 0) return accountsApi;
      } catch (apiError) {
        console.warn("[DNSE getAccounts] api-host failed, trying service-host", {
          message: apiError instanceof Error ? apiError.message : "unknown_error",
        });
      }

      const payloadService = await this.requestFirstSuccess(
        "GET",
        ["/dnse-order-service/accounts", "/dnse-order-service/api/accounts", "/order-service/accounts"],
        {
          label: "Failed to get accounts",
          includeAuthorization: true,
          baseFilter: "service",
          debugTag: "getAccounts",
        },
      );
      const accountsService = normalizeAccounts(extractArrayPayload(payloadService));
      console.log("[DNSE getAccounts] parsedAccounts(service):", accountsService.length);
      if (accountsService.length > 0) {
        return accountsService;
      }
      throw new Error("Failed to get accounts: empty account list from DNSE session");
    }

    // Fallback chuẩn SDK DNSE: OpenAPI HMAC, không gửi Authorization bearer.
    console.log("[DNSE getAccounts] mode=openapi-hmac");
    console.log("[DNSE getAccounts] baseUrls:", JSON.stringify(this.baseUrls));
    console.log(
      "[DNSE getAccounts] apiKeyPreview:",
      this.apiKey ? `${this.apiKey.slice(0, 20)}...` : "(missing)",
    );
    console.log("[DNSE getAccounts] apiSecretExists:", !!this.apiSecret);
    const payload = await this.requestFirstSuccess("GET", ["/accounts"], {
      label: "Failed to get accounts",
      includeAuthorization: false,
      baseFilter: "openapi",
    });
    const root = toRecord(payload);
    const rows = Array.isArray(root?.accounts) ? root.accounts : extractArrayPayload(payload);
    return normalizeAccounts(rows);
  }
  async getBalance(accountNo: string): Promise<DnseBalance> {
    console.log("[DNSE getBalance] Account:", accountNo);
    const useLinkedSession = Boolean(this.userJwtToken);
    const payload = await this.requestFirstSuccess(
      "GET",
      [
        `/accounts/${accountNo}/balances`,
        `/accounts/${accountNo}/balance`,
        `/order-service/accounts/${accountNo}/balances`,
        `/order-service/api/accounts/${accountNo}/balances`,
        `/account-service/accounts/${accountNo}/balances`,
        `/account-service/api/accounts/${accountNo}/balances`,
        `/dnse-order-service/accounts/${accountNo}/balances`,
      ],
      {
        label: "Failed to get balance",
        includeAuthorization: useLinkedSession,
        baseFilter: useLinkedSession ? "all" : "openapi",
        debugTag: "getBalance",
      },
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
    console.log("[DNSE getPositions] Account:", accountNo);
    const useLinkedSession = Boolean(this.userJwtToken);
    const payload = await this.requestFirstSuccess(
      "GET",
      [
        `/accounts/${accountNo}/positions`,
        `/accounts/${accountNo}/holdings`,
        `/order-service/accounts/${accountNo}/positions`,
        `/order-service/api/accounts/${accountNo}/positions`,
        `/account-service/accounts/${accountNo}/positions`,
        `/account-service/api/accounts/${accountNo}/positions`,
        `/dnse-order-service/accounts/${accountNo}/positions`,
      ],
      {
        label: "Failed to get positions",
        includeAuthorization: useLinkedSession,
        baseFilter: useLinkedSession ? "all" : "openapi",
        debugTag: "getPositions",
      },
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
    console.log("[DNSE getOrders] Account:", accountNo);
    const useLinkedSession = Boolean(this.userJwtToken);
    const payload = await this.requestFirstSuccess(
      "GET",
      [
        `/accounts/${accountNo}/orders`,
        `/accounts/${accountNo}/orders?assetType=STOCK`,
        `/order-service/accounts/${accountNo}/orders`,
        `/order-service/api/accounts/${accountNo}/orders`,
      ],
      {
        label: "Failed to get orders",
        includeAuthorization: useLinkedSession,
        baseFilter: useLinkedSession ? "all" : "openapi",
        debugTag: "getOrders",
      },
    );
    return extractArrayPayload(payload) as DnseOrder[];
  }

  async getLoanPackages(accountNo: string): Promise<JsonRecord[]> {
    console.log("[DNSE getLoanPackages] Account:", accountNo);
    const useLinkedSession = Boolean(this.userJwtToken);
    const payload = await this.requestFirstSuccess(
      "GET",
      [
        `/accounts/${accountNo}/loan-packages`,
        `/order-service/accounts/${accountNo}/loan-packages`,
        `/order-service/api/accounts/${accountNo}/loan-packages`,
        `/loan-service/accounts/${accountNo}/loan-packages`,
      ],
      {
        label: "Failed to get loan packages",
        includeAuthorization: useLinkedSession,
        baseFilter: useLinkedSession ? "all" : "openapi",
        debugTag: "getLoanPackages",
      },
    );
    return extractArrayPayload(payload) as JsonRecord[];
  }

  async getPPSE(accountNo: string, symbol: string): Promise<JsonRecord | null> {
    console.log("[DNSE getPPSE] Account:", accountNo, "Symbol:", symbol);
    const useLinkedSession = Boolean(this.userJwtToken);
    const payload = await this.requestFirstSuccess(
      "GET",
      [
        `/accounts/${accountNo}/ppse?symbol=${encodeURIComponent(symbol)}`,
        `/order-service/accounts/${accountNo}/ppse?symbol=${encodeURIComponent(symbol)}`,
        `/order-service/api/accounts/${accountNo}/ppse?symbol=${encodeURIComponent(symbol)}`,
        `/account-service/accounts/${accountNo}/ppse?symbol=${encodeURIComponent(symbol)}`,
      ],
      {
        label: "Failed to get PPSE",
        includeAuthorization: useLinkedSession,
        baseFilter: useLinkedSession ? "all" : "openapi",
        debugTag: "getPPSE",
      },
    );
    return (toRecord(payload)?.data as JsonRecord) ?? toRecord(payload);
  }

  async sendEmailOTP(): Promise<void> {
    await this.requestFirstSuccess(
      "GET",
      ["/auth-service/api/email-otp", "/auth-service/email-otp"],
      { label: "Failed to send OTP", includeAuthorization: true, baseFilter: "api" },
    );
  }

  async createTradingToken(otp: string): Promise<{ token: string; expiresIn: number }> {
    const payload = await this.requestFirstSuccess(
      "POST",
      ["/order-service/trading-token", "/auth/trading-token"],
      { includeBody: false, label: "Invalid OTP", includeAuthorization: true, baseFilter: "api" },
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
        includeAuthorization: false,
        baseFilter: "openapi",
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
      { label: "Failed to cancel order", includeAuthorization: false, baseFilter: "openapi" },
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
  const baseUrl = process.env.DNSE_TRADING_BASE_URL?.trim() || "https://openapi.dnse.com.vn";
  const userJwtToken = options?.userJwtToken?.trim() || null;

  if (options?.isolated || userJwtToken) {
    if (!apiKey) {
      throw new Error("DNSE_API_KEY chưa được cấu hình trong môi trường.");
    }
    if (!apiSecret) {
      throw new Error("DNSE_API_SECRET chưa được cấu hình trong môi trường.");
    }
    return new DnseTradingClient(apiKey, apiSecret, baseUrl, { userJwtToken });
  }

  if (!clientInstance) {
    if (!apiKey) {
      throw new Error("DNSE_API_KEY chưa được cấu hình trong môi trường.");
    }
    if (!apiSecret) {
      throw new Error("DNSE_API_SECRET chưa được cấu hình trong môi trường.");
    }
    clientInstance = new DnseTradingClient(apiKey, apiSecret, baseUrl);
  }

  return clientInstance;
}

