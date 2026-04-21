import "server-only";

type JsonRecord = Record<string, unknown>;

export type DnseTradingAccount = {
  accountNo: string;
  accountName: string | null;
  custodyCode: string | null;
  accountType: string;
  status: string;
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

function normalizeAccounts(payload: unknown): DnseTradingAccount[] {
  const root = toRecord(payload);
  if (!root) return [];

  const candidates = [
    root.data,
    root.items,
    root.rows,
    root.result,
    root.list,
    root.accounts,
  ];

  for (const value of candidates) {
    const rows = toArray(value)
      .map((item) => toRecord(item))
      .filter((item): item is JsonRecord => Boolean(item));
    if (rows.length === 0) continue;

    const mapped = rows
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

    if (mapped.length > 0) {
      return mapped;
    }
  }

  return [];
}

function getCandidateEndpoints(baseUrl: string) {
  const direct = process.env.DNSE_TRADING_ACCOUNTS_URL?.trim() || null;
  const broker = process.env.DNSE_BROKER_ACCOUNTS_URL?.trim() || null;
  return [
    direct,
    broker,
    `${baseUrl}/user-service/api/accounts`,
    `${baseUrl}/user-service/accounts`,
    `${baseUrl}/order-service/accounts`,
    `${baseUrl}/accounts`,
  ].filter((item): item is string => Boolean(item));
}

async function requestJson(url: string, apiKey: string) {
  const response = await fetch(url, {
    method: "GET",
    cache: "no-store",
    signal: AbortSignal.timeout(12_000),
    headers: {
      Accept: "application/json",
      Authorization: `Bearer ${apiKey}`,
      "X-Api-Key": apiKey,
      "Content-Type": "application/json",
    },
  });

  const payload = (await response.json().catch(() => null)) as unknown;
  if (!response.ok) {
    const row = toRecord(payload);
    const reason =
      readString(row ?? {}, ["message", "error", "detail"]) ??
      `HTTP_${response.status}`;
    throw new Error(`DNSE accounts request failed: ${reason}`);
  }

  return payload;
}

export class DnseTradingClient {
  private readonly apiKey: string;
  private readonly baseUrl: string;

  constructor() {
    const apiKey = process.env.DNSE_API_KEY?.trim() || "";
    if (!apiKey) {
      throw new Error("DNSE_API_KEY is not configured");
    }
    this.apiKey = apiKey;
    this.baseUrl = (process.env.DNSE_TRADING_BASE_URL?.trim() || "https://api.dnse.com.vn").replace(
      /\/+$/,
      "",
    );
  }

  async getAccounts(): Promise<DnseTradingAccount[]> {
    const endpoints = getCandidateEndpoints(this.baseUrl);
    if (endpoints.length === 0) {
      throw new Error("DNSE accounts endpoint is not configured");
    }

    let lastError: Error | null = null;
    for (const endpoint of endpoints) {
      try {
        const payload = await requestJson(endpoint, this.apiKey);
        const accounts = normalizeAccounts(payload);
        if (accounts.length > 0) return accounts;
      } catch (error) {
        lastError = error instanceof Error ? error : new Error("Unknown DNSE error");
      }
    }

    if (lastError) {
      throw lastError;
    }
    throw new Error("DNSE accounts response is empty");
  }
}

let singleton: DnseTradingClient | null = null;

export function getDnseTradingClient() {
  if (!singleton) {
    singleton = new DnseTradingClient();
  }
  return singleton;
}
