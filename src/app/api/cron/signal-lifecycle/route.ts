/**
 * GET /api/cron/signal-lifecycle
 *
 * Cron job chạy mỗi 5 phút trong giờ giao dịch (9h-15h T2-T6).
 * Gọi updateSignalLifecycle() để:
 *   - RADAR → ACTIVE (breakout + volume)
 *   - ACTIVE → cập nhật PnL
 *   - ACTIVE → CLOSED (TP/SL/AI)
 *
 * Bảo vệ bằng CRON_SECRET để chỉ scheduler nội bộ gọi được.
 */
import { NextRequest, NextResponse } from "next/server";
import { updateSignalLifecycle } from "@/lib/SignalLifecycleWorker";
import { getVnNow, isWithinVnTradingSession } from "@/lib/time";

export const dynamic = "force-dynamic";
export const maxDuration = 60; // Cho phép chạy tối đa 60s

const CRON_SECRET = process.env.CRON_SECRET ?? "adn-cron-secret-key";

export async function GET(request: NextRequest) {
  // Xác thực: header hoặc query param
  const authHeader = request.headers.get("authorization");
  const querySecret = request.nextUrl.searchParams.get("secret");
  const token = authHeader?.replace("Bearer ", "") ?? querySecret;

  if (token !== CRON_SECRET) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    if (!isWithinVnTradingSession()) {
      return NextResponse.json({
        status: "skipped",
        reason: "outside_trading_session",
        timestamp: new Date().toISOString(),
        vnTime: getVnNow().format("YYYY-MM-DD HH:mm:ss"),
      });
    }

    const result = await updateSignalLifecycle();
    return NextResponse.json({
      status: "ok",
      timestamp: new Date().toISOString(),
      vnTime: getVnNow().format("YYYY-MM-DD HH:mm:ss"),
      ...result,
    });
  } catch (error) {
    console.error("[Cron Signal Lifecycle] Lỗi:", error);
    return NextResponse.json(
      { error: "Lỗi chạy lifecycle worker", detail: String(error) },
      { status: 500 },
    );
  }
}
