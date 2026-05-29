import { NextRequest, NextResponse } from "next/server";
import { isDatabaseInternalAuthorized } from "@/lib/database/internal-auth";
import { ingestDatabaseRadarWsMessages } from "@/lib/database/radar-realtime";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  if (!isDatabaseInternalAuthorized(req)) {
    return NextResponse.json({ error: { code: "UNAUTHORIZED", message: "Unauthorized" } }, { status: 401 });
  }
  const body = await req.json().catch(() => ({}));
  const result = await ingestDatabaseRadarWsMessages(body);
  return NextResponse.json(result, { status: result.ok ? 200 : 207 });
}
