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
 * Lay trang thai lien ket tai khoan DNSE cua user.
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
    return NextResponse.json({ error: "Khong tim thay tai khoan" }, { status: 404 });
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
 * Lien ket user voi tai khoan DNSE da xac thuc tu phien dang nhap DNSE.
 */
export async function POST(req: NextRequest) {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = (await req.json().catch(() => null)) as { accountNo?: unknown } | null;
  const accountNoRaw = typeof body?.accountNo === "string" ? body.accountNo : "";
  const accountNo = normalizeAccountNo(accountNoRaw);
  if (accountNo.length < 3) {
    return NextResponse.json({ error: "accountNo is required" }, { status: 400 });
  }

  const store = await cookies();
  const dnseSessionToken = store.get(DNSE_SESSION_TOKEN_COOKIE)?.value?.trim() || "";
  if (!dnseSessionToken) {
    return NextResponse.json(
      { error: "Ban can dang nhap DNSE truoc khi lien ket tai khoan." },
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
      error instanceof Error ? error.message.replace(/\s+@\s+https?:\/\/\S+/g, "") : "Loi khong xac dinh";
    const looksLikeAuthError = /401|unauthorized|forbidden|token|jwt/i.test(message);
    const looksLikeRouteMismatch = /no route matched|HTTP_404/i.test(message);

    return NextResponse.json(
      {
        error: looksLikeAuthError
          ? "Phien dang nhap DNSE da het han hoac khong hop le. Vui long dang nhap lai."
          : looksLikeRouteMismatch
            ? "Khong xac minh duoc danh sach tai khoan DNSE do endpoint khong hop le. Vui long kiem tra DNSE base URL/API key."
            : `Khong the xac minh danh sach tai khoan DNSE: ${message}`,
      },
      { status: looksLikeAuthError ? 401 : 502 },
    );
  }

  const matched = accounts.find((row) => normalizeAccountNo(row.accountNo) === accountNo) ?? null;
  if (!matched) {
    return NextResponse.json(
      {
        error:
          "Tai khoan khong nam trong danh sach DNSE vua xac thuc. Vui long dang nhap dung tai khoan DNSE va thu lai.",
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
      { error: "Tai khoan DNSE nay da lien ket voi user khac." },
      { status: 409 },
    );
  }

  const existingConnectionWithAccount = await prisma.dnseConnection.findUnique({
    where: { accountId: accountNo },
    select: { userId: true },
  });
  if (existingConnectionWithAccount && existingConnectionWithAccount.userId !== userId) {
    return NextResponse.json(
      { error: "Tai khoan DNSE nay da duoc lien ket boi tai khoan khac." },
      { status: 409 },
    );
  }

  const encryptedToken = encryptDnseToken(dnseSessionToken);

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
}

/**
 * DELETE /api/user/dnse/link
 * Go lien ket DNSE cua user hien tai.
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
    message: "Da go lien ket tai khoan DNSE.",
  });
  clearDnseSessionCookies(next);
  return next;
}

