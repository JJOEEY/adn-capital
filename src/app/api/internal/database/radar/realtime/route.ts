import { NextRequest, NextResponse } from "next/server";
import { isDatabaseInternalAuthorized } from "@/lib/database/internal-auth";
import { collectDatabaseRadarRealtime, getDatabaseRadarRealtime } from "@/lib/database/radar-realtime";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  if (!isDatabaseInternalAuthorized(req)) {
    return NextResponse.json({ error: { code: "UNAUTHORIZED", message: "Unauthorized" } }, { status: 401 });
  }
  const result = await getDatabaseRadarRealtime();
  return NextResponse.json(result, { status: result.ok ? 200 : 207 });
}

export async function POST(req: NextRequest) {
  if (!isDatabaseInternalAuthorized(req)) {
    return NextResponse.json({ error: { code: "UNAUTHORIZED", message: "Unauthorized" } }, { status: 401 });
  }
  const tickers = req.nextUrl.searchParams
    .get("tickers")
    ?.split(",")
    .map((item) => item.trim())
    .filter(Boolean);
  const result = await collectDatabaseRadarRealtime({
    tickers,
    timeoutMs: Number(req.nextUrl.searchParams.get("timeoutMs") ?? 50_000),
  });
  return NextResponse.json(result, { status: result.ok ? 200 : 207 });
}
