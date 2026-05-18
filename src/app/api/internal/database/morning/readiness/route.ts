import { NextRequest, NextResponse } from "next/server";
import { isDatabaseInternalAuthorized } from "@/lib/database/internal-auth";
import { getDatabaseMorningReadiness } from "@/lib/database/morning-readiness";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  if (!isDatabaseInternalAuthorized(req)) {
    return NextResponse.json({ error: { code: "UNAUTHORIZED", message: "Unauthorized" } }, { status: 401 });
  }
  const readiness = await getDatabaseMorningReadiness({
    tradingDate: req.nextUrl.searchParams.get("tradingDate") ?? undefined,
    previousTradingDate: req.nextUrl.searchParams.get("previousTradingDate") ?? undefined,
  });
  return NextResponse.json(readiness, { status: readiness.ok ? 200 : 207 });
}
