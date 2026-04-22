import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { auth } from "@/lib/auth";
import { DNSE_SESSION_TOKEN_COOKIE } from "@/lib/brokers/dnse/session";
import { getDnseTradingClient } from "@/lib/providers/dnse/trading-client";

export const dynamic = "force-dynamic";

function createReqId() {
  return `dnse-link-accounts-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function logInfo(reqId: string, stage: string, payload?: Record<string, unknown>) {
  console.info(`[DNSE_LINK_ACCOUNTS][${reqId}] ${stage}`, payload ?? {});
}

function logError(reqId: string, stage: string, payload?: Record<string, unknown>) {
  console.error(`[DNSE_LINK_ACCOUNTS][${reqId}] ${stage}`, payload ?? {});
}

/**
 * GET /api/user/dnse/link/accounts
 * Lấy danh sách tài khoản DNSE từ phiên đăng nhập DNSE hiện tại của user.
 */
export async function GET() {
  const reqId = createReqId();
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) {
    logError(reqId, "auth_failed");
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  logInfo(reqId, "start", { userId });

  const store = await cookies();
  const dnseSessionToken = store.get(DNSE_SESSION_TOKEN_COOKIE)?.value?.trim() || "";
  if (!dnseSessionToken) {
    logError(reqId, "dnse_session_missing");
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
    logInfo(reqId, "accounts_loaded", {
      count: accounts.length,
      accountNos: accounts.map((item) => item.accountNo),
    });

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
    const looksLikeRouteMismatch = /no route matched|http_404|not found/i.test(message);

    logError(reqId, "accounts_fetch_failed", {
      message,
      looksLikeAuthError,
      looksLikeRouteMismatch,
    });

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
            ? "Không đọc được danh sách tài khoản từ DNSE do endpoint chưa đúng. Vui lòng liên hệ admin kiểm tra lại."
            : `Không thể đọc danh sách tài khoản DNSE: ${message}`,
        accounts: [],
        source: "dnse_session",
      },
      { status: looksLikeAuthError ? 401 : 502 },
    );
  }
}

