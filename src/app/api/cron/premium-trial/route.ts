import { NextRequest, NextResponse } from "next/server";
import { backfillPremiumTrialGrants } from "@/lib/premium-trial";
import { logCron, validateCronSecret } from "@/lib/cronHelpers";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function GET(req: NextRequest) {
  const start = Date.now();
  if (!validateCronSecret(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const limitRaw = Number(req.nextUrl.searchParams.get("limit") ?? "200");
    const limit = Number.isFinite(limitRaw) ? Math.max(1, Math.min(500, Math.floor(limitRaw))) : 200;
    const result = await backfillPremiumTrialGrants(limit);
    await logCron(
      "premium_trial_backfill",
      "success",
      `Premium trial backfill: granted ${result.granted}/${result.scanned}`,
      Date.now() - start,
      result,
    );
    return NextResponse.json({ ok: true, ...result });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    await logCron("premium_trial_backfill", "error", message, Date.now() - start);
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  return GET(req);
}
