import { NextResponse } from "next/server";
import fs from "fs";
import path from "path";
import { getPythonBridgeUrl } from "@/lib/runtime-config";
import { getTopicEnvelope } from "@/lib/datahub/core";
import { buildTopicContext } from "@/lib/datahub/producer-context";
import { getMarketPayloadRows, readMarketNumber } from "@/lib/market-price-normalization";
import { normalizeAdnCoreV2 } from "@/lib/adn-core-scoring";
import { calculateRPI, getLatestRPI, type OHLCVData } from "@/lib/rpi/calculator";

const CACHE_FILE = path.join(process.cwd(), "market_cache.json");
const BACKEND = getPythonBridgeUrl();
const TTL_MS = 15 * 60 * 1000;

type CachePayload = Record<string, unknown> & {
  last_updated?: string;
};

function hasCompleteValuation(data: CachePayload | null | undefined): boolean {
  if (!data) return false;
  const pe = Number(data.pe);
  const pb = Number(data.pb);
  return Number.isFinite(pe) && pe > 0 && Number.isFinite(pb) && pb > 0;
}

function readCacheFromFile(): { data: CachePayload; ageMs: number } | null {
  try {
    if (!fs.existsSync(CACHE_FILE)) return null;
    const raw = fs.readFileSync(CACHE_FILE, "utf-8");
    const data = JSON.parse(raw) as CachePayload;
    const ts = typeof data.last_updated === "string" ? new Date(data.last_updated).getTime() : NaN;
    const ageMs = Number.isFinite(ts) ? Date.now() - ts : Number.POSITIVE_INFINITY;
    return { data, ageMs };
  } catch {
    return null;
  }
}

function saveCacheToFile(data: CachePayload) {
  try {
    fs.writeFileSync(
      CACHE_FILE,
      JSON.stringify(
        {
          ...data,
          last_updated: new Date().toISOString(),
        },
        null,
        2,
      ),
    );
  } catch (err) {
    console.error("[/api/market-overview] Failed to save cache file:", err);
  }
}

function readDate(row: Record<string, unknown>) {
  const value = row.date ?? row.tradingDate ?? row.time ?? row.timestamp;
  if (value instanceof Date) return value.toISOString().slice(0, 10);
  if (typeof value === "number") return new Date(value).toISOString().slice(0, 10);
  if (typeof value === "string") return value.trim().slice(0, 10);
  return null;
}

function toOhlcvRows(value: unknown): OHLCVData[] {
  return getMarketPayloadRows(value)
    .map((row) => {
      const date = readDate(row);
      const open = readMarketNumber(row.open ?? row.o);
      const high = readMarketNumber(row.high ?? row.h);
      const low = readMarketNumber(row.low ?? row.l);
      const close = readMarketNumber(row.close ?? row.c ?? row.price);
      const volume = readMarketNumber(row.volume ?? row.v ?? row.matchVolume) ?? 0;
      if (!date || open == null || high == null || low == null || close == null) return null;
      if ([open, high, low, close].some((item) => !Number.isFinite(item) || item <= 0)) return null;
      return { date, open, high, low, close, volume };
    })
    .filter((row): row is OHLCVData => row != null)
    .sort((a, b) => a.date.localeCompare(b.date));
}

async function readCurrentAdnArtScore(force: boolean) {
  try {
    const context = await buildTopicContext({ force });
    const envelope = await getTopicEnvelope("vn:historical:VN30:1d", context);
    const latest = getLatestRPI(calculateRPI(toOhlcvRows(envelope.value)));
    return latest?.rpi ?? null;
  } catch {
    return null;
  }
}

async function fetchLiveOverview(): Promise<CachePayload | null> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 12_000);
  try {
    const response = await fetch(`${BACKEND}/api/v1/market-overview`, {
      cache: "no-store",
      signal: controller.signal,
    });
    if (!response.ok) return null;
    const payload = (await response.json()) as CachePayload;
    return payload && typeof payload === "object" ? payload : null;
  } catch {
    return null;
  } finally {
    clearTimeout(timeout);
  }
}

export async function GET(req: Request) {
  const forceRefresh = new URL(req.url).searchParams.get("force") === "1";
  const cached = readCacheFromFile();
  if (cached && cached.ageMs <= TTL_MS && !forceRefresh && hasCompleteValuation(cached.data)) {
    const normalized = normalizeAdnCoreV2(cached.data);
    return NextResponse.json({
      ...normalized,
      stale: false,
      source: "cache",
    });
  }

  const live = await fetchLiveOverview();
  if (live) {
    const normalized = normalizeAdnCoreV2(live, { artScore: await readCurrentAdnArtScore(forceRefresh) });
    saveCacheToFile(normalized);
    return NextResponse.json({
      ...normalized,
      stale: false,
      source: "live",
    });
  }

  if (cached && hasCompleteValuation(cached.data)) {
    const normalized = normalizeAdnCoreV2(cached.data);
    return NextResponse.json({
      ...normalized,
      stale: true,
      source: "cache-stale",
    });
  }

  return NextResponse.json({
    score: 0,
    max_score: 10,
    level: 1,
    last_updated: new Date().toISOString(),
    stale: true,
    source: "fallback",
    status_badge: "\u0110ang c\u1eadp nh\u1eadt...",
    market_breadth: "\u0110ang t\u00ednh to\u00e1n...",
    action_message: "H\u1ec7 th\u1ed1ng \u0111ang c\u1eadp nh\u1eadt d\u1eef li\u1ec7u v\u0129 m\u00f4, vui l\u00f2ng quay l\u1ea1i sau.",
  });
}
