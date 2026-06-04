import { NextRequest, NextResponse } from "next/server";
import { isDatabaseInternalAuthorized } from "@/lib/database/internal-auth";
import { getDatabaseMorningBrief } from "@/lib/database/morning-brief";
import { upsertDatabaseToolLatest } from "@/lib/database/tool-latest";

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
  if (brief.data) {
    await upsertDatabaseToolLatest({
      tool: "brief",
      dataset: "brief.morning",
      key: "latest",
      tradingDate: brief.data.metadata.tradingDate,
      source: brief.data.metadata.newsSources.includes("vnstock_news") ? "vnstock" : brief.source,
      payload: brief.data,
      missingFields: brief.missingFields,
      providerStatus: brief.providerStatus,
      ttlMs: 36 * 60 * 60_000,
    });
  }
  return NextResponse.json(brief, { status: brief.ok ? 200 : 207 });
}
