import { createHash, randomBytes } from "crypto";

type JsonRecord = Record<string, unknown>;

export type DnseOAuthTokenResponse = {
  accessToken: string;
  refreshToken: string | null;
  tokenType: string | null;
  scope: string | null;
  accessTokenExpiresAt: Date | null;
  refreshTokenExpiresAt: Date | null;
  raw: JsonRecord;
};

export type DnseOAuthConfig = {
  authorizeUrl: string;
  tokenUrl: string;
  clientId: string;
  clientSecret: string;
  redirectUri: string;
  scopes: string;
  accountsUrl: string | null;
  accountProfileUrl: string | null;
  balanceUrl: string | null;
  holdingsUrl: string | null;
  positionsUrl: string | null;
  ordersUrl: string | null;
  orderHistoryUrl: string | null;
  loanPackagesUrl: string | null;
  ppseUrl: string | null;
  submitUrl: string | null;
  apiKey: string | null;
  configured: boolean;
  missing: string[];
};

function normalizeUrl(value: string | undefined | null) {
  const raw = value?.trim() ?? "";
  return raw.length > 0 ? raw : null;
}

function resolveRedirectUri() {
  const explicit = normalizeUrl(process.env.DNSE_OAUTH_REDIRECT_URI);
  if (explicit) return explicit;
  const nextAuthUrl = normalizeUrl(process.env.NEXTAUTH_URL);
  if (!nextAuthUrl) return "";
  return `${nextAuthUrl.replace(/\/$/, "")}/api/user/dnse/oauth/callback`;
}

export function getDnseOAuthConfig(): DnseOAuthConfig {
  const authorizeUrl = normalizeUrl(process.env.DNSE_OAUTH_AUTHORIZE_URL) ?? "";
  const tokenUrl = normalizeUrl(process.env.DNSE_OAUTH_TOKEN_URL) ?? "";
  const clientId = normalizeUrl(process.env.DNSE_OAUTH_CLIENT_ID) ?? "";
  const clientSecret = normalizeUrl(process.env.DNSE_OAUTH_CLIENT_SECRET) ?? "";
  const redirectUri = resolveRedirectUri();
  const scopes = normalizeUrl(process.env.DNSE_OAUTH_SCOPES) ?? "openid profile trading";
  const missing = [
    !authorizeUrl ? "DNSE_OAUTH_AUTHORIZE_URL" : null,
    !tokenUrl ? "DNSE_OAUTH_TOKEN_URL" : null,
    !clientId ? "DNSE_OAUTH_CLIENT_ID" : null,
    !clientSecret ? "DNSE_OAUTH_CLIENT_SECRET" : null,
    !redirectUri ? "DNSE_OAUTH_REDIRECT_URI_or_NEXTAUTH_URL" : null,
  ].filter((item): item is string => Boolean(item));

  return {
    authorizeUrl,
    tokenUrl,
    clientId,
    clientSecret,
    redirectUri,
    scopes,
    accountsUrl: normalizeUrl(process.env.DNSE_BROKER_ACCOUNTS_URL),
    accountProfileUrl: normalizeUrl(process.env.DNSE_BROKER_ACCOUNT_PROFILE_URL),
    balanceUrl: normalizeUrl(process.env.DNSE_BROKER_BALANCE_URL),
    holdingsUrl: normalizeUrl(process.env.DNSE_BROKER_HOLDINGS_URL),
    positionsUrl: normalizeUrl(process.env.DNSE_BROKER_POSITIONS_URL),
    ordersUrl: normalizeUrl(process.env.DNSE_BROKER_ORDERS_URL),
    orderHistoryUrl: normalizeUrl(process.env.DNSE_BROKER_ORDER_HISTORY_URL),
    loanPackagesUrl: normalizeUrl(process.env.DNSE_BROKER_LOAN_PACKAGES_URL),
    ppseUrl: normalizeUrl(process.env.DNSE_BROKER_PPSE_URL),
    submitUrl: normalizeUrl(process.env.DNSE_ORDER_SUBMIT_URL),
    apiKey: normalizeUrl(process.env.DNSE_API_KEY),
    configured: missing.length === 0,
    missing,
  };
}

function toBase64Url(buffer: Buffer) {
  return buffer.toString("base64url");
}

export function generatePkcePair() {
  const verifier = toBase64Url(randomBytes(48));
  const challenge = createHash("sha256").update(verifier).digest("base64url");
  return { verifier, challenge };
}

export function generateDnseOauthState() {
  return toBase64Url(randomBytes(24));
}

export function buildDnseAuthorizeUrl(params: {
  state: string;
  codeChallenge: string;
}) {
  const config = getDnseOAuthConfig();
  if (!config.configured) {
    throw new Error(`DNSE OAuth config missing: ${config.missing.join(",")}`);
  }

  const url = new URL(config.authorizeUrl);
  url.searchParams.set("response_type", "code");
  url.searchParams.set("client_id", config.clientId);
  url.searchParams.set("redirect_uri", config.redirectUri);
  url.searchParams.set("scope", config.scopes);
  url.searchParams.set("state", params.state);
  url.searchParams.set("code_challenge", params.codeChallenge);
  url.searchParams.set("code_challenge_method", "S256");
  return url.toString();
}

