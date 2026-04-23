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

    console.log("[DNSE Positions API] Context account:", {
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

    let positions: Awaited<ReturnType<typeof client.getPositions>> = [];
    let usedAccountNo: string | null = null;
    let lastError: Error | null = null;

    for (const accountNo of candidates) {
      try {
        const rows = await client.getPositions(accountNo);
        if (rows.length > 0 || accountNo === candidates[candidates.length - 1]) {
          positions = rows;
          usedAccountNo = accountNo;
          break;
        }
      } catch (error) {
        lastError = error instanceof Error ? error : new Error("unknown_positions_error");
        console.warn("[DNSE Positions API] Candidate failed", {
          accountNo,
          message: lastError.message,
        });
      }
    }

    if (!usedAccountNo) {
      throw lastError ?? new Error("Không thể lấy danh mục DNSE cho các tài khoản đã liên kết.");
    }

    console.log(
      "[DNSE Positions API] Positions result:",
      { usedAccountNo, count: Array.isArray(positions) ? positions.length : -1 },
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
