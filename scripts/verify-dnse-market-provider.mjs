import crypto from "crypto";

const API_KEY = process.env.DNSE_API_KEY?.trim() ?? "";
const API_SECRET = process.env.DNSE_API_SECRET?.trim() ?? "";
const BASE_URLS = [
  process.env.DNSE_MARKET_DATA_BASE_URL,
  process.env.DNSE_TRADING_BASE_URL,
  process.env.DNSE_OPENAPI_BASE_URL,
  "https://openapi.dnse.com.vn",
  "https://api.dnse.com.vn/openapi",
].filter(Boolean).map((item) => item.replace(/\/+$/, ""));
const LIMIT = Number(process.env.DNSE_VERIFY_LIMIT ?? 500);
const CONCURRENCY = Number(process.env.DNSE_VERIFY_CONCURRENCY ?? 8);

function sign(method, path, dateHeaderName, dateValue, nonce) {
  const headerKey = dateHeaderName.toLowerCase();
  const source = `(request-target): ${method.toLowerCase()} ${path}\n${headerKey}: ${dateValue}\nnonce: ${nonce}`;
  const signature = crypto.createHmac("sha256", API_SECRET).update(source, "utf8").digest("base64");
  return `Signature keyId="${API_KEY}",algorithm="hmac-sha256",headers="(request-target) ${headerKey}",signature="${encodeURIComponent(signature)}",nonce="${nonce}"`;
}

async function dnseGet(path, query = {}) {
  if (!API_KEY || !API_SECRET) throw new Error("DNSE_API_KEY/DNSE_API_SECRET is not configured");
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(query)) {
    if (value != null && value !== "") search.set(key, String(value));
  }
  const pathWithQuery = `${path}${search.toString() ? `?${search}` : ""}`;
  const dateHeaders = [...new Set([process.env.DNSE_DATE_HEADER, "Date", "X-Aux-Date"].filter(Boolean))];
  for (const base of BASE_URLS) {
    for (const dateHeaderName of dateHeaders) {
      const dateValue = new Date().toUTCString();
      const nonce = crypto.randomUUID().replace(/-/g, "");
      const res = await fetch(`${base}${pathWithQuery}`, {
        headers: {
          Accept: "application/json",
          "x-api-key": API_KEY,
          "X-API-Key": API_KEY,
          "X-Signature": sign("GET", path, dateHeaderName, dateValue, nonce),
          [dateHeaderName]: dateValue,
        },
        signal: AbortSignal.timeout(12_000),
      }).catch(() => null);
      if (!res?.ok) continue;
      return res.json();
    }
  }
  return null;
}

function rows(payload) {
  if (Array.isArray(payload)) return payload;
  if (Array.isArray(payload?.data)) return payload.data;
  if (Array.isArray(payload?.items)) return payload.items;
  if (Array.isArray(payload?.rows)) return payload.rows;
  return [];
}

async function mapLimit(items, limit, task) {
  const result = [];
  let cursor = 0;
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (cursor < items.length) {
      const index = cursor++;
      result[index] = await task(items[index]);
    }
  }));
  return result;
}

const instrumentsPayload = await dnseGet("/instruments", { limit: LIMIT, page: 1 });
const symbols = rows(instrumentsPayload)
  .map((item) => String(item.symbol ?? item.ticker ?? "").trim().toUpperCase())
  .filter(Boolean)
  .slice(0, LIMIT);

const to = Math.floor(Date.now() / 1000);
const from = to - 30 * 86400;
const checked = await mapLimit(symbols, CONCURRENCY, async (symbol) => {
  const payload = await dnseGet("/price/ohlc", {
    type: ["VNINDEX", "VN30", "HNXINDEX", "UPCOMINDEX"].includes(symbol) ? "INDEX" : "STOCK",
    symbol,
    resolution: "1D",
    from,
    to,
  }).catch(() => null);
  return { symbol, ok: Array.isArray(payload?.t) && payload.t.length > 0 };
});

const missing = checked.filter((item) => !item.ok).map((item) => item.symbol);
const covered = checked.length - missing.length;
const coveragePct = checked.length > 0 ? Number(((covered / checked.length) * 100).toFixed(2)) : 0;
const report = {
  provider: "dnse",
  checkedAt: new Date().toISOString(),
  requested: checked.length,
  covered,
  coveragePct,
  thresholdPct: 95,
  passed: coveragePct >= 95,
  missing: missing.slice(0, 50),
};

console.log(JSON.stringify(report, null, 2));
if (!report.passed) process.exit(1);
