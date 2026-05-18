import { NextRequest, NextResponse } from "next/server";
import { isDatabaseInternalAuthorized } from "@/lib/database/internal-auth";
import { getDatabaseRealtimeHealth } from "@/lib/database/radar-realtime";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  if (!isDatabaseInternalAuthorized(req)) {
    return NextResponse.json({ error: { code: "UNAUTHORIZED", message: "Unauthorized" } }, { status: 401 });
  }
  const health = await getDatabaseRealtimeHealth();
  return NextResponse.json(health, { status: health.ok ? 200 : 207 });
}
