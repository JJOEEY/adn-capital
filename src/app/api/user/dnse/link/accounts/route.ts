import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { auth } from "@/lib/auth";
import { DNSE_SESSION_TOKEN_COOKIE } from "@/lib/brokers/dnse/session";
import { getDnseTradingClient } from "@/lib/providers/dnse/trading-client";

export const dynamic = "force-dynamic";

/**
 * GET /api/user/dnse/link/accounts
 * Lay danh sach tai khoan DNSE tu phien dang nhap DNSE hien tai cua user.
 */
export async function GET() {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const store = await cookies();
  const dnseSessionToken = store.get(DNSE_SESSION_TOKEN_COOKIE)?.value?.trim() || "";
  if (!dnseSessionToken) {
    return NextResponse.json(
      {
        success: false,
        code: "dnse_login_required",
        error: "Ban can dang nhap DNSE truoc khi chon tai khoan.",
        accounts: [],
        source: "dnse_session",
      },
      { status: 401 },
    );
  }

  const client = getDnseTradingClient({
    userJwtToken: dnseSessionToken,
    isolated: true,
  });

  try {
    const accounts = await client.getAccounts();
    if (accounts.length === 0) {
      throw new Error("Danh sach tai khoan DNSE rong.");
    }
    return NextResponse.json({
      success: true,
      accounts,
      count: accounts.length,
      source: "dnse_session",
    });
  } catch (error) {
    const rawMessage =
      error instanceof Error ? error.message : "Khong the tai danh sach tai khoan DNSE";
    const message = rawMessage.replace(/\s+@\s+https?:\/\/\S+/g, "");
    const looksLikeAuthError = /401|unauthorized|forbidden|token|jwt/i.test(message);
    const looksLikeRouteMismatch = /no route matched|HTTP_404/i.test(message);

    return NextResponse.json(
      {
        success: false,
        code: looksLikeAuthError
          ? "dnse_login_required"
          : looksLikeRouteMismatch
            ? "dnse_endpoint_mismatch"
            : "dnse_accounts_fetch_failed",
        error: looksLikeAuthError
          ? "Phien dang nhap DNSE da het han hoac khong hop le. Vui long dang nhap lai DNSE."
          : looksLikeRouteMismatch
            ? "Khong doc duoc danh sach tai khoan DNSE (endpoint khong hop le). Vui long kiem tra cau hinh DNSE base URL/API key."
            : `Khong the doc danh sach tai khoan DNSE: ${message}`,
        accounts: [],
        source: "dnse_session",
      },
      { status: looksLikeAuthError ? 401 : 502 },
    );
  }
}

