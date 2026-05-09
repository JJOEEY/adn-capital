import { NextRequest, NextResponse } from "next/server";
import { getTopicEnvelope } from "@/lib/datahub/core";
import { fetchMarketBoard, fetchMarketDepth, fetchRealtimeTradingData } from "@/lib/fiinquantClient";
import { isN8nAuthorized, unauthorizedResponse } from "@/lib/n8n/internal";
import { fetchFAData, fetchTAData } from "@/lib/stockData";

export const dynamic = "force-dynamic";

const DEFAULT_BOARD_TICKERS = ["FPT", "HPG", "SSI", "VCB", "MWG", "VNM"];
const BASE_TOPICS = [
  "vn:index:overview",
  "vn:index:snapshot",
  "vn:index:breadth:VNINDEX",
  "vn:index:composite:live",
  "vn:index:valuation:VNINDEX",
];
const TIMEFRAMES = new Set(["1m", "5m", "15m", "30m"]);
const SENSITIVE_KEY_RE = /token|secret|password|cookie|credential|jwt|key/i;

function normalizeSymbol(value: string | null) {
  const symbol = (value ?? "").trim().toUpperCase().replace(/[^A-Z0-9._-]/g, "");
  return symbol.slice(0, 12) || null;
}

function normalizeTickers(value: string | null) {
  const source = value?.trim() ? value : DEFAULT_BOARD_TICKERS.join(",");
  return Array.from(
    new Set(
      source
        .split(",")
        .map((ticker) => normalizeSymbol(ticker))
        .filter((ticker): ticker is string => Boolean(ticker)),
    ),
  ).slice(0, 50);
}

function normalizeTimeframe(value: string | null) {
  const timeframe = (value ?? "5m").trim().toLowerCase();
  return TIMEFRAMES.has(timeframe) ? timeframe : "5m";
}

function sanitizeForAgent(value: unknown, key = ""): unknown {
  if (value == null) return value;
  if (SENSITIVE_KEY_RE.test(key)) return "[redacted]";
  if (Array.isArray(value)) return value.map((item) => sanitizeForAgent(item));
  if (typeof value !== "object") return value;

  const output: Record<string, unknown> = {};
  for (const [childKey, childValue] of Object.entries(value as Record<string, unknown>)) {
    output[childKey] = sanitizeForAgent(childValue, childKey);
  }
  return output;
}

function compactEnvelope(envelope: Awaited<ReturnType<typeof getTopicEnvelope>>) {
  return {
    topic: envelope.topic,
    freshness: envelope.freshness,
    updatedAt: envelope.updatedAt,
    expiresAt: envelope.expiresAt,
    source: envelope.source,
    error: envelope.error ?? null,
    value: sanitizeForAgent(envelope.value),
  };
}

async function directEnvelope(topic: string, source: string, load: () => Promise<unknown>) {
  const now = new Date().toISOString();
  try {
    const value = await load();
    return {
      topic,
      freshness: value ? "fresh" : "stale",
      updatedAt: now,
      expiresAt: now,
      source,
      error: value
        ? null
        : {
            code: "source_unavailable",
            message: `${source} did not return data.`,
            retryable: true,
          },
      value: sanitizeForAgent(value),
    };
  } catch (error) {
    return {
      topic,
      freshness: "error",
      updatedAt: now,
      expiresAt: now,
      source,
      error: {
        code: "resolve_failed",
        message: error instanceof Error ? error.message : String(error),
        retryable: true,
      },
      value: null,
    };
  }
}

export async function GET(req: NextRequest) {
  if (!isN8nAuthorized(req)) {
    return unauthorizedResponse();
  }

  const symbol = normalizeSymbol(req.nextUrl.searchParams.get("symbol"));
  const tickers = normalizeTickers(req.nextUrl.searchParams.get("tickers"));
  const timeframe = normalizeTimeframe(req.nextUrl.searchParams.get("timeframe"));
  const force = req.nextUrl.searchParams.get("force") === "1" || req.nextUrl.searchParams.get("force") === "true";
  const topics = [...BASE_TOPICS];

  const [envelopes, board, realtime, ta, fa, depth] = await Promise.all([
    Promise.all(topics.map((topic) => getTopicEnvelope(topic, { force }))),
    directEnvelope(`vnstock:board:${tickers.join(",")}`, "vnstock:price-board", () => fetchMarketBoard(tickers)),
    symbol
      ? directEnvelope(`vnstock:realtime:${symbol}:${timeframe}`, "vnstock:realtime", () =>
          fetchRealtimeTradingData(symbol, timeframe, 15_000))
      : Promise.resolve(null),
    symbol ? directEnvelope(`vnstock:ta:${symbol}`, "vnstock:ta", () => fetchTAData(symbol)) : Promise.resolve(null),
    symbol ? directEnvelope(`vnstock:fa:${symbol}`, "vnstock:fa", () => fetchFAData(symbol)) : Promise.resolve(null),
    symbol ? directEnvelope(`vnstock:depth:${symbol}`, "vnstock:depth", () => fetchMarketDepth(symbol)) : Promise.resolve(null),
  ]);
  const byTopic = Object.fromEntries(envelopes.map((envelope) => [envelope.topic, compactEnvelope(envelope)]));

  return NextResponse.json({
    ok: true,
    provider: "vnstock-via-adn-datahub",
    generatedAt: new Date().toISOString(),
    force,
    symbol,
    timeframe,
    tickers,
    data: {
      overview: byTopic["vn:index:overview"] ?? null,
      snapshot: byTopic["vn:index:snapshot"] ?? null,
      breadth: byTopic["vn:index:breadth:VNINDEX"] ?? null,
      composite: byTopic["vn:index:composite:live"] ?? null,
      valuation: byTopic["vn:index:valuation:VNINDEX"] ?? null,
      board,
      priceSnapshot: null,
      realtime,
      ta,
      fa,
      depth,
    },
  });
}
