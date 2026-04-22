import { NextResponse } from "next/server";
import { getDnseTradingClient } from "@/lib/providers/dnse/trading-client";
import { requireDnseAccountContext } from "@/app/api/dnse/_shared";

export const dynamic = "force-dynamic";

/**
 * GET /api/dnse/orders
 * Lấy lịch sử lệnh DNSE theo tài khoản liên kết.
 */
export async function GET() {
  try {
    console.log("[DNSE Orders API] Start");

    const resolved = await requireDnseAccountContext();
    if (!resolved.ok) {
      console.warn("[DNSE Orders API] Context failed");
      return resolved.response;
    }

    console.log("[DNSE Orders API] Context account:", resolved.context.accountNo);

    const client = getDnseTradingClient({
      userJwtToken: resolved.context.userJwtToken,
      isolated: true,
    });
    const orders = await client.getOrders(resolved.context.accountNo);

    console.log("[DNSE Orders API] Orders count:", Array.isArray(orders) ? orders.length : -1);

    return NextResponse.json({
      success: true,
      orders,
      source: "dnse_api",
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Không thể lấy lịch sử lệnh DNSE";
    console.error("[DNSE Orders API] Error:", message);
    if (error instanceof Error) {
      console.error("[DNSE Orders API] Stack:", error.stack);
    }
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
