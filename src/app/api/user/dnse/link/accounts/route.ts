import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { auth } from "@/lib/auth";
import { DNSE_SESSION_TOKEN_COOKIE } from "@/lib/brokers/dnse/session";
import { getDnseTradingClient } from "@/lib/providers/dnse/trading-client";

export const dynamic = "force-dynamic";

/**
 * GET /api/user/dnse/link/accounts
 * Lấy danh sách tài khoản DNSE từ phiên đăng nhập DNSE hiện tại của user.
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
        error: "Bạn cần đăng nhập DNSE trước khi chọn tài khoản.",
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
      throw new Error("Danh sách tài khoản DNSE rỗng.");
    }
    return NextResponse.json({
      success: true,
      accounts,
      count: accounts.length,
      source: "dnse_session",
    });
  } catch (error) {
    const rawMessage =
      error instanceof Error ? error.message : "Không thể tải danh sách tài khoản DNSE";
    const message = rawMessage.replace(/\s+@\s+https?:\/\/\S+/g, "");
    const looksLikeAuthError = /401|unauthorized|forbidden|token|jwt|authorization|oa-400/i.test(
      message,
    );
    const looksLikeRouteMismatch = /no route matched|HTTP_404|not found/i.test(message);

    return NextResponse.json(
      {
        success: false,
        code: looksLikeAuthError
          ? "dnse_login_required"
          : looksLikeRouteMismatch
            ? "dnse_endpoint_mismatch"
            : "dnse_accounts_fetch_failed",
        error: looksLikeAuthError
          ? "Phiên đăng nhập DNSE đã hết hạn hoặc không hợp lệ. Vui lòng đăng nhập lại DNSE."
          : looksLikeRouteMismatch
            ? "Không đọc được danh sách tài khoản DNSE do endpoint chưa đúng. Vui lòng liên hệ admin kiểm tra cấu hình API DNSE."
            : `Không thể đọc danh sách tài khoản DNSE: ${message}`,
        accounts: [],
        source: "dnse_session",
      },
      { status: looksLikeAuthError ? 401 : 502 },
    );
  }
}
