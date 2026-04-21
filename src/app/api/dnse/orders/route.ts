import { NextResponse } from "next/server";
import { getDnseTradingClient } from "@/lib/providers/dnse/trading-client";
import { requireDnseAccountContext } from "@/app/api/dnse/_shared";

export const dynamic = "force-dynamic";

/**
 * GET /api/dnse/orders
 * Lấy lịch sử lệnh DNSE theo tài khoản liên kết.
 */
export async function GET() {
  const resolved = await requireDnseAccountContext();
  if (!resolved.ok) return resolved.response;

  try {
    const client = getDnseTradingClient();
    const orders = await client.getOrders(resolved.context.accountNo);

    return NextResponse.json({
      success: true,
      orders,
      source: "dnse_api",
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Không thể lấy lịch sử lệnh DNSE";
    console.error("[DNSE_ORDERS_ROUTE] error", { message });
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
