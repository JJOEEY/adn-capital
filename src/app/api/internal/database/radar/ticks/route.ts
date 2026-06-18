import { NextRequest, NextResponse } from "next/server";
import { isDatabaseInternalAuthorized } from "@/lib/database/internal-auth";
import { getDatabaseRadarTicks } from "@/lib/database/radar-realtime";

export const dynamic = "force-dynamic";

// Giá DNSE realtime mới nhất theo từng mã — cho scanner bridge dùng (thay FiinQuant realtime).
export async function GET(req: NextRequest) {
  if (!isDatabaseInternalAuthorized(req)) {
    return NextResponse.json({ error: { code: "UNAUTHORIZED", message: "Unauthorized" } }, { status: 401 });
  }
  const maxAgeMs = Number(req.nextUrl.searchParams.get("maxAgeMs") ?? 30 * 60_000);
  const result = await getDatabaseRadarTicks(Number.isFinite(maxAgeMs) ? maxAgeMs : 30 * 60_000);
  return NextResponse.json({ ok: true, ...result });
}
