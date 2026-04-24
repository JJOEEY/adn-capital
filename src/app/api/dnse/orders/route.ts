import { NextResponse } from "next/server";
import { getDnseTradingClient } from "@/lib/providers/dnse/trading-client";
import { requireDnseAccountContext } from "@/app/api/dnse/_shared";

export const dynamic = "force-dynamic";

function normalizeOrdersError(raw: string) {
  const lower = raw.toLowerCase();
  if (/session-only mode|session api failed|failed to get order history|failed to get orders|remote_server_error/.test(lower)) {
    return "Không lấy được lịch sử lệnh từ DNSE trong phiên hiện tại. Vui lòng làm mới dữ liệu hoặc đăng nhập lại DNSE.";
  }
  if (/authorization|unauthorized|forbidden|jwt|token expired/.test(lower)) {
    return "Phiên đăng nhập DNSE đã hết hạn hoặc không hợp lệ. Vui lòng đăng nhập lại DNSE.";
  }
  if (/no route matched|not found|404/.test(lower)) {
    return "Endpoint lịch sử lệnh DNSE chưa khớp với cấu hình hiện tại. Vui lòng kiểm tra lại cấu hình OpenAPI.";
  }
  return raw;
}

/**
 * GET /api/dnse/orders
 * Lấy lịch sử lệnh DNSE theo tài khoản liên kết.
 */
export async function GET() {
  try {
    console.log("[DNSE Orders API] Start");
    const now = new Date();
    const fromDate = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000)
      .toISOString()
      .slice(0, 10);
    const toDate = now.toISOString().slice(0, 10);

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

    let orders: Awaited<ReturnType<typeof client.getOrdersHistory>> = [];
    let usedAccountNo: string | null = null;
    let lastError: Error | null = null;

    for (const accountNo of candidates) {
      try {
        let rows = await client.getOrdersHistory(accountNo, {
          fromDate,
          toDate,
          size: 100,
        });
        if (!rows.length) {
          rows = await client.getOrdersHistory(accountNo, {
            size: 100,
          });
        }
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
    return NextResponse.json({ error: normalizeOrdersError(message) }, { status: 502 });
  }
}
