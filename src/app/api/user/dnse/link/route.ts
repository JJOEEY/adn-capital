import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { encryptDnseToken } from "@/lib/brokers/dnse/crypto";
import {
  DNSE_SESSION_EXP_COOKIE,
  DNSE_SESSION_TOKEN_COOKIE,
  clearDnseSessionCookies,
} from "@/lib/brokers/dnse/session";
import { getDnseTradingClient } from "@/lib/providers/dnse/trading-client";

function normalizeAccountNo(value: string) {
  return value.trim().toUpperCase();
}

function normalizeAccountNoForCompare(value: string) {
  const normalized = normalizeAccountNo(value).replace(/[^A-Z0-9]/g, "");
  const noLeadingZero = normalized.replace(/^0+/, "");
  return {
    normalized,
    noLeadingZero: noLeadingZero.length > 0 ? noLeadingZero : "0",
  };
}

function isSameDnseAccount(left: string, right: string) {
  const l = normalizeAccountNoForCompare(left);
  const r = normalizeAccountNoForCompare(right);
  return l.normalized === r.normalized || l.noLeadingZero === r.noLeadingZero;
}

function createReqId() {
  const seed = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  return `dnse-link-${seed}`;
}

function logDnseLinkInfo(reqId: string, stage: string, payload?: Record<string, unknown>) {
  console.info(`[DNSE_LINK][${reqId}] ${stage}`, payload ?? {});
}

function logDnseLinkError(reqId: string, stage: string, payload?: Record<string, unknown>) {
  console.error(`[DNSE_LINK][${reqId}] ${stage}`, payload ?? {});
}

function resolveSessionExpiry(store: Awaited<ReturnType<typeof cookies>>) {
  const raw = store.get(DNSE_SESSION_EXP_COOKIE)?.value?.trim() || "";
  if (raw) {
    const parsed = new Date(raw);
    if (!Number.isNaN(parsed.getTime())) return parsed;
  }
  return new Date(Date.now() + 8 * 60 * 60 * 1_000);
}

export const dynamic = "force-dynamic";

/**
 * GET /api/user/dnse/link
 * Lấy trạng thái liên kết tài khoản DNSE của người dùng.
 */
export async function GET() {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const [user, connection] = await Promise.all([
    prisma.user.findUnique({
      where: { id: userId },
      select: {
        dnseId: true,
        dnseVerified: true,
        dnseAppliedAt: true,
      },
    }),
    prisma.dnseConnection.findUnique({
      where: { userId },
      select: {
        accountId: true,
        accountName: true,
        subAccountId: true,
        status: true,
        scope: true,
        accessTokenExpiresAt: true,
        refreshTokenExpiresAt: true,
        lastSyncedAt: true,
        lastError: true,
        updatedAt: true,
      },
    }),
  ]);

  if (!user) {
    return NextResponse.json({ error: "Không tìm thấy tài khoản" }, { status: 404 });
  }

  const linked = Boolean(connection && connection.status === "ACTIVE" && user.dnseVerified);
  return NextResponse.json({
    linked,
    connection: linked
      ? {
          accountNo: connection?.accountId ?? user.dnseId ?? null,
          accountId: connection?.accountId ?? user.dnseId ?? null,
          accountName: connection?.accountName ?? null,
          custodyCode: connection?.subAccountId ?? null,
          subAccountId: connection?.subAccountId ?? null,
          accountType: "SPOT",
          status: connection?.status ?? "ACTIVE",
          linkedAt: user.dnseAppliedAt,
          scope: connection?.scope ?? null,
          accessTokenExpiresAt: connection?.accessTokenExpiresAt ?? null,
          refreshTokenExpiresAt: connection?.refreshTokenExpiresAt ?? null,
          lastSyncedAt: connection?.lastSyncedAt ?? null,
          lastError: connection?.lastError ?? null,
          updatedAt: connection?.updatedAt ?? user.dnseAppliedAt ?? null,
          source: "dnse_user_session",
        }
      : null,
  });
}

/**
 * POST /api/user/dnse/link
 * Liên kết người dùng với tài khoản DNSE đã xác thực từ phiên đăng nhập DNSE.
 */
