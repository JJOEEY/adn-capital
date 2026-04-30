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

const DEFAULT_MARKET_TYPE = "STOCK";
const DEFAULT_ORDER_CATEGORY = "NORMAL";

function isDnseDebugEnabled() {
  return process.env.DNSE_DEBUG === "true";
}

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

function readNumber(row: JsonRecord, keys: string[], fallback = 0) {
  for (const key of keys) {
    const raw = row[key];
    if (typeof raw === "number" && Number.isFinite(raw)) return raw;
    if (typeof raw === "string") {
      const normalized = raw.replace(/,/g, "").trim();
      if (!normalized) continue;
      const parsed = Number(normalized);
      if (Number.isFinite(parsed)) return parsed;
    }
  }
  return fallback;
}

function readNumberValue(row: JsonRecord, key: string): number | null {
  const raw = row[key];
  if (typeof raw === "number" && Number.isFinite(raw)) return raw;
  if (typeof raw === "string") {
    const normalized = raw.replace(/,/g, "").trim();
    if (!normalized) return null;
    const parsed = Number(normalized);
    if (Number.isFinite(parsed)) return parsed;
  }
  return null;
}

function readBestNumber(row: JsonRecord, keys: string[], fallback = 0) {
  const values = keys
    .map((key) => readNumberValue(row, key))
    .filter((value): value is number => value != null);
  const positive = values.find((value) => value > 0);
  return positive ?? values[0] ?? fallback;
}

const BALANCE_CASH_KEYS = [
  "cash",
  "cashBalance",
  "cashAvailable",
  "availableCash",
  "cashWithdrawable",
  "withdrawableCash",
  "availableBalance",
  "availableAmount",
];

const BALANCE_BUYING_POWER_KEYS = [
  "buyingPower",
  "purchasingPower",
  "cashAvailable",
  "availableCash",
  "cashWithdrawable",
  "withdrawableCash",
  "availableBalance",
  "availableAmount",
  "maxBuyAmount",
  "maxBuyValue",
  "buyingPowerValue",
  "pp",
  "PP",
  "ppse",
  "PPSE",
];

const BALANCE_NAV_KEYS = [
  "totalNav",
  "netAssetValue",
  "totalAsset",
  "totalAssets",
  "nav",
  "asset",
  "totalValue",
  "accountValue",
  "equity",
];

const BALANCE_DEBT_KEYS = ["debt", "totalDebt", "marginDebt", "loan", "totalLoan"];

function normalizeBalance(row: JsonRecord, accountNo: string): DnseBalance {
  const totalNav = readBestNumber(row, BALANCE_NAV_KEYS, 0);
  const buyingPower = readBestNumber(row, BALANCE_BUYING_POWER_KEYS, 0);
  const cash = readBestNumber(row, BALANCE_CASH_KEYS, buyingPower);
  const debt = readBestNumber(row, BALANCE_DEBT_KEYS, 0);

  return {
    ...(row as Partial<DnseBalance>),
    accountNo: readString(row, ["accountNo", "accountId", "account", "id"]) ?? accountNo,
    cash,
    buyingPower,
    totalNav,
    debt,
    cashBalance: readBestNumber(row, ["cashBalance", ...BALANCE_CASH_KEYS], cash),
    cashAvailable: readBestNumber(row, ["cashAvailable", ...BALANCE_BUYING_POWER_KEYS], buyingPower),
    cashWithdrawable: readBestNumber(row, ["cashWithdrawable", "withdrawableCash", ...BALANCE_CASH_KEYS], cash),
    totalAsset: readBestNumber(row, ["totalAsset", ...BALANCE_NAV_KEYS], totalNav),
    totalDebt: readBestNumber(row, ["totalDebt", ...BALANCE_DEBT_KEYS], debt),
    netAssetValue: readBestNumber(row, ["netAssetValue", ...BALANCE_NAV_KEYS], totalNav),
  };
}

function normalizeBaseUrls(baseUrl?: string) {
  const canonicalize = (raw: string) =>
    raw
      .trim()
      .replace(/\/+$/, "");
  const envBaseUrls = (process.env.DNSE_TRADING_BASE_URLS ?? "")
    .split(",")
    .map((item) => canonicalize(item))
    .filter(Boolean);
  const baseFromEnv = process.env.DNSE_TRADING_BASE_URL
    ? canonicalize(process.env.DNSE_TRADING_BASE_URL)
    : undefined;
  const all = [
    ...(baseUrl?.trim() ? [canonicalize(baseUrl)] : []),
    ...envBaseUrls,
    ...(baseFromEnv ? [baseFromEnv] : []),
    "https://api.dnse.com.vn/openapi",
    "https://api.dnse.com.vn",
    "https://services.entrade.com.vn",
    "https://openapi.dnse.com.vn",
  ]
    .filter(Boolean);

  return all.filter((value, index, arr) => arr.indexOf(value) === index);
}

