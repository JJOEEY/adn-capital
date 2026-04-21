import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getDnseTradingClient } from "@/lib/providers/dnse/trading-client";

function normalizeAccountNo(value: string) {
  return value.trim().toUpperCase();
}

export const dynamic = "force-dynamic";

/**
 * GET /api/user/dnse/link
 * Trả trạng thái liên kết tài khoản DNSE hiện tại của user.
 */
export async function GET() {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      dnseId: true,
      dnseVerified: true,
      dnseAppliedAt: true,
    },
  });

  if (!user) {
    return NextResponse.json({ error: "Không tìm thấy tài khoản" }, { status: 404 });
  }

  const accountNo = normalizeAccountNo(user.dnseId ?? "");
  if (!user.dnseVerified || !accountNo) {
    return NextResponse.json({
      linked: false,
      connection: null,
    });
  }

  let accountName: string | null = null;
  let custodyCode: string | null = null;
  let accountType = "SPOT";
  let status = "ACTIVE";
  let source: "api_key_verified" | "api_key_cached" = "api_key_cached";

  try {
    const client = getDnseTradingClient();
    const accounts = await client.getAccounts();
    const matched = accounts.find((row) => normalizeAccountNo(row.accountNo) === accountNo);
    if (matched) {
      accountName = matched.accountName;
      custodyCode = matched.custodyCode;
      accountType = matched.accountType || "SPOT";
      status = matched.status || "ACTIVE";
      source = "api_key_verified";
    }
  } catch {
    // Keep cached user-link state even if DNSE API is temporarily unavailable.
  }

  return NextResponse.json({
    linked: true,
    connection: {
      accountNo,
      accountId: accountNo,
      accountName,
      custodyCode,
      subAccountId: custodyCode,
      accountType,
      status,
      linkedAt: user.dnseAppliedAt,
      source,
    },
  });
}

/**
 * POST /api/user/dnse/link
 * Liên kết user với tài khoản DNSE đã xác thực từ server-side API key.
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

  if (!process.env.DNSE_API_KEY?.trim()) {
    return NextResponse.json(
      { error: "DNSE_API_KEY chưa cấu hình trên server" },
      { status: 500 },
    );
  }

  let matched:
    | {
        accountNo: string;
        accountName: string | null;
        custodyCode: string | null;
        accountType: string;
        status: string;
      }
    | null = null;

  try {
    const client = getDnseTradingClient();
    const accounts = await client.getAccounts();
    matched =
      accounts.find((row) => normalizeAccountNo(row.accountNo) === accountNo) ?? null;
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Không thể xác minh tài khoản tại DNSE";
    return NextResponse.json(
      { error: `Cannot verify account at DNSE: ${message}` },
      { status: 502 },
    );
  }

  if (!matched) {
    return NextResponse.json(
      { error: `Account ${accountNo} not found in DNSE` },
      { status: 404 },
    );
  }

  const existing = await prisma.user.findUnique({
    where: { dnseId: accountNo },
    select: { id: true, email: true },
  });
  if (existing && existing.id !== userId) {
    return NextResponse.json(
      { error: "Tài khoản DNSE này đã liên kết với user khác" },
      { status: 409 },
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
    await tx.dnseConnection.deleteMany({ where: { userId } });
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
      source: "api_key_verified",
    },
  });
}

/**
 * DELETE /api/user/dnse/link
 * Gỡ liên kết DNSE của user hiện tại.
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

  return NextResponse.json({
    success: true,
    message: "Đã gỡ liên kết tài khoản DNSE",
  });
}
