import { NextResponse } from "next/server";
import { getDnseTradingClient } from "@/lib/providers/dnse/trading-client";
import { requireDnseAccountContext } from "@/app/api/dnse/_shared";

export const dynamic = "force-dynamic";

/**
 * GET /api/dnse/balance
 * Lấy số dư/NAV tài khoản DNSE đã liên kết.
 */
export async function GET() {
  const resolved = await requireDnseAccountContext();
  if (!resolved.ok) return resolved.response;

  try {
    const client = getDnseTradingClient();
    const balance = await client.getBalance(resolved.context.accountNo);

    return NextResponse.json({
      success: true,
      balance: {
        accountNo: balance.accountNo,
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
    console.error("[DNSE_BALANCE_ROUTE] error", { message });
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
