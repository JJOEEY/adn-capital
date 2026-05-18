import { NextRequest, NextResponse } from "next/server";
import { runDnseMarketHealth } from "@/lib/database/providers/dnse/health";

export const dynamic = "force-dynamic";

function isInternalAuthorized(req: NextRequest) {
  const expected = (process.env.INTERNAL_API_KEY ?? process.env.CRON_SECRET ?? "").trim();
  if (!expected) return false;
  const bearer = req.headers.get("authorization")?.replace(/^Bearer\s+/i, "").trim();
  const provided = (req.headers.get("x-internal-key") ?? req.headers.get("x-cron-secret") ?? bearer ?? "").trim();
  return Boolean(provided && provided === expected);
}

export async function GET(req: NextRequest) {
  if (!isInternalAuthorized(req)) {
    return NextResponse.json({ error: { code: "UNAUTHORIZED", message: "Unauthorized" } }, { status: 401 });
  }

  const health = await runDnseMarketHealth();
  return NextResponse.json(health, {
    status: health.status === "blocked" ? 503 : 200,
  });
}
