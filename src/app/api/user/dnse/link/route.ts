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
  try {
    const session = await auth();
    const userId = session?.user?.id;
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = (await req.json().catch(() => null)) as { accountNo?: unknown } | null;
    const accountNoRaw = typeof body?.accountNo === "string" ? body.accountNo : "";
    const accountNo = normalizeAccountNo(accountNoRaw);
    if (accountNo.length < 3) {
      return NextResponse.json({ error: "Thiếu số tài khoản DNSE." }, { status: 400 });
    }

    const store = await cookies();
    const dnseSessionToken = store.get(DNSE_SESSION_TOKEN_COOKIE)?.value?.trim() || "";
    if (!dnseSessionToken) {
      return NextResponse.json(
        { error: "Bạn cần đăng nhập DNSE trước khi liên kết tài khoản." },
        { status: 401 },
      );
    }
    const sessionExpiresAt = resolveSessionExpiry(store);

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
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message.replace(/\s+@\s+https?:\/\/\S+/g, "")
          : "Lỗi không xác định";
      const looksLikeAuthError = /401|unauthorized|forbidden|token|jwt/i.test(message);
      const looksLikeRouteMismatch = /no route matched|HTTP_404/i.test(message);

      return NextResponse.json(
        {
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
      accounts.find((row) => normalizeAccountNo(row.accountNo) === accountNo) ?? null;
    if (!matched) {
      return NextResponse.json(
        {
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
      return NextResponse.json(
        { error: "Tài khoản DNSE này đã liên kết với người dùng khác." },
        { status: 409 },
      );
    }

    const existingConnectionWithAccount = await prisma.dnseConnection.findUnique({
      where: { accountId: accountNo },
      select: { userId: true },
    });
    if (existingConnectionWithAccount && existingConnectionWithAccount.userId !== userId) {
      return NextResponse.json(
        { error: "Tài khoản DNSE này đã được liên kết bởi tài khoản khác." },
        { status: 409 },
      );
    }

    let encryptedToken: string;
    try {
      encryptedToken = encryptDnseToken(dnseSessionToken);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Lỗi cấu hình máy chủ";
      const missingEncryptionKey = /DNSE_TOKEN_ENCRYPTION_KEY/i.test(message);
      return NextResponse.json(
        {
          error: missingEncryptionKey
            ? "Máy chủ thiếu cấu hình bảo mật DNSE_TOKEN_ENCRYPTION_KEY nên chưa thể liên kết tài khoản. Vui lòng liên hệ admin xử lý cấu hình."
            : `Không thể mã hóa token DNSE: ${message}`,
        },
        { status: 500 },
      );
    }

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

    return NextResponse.json({
      success: true,
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
    return NextResponse.json(
      { error: `Liên kết tài khoản DNSE thất bại: ${message}` },
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
