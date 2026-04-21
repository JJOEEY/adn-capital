import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { invalidateDnseBrokerTopicsForUser } from "@/lib/brokers/dnse/topics";
import { unlinkDnseConnectionForUser } from "@/lib/brokers/dnse/connection";
import { getDnseTradingClient } from "@/lib/providers/dnse/trading-client";

export const dynamic = "force-dynamic";

function normalizeAccountNo(value: unknown) {
  if (typeof value !== "string") return "";
  return value.trim().toUpperCase();
}

/**
 * GET /api/user/dnse/link
 * Read current DNSE link status for current user.
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
        updatedAt: true,
      },
    }),
  ]);

  if (!user) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }

  const accountNo = connection?.accountId ?? user.dnseId ?? null;
  const linked = Boolean(user.dnseVerified && accountNo);

  return NextResponse.json({
    linked,
    configured: Boolean(process.env.DNSE_API_KEY?.trim()),
    connection: linked
      ? {
          accountNo,
          accountName: connection?.accountName ?? null,
          subAccountId: connection?.subAccountId ?? null,
          status: connection?.status ?? "ACTIVE_MANUAL",
          linkedAt: user.dnseAppliedAt ?? connection?.updatedAt ?? null,
          source: connection ? "oauth_connection" : "manual_api_key_link",
        }
      : null,
  });
}

/**
 * POST /api/user/dnse/link
 * Link current user with a DNSE account in API-key mode.
 */
export async function POST(req: NextRequest) {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const allowManualLink =
    (process.env.DNSE_ALLOW_INSECURE_MANUAL_LINK ?? "").trim().toLowerCase() === "true";
  if (!allowManualLink) {
    return NextResponse.json(
      {
        error:
          "Đã tắt liên kết thủ công bằng số tài khoản. Vui lòng dùng luồng xác thực DNSE người dùng (OAuth/JWT+OTP) để liên kết an toàn.",
      },
      { status: 403 },
    );
  }

  if (!process.env.DNSE_API_KEY?.trim()) {
    return NextResponse.json(
      { error: "DNSE_API_KEY is not configured on server" },
      { status: 500 },
    );
  }

  const body = (await req.json().catch(() => null)) as
    | { accountNo?: unknown }
    | null;
  const accountNo = normalizeAccountNo(body?.accountNo);
  if (accountNo.length < 3) {
    return NextResponse.json(
      { error: "accountNo is required" },
      { status: 400 },
    );
  }

  let dnseAccounts: Array<{ accountNo: string }> = [];
  try {
    dnseAccounts = await getDnseTradingClient().getAccounts();
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : "Failed to verify DNSE account by API key";
    return NextResponse.json(
      { error: `Cannot verify account at DNSE: ${message}` },
      { status: 502 },
    );
  }

  const existsOnDnse = dnseAccounts.some(
    (item) => item.accountNo.trim().toUpperCase() === accountNo,
  );
  if (!existsOnDnse) {
    return NextResponse.json(
      { error: `Account ${accountNo} not found in DNSE` },
      { status: 404 },
    );
  }

  const [ownerByDnseId, ownerByConnection] = await Promise.all([
    prisma.user.findUnique({
      where: { dnseId: accountNo },
      select: { id: true },
    }),
    prisma.dnseConnection.findUnique({
      where: { accountId: accountNo },
      select: { userId: true },
    }),
  ]);

  const occupiedByOtherUser =
    (ownerByDnseId && ownerByDnseId.id !== userId) ||
    (ownerByConnection && ownerByConnection.userId !== userId);

  if (occupiedByOtherUser) {
    return NextResponse.json(
      { error: `Account ${accountNo} already linked to another user` },
      { status: 409 },
    );
  }

  const linkedAt = new Date();
  const updatedUser = await prisma.user.update({
    where: { id: userId },
    data: {
      dnseId: accountNo,
      dnseVerified: true,
      dnseAppliedAt: linkedAt,
    },
    select: {
      dnseId: true,
      dnseVerified: true,
      dnseAppliedAt: true,
    },
  });

  await invalidateDnseBrokerTopicsForUser(userId).catch(() => null);

  return NextResponse.json({
    success: true,
    linked: true,
    connection: {
      accountNo: updatedUser.dnseId,
      accountName: null,
      subAccountId: null,
      status: "ACTIVE_MANUAL",
      linkedAt: updatedUser.dnseAppliedAt,
      source: "manual_api_key_link",
    },
  });
}

/**
 * DELETE /api/user/dnse/link
 * Unlink DNSE account from current user.
 */
export async function DELETE() {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  await unlinkDnseConnectionForUser(userId);
  await invalidateDnseBrokerTopicsForUser(userId).catch(() => null);

  return NextResponse.json({
    success: true,
    linked: false,
    message: "DNSE account unlinked",
  });
}
