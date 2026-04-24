import { NextResponse } from "next/server";
import { getDnseTradingClient } from "@/lib/providers/dnse/trading-client";
import { requireDnseAccountContext } from "@/app/api/dnse/_shared";

export const dynamic = "force-dynamic";

function numberValue(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string") {
    const parsed = Number(value.replace(/,/g, "").trim());
    if (Number.isFinite(parsed)) return parsed;
  }
  return null;
}

function pickBestNumber(row: Record<string, unknown>, keys: string[], fallback = 0) {
  const values = keys
    .map((key) => numberValue(row[key]))
    .filter((value): value is number => value != null);
  const positive = values.find((value) => value > 0);
  return positive ?? values[0] ?? fallback;
}

const NAV_KEYS = [
  "totalNav",
  "netAssetValue",
  "totalAsset",
  "totalAssets",
  "nav",
  "asset",
  "totalValue",
  "accountValue",
  "equity",
];

const BUYING_POWER_KEYS = [
  "buyingPower",
  "purchasingPower",
  "cashAvailable",
  "availableCash",
  "cashWithdrawable",
  "withdrawableCash",
  "availableBalance",
  "availableAmount",
  "maxBuyAmount",
  "maxBuyValue",
  "buyingPowerValue",
  "pp",
  "PP",
  "ppse",
  "PPSE",
];

const CASH_KEYS = [
  "cash",
  "cashBalance",
  "cashAvailable",
  "availableCash",
  "cashWithdrawable",
  "withdrawableCash",
  "availableBalance",
  "availableAmount",
];

const DEBT_KEYS = ["debt", "totalDebt", "marginDebt", "loan", "totalLoan"];

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
        const totalNav = pickBestNumber(row as unknown as Record<string, unknown>, NAV_KEYS, 0);
        const buyingPower = pickBestNumber(row as unknown as Record<string, unknown>, BUYING_POWER_KEYS, 0);
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

    const balanceRow = balance as unknown as Record<string, unknown>;
    const totalNav = pickBestNumber(balanceRow, NAV_KEYS, 0);
    const buyingPower = pickBestNumber(balanceRow, BUYING_POWER_KEYS, 0);
    const cash = pickBestNumber(balanceRow, CASH_KEYS, buyingPower);
    const debt = pickBestNumber(balanceRow, DEBT_KEYS, 0);

    console.log("[DNSE Balance API] Balance result:", {
      usedAccountNo,
      accountNo: balance.accountNo,
      totalNav,
      buyingPower,
    });

    return NextResponse.json({
      success: true,
      balance: {
        accountNo: usedAccountNo,
        cashBalance: pickBestNumber(balanceRow, ["cashBalance", ...CASH_KEYS], cash),
        cashAvailable: pickBestNumber(balanceRow, ["cashAvailable", ...BUYING_POWER_KEYS], buyingPower),
        cashWithdrawable: pickBestNumber(balanceRow, ["cashWithdrawable", "withdrawableCash", ...CASH_KEYS], cash),
        totalAsset: pickBestNumber(balanceRow, ["totalAsset", ...NAV_KEYS], totalNav),
        totalDebt: pickBestNumber(balanceRow, ["totalDebt", ...DEBT_KEYS], debt),
        netAssetValue: pickBestNumber(balanceRow, ["netAssetValue", ...NAV_KEYS], totalNav),
        buyingPower,
      },
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
