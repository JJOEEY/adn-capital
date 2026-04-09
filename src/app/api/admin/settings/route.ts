/**
 * /api/admin/settings/route.ts
 *
 * Secure API to read and toggle IS_MOCK_MODE (and other system settings).
 * Protected by: ADMIN role check via Clerk/NextAuth.
 */
import { NextRequest, NextResponse } from "next/server";
import { getCurrentDbUser } from "@/lib/current-user";
import { getSetting, setSetting, isMockMode } from "@/lib/settings";

// ── GET — fetch current settings ─────────────────────────────────────
export async function GET(req: NextRequest) {
  const user = await getCurrentDbUser();
  if (!user || user.role !== "ADMIN") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const mockMode = await isMockMode();
  return NextResponse.json({
    IS_MOCK_MODE: mockMode,
    updatedAt: new Date().toISOString(),
  });
}

// ── POST — update a setting ───────────────────────────────────────────
export async function POST(req: NextRequest) {
  const user = await getCurrentDbUser();
  if (!user || user.role !== "ADMIN") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await req.json() as { key: string; value: string };
  if (!body.key || body.value === undefined) {
    return NextResponse.json({ error: "Missing key or value" }, { status: 400 });
  }

  await setSetting(body.key, body.value);
  return NextResponse.json({ ok: true, key: body.key, value: body.value });
}
