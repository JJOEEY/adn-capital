import { prisma } from "@/lib/prisma";
import { getPythonBridgeUrl } from "@/lib/runtime-config";

const DCHART_BASE = "https://dchart-api.vndirect.com.vn/dchart/history";
const VALID_TTL_MS = 6 * 60 * 60 * 1000;
const INVALID_TTL_MS = 60 * 60 * 1000;

const INDEX_TICKERS = new Set([
  "VNINDEX",
  "VN30",
  "HNXINDEX",
  "UPCOMINDEX",
  "VNI",
  "HNX30",
  "UPINDEX",
]);

type ResolutionSource = "index" | "cache" | "database" | "vndirect" | "fiinquant" | "invalid";

type CacheEntry = {
  result: TickerResolution;
  expiresAt: number;
};

const tickerCache = new Map<string, CacheEntry>();

export type TickerResolution = {
  input: string;
  ticker: string;
  valid: boolean;
  source: ResolutionSource;
  reason?: string;
  checkedAt: string;
};

export function normalizeTickerInput(input: string): string {
  return input
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9._-]/g, "")
    .slice(0, 12);
}

function readCache(ticker: string): TickerResolution | null {
  const found = tickerCache.get(ticker);
  if (!found) return null;
  if (found.expiresAt <= Date.now()) {
    tickerCache.delete(ticker);
    return null;
  }
  return { ...found.result, source: "cache" };
}

function writeCache(result: TickerResolution) {
  tickerCache.set(result.ticker, {
    result,
    expiresAt: Date.now() + (result.valid ? VALID_TTL_MS : INVALID_TTL_MS),
  });
}

async function existsInDatabase(ticker: string): Promise<boolean> {
  const [inSignals, inJournal] = await Promise.all([
    prisma.signal.findFirst({ where: { ticker }, select: { id: true } }),
    prisma.tradingJournal.findFirst({ where: { ticker }, select: { id: true } }),
  ]);
  return Boolean(inSignals || inJournal);
}

async function existsInVndirectDchart(ticker: string): Promise<boolean> {
  const now = Math.floor(Date.now() / 1000);
  const from = now - 45 * 86400;
  const url = `${DCHART_BASE}?resolution=D&symbol=${encodeURIComponent(ticker)}&from=${from}&to=${now}`;

  const res = await fetch(url, {
    cache: "no-store",
    signal: AbortSignal.timeout(10_000),
    headers: {
      "User-Agent":
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
      Accept: "*/*",
      Referer: "https://dchart.vndirect.com.vn/",
      Origin: "https://dchart.vndirect.com.vn",
    },
  });

  if (!res.ok) return false;
  const payload = (await res.json()) as { s?: string; c?: number[] };
  return payload.s === "ok" && Array.isArray(payload.c) && payload.c.length > 0;
}

async function existsInBridgeRealtime(ticker: string): Promise<boolean> {
  const bridge = getPythonBridgeUrl();
  const res = await fetch(`${bridge}/api/v1/realtime/${encodeURIComponent(ticker)}?timeframe=5m`, {
    cache: "no-store",
    signal: AbortSignal.timeout(10_000),
  });
  if (!res.ok) return false;
  const payload = (await res.json()) as Record<string, unknown> | null;
  return Boolean(payload && typeof payload === "object");
}

export async function resolveMarketTicker(input: string): Promise<TickerResolution> {
  const normalized = normalizeTickerInput(input);
  const checkedAt = new Date().toISOString();

  if (!normalized || normalized.length < 2) {
    return {
      input,
      ticker: normalized || "",
      valid: false,
      source: "invalid",
      reason: "Ticker format is invalid",
      checkedAt,
    };
  }

  if (INDEX_TICKERS.has(normalized)) {
    const result: TickerResolution = {
      input,
      ticker: normalized,
      valid: true,
      source: "index",
      checkedAt,
    };
    writeCache(result);
    return result;
  }

  const cached = readCache(normalized);
  if (cached) return cached;

  try {
    if (await existsInDatabase(normalized)) {
      const result: TickerResolution = {
        input,
        ticker: normalized,
        valid: true,
        source: "database",
        checkedAt,
      };
      writeCache(result);
      return result;
    }
  } catch (error) {
    console.warn("[ticker-resolver] DB check failed:", error);
  }

  try {
    if (await existsInVndirectDchart(normalized)) {
      const result: TickerResolution = {
        input,
        ticker: normalized,
        valid: true,
        source: "vndirect",
        checkedAt,
      };
      writeCache(result);
      return result;
    }
  } catch (error) {
    console.warn("[ticker-resolver] VNDirect check failed:", error);
  }

  try {
    if (await existsInBridgeRealtime(normalized)) {
      const result: TickerResolution = {
        input,
        ticker: normalized,
        valid: true,
        source: "fiinquant",
        checkedAt,
      };
      writeCache(result);
      return result;
    }
  } catch (error) {
    console.warn("[ticker-resolver] Fiin bridge check failed:", error);
  }

  const invalid: TickerResolution = {
    input,
    ticker: normalized,
    valid: false,
    source: "invalid",
    reason: "Ticker is not found in market universe",
    checkedAt,
  };
  writeCache(invalid);
  return invalid;
}
