import { NextRequest, NextResponse } from "next/server";
import { isDatabaseInternalAuthorized } from "@/lib/database/internal-auth";
import { getDatabaseV2Readiness } from "@/lib/database/readiness";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  if (!isDatabaseInternalAuthorized(req)) {
    return NextResponse.json({ error: { code: "UNAUTHORIZED", message: "Unauthorized" } }, { status: 401 });
  }
  const readiness = await getDatabaseV2Readiness();
  return NextResponse.json(readiness, { status: readiness.ok ? 200 : 207 });
}
