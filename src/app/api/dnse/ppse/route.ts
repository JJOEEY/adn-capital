import { NextRequest, NextResponse } from "next/server";
import { getDnseTradingClient } from "@/lib/providers/dnse/trading-client";
import { requireDnseAccountContext } from "@/app/api/dnse/_shared";

export const dynamic = "force-dynamic";

/**
 * GET /api/dnse/ppse?symbol=HPG
 * Lấy sức mua theo mã cổ phiếu.
 */
export async function GET(request: NextRequest) {
  try {
    console.log("[DNSE PPSE API] Start");

    const resolved = await requireDnseAccountContext();
    if (!resolved.ok) {
      console.warn("[DNSE PPSE API] Context failed");
      return resolved.response;
    }

    const symbolRaw = request.nextUrl.searchParams.get("symbol") ?? "";
    const symbol = symbolRaw.trim().toUpperCase();
    if (!symbol) {
      return NextResponse.json({ error: "Thiếu mã cổ phiếu (symbol)" }, { status: 400 });
    }

    console.log("[DNSE PPSE API] Context account:", {
      accountNo: resolved.context.accountNo,
      brokerAccountNo: resolved.context.brokerAccountNo,
      subAccountId: resolved.context.subAccountId,
      symbol,
    });

    const client = getDnseTradingClient({
      userJwtToken: resolved.context.userJwtToken,
      isolated: true,
    });
    const candidates = resolved.context.accountCandidates.length
      ? resolved.context.accountCandidates
      : [resolved.context.brokerAccountNo];
    let ppse: Awaited<ReturnType<typeof client.getPPSE>> = null;
    let usedAccountNo: string | null = null;
    let lastError: Error | null = null;

    for (const accountNo of candidates) {
      try {
        const row = await client.getPPSE(accountNo, symbol);
        if (row || accountNo === candidates[candidates.length - 1]) {
          ppse = row;
          usedAccountNo = accountNo;
          break;
        }
      } catch (error) {
        lastError = error instanceof Error ? error : new Error("unknown_ppse_error");
        console.warn("[DNSE PPSE API] Candidate failed", {
          accountNo,
          message: lastError.message,
        });
      }
    }

    if (!usedAccountNo) {
      throw lastError ?? new Error("Không thể lấy dữ liệu PPSE cho các tài khoản đã liên kết.");
    }

    console.log("[DNSE PPSE API] Result:", { usedAccountNo, hasData: Boolean(ppse) });

    return NextResponse.json({
      success: true,
      ppse,
      source: "dnse_api",
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Không thể lấy dữ liệu PPSE DNSE";
    console.error("[DNSE PPSE API] Error:", message);
    if (error instanceof Error) {
      console.error("[DNSE PPSE API] Stack:", error.stack);
    }
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
