import { NextRequest, NextResponse } from "next/server";
import { getDatabaseAidenContext } from "@/lib/database/aiden";
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
  const result = await getDatabaseAidenContext({
    tickers,
    tradingDate: req.nextUrl.searchParams.get("tradingDate") ?? undefined,
    previousTradingDate: req.nextUrl.searchParams.get("previousTradingDate") ?? undefined,
  });
  return NextResponse.json(result, { status: result.ok ? 200 : 207 });
}
