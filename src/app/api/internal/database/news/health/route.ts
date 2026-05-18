import { NextRequest, NextResponse } from "next/server";
import { isDatabaseInternalAuthorized } from "@/lib/database/internal-auth";
import { getDatabaseNewsHealth } from "@/lib/database";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  if (!isDatabaseInternalAuthorized(req)) {
    return NextResponse.json({ error: { code: "UNAUTHORIZED", message: "Unauthorized" } }, { status: 401 });
  }
  const windowHours = Number(req.nextUrl.searchParams.get("windowHours") ?? 36);
  const health = await getDatabaseNewsHealth({
    windowHours: Number.isFinite(windowHours) && windowHours > 0 ? windowHours : 36,
  });
  return NextResponse.json(health, { status: health.status === "blocked" ? 503 : 200 });
}
