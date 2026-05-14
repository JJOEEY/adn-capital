import { NextRequest, NextResponse } from "next/server";
import { logCron, validateCronSecret } from "@/lib/cronHelpers";
import { syncRadarPaperAccountPrices } from "@/lib/radar-paper-account";
import { getVnNow, isVnTradingDay } from "@/lib/time";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

function resolveSlot(request: NextRequest): "11:30" | "15:00" | "manual" {
  const raw = request.nextUrl.searchParams.get("slot");
  if (raw === "11:30" || raw === "1130") return "11:30";
  if (raw === "15:00" || raw === "1500") return "15:00";
  return "manual";
}

export async function GET(request: NextRequest) {
  const startedAt = Date.now();
  if (!validateCronSecret(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const slot = resolveSlot(request);
  try {
    if (!isVnTradingDay()) {
      const result = {
        status: "skipped",
        reason: "outside_trading_day",
        slot,
        vnTime: getVnNow().format("YYYY-MM-DD HH:mm:ss"),
      };
      await logCron("radar_paper_snapshot", "skipped", result.reason, Date.now() - startedAt, result);
      return NextResponse.json(result);
    }

    const result = await syncRadarPaperAccountPrices({ slot });
    await logCron("radar_paper_snapshot", "success", `radar paper ${slot}`, Date.now() - startedAt, result);
    return NextResponse.json({
      status: "ok",
      slot,
      vnTime: getVnNow().format("YYYY-MM-DD HH:mm:ss"),
      ...result,
    });
  } catch (error) {
    await logCron("radar_paper_snapshot", "error", String(error), Date.now() - startedAt);
    console.error("[Cron Radar Paper] Error:", error);
    return NextResponse.json({ error: "radar_paper_failed", detail: String(error) }, { status: 500 });
  }
}
