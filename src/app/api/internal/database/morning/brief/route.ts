import { NextRequest, NextResponse } from "next/server";
import { isDatabaseInternalAuthorized } from "@/lib/database/internal-auth";
import { getDatabaseMorningBrief } from "@/lib/database/morning-brief";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  if (!isDatabaseInternalAuthorized(req)) {
    return NextResponse.json({ error: { code: "UNAUTHORIZED", message: "Unauthorized" } }, { status: 401 });
  }
  const brief = await getDatabaseMorningBrief({
    tradingDate: req.nextUrl.searchParams.get("tradingDate") ?? undefined,
    previousTradingDate: req.nextUrl.searchParams.get("previousTradingDate") ?? undefined,
    windowHours: Number(req.nextUrl.searchParams.get("windowHours")) || undefined,
  });
  return NextResponse.json(brief, { status: brief.ok ? 200 : 207 });
}
