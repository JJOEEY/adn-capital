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

    console.log("[DNSE LoanPackages API] Context account:", {
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

    let packages: Awaited<ReturnType<typeof client.getLoanPackages>> = [];
    let usedAccountNo: string | null = null;
    let lastError: Error | null = null;

    for (const accountNo of candidates) {
      try {
        const rows = await client.getLoanPackages(accountNo);
        if (rows.length > 0 || accountNo === candidates[candidates.length - 1]) {
          packages = rows;
          usedAccountNo = accountNo;
          break;
        }
      } catch (error) {
        lastError = error instanceof Error ? error : new Error("unknown_loan_packages_error");
        console.warn("[DNSE LoanPackages API] Candidate failed", {
          accountNo,
          message: lastError.message,
        });
      }
    }

    if (!usedAccountNo) {
      throw lastError ?? new Error("Không thể lấy danh sách gói vay DNSE cho các tài khoản đã liên kết.");
    }

    console.log(
      "[DNSE LoanPackages API] Packages result:",
      { usedAccountNo, count: Array.isArray(packages) ? packages.length : -1 },
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