function toDateFromSeconds(seconds: number | null | undefined) {
  if (!seconds || !Number.isFinite(seconds) || seconds <= 0) return null;
  return new Date(Date.now() + seconds * 1000);
}

function parseOAuthTokenResponse(payload: unknown): DnseOAuthTokenResponse {
  const row = payload && typeof payload === "object" ? (payload as JsonRecord) : {};
  const accessToken = String(
    row.access_token ?? row.accessToken ?? row.token ?? "",
  ).trim();
  if (!accessToken) {
    throw new Error("DNSE token response missing access_token");
  }

  const refreshTokenRaw =
    row.refresh_token ?? row.refreshToken ?? null;
  const tokenTypeRaw = row.token_type ?? row.tokenType ?? null;
  const scopeRaw = row.scope ?? null;
  const expiresInRaw = Number(row.expires_in ?? row.expiresIn ?? "");
  const refreshExpiresInRaw = Number(
    row.refresh_expires_in ?? row.refreshExpiresIn ?? "",
  );

  return {
    accessToken,
    refreshToken:
      typeof refreshTokenRaw === "string" && refreshTokenRaw.trim().length > 0
        ? refreshTokenRaw.trim()
        : null,
    tokenType:
      typeof tokenTypeRaw === "string" && tokenTypeRaw.trim().length > 0
        ? tokenTypeRaw.trim()
        : null,
    scope:
      typeof scopeRaw === "string" && scopeRaw.trim().length > 0
        ? scopeRaw.trim()
        : null,
    accessTokenExpiresAt: toDateFromSeconds(
      Number.isFinite(expiresInRaw) ? expiresInRaw : null,
    ),
    refreshTokenExpiresAt: toDateFromSeconds(
      Number.isFinite(refreshExpiresInRaw) ? refreshExpiresInRaw : null,
    ),
    raw: row,
  };
}

async function requestToken(form: URLSearchParams) {
  const config = getDnseOAuthConfig();
  if (!config.configured) {
    throw new Error(`DNSE OAuth config missing: ${config.missing.join(",")}`);
  }
  const response = await fetch(config.tokenUrl, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      Accept: "application/json",
      ...(config.apiKey ? { "X-Api-Key": config.apiKey } : {}),
    },
    body: form.toString(),
    cache: "no-store",
    signal: AbortSignal.timeout(15_000),
  });

  const payload = (await response.json().catch(() => null)) as unknown;
  if (!response.ok) {
    const text =
      payload && typeof payload === "object"
        ? String(
            (payload as JsonRecord).error_description ??
              (payload as JsonRecord).error ??
              `HTTP_${response.status}`,
          )
        : `HTTP_${response.status}`;
    throw new Error(`DNSE OAuth token exchange failed: ${text}`);
  }
  return parseOAuthTokenResponse(payload);
}

export async function exchangeDnseAuthorizationCode(code: string, codeVerifier: string) {
  const config = getDnseOAuthConfig();
  const form = new URLSearchParams();
  form.set("grant_type", "authorization_code");
  form.set("code", code);
  form.set("client_id", config.clientId);
  form.set("client_secret", config.clientSecret);
  form.set("redirect_uri", config.redirectUri);
  form.set("code_verifier", codeVerifier);
  return requestToken(form);
}

export async function refreshDnseAccessToken(refreshToken: string) {
  const config = getDnseOAuthConfig();
  const form = new URLSearchParams();
  form.set("grant_type", "refresh_token");
  form.set("refresh_token", refreshToken);
  form.set("client_id", config.clientId);
  form.set("client_secret", config.clientSecret);
  return requestToken(form);
}

function readString(row: JsonRecord, keys: string[]) {
  for (const key of keys) {
    const value = row[key];
    if (typeof value === "string" && value.trim().length > 0) {
      return value.trim();
    }
  }
  return null;
}

export function extractDnseAccountIdentity(payload: unknown) {
  const row = payload && typeof payload === "object" ? (payload as JsonRecord) : {};
  const accountId = readString(row, [
    "accountNo",
    "account_id",
    "accountId",
    "subAccount",
    "sub_account",
    "tradingAccount",
  ]);
  const accountName = readString(row, [
    "accountName",
    "name",
    "fullName",
    "ownerName",
  ]);
  const subAccountId = readString(row, ["subAccount", "sub_account", "custodyCode"]);
  return { accountId, accountName, subAccountId };
}

export function resolveDnseUrlTemplate(
  template: string,
  params: Record<string, string | number | null | undefined>,
) {
  return Object.entries(params).reduce((acc, [key, value]) => {
    const safeValue = value == null ? "" : encodeURIComponent(String(value));
    return acc.replaceAll(`{${key}}`, safeValue);
  }, template);
}
