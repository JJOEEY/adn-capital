import { NextRequest, NextResponse } from "next/server";
import { getSetting, setSetting, isMockMode } from "@/lib/settings";
import { isAdmin } from "@/lib/admin-check";

const ALLOWED_SETTINGS = new Set([
  "IS_MOCK_MODE",
  "AI_BROKER_MIN_PRICE",
  "AI_BROKER_MIN_WINRATE",
  "AI_BROKER_MAX_RR",
  "AI_BROKER_MAX_TOTAL_NAV",
]);

export async function GET(_req: NextRequest) {
  if (!(await isAdmin())) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const [mockMode, minPrice, minWinRate, maxRr, maxTotalNav] = await Promise.all([
    isMockMode(),
    getSetting("AI_BROKER_MIN_PRICE", "10"),
    getSetting("AI_BROKER_MIN_WINRATE", "60"),
    getSetting("AI_BROKER_MAX_RR", "2"),
    getSetting("AI_BROKER_MAX_TOTAL_NAV", "90"),
  ]);

  return NextResponse.json({
    IS_MOCK_MODE: mockMode,
    AI_BROKER_MIN_PRICE: minPrice,
    AI_BROKER_MIN_WINRATE: minWinRate,
    AI_BROKER_MAX_RR: maxRr,
    AI_BROKER_MAX_TOTAL_NAV: maxTotalNav,
    updatedAt: new Date().toISOString(),
  });
}

export async function POST(req: NextRequest) {
  if (!(await isAdmin())) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await req.json() as { key: string; value: string };
  if (!body.key || body.value === undefined) {
    return NextResponse.json({ error: "Missing key or value" }, { status: 400 });
  }
  if (!ALLOWED_SETTINGS.has(body.key)) {
    return NextResponse.json({ error: "Unsupported setting key" }, { status: 400 });
  }

  await setSetting(body.key, body.value);
  return NextResponse.json({ ok: true, key: body.key, value: body.value });
}
