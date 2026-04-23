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

    console.log("[DNSE Orders API] Context account:", {
      accountNo: resolved.context.accountNo,
      brokerAccountNo: resolved.context.brokerAccountNo,
      subAccountId: resolved.context.subAccountId,
    });

    const client = getDnseTradingClient({
      userJwtToken: resolved.context.userJwtToken,
      isolated: true,
    });
    const candidates = resolved.context.accountCandidates.length
      ? resolved.context.accountCandidates
      : [resolved.context.brokerAccountNo];

    let orders: Awaited<ReturnType<typeof client.getOrders>> = [];
    let usedAccountNo: string | null = null;
    let lastError: Error | null = null;

    for (const accountNo of candidates) {
      try {
        const rows = await client.getOrders(accountNo);
        if (rows.length > 0 || accountNo === candidates[candidates.length - 1]) {
          orders = rows;
          usedAccountNo = accountNo;
          break;
        }
      } catch (error) {
        lastError = error instanceof Error ? error : new Error("unknown_orders_error");
        console.warn("[DNSE Orders API] Candidate failed", {
          accountNo,
          message: lastError.message,
        });
      }
    }

    if (!usedAccountNo) {
      throw lastError ?? new Error("Không thể lấy lịch sử lệnh DNSE cho các tài khoản đã liên kết.");
    }

    console.log("[DNSE Orders API] Orders result:", {
      usedAccountNo,
      count: Array.isArray(orders) ? orders.length : -1,
    });

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
