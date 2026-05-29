import { NextRequest, NextResponse } from "next/server";
import { isDatabaseInternalAuthorized } from "@/lib/database/internal-auth";
import { DNSE_DEFAULT_EOD_SYMBOLS } from "@/lib/database/providers/dnse/eod-map";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  if (!isDatabaseInternalAuthorized(req)) {
    return NextResponse.json({ error: { code: "UNAUTHORIZED", message: "Unauthorized" } }, { status: 401 });
  }
  return NextResponse.json({
    ok: true,
    tickers: Array.from(DNSE_DEFAULT_EOD_SYMBOLS),
  });
}
