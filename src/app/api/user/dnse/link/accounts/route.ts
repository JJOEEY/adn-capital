import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { getDnseTradingClient } from "@/lib/providers/dnse/trading-client";

export const dynamic = "force-dynamic";

/**
 * GET /api/user/dnse/link/accounts
 * Read available DNSE accounts in API-key mode for account selector.
 */
export async function GET() {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!process.env.DNSE_API_KEY?.trim()) {
    return NextResponse.json(
      { error: "DNSE_API_KEY is not configured on server" },
      { status: 500 },
    );
  }

  try {
    const accounts = await getDnseTradingClient().getAccounts();
    return NextResponse.json({
      success: true,
      accounts,
      count: accounts.length,
      source: "dnse_api_key",
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to fetch DNSE accounts";
    return NextResponse.json(
      { error: message, accounts: [], source: "dnse_api_key" },
      { status: 502 },
    );
  }
}

