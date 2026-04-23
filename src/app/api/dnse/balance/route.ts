import { NextResponse } from "next/server";
import { getDnseTradingClient } from "@/lib/providers/dnse/trading-client";
import { requireDnseAccountContext } from "@/app/api/dnse/_shared";

export const dynamic = "force-dynamic";

/**
 * GET /api/dnse/balance
 * Lấy số dư/NAV tài khoản DNSE đã liên kết.
 */
export async function GET() {
  try {
    console.log("[DNSE Balance API] Start");

    const resolved = await requireDnseAccountContext();
    if (!resolved.ok) {
      console.warn("[DNSE Balance API] Context failed");
      return resolved.response;
    }

    console.log("[DNSE Balance API] Context account:", {
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

    let balance: Awaited<ReturnType<typeof client.getBalance>> | null = null;
    let usedAccountNo: string | null = null;
    let lastError: Error | null = null;

    for (const accountNo of candidates) {
      try {
        const row = await client.getBalance(accountNo);
        const totalNav = Number(row.totalNav ?? row.netAssetValue ?? row.totalAsset ?? 0);
        const buyingPower = Number(row.buyingPower ?? row.cashAvailable ?? row.cashBalance ?? 0);
        const hasUsableValue = totalNav > 0 || buyingPower > 0;
        if (hasUsableValue || accountNo === candidates[candidates.length - 1]) {
          balance = row;
          usedAccountNo = accountNo;
          break;
        }
      } catch (error) {
        lastError = error instanceof Error ? error : new Error("unknown_balance_error");
        console.warn("[DNSE Balance API] Candidate failed", {
          accountNo,
          message: lastError.message,
        });
      }
    }

    if (!balance || !usedAccountNo) {
      throw lastError ?? new Error("Không thể lấy NAV/số dư từ DNSE cho các tài khoản đã liên kết.");
    }

    console.log("[DNSE Balance API] Balance result:", {
      usedAccountNo,
      accountNo: balance.accountNo,
      totalNav: balance.totalNav ?? balance.netAssetValue ?? balance.totalAsset ?? 0,
      buyingPower: balance.buyingPower ?? balance.cashAvailable ?? balance.cashBalance ?? 0,
    });

    return NextResponse.json({
      success: true,
      balance: {
        accountNo: usedAccountNo,
        cashBalance: balance.cash ?? 0,
        cashAvailable: balance.buyingPower ?? 0,
        cashWithdrawable: balance.cash ?? 0,
        totalAsset: balance.totalNav ?? 0,
        totalDebt: balance.debt ?? 0,
        netAssetValue: balance.totalNav ?? 0,
        buyingPower: balance.buyingPower ?? 0,
      },
      source: "dnse_api",
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Không thể lấy dữ liệu số dư DNSE";
    console.error("[DNSE Balance API] Error:", message);
    if (error instanceof Error) {
      console.error("[DNSE Balance API] Stack:", error.stack);
    }
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
