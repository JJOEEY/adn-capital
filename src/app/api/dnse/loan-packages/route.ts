import { NextResponse } from "next/server";
import { getDnseTradingClient } from "@/lib/providers/dnse/trading-client";
import { requireDnseAccountContext } from "@/app/api/dnse/_shared";

export const dynamic = "force-dynamic";

/**
 * GET /api/dnse/loan-packages
 * Lấy danh sách gói vay margin theo tài khoản DNSE đã liên kết.
 */
export async function GET() {
  try {
    console.log("[DNSE LoanPackages API] Start");

    const resolved = await requireDnseAccountContext();
    if (!resolved.ok) {
      console.warn("[DNSE LoanPackages API] Context failed");
      return resolved.response;
    }

    console.log("[DNSE LoanPackages API] Context account:", resolved.context.accountNo);

    const client = getDnseTradingClient();
    const packages = await client.getLoanPackages(resolved.context.accountNo);

    console.log(
      "[DNSE LoanPackages API] Packages count:",
      Array.isArray(packages) ? packages.length : -1,
    );

    return NextResponse.json({
      success: true,
      packages,
      source: "dnse_api",
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Không thể lấy danh sách gói vay DNSE";
    console.error("[DNSE LoanPackages API] Error:", message);
    if (error instanceof Error) {
      console.error("[DNSE LoanPackages API] Stack:", error.stack);
    }
    return NextResponse.json({ error: message }, { status: 502 });
  }
}

