import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { getDnseTradingClient } from "@/lib/providers/dnse/trading-client";

export const dynamic = "force-dynamic";

/**
 * GET /api/user/dnse/link/accounts
 * Lấy danh sách tài khoản DNSE từ API server-side (API key), dùng để liên kết account.
 */
export async function GET() {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!process.env.DNSE_API_KEY?.trim()) {
    return NextResponse.json(
      {
        success: false,
        error: "DNSE_API_KEY chưa cấu hình trên server",
        accounts: [],
        source: "dnse_api_key",
      },
      { status: 500 },
    );
  }

  try {
    const client = getDnseTradingClient();
    const accounts = await client.getAccounts();
    return NextResponse.json({
      success: true,
      accounts,
      count: accounts.length,
      source: "dnse_api_key",
    });
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : "Không thể tải danh sách tài khoản DNSE";
    return NextResponse.json(
      {
        success: false,
        error: `DNSE accounts request failed: ${message}`,
        accounts: [],
        source: "dnse_api_key",
      },
      { status: 502 },
    );
  }
}

