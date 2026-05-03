import { NextResponse } from "next/server";
import fs from "fs";
import path from "path";
import { getPythonBridgeUrl } from "@/lib/runtime-config";

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
    return NextResponse.json({
      ...cached.data,
      stale: false,
      source: "cache",
    });
  }

  const live = await fetchLiveOverview();
  if (live) {
    saveCacheToFile(live);
    return NextResponse.json({
      ...live,
      stale: false,
      source: "live",
    });
  }

  if (cached && hasCompleteValuation(cached.data)) {
    return NextResponse.json({
      ...cached.data,
      stale: true,
      source: "cache-stale",
    });
  }

  return NextResponse.json({
    score: 0,
    max_score: 14,
    level: 1,
    status_badge: "Dang cap nhat...",
    market_breadth: "Dang tinh toan...",
    action_message: "He thong dang cap nhat du lieu vi mo, vui long quay lai sau.",
    last_updated: new Date().toISOString(),
    stale: true,
    source: "fallback",
  });
}
