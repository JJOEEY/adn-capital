import { NextRequest, NextResponse } from "next/server";
import { validateCronSecret, logCron } from "@/lib/cronHelpers";

export const maxDuration = 30;
export const dynamic = "force-dynamic";

/**
 * Compatibility-only route.
 *
 * The canonical scanner is /api/cron?type=signal_scan_type1 and is fixed-slot gated.
 * Keeping this route active would run a second scanner path and can duplicate Telegram/web alerts.
 */
export async function GET(req: NextRequest) {
  if (!validateCronSecret(req)) {
    return NextResponse.json({ error: "Khong co quyen truy cap" }, { status: 401 });
  }

  await logCron(
    "signal_scan_type1",
    "skipped",
    "Legacy /api/cron/scan-signals disabled; use /api/cron?type=signal_scan_type1",
    0,
    { legacyRoute: "/api/cron/scan-signals" },
  );

  return NextResponse.json({
    type: "signal_scan_type1",
    deprecated: true,
    executed: false,
    message: "Legacy route disabled. Use /api/cron?type=signal_scan_type1.",
  });
}
