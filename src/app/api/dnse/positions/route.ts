import { NextResponse } from "next/server";
import { getDnseTradingClient } from "@/lib/providers/dnse/trading-client";
import { requireDnseAccountContext } from "@/app/api/dnse/_shared";

export const dynamic = "force-dynamic";

/**
 * GET /api/dnse/positions
 * Lấy danh mục nắm giữ theo tài khoản DNSE đã liên kết.
 */
export async function GET() {
  try {
    console.log("[DNSE Positions API] Start");

    const resolved = await requireDnseAccountContext();
    if (!resolved.ok) {
      console.warn("[DNSE Positions API] Context failed");
      return resolved.response;
    }

    console.log("[DNSE Positions API] Context account:", resolved.context.accountNo);

    const client = getDnseTradingClient({ isolated: true });
    const positions = await client.getPositions(resolved.context.accountNo);

    console.log(
      "[DNSE Positions API] Positions count:",
      Array.isArray(positions) ? positions.length : -1,
    );

    return NextResponse.json({
      success: true,
      positions,
      source: "dnse_api",
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Không thể lấy dữ liệu danh mục DNSE";
    console.error("[DNSE Positions API] Error:", message);
    if (error instanceof Error) {
      console.error("[DNSE Positions API] Stack:", error.stack);
    }
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
