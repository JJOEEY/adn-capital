import { NextRequest, NextResponse } from "next/server";
import { getSetting, setSetting, isMockMode } from "@/lib/settings";
import { isAdmin } from "@/lib/admin-check";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

const ALLOWED_SETTINGS = new Set([
  "IS_MOCK_MODE",
  "AI_BROKER_MIN_PRICE",
  "AI_BROKER_MIN_WINRATE",
  "AI_BROKER_MIN_RR",
  "AI_BROKER_AUTO_PICK",
  "AI_BROKER_MAX_TOTAL_NAV",
  "DNSE_EXECUTION_KILL_SWITCH",
  "DNSE_EXECUTION_KILL_SWITCH_REASON",
  "DNSE_EXECUTION_ALLOWLIST_ENFORCED",
  "DNSE_EXECUTION_ALLOWLIST_USER_IDS",
  "DNSE_EXECUTION_ALLOWLIST_ACCOUNT_IDS",
  "DNSE_EXECUTION_ALLOWLIST_EMAILS",
]);

export async function GET(_req: NextRequest) {
  if (!(await isAdmin())) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const [
    mockMode,
    minPrice,
    minWinRate,
    minRr,
    autoPick,
    maxTotalNav,
    dnseKillSwitch,
    dnseKillSwitchReason,
    dnseAllowlistEnforced,
    dnseAllowlistUserIds,
    dnseAllowlistAccountIds,
    dnseAllowlistEmails,
  ] = await Promise.all([
    isMockMode(),
    getSetting("AI_BROKER_MIN_PRICE", "10"),
    getSetting("AI_BROKER_MIN_WINRATE", "60"),
    getSetting("AI_BROKER_MIN_RR", "1"),
    getSetting("AI_BROKER_AUTO_PICK", "true"),
    getSetting("AI_BROKER_MAX_TOTAL_NAV", "90"),
    getSetting("DNSE_EXECUTION_KILL_SWITCH", "false"),
    getSetting("DNSE_EXECUTION_KILL_SWITCH_REASON", ""),
    getSetting("DNSE_EXECUTION_ALLOWLIST_ENFORCED", "true"),
    getSetting("DNSE_EXECUTION_ALLOWLIST_USER_IDS", ""),
    getSetting("DNSE_EXECUTION_ALLOWLIST_ACCOUNT_IDS", ""),
    getSetting("DNSE_EXECUTION_ALLOWLIST_EMAILS", ""),
  ]);

  return NextResponse.json({
    IS_MOCK_MODE: mockMode,
    AI_BROKER_MIN_PRICE: minPrice,
    AI_BROKER_MIN_WINRATE: minWinRate,
    AI_BROKER_MIN_RR: minRr,
    AI_BROKER_AUTO_PICK: autoPick === "true",
    AI_BROKER_MAX_TOTAL_NAV: maxTotalNav,
    DNSE_EXECUTION_KILL_SWITCH: dnseKillSwitch === "true",
    DNSE_EXECUTION_KILL_SWITCH_REASON: dnseKillSwitchReason,
    DNSE_EXECUTION_ALLOWLIST_ENFORCED: dnseAllowlistEnforced === "true",
    DNSE_EXECUTION_ALLOWLIST_USER_IDS: dnseAllowlistUserIds,
    DNSE_EXECUTION_ALLOWLIST_ACCOUNT_IDS: dnseAllowlistAccountIds,
    DNSE_EXECUTION_ALLOWLIST_EMAILS: dnseAllowlistEmails,
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

  const oldValue = await getSetting(body.key, "");
  await setSetting(body.key, body.value);

  try {
    const session = await auth();
    await prisma.changelog.create({
      data: {
        component: "AI_BROKER_ADMIN",
        action: "UPDATE_SETTING",
        description: `Cập nhật ${body.key}`,
        diff: JSON.stringify({
          key: body.key,
          previousValue: oldValue,
          nextValue: body.value,
          byUserId: session?.user?.id ?? null,
        }),
        author: session?.user?.email ?? session?.user?.id ?? "admin",
      },
    });
  } catch {
    // non-blocking audit
  }

  return NextResponse.json({ ok: true, key: body.key, value: body.value });
}
