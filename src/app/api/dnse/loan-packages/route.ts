import { NextResponse } from "next/server";
import { getDnseTradingClient } from "@/lib/providers/dnse/trading-client";
import { requireDnseAccountContext } from "@/app/api/dnse/_shared";

export const dynamic = "force-dynamic";

/**
 * GET /api/dnse/loan-packages
 * Lấy danh sách gói vay margin theo tài khoản DNSE đã liên kết.
 */
export async function GET() {
  const resolved = await requireDnseAccountContext();
  if (!resolved.ok) return resolved.response;

  try {
    const client = getDnseTradingClient();
    const packages = await client.getLoanPackages(resolved.context.accountNo);

    return NextResponse.json({
      success: true,
      packages,
      source: "dnse_api",
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Không thể lấy danh sách gói vay DNSE";
    console.error("[DNSE_LOAN_PACKAGES_ROUTE] error", { message });
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