export async function POST(req: NextRequest) {
  const reqId = createReqId();
  try {
    logDnseLinkInfo(reqId, "start");

    const session = await auth();
    const userId = session?.user?.id;
    if (!userId) {
      logDnseLinkError(reqId, "auth_failed");
      return NextResponse.json({ code: "unauthorized", error: "Unauthorized" }, { status: 401 });
    }

    try {
      await prisma.$queryRaw`SELECT 1`;
      logDnseLinkInfo(reqId, "db_check_ok");
    } catch (dbError) {
      const dbMessage = dbError instanceof Error ? dbError.message : "unknown_db_error";
      logDnseLinkError(reqId, "db_check_failed", { dbMessage });
      return NextResponse.json(
        {
          code: "db_unreachable",
          error: "Không thể kết nối cơ sở dữ liệu khi liên kết DNSE. Vui lòng thử lại sau.",
        },
        { status: 500 },
      );
    }

    const body = (await req.json().catch(() => null)) as { accountNo?: unknown } | null;
    const accountNoRaw = typeof body?.accountNo === "string" ? body.accountNo : "";
    const accountNo = normalizeAccountNo(accountNoRaw);
    logDnseLinkInfo(reqId, "input_received", {
      userId,
      accountNoRaw,
      accountNo,
    });

    if (accountNo.length < 3) {
      logDnseLinkError(reqId, "invalid_account_format", { accountNoRaw, accountNo });
      return NextResponse.json(
        { code: "invalid_account_no", error: "Thiếu số tài khoản DNSE." },
        { status: 400 },
      );
    }

    const store = await cookies();
    const dnseSessionToken = store.get(DNSE_SESSION_TOKEN_COOKIE)?.value?.trim() || "";
    if (!dnseSessionToken) {
      logDnseLinkError(reqId, "dnse_session_missing");
      return NextResponse.json(
        {
          code: "dnse_login_required",
          error: "Bạn cần đăng nhập DNSE trước khi liên kết tài khoản.",
        },
        { status: 401 },
      );
    }
    const sessionExpiresAt = resolveSessionExpiry(store);
    logDnseLinkInfo(reqId, "dnse_session_ready", {
      sessionExpiresAt: sessionExpiresAt.toISOString(),
    });

    const client = getDnseTradingClient({
      userJwtToken: dnseSessionToken,
      isolated: true,
    });

    let accounts:
      | Array<{
          accountNo: string;
          accountName: string | null;
          custodyCode: string | null;
          accountType: string;
          status: string;
        }>
      | null = null;

    try {
      accounts = await client.getAccounts();
      logDnseLinkInfo(reqId, "accounts_loaded", {
        count: accounts.length,
        accountNos: accounts.map((row) => row.accountNo),
      });
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message.replace(/\s+@\s+https?:\/\/\S+/g, "")
          : "Lỗi không xác định";
      const looksLikeAuthError = /401|unauthorized|forbidden|token|jwt/i.test(message);
      const looksLikeRouteMismatch = /no route matched|HTTP_404/i.test(message);
      logDnseLinkError(reqId, "accounts_fetch_failed", {
        message,
        looksLikeAuthError,
        looksLikeRouteMismatch,
      });

      return NextResponse.json(
        {
          code: looksLikeAuthError
            ? "dnse_login_expired"
            : looksLikeRouteMismatch
              ? "dnse_endpoint_mismatch"
              : "dnse_accounts_fetch_failed",
          error: looksLikeAuthError
            ? "Phiên đăng nhập DNSE đã hết hạn hoặc không hợp lệ. Vui lòng đăng nhập lại."
            : looksLikeRouteMismatch
              ? "Không xác minh được danh sách tài khoản DNSE do endpoint chưa đúng. Vui lòng liên hệ admin kiểm tra cấu hình API DNSE."
              : `Không thể xác minh danh sách tài khoản DNSE: ${message}`,
        },
        { status: looksLikeAuthError ? 401 : 502 },
      );
    }

    const matched =
      accounts.find((row) => isSameDnseAccount(row.accountNo, accountNo)) ?? null;
    if (!matched) {
      logDnseLinkError(reqId, "account_not_found_in_verified_list", {
        requested: accountNo,
        requestedCompare: normalizeAccountNoForCompare(accountNo),
        available: accounts.map((row) => row.accountNo),
      });
      return NextResponse.json(
        {
          code: "account_not_in_verified_session",
          error:
            "Tài khoản không nằm trong danh sách DNSE vừa xác thực. Vui lòng đăng nhập đúng tài khoản DNSE và thử lại.",
        },
        { status: 403 },
      );
    }

    const existingUserWithDnse = await prisma.user.findUnique({
      where: { dnseId: accountNo },
      select: { id: true },
    });
    if (existingUserWithDnse && existingUserWithDnse.id !== userId) {
      logDnseLinkError(reqId, "account_owned_by_other_user_user_table", {
        accountNo,
        existingUserId: existingUserWithDnse.id,
        currentUserId: userId,
      });
      return NextResponse.json(
        {
          code: "account_already_linked_other_user",
          error: "Tài khoản DNSE này đã liên kết với người dùng khác.",
        },
        { status: 409 },
      );
    }

    const existingConnectionWithAccount = await prisma.dnseConnection.findUnique({
      where: { accountId: accountNo },
      select: { userId: true },
    });
    if (existingConnectionWithAccount && existingConnectionWithAccount.userId !== userId) {
      logDnseLinkError(reqId, "account_owned_by_other_user_connection_table", {
        accountNo,
        existingUserId: existingConnectionWithAccount.userId,
        currentUserId: userId,
      });
      return NextResponse.json(
        {
          code: "account_already_linked_other_connection",
          error: "Tài khoản DNSE này đã được liên kết bởi tài khoản khác.",
        },
        { status: 409 },
      );
    }

    let encryptedToken: string;
    try {
      encryptedToken = encryptDnseToken(dnseSessionToken);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Lỗi cấu hình máy chủ";
      const missingEncryptionKey = /DNSE_TOKEN_ENCRYPTION_KEY/i.test(message);
      logDnseLinkError(reqId, "encrypt_token_failed", {
        message,
        missingEncryptionKey,
      });
      return NextResponse.json(
        {
          code: missingEncryptionKey ? "missing_encryption_key" : "encrypt_token_failed",
          error: missingEncryptionKey
            ? "Máy chủ thiếu cấu hình bảo mật DNSE_TOKEN_ENCRYPTION_KEY nên chưa thể liên kết tài khoản. Vui lòng liên hệ admin xử lý cấu hình."
            : `Không thể mã hóa token DNSE: ${message}`,
        },
        { status: 500 },
      );
    }

    try {
      await prisma.$transaction(async (tx) => {
        await tx.user.update({
          where: { id: userId },
          data: {
            dnseId: accountNo,
            dnseVerified: true,
            dnseAppliedAt: new Date(),
          },
        });

        await tx.dnseConnection.upsert({
          where: { userId },
          create: {
            userId,
            provider: "DNSE",
            accountId: accountNo,
            accountName: matched.accountName ?? null,
            subAccountId: matched.custodyCode ?? null,
            status: "ACTIVE",
            accessTokenEnc: encryptedToken,
            tokenType: "Bearer",
            scope: "lightspeed",
            accessTokenExpiresAt: sessionExpiresAt,
            metadata: JSON.stringify({
              linkedVia: "dnse_user_session",
              linkedAt: new Date().toISOString(),
            }),
          },
          update: {
            accountId: accountNo,
            accountName: matched.accountName ?? null,
            subAccountId: matched.custodyCode ?? null,
            status: "ACTIVE",
            accessTokenEnc: encryptedToken,
            tokenType: "Bearer",
            scope: "lightspeed",
            accessTokenExpiresAt: sessionExpiresAt,
            lastError: null,
            metadata: JSON.stringify({
              linkedVia: "dnse_user_session",
              linkedAt: new Date().toISOString(),
            }),
          },
        });
      });
      logDnseLinkInfo(reqId, "db_transaction_success", {
        userId,
        accountNo,
      });
    } catch (txError) {
      const txMessage = txError instanceof Error ? txError.message : "transaction_failed";
      logDnseLinkError(reqId, "db_transaction_failed", {
        txMessage,
      });
      return NextResponse.json(
        {
          code: "link_transaction_failed",
          error: `Liên kết tài khoản DNSE thất bại khi lưu dữ liệu: ${txMessage}`,
        },
        { status: 500 },
      );
    }

    return NextResponse.json({
      success: true,
      code: "linked_success",
      connection: {
        accountNo,
        accountId: accountNo,
        accountName: matched.accountName ?? null,
        custodyCode: matched.custodyCode ?? null,
        subAccountId: matched.custodyCode ?? null,
        accountType: matched.accountType || "SPOT",
        status: matched.status || "ACTIVE",
        linkedAt: new Date().toISOString(),
        source: "dnse_user_session",
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Lỗi hệ thống";
    logDnseLinkError(reqId, "unexpected_error", { message });
    return NextResponse.json(
      { code: "link_unexpected_error", error: `Liên kết tài khoản DNSE thất bại: ${message}` },
      { status: 500 },
    );
  }
}

/**
 * DELETE /api/user/dnse/link
 * Gỡ liên kết DNSE của người dùng hiện tại.
 */
export async function DELETE() {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  await prisma.$transaction(async (tx) => {
    await tx.user.update({
      where: { id: userId },
      data: {
        dnseId: null,
        dnseVerified: false,
        dnseAppliedAt: null,
      },
    });
    await tx.dnseConnection.deleteMany({ where: { userId } });
  });

  const next = NextResponse.json({
    success: true,
    message: "Đã gỡ liên kết tài khoản DNSE.",
  });
  clearDnseSessionCookies(next);
  return next;
}
