import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentDbUser } from "@/lib/current-user";
import { getVnNow, isWithinVnTradingSession } from "@/lib/time";

export const dynamic = "force-dynamic";

function isTradingWindow(now: Date) {
  return isWithinVnTradingSession(now);
}

export async function GET() {
  try {
    const dbUser = await getCurrentDbUser();
    if (!dbUser || dbUser.systemRole !== "ADMIN") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const cronNameFilter = {
      OR: [
        { cronName: "signal_scan" },
        { cronName: "signal_scan_5m" },
        { cronName: "scan-signals" },
        { cronName: "scan_signals" },
      ],
    };

    const [lastRun, lastSuccess, lastError, lastSignal] = await Promise.all([
      prisma.cronLog.findFirst({
        where: cronNameFilter,
        orderBy: { createdAt: "desc" },
      }),
      prisma.cronLog.findFirst({
        where: {
          ...cronNameFilter,
          status: "success",
        },
        orderBy: { createdAt: "desc" },
      }),
      prisma.cronLog.findFirst({
        where: {
          ...cronNameFilter,
          status: "error",
        },
        orderBy: { createdAt: "desc" },
      }),
      prisma.signal.findFirst({
        orderBy: { createdAt: "desc" },
        select: { id: true, ticker: true, type: true, createdAt: true },
      }),
    ]);

    const vnNow = getVnNow().toDate();
    const staleThresholdMinutes = 45;
    const lastRunAt = lastRun?.createdAt ?? null;
    const minutesSinceLastRun = lastRunAt
      ? Math.floor((vnNow.getTime() - new Date(lastRunAt).getTime()) / 60000)
      : null;
    const stale = isTradingWindow(vnNow) && (minutesSinceLastRun == null || minutesSinceLastRun > staleThresholdMinutes);

    return NextResponse.json({
      now: vnNow.toISOString(),
      staleThresholdMinutes,
      isStale: stale,
      scanner: {
        lastRun: lastRun
          ? {
              at: lastRun.createdAt,
              status: lastRun.status,
              message: lastRun.message,
              duration: lastRun.duration,
            }
          : null,
        lastSuccess: lastSuccess
          ? {
              at: lastSuccess.createdAt,
              message: lastSuccess.message,
              duration: lastSuccess.duration,
            }
          : null,
        lastError: lastError
          ? {
              at: lastError.createdAt,
              message: lastError.message,
            }
          : null,
        minutesSinceLastRun,
      },
      lastSignal: lastSignal
        ? {
            id: lastSignal.id,
            ticker: lastSignal.ticker,
            type: lastSignal.type,
            createdAt: lastSignal.createdAt,
          }
        : null,
    });
  } catch (error) {
    console.error("[/api/admin/system/cron-status] Error:", error);
    return NextResponse.json({ error: "Không thể tải trạng thái scanner" }, { status: 500 });
  }
}