function getHostname(baseUrl: string) {
  try {
    return new URL(baseUrl).hostname.toLowerCase();
  } catch {
    return baseUrl.toLowerCase().replace(/^https?:\/\//, "").replace(/\/+$/, "");
  }
}

function isOpenApiHost(baseUrl: string) {
  if (getHostname(baseUrl) === "openapi.dnse.com.vn") return true;
  try {
    const parsed = new URL(baseUrl);
    return parsed.hostname.toLowerCase() === "api.dnse.com.vn" && /^\/openapi(\/|$)/i.test(parsed.pathname);
  } catch {
    return false;
  }
}

function isApiHost(baseUrl: string) {
  if (getHostname(baseUrl) !== "api.dnse.com.vn") return false;
  try {
    return !/^\/openapi(\/|$)/i.test(new URL(baseUrl).pathname);
  } catch {
    return true;
  }
}

function isServiceHost(baseUrl: string) {
  return getHostname(baseUrl) === "services.entrade.com.vn";
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
  const arrayKeys = [
    "accounts",
    "positions",
    "loanPackages",
    "orders",
    "orderHistory",
    "items",
    "rows",
    "packages",
  ];
  if (nested) {
    for (const key of arrayKeys) {
      if (Array.isArray(nested[key])) return nested[key] as unknown[];
    }
  }
  for (const key of arrayKeys) {
    if (Array.isArray(root[key])) return root[key] as unknown[];
  }
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

function buildPathWithQuery(
  path: string,
  query?: Record<string, string | number | null | undefined>,
) {
  if (!query) return path;
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(query)) {
    if (value == null || value === "") continue;
    search.set(key, String(value));
  }
  const queryString = search.toString();
  return queryString ? `${path}?${queryString}` : path;
}

function getPathnameForSignature(path: string) {
  const normalizedPath = path.startsWith("/") ? path : `/${path}`;
  return normalizedPath.split("?")[0] || "/";
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
    baseUrl = "https://openapi.dnse.com.vn",
    options?: ClientOptions,
  ) {
    this.apiKey = apiKey.trim();
    this.apiSecret = apiSecret.trim();
    this.baseUrls = normalizeBaseUrls(baseUrl);
    this.userJwtToken = options?.userJwtToken?.trim() || null;
  }

  private generateOpenApiSignature(
    method: string,
    path: string,
    dateValue: string,
    nonce: string,
    dateHeaderName = "X-Aux-Date",
  ) {
    const dateHeaderKey = dateHeaderName.toLowerCase();
    const signatureString = `(request-target): ${method.toLowerCase()} ${path}\n${dateHeaderKey}: ${dateValue}\nnonce: ${nonce}`;
    const signature = crypto
      .createHmac("sha256", Buffer.from(this.apiSecret, "utf8"))
      .update(signatureString, "utf8")
      .digest("base64");
    const escaped = encodeURIComponent(signature);
    return `Signature keyId="${this.apiKey}",algorithm="hmac-sha256",headers="(request-target) ${dateHeaderKey}",signature="${escaped}",nonce="${nonce}"`;
  }

  private buildHeaders(
    method: string,
    path: string,
    includeBody = false,
    includeAuthorization = false,
    baseUrl?: string,
    extraHeaders?: Record<string, string>,
  ) {
    const headers: Record<string, string> = {
      Accept: "application/json",
    };

    if (includeBody) {
      headers["Content-Type"] = "application/json";
    }

    if (includeAuthorization && this.userJwtToken) {
      headers.Authorization = `Bearer ${this.userJwtToken}`;
    }

    const includeApiKeyForSession = process.env.DNSE_SESSION_INCLUDE_API_KEY === "true";
    const shouldAttachApiKey = Boolean(this.apiKey) && (!includeAuthorization || includeApiKeyForSession);
    if (shouldAttachApiKey) {
      headers["x-api-key"] = this.apiKey;
      headers["X-API-Key"] = this.apiKey;
    }

    if (baseUrl && isServiceHost(baseUrl)) {
      // auth-service/order-service trên api/services chỉ cần x-api-key khi không có JWT linked-user.
      Object.assign(headers, extraHeaders);
      return headers;
    }

    const dateHeaderName = process.env.DNSE_DATE_HEADER?.trim() || "X-Aux-Date";
    const dateValue = formatDateHeader(new Date());
    const nonce = crypto.randomUUID().replace(/-/g, "");
    headers[dateHeaderName] = dateValue;
    if (dateHeaderName.toLowerCase() !== "date") {
      headers.Date = dateValue;
    }
    headers["X-Signature"] = this.generateOpenApiSignature(
      method,
      path,
      dateValue,
      nonce,
      dateHeaderName,
    );
    Object.assign(headers, extraHeaders);

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
      extraHeaders?: Record<string, string>;
    },
  ) {
    let lastError = "Unknown DNSE error";
    let lastAuthError: string | null = null;
    const debugTag = isDnseDebugEnabled() ? options?.debugTag : undefined;
    for (const baseUrl of this.baseUrls) {
      if (options?.baseFilter === "api" && !isApiHost(baseUrl)) continue;
      if (options?.baseFilter === "openapi" && !isOpenApiHost(baseUrl)) continue;
      if (options?.baseFilter === "service" && !isServiceHost(baseUrl)) continue;
      for (const path of pathCandidates) {
        const normalizedPath = path.startsWith("/") ? path : `/${path}`;
        const signedPath = getPathnameForSignature(normalizedPath);
        const url = `${baseUrl}${normalizedPath}`;
        try {
          const headers = this.buildHeaders(
            method,
            signedPath,
            Boolean(options?.includeBody),
            Boolean(options?.includeAuthorization),
            baseUrl,
            options?.extraHeaders,
          );
          if (debugTag) {
            const debugLabel = `[DNSE ${debugTag}]`;
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
              signedPath,
              formatDateHeader(new Date()),
              crypto.randomUUID().replace(/-/g, ""),
                )
              : "";
            console.log(`${debugLabel} URL:`, url);
            console.log(`${debugLabel} API Key configured:`, Boolean(this.apiKey));
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
          if (debugTag) {
            const debugLabel = `[DNSE ${debugTag}]`;
            console.log(`${debugLabel} Response status:`, response.status);
            console.log(
              `${debugLabel} Response headers:`,
              JSON.stringify(Object.fromEntries(response.headers.entries()), null, 2),
            );
            console.log(`${debugLabel} Response body:`, responseText);
          }

          if (response.ok) {
            if (isDnseDebugEnabled() && !debugTag) {
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
          if (isDnseDebugEnabled() && !debugTag) {
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

  private async requestLinkedUserFirst(
    method: string,
    apiPaths: string[],
    servicePaths: string[],
    label: string,
    debugTag: string,
  ) {
    if (!this.userJwtToken) return null;

    if (servicePaths.length) {
      try {
        return await this.requestFirstSuccess(method, servicePaths, {
          label,
          includeAuthorization: true,
          baseFilter: "service",
          debugTag: `${debugTag}Session`,
        });
      } catch (serviceError) {
        if (isDnseDebugEnabled()) {
          console.warn(`[DNSE ${debugTag}] session service-host failed, trying openapi fallback`, {
            message: serviceError instanceof Error ? serviceError.message : "unknown_error",
          });
        }
      }
    }

    try {
      return await this.requestFirstSuccess(method, apiPaths, {
        label,
        includeAuthorization: false,
        baseFilter: "openapi",
        debugTag,
      });
    } catch (apiError) {
      if (isDnseDebugEnabled()) {
        console.warn(`[DNSE ${debugTag}] openapi fallback failed`, {
          message: apiError instanceof Error ? apiError.message : "unknown_error",
        });
      }
    }

    return null;
  }

  private mapPositions(rows: unknown[], fallbackAccountNo: string): DnsePosition[] {
    const normalized = rows
      .map((item) => {
        const row = toRecord(item) ?? {};
        const symbol =
          readString(row, ["symbol", "ticker", "stockCode", "secSymbol", "code"]) ?? "";
        const quantity = readNumber(row, [
          "quantity",
          "totalQuantity",
          "accumulateQuantity",
          "openQuantity",
          "volume",
          "actualVolume",
          "onHand",
          "stockQuantity",
          "totalVolume",
        ]);
        const availableQty = readNumber(row, [
          "availableQty",
          "availableQuantity",
          "available",
          "tradeQuantity",
          "openQuantity",
          "sellableQuantity",
          "sellableQty",
        ], quantity);
        const avgPrice = readNumber(row, [
          "avgPrice",
          "averagePrice",
          "costPrice",
          "breakEvenPrice",
          "avgCost",
          "buyPrice",
          "price",
        ]);
        const lastPrice = readNumber(row, [
          "lastPrice",
          "marketPrice",
          "currentPrice",
          "closePrice",
          "referencePrice",
        ], avgPrice);
        const computedMarketValue = quantity > 0 && lastPrice > 0 ? quantity * lastPrice : 0;
        const marketValue = readNumber(row, [
          "marketValue",
          "currentValue",
          "totalValue",
          "assetValue",
          "amount",
          "value",
        ], computedMarketValue);
        const totalPL = readNumber(row, [
          "totalPL",
          "pl",
          "profitLoss",
          "unrealizedPL",
          "unrealizedProfit",
          "profit",
        ], quantity > 0 && avgPrice > 0 && lastPrice > 0 ? quantity * (lastPrice - avgPrice) : 0);
        const totalPLPct =
          readNumber(row, ["totalPLPct", "profitLossRate", "profitPercent", "pnlPercent"], Number.NaN);
        return {
          accountNo:
            readString(row, ["accountNo", "accountId", "account", "subAccount"]) ?? fallbackAccountNo,
          symbol,
          ticker: symbol,
          quantity,
          availableQty,
          avgPrice,
          lastPrice,
          marketValue,
          totalPL,
          totalPLPct: Number.isFinite(totalPLPct)
            ? totalPLPct
            : avgPrice > 0
              ? ((lastPrice - avgPrice) / avgPrice) * 100
              : 0,
          weight: 0,
        };
      })
      .filter((position) => position.symbol);

    const totalMarketValue = normalized.reduce((sum, position) => sum + position.marketValue, 0);
    return normalized.map((position) => ({
      ...position,
      weight: totalMarketValue > 0 ? (position.marketValue / totalMarketValue) * 100 : 0,
    }));
  }

  private mapOrders(rows: unknown[], fallbackAccountNo: string): DnseOrder[] {
    return rows.map((item) => {
      const row = toRecord(item) ?? {};
      const sideRaw = readString(row, ["side", "orderSide"]);
      const sideNormalized = sideRaw?.toUpperCase() === "NS" || sideRaw?.toUpperCase() === "SELL"
        ? "SELL"
        : "BUY";
      const quantity = readNumber(row, [
        "quantity",
        "orderQty",
        "orderQuantity",
        "accumulateQuantity",
      ]);
      const filledQty = readNumber(row, [
        "filledQty",
        "filledQuantity",
        "matchQty",
        "fillQuantity",
      ]);
      return {
        orderId: readString(row, ["orderId", "id", "orderNumber", "refOrderId"]) ?? "",
        accountNo: readString(row, ["accountNo", "account", "subAccount"]) ?? fallbackAccountNo,
        symbol: readString(row, ["symbol", "ticker", "code"]) ?? "",
        side: sideNormalized,
        orderType: readString(row, ["orderType", "type", "priceType"]) ?? "",
        price: readNumber(row, ["price", "orderPrice", "limitPrice", "averagePrice"]),
        quantity,
        filledQty,
        remainingQty: readNumber(row, [
          "remainingQty",
          "remainingQuantity",
          "leaveQty",
          "leaveQuantity",
          "unfilledQty",
        ], Math.max(0, quantity - filledQty)),
        status: readString(row, ["status", "orderStatus", "state"]) ?? "",
        createdAt:
          readString(row, ["createdAt", "createdTime", "submittedAt", "orderDate", "tradingDate", "createdDate"]) ??
          "",
        updatedAt:
          readString(row, ["updatedAt", "updatedTime", "modifiedAt", "lastUpdatedAt", "modifiedDate"]) ?? "",
      };
    });
  }

  async getAccounts(): Promise<DnseAccount[]> {
    // Luồng user-session: chỉ dùng JWT để gọi account list theo endpoint DNSE auth/order.
    // Không fallback qua API key nhằm tránh link nhầm account.
    if (this.userJwtToken) {
      if (isDnseDebugEnabled()) {
        console.log("[DNSE getAccounts] mode=user-jwt");
        console.log("[DNSE getAccounts] baseUrls:", JSON.stringify(this.baseUrls));
      }

      try {
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
        if (isDnseDebugEnabled()) {
          console.log("[DNSE getAccounts] parsedAccounts(service):", accountsService.length);
        }
        if (accountsService.length > 0) {
          return accountsService;
        }
      } catch (serviceError) {
        if (isDnseDebugEnabled()) {
          console.warn("[DNSE getAccounts] service-host failed, trying openapi-hmac", {
            message: serviceError instanceof Error ? serviceError.message : "unknown_error",
          });
        }
      }

      const payloadOpenApi = await this.requestFirstSuccess("GET", ["/accounts"], {
        label: "Failed to get accounts",
        includeAuthorization: false,
        baseFilter: "openapi",
        debugTag: "getAccounts",
      });
      const accountsOpenApi = normalizeAccounts(extractArrayPayload(payloadOpenApi));
      if (isDnseDebugEnabled()) {
        console.log("[DNSE getAccounts] parsedAccounts(openapi):", accountsOpenApi.length);
      }
      if (accountsOpenApi.length > 0) return accountsOpenApi;
      throw new Error("Failed to get accounts: empty account list from DNSE session");
    }

    // Fallback chuẩn SDK DNSE: OpenAPI HMAC, không gửi Authorization bearer.
    if (isDnseDebugEnabled()) {
      console.log("[DNSE getAccounts] mode=openapi-hmac");
      console.log("[DNSE getAccounts] baseUrls:", JSON.stringify(this.baseUrls));
    }
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
    if (isDnseDebugEnabled()) console.log("[DNSE getBalance] Account:", accountNo);
    const sessionApiPaths = [
      `/order-service/account-balances/${accountNo}`,
      `/order-service/accounts/${accountNo}/balances`,
      `/order-service/api/accounts/${accountNo}/balances`,
    ];
    const sessionServicePaths = [
      `/dnse-order-service/account-balances/${accountNo}`,
      `/dnse-order-service/accounts/${accountNo}/balances`,
      `/dnse-order-service/api/accounts/${accountNo}/balances`,
    ];
    const sessionPayload = await this.requestLinkedUserFirst(
      "GET",
      sessionApiPaths,
      sessionServicePaths,
      "Failed to get balance",
      "getBalance",
    );
    if (sessionPayload) {
      const rootSession = toRecord(sessionPayload) ?? {};
      const balanceSession = toRecord(rootSession.data) ?? rootSession;
      return normalizeBalance(balanceSession, accountNo);
    }

    if (this.userJwtToken && isDnseDebugEnabled()) {
      console.warn("[DNSE getBalance] Session API failed, fallback to OpenAPI.");
    }

    const payload = await this.requestFirstSuccess(
      "GET",
      [`/accounts/${accountNo}/balances`],
      {
        label: "Failed to get balance",
        includeAuthorization: false,
        baseFilter: "openapi",
        debugTag: "getBalance",
      },
    );
    const root = toRecord(payload) ?? {};
    const balance = toRecord(root.data) ?? root;
    return normalizeBalance(balance, accountNo);
  }

  async getPositions(accountNo: string, marketType = DEFAULT_MARKET_TYPE): Promise<DnsePosition[]> {
    if (isDnseDebugEnabled()) console.log("[DNSE getPositions] Account:", accountNo);
    const accountQuery = {
      accountId: accountNo,
      accountNo,
      marketType,
      pageSize: 100,
    };
    const sessionPath = buildPathWithQuery(`/order-service/accounts/${accountNo}/positions`, {
      marketType,
      pageSize: 100,
    });
    const sessionPathAccountPositions = buildPathWithQuery(
      `/order-service/account-positions/${accountNo}`,
      { marketType, pageSize: 100 },
    );
    const sessionPathStockPositions = buildPathWithQuery(`/order-service/stock-positions/${accountNo}`, {
      marketType,
      pageSize: 100,
    });
    const sessionServicePath = buildPathWithQuery(
      `/dnse-order-service/accounts/${accountNo}/positions`,
      { marketType, pageSize: 100 },
    );
    const sessionServicePathAccountPositions = buildPathWithQuery(
      `/dnse-order-service/account-positions/${accountNo}`,
      { marketType, pageSize: 100 },
    );
    const sessionServicePathStockPositions = buildPathWithQuery(
      `/dnse-order-service/stock-positions/${accountNo}`,
      { marketType, pageSize: 100 },
    );
    const sessionPathByAccount = buildPathWithQuery(`/order-service/positions`, accountQuery);
    const sessionServicePathByAccount = buildPathWithQuery(
      `/dnse-order-service/positions`,
      accountQuery,
    );
    const sessionPayload = await this.requestLinkedUserFirst(
      "GET",
      [sessionPath, sessionPathAccountPositions, sessionPathStockPositions, sessionPathByAccount],
      [
        sessionServicePath,
        sessionServicePathAccountPositions,
        sessionServicePathStockPositions,
        sessionServicePathByAccount,
      ],
      "Failed to get positions",
      "getPositions",
    );
    if (sessionPayload) {
      return this.mapPositions(extractArrayPayload(sessionPayload), accountNo);
    }

    if (this.userJwtToken && isDnseDebugEnabled()) {
      console.warn("[DNSE getPositions] Session API failed, fallback to OpenAPI.");
    }

    const path = buildPathWithQuery(`/accounts/${accountNo}/positions`, {
      marketType,
      pageSize: 100,
    });
    const payload = await this.requestFirstSuccess(
      "GET",
      [path],
      {
        label: "Failed to get positions",
        includeAuthorization: false,
        baseFilter: "openapi",
        debugTag: "getPositions",
      },
    );
    return this.mapPositions(extractArrayPayload(payload), accountNo);
  }

  async getOrders(
    accountNo: string,
    marketType = DEFAULT_MARKET_TYPE,
    orderCategory = DEFAULT_ORDER_CATEGORY,
  ): Promise<DnseOrder[]> {
    if (isDnseDebugEnabled()) console.log("[DNSE getOrders] Account:", accountNo);
    const accountQuery = {
      accountId: accountNo,
      accountNo,
      marketType,
      orderCategory,
    };
    const sessionPath = buildPathWithQuery(`/order-service/accounts/${accountNo}/orders`, {
      marketType,
      orderCategory,
    });
    const sessionPathOrdersByAccount = buildPathWithQuery(`/order-service/orders`, accountQuery);
    const sessionServicePath = buildPathWithQuery(
      `/dnse-order-service/accounts/${accountNo}/orders`,
      {
        marketType,
        orderCategory,
      },
    );
    const sessionServicePathOrdersByAccount = buildPathWithQuery(
      `/dnse-order-service/orders`,
      accountQuery,
    );
    const sessionPayload = await this.requestLinkedUserFirst(
      "GET",
      [sessionPath, sessionPathOrdersByAccount],
      [sessionServicePath, sessionServicePathOrdersByAccount],
      "Failed to get orders",
      "getOrders",
    );
    if (sessionPayload) return this.mapOrders(extractArrayPayload(sessionPayload), accountNo);

    if (this.userJwtToken && isDnseDebugEnabled()) {
      console.warn("[DNSE getOrders] Session API failed, fallback to OpenAPI.");
    }

    const path = buildPathWithQuery(`/accounts/${accountNo}/orders`, {
      marketType,
      orderCategory,
    });
    const payload = await this.requestFirstSuccess(
      "GET",
      [path],
      {
        label: "Failed to get orders",
        includeAuthorization: false,
        baseFilter: "openapi",
        debugTag: "getOrders",
      },
    );
    return this.mapOrders(extractArrayPayload(payload), accountNo);
  }

  async getOrdersHistory(
    accountNo: string,
    options?: { fromDate?: string | null; toDate?: string | null; page?: number | null; size?: number | null },
  ): Promise<DnseOrder[]> {
    if (isDnseDebugEnabled()) console.log("[DNSE getOrdersHistory] Account:", accountNo);
    const now = new Date();
    const defaultFrom = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000)
      .toISOString()
      .slice(0, 10);
    const defaultTo = now.toISOString().slice(0, 10);

    const query = {
      from: options?.fromDate ?? defaultFrom,
      to: options?.toDate ?? defaultTo,
      pageIndex: options?.page ?? 1,
      pageSize: options?.size ?? 100,
      marketType: DEFAULT_MARKET_TYPE,
    };

    const sessionPathAccount = buildPathWithQuery(`/order-service/accounts/${accountNo}/order-history`, query);
    const sessionPathAccountAlt = buildPathWithQuery(
      `/order-service/accounts/${accountNo}/orders-history`,
      query,
    );
    const sessionPathByAccount = buildPathWithQuery(`/order-service/order-history`, {
      accountId: accountNo,
      accountNo,
      ...query,
    });
    const sessionPathByAccountAlt = buildPathWithQuery(`/order-service/orders-history`, {
      accountId: accountNo,
      accountNo,
      ...query,
    });
    const sessionPathByAccountV2 = buildPathWithQuery(`/order-service/orders/history`, {
      accountId: accountNo,
      accountNo,
      ...query,
    });

    const sessionServicePathAccount = buildPathWithQuery(
      `/dnse-order-service/accounts/${accountNo}/order-history`,
      query,
    );
    const sessionServicePathAccountAlt = buildPathWithQuery(
      `/dnse-order-service/accounts/${accountNo}/orders-history`,
      query,
    );
    const sessionServicePathByAccount = buildPathWithQuery(`/dnse-order-service/order-history`, {
      accountId: accountNo,
      accountNo,
      ...query,
    });
    const sessionServicePathByAccountAlt = buildPathWithQuery(`/dnse-order-service/orders-history`, {
      accountId: accountNo,
      accountNo,
      ...query,
    });
    const sessionServicePathByAccountV2 = buildPathWithQuery(`/dnse-order-service/orders/history`, {
      accountId: accountNo,
      accountNo,
      ...query,
    });

    const sessionPayload = await this.requestLinkedUserFirst(
      "GET",
      [
        sessionPathAccount,
        sessionPathAccountAlt,
        sessionPathByAccount,
        sessionPathByAccountAlt,
        sessionPathByAccountV2,
      ],
      [
        sessionServicePathAccount,
        sessionServicePathAccountAlt,
        sessionServicePathByAccount,
        sessionServicePathByAccountAlt,
        sessionServicePathByAccountV2,
      ],
      "Failed to get order history",
      "getOrdersHistory",
    );

    if (sessionPayload) return this.mapOrders(extractArrayPayload(sessionPayload), accountNo);

    if (this.userJwtToken && isDnseDebugEnabled()) {
      console.warn("[DNSE getOrdersHistory] Session API failed, fallback to OpenAPI.");
    }

    const openApiPath = buildPathWithQuery(`/accounts/${accountNo}/orders/history`, query);
    const payload = await this.requestFirstSuccess("GET", [openApiPath], {
      label: "Failed to get order history",
      includeAuthorization: false,
      baseFilter: "openapi",
      debugTag: "getOrdersHistory",
    });

    return this.mapOrders(extractArrayPayload(payload), accountNo);
  }

  async getLoanPackages(
    accountNo: string,
    marketType = DEFAULT_MARKET_TYPE,
    symbol?: string | null,
  ): Promise<JsonRecord[]> {
    if (isDnseDebugEnabled()) console.log("[DNSE getLoanPackages] Account:", accountNo);
    const normalizedSymbol = symbol?.trim().toUpperCase() || null;
    if (!normalizedSymbol) return [];
    const accountQuery = {
      accountId: accountNo,
      accountNo,
      marketType,
      symbol: normalizedSymbol,
    };
    const sessionPath = buildPathWithQuery(`/order-service/accounts/${accountNo}/loan-packages`, {
      marketType,
      symbol: normalizedSymbol,
    });
    const sessionPathByAccount = buildPathWithQuery(`/order-service/loan-packages`, accountQuery);
    const sessionServicePath = buildPathWithQuery(
      `/dnse-order-service/accounts/${accountNo}/loan-packages`,
      {
        marketType,
        symbol: normalizedSymbol,
      },
    );
    const sessionServicePathByAccount = buildPathWithQuery(
      `/dnse-order-service/loan-packages`,
      accountQuery,
    );
    const sessionServicePathOrderService = buildPathWithQuery(
      `/order-service/accounts/${accountNo}/loan-packages`,
      {
        marketType,
        symbol: normalizedSymbol,
      },
    );
    const sessionServicePathByAccountOrderService = buildPathWithQuery(
      `/order-service/loan-packages`,
      accountQuery,
    );
    const sessionPayload = await this.requestLinkedUserFirst(
      "GET",
      [sessionPath, sessionPathByAccount],
      [
        sessionServicePath,
        sessionServicePathByAccount,
        sessionServicePathOrderService,
        sessionServicePathByAccountOrderService,
      ],
      "Failed to get loan packages",
      "getLoanPackages",
    );
    if (sessionPayload) {
      return extractArrayPayload(sessionPayload) as JsonRecord[];
    }

    if (this.userJwtToken && isDnseDebugEnabled()) {
      console.warn("[DNSE getLoanPackages] Session API failed, fallback to OpenAPI.");
    }

    const path = buildPathWithQuery(`/accounts/${accountNo}/loan-packages`, {
      marketType,
      symbol: normalizedSymbol,
    });
    const payload = await this.requestFirstSuccess(
      "GET",
      [path],
      {
        label: "Failed to get loan packages",
        includeAuthorization: false,
        baseFilter: "openapi",
        debugTag: "getLoanPackages",
      },
    );
    return extractArrayPayload(payload) as JsonRecord[];
  }

  async getPPSE(
    accountNo: string,
    symbol: string,
    params?: {
      marketType?: string;
      price?: number | null;
      loanPackageId?: string | number | null;
    },
  ): Promise<JsonRecord | null> {
    if (isDnseDebugEnabled()) console.log("[DNSE getPPSE] Account:", accountNo, "Symbol:", symbol);
    const sessionPath = buildPathWithQuery(`/order-service/accounts/${accountNo}/ppse`, {
      marketType: params?.marketType ?? DEFAULT_MARKET_TYPE,
      symbol,
      price: params?.price ?? undefined,
      loanPackageId: params?.loanPackageId ?? undefined,
    });
    const sessionPathByAccount = buildPathWithQuery(`/order-service/ppse`, {
      accountNo,
      marketType: params?.marketType ?? DEFAULT_MARKET_TYPE,
      symbol,
      price: params?.price ?? undefined,
      loanPackageId: params?.loanPackageId ?? undefined,
    });
    const sessionServicePath = buildPathWithQuery(`/dnse-order-service/accounts/${accountNo}/ppse`, {
      marketType: params?.marketType ?? DEFAULT_MARKET_TYPE,
      symbol,
      price: params?.price ?? undefined,
      loanPackageId: params?.loanPackageId ?? undefined,
    });
    const sessionServicePathByAccount = buildPathWithQuery(`/dnse-order-service/ppse`, {
      accountNo,
      marketType: params?.marketType ?? DEFAULT_MARKET_TYPE,
      symbol,
      price: params?.price ?? undefined,
      loanPackageId: params?.loanPackageId ?? undefined,
    });
    const sessionServicePathOrderService = buildPathWithQuery(`/order-service/accounts/${accountNo}/ppse`, {
      marketType: params?.marketType ?? DEFAULT_MARKET_TYPE,
      symbol,
      price: params?.price ?? undefined,
      loanPackageId: params?.loanPackageId ?? undefined,
    });
    const sessionServicePathByAccountOrderService = buildPathWithQuery(`/order-service/ppse`, {
      accountNo,
      marketType: params?.marketType ?? DEFAULT_MARKET_TYPE,
      symbol,
      price: params?.price ?? undefined,
      loanPackageId: params?.loanPackageId ?? undefined,
    });
    const sessionPayload = await this.requestLinkedUserFirst(
      "GET",
      [sessionPath, sessionPathByAccount],
      [
        sessionServicePath,
        sessionServicePathByAccount,
        sessionServicePathOrderService,
        sessionServicePathByAccountOrderService,
      ],
      "Failed to get PPSE",
      "getPPSE",
    );
    if (sessionPayload) {
      return (toRecord(sessionPayload)?.data as JsonRecord) ?? toRecord(sessionPayload);
    }

    if (this.userJwtToken && isDnseDebugEnabled()) {
      console.warn("[DNSE getPPSE] Session API failed, fallback to OpenAPI.");
    }

    const path = buildPathWithQuery(`/accounts/${accountNo}/ppse`, {
      marketType: params?.marketType ?? DEFAULT_MARKET_TYPE,
      symbol,
      price: params?.price ?? undefined,
      loanPackageId: params?.loanPackageId ?? undefined,
    });
    const payload = await this.requestFirstSuccess(
      "GET",
      [path],
      {
        label: "Failed to get PPSE",
        includeAuthorization: false,
        baseFilter: "openapi",
        debugTag: "getPPSE",
      },
    );
    return (toRecord(payload)?.data as JsonRecord) ?? toRecord(payload);
  }

  async sendEmailOTP(): Promise<void> {
    await this.requestFirstSuccess(
      "POST",
      ["/registration/send-email-otp"],
      {
        label: "Failed to send OTP",
        includeAuthorization: false,
        baseFilter: "openapi",
      },
    );
  }

  async createTradingToken(otp: string): Promise<{ token: string; expiresIn: number }> {
    const payload = await this.requestFirstSuccess(
      "POST",
      ["/registration/trading-token"],
      {
        includeBody: true,
        body: JSON.stringify({
          otpType: "email_otp",
          passcode: otp,
        }),
        label: "Invalid OTP",
        includeAuthorization: false,
        baseFilter: "openapi",
      },
    );

    const root = toRecord(payload) ?? {};
    const nested = toRecord(root.data) ?? {};
    const token =
      readString(root, ["token", "tradingToken", "accessToken"]) ??
      readString(nested, ["token", "tradingToken", "accessToken"]) ??
      "";
    const expiresInRaw =
      Number((root.expiresIn as number | string | undefined) ?? nested.expiresIn ?? 28800) ||
      28800;

    if (!token) {
      throw new Error("DNSE không trả trading token hợp lệ.");
    }
    this.tradingToken = token;
    this.tokenExpiry = Date.now() + expiresInRaw * 1000;

    return { token, expiresIn: expiresInRaw };
  }

  setTradingToken(token: string, expiresIn = 28800) {
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
      [
        buildPathWithQuery("/accounts/orders", {
          marketType: DEFAULT_MARKET_TYPE,
          orderCategory: DEFAULT_ORDER_CATEGORY,
        }),
      ],
      {
        includeBody: true,
        body: JSON.stringify(Object.fromEntries(Object.entries({
          accountNo: params.accountNo,
          symbol: params.symbol,
          side: params.side === "SELL" ? "NS" : "NB",
          orderType: params.orderType,
          price: params.price,
          quantity: params.quantity,
          loanPackageId: params.loanPackageId,
        }).filter(([, value]) => value != null && value !== ""))),
        label: "Failed to place order",
        includeAuthorization: false,
        baseFilter: "openapi",
        extraHeaders: {
          "trading-token": this.tradingToken,
        },
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

  if (userJwtToken) {
    return new DnseTradingClient(apiKey, apiSecret, baseUrl, { userJwtToken });
  }

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

