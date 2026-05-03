import { NextRequest, NextResponse } from "next/server";
import { classifyTickerSector } from "@/lib/market/sector-classification";
import { getPythonBridgeUrl } from "@/lib/runtime-config";

type BridgeRsItem = Record<string, unknown>;

type NormalizedRsStock = {
  symbol: string;
  name: string;
  sector: string;
  price: number;
  change: number;
  changePercent: number;
  volume: number;
  rsScore: number;
  rsRating: number;
  rsRaw: number | null;
  rm: number | null;
  phase: string | null;
  benchmark: string;
  source: "fiinquant_bridge";
};

const CACHE_TTL = 15 * 60 * 1000;
const cache = new Map<string, { data: unknown; ts: number }>();

function readString(item: BridgeRsItem, keys: string[], fallback = "") {
  for (const key of keys) {
    const value = item[key];
    if (typeof value === "string" && value.trim()) return value.trim();
    if (typeof value === "number" && Number.isFinite(value)) return String(value);
  }
  return fallback;
}

function readNumber(item: BridgeRsItem, keys: string[], fallback = 0) {
  for (const key of keys) {
    const raw = item[key];
    const value = typeof raw === "string" ? Number(raw.replace(/,/g, "")) : Number(raw);
    if (Number.isFinite(value)) return value;
  }
  return fallback;
}

function readNullableNumber(item: BridgeRsItem, keys: string[]) {
  const value = readNumber(item, keys, Number.NaN);
  return Number.isFinite(value) ? value : null;
}

function clampScore(value: number) {
  if (!Number.isFinite(value)) return 0;
  return Math.max(0, Math.min(100, Math.round(value * 100) / 100));
}

function normalizeRsStock(item: BridgeRsItem, defaultBenchmark: string): NormalizedRsStock | null {
  const symbol = readString(item, ["ticker", "symbol", "code"]).toUpperCase();
  if (!symbol) return null;

  const price = readNumber(item, ["close", "price", "lastPrice", "last_price"], 0);
  const prevClose = readNumber(item, ["prev_close", "prevClose", "refPrice", "referencePrice"], price);
  const change = Number.isFinite(price - prevClose) ? Math.round((price - prevClose) * 100) / 100 : 0;
  const changePercent = prevClose > 0 ? Math.round((change / prevClose) * 10_000) / 100 : 0;
  const rsRating = clampScore(readNumber(item, ["rs_rating", "rsRating", "rs_score", "rsScore"], 0));
  const rsRaw = readNullableNumber(item, ["rs", "relative_strength", "relativeStrength"]);

  return {
    symbol,
    name: readString(item, ["name", "companyName", "company_name"], symbol),
    sector: classifyTickerSector(symbol, readString(item, ["sector", "industry", "icbName"], "")),
    price,
    change,
    changePercent,
    volume: readNumber(item, ["volume", "matchVolume", "totalVolume"], 0),
    rsScore: rsRating,
    rsRating,
    rsRaw,
    rm: readNullableNumber(item, ["rm", "relative_momentum", "relativeMomentum"]),
    phase: readString(item, ["phase", "rrgPhase"], "") || null,
    benchmark: readString(item, ["benchmark", "base"], defaultBenchmark),
    source: "fiinquant_bridge",
  };
}

function getRawItems(payload: Record<string, unknown>) {
  const candidates = [payload.data, payload.stocks, payload.items, payload.results];
  for (const candidate of candidates) {
    if (Array.isArray(candidate)) return candidate as BridgeRsItem[];
  }
  return [];
}

export async function GET(request: NextRequest) {
  return handleGet(request);
}

function readRequestDate(request?: NextRequest | Request) {
  if (!request?.url) return null;
  const url = new URL(request.url);
  const date = url.searchParams.get("date")?.trim() ?? "";
  return /^\d{4}-\d{2}-\d{2}$/.test(date) ? date : null;
}

async function handleGet(request?: NextRequest | Request) {
  const requestedDate = readRequestDate(request);
  const cacheKey = requestedDate ? `date:${requestedDate}` : "latest";
  const cached = cache.get(cacheKey);
  if (cached && Date.now() - cached.ts < CACHE_TTL) {
    return NextResponse.json(cached.data);
  }

  const backend = getPythonBridgeUrl();
  const bridgeUrl = new URL("/api/v1/rs-rating", backend.endsWith("/") ? backend : `${backend}/`);
  if (requestedDate) {
    bridgeUrl.searchParams.set("date", requestedDate);
  }

  try {
    const res = await fetch(bridgeUrl.toString(), {
      cache: "no-store",
      signal: AbortSignal.timeout(60_000),
    });

    const responseText = await res.text();
    if (!res.ok) {
      console.error("[/api/rs-rating] FiinQuant bridge error:", res.status, responseText.slice(0, 800));
      return NextResponse.json(
        {
          error: "Không tải được bảng ADN Rank lúc này.",
          source: "fiinquant_bridge",
          publish: false,
        },
        { status: 502 },
      );
    }

    const parsed = JSON.parse(responseText) as unknown;
    const json =
      Array.isArray(parsed)
        ? { data: parsed }
        : parsed && typeof parsed === "object"
          ? (parsed as Record<string, unknown>)
          : {};
    const benchmark = readString(json, ["benchmark", "base"], "VNINDEX");
    const asOfDate = readString(json, ["asOfDate", "tradingDate", "date"], requestedDate ?? "");
    const stocks = getRawItems(json)
      .map((item) => normalizeRsStock(item, benchmark))
      .filter((item): item is NormalizedRsStock => Boolean(item));

    if (stocks.length === 0) {
      return NextResponse.json(
        {
          error: "Không có bảng ADN Rank hợp lệ cho thời điểm này.",
          source: "fiinquant_bridge",
          publish: false,
          updatedAt: new Date().toISOString(),
          stocks: [],
        },
        { status: 502 },
      );
    }

    const response = {
      stocks,
      count: stocks.length,
      cached: false,
      publish: true,
      source: "fiinquant_bridge",
      provider: "FiinQuant",
      calculation: "bridge_rs_calculator",
      benchmark,
      asOfDate: asOfDate || null,
      requestedDate,
      updatedAt: readString(json, ["updated_at", "updatedAt", "timestamp"], new Date().toISOString()),
    };

    cache.set(cacheKey, { data: response, ts: Date.now() });
    return NextResponse.json(response);
  } catch (err) {
    console.error("[/api/rs-rating] Fetch error:", err);
    return NextResponse.json(
      {
        error: "Không tải được bảng ADN Rank lúc này.",
        source: "fiinquant_bridge",
        publish: false,
      },
      { status: 502 },
    );
  }
}
