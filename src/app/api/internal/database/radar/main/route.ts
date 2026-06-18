import { NextRequest, NextResponse } from "next/server";
import { isDatabaseInternalAuthorized } from "@/lib/database/internal-auth";
import { getDatabaseRadarUniverse } from "@/lib/database/radar-realtime";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  if (!isDatabaseInternalAuthorized(req)) {
    return NextResponse.json({ error: { code: "UNAUTHORIZED", message: "Unauthorized" } }, { status: 401 });
  }
  const limit = Number(req.nextUrl.searchParams.get("limit") ?? 600);
  const tickers = await getDatabaseRadarUniverse(Number.isFinite(limit) ? limit : 500);
  return NextResponse.json({
    ok: true,
    universe: { tickers },
    count: tickers.length,
  });
}
