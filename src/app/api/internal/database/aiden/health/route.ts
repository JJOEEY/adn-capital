import { NextRequest, NextResponse } from "next/server";
import { getDatabaseAidenHealth } from "@/lib/database/aiden";
import { isDatabaseInternalAuthorized } from "@/lib/database/internal-auth";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  if (!isDatabaseInternalAuthorized(req)) {
    return NextResponse.json({ error: { code: "UNAUTHORIZED", message: "Unauthorized" } }, { status: 401 });
  }

  const tickers = req.nextUrl.searchParams
    .get("tickers")
    ?.split(",")
    .map((item) => item.trim())
    .filter(Boolean);
  const health = await getDatabaseAidenHealth({ sampleTickers: tickers });
  return NextResponse.json(health, { status: health.ok ? 200 : 207 });
}
